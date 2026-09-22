#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createRetriever } from "./fetch.js";
import { exportCassian } from "./export-cassian.js";
import { exportAurora } from "./export-aurora.js";
import { DND2024_INDEX_URL, DND5E_INDEX_URL, discover2024Indexes, discover2024Pages, discover5eIndexes, discover5ePages } from "./discover.js";
import { assertLicenseStatus, writeNormalizedRecord } from "./normalize.js";
import { parseDnd2024Page, parseDnd5ePage } from "./parse.js";
import { safeSegment, urlKey, writeAtomic } from "./paths.js";
import { previewCassianImport, stageCassianImport } from "./review-cassian.js";
import { validateOutput } from "./validate.js";

const sites = Object.freeze({
  "5e": { host: "dnd5e.wikidot.com", ruleset: "5e" },
  "5.5e": { host: "dnd2024.wikidot.com", ruleset: "5.5e" },
});

function argumentsFor(values) {
  const result = { _: [], url: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) { result._.push(value); continue; }
    const name = value.slice(2);
    if (["resume", "dry-run", "no-robots", "strict"].includes(name)) { result[name] = true; continue; }
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`Missing value for --${name}`);
    index += 1;
    if (name === "url") result.url.push(next);
    else result[name] = next;
  }
  return result;
}

function siteFor(url, requested) {
  if (requested && !sites[requested]) throw new Error(`Unsupported site: ${requested}`);
  const host = new URL(url).hostname;
  const inferred = Object.entries(sites).find(([, definition]) => definition.host === host)?.[0];
  const site = requested || inferred;
  if (!site) throw new Error(`Unsupported Wikidot host: ${host}`);
  if (sites[site].host !== host) throw new Error(`URL host ${host} does not match --site ${site}`);
  return site;
}

async function crawl(options) {
  const root = path.resolve(import.meta.dirname, "..");
  const outputDir = path.resolve(options["output-dir"] || path.join(root, "output"));
  const cacheDir = path.resolve(options["cache-dir"] || path.join(root, ".cache"));
  if (options["license-status"]) assertLicenseStatus(options["license-status"]);
  if (!options.url.length && !options.site) throw new Error("Crawl requires --site or at least one --url.");
  let plan = options.url.map((url) => ({ url: new URL(url).href, site: siteFor(url, options.site) }));
  const discoverySite = options.site || "5e";
  const discoveryUrl = discoverySite === "5.5e" ? DND2024_INDEX_URL : DND5E_INDEX_URL;
  if (options["dry-run"]) return { dryRun: true, discovery: !plan.length, pages: plan.length ? plan : [{ url: discoveryUrl, site: discoverySite, index: true }], outputDir, cacheDir };
  const retriever = createRetriever({ cacheDir, rateMs: Number(options["rate-ms"] ?? 1000), retries: Number(options.retries ?? 2), obeyRobots: !options["no-robots"] });
  async function saveRaw(item, fetched) {
    const definition = sites[item.site];
    const slug = safeSegment(new URL(item.url).pathname.replace(/^\//, ""), urlKey(item.url).slice(0, 12));
    const base = path.join(outputDir, "raw", definition.host, `${slug}-${urlKey(item.url).slice(0, 12)}`);
    await writeAtomic(`${base}.html`, fetched.body);
    const metadata = { schemaVersion: 1, site: item.site, ruleset: definition.ruleset, sourcePageUrl: item.url, retrievedAt: fetched.retrievedAt, rawSha256: fetched.sha256, contentType: fetched.contentType, licenseStatus: options["license-status"] || "unknown", fromCache: fetched.fromCache };
    await writeAtomic(`${base}.json`, `${JSON.stringify(metadata, null, 2)}\n`);
    return metadata;
  }
  if (!plan.length) {
    const indexItem = { url: discoveryUrl, site: discoverySite };
    const index = await retriever.retrieve(indexItem.url, { resume: Boolean(options.resume) });
    await saveRaw(indexItem, index);
    const discoverPages = discoverySite === "5.5e" ? discover2024Pages : discover5ePages;
    const discoverIndexes = discoverySite === "5.5e" ? discover2024Indexes : discover5eIndexes;
    const discovered = discoverPages(index.body, indexItem.url, { type: options.type });
    const indexes = discoverIndexes(index.body, indexItem.url);
    for (const indexUrl of indexes) {
      const childItem = { url: indexUrl, site: discoverySite };
      const child = await retriever.retrieve(indexUrl, { resume: Boolean(options.resume) });
      await saveRaw(childItem, child);
      discovered.push(...discoverPages(child.body, indexUrl, { type: options.type }));
    }
    plan = [...new Map(discovered.map((item) => [item.url, item])).values()]
      .sort((left, right) => left.type.localeCompare(right.type) || left.url.localeCompare(right.url));
    const limit = Number(options.limit || 0);
    if (Number.isInteger(limit) && limit > 0) plan = plan.slice(0, limit);
    plan = plan.map((item) => ({ ...item, site: discoverySite }));
  }
  const records = [];
  for (const item of plan) {
    const fetched = await retriever.retrieve(item.url, { resume: Boolean(options.resume) });
    const metadata = await saveRaw(item, fetched);
    const parse = item.site === "5e" ? parseDnd5ePage : parseDnd2024Page;
    const parsed = parse({ html: fetched.body, sourcePageUrl: item.url, retrievedAt: fetched.retrievedAt, rawSha256: fetched.sha256 });
    parsed.licenseStatus = options["license-status"] || parsed.licenseStatus;
    const normalized = await writeNormalizedRecord(outputDir, parsed, { strict: Boolean(options.strict) });
    records.push({ ...metadata, id: normalized.record.id, type: normalized.record.type, publication: normalized.record.publication, contentClassification: normalized.record.contentClassification, normalizedFile: path.relative(outputDir, normalized.filePath) });
  }
  return { dryRun: false, records: records.length, pages: records };
}

async function runCli(values = process.argv.slice(2)) {
  const options = argumentsFor(values);
  const command = options._[0] || "help";
  let result;
  if (command === "crawl") result = await crawl(options);
  else if (command === "validate") {
    const root = path.resolve(import.meta.dirname, "..");
    result = await validateOutput(path.resolve(options["output-dir"] || path.join(root, "output")), { strict: Boolean(options.strict) });
    if (!result.valid) process.exitCode = 1;
  } else if (command === "export") {
    const root = path.resolve(import.meta.dirname, "..");
    const outputDir = path.resolve(options["output-dir"] || path.join(root, "output"));
    if (options.format === "cassians-log") result = await exportCassian({ outputDir, exportDir: options["export-dir"] ? path.resolve(options["export-dir"]) : undefined });
    else if (options.format === "aurora") result = await exportAurora({ outputDir, exportDir: options["export-dir"] ? path.resolve(options["export-dir"]) : undefined });
    else throw new Error(`Exporter ${options.format || ""} is not implemented yet; use a supported --format.`);
  } else if (command === "preview-import") {
    if (options.format !== "cassians-log") throw new Error("Import preview currently supports --format cassians-log.");
    if (!options["catalog-dir"]) throw new Error("Import preview requires --catalog-dir.");
    const root = path.resolve(import.meta.dirname, "..");
    const outputDir = path.resolve(options["output-dir"] || path.join(root, "output"));
    result = await previewCassianImport({
      catalogDir: path.resolve(options["catalog-dir"]),
      candidateDir: path.resolve(options["candidate-dir"] || path.join(outputDir, "exports", "cassians-log")),
      reportFile: path.resolve(options["report-file"] || path.join(outputDir, "review", "cassian-import-preview.json")),
    });
  } else if (command === "stage-import") {
    if (options.format !== "cassians-log") throw new Error("Import staging currently supports --format cassians-log.");
    if (!options["catalog-dir"]) throw new Error("Import staging requires --catalog-dir.");
    const root = path.resolve(import.meta.dirname, "..");
    const outputDir = path.resolve(options["output-dir"] || path.join(root, "output"));
    result = await stageCassianImport({
      catalogDir: path.resolve(options["catalog-dir"]),
      candidateDir: path.resolve(options["candidate-dir"] || path.join(outputDir, "exports", "cassians-log")),
      stagingDir: path.resolve(options["staging-dir"] || path.join(outputDir, "staged", "cassians-log")),
      acceptedPreviewHash: options["accept-preview"],
    });
  } else result = { usage: "node src/cli.js crawl|validate|export|preview-import|stage-import [options]" };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

export { argumentsFor, crawl, runCli, siteFor };

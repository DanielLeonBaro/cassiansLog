import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { publicationFolder } from "./source-name.js";
import { safeSegment, writeAtomic } from "./paths.js";
import { validateNormalizedOutput } from "./validate.js";

const TYPE_MAP = Object.freeze({ class: "Class", subclass: "Archetype", species: "Race", background: "Background", feat: "Feat", spell: "Spell", item: "Magic Item" });

async function jsonFiles(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => {
      const target = path.join(root, entry.name);
      return entry.isDirectory() ? jsonFiles(target) : target.endsWith(".json") ? [target] : [];
    }))).flat().sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function xml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

export function auroraId(record) {
  return `ID_WIKIDOT_${record.ruleset.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_${record.type.toUpperCase()}_${safeSegment(record.name).replace(/-/g, "_").toUpperCase()}_${record.id.split("-").at(-1).toUpperCase()}`;
}

function spellSetters(record) {
  const content = record.content || {};
  const components = String(content.components || "");
  const material = components.match(/\bM\s*\((.*)\)\s*$/i)?.[1] || "";
  return [
    ["level", content.level ?? 0], ["school", content.school], ["time", content.castingTime], ["range", content.range], ["duration", content.duration],
    ["hasVerbalComponent", /(?:^|[, ]+)V(?:[, ]+|$)/.test(components) ? "true" : ""],
    ["hasSomaticComponent", /(?:^|[, ]+)S(?:[, ]+|$)/.test(components) ? "true" : ""],
    ["hasMaterialComponent", /(?:^|[, ]+)M(?:\s*\(|[, ]+|$)/.test(components) ? "true" : ""],
    ["materialComponent", material], ["isConcentration", content.concentration ? "true" : ""], ["isRitual", content.ritual ? "true" : ""],
  ];
}

function setters(record) {
  const provenance = [
    ["wikidot-source-url", record.sourcePageUrl], ["wikidot-raw-sha256", record.rawSha256], ["wikidot-parser-version", record.parserVersion],
    ["ruleset", record.ruleset], ["license-status", record.licenseStatus], ["content-classification", record.contentClassification],
    ["automation-status", record.automationStatus || "manual"],
  ];
  return [...(record.type === "spell" ? spellSetters(record) : []), ...provenance].filter(([, value]) => value !== undefined && value !== null && value !== "");
}

export function auroraElement(record) {
  const type = TYPE_MAP[record.type];
  if (!type) throw new Error(`Unsupported Aurora record type: ${record.type}`);
  const paragraphs = (record.content?.paragraphs || []).map((paragraph) => `\t\t\t<p>${xml(paragraph)}</p>`).join("\n") || `\t\t\t<p>${xml(`${record.name} from ${record.publication}.`)}</p>`;
  const supports = record.type === "spell" && record.content?.spellLists?.length ? `\n\t\t<supports>${xml(record.content.spellLists.join(", "))}</supports>` : "";
  const prerequisite = record.content?.prerequisite ? `\n\t\t<prerequisite>${xml(record.content.prerequisite)}</prerequisite>` : "";
  const setterXml = setters(record).map(([name, value]) => `\t\t\t<set name="${xml(name)}">${xml(value)}</set>`).join("\n");
  return `\t<element name="${xml(record.name)}" type="${xml(type)}" source="${xml(record.publication)}" id="${auroraId(record)}">${supports}${prerequisite}\n\t\t<description>\n${paragraphs}\n\t\t</description>\n\t\t<setters>\n${setterXml}\n\t\t</setters>\n\t</element>`;
}

export function auroraDocument(records) {
  const sorted = [...records].sort((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const publication = sorted[0]?.publication || "Unknown Source";
  const elements = sorted.map(auroraElement).join("\n\n");
  return `<?xml version="1.0" encoding="utf-8" ?>\n<elements>\n\t<info>\n\t\t<name>${xml(`Wikidot review - ${publication}`)}</name>\n\t\t<description>Retrieved records for private review. Verify each license-status setter before redistribution.</description>\n\t\t<author url="${xml(sorted[0]?.sourcePageUrl || "")}">Wikidot retrieval export</author>\n\t</info>\n\n${elements}\n</elements>\n`;
}

export function validateAuroraXml(document) {
  const errors = [];
  if (!/^<\?xml version="1\.0" encoding="utf-8" \?>\n<elements>/i.test(document) || !document.endsWith("</elements>\n")) errors.push("Invalid Aurora elements root.");
  if (!/<info>[\s\S]*<\/info>/.test(document)) errors.push("Aurora info block is missing.");
  const elements = [...document.matchAll(/<element\s+name="([^"]+)"\s+type="([^"]+)"\s+source="([^"]+)"\s+id="([^"]+)">([\s\S]*?)<\/element>/g)];
  const ids = new Set();
  for (const match of elements) {
    const [, name, type, source, id, body] = match;
    if (!name || !type || !source || !/^ID_WIKIDOT_[A-Z0-9_]+$/.test(id)) errors.push(`${id || "(missing)"}: invalid element attributes`);
    if (ids.has(id)) errors.push(`${id}: duplicate id`);
    ids.add(id);
    for (const setter of ["wikidot-source-url", "wikidot-raw-sha256", "wikidot-parser-version", "ruleset", "license-status", "content-classification", "automation-status"]) {
      if (!new RegExp(`<set name="${setter}">[^<]+<\\/set>`).test(body)) errors.push(`${id}: missing ${setter}`);
    }
  }
  if (!elements.length) errors.push("Aurora document contains no elements.");
  return { valid: !errors.length, elements: elements.length, errors: errors.sort() };
}

export async function exportAurora({ outputDir, exportDir = path.join(outputDir, "exports", "aurora") }) {
  const validation = await validateNormalizedOutput(outputDir, { strict: true });
  if (!validation.valid) throw new Error(`Aurora export blocked by strict validation: ${validation.errors.map(({ code }) => code).join(", ")}`);
  const records = await Promise.all((await jsonFiles(path.join(outputDir, "normalized"))).map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  const groups = new Map();
  for (const record of records) {
    const key = `${record.ruleset}\u0000${record.publication}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const files = [];
  for (const [key, group] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const [ruleset, publication] = key.split("\u0000");
    const relativeFile = `${safeSegment(ruleset)}/${publicationFolder(publication)}.xml`;
    const document = auroraDocument(group);
    const result = validateAuroraXml(document);
    if (!result.valid) throw new Error(`Invalid Aurora export ${relativeFile}: ${result.errors.join("; ")}`);
    await writeAtomic(path.join(exportDir, relativeFile), document);
    files.push({ file: relativeFile, publication, ruleset, elements: result.elements });
  }
  const manifest = { schemaVersion: 1, format: "aurora-elements", records: records.length, files, licenseStatuses: [...new Set(records.map(({ licenseStatus }) => licenseStatus))].sort(), redistributionAllowed: records.every(({ licenseStatus }) => ["open-license", "permission-granted"].includes(licenseStatus)) };
  await writeAtomic(path.join(exportDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { format: manifest.format, exportDir, records: records.length, files: ["manifest.json", ...files.map(({ file }) => file)] };
}

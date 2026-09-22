import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { safeSegment, writeAtomic } from "./paths.js";
import { validateNormalizedOutput } from "./validate.js";

const TYPE_MAP = Object.freeze({
  class: ["Class", "classes"], subclass: ["Archetype", "subclasses"], species: ["Race", "races"],
  background: ["Background", "backgrounds"], feat: ["Feat", "feats"], spell: ["Spell", "spells"], item: ["Magic Item", "items"],
});

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

function summary(record) {
  const text = String(record.content?.paragraphs?.[0] || `${record.type} from ${record.publication}.`).replace(/\s+/g, " ").trim();
  return text.length <= 420 ? text : `${text.slice(0, 420).replace(/\s+\S*$/, "")}…`;
}

function setters(record) {
  if (record.type === "spell") return {
    level: String(record.content?.level ?? 0), school: record.content?.school || "", time: record.content?.castingTime || "",
    range: record.content?.range || "", duration: record.content?.duration || "", components: record.content?.components || "",
    isConcentration: String(Boolean(record.content?.concentration)), isRitual: String(Boolean(record.content?.ritual)),
  };
  if (record.type === "item") return { category: record.content?.itemType || "Magic Item" };
  return {};
}

function actionTime(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("bonus action")) return "Bonus Action";
  if (text.includes("reaction")) return "Reaction";
  if (text === "action" || text === "1 action") return "Action";
  return value || "Other";
}

function addPayload(entry, record) {
  if (record.type === "class") return { target: "class", value: entry.name };
  if (record.type === "subclass") return { target: "subclass", value: entry.name };
  if (record.type === "species") return { target: "race", value: entry.name };
  if (record.type === "background") return { target: "background", value: entry.name };
  if (record.type === "spell") {
    const level = Number(record.content?.level || 0);
    return { target: "spells", value: {
      id: entry.id, name: entry.name, category: level ? `${level}${level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th"}-level Spell` : "Cantrip",
      action: actionTime(record.content?.castingTime), level, school: record.content?.school || "", range: record.content?.range || "",
      duration: record.content?.duration || "", components: record.content?.components || "", concentration: Boolean(record.content?.concentration),
      ritual: Boolean(record.content?.ritual), source: record.sourcePageUrl, prepared: false, description: entry.summary,
      publication: entry.publication, _compendiumId: entry.id,
    } };
  }
  if (record.type === "item") return { target: "inventory", value: {
    id: entry.id, name: entry.name, quantity: 1, description: entry.summary, publication: entry.publication, _compendiumId: entry.id,
  } };
  return { target: "features", value: { id: entry.id, name: entry.name, category: entry.type, description: entry.summary, publication: entry.publication, _compendiumId: entry.id } };
}

export function cassianEntry(record) {
  const mapped = TYPE_MAP[record.type];
  if (!mapped) throw new Error(`Unsupported Cassian record type: ${record.type}`);
  const [type, category] = mapped;
  const entry = {
    id: record.id,
    originalId: `ID_WIKIDOT_${record.ruleset.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_${record.type.toUpperCase()}_${safeSegment(record.name).replace(/-/g, "_").toUpperCase()}_${record.id.split("-").at(-1).toUpperCase()}`,
    name: record.name,
    type,
    category,
    publication: record.publication,
    description: (record.content?.paragraphs || []).join("\n\n"),
    summary: summary(record),
    supports: record.type === "spell" ? (record.content?.spellLists || []).join(", ") : "",
    prerequisite: record.content?.prerequisite || "",
    requirements: "",
    setters: setters(record),
    rules: null,
    related: [],
    facets: {
      kinds: [type], damageTypes: [], rarity: "", attunement: "", spellLevel: record.type === "spell" ? String(record.content?.level ?? "") : "",
      school: record.type === "spell" ? record.content?.school || "" : "", keywords: record.content?.tags || [], supports: record.content?.spellLists || [],
    },
    ruleset: record.ruleset,
    publisher: "Unknown Publisher",
    source: record.publication,
    sourcePageUrl: record.sourcePageUrl,
    rawSha256: record.rawSha256,
    parserVersion: record.parserVersion,
    licenseStatus: record.licenseStatus,
    contentClassification: record.contentClassification,
    automation: { status: record.automationStatus || "manual", reasons: ["Wikidot parser preserves content but does not infer executable rules."] },
    dependencies: [],
    sourceContent: record.content,
  };
  entry.add = addPayload(entry, record);
  return entry;
}

export function validateCassianPackage({ manifest, index, categories }) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 || manifest?.format !== "cassians-log-compendium-import") errors.push("Invalid Cassian manifest.");
  if (!Array.isArray(index?.entries)) errors.push("Cassian index entries are missing.");
  const entries = Object.values(categories || {}).flatMap((document) => document?.entries || []);
  const ids = new Set();
  for (const entry of entries) {
    for (const field of ["id", "originalId", "name", "type", "category", "publication", "ruleset", "sourcePageUrl", "rawSha256", "parserVersion", "licenseStatus", "contentClassification"]) {
      if (!entry[field]) errors.push(`${entry.id || "(missing)"}: missing ${field}`);
    }
    if (ids.has(entry.id)) errors.push(`${entry.id}: duplicate id`);
    ids.add(entry.id);
    if (categories[entry.category]?.category !== entry.category) errors.push(`${entry.id}: category mismatch`);
  }
  if ((index?.entries || []).length !== entries.length || manifest?.entries !== entries.length) errors.push("Cassian entry counts disagree.");
  return { valid: !errors.length, entries: entries.length, errors: errors.sort() };
}

export async function exportCassian({ outputDir, exportDir = path.join(outputDir, "exports", "cassians-log") }) {
  const validation = await validateNormalizedOutput(outputDir, { strict: true });
  if (!validation.valid) throw new Error(`Cassian export blocked by strict validation: ${validation.errors.map(({ code }) => code).join(", ")}`);
  const records = await Promise.all((await jsonFiles(path.join(outputDir, "normalized"))).map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  const entries = records.map(cassianEntry).sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const categories = {};
  for (const entry of entries) {
    categories[entry.category] ||= { category: entry.category, label: entry.category === "races" ? "Races & Lineages" : `${entry.category[0].toUpperCase()}${entry.category.slice(1)}`, entries: [] };
    categories[entry.category].entries.push(entry);
  }
  const index = { entries: entries.map(({ description, rules, related, sourceContent, ...entry }) => entry) };
  const manifest = {
    schemaVersion: 1,
    format: "cassians-log-compendium-import",
    entries: entries.length,
    categories: Object.keys(categories).sort().map((id) => ({ id, label: categories[id].label, file: `${id}.json`, count: categories[id].entries.length })),
    publications: [...new Set(entries.map(({ publication }) => publication))].sort(),
    rulesets: [...new Set(entries.map(({ ruleset }) => ruleset))].sort(),
    licenseStatuses: [...new Set(entries.map(({ licenseStatus }) => licenseStatus))].sort(),
    redistributionAllowed: entries.every(({ licenseStatus }) => ["open-license", "permission-granted"].includes(licenseStatus)),
  };
  const packageValidation = validateCassianPackage({ manifest, index, categories });
  if (!packageValidation.valid) throw new Error(`Invalid Cassian export: ${packageValidation.errors.join("; ")}`);
  await writeAtomic(path.join(exportDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeAtomic(path.join(exportDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  for (const category of Object.keys(categories).sort()) await writeAtomic(path.join(exportDir, `${category}.json`), `${JSON.stringify(categories[category], null, 2)}\n`);
  return { format: manifest.format, exportDir, ...packageValidation, files: ["manifest.json", "index.json", ...manifest.categories.map(({ file }) => file)] };
}

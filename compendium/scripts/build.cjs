const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { XMLParser } = require("fast-xml-parser");
const { writeJSON } = require("../../shared/build/output.cjs");

const featureRoot = path.resolve(__dirname, "..");
const inputRoot = path.join(featureRoot, "source");
const outputRoot = path.join(featureRoot, "data");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  preserveOrder: true,
  processEntities: true,
  trimValues: false,
});

const categoryDefinitions = {
  classes: { label: "Classes", types: ["Class"] },
  subclasses: { label: "Subclasses", types: ["Archetype"] },
  races: {
    label: "Races & Lineages",
    types: ["Race", "Sub Race", "Race Variant", "Dragonmark"],
  },
  backgrounds: {
    label: "Backgrounds",
    types: ["Background", "Background Variant"],
  },
  feats: {
    label: "Feats",
    types: ["Feat", "Ability Score Improvement"],
  },
  spells: { label: "Spells", types: ["Spell"] },
  items: {
    label: "Items",
    types: ["Item", "Weapon", "Armor", "Magic Item", "Weapon Property", "Weapon Group"],
  },
  features: {
    label: "Features & Traits",
    types: [
      "Class Feature",
      "Archetype Feature",
      "Racial Trait",
      "Background Feature",
      "Feat Feature",
    ],
  },
  companions: {
    label: "Companions",
    types: [
      "Companion",
      "Companion Trait",
      "Companion Action",
      "Companion Reaction",
    ],
  },
  languages: { label: "Languages", types: ["Language"] },
  deities: { label: "Deities", types: ["Deity"] },
  proficiencies: { label: "Proficiencies", types: ["Proficiency"] },
  rules: {
    label: "Rules & Options",
    types: [
      "Alignment",
      "Condition",
      "Information",
      "Magic School",
      "Option",
      "Rule",
      "Vision",
    ],
  },
};

const typeToCategory = new Map();
Object.entries(categoryDefinitions).forEach(([category, definition]) => {
  definition.types.forEach((type) => typeToCategory.set(type, category));
});

const typeTokens = {
  "Ability Score Improvement": "abilityScoreImprovement",
  Alignment: "alignment",
  Archetype: "subclass",
  "Archetype Feature": "subclassFeature",
  Armor: "armor",
  Background: "background",
  "Background Feature": "backgroundFeature",
  "Background Variant": "backgroundVariant",
  Class: "class",
  "Class Feature": "classFeature",
  Companion: "companion",
  "Companion Action": "companionAction",
  "Companion Reaction": "companionReaction",
  "Companion Trait": "companionTrait",
  Condition: "condition",
  Deity: "deity",
  Dragonmark: "dragonmark",
  Feat: "feat",
  "Feat Feature": "featFeature",
  Information: "information",
  Internal: "internal",
  Item: "item",
  Language: "language",
  "Magic Item": "magicItem",
  "Magic School": "magicSchool",
  Option: "option",
  Proficiency: "proficiency",
  Race: "race",
  "Race Variant": "raceVariant",
  "Racial Trait": "racialTrait",
  Rule: "rule",
  "Sub Race": "subrace",
  Support: "support",
  Vision: "vision",
  Weapon: "weapon",
  "Weapon Group": "weaponGroup",
  "Weapon Property": "weaponProperty",
};

const knownPublicationTokens = new Map(
  Object.entries({
    "aurora legacy essentials": "ale",
    "dungeon master's guide": "dmg",
    "dungeon masters guide": "dmg",
    "eberron rising from the last war": "erlw",
    "fizban's treasury of dragons": "ftd",
    "mordenkainen's tome of foes": "mtof",
    "player's handbook": "phb",
    "players handbook": "phb",
    "strixhaven a curriculum of chaos": "sacoc",
    "sword coast adventurer's guide": "scag",
    "tasha's cauldron of everything": "tcoe",
    "the book of many things": "tbomt",
    "van richten's guide to ravenloft": "vrgtr",
    "volo's guide to monsters": "vgm",
    "wayfinder's guide to eberron": "wgte",
    "xanathar's guide to everything": "xgte",
  }),
);

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".xml")
      ? [fullPath]
      : [];
  });
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pascal(value) {
  const words = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join("") || "Unknown";
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function childEntries(nodes, tagName) {
  return (nodes || [])
    .filter((entry) => Object.prototype.hasOwnProperty.call(entry, tagName))
    .map((entry) => ({ nodes: entry[tagName], attrs: entry[":@"] || {} }));
}

function firstChild(nodes, tagName) {
  return childEntries(nodes, tagName)[0] || null;
}

function normalizePlainText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const blockTags = new Set([
  "blockquote",
  "br",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "table",
  "tr",
  "ul",
]);

function nodesToText(nodes) {
  let value = "";
  for (const entry of nodes || []) {
    for (const [tag, children] of Object.entries(entry)) {
      if (tag === ":@") continue;
      if (tag === "#text") {
        value += String(children);
        continue;
      }
      const childText = nodesToText(children);
      if (tag === "li") value += `\n- ${childText}`;
      else if (tag === "td" || tag === "th") value += `${childText} | `;
      else if (blockTags.has(tag)) value += `\n${childText}\n`;
      else value += childText;
    }
  }
  return normalizePlainText(value);
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

const allowedRichTags = new Set([
  "blockquote",
  "br",
  "em",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "b",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

function nodesToHTML(nodes) {
  let value = "";
  for (const entry of nodes || []) {
    for (const [tag, children] of Object.entries(entry)) {
      if (tag === ":@") continue;
      if (tag === "#text") {
        value += escapeHTML(children);
        continue;
      }
      const attrs = entry[":@"] || {};
      if (tag === "div" && attrs.element) continue;
      const childHTML = nodesToHTML(children);
      if (!allowedRichTags.has(tag)) {
        value += childHTML;
        continue;
      }
      if (tag === "br" || tag === "hr") {
        value += `<${tag}>`;
        continue;
      }
      const safeAttributes = [];
      if ((tag === "td" || tag === "th") && /^\d+$/.test(attrs.colspan || ""))
        safeAttributes.push(`colspan="${attrs.colspan}"`);
      if ((tag === "td" || tag === "th") && /^\d+$/.test(attrs.rowspan || ""))
        safeAttributes.push(`rowspan="${attrs.rowspan}"`);
      value += `<${tag}${safeAttributes.length ? ` ${safeAttributes.join(" ")}` : ""}>${childHTML}</${tag}>`;
    }
  }
  return value.replace(/>\s+</g, "><").trim();
}

function namedValues(nodes, containerName, entryName) {
  const container = firstChild(nodes, containerName);
  if (!container) return {};
  const values = {};
  childEntries(container.nodes, entryName).forEach(({ nodes: valueNodes, attrs }) => {
    const name = attrs.name || entryName;
    const value = nodesToText(valueNodes);
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      values[name] = Array.isArray(values[name])
        ? [...values[name], value]
        : [values[name], value];
    } else {
      values[name] = value;
    }
  });
  return values;
}

function extractRuleNodes(nodes) {
  const rules = firstChild(nodes, "rules");
  if (!rules) return null;
  const result = { grants: [], selections: [], stats: [] };
  for (const entry of rules.nodes) {
    for (const [tag, children] of Object.entries(entry)) {
      if (!["grant", "select", "stat"].includes(tag)) continue;
      const record = { ...(entry[":@"] || {}) };
      const items = childEntries(children, "item").map(({ nodes: itemNodes, attrs }) => ({
        ...attrs,
        label: nodesToText(itemNodes),
      }));
      if (items.length) record.items = items;
      if (tag === "grant") result.grants.push(record);
      else if (tag === "select") result.selections.push(record);
      else result.stats.push(record);
    }
  }
  return Object.values(result).some((records) => records.length) ? result : null;
}

function extractReferences(nodes, references = new Set()) {
  for (const entry of nodes || []) {
    if (entry[":@"]?.element) references.add(entry[":@"].element);
    for (const [tag, children] of Object.entries(entry)) {
      if (tag !== ":@" && tag !== "#text" && Array.isArray(children))
        extractReferences(children, references);
    }
  }
  return references;
}

function sentenceSummary(value, maximum = 420) {
  const text = normalizePlainText(value).replace(/\n+/g, " ");
  if (text.length <= maximum) return text;
  const clipped = text.slice(0, maximum + 1);
  const sentence = clipped.match(/^(.{180,420}?[.!?])(?:\s|$)/);
  if (sentence) return sentence[1];
  return `${text.slice(0, maximum).replace(/\s+\S*$/, "")}…`;
}

function setterValue(setters, name) {
  const value = setters[name];
  return Array.isArray(value) ? value[0] : value;
}

function detailSummary(entry) {
  const labels = {
    armorClass: "Armor class",
    category: "Category",
    cost: "Cost",
    damage: "Damage",
    duration: "Duration",
    hd: "Hit die",
    range: "Range",
    rarity: "Rarity",
    school: "School",
    short: "Summary",
    time: "Casting time",
    type: "Type",
    versatile: "Versatile damage",
    weight: "Weight",
  };
  const details = Object.entries(labels)
    .map(([name, label]) => {
      const value = setterValue(entry.setters, name);
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean);
  if (details.length) return sentenceSummary(details.join(". "));
  return `${entry.type} from ${entry.publication}.`;
}

function publicationToken(publication, abbreviation) {
  const known = knownPublicationTokens.get(normalizeKey(publication));
  if (known) return known;
  const cleanedAbbreviation = String(abbreviation || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (cleanedAbbreviation && cleanedAbbreviation.length <= 12)
    return cleanedAbbreviation;
  const words = normalizeKey(publication).split(" ").filter(Boolean);
  const withoutFillers = words.filter(
    (word) => !["a", "an", "and", "for", "from", "of", "the", "to"].includes(word),
  );
  const initials = withoutFillers.map((word) => word[0]).join("");
  return initials || "unknown";
}

function categoryFor(type) {
  return typeToCategory.get(type) || "rules";
}

function actionTime(value) {
  const normalized = normalizeKey(value);
  if (normalized === "1 action" || normalized === "action") return "Action";
  if (normalized.includes("bonus action")) return "Bonus Action";
  if (normalized.includes("reaction")) return "Reaction";
  if (normalized.includes("free action")) return "Free Action";
  return value || "Other";
}

function componentsFor(setters) {
  const components = [];
  if (setterValue(setters, "hasVerbalComponent") === "true") components.push("V");
  if (setterValue(setters, "hasSomaticComponent") === "true") components.push("S");
  if (setterValue(setters, "hasMaterialComponent") === "true") components.push("M");
  const material = setterValue(setters, "materialComponent");
  return `${components.join(", ")}${material ? ` (${material})` : ""}`;
}

function addPayload(entry) {
  const commonFeature = {
    id: entry.id,
    name: entry.name,
    category: entry.type,
    description: entry.summary,
    publication: entry.publication,
    _compendiumId: entry.id,
  };
  switch (entry.type) {
    case "Class":
      return { target: "class", value: entry.name };
    case "Archetype":
      return { target: "subclass", value: entry.name };
    case "Race":
    case "Sub Race":
    case "Race Variant":
    case "Dragonmark":
      return { target: "race", value: entry.name };
    case "Background":
    case "Background Variant":
      return { target: "background", value: entry.name };
    case "Spell": {
      const level = Number(setterValue(entry.setters, "level") || 0);
      return {
        target: "spells",
        value: {
          id: entry.id,
          name: entry.name,
          category: level === 0 ? "Cantrip" : `${level}${level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th"}-level Spell`,
          action: actionTime(setterValue(entry.setters, "time")),
          level,
          school: setterValue(entry.setters, "school") || "",
          range: setterValue(entry.setters, "range") || "",
          duration: setterValue(entry.setters, "duration") || "",
          components: componentsFor(entry.setters),
          concentration:
            setterValue(entry.setters, "isConcentration") === "true",
          ritual: setterValue(entry.setters, "isRitual") === "true",
          source: "",
          prepared: false,
          description: entry.summary,
          publication: entry.publication,
          _compendiumId: entry.id,
        },
      };
    }
    case "Item":
    case "Weapon":
    case "Armor":
    case "Magic Item":
    case "Weapon Property":
    case "Weapon Group": {
      const details = [
        setterValue(entry.setters, "damage") &&
          `Damage: ${setterValue(entry.setters, "damage")}`,
        setterValue(entry.setters, "range") &&
          `Range: ${setterValue(entry.setters, "range")}`,
        setterValue(entry.setters, "armorClass") &&
          `Armor class: ${setterValue(entry.setters, "armorClass")}`,
        setterValue(entry.setters, "rarity") &&
          `Rarity: ${setterValue(entry.setters, "rarity")}`,
        entry.summary,
      ].filter(Boolean);
      return {
        target: "inventory",
        value: {
          id: entry.id,
          name: entry.name,
          quantity: 1,
          description: details.join(". "),
          publication: entry.publication,
          _compendiumId: entry.id,
        },
      };
    }
    default:
      return { target: "features", value: commonFeature };
  }
}

function preferenceScore(record) {
  const relative = record.inputPath.replace(/\\/g, "/");
  let score = Math.min(record.description.length / 1000, 15);
  if (!relative.startsWith("AuroraLegacy/")) score += 100;
  if (relative.startsWith("core/")) score += 30;
  if (relative.startsWith("supplements/")) score += 20;
  if (relative.split("/").length <= 3) score += 5;
  return score;
}

function readFileRecord(filePath) {
  const inputPath = path.relative(inputRoot, filePath);
  const parsed = parser.parse(fs.readFileSync(filePath, "utf8"));
  const elementsRoot = parsed.find((entry) => entry.elements)?.elements;
  if (!elementsRoot) return { inputPath, entries: [] };
  const entries = childEntries(elementsRoot, "element").map(({ nodes, attrs }) => {
    const descriptionNode = firstChild(nodes, "description");
    const description = descriptionNode ? nodesToText(descriptionNode.nodes) : "";
    const descriptionHtml = descriptionNode
      ? nodesToHTML(descriptionNode.nodes)
      : "";
    const sheetNode = firstChild(nodes, "sheet");
    const sheetDescriptionNode = sheetNode
      ? firstChild(sheetNode.nodes, "description")
      : null;
    const sheetText = sheetDescriptionNode
      ? nodesToText(sheetDescriptionNode.nodes)
      : sheetNode
        ? nodesToText(sheetNode.nodes)
        : "";
    const setters = namedValues(nodes, "setters", "set");
    const requirementsNode = firstChild(nodes, "requirements");
    const prerequisiteNode = firstChild(nodes, "prerequisite");
    const supportsNode = firstChild(nodes, "supports");
    return {
      originalId: attrs.id || "",
      name: attrs.name || "Unnamed",
      type: attrs.type || "Information",
      sourceAttribute: attrs.source || "",
      inputPath,
      description,
      descriptionHtml,
      sheet: sheetText,
      sheetAttributes: sheetNode?.attrs || {},
      short: setterValue(setters, "short") || "",
      setters,
      supports: supportsNode ? nodesToText(supportsNode.nodes) : "",
      prerequisite: prerequisiteNode ? nodesToText(prerequisiteNode.nodes) : "",
      requirements: requirementsNode ? nodesToText(requirementsNode.nodes) : "",
      relatedIds: [...extractReferences(nodes)],
      rules: extractRuleNodes(nodes),
    };
  });
  return { inputPath, entries };
}

if (!fs.existsSync(inputRoot)) {
  throw new Error(`Compendium input folder not found: ${inputRoot}`);
}

const xmlFiles = listFiles(inputRoot).sort();
const fileRecords = xmlFiles.map(readFileRecord);

const sourceByDirectory = new Map();
const abbreviationBySource = new Map();
for (const fileRecord of fileRecords) {
  const sources = fileRecord.entries.filter((entry) => entry.type === "Source");
  if (!sources.length) continue;
  const source = sources[0];
  const abbreviation = setterValue(source.setters, "abbreviation") || "";
  sourceByDirectory.set(path.dirname(fileRecord.inputPath), {
    name: source.name,
    abbreviation,
  });
  if (abbreviation)
    abbreviationBySource.set(normalizeKey(source.name), abbreviation);
}

function nearestPackage(inputPath) {
  let directory = path.dirname(inputPath);
  while (directory && directory !== ".") {
    if (sourceByDirectory.has(directory)) return sourceByDirectory.get(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

const rawEntries = fileRecords
  .flatMap((fileRecord) => fileRecord.entries)
  .filter(
    (entry) =>
      !["Grants", "Internal", "Source", "Support"].includes(entry.type),
  )
  .map((entry) => {
    const packageSource = nearestPackage(entry.inputPath);
    const publication = packageSource?.name || entry.sourceAttribute || "Unknown Source";
    const abbreviation =
      packageSource?.abbreviation ||
      abbreviationBySource.get(normalizeKey(publication)) ||
      "";
    return { ...entry, publication, abbreviation };
  });

const byOriginalId = new Map();
for (const entry of rawEntries) {
  const key =
    entry.originalId ||
    `${normalizeKey(entry.publication)}|${entry.type}|${normalizeKey(entry.name)}|${entry.inputPath}`;
  const current = byOriginalId.get(key);
  if (!current || preferenceScore(entry) > preferenceScore(current))
    byOriginalId.set(key, entry);
}

const canonicalEntries = [...byOriginalId.values()].sort((left, right) =>
  `${left.type}|${left.name}|${left.publication}`.localeCompare(
    `${right.type}|${right.name}|${right.publication}`,
  ),
);

const usedIds = new Map();
for (const entry of canonicalEntries) {
  const prefix = publicationToken(entry.publication, entry.abbreviation);
  const typeToken = typeTokens[entry.type] || pascal(entry.type);
  const baseId = `${prefix}${pascal(typeToken)}${pascal(entry.name)}`.replace(
    /^([A-Z])/,
    (letter) => letter.toLowerCase(),
  );
  let id = baseId;
  if (usedIds.has(id)) {
    const contextualSuffix = pascal(
      entry.originalId
        .replace(/^ID_/, "")
        .split("_")
        .slice(-3)
        .join(" "),
    );
    id = `${baseId}${contextualSuffix}`;
  }
  if (usedIds.has(id))
    id = `${id}${hash(`${entry.originalId}|${entry.inputPath}`)}`;
  usedIds.set(id, entry.originalId);
  entry.id = id;
  entry.category = categoryFor(entry.type);
  entry.summary =
    sentenceSummary(entry.sheet || entry.short || entry.description) ||
    detailSummary(entry);
  entry.add = addPayload(entry);
}

const nameByOriginalId = new Map(
  canonicalEntries
    .filter((entry) => entry.originalId)
    .map((entry) => [entry.originalId, entry.name]),
);

canonicalEntries.forEach((entry) => {
  entry.related = entry.relatedIds.map((originalId) => ({
    originalId,
    name: nameByOriginalId.get(originalId) || originalId,
  }));
  delete entry.relatedIds;
  delete entry.sourceAttribute;
  delete entry.short;
  delete entry.abbreviation;
});

fs.mkdirSync(outputRoot, { recursive: true });
const outputFiles = new Set(["manifest.json", "index.json"]);

const categoryCounts = {};
for (const [category, definition] of Object.entries(categoryDefinitions)) {
  const entries = canonicalEntries.filter((entry) => entry.category === category);
  categoryCounts[category] = entries.length;
  const fileName = `${category}.json`;
  outputFiles.add(fileName);
  writeJSON(path.join(outputRoot, fileName), {
    category,
    label: definition.label,
    generatedAt: new Date().toISOString(),
    entries,
  });
}

const indexEntries = canonicalEntries.map((entry) => ({
  id: entry.id,
  originalId: entry.originalId,
  name: entry.name,
  type: entry.type,
  category: entry.category,
  publication: entry.publication,
  summary: entry.summary,
  supports: entry.supports,
  prerequisite: entry.prerequisite,
  add: entry.add,
}));

const publications = [...new Set(canonicalEntries.map((entry) => entry.publication))].sort(
  (left, right) => left.localeCompare(right),
);

writeJSON(path.join(outputRoot, "index.json"), {
    generatedAt: new Date().toISOString(),
    entries: indexEntries,
});

writeJSON(path.join(outputRoot, "manifest.json"), {
    generatedAt: new Date().toISOString(),
    inputFiles: xmlFiles.length,
    rawEntries: rawEntries.length,
    entries: canonicalEntries.length,
    categories: Object.entries(categoryDefinitions).map(([id, definition]) => ({
      id,
      label: definition.label,
      file: `${id}.json`,
      count: categoryCounts[id],
    })),
    publications,
});

for (const fileName of fs.readdirSync(outputRoot)) {
  if (fileName.endsWith(".json") && !outputFiles.has(fileName))
    fs.rmSync(path.join(outputRoot, fileName));
}

const sizeMB =
  fs
    .readdirSync(outputRoot)
    .filter((fileName) => fileName.endsWith(".json"))
    .reduce(
      (total, fileName) => total + fs.statSync(path.join(outputRoot, fileName)).size,
      0,
    ) /
  1024 /
  1024;

console.log(
  `Built ${canonicalEntries.length.toLocaleString()} compendium entries from ${xmlFiles.length.toLocaleString()} XML files (${sizeMB.toFixed(1)} MB JSON).`,
);

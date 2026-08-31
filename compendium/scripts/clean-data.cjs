// Rebuilds public Compendium JSON from the preserved full-data backup.
const fs = require("node:fs");
const path = require("node:path");
const { writeJSON } = require("../../shared/build/output.cjs");
const { filterCompendiumEntries } = require("./cleanup-rules.cjs");
const { compendiumFacets } = require("./facets.cjs");

const compendiumRoot = path.resolve(__dirname, "..");
const backupRoot = path.join(compendiumRoot, "dataFullBackup");
const outputRoot = path.join(compendiumRoot, "data");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const backupManifestPath = path.join(backupRoot, "manifest.json");
if (!fs.existsSync(backupManifestPath)) {
  throw new Error(`Compendium backup not found: ${backupRoot}`);
}

const backupManifest = readJSON(backupManifestPath);
const backupIndex = readJSON(path.join(backupRoot, "index.json"));
const categoryData = backupManifest.categories.map((category) => ({
  ...category,
  data: readJSON(path.join(backupRoot, category.file)),
}));
const fullEntries = categoryData
  .flatMap((category) => category.data.entries)
  .map((entry) => ({ ...entry, facets: compendiumFacets(entry) }));
const filteredEntries = filterCompendiumEntries(fullEntries);
const keptIds = new Set(filteredEntries.map((entry) => entry.id));
const filteredById = new Map(filteredEntries.map((entry) => [entry.id, entry]));
const filteredIndex = backupIndex.entries
  .filter((entry) => keptIds.has(entry.id))
  .map((entry) => ({
    ...entry,
    facets: filteredById.get(entry.id).facets,
  }));

if (filteredIndex.length !== filteredEntries.length) {
  throw new Error("Filtered Compendium detail/index counts do not match.");
}

const generatedAt = new Date().toISOString();
fs.mkdirSync(outputRoot, { recursive: true });

const filteredCategories = categoryData.map((category) => {
  const entries = category.data.entries
    .map((entry) => filteredById.get(entry.id))
    .filter(Boolean);
  writeJSON(path.join(outputRoot, category.file), {
    category: category.data.category,
    label: category.data.label,
    generatedAt,
    entries,
  });
  return {
    id: category.id,
    label: category.label,
    file: category.file,
    count: entries.length,
  };
});

writeJSON(path.join(outputRoot, "index.json"), {
  generatedAt,
  entries: filteredIndex,
});
writeJSON(path.join(outputRoot, "manifest.json"), {
  generatedAt,
  inputFiles: backupManifest.inputFiles,
  rawEntries: backupManifest.rawEntries,
  entries: filteredEntries.length,
  categories: filteredCategories,
  publications: [...new Set(filteredEntries.map((entry) => entry.publication))].sort(
    (left, right) => left.localeCompare(right),
  ),
});

console.log(
  `Cleaned Compendium: ${fullEntries.length.toLocaleString()} -> ${filteredEntries.length.toLocaleString()} entries (${(fullEntries.length - filteredEntries.length).toLocaleString()} removed).`,
);

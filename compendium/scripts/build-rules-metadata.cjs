// Rebuilds rule metadata sidecars from current generated Compendium detail files.
const fs = require("node:fs");
const path = require("node:path");
const { writeJSON } = require("../../shared/build/output.cjs");
const { writeRulesArtifacts } = require("./rules-artifacts.cjs");

const outputRoot = path.resolve(__dirname, "..", "data");
const manifestPath = path.join(outputRoot, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  throw new Error(`Compendium manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entries = manifest.categories.flatMap((category) => {
  const document = JSON.parse(fs.readFileSync(path.join(outputRoot, category.file), "utf8"));
  return Array.isArray(document.entries) ? document.entries : [];
});
if (entries.length !== manifest.entries) {
  throw new Error(`Compendium detail count ${entries.length} does not match manifest count ${manifest.entries}.`);
}

const generatedAt = manifest.generatedAt || new Date().toISOString();
const metadata = writeRulesArtifacts(outputRoot, entries, generatedAt);
writeJSON(manifestPath, { ...manifest, ...metadata });

console.log(
  `Built rule metadata for ${entries.length.toLocaleString()} Compendium entries (${metadata.catalogVersion}).`,
);

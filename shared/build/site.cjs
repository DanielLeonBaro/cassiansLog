const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const output = path.join(root, ".cloudflare", "public");
const publicEntries = [
  "index.html",
  "admin",
  "char",
  "combat-loot",
  "compendium",
  "integrations",
  "music",
  "shared",
  "wiki",
];
const privateDirectories = new Set(["build", "config", "scripts", "styles", "tests"]);

function includePublicFile(source) {
  const relative = path.relative(root, source);
  const parts = relative.split(path.sep);

  if (parts.some((part) => privateDirectories.has(part))) return false;
  if (relative.endsWith(".test.cjs")) return false;
  return true;
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of publicEntries) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), {
    recursive: true,
    filter: includePublicFile,
  });
}

console.log(`Built static site in ${output}`);

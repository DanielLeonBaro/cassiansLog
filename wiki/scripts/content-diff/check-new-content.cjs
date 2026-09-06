// Fetches a separate Wiki snapshot, then reports changes against pages.json.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { compareWikiPages, writeReports } = require("./compare.cjs");

const wikiDirectory = path.resolve(__dirname, "..", "..");
const currentPath = path.join(wikiDirectory, "data", "pages.json");
const outputDirectory = path.join(__dirname, "output");
const latestPath = path.join(outputDirectory, "latest-pages.json");

fs.mkdirSync(outputDirectory, { recursive: true });
const imported = spawnSync(process.execPath, [path.join(__dirname, "..", "import.cjs"), "--output", latestPath], {
  cwd: path.resolve(wikiDirectory, ".."),
  stdio: "inherit",
});
if (imported.error) throw imported.error;
if (imported.status !== 0) process.exit(imported.status || 1);

const currentPages = JSON.parse(fs.readFileSync(currentPath, "utf8"));
const latestPages = JSON.parse(fs.readFileSync(latestPath, "utf8"));
const diff = compareWikiPages(currentPages, latestPages);
const reports = writeReports(diff, outputDirectory);

console.log(`New ${diff.added.length}; changed ${diff.changed.length}; missing ${diff.removed.length}; unchanged ${diff.unchanged}`);
console.log(`Read ${reports.markdownPath} for the summary.`);

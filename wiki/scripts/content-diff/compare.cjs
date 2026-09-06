// Compares two normalized Wiki snapshots without mutating either source file.
const fs = require("node:fs");
const path = require("node:path");

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function equal(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function identities(page) {
  return [...new Set([page?.id, ...(Array.isArray(page?.legacyIds) ? page.legacyIds : [])].filter(Boolean))];
}

function changedFields(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => !equal(before[field], after[field]))
    .sort();
}

function compareWikiPages(currentPages, latestPages) {
  if (!Array.isArray(currentPages) || !Array.isArray(latestPages)) {
    throw new TypeError("Both Wiki snapshots must be JSON arrays");
  }

  // External source IDs in legacyIds let renamed pages match their old local page.
  const currentByIdentity = new Map();
  currentPages.forEach((page, index) => identities(page).forEach((id) => currentByIdentity.set(id, index)));
  const matchedCurrent = new Set();
  const added = [];
  const changed = [];
  let unchanged = 0;

  for (const latest of latestPages) {
    const currentIndex = identities(latest)
      .map((id) => currentByIdentity.get(id))
      .find((index) => index !== undefined && !matchedCurrent.has(index));
    if (currentIndex === undefined) {
      added.push(latest);
      continue;
    }

    matchedCurrent.add(currentIndex);
    const current = currentPages[currentIndex];
    const fields = changedFields(current, latest);
    if (fields.length) changed.push({ id: latest.id, name: latest.name, fields, before: current, after: latest });
    else unchanged += 1;
  }

  const removed = currentPages.filter((_, index) => !matchedCurrent.has(index));
  return { added, changed, removed, unchanged };
}

function markdownReport(diff) {
  const lines = [
    "# Wiki content difference",
    "",
    `- New pages: ${diff.added.length}`,
    `- Changed pages: ${diff.changed.length}`,
    `- Missing from source: ${diff.removed.length}`,
    `- Unchanged pages: ${diff.unchanged}`,
  ];

  const section = (title, entries, describe) => {
    lines.push("", `## ${title}`, "");
    if (!entries.length) lines.push("None.");
    else entries.forEach((entry) => lines.push(`- ${describe(entry)}`));
  };

  section("New pages", diff.added, (page) => `${page.name} (${page.type || "No type"})`);
  section("Changed pages", diff.changed, (page) => `${page.name}: ${page.fields.join(", ")}`);
  section("Missing from source", diff.removed, (page) => `${page.name} (${page.type || "No type"})`);
  lines.push("", "The JSON report contains the complete before/after content for every changed page.", "");
  return lines.join("\n");
}

function readPages(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeReports(diff, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, "wiki-diff.json");
  const markdownPath = path.join(outputDirectory, "wiki-diff.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(diff, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, markdownReport(diff), "utf8");
  return { jsonPath, markdownPath };
}

function main(argumentsList = process.argv.slice(2)) {
  const [currentFile, latestFile, outputDirectory] = argumentsList;
  if (!currentFile || !latestFile) {
    throw new Error("Usage: node compare.cjs CURRENT.json LATEST.json [OUTPUT_DIRECTORY]");
  }
  const destination = path.resolve(outputDirectory || path.join(__dirname, "output"));
  const diff = compareWikiPages(readPages(path.resolve(currentFile)), readPages(path.resolve(latestFile)));
  const reports = writeReports(diff, destination);
  console.log(`New ${diff.added.length}; changed ${diff.changed.length}; missing ${diff.removed.length}; unchanged ${diff.unchanged}`);
  console.log(`Reports: ${reports.markdownPath} and ${reports.jsonPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { changedFields, compareWikiPages, markdownReport, writeReports };

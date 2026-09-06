// Verifies Wiki snapshots classify new, changed, renamed, and missing pages safely.
const assert = require("node:assert/strict");
const { compareWikiPages, markdownReport } = require("../scripts/content-diff/compare.cjs");
const { getPublishedContent } = require("../scripts/import.cjs");

const current = [
  { id: "unchanged", name: "Unchanged", type: "Lore", body: "Same" },
  { id: "oldname", legacyIds: ["external-1"], name: "Old Name", type: "Person", body: "Old body" },
  { id: "missing", name: "Missing", type: "Place", body: "Gone" },
];
const latest = [
  { id: "unchanged", name: "Unchanged", type: "Lore", body: "Same" },
  { id: "newname", legacyIds: ["external-1"], name: "New Name", type: "Person", body: "New body" },
  { id: "newpage", name: "New Page", type: "Event", body: "New" },
];

const diff = compareWikiPages(current, latest);
assert.equal(diff.unchanged, 1);
assert.deepEqual(diff.added.map((page) => page.id), ["newpage"]);
assert.deepEqual(diff.removed.map((page) => page.id), ["missing"]);
assert.deepEqual(diff.changed.map((page) => page.id), ["newname"]);
assert.deepEqual(diff.changed[0].fields, ["body", "id", "name"]);
assert.equal(diff.changed[0].before.body, "Old body");
assert.equal(diff.changed[0].after.body, "New body");

const report = markdownReport(diff);
assert.match(report, /New pages: 1/);
assert.match(report, /New Name: body, id, name/);
assert.match(report, /Missing \(Place\)/);

assert.throws(() => compareWikiPages({}, []), /JSON arrays/);

function flightScript(value) {
  return `<script>self.__next_f.push([1,${JSON.stringify(value)}])</script>`;
}

const pageId = "external-page-id";
const siteBundle = { snapshot: { documents: [{ id: pageId }], embeds: {} }, appId: "wiki", docId: null };
const pageBundle = {
  snapshot: { documents: [{ id: pageId }], embeds: { [pageId]: { content: ["page body"] } } },
  appId: "wiki",
  docId: pageId,
};
const published = getPublishedContent(flightScript(`${JSON.stringify(siteBundle)}${JSON.stringify(pageBundle)}`));
assert.equal(published.bundle.docId, pageId);
assert.deepEqual(published.bundle.snapshot.embeds[pageId].content, ["page body"]);

console.log("Wiki content difference tests passed.");

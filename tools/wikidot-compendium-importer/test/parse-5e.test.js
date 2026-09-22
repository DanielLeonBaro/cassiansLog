import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discover5eIndexes, discover5ePages, typeFromUrl } from "../src/discover.js";
import { stableRecordId, writeNormalizedRecord } from "../src/normalize.js";
import { parseDnd5ePage } from "../src/parse.js";

const fixtures = path.join(import.meta.dirname, "fixtures", "5e");
const read = (name) => readFile(path.join(fixtures, name), "utf8");
const metadata = { retrievedAt: "2026-09-22T00:00:00.000Z", rawSha256: "abc123" };

test("5e index discovery classifies supported page families", async () => {
  const pages = discover5ePages(await read("index.html"));
  assert.equal(pages.length, 7);
  assert.deepEqual([...new Set(pages.map(({ type }) => type))].sort(), ["background", "class", "feat", "item", "species", "spell", "subclass"]);
  assert.equal(discover5ePages(await read("index.html"), undefined, { type: "spell" }).length, 1);
  assert.deepEqual(discover5eIndexes(await read("index.html")), ["https://dnd5e.wikidot.com/spells", "https://dnd5e.wikidot.com/wondrous-items"]);
  assert.equal(typeFromUrl("https://dnd5e.wikidot.com/wondrous-items"), "", "category indexes are not item records");
  assert.equal(typeFromUrl("https://dnd5e.wikidot.com/wizard:evocation"), "subclass");
});

test("representative 5e pages preserve provenance and structured content", async () => {
  const cases = [
    ["class-wizard.html", "https://dnd5e.wikidot.com/wizard", "class", "Wizard", "Player's Handbook"],
    ["subclass-evocation.html", "https://dnd5e.wikidot.com/wizard:evocation", "subclass", "School of Evocation", "Player's Handbook"],
    ["background-far-traveler.html", "https://dnd5e.wikidot.com/background:far-traveler", "background", "Far Traveler", "Sword Coast Adventurer's Guide"],
    ["species-human.html", "https://dnd5e.wikidot.com/lineage:human", "species", "Human", "Player's Handbook"],
    ["feat-alert.html", "https://dnd5e.wikidot.com/feat:alert", "feat", "Alert", "Player's Handbook"],
    ["spell-fireball.html", "https://dnd5e.wikidot.com/spell:fireball", "spell", "Fireball", "Player's Handbook"],
    ["item-bag-of-holding.html", "https://dnd5e.wikidot.com/wondrous-items:bag-of-holding", "item", "Bag of Holding", "Dungeon Master's Guide"],
  ];
  const records = [];
  for (const [file, sourcePageUrl, type, name, publication] of cases) {
    const record = parseDnd5ePage({ html: await read(file), sourcePageUrl, ...metadata });
    assert.equal(record.type, type);
    assert.equal(record.name, name);
    assert.equal(record.publication, publication);
    assert.equal(record.ruleset, "5e");
    assert.equal(record.licenseStatus, "unknown");
    assert.equal(record.automationStatus, "manual");
    assert.equal(record.warnings.length, 0);
    assert.ok(record.content.paragraphs.length);
    records.push(record);
  }
  const background = records.find(({ type }) => type === "background");
  assert.equal(background.content.skillProficiencies, "Insight, Perception");
  assert.equal(background.content.languages, "Any one");
  const spell = records.find(({ type }) => type === "spell");
  assert.equal(spell.content.level, 3);
  assert.equal(spell.content.school.toLowerCase(), "evocation");
  assert.deepEqual(spell.content.spellLists, ["Sorcerer", "Wizard"]);
  assert.equal(records.find(({ type }) => type === "feat").content.prerequisite, "None");
  assert.ok(records.find(({ type }) => type === "class").content.tables[0].rows.length === 2);
});

test("normalized output groups by stated publication with deterministic IDs", async (context) => {
  const output = await mkdtemp(path.join(os.tmpdir(), "wikidot-normalized-"));
  context.after(() => rm(output, { recursive: true, force: true }));
  const record = parseDnd5ePage({ html: await read("background-far-traveler.html"), sourcePageUrl: "https://dnd5e.wikidot.com/background:far-traveler", ...metadata });
  const reviewed = { ...record, licenseStatus: "private-use-only" };
  const first = await writeNormalizedRecord(output, reviewed, { strict: true });
  const second = await writeNormalizedRecord(output, reviewed, { strict: true });
  assert.equal(first.record.id, stableRecordId(record));
  assert.equal(first.record.id, second.record.id);
  assert.match(first.filePath, /normalized\/5e\/sword-coast-adventurer-s-guide\/background/);
  assert.equal(JSON.parse(await readFile(first.filePath, "utf8")).publication, "Sword Coast Adventurer's Guide");
  await assert.rejects(() => writeNormalizedRecord(output, { ...record, publication: "" }, { strict: true }), /Unknown publication/);
  await assert.rejects(() => writeNormalizedRecord(output, record, { strict: true }), /Unknown license status/);
});

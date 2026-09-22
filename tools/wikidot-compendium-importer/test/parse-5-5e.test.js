import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { discover2024Indexes, discover2024Pages, typeFrom2024Url } from "../src/discover.js";
import { parseDnd2024Page } from "../src/parse.js";

const fixtures = path.join(import.meta.dirname, "fixtures", "5.5e");
const read = (name) => readFile(path.join(fixtures, name), "utf8");
const metadata = { retrievedAt: "2026-09-22T00:00:00.000Z", rawSha256: "def456" };

test("2024 discovery classifies official, UA, and homebrew separately", async () => {
  const html = await read("index.html");
  const pages = discover2024Pages(html);
  assert.equal(pages.length, 9);
  assert.deepEqual([...new Set(pages.map(({ type }) => type))].sort(), ["background", "class", "feat", "item", "species", "spell", "subclass"]);
  assert.equal(pages.find(({ url }) => url.includes("ua:spell")).contentClassification, "unearthed-arcana");
  assert.equal(pages.find(({ url }) => url.includes("hb:feat")).contentClassification, "homebrew");
  assert.equal(discover2024Pages(html, undefined, { type: "spell" }).length, 2);
  assert.deepEqual(discover2024Indexes(html), [
    "https://dnd2024.wikidot.com/background:all", "https://dnd2024.wikidot.com/feat:all", "https://dnd2024.wikidot.com/magic-item:all",
    "https://dnd2024.wikidot.com/species:all", "https://dnd2024.wikidot.com/spell:all", "https://dnd2024.wikidot.com/ua:all",
  ]);
  assert.equal(typeFrom2024Url("https://dnd2024.wikidot.com/spell:all"), "");
  assert.equal(typeFrom2024Url("https://dnd2024.wikidot.com/wizard:evoker"), "subclass");
});

test("representative 2024 pages preserve provenance and structured content", async () => {
  const cases = [
    ["class-wizard.html", "wizard:main", "class", "Wizard", "Player's Handbook"],
    ["subclass-evoker.html", "wizard:evoker", "subclass", "Evoker", "Player's Handbook"],
    ["background-acolyte.html", "background:acolyte", "background", "Acolyte", "Player's Handbook"],
    ["species-human.html", "species:human", "species", "Human", "Player's Handbook"],
    ["feat-alert.html", "feat:alert", "feat", "Alert", "Player's Handbook"],
    ["spell-fireball.html", "spell:fireball", "spell", "Fireball", "Player's Handbook"],
    ["item-bag-of-holding.html", "magic-item:bag-of-holding", "item", "Bag of Holding", "Dungeon Master's Guide"],
  ];
  const records = [];
  for (const [file, slug, type, name, publication] of cases) {
    const record = parseDnd2024Page({ html: await read(file), sourcePageUrl: `https://dnd2024.wikidot.com/${slug}`, ...metadata });
    assert.equal(record.type, type);
    assert.equal(record.name, name);
    assert.equal(record.publication, publication);
    assert.equal(record.ruleset, "5.5e");
    assert.equal(record.contentClassification, "official");
    assert.equal(record.parserVersion, "dnd2024-1");
    assert.equal(record.warnings.length, 0);
    assert.ok(record.content.paragraphs.length);
    records.push(record);
  }
  const background = records.find(({ type }) => type === "background");
  assert.equal(background.content.skillProficiencies, "Insight and Religion");
  assert.equal(background.content.toolProficiencies, "Calligrapher's Supplies");
  const spell = records.find(({ type }) => type === "spell");
  assert.equal(spell.content.level, 3);
  assert.equal(spell.content.school, "Evocation");
  assert.deepEqual(spell.content.spellLists, ["Sorcerer", "Wizard"]);
  assert.equal(records.find(({ type }) => type === "feat").content.prerequisite, "Level 4+");
});

test("2024 UA records retain distinct classification and stated source", async () => {
  const record = parseDnd2024Page({ html: await read("ua-spell-ego-whip.html"), sourcePageUrl: "https://dnd2024.wikidot.com/ua:spell-ego-whip", ...metadata });
  assert.equal(record.contentClassification, "unearthed-arcana");
  assert.equal(record.publication, "UA9 - Psion Update (02.10.2025)");
  assert.deepEqual(record.content.tags, ["spell", "ua"]);
  assert.equal(record.content.level, 2);
  assert.deepEqual(record.content.spellLists, ["Psion"]);
});

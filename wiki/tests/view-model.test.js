import assert from "node:assert/strict";
import {
  filterWikiPages,
  findWikiPageByName,
  mentionedWikiPages,
  relatedWikiPages,
  sortWikiPages,
  wikiIconForType,
} from "../js/view-model.js";

const pages = [
  { id: "fiora", name: "Fiora", aliases: ["Lady Fiora"], type: "Character", body: "Knows [[Breugaire]]." },
  { id: "breugaire", name: "Breugaire", type: "City", summary: "Capital", body: "Home of [[Lady Fiora]]." },
  { id: "guild", name: "The Guild", type: "Faction", body: "" },
];

assert.deepEqual(sortWikiPages(pages).map((page) => page.id), ["breugaire", "fiora", "guild"]);
assert.equal(findWikiPageByName(pages, "lady fiora"), pages[0]);
assert.equal(wikiIconForType("Ancient City"), "bi-buildings-fill");
assert.equal(wikiIconForType("Faction"), "bi-shield-fill");
assert.deepEqual(filterWikiPages(pages, { search: "capital", type: "City" }), [pages[1]]);
assert.deepEqual(mentionedWikiPages(pages, pages[0].body), [pages[1]]);
assert.deepEqual(relatedWikiPages(pages, pages[0]), [pages[1]]);

console.log("Wiki view-model tests passed.");

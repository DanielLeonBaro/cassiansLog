import assert from "node:assert/strict";
import {
  createWikiBackup,
  parseWikiBackup,
  wikiBackupFilename,
} from "../js/backup.js";

const now = () => new Date("2026-08-19T12:00:00.000Z");
const pages = [{ id: "fiora", name: "Fiora" }];
assert.deepEqual(createWikiBackup(pages, now), {
  version: 1,
  exportedAt: "2026-08-19T12:00:00.000Z",
  pages,
});
assert.equal(wikiBackupFilename(now), "breugaire-wiki-2026-08-19.json");
assert.deepEqual(parseWikiBackup(JSON.stringify({ pages })), pages);
assert.deepEqual(parseWikiBackup(JSON.stringify(pages)), pages, "Legacy array backups must remain importable.");
assert.throws(() => parseWikiBackup('{"pages":[{}]}'), /does not contain wiki pages/);

console.log("Wiki backup tests passed.");

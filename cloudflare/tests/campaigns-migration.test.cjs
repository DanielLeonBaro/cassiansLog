// Verifies additive campaign schema, AOTR preservation, isolation, and idempotency.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const directory = path.resolve("cloudflare/migrations");
const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
const campaignMigrationName = "0012_campaigns.sql";
const campaignMigrationNames = files.filter((name) => name >= campaignMigrationName);
const campaignMigration = campaignMigrationNames.map((name) => fs.readFileSync(path.join(directory, name), "utf8")).join("\n");

function apply(database, names) {
  names.forEach((name) => database.exec(fs.readFileSync(path.join(directory, name), "utf8")));
}

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
apply(database, files.filter((name) => name < campaignMigrationName));

const now = "2026-09-06T00:00:00.000Z";
const users = [
  ["admin", "dleonbaro@gmail.com", "[]"],
  ["dm", "dm@example.com", '["dm-screen"]'],
  ["player", "player@example.com", '["characters"]'],
];
for (const [id, email, roles] of users) {
  database.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, 'hash', 'salt', 1, ?, ?, ?)")
    .run(id, email, roles, now, now);
}
database.prepare("INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES ('hero', ?, 'custom', 1, ?, ?)")
  .run('{"id":"hero","name":"Hero"}', now, now);
database.prepare("INSERT INTO character_runtime (character_id, state_json, notes_json, updated_at) VALUES ('hero', ?, ?, ?)")
  .run('{"hp":{"current":7}}', '[{"title":"Secret"}]', now);
database.prepare("INSERT INTO wiki_documents (id, pages_json, updated_at) VALUES ('default', ?, ?)")
  .run('[{"id":"home","name":"Home"}]', now);
database.prepare("INSERT INTO music_library (id, library_json, updated_at) VALUES ('default', ?, ?)")
  .run('{"version":1,"tracks":[{"id":"song"}],"settings":{"fadeIn":1,"fadeOut":2}}', now);
database.prepare("INSERT INTO combat_drafts (id, draft_json, updated_at) VALUES ('default', ?, ?)")
  .run('{"version":4,"currentDocument":{"id":"fight"}}', now);
database.prepare("INSERT INTO user_screens (user_id, screen_kind, document_json, updated_at) VALUES ('player', 'player', ?, ?)")
  .run('{"version":1,"widgets":[]}', now);
database.prepare("INSERT INTO compendium_entries (id, category, name, publication, type, index_json, detail_json, updated_at) VALUES ('spell:test', 'spells', 'Test Spell', 'Test', 'Spell', ?, ?, ?)")
  .run('{"id":"spell:test"}', '{"name":"Test Spell"}', now);

apply(database, campaignMigrationNames);

assert.deepEqual(
  { ...database.prepare("SELECT name, join_enabled AS joinEnabled FROM campaigns WHERE id = 'campaign-breugaire'").get() },
  { name: "Apotheosis of the Rings", joinEnabled: 0 },
);
assert.deepEqual(
  database.prepare("SELECT slug, is_current AS isCurrent FROM campaign_slugs WHERE campaign_id = 'campaign-breugaire' ORDER BY slug").all().map((row) => ({ ...row })),
  [{ slug: "aotr", isCurrent: 1 }, { slug: "breugaire", isCurrent: 0 }],
);
assert.deepEqual(
  database.prepare("SELECT user_id AS userId, role FROM campaign_memberships ORDER BY user_id").all().map((row) => ({ ...row })),
  [
    { userId: "admin", role: "dm" },
    { userId: "dm", role: "dm" },
    { userId: "player", role: "player" },
  ],
);
assert.equal(database.prepare("SELECT document_json FROM campaign_characters WHERE campaign_id = 'campaign-breugaire' AND id = 'hero'").get().document_json, '{"id":"hero","name":"Hero"}');
assert.equal(database.prepare("SELECT notes_json FROM campaign_character_runtime WHERE campaign_id = 'campaign-breugaire' AND character_id = 'hero'").get().notes_json, '[{"title":"Secret"}]');
assert.equal(database.prepare("SELECT pages_json FROM campaign_wiki_documents WHERE campaign_id = 'campaign-breugaire'").get().pages_json, '[{"id":"home","name":"Home"}]');
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_user_screens").get().count, 1);
assert.deepEqual(
  { ...database.prepare("SELECT id, index_json, detail_json FROM compendium_entries WHERE id = 'spell:test'").get() },
  { id: "spell:test", index_json: '{"id":"spell:test"}', detail_json: '{"name":"Test Spell"}' },
  "Compendium remains global and untouched.",
);

database.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('campaign-two', 'Other', ?, ?)").run(now, now);
database.prepare("INSERT INTO campaign_slugs (slug, campaign_id, created_at) VALUES ('other', 'campaign-two', ?)").run(now);
database.prepare("INSERT INTO campaign_characters (campaign_id, id, document_json, created_at, updated_at) VALUES ('campaign-two', 'hero', ?, ?, ?)")
  .run('{"id":"hero","name":"Other Hero"}', now, now);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_characters WHERE id = 'hero'").get().count, 2, "Character IDs are isolated by campaign.");

apply(database, campaignMigrationNames);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaigns").get().count, 2, "Migration is idempotent.");
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_characters WHERE campaign_id = 'campaign-breugaire'").get().count, 1);
assert.doesNotMatch(campaignMigration, /\b(?:DROP|ALTER)\b/i, "Campaign migration is additive.");

console.log("Campaign migration preservation, isolation, and idempotency tests passed.");

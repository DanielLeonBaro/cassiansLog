CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_settings (id, settings_json, updated_at)
VALUES (
  'default',
  '{"sections":{"characters":true,"combat-loot":true,"compendium":true,"wiki":false,"character-overview":true,"character-stats":true,"hit-points":true,"combat":true,"spellcasting":true,"prepared-spells":true,"all-possibilities":true,"inventory":true,"notes":true},"openWrites":true}',
  '1970-01-01T00:00:00.000Z'
)
ON CONFLICT(id) DO NOTHING;

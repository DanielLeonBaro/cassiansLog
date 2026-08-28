CREATE TABLE IF NOT EXISTS user_screens (
  user_id TEXT NOT NULL,
  screen_kind TEXT NOT NULL CHECK (screen_kind IN ('player', 'dm')),
  document_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, screen_kind),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS screen_calculator_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  screen_kind TEXT NOT NULL CHECK (screen_kind IN ('player', 'dm')),
  widget_id TEXT NOT NULL,
  expression TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_screen_calculator_history
  ON screen_calculator_history(user_id, screen_kind, widget_id, id DESC);

UPDATE app_settings
SET settings_json = json_set(settings_json, '$.sections.player-screen', json('true'))
WHERE id = 'default' AND json_type(settings_json, '$.sections.player-screen') IS NULL;

UPDATE app_settings
SET settings_json = json_set(settings_json, '$.sections.dm-screen', json('true'))
WHERE id = 'default' AND json_type(settings_json, '$.sections.dm-screen') IS NULL;

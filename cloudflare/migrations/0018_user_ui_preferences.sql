-- Additive UI preferences; legacy theme, sheet layout, and character records remain intact.
CREATE TABLE IF NOT EXISTS user_ui_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Adds the singleton D1 Music library document.
CREATE TABLE IF NOT EXISTS music_library (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  library_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

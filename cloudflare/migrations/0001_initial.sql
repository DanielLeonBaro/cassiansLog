CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compendium_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  publication TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  index_json TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_compendium_category_name
  ON compendium_entries(category, name);
CREATE INDEX IF NOT EXISTS idx_compendium_publication
  ON compendium_entries(publication);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  document_json TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'custom',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_runtime (
  character_id TEXT PRIMARY KEY,
  state_json TEXT,
  notes_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS combat_presets (
  id TEXT PRIMARY KEY,
  base_name TEXT NOT NULL,
  label TEXT NOT NULL,
  document_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS combat_drafts (
  id TEXT PRIMARY KEY,
  draft_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wiki_documents (
  id TEXT PRIMARY KEY,
  pages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

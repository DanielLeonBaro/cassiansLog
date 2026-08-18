CREATE TABLE IF NOT EXISTS wiki_documents (
  id TEXT PRIMARY KEY,
  pages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

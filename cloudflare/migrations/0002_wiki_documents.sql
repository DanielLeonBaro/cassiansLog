-- Adds the D1 document used for shared Wiki persistence.
CREATE TABLE IF NOT EXISTS wiki_documents (
  id TEXT PRIMARY KEY,
  pages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

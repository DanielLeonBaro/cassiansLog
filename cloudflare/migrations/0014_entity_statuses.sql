CREATE TABLE IF NOT EXISTS campaign_statuses (
  campaign_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Active',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO campaign_statuses (campaign_id, status, updated_at)
SELECT id, 'Active', COALESCE(updated_at, created_at) FROM campaigns;

UPDATE characters
SET document_json = json_set(document_json, '$.status', 'Active')
WHERE json_valid(document_json) AND json_type(document_json, '$.status') IS NULL;

UPDATE campaign_characters
SET document_json = json_set(document_json, '$.status', 'Active')
WHERE json_valid(document_json) AND json_type(document_json, '$.status') IS NULL;

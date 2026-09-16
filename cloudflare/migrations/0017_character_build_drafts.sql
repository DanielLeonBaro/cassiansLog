-- Adds recoverable per-user Character Builder drafts without modifying final Character tables.
CREATE TABLE IF NOT EXISTS character_build_drafts (
  user_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  document_json TEXT NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'home',
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'complete')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, draft_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_character_build_drafts_updated
  ON character_build_drafts(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS campaign_character_build_drafts (
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  document_json TEXT NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'home',
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'complete')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, user_id, draft_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_campaign_character_build_drafts_updated
  ON campaign_character_build_drafts(campaign_id, user_id, updated_at DESC);

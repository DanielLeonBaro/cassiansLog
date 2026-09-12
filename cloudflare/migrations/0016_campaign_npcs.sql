-- Adds campaign-scoped NPC trackers without modifying Character data.
CREATE TABLE IF NOT EXISTS campaign_npcs (
  campaign_id TEXT NOT NULL,
  id TEXT NOT NULL,
  document_json TEXT NOT NULL,
  visibility_json TEXT NOT NULL DEFAULT '{}',
  player_visible INTEGER NOT NULL DEFAULT 0 CHECK (player_visible IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaign_npcs_player_list
  ON campaign_npcs(campaign_id, active, player_visible, id);

CREATE TABLE IF NOT EXISTS campaign_npc_runtime (
  campaign_id TEXT NOT NULL,
  npc_id TEXT NOT NULL,
  state_json TEXT,
  notes_json TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, npc_id),
  FOREIGN KEY (campaign_id, npc_id) REFERENCES campaign_npcs(campaign_id, id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_user_npc_layouts (
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  npc_id TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, user_id, npc_id),
  FOREIGN KEY (campaign_id, npc_id) REFERENCES campaign_npcs(campaign_id, id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

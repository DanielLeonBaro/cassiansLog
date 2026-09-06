-- Adds isolated campaign storage while preserving every legacy table for rollback.
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  banner TEXT NOT NULL DEFAULT '',
  join_password_hash TEXT,
  join_password_salt TEXT,
  join_password_iterations INTEGER,
  join_enabled INTEGER NOT NULL DEFAULT 0 CHECK (join_enabled IN (0, 1)),
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS campaign_slugs (
  slug TEXT PRIMARY KEY CHECK (length(slug) BETWEEN 2 AND 48 AND slug NOT GLOB '*[^a-z]*'),
  campaign_id TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_current_slug
  ON campaign_slugs(campaign_id) WHERE is_current = 1;

CREATE TABLE IF NOT EXISTS campaign_memberships (
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('player', 'dm')),
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, user_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_campaign_memberships_user
  ON campaign_memberships(user_id, campaign_id);

CREATE TABLE IF NOT EXISTS campaign_join_attempts (
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  PRIMARY KEY (campaign_id, user_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_settings (
  campaign_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_characters (
  campaign_id TEXT NOT NULL,
  id TEXT NOT NULL,
  document_json TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'custom',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_character_editors (
  campaign_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, character_id, user_id),
  FOREIGN KEY (campaign_id, character_id) REFERENCES campaign_characters(campaign_id, id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (campaign_id, user_id) REFERENCES campaign_memberships(campaign_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_campaign_character_editors_user
  ON campaign_character_editors(campaign_id, user_id, character_id);

CREATE TABLE IF NOT EXISTS campaign_character_runtime (
  campaign_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  state_json TEXT,
  notes_json TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, character_id),
  FOREIGN KEY (campaign_id, character_id) REFERENCES campaign_characters(campaign_id, id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_combat_presets (
  campaign_id TEXT NOT NULL,
  id TEXT NOT NULL,
  base_name TEXT NOT NULL,
  label TEXT NOT NULL,
  document_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_combat_documents (
  campaign_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('draft', 'party-library')),
  document_json TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, kind),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_wiki_documents (
  campaign_id TEXT PRIMARY KEY,
  pages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_music_libraries (
  campaign_id TEXT PRIMARY KEY,
  library_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_user_screens (
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  screen_kind TEXT NOT NULL CHECK (screen_kind IN ('player', 'dm')),
  document_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, user_id, screen_kind),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_screen_calculator_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  screen_kind TEXT NOT NULL CHECK (screen_kind IN ('player', 'dm')),
  widget_id TEXT NOT NULL,
  expression TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_campaign_screen_history
  ON campaign_screen_calculator_history(campaign_id, user_id, screen_kind, widget_id, id DESC);

-- Expand existing global content into the compatibility campaign. Re-running never overwrites campaign edits.
INSERT OR IGNORE INTO campaigns (
  id, name, join_enabled, created_by_user_id, created_at, updated_at
)
VALUES (
  'campaign-breugaire',
  'Breugaire',
  0,
  (SELECT id FROM users WHERE email = 'dleonbaro@gmail.com' COLLATE NOCASE LIMIT 1),
  '1970-01-01T00:00:00.000Z',
  '1970-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO campaign_slugs (slug, campaign_id, is_current, created_at)
VALUES ('breugaire', 'campaign-breugaire', 1, '1970-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO campaign_memberships (campaign_id, user_id, role, joined_at, updated_at)
SELECT
  'campaign-breugaire',
  users.id,
  CASE
    WHEN users.email = 'dleonbaro@gmail.com' COLLATE NOCASE
      OR EXISTS (SELECT 1 FROM json_each(users.roles_json) WHERE value = 'dm-screen')
    THEN 'dm'
    ELSE 'player'
  END,
  '1970-01-01T00:00:00.000Z',
  '1970-01-01T00:00:00.000Z'
FROM users;

INSERT OR IGNORE INTO campaign_settings (campaign_id, settings_json, updated_at)
SELECT 'campaign-breugaire', settings_json, updated_at FROM app_settings WHERE id = 'default';
INSERT OR IGNORE INTO campaign_settings (campaign_id, settings_json, updated_at)
VALUES (
  'campaign-breugaire',
  '{"sections":{"characters":true,"player-screen":true,"dm-screen":true,"combat-loot":true,"public-initiative":true,"music":true,"compendium":true,"wiki":true,"character-overview":true,"character-stats":true,"hit-points":true,"combat":true,"spellcasting":true,"prepared-spells":true,"all-possibilities":true,"inventory":true,"notes":true},"characterSheetStyle":"v1","characterSheetStyleOverrides":{}}',
  '1970-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO campaign_characters (campaign_id, id, document_json, source, active, created_at, updated_at)
SELECT 'campaign-breugaire', id, document_json, source, active, created_at, updated_at FROM characters;

INSERT OR IGNORE INTO campaign_character_runtime (campaign_id, character_id, state_json, notes_json, updated_at)
SELECT 'campaign-breugaire', runtime.character_id, runtime.state_json, runtime.notes_json, runtime.updated_at
FROM character_runtime AS runtime
JOIN characters ON characters.id = runtime.character_id;

INSERT OR IGNORE INTO campaign_combat_presets (campaign_id, id, base_name, label, document_json, active, created_at, updated_at)
SELECT 'campaign-breugaire', id, base_name, label, document_json, active, created_at, updated_at FROM combat_presets;

INSERT OR IGNORE INTO campaign_combat_documents (campaign_id, kind, document_json, updated_at)
SELECT 'campaign-breugaire',
  CASE id WHEN 'party-library' THEN 'party-library' ELSE 'draft' END,
  draft_json,
  updated_at
FROM combat_drafts
WHERE id IN ('default', 'party-library');

INSERT OR IGNORE INTO campaign_combat_documents (campaign_id, kind, document_json, updated_at)
VALUES
  ('campaign-breugaire', 'draft', NULL, '1970-01-01T00:00:00.000Z'),
  ('campaign-breugaire', 'party-library', '{"version":1,"parties":[]}', '1970-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO campaign_wiki_documents (campaign_id, pages_json, updated_at)
SELECT 'campaign-breugaire', pages_json, updated_at FROM wiki_documents WHERE id = 'default';
INSERT OR IGNORE INTO campaign_wiki_documents (campaign_id, pages_json, updated_at)
VALUES ('campaign-breugaire', '[]', '1970-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO campaign_music_libraries (campaign_id, library_json, updated_at)
SELECT 'campaign-breugaire', library_json, updated_at FROM music_library WHERE id = 'default';
INSERT OR IGNORE INTO campaign_music_libraries (campaign_id, library_json, updated_at)
VALUES ('campaign-breugaire', '{"version":1,"tracks":[],"settings":{"fadeIn":3,"fadeOut":2}}', '1970-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO campaign_user_screens (campaign_id, user_id, screen_kind, document_json, updated_at)
SELECT 'campaign-breugaire', user_id, screen_kind, document_json, updated_at FROM user_screens;

INSERT OR IGNORE INTO campaign_screen_calculator_history (
  id, campaign_id, user_id, screen_kind, widget_id, expression, result, created_at
)
SELECT id, 'campaign-breugaire', user_id, screen_kind, widget_id, expression, result, created_at
FROM screen_calculator_history;

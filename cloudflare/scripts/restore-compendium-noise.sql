-- Restores rows and manifest saved by remove-compendium-noise.sql.
INSERT OR REPLACE INTO compendium_entries (id, category, name, publication, type, index_json, detail_json, updated_at) SELECT id, category, name, publication, type, index_json, detail_json, updated_at FROM compendium_entries_cleanup_backup_20260831;
INSERT OR REPLACE INTO app_meta (key, value_json, updated_at) SELECT key, value_json, updated_at FROM app_meta_cleanup_backup_20260831 WHERE key = 'compendium-manifest';
SELECT COUNT(*) AS restored_compendium_entries FROM compendium_entries;

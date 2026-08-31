-- Enables Wiki navigation in existing runtime settings.
UPDATE app_settings
SET
  settings_json = json_set(
    settings_json,
    '$.sections.wiki',
    json('true')
  ),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'default';

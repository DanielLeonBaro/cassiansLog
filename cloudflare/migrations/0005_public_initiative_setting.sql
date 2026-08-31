-- Enables Public Initiative in existing runtime settings.
UPDATE app_settings
SET
  settings_json = json_set(
    settings_json,
    '$.sections.public-initiative',
    json('true')
  ),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'default'
  AND json_type(settings_json, '$.sections.public-initiative') IS NULL;

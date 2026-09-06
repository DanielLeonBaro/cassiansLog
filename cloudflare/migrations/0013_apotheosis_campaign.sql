-- Gives the compatibility campaign its permanent public identity and keeps the old slug as an alias.
UPDATE campaigns
SET name = 'Apotheosis of the Rings'
WHERE id = 'campaign-breugaire' AND name = 'Breugaire';

UPDATE campaign_slugs
SET is_current = 0
WHERE campaign_id = 'campaign-breugaire' AND slug = 'breugaire';

INSERT OR IGNORE INTO campaign_slugs (slug, campaign_id, is_current, created_at)
VALUES ('aotr', 'campaign-breugaire', 1, '1970-01-01T00:00:00.000Z');

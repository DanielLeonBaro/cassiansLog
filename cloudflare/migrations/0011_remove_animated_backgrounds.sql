-- Retires animated backgrounds without discarding the rest of each user's appearance preference.
UPDATE user_theme_preferences
SET background_id = 'default-squared'
WHERE background_id IN (
  'angled-pattern',
  'diagonals',
  'fireflies',
  'floating-waves',
  'parallax-stars',
  'rainbow-background',
  'shooting-stars',
  'squared-moving-pattern',
  'squared-octagons'
);

-- Expands existing per-user theme preferences with a bundled background choice.
-- Existing rows retain their theme and receive the current visual as the default.
ALTER TABLE user_theme_preferences
  ADD COLUMN background_id TEXT NOT NULL DEFAULT 'default-squared';

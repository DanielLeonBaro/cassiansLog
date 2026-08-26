CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  background_name TEXT NOT NULL,
  background_hex TEXT NOT NULL,
  accent_name TEXT NOT NULL,
  accent_hex TEXT NOT NULL,
  protected INTEGER NOT NULL DEFAULT 0 CHECK (protected IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_theme_preferences (
  user_id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,
  reversed INTEGER NOT NULL DEFAULT 0 CHECK (reversed IN (0, 1)),
  font_mode TEXT NOT NULL DEFAULT 'auto' CHECK (font_mode IN ('auto', 'black', 'white')),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_theme_preferences_theme ON user_theme_preferences(theme_id);

INSERT INTO themes (id, name, background_name, background_hex, accent_name, accent_hex, protected, created_at, updated_at) VALUES
  ('cassians-classic', 'Cassian’s Classic', 'Charcoal Gray', '#18181B', 'Brick Red', '#B83B35', 1, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('evil-cassian', 'Evil Cassian', 'Pearl Gray', '#F4F4F5', 'Brick Red', '#B83B35', 1, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('black-and-white', 'Black and White', 'Charcoal Gray', '#18181B', 'Pearl Gray', '#F4F4F5', 1, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('aloe', 'Aloe', 'Forest Green', '#184D3B', 'Hot Pink', '#D93680', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('autumn-orange', 'Autumn Orange', 'Autumn Orange', '#B65F2A', 'Pearl Gray', '#F4F4F5', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('beach-day', 'Beach Day', 'Ocean Blue', '#2D6FA3', 'Vanilla Cream', '#FFF1D2', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('bubblegum', 'Bubblegum', 'Bubblegum Pink', '#E98AAF', 'Light Blue', '#B6D9EE', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('denim', 'Denim', 'Denim Blue', '#416E93', 'Vanilla Cream', '#FFF1D2', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('dusk', 'Dusk', 'Jade Green', '#2D8B78', 'Light Blue', '#B6D9EE', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('indigo-and-salmon', 'Indigo and Salmon', 'Indigo', '#3F4C9A', 'Soft Salmon', '#E98272', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('lagoon', 'Lagoon', 'Lagoon Teal', '#76B7B2', 'Vanilla Cream', '#FFF1D2', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('lilacs', 'Lilacs', 'Lilac', '#C8B6E2', 'Ivory Cream', '#FFF6E5', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('linen', 'Linen', 'Graphite Gray', '#3F3F46', 'Linen Gray', '#E7E5E4', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('midnight', 'Midnight', 'Midnight Purple', '#32213F', 'Light Purple', '#CDB7E9', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('mint-chocolate', 'Mint Chocolate', 'Dark Chocolate', '#5A3825', 'Mint Green', '#A7D8B8', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('monaco', 'Monaco', 'Monaco Green', '#2F7D67', 'Lilac', '#C8B6E2', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('nautical', 'Nautical', 'Navy Blue', '#163A5F', 'Deep Teal', '#147D82', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('orange-and-salmon', 'Orange and Salmon', 'Autumn Orange', '#B65F2A', 'Soft Salmon', '#E98272', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('pacific', 'Pacific', 'Light Blue', '#B6D9EE', 'Pearl Gray', '#F4F4F5', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('peach-and-lime', 'Peach & Lime', 'Cherry Blossom Pink', '#F4B8C4', 'Dark Mustard', '#9A7600', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('peachy', 'Peachy', 'Peach', '#F4B183', 'Butter Yellow', '#F6E6A8', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('plum', 'Plum', 'Powder Blue', '#A9CEE3', 'Plum Purple', '#4A2C6F', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('saffron', 'Saffron', 'Saffron Yellow', '#F2C94C', 'Charcoal Gray', '#18181B', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('salmon', 'Salmon', 'Soft Salmon', '#E98272', 'Pearl Gray', '#F4F4F5', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('sylen', 'Sylen', 'Pearl Gray', '#F4F4F5', 'Light Blue', '#B6D9EE', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('under-the-sea', 'Under the Sea', 'Deep Teal', '#147D82', 'Powder Blue', '#A9CEE3', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('watermelon', 'Watermelon', 'Cherry Blossom Pink', '#F4B8C4', 'Leaf Green', '#3E7C3A', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z'),
  ('zuriel', 'Zuriel', 'Pearl Gray', '#F4F4F5', 'Antique Gold', '#C69224', 0, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z')
ON CONFLICT DO NOTHING;

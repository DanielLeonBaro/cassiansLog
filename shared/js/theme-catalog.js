// Normalizes theme colors, computes contrast, and derives accessible palette values.
export const BASE_THEME_ID = "cassians-classic";
export const FEATURED_THEME_IDS = Object.freeze([
  BASE_THEME_ID,
  "evil-cassian",
  "black-and-white",
]);
export const THEME_FONT_MODES = Object.freeze(["auto", "black", "white"]);

const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function theme(id, name, backgroundName, backgroundHex, accentName, accentHex, protectedTheme = false) {
  return Object.freeze({
    id,
    name,
    backgroundName,
    backgroundHex,
    accentName,
    accentHex,
    protected: protectedTheme,
    updatedAt: DEFAULT_TIMESTAMP,
  });
}

export const BUILT_IN_THEMES = Object.freeze([
  theme("cassians-classic", "Cassian’s Classic", "Charcoal Gray", "#18181B", "Brick Red", "#B83B35", true),
  theme("evil-cassian", "Evil Cassian", "Pearl Gray", "#F4F4F5", "Brick Red", "#B83B35", true),
  theme("black-and-white", "Black and White", "Charcoal Gray", "#18181B", "Pearl Gray", "#F4F4F5", true),
  theme("aloe", "Aloe", "Forest Green", "#184D3B", "Hot Pink", "#D93680"),
  theme("autumn-orange", "Autumn Orange", "Autumn Orange", "#B65F2A", "Pearl Gray", "#F4F4F5"),
  theme("beach-day", "Beach Day", "Ocean Blue", "#2D6FA3", "Vanilla Cream", "#FFF1D2"),
  theme("bubblegum", "Bubblegum", "Bubblegum Pink", "#E98AAF", "Light Blue", "#B6D9EE"),
  theme("denim", "Denim", "Denim Blue", "#416E93", "Vanilla Cream", "#FFF1D2"),
  theme("dusk", "Dusk", "Jade Green", "#2D8B78", "Light Blue", "#B6D9EE"),
  theme("indigo-and-salmon", "Indigo and Salmon", "Indigo", "#3F4C9A", "Soft Salmon", "#E98272"),
  theme("lagoon", "Lagoon", "Lagoon Teal", "#76B7B2", "Vanilla Cream", "#FFF1D2"),
  theme("lilacs", "Lilacs", "Lilac", "#C8B6E2", "Ivory Cream", "#FFF6E5"),
  theme("linen", "Linen", "Graphite Gray", "#3F3F46", "Linen Gray", "#E7E5E4"),
  theme("midnight", "Midnight", "Midnight Purple", "#32213F", "Light Purple", "#CDB7E9"),
  theme("mint-chocolate", "Mint Chocolate", "Dark Chocolate", "#5A3825", "Mint Green", "#A7D8B8"),
  theme("monaco", "Monaco", "Monaco Green", "#2F7D67", "Lilac", "#C8B6E2"),
  theme("nautical", "Nautical", "Navy Blue", "#163A5F", "Deep Teal", "#147D82"),
  theme("orange-and-salmon", "Orange and Salmon", "Autumn Orange", "#B65F2A", "Soft Salmon", "#E98272"),
  theme("pacific", "Pacific", "Light Blue", "#B6D9EE", "Pearl Gray", "#F4F4F5"),
  theme("peach-and-lime", "Peach & Lime", "Cherry Blossom Pink", "#F4B8C4", "Dark Mustard", "#9A7600"),
  theme("peachy", "Peachy", "Peach", "#F4B183", "Butter Yellow", "#F6E6A8"),
  theme("plum", "Plum", "Powder Blue", "#A9CEE3", "Plum Purple", "#4A2C6F"),
  theme("saffron", "Saffron", "Saffron Yellow", "#F2C94C", "Charcoal Gray", "#18181B"),
  theme("salmon", "Salmon", "Soft Salmon", "#E98272", "Pearl Gray", "#F4F4F5"),
  theme("sylen", "Sylen", "Pearl Gray", "#F4F4F5", "Light Blue", "#B6D9EE"),
  theme("under-the-sea", "Under the Sea", "Deep Teal", "#147D82", "Powder Blue", "#A9CEE3"),
  theme("watermelon", "Watermelon", "Cherry Blossom Pink", "#F4B8C4", "Leaf Green", "#3E7C3A"),
  theme("zuriel", "Zuriel", "Pearl Gray", "#F4F4F5", "Antique Gold", "#C69224"),
]);

const HEX_PATTERN = /^#[0-9A-F]{6}$/;

export function normalizeHex(value) {
  const hex = String(value || "").trim().toUpperCase();
  return HEX_PATTERN.test(hex) ? hex : null;
}

export function normalizeThemeInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = String(value.name || "").trim();
  const backgroundName = String(value.backgroundName || "").trim();
  const accentName = String(value.accentName || "").trim();
  const backgroundHex = normalizeHex(value.backgroundHex);
  const accentHex = normalizeHex(value.accentHex);
  if (!name || name.length > 60 || !backgroundName || backgroundName.length > 40
    || !accentName || accentName.length > 40 || !backgroundHex || !accentHex) return null;
  return { name, backgroundName, backgroundHex, accentName, accentHex };
}

export function normalizeThemePreference(value, fallbackThemeId = BASE_THEME_ID) {
  const legacyTheme = value?.themeId === "dark"
    ? BASE_THEME_ID
    : value?.themeId === "light"
      ? "evil-cassian"
      : value?.themeId;
  return {
    themeId: typeof legacyTheme === "string" && legacyTheme ? legacyTheme : fallbackThemeId,
    reversed: value?.reversed === true,
    fontMode: THEME_FONT_MODES.includes(value?.fontMode) ? value.fontMode : "auto",
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
  };
}

export function sortThemes(themes = []) {
  const featured = new Map(FEATURED_THEME_IDS.map((id, index) => [id, index]));
  return [...themes].sort((left, right) => {
    const leftRank = featured.has(left.id) ? featured.get(left.id) : FEATURED_THEME_IDS.length;
    const rightRank = featured.has(right.id) ? featured.get(right.id) : FEATURED_THEME_IDS.length;
    return leftRank - rightRank || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

export function themeById(themes, id) {
  return themes.find((candidate) => candidate.id === id)
    || themes.find((candidate) => candidate.id === BASE_THEME_ID)
    || BUILT_IN_THEMES[0];
}

export function hexToRGB(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return [1, 3, 5].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
}

function relativeLuminance(hex) {
  return hexToRGB(hex).map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastRatio(left, right) {
  const values = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function readableForeground(background) {
  const black = "#09090B";
  const white = "#FFFFFF";
  return contrastRatio(background, black) >= contrastRatio(background, white) ? black : white;
}

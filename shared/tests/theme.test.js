import assert from "node:assert/strict";
import {
  BASE_THEME_ID,
  BUILT_IN_THEMES,
  contrastRatio,
  normalizeHex,
  normalizeThemeInput,
  normalizeThemePreference,
  readableForeground,
  sortThemes,
} from "../js/theme-catalog.js";
import { resolveThemeAppearance } from "../js/theme.js";

assert.equal(BUILT_IN_THEMES.length, 28);
assert.deepEqual(BUILT_IN_THEMES.slice(0, 3).map((theme) => theme.name), [
  "Cassian’s Classic",
  "Evil Cassian",
  "Black and White",
]);
assert.ok(BUILT_IN_THEMES.slice(0, 3).every((theme) => theme.protected));
assert.ok(BUILT_IN_THEMES.slice(3).every((theme) => !theme.protected));
assert.deepEqual(
  BUILT_IN_THEMES.slice(3).map((theme) => theme.name),
  [...BUILT_IN_THEMES.slice(3).map((theme) => theme.name)].sort((left, right) => left.localeCompare(right)),
);
assert.equal(sortThemes([...BUILT_IN_THEMES].reverse())[0].id, BASE_THEME_ID);

assert.equal(normalizeHex(" #b83b35 "), "#B83B35");
assert.equal(normalizeHex("#12345"), null);
assert.equal(normalizeThemeInput({
  name: "  Example  ",
  backgroundName: "  Blue  ",
  backgroundHex: "#112233",
  accentName: "  Cream  ",
  accentHex: "#ffeecc",
}).accentHex, "#FFEECC");
assert.equal(normalizeThemeInput({ name: "Bad", backgroundName: "Blue", backgroundHex: "red", accentName: "Cream", accentHex: "#FFEECC" }), null);
assert.deepEqual(normalizeThemePreference({ themeId: "dark" }), {
  themeId: BASE_THEME_ID,
  reversed: false,
  fontMode: "auto",
  updatedAt: null,
});
assert.equal(normalizeThemePreference({ themeId: "light" }).themeId, "evil-cassian");

for (const theme of BUILT_IN_THEMES) {
  for (const reversed of [false, true]) {
    const appearance = resolveThemeAppearance(theme.id, { reversed, fontMode: "auto", themes: BUILT_IN_THEMES });
    assert.ok(appearance.contrast >= 4.5, `${theme.name} ${reversed ? "reversed" : "standard"} text contrast is ${appearance.contrast}`);
    assert.ok(contrastRatio(appearance.onAccentHex, appearance.accentHex) >= 4.5, `${theme.name} accent text must meet AA.`);
    assert.equal(appearance.textHex, readableForeground(appearance.backgroundHex));
    assert.equal(appearance.backgroundHex, reversed ? theme.accentHex : theme.backgroundHex);
    assert.equal(appearance.accentHex, reversed ? theme.backgroundHex : theme.accentHex);
  }
}

console.log("Theme catalog, ordering, normalization, reversal, and contrast tests passed.");

// Verifies theme catalog, normalization, and contrast.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  BACKGROUNDS,
  BACKGROUND_GROUPS,
  BACKGROUND_IDS,
  DEFAULT_BACKGROUND_ID,
  REMOVED_BACKGROUND_IDS,
  normalizeBackgroundId,
} from "../js/background-catalog.js";
import {
  BASE_THEME_ID,
  BUILT_IN_THEMES,
  contrastRatio,
  hexToRGB,
  normalizeHex,
  normalizeThemeInput,
  normalizeThemePreference,
  readableForeground,
  sortThemes,
} from "../js/theme-catalog.js";
import { resolveThemeAppearance } from "../js/theme.js";

const bootstrapSource = fs.readFileSync("shared/js/theme-bootstrap.js", "utf8");
const themeStyles = fs.readFileSync("shared/styles/tailwind.css", "utf8");

function runThemeBootstrap(items = {}) {
  const properties = {};
  const root = {
    dataset: {},
    style: {
      setProperty(name, value) {
        properties[name] = value;
      },
    },
  };
  vm.runInNewContext(bootstrapSource, {
    document: { documentElement: root },
    localStorage: {
      getItem(key) {
        return Object.hasOwn(items, key) ? items[key] : null;
      },
    },
  });
  return { root, properties };
}

function rgbValue(hex) {
  return hexToRGB(hex).join(" ");
}

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
assert.equal(BACKGROUNDS.length, 42);
assert.deepEqual(BACKGROUND_GROUPS.map(({ name }) => name), ["Static backgrounds"]);
for (const group of BACKGROUND_GROUPS) {
  assert.equal(group.backgrounds[0].id, DEFAULT_BACKGROUND_ID, "Default Squared must remain first.");
  assert.deepEqual(
    group.backgrounds.slice(1).map(({ name }) => name),
    [...group.backgrounds.slice(1).map(({ name }) => name)].sort((left, right) => left.localeCompare(right)),
    `${group.name} after Default Squared must remain alphabetical.`,
  );
}
assert.equal(REMOVED_BACKGROUND_IDS.length, 9);
assert.ok(REMOVED_BACKGROUND_IDS.every((id) => !BACKGROUND_IDS.includes(id)));
assert.equal(normalizeBackgroundId("fireflies"), DEFAULT_BACKGROUND_ID);
assert.equal(normalizeBackgroundId("missing"), DEFAULT_BACKGROUND_ID);
for (const background of BACKGROUNDS) {
  const bootstrapped = runThemeBootstrap({ "dnd-theme-background": background.id });
  assert.equal(bootstrapped.root.dataset.background, background.id, `${background.name} must load before paint.`);
  assert.ok(themeStyles.includes(`data-background="${background.id}"`), `${background.name} must have page styling.`);
  assert.ok(themeStyles.includes(`data-background-preview="${background.id}"`), `${background.name} must have preview styling.`);
}
for (const removedId of REMOVED_BACKGROUND_IDS) {
  const bootstrapped = runThemeBootstrap({ "dnd-theme-background": removedId });
  assert.equal(bootstrapped.root.dataset.background, DEFAULT_BACKGROUND_ID);
  assert.ok(!themeStyles.includes(`data-background="${removedId}"`));
}
assert.match(themeStyles, /inset 0 0 clamp\(2\.5rem, 12vw, 12rem\) rgb\(0 0 0 \/ 0\.18\)/);
assert.match(themeStyles, /inset 0 0 0 100vmax rgb\(var\(--theme-background\) \/ 0\.18\)/);

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
  backgroundId: DEFAULT_BACKGROUND_ID,
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

    const bootstrapped = runThemeBootstrap({
      "dnd-theme": theme.id,
      "dnd-theme-reversed": String(reversed),
      "dnd-theme-font": "auto",
      "dnd-theme-background": "graph-paper",
    });
    assert.equal(bootstrapped.root.dataset.themePalette, theme.id);
    assert.equal(bootstrapped.root.dataset.themeReversed, String(reversed));
    assert.equal(bootstrapped.root.dataset.background, "graph-paper");
    assert.equal(bootstrapped.root.dataset.theme, appearance.textHex === "#FFFFFF" ? "dark" : "light");
    assert.equal(bootstrapped.properties["--theme-background"], rgbValue(appearance.backgroundHex));
    assert.equal(bootstrapped.properties["--theme-surface"], rgbValue(appearance.surfaceHex));
    assert.equal(bootstrapped.properties["--theme-surface-strong"], rgbValue(appearance.surfaceStrongHex));
    assert.equal(bootstrapped.properties["--theme-border"], rgbValue(appearance.borderHex));
    assert.equal(bootstrapped.properties["--theme-text"], rgbValue(appearance.textHex));
    assert.equal(bootstrapped.properties["--theme-muted"], rgbValue(appearance.mutedHex));
    assert.equal(bootstrapped.properties["--theme-accent"], rgbValue(appearance.accentHex));
    assert.equal(bootstrapped.properties["--theme-accent-hover"], rgbValue(appearance.accentHoverHex));
    assert.equal(bootstrapped.properties["--theme-on-accent"], rgbValue(appearance.onAccentHex));
  }
}

const customTheme = {
  id: "custom-test",
  name: "Custom Test",
  backgroundName: "Blue",
  backgroundHex: "#112233",
  accentName: "Cream",
  accentHex: "#FFEECC",
};
const customBootstrap = runThemeBootstrap({
  "dnd-theme": customTheme.id,
  "dnd-theme-font": "black",
  "dnd-theme-catalog": JSON.stringify([customTheme]),
});
assert.equal(customBootstrap.root.dataset.themePalette, customTheme.id);
assert.equal(customBootstrap.properties["--theme-background"], "17 34 51");
assert.equal(customBootstrap.properties["--theme-accent"], "255 238 204");
assert.equal(customBootstrap.properties["--theme-text"], "9 9 11");

const invalidBootstrap = runThemeBootstrap({ "dnd-theme": "missing-theme" });
assert.equal(invalidBootstrap.root.dataset.themePalette, BASE_THEME_ID);
assert.equal(invalidBootstrap.root.dataset.background, DEFAULT_BACKGROUND_ID);
assert.equal(invalidBootstrap.properties["--theme-background"], "24 24 27");
assert.equal(invalidBootstrap.properties["--theme-accent"], "184 59 53");

const themedPages = [
  "admin/index.html",
  "char/ally/index.html",
  "char/cassian/index.html",
  "char/elaria/index.html",
  "char/index.html",
  "char/karma/index.html",
  "char/leon/index.html",
  "char/template/index.html",
  "char/tracker.html",
  "combat-loot/index.html",
  "compendium/index.html",
  "dm-screen/index.html",
  "login/index.html",
  "music/index.html",
  "player-screen/index.html",
  "public-initiative/index.html",
  "wiki/index.html",
];
for (const page of themedPages) {
  const html = fs.readFileSync(page, "utf8");
  const bootstrapIndex = html.indexOf('<script src="shared/js/theme-bootstrap.js"></script>');
  assert.ok(bootstrapIndex >= 0, `${page} must load the saved theme in its head.`);
  assert.ok(bootstrapIndex < html.indexOf('<link rel="stylesheet"'), `${page} must load the saved theme before its CSS.`);
}

console.log("Theme catalog, early bootstrap, ordering, normalization, reversal, and contrast tests passed.");

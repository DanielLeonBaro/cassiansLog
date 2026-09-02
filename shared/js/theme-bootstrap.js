// Applies the stored theme before paint to avoid a light or dark flash.
(() => {
  const BASE_THEME_ID = "cassians-classic";
  const builtInColors = {
    "cassians-classic": ["#18181B", "#B83B35"],
    "evil-cassian": ["#F4F4F5", "#B83B35"],
    "black-and-white": ["#18181B", "#F4F4F5"],
    aloe: ["#184D3B", "#D93680"],
    "autumn-orange": ["#B65F2A", "#F4F4F5"],
    "beach-day": ["#2D6FA3", "#FFF1D2"],
    bubblegum: ["#E98AAF", "#B6D9EE"],
    denim: ["#416E93", "#FFF1D2"],
    dusk: ["#2D8B78", "#B6D9EE"],
    "indigo-and-salmon": ["#3F4C9A", "#E98272"],
    lagoon: ["#76B7B2", "#FFF1D2"],
    lilacs: ["#C8B6E2", "#FFF6E5"],
    linen: ["#3F3F46", "#E7E5E4"],
    midnight: ["#32213F", "#CDB7E9"],
    "mint-chocolate": ["#5A3825", "#A7D8B8"],
    monaco: ["#2F7D67", "#C8B6E2"],
    nautical: ["#163A5F", "#147D82"],
    "orange-and-salmon": ["#B65F2A", "#E98272"],
    pacific: ["#B6D9EE", "#F4F4F5"],
    "peach-and-lime": ["#F4B8C4", "#9A7600"],
    peachy: ["#F4B183", "#F6E6A8"],
    plum: ["#A9CEE3", "#4A2C6F"],
    saffron: ["#F2C94C", "#18181B"],
    salmon: ["#E98272", "#F4F4F5"],
    sylen: ["#F4F4F5", "#B6D9EE"],
    "under-the-sea": ["#147D82", "#A9CEE3"],
    watermelon: ["#F4B8C4", "#3E7C3A"],
    zuriel: ["#F4F4F5", "#C69224"],
  };
  const backgroundIds = new Set([
    "argyle", "arcs", "carbon-fiber", "checkerboard", "chevron", "cicada-stripes", "circuit-grid", "cross", "default-squared",
    "diagonal-1", "diagonal-2", "diagonal-3", "diamond", "dots-grid", "flower", "graph-paper", "graph-paper-dotted",
    "horizontal-lines", "horizontal-slim-lines", "horizontal-wavy-lines", "honeycomb", "houndstooth", "infinite-circles",
    "infinite-wave", "isometric", "marrakesh", "paper", "paper-thin", "plaid", "polka-halftone", "polka-pin",
    "pyramid", "rhombus", "ripple", "starburst", "vertical-lines", "vertical-slim-lines",
    "vertical-wavy-lines", "weave", "wide-diagonal", "zigzag", "zigzag-3d",
  ]);

  const hexPattern = /^#[0-9A-F]{6}$/i;
  const rgb = (hex) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const rgbValue = (hex) => rgb(hex).join(" ");
  const mixHex = (left, right, rightWeight) => {
    const start = rgb(left);
    const end = rgb(right);
    const mixed = start.map((channel, index) => Math.round(channel * (1 - rightWeight) + end[index] * rightWeight));
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  };
  const luminance = (hex) => rgb(hex)
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (left, right) => {
    const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const readableForeground = (background) => contrast(background, "#09090B") >= contrast(background, "#FFFFFF")
    ? "#09090B"
    : "#FFFFFF";
  const readableMuted = (text, background) => {
    let result = text;
    for (let amount = 0.05; amount <= 0.65; amount += 0.05) {
      const candidate = mixHex(text, background, amount);
      if (contrast(candidate, background) < 4.5) break;
      result = candidate;
    }
    return result;
  };

  try {
    const storage = globalThis.localStorage;
    const storedThemeId = storage?.getItem("dnd-theme") || BASE_THEME_ID;
    const themeId = storedThemeId === "dark"
      ? BASE_THEME_ID
      : storedThemeId === "light"
        ? "evil-cassian"
        : storedThemeId;
    const cachedThemes = JSON.parse(storage?.getItem("dnd-theme-catalog") || "null");
    const cachedTheme = Array.isArray(cachedThemes)
      ? cachedThemes.find((theme) => theme?.id === themeId
        && hexPattern.test(theme.backgroundHex || "")
        && hexPattern.test(theme.accentHex || ""))
      : null;
    const colors = cachedTheme
      ? [cachedTheme.backgroundHex.toUpperCase(), cachedTheme.accentHex.toUpperCase()]
      : builtInColors[themeId] || builtInColors[BASE_THEME_ID];
    const reversed = storage?.getItem("dnd-theme-reversed") === "true";
    const backgroundHex = colors[reversed ? 1 : 0];
    const accentHex = colors[reversed ? 0 : 1];
    const fontMode = storage?.getItem("dnd-theme-font");
    const textHex = fontMode === "black"
      ? "#09090B"
      : fontMode === "white"
        ? "#FFFFFF"
        : readableForeground(backgroundHex);
    const onAccentHex = readableForeground(accentHex);
    const root = document.documentElement;
    root.dataset.theme = textHex === "#FFFFFF" ? "dark" : "light";
    root.dataset.themePalette = builtInColors[themeId] || cachedTheme ? themeId : BASE_THEME_ID;
    root.dataset.themeReversed = String(reversed);
    const storedBackgroundId = storage?.getItem("dnd-theme-background");
    root.dataset.background = backgroundIds.has(storedBackgroundId) ? storedBackgroundId : "default-squared";
    const values = {
      "--theme-background": backgroundHex,
      "--theme-surface": mixHex(backgroundHex, textHex, 0.07),
      "--theme-surface-strong": mixHex(backgroundHex, textHex, 0.14),
      "--theme-border": mixHex(backgroundHex, textHex, 0.24),
      "--theme-text": textHex,
      "--theme-muted": readableMuted(textHex, backgroundHex),
      "--theme-accent": accentHex,
      "--theme-accent-hover": mixHex(accentHex, onAccentHex === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.12),
      "--theme-on-accent": onAccentHex,
    };
    Object.entries(values).forEach(([name, value]) => root.style.setProperty(name, rgbValue(value)));
  } catch {
    // The HTML and CSS already contain Cassian's Classic as the safe default.
  }
})();

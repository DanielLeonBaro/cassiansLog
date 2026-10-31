import { mountTrackerScreen } from "../../js/tracker/screen.js";
import { createPreviewAdapter } from "./adapter.js";
import { hexToRGB } from "../../../shared/gc/theme-catalog.js";

const params = new URLSearchParams(location.search);
const fixture = params.get("fixture") || "fighter";
const variant = params.get("variant") === "v2.2" ? "v2.2" : "v2.1";
document.documentElement.dataset.density = params.get("density") === "compact" ? "compact" : "comfortable";
let theme = params.get("theme") === "dark" ? "dark" : "light";
function applyAppearance() {
  document.documentElement.dataset.previewTheme = theme;
  document.documentElement.dataset.background = "default-squared";
  const values = theme === "dark"
    ? { text: "#e9eaed", muted: "#adb0b8", surface: "#181b20", "surface-strong": "#22262d", border: "#393e47", accent: "#e9a095", "on-accent": "#201a18" }
    : { text: "#22272d", muted: "#626971", surface: "#fafaf8", "surface-strong": "#eeefeb", border: "#d6d9d4", accent: "#9a3c33", "on-accent": "#ffffff" };
  Object.entries(values).forEach(([key, value]) => document.documentElement.style.setProperty(`--gc-${key}`, value));
  for (const key of ["text", "accent"]) document.documentElement.style.setProperty(`--theme-${key}`, hexToRGB(values[key]).join(" "));
  document.documentElement.style.setProperty("--theme-background", theme === "dark" ? "24 24 27" : "244 244 245");
}
applyAppearance();
const adapter = createPreviewAdapter(fixture, params.get("readonly") === "1");
const screen = mountTrackerScreen(document.getElementById("tracker-preview"), {
  adapter, variant,
  onAppearance: () => { theme = theme === "light" ? "dark" : "light"; applyAppearance(); },
  onVariantChange: (next) => { params.set("variant", next); history.replaceState(null, "", `?${params}`); },
});
if (params.get("page")) screen.navigate(params.get("page"));
// Exposed only by this excluded preview entry point for browser assertions.
window.trackerPreview = { adapter, screen, get variant() { return screen.variant; }, setTheme(value) { theme = value === "dark" ? "dark" : "light"; applyAppearance(); } };

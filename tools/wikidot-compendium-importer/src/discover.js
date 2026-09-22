const CLASS_SLUGS = new Set(["artificer", "barbarian", "bard", "blood-hunter", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]);
const ITEM_PREFIXES = new Set(["adventuring-gear", "armor", "firearms", "items", "poisons", "siege-equipment", "tools", "weapons", "wondrous-items"]);
const INDEX_SLUGS = new Set(["spells", "adventuring-gear", "armor", "trinkets", "weapons", "firearms", "explosives", "wondrous-items", "currency", "poisons", "tools", "siege-equipment"]);
const INDEX_2024_SLUGS = new Set([
  "background:all", "species:all", "feat:all", "spell:all", "magic-item:all", "equipment:all", "ua:all",
  "equipment:adventuring-gear", "equipment:armor", "equipment:crafting", "equipment:currency", "equipment:mounts-and-vehicles",
  "equipment:poison", "equipment:tool", "equipment:trinket", "equipment:weapon",
]);

function decode(value) {
  return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'");
}

export function typeFromUrl(value) {
  const url = new URL(value, "https://dnd5e.wikidot.com/");
  const slug = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
  if (!slug || slug.startsWith("system:") || slug.startsWith("main:")) return "";
  const [prefix] = slug.split(":");
  if (prefix === "background") return "background";
  if (["lineage", "race"].includes(prefix)) return "species";
  if (prefix === "feat") return "feat";
  if (prefix === "spell") return "spell";
  if (ITEM_PREFIXES.has(prefix) && slug.includes(":")) return "item";
  if (CLASS_SLUGS.has(slug)) return "class";
  if (CLASS_SLUGS.has(prefix) && slug.includes(":")) return "subclass";
  return "";
}

function prefixed2024Type(slug) {
  const rest = slug.split(":").slice(1).join(":");
  if (/^background-/.test(rest)) return "background";
  if (/^(?:species|race)-/.test(rest)) return "species";
  if (/^feat-/.test(rest)) return "feat";
  if (/^spell-/.test(rest)) return "spell";
  if (/^(?:magic-item|item)-/.test(rest)) return "item";
  if (/^class-/.test(rest)) return "class";
  return "";
}

export function typeFrom2024Url(value) {
  const url = new URL(value, "https://dnd2024.wikidot.com/");
  const slug = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
  if (!slug || INDEX_2024_SLUGS.has(slug) || slug.startsWith("system:") || slug.startsWith("main:")) return "";
  const [prefix, suffix = ""] = slug.split(":");
  if (["ua", "hb", "homebrew"].includes(prefix)) return prefixed2024Type(slug);
  if (prefix === "background") return "background";
  if (["species", "race"].includes(prefix)) return "species";
  if (prefix === "feat") return "feat";
  if (prefix === "spell" && !suffix.endsWith("-school")) return "spell";
  if (["magic-item", "item"].includes(prefix)) return "item";
  if (CLASS_SLUGS.has(prefix) && suffix === "main") return "class";
  if (CLASS_SLUGS.has(prefix) && suffix && suffix !== "spell-list") return "subclass";
  return "";
}

export function contentClassificationFromUrl(value) {
  const prefix = decodeURIComponent(new URL(value, "https://dnd2024.wikidot.com/").pathname.replace(/^\/+/, "")).split(":")[0].toLowerCase();
  if (prefix === "ua") return "unearthed-arcana";
  if (["hb", "homebrew"].includes(prefix)) return "homebrew";
  return "official";
}

export function discover5eIndexes(html, baseUrl = "https://dnd5e.wikidot.com/") {
  const base = new URL(baseUrl);
  const urls = new Set();
  for (const match of String(html || "").matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    let url;
    try { url = new URL(decode(match[1]), base); } catch { continue; }
    url.hash = "";
    const slug = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
    const [prefix] = slug.split(":");
    if (url.hostname === "dnd5e.wikidot.com" && url.protocol === "https:" && (INDEX_SLUGS.has(slug) || prefix === "spells")) urls.add(url.href);
  }
  return [...urls].sort();
}

export function discover5ePages(html, baseUrl = "https://dnd5e.wikidot.com/", { type = "" } = {}) {
  const base = new URL(baseUrl);
  const pages = [];
  const seen = new Set();
  for (const match of String(html || "").matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(decode(match[1]), base); } catch { continue; }
    url.hash = "";
    if (url.hostname !== "dnd5e.wikidot.com" || url.protocol !== "https:") continue;
    const pageType = typeFromUrl(url);
    if (!pageType || (type && pageType !== type) || seen.has(url.href)) continue;
    seen.add(url.href);
    pages.push({ url: url.href, type: pageType });
  }
  return pages.sort((left, right) => left.type.localeCompare(right.type) || left.url.localeCompare(right.url));
}

export const DND5E_INDEX_URL = "https://dnd5e.wikidot.com/";

export function discover2024Indexes(html, baseUrl = "https://dnd2024.wikidot.com/") {
  const base = new URL(baseUrl);
  const urls = new Set();
  for (const match of String(html || "").matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    let url;
    try { url = new URL(decode(match[1]), base); } catch { continue; }
    url.hash = "";
    const slug = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
    if (url.hostname === "dnd2024.wikidot.com" && url.protocol === "https:" && INDEX_2024_SLUGS.has(slug)) urls.add(url.href);
  }
  return [...urls].sort();
}

export function discover2024Pages(html, baseUrl = "https://dnd2024.wikidot.com/", { type = "" } = {}) {
  const base = new URL(baseUrl);
  const pages = [];
  const seen = new Set();
  for (const match of String(html || "").matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(decode(match[1]), base); } catch { continue; }
    url.hash = "";
    if (url.hostname !== "dnd2024.wikidot.com" || url.protocol !== "https:") continue;
    const pageType = typeFrom2024Url(url);
    if (!pageType || (type && pageType !== type) || seen.has(url.href)) continue;
    seen.add(url.href);
    pages.push({ url: url.href, type: pageType, contentClassification: contentClassificationFromUrl(url) });
  }
  return pages.sort((left, right) => left.type.localeCompare(right.type) || left.url.localeCompare(right.url));
}

export const DND2024_INDEX_URL = "https://dnd2024.wikidot.com/";

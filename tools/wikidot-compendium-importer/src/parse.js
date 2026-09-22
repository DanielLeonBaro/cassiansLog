import { contentClassificationFromUrl, typeFrom2024Url, typeFromUrl } from "./discover.js";

export const PARSER_VERSION = "dnd5e-1";
export const PARSER_2024_VERSION = "dnd2024-1";

function decode(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function plain(html) {
  return decode(String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|h[1-6]|li|tr|div)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function pageContent(html) {
  const source = String(html || "");
  const start = source.search(/<div\b[^>]*\bid=["']page-content["'][^>]*>/i);
  if (start < 0) return "";
  const body = source.slice(start);
  const end = body.search(/<div\b[^>]*\bclass=["'][^"']*page-tags/i);
  return end < 0 ? body : body.slice(0, end);
}

function titleFrom(html, url) {
  const title = plain(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+-\s+D(?:&D|ND) (?:5th Edition|5e).*$/i, "").replace(/^(?:Background|Wizard|Fighter|Cleric|Druid|Bard|Rogue|Ranger|Paladin|Monk|Sorcerer|Warlock):\s*/i, "");
  return title || decodeURIComponent(new URL(url).pathname.split(":").pop().replace(/[-_]+/g, " "));
}

function labeled(text, label) {
  return text.match(new RegExp(`(?:^|\\n)${label}:\\s*([^\\n]+)`, "i"))?.[1]?.trim() || "";
}

function headings(content) {
  return [...content.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({ level: Number(match[1]), text: plain(match[2]) })).filter(({ text }) => text);
}

function paragraphs(content) {
  return [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => plain(match[1])).filter(Boolean);
}

function tables(content) {
  return [...content.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((table) => ({
    rows: [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => plain(cell[1]))).filter((row) => row.length),
  })).filter(({ rows }) => rows.length);
}

function links(content, sourceUrl) {
  return [...content.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    try { return [{ text: plain(match[2]), url: new URL(decode(match[1]), sourceUrl).href }]; } catch { return []; }
  }).filter(({ text }) => text);
}

function spellFields(text) {
  const rank = text.match(/(?:^|\n)(cantrip|\d+(?:st|nd|rd|th)-level)\s+([a-z]+)/i);
  const components = labeled(text, "Components");
  return {
    level: rank?.[1]?.toLowerCase() === "cantrip" ? 0 : Number(rank?.[1]?.match(/\d+/)?.[0] ?? NaN),
    school: rank?.[2] || "",
    castingTime: labeled(text, "Casting Time"),
    range: labeled(text, "Range"),
    components,
    duration: labeled(text, "Duration"),
    concentration: /^concentration/i.test(labeled(text, "Duration")),
    ritual: /(?:^|\n)(?:cantrip|\d+(?:st|nd|rd|th)-level)[^\n]*\(ritual\)/i.test(text),
    spellLists: text.match(/(?:^|\n)Spell Lists?\.?:?\s*([^\n]+)/i)?.[1]?.split(",").map((value) => value.trim()).filter(Boolean) || [],
  };
}

function spell2024Fields(text) {
  const rank = text.match(/(?:^|\n)Level\s+(\d+)\s+([A-Za-z]+)(?:\s+Spell)?(?:\s+\(([^)]+)\))?/i);
  return {
    level: Number(rank?.[1] ?? NaN),
    school: rank?.[2] || "",
    castingTime: labeled(text, "Casting Time"),
    range: labeled(text, "Range"),
    components: labeled(text, "Components"),
    duration: labeled(text, "Duration"),
    concentration: /^concentration/i.test(labeled(text, "Duration")),
    ritual: /(?:^|\n)Level\s+\d+[^\n]*\britual\b/i.test(text),
    spellLists: rank?.[3]?.split(",").map((value) => value.trim()).filter(Boolean) || [],
  };
}

function typedFields(type, text) {
  if (type === "spell") return spellFields(text);
  if (type === "background") return {
    skillProficiencies: labeled(text, "Skill Proficiencies"),
    toolProficiencies: labeled(text, "Tool Proficiencies"),
    languages: labeled(text, "Languages"),
    equipment: labeled(text, "Equipment"),
  };
  if (type === "feat") return { prerequisite: labeled(text, "Prerequisite") };
  if (type === "item") return { itemType: text.split("\n").find((line) => /(?:item|armor|weapon|potion|ring|wand|staff|rod|scroll)/i.test(line) && !/^Source:/i.test(line)) || "" };
  return {};
}

function typed2024Fields(type, text) {
  if (type === "spell") return spell2024Fields(text);
  const fields = typedFields(type, text);
  if (type === "background") fields.toolProficiencies ||= labeled(text, "Tool Proficiency");
  return fields;
}

function pageTags(html) {
  const block = String(html || "").match(/<div\b[^>]*\bclass=["'][^"']*page-tags[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  return [...block.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => plain(match[1])).filter(Boolean);
}

function parsePage({ html, sourcePageUrl, retrievedAt = "", rawSha256 = "", ruleset, parserVersion, type, classification, typed }) {
  const contentHtml = pageContent(html);
  if (!contentHtml) throw new Error("Wikidot page lacks #page-content.");
  const contentText = plain(contentHtml);
  const publication = contentText.match(/(?:^|\n)Sources?:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const warnings = [];
  if (!publication) warnings.push({ code: "unknown-publication", message: "Page does not state a publication source." });
  return {
    schemaVersion: 1,
    name: titleFrom(html, sourcePageUrl),
    type,
    ruleset,
    publication,
    contentClassification: classification,
    sourcePageUrl: new URL(sourcePageUrl).href,
    retrievedAt,
    rawSha256,
    parserVersion,
    licenseStatus: "unknown",
    automationStatus: "manual",
    content: {
      headings: headings(contentHtml),
      paragraphs: paragraphs(contentHtml),
      tables: tables(contentHtml),
      links: links(contentHtml, sourcePageUrl),
      tags: pageTags(html),
      prerequisite: labeled(contentText, "Prerequisite"),
      ...typed(type, contentText),
    },
    warnings,
  };
}

export function parseDnd5ePage({ html, sourcePageUrl, retrievedAt = "", rawSha256 = "" }) {
  const type = typeFromUrl(sourcePageUrl);
  if (!type) throw new Error(`Unsupported dnd5e.wikidot.com page type: ${sourcePageUrl}`);
  return parsePage({ html, sourcePageUrl, retrievedAt, rawSha256, ruleset: "5e", parserVersion: PARSER_VERSION, type, classification: "official", typed: typedFields });
}

export function parseDnd2024Page({ html, sourcePageUrl, retrievedAt = "", rawSha256 = "" }) {
  const type = typeFrom2024Url(sourcePageUrl);
  if (!type) throw new Error(`Unsupported dnd2024.wikidot.com page type: ${sourcePageUrl}`);
  return parsePage({
    html, sourcePageUrl, retrievedAt, rawSha256, ruleset: "5.5e", parserVersion: PARSER_2024_VERSION, type,
    classification: contentClassificationFromUrl(sourcePageUrl), typed: typed2024Fields,
  });
}

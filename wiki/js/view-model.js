// Builds normalized Wiki navigation trees and page lookup state.
import { normalizeText as normalize } from "../../shared/js/text.js";

export function sortWikiPages(pages) {
  return [...pages].sort((left, right) => left.name.localeCompare(right.name));
}

export function findWikiPageByName(pages, name) {
  const target = normalize(name);
  return pages.find((page) => (
    normalize(page.name) === target ||
    (page.aliases || []).some((alias) => normalize(alias) === target)
  ));
}

export function wikiIconForType(type) {
  const value = normalize(type);
  if (value.includes("city") || value.includes("town")) return "bi-buildings-fill";
  if (value.includes("location") || value.includes("region")) return "bi-geo-alt-fill";
  if (value.includes("character")) return "bi-person-fill";
  if (value.includes("house") || value.includes("faction") || value.includes("guild"))
    return "bi-shield-fill";
  if (value.includes("religion")) return "bi-sun-fill";
  if (value.includes("history") || value.includes("event")) return "bi-hourglass-split";
  if (value.includes("map")) return "bi-map-fill";
  if (value.includes("family")) return "bi-diagram-3-fill";
  return "bi-bookmark-star-fill";
}

export function filterWikiPages(pages, { search = "", type = "" } = {}) {
  const query = normalize(search);
  return sortWikiPages(pages).filter((page) => {
    if (type && page.type !== type) return false;
    if (!query) return true;
    return normalize([
      page.name,
      page.type,
      page.summary,
      page.body,
      ...(page.aliases || []),
    ].join(" ")).includes(query);
  });
}

export function mentionedWikiPages(pages, body) {
  const result = [];
  const seen = new Set();
  for (const match of String(body || "").matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const page = findWikiPageByName(pages, match[1].trim());
    if (page && !seen.has(page.id)) {
      seen.add(page.id);
      result.push(page);
    }
  }
  return result;
}

export function relatedWikiPages(pages, page, limit = 12) {
  const result = mentionedWikiPages(pages, page.body)
    .filter((related) => related.id !== page.id);
  const seen = new Set(result.map((related) => related.id));
  pages.forEach((candidate) => {
    if (candidate.id === page.id || seen.has(candidate.id)) return;
    if (mentionedWikiPages(pages, candidate.body).some((mentioned) => mentioned.id === page.id)) {
      result.push(candidate);
      seen.add(candidate.id);
    }
  });
  return result.slice(0, limit);
}

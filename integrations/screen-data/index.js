// Defines built-in Player and DM Screen reference tables and widgets.
import {
  filterCompendiumEntries,
  loadCompendiumCatalog,
  loadCompendiumCategory,
} from "../../compendium/js/api.js";
import { campaignApiPath } from "../../shared/js/campaign-context.js";
import { isLocalRuntimeHost } from "../../shared/js/runtime-host.js";
import { readJSON } from "../../shared/js/storage.js";
import { listCharacters } from "../../char/js/archive/api.js";
import { localInitiativeNames } from "../../public-initiative/js/api.js";

async function optionalJSON(url) {
  if (isLocalRuntimeHost() && String(url).startsWith("api/")) return null;
  try {
    const response = await fetch(campaignApiPath(url), { headers: { accept: "application/json" } });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function loadScreenCharacters() {
  return (await listCharacters()).map(({ canEdit, canManage, custom, description, ...character }) => character);
}

export async function refreshCharacterRuntime(characters) {
  return Promise.all(characters.map(async (character) => {
    const state = await optionalJSON(`api/characters/${encodeURIComponent(character.id)}/state`);
    if (!state?.value?.hp) return { ...character };
    return {
      ...character,
      hp: {
        ...character.hp,
        current: Number.isFinite(Number(state.value.hp.current))
          ? Math.min(Number(character.hp?.max) || 0, Number(state.value.hp.current))
          : character.hp?.current,
        temp: Number(state.value.hp.temp) || 0,
      },
    };
  }));
}

export async function loadScreenInitiative() {
  if (isLocalRuntimeHost()) return localInitiativeNames();
  const snapshot = await optionalJSON("api/public-initiative");
  return Array.isArray(snapshot?.names) ? snapshot.names : [];
}

export async function loadWikiMentions() {
  const wiki = await optionalJSON("api/wiki");
  return Array.isArray(wiki?.pages) ? wiki.pages : isLocalRuntimeHost() ? readJSON("dnd-wiki-pages-v1", []) : [];
}

export async function screenCompendiumCatalog() {
  return loadCompendiumCatalog();
}

export function filterScreenCompendium(entries, filters) {
  return filterCompendiumEntries(entries, filters);
}

function heading(label, value) {
  const content = String(value || "").trim();
  return content ? `## ${label}\n\n${content}` : "";
}

function detailsMarkdown(setters) {
  const rows = Object.entries(setters || {}).filter(([, value]) => String(value).trim());
  return rows.length ? `## Details\n\n${rows.map(([key, value]) => `- **${key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}:** ${Array.isArray(value) ? value.join(", ") : value}`).join("\n")}` : "";
}

function rulesMarkdown(rules) {
  const groups = [["Grants", rules?.grants], ["Selections", rules?.selections], ["Stat rules", rules?.stats]]
    .filter(([, rows]) => rows?.length);
  if (!groups.length) return "";
  return `## Rules\n\n${groups.map(([label, rows]) => `### ${label}\n\n${rows.map((row) => `- ${Object.entries(row).filter(([key]) => key !== "items").map(([key, value]) => `**${key}:** ${value}`).join(" · ")}`).join("\n")}`).join("\n\n")}`;
}

export async function compendiumReferenceSnapshot(indexEntry, manifest) {
  const entries = await loadCompendiumCategory(indexEntry.category, manifest);
  const entry = entries.find((candidate) => candidate.id === indexEntry.id);
  if (!entry) throw new Error("The selected Compendium entry could not be loaded.");
  const body = [
    entry.publication ? `> Source: ${entry.publication}` : "",
    heading("Summary", entry.summary),
    heading("Description", entry.description),
    heading("Prerequisite", entry.prerequisite),
    heading("Requirements", entry.requirements),
    heading("Supports", entry.supports),
    detailsMarkdown(entry.setters),
    rulesMarkdown(entry.rules),
  ].filter(Boolean).join("\n\n");
  return {
    title: entry.name,
    body,
    source: {
      id: entry.id,
      category: entry.category,
      name: entry.name,
      publication: entry.publication || "",
    },
  };
}

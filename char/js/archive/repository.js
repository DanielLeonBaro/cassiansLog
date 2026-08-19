import { readJSON, writeJSON } from "../../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../../shared/js/cloud-store.js";

export const CHARACTERS_KEY = "dnd-characters";
export const DELETED_KEY = "dnd-deleted-characters";
export const PENDING_KEY = "dnd-new-character";

const fallbackPortrait = "shared/assets/bat.ico";
const legacyPortraits = new Map([
  ["data/portraits/ally.png", "char/ally/portrait.png"],
  ["data/portraits/Chibi Cassian.jpg", "char/cassian/portrait.jpg"],
  ["data/portraits/cassian.png", "char/cassian/portrait-alternate.png"],
  ["data/portraits/karma.jpg", "char/karma/portrait.jpg"],
  ["data/portraits/leon.png", "char/leon/portrait.png"],
  ["bat.ico", fallbackPortrait],
]);

export function migrateLegacyPortrait(character) {
  if (!character || typeof character !== "object") return false;
  const migrated = legacyPortraits.get(character.portrait);
  if (!migrated || migrated === character.portrait) return false;
  character.portrait = migrated;
  return true;
}

export function storedCharacters() {
  const value = readJSON(CHARACTERS_KEY, {});
  const characters = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  let changed = false;
  Object.values(characters).forEach((character) => {
    changed = migrateLegacyPortrait(character) || changed;
  });
  if (changed) writeJSON(CHARACTERS_KEY, characters);
  return characters;
}

export function characterDescription(character) {
  const ancestryAndClass = [character.race, character.class, character.subclass]
    .filter(Boolean)
    .join(" · ");
  return `Level ${character.level ?? "—"} ${ancestryAndClass}`.trim();
}

export function isBundledCharacter(id, catalog) {
  return id === "template" || (
    Array.isArray(catalog?.characters) && catalog.characters.includes(id)
  );
}

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

export async function listCharacters() {
  const catalog = await getJSON(new URL("../../catalog.json", import.meta.url));
  const staticBundled = await Promise.all(catalog.characters.map((id) =>
    getJSON(new URL(`../../${encodeURIComponent(id)}/character.json`, import.meta.url)),
  ));
  const cloud = await readCloudJSON("api/characters", { fallback: null });
  const bundled = Array.isArray(cloud?.characters) && cloud.characters.length
    ? cloud.characters.map(({ document }) => ({
      ...document,
      custom: !isBundledCharacter(document.id, catalog),
    }))
    : staticBundled.map((character) => ({ ...character, custom: false }));
  const saved = storedCharacters();
  const cloudIsAuthoritative = Array.isArray(cloud?.characters) && cloud.characters.length;
  const deleted = new Set(readJSON(DELETED_KEY, []));
  const bundledIds = new Set(bundled.map((character) => character.id));
  const characters = bundled
    .filter((character) => !deleted.has(character.id))
    .map((character) => {
      const override = cloudIsAuthoritative ? null : saved[character.id];
      return override ? {
        ...character,
        name: override.name,
        portrait: override.portrait,
        description: characterDescription(override),
      } : { ...character, description: characterDescription(character) };
    });
  Object.values(saved).forEach((character) => {
    if (cloudIsAuthoritative) return;
    if (!bundledIds.has(character.id)) {
      characters.push({ ...character, custom: true, description: characterDescription(character) });
    }
  });
  return characters;
}

export async function removeCharacter(character) {
  await writeCloudJSON(`api/characters/${encodeURIComponent(character.id)}`, undefined, { method: "DELETE" });
  const stored = storedCharacters();
  delete stored[character.id];
  writeJSON(CHARACTERS_KEY, stored);
  if (!character.custom) {
    const deleted = new Set(readJSON(DELETED_KEY, []));
    deleted.add(character.id);
    writeJSON(DELETED_KEY, [...deleted]);
  }
}

export function createCharacterId(name) {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
  const occupied = new Set([...Object.keys(storedCharacters()), "cassian", "template"]);
  let id = base;
  let suffix = 2;
  while (occupied.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function applyNewCharacterSetup(template, setup) {
  const character = clone(template);
  character.id = setup.id;
  character.name = String(setup.name || "").trim();
  character.portrait = setup.portrait || fallbackPortrait;
  character.class = String(setup.class || "").trim();
  character.race = String(setup.race || "").trim();
  const level = Number(setup.level);
  character.level = String(setup.level ?? "").trim() && Number.isFinite(level) ? level : 1;

  if (setup.starterMode === "blank") {
    for (const collection of [
      "trackers", "actions", "spells", "resources", "features", "inventory",
    ]) character[collection] = [];
    character.spellcasting = {
      ...(character.spellcasting || {}),
      enabled: false,
      profiles: [],
      slots: [],
    };
    if (character.currency && typeof character.currency === "object") {
      Object.keys(character.currency).forEach((coin) => {
        character.currency[coin] = 0;
      });
    }
  }

  return character;
}

export async function createCharacter(setup) {
  const id = createCharacterId(setup.name);
  const template = await getJSON(new URL("../../template/character.json", import.meta.url));
  const character = applyNewCharacterSetup(template, { ...setup, id });
  const stored = storedCharacters();
  stored[id] = clone(character);
  writeJSON(CHARACTERS_KEY, stored);

  try {
    await writeCloudJSON(`api/characters/${encodeURIComponent(id)}`, {
      document: clone(character),
      source: "custom",
    });
    return { character, cloudSaved: true, cloudError: null };
  } catch (cloudError) {
    return { character, cloudSaved: false, cloudError };
  }
}

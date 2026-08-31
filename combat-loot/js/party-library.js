// Stores reusable party members and converts them into combatants.
import { readJSON, writeJSON } from "../../shared/js/storage.js";
import { cloneJSON } from "../../shared/js/text.js";
import { normalizeCharacterName } from "./model.js";

export const PARTY_LIBRARY_VERSION = 1;
export const PARTY_LIBRARY_STORAGE_KEY = "dnd-combat-loot-party-library-v1";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function comparable(value) {
  return text(value).toLocaleLowerCase();
}

function numericText(value) {
  const normalized = text(value);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return "";
  return Number.isFinite(Number(normalized)) ? normalized : "";
}

function defaultIdFactory() {
  if (globalThis.crypto?.randomUUID) return `party-${globalThis.crypto.randomUUID()}`;
  return `party-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeMembers(members, { strict = false } = {}) {
  if (!Array.isArray(members)) {
    if (strict) throw new TypeError("Party members must be an array.");
    return [];
  }
  const result = [];
  for (const member of members) {
    const character = normalizeCharacterName(member?.character);
    const maxHp = numericText(member?.maxHp);
    const ac = numericText(member?.ac);
    if (!character && !text(member?.maxHp) && !text(member?.ac)) continue;
    if (!character) {
      if (strict) throw new Error("Each party member needs a character name.");
      continue;
    }
    if (!maxHp) {
      if (strict) throw new Error(`${character} needs a numeric Max HP.`);
      continue;
    }
    if (!ac) {
      if (strict) throw new Error(`${character} needs a numeric AC.`);
      continue;
    }
    if (result.some((candidate) => comparable(candidate.character) === comparable(character))) {
      if (strict) throw new Error(`${character} is already in this party.`);
      continue;
    }
    result.push({ character, maxHp, ac });
  }
  return result;
}

export function normalizePartyLibrary(value) {
  const candidates = Array.isArray(value) ? value : value?.parties;
  if (!Array.isArray(candidates)) return [];
  const usedIds = new Set();
  return candidates.reduce((parties, candidate) => {
    const id = text(candidate?.id);
    const name = text(candidate?.name);
    const members = normalizeMembers(candidate?.members);
    if (!id || !name || !members.length || usedIds.has(id)) return parties;
    usedIds.add(id);
    parties.push({ id, name, members });
    return parties;
  }, []);
}

function readStored(storage) {
  if (!storage) return readJSON(PARTY_LIBRARY_STORAGE_KEY, null);
  try {
    const value = storage.getItem(PARTY_LIBRARY_STORAGE_KEY);
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
}

function writeStored(value, storage) {
  if (storage) storage.setItem(PARTY_LIBRARY_STORAGE_KEY, JSON.stringify(value));
  else writeJSON(PARTY_LIBRARY_STORAGE_KEY, value);
}

export function loadPartyLibrary(storage) {
  return cloneJSON(normalizePartyLibrary(readStored(storage)));
}

export function savePartyLibrary(parties, storage) {
  try {
    const normalized = normalizePartyLibrary({ parties });
    if (!Array.isArray(parties) || normalized.length !== parties.length) {
      throw new TypeError("Every party must have a name, members, and a unique ID.");
    }
    const envelope = { version: PARTY_LIBRARY_VERSION, parties: normalized };
    writeStored(envelope, storage);
    return { ok: true, parties: cloneJSON(normalized), envelope: cloneJSON(envelope) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error("Could not save parties.") };
  }
}

export function upsertParty(parties, party, options = {}) {
  const current = normalizePartyLibrary({ parties });
  const idFactory = options.idFactory || defaultIdFactory;
  if (typeof idFactory !== "function") throw new TypeError("A valid party ID factory is required.");
  const existingIndex = current.findIndex((candidate) => candidate.id === text(party?.id));
  const id = existingIndex >= 0 ? current[existingIndex].id : text(party?.id) || text(idFactory());
  const name = text(party?.name);
  if (!id) throw new Error("The party ID cannot be empty.");
  if (!name) throw new Error("A party name is required.");
  if (current.some((candidate, index) => index !== existingIndex && comparable(candidate.name) === comparable(name))) {
    throw new Error(`A party named ${name} already exists.`);
  }
  const members = normalizeMembers(party?.members, { strict: true });
  if (!members.length) throw new Error(`${name} needs at least one character.`);
  const next = current.slice();
  const saved = { id, name, members };
  if (existingIndex >= 0) next[existingIndex] = saved;
  else next.push(saved);
  return next;
}

export function membersForPartyIds(parties, partyIds) {
  const selected = new Set(Array.isArray(partyIds) ? partyIds : []);
  const seen = new Set();
  return normalizePartyLibrary({ parties }).flatMap((party) => {
    if (!selected.has(party.id)) return [];
    return party.members.filter((member) => {
      const name = comparable(member.character);
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  });
}

export function partyCandidatesForCharacters(parties, characters) {
  const library = normalizePartyLibrary({ parties });
  const seen = new Set();
  return (Array.isArray(characters) ? characters : []).reduce((candidates, value) => {
    const character = normalizeCharacterName(value);
    const key = comparable(character);
    if (!key || seen.has(key)) return candidates;
    seen.add(key);
    const options = library.flatMap((party) => party.members
      .filter((member) => comparable(member.character) === key)
      .map((member) => ({
        partyId: party.id,
        partyName: party.name,
        character: member.character,
        maxHp: member.maxHp,
        ac: member.ac,
      })));
    if (options.length) candidates.push({ character, key, options });
    return candidates;
  }, []);
}

export function resolvePartyCandidates(candidates, selections = {}) {
  return (Array.isArray(candidates) ? candidates : []).flatMap((candidate) => {
    const selectedId = selections[candidate.key];
    const option = candidate.options.length === 1
      ? candidate.options[0]
      : candidate.options.find((choice) => choice.partyId === selectedId);
    return option ? [{ character: candidate.character, maxHp: option.maxHp, ac: option.ac }] : [];
  });
}

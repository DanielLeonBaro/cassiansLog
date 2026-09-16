// Owns local-first Character Builder drafts and cloud synchronization/finalization.
import { readCloudJSON, writeCloudJSON } from "../../../shared/js/cloud-store.js";
import { currentCampaignSlug, assignLocalCharacterEditor, localCampaign } from "../../../shared/js/campaign-context.js";
import { currentLocalUser } from "../../../shared/js/local-users.js";
import { readJSON, writeJSON } from "../../../shared/js/storage.js";
import { cloneJSON } from "../../../shared/js/text.js";
import { isLocalRuntimeHost } from "../../../shared/js/runtime-host.js";
import { normalizeCharacterDocument } from "../model.js";
import { listCharacters, storedCharacters } from "../archive/repository.js";
import { CHARACTER_BUILD_DRAFTS_STORAGE_KEY, CHARACTERS_STORAGE_KEY } from "../storage-keys.js";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/i;
const STEPS = new Set(["home", "class", "background", "species", "abilities", "equipment", "description", "review"]);

export class CharacterBuildDraftError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause });
    this.name = "CharacterBuildDraftError";
    this.status = status;
  }
}

function validId(value) {
  const id = String(value || "").trim();
  return ID_PATTERN.test(id) ? id : "";
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error || "Cloud synchronization failed.");
}

export function normalizeCharacterBuildDraft(value, { now = new Date().toISOString(), previous = null } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Character build draft must be an object.");
  const draftId = validId(value.draftId);
  if (!draftId) throw new TypeError("Character build draft ID is invalid.");
  const document = normalizeCharacterDocument(value.document);
  const currentStep = STEPS.has(value.currentStep) ? value.currentStep : "home";
  return {
    ...cloneJSON(value),
    draftId,
    document,
    currentStep,
    status: document.build.status,
    version: document.build.version,
    createdAt: previous?.createdAt || value.createdAt || now,
    updatedAt: now,
    sync: value.sync && typeof value.sync === "object" ? cloneJSON(value.sync) : { state: "saved", error: "" },
  };
}

export function storedCharacterBuildDrafts() {
  const value = readJSON(CHARACTER_BUILD_DRAFTS_STORAGE_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function localCharacterBuildDraft(draftId) {
  const id = validId(draftId);
  const draft = id ? storedCharacterBuildDrafts()[id] : null;
  return draft && typeof draft === "object" ? cloneJSON(draft) : null;
}

function writeLocalDraft(value, { now = new Date().toISOString() } = {}) {
  const drafts = storedCharacterBuildDrafts();
  const draft = normalizeCharacterBuildDraft(value, { now, previous: drafts[value.draftId] });
  drafts[draft.draftId] = draft;
  writeJSON(CHARACTER_BUILD_DRAFTS_STORAGE_KEY, drafts);
  return cloneJSON(draft);
}

function removeLocalDraft(draftId) {
  const drafts = storedCharacterBuildDrafts();
  const existed = Object.hasOwn(drafts, draftId);
  delete drafts[draftId];
  writeJSON(CHARACTER_BUILD_DRAFTS_STORAGE_KEY, drafts);
  return existed;
}

function cloudPath(draftId, tail = "") {
  return `api/character-build-drafts/${encodeURIComponent(draftId)}${tail ? `/${tail}` : ""}`;
}

export async function saveCharacterBuildDraft(value, {
  cloudWrite = writeCloudJSON,
  now = () => new Date().toISOString(),
} = {}) {
  let draft = writeLocalDraft({ ...value, sync: { state: "pending", error: "" } }, { now: now() });
  try {
    const response = await cloudWrite(cloudPath(draft.draftId), {
      document: cloneJSON(draft.document),
      currentStep: draft.currentStep,
    });
    draft = writeLocalDraft({
      ...draft,
      ...(response?.draft || {}),
      sync: { state: "saved", error: "", updatedAt: response?.draft?.updatedAt || response?.updatedAt || now() },
    }, { now: response?.draft?.updatedAt || response?.updatedAt || now() });
    return { draft, cloudSaved: true, cloudError: null };
  } catch (cloudError) {
    draft = writeLocalDraft({ ...draft, sync: { state: "failed", error: errorText(cloudError) } }, { now: draft.updatedAt });
    return { draft, cloudSaved: false, cloudError };
  }
}

export async function loadCharacterBuildDraft(draftId, { cloudRead = readCloudJSON } = {}) {
  const id = validId(draftId);
  if (!id) throw new TypeError("Character build draft ID is invalid.");
  const local = localCharacterBuildDraft(id);
  if (local) return { draft: local, source: "local" };
  const response = await cloudRead(cloudPath(id), { fallback: null });
  if (!response?.draft) return { draft: null, source: "none" };
  const draft = writeLocalDraft({ ...response.draft, sync: { state: "saved", error: "", updatedAt: response.draft.updatedAt } }, {
    now: response.draft.updatedAt || new Date().toISOString(),
  });
  return { draft, source: "cloud" };
}

export async function deleteCharacterBuildDraft(draftId, {
  cloudWrite = writeCloudJSON,
  localOnly = isLocalRuntimeHost(),
  now = () => new Date().toISOString(),
} = {}) {
  const id = validId(draftId);
  if (!id) throw new TypeError("Character build draft ID is invalid.");
  const draft = localCharacterBuildDraft(id);
  if (localOnly) return { deleted: removeLocalDraft(id), cloudSaved: true, cloudError: null };
  if (draft) writeLocalDraft({ ...draft, pendingDelete: true, sync: { state: "pending", error: "" } }, { now: now() });
  try {
    const response = await cloudWrite(cloudPath(id), undefined, { method: "DELETE" });
    removeLocalDraft(id);
    return { deleted: response?.deleted !== false, cloudSaved: true, cloudError: null };
  } catch (cloudError) {
    const recovery = localCharacterBuildDraft(id);
    if (recovery) writeLocalDraft({ ...recovery, pendingDelete: true, sync: { state: "failed", error: errorText(cloudError) } }, { now: recovery.updatedAt });
    return { deleted: false, cloudSaved: false, cloudError };
  }
}

async function finishLocally(draft, characterList) {
  const document = draft.document;
  const id = validId(document.id);
  if (!id || document.build.status !== "complete") throw new CharacterBuildDraftError("Complete Character draft with valid Character ID is required.", { status: 400 });
  if ((await characterList()).some((character) => character.id === id)) {
    throw new CharacterBuildDraftError("That character ID already exists.", { status: 409 });
  }
  const characters = storedCharacters();
  characters[id] = cloneJSON(document);
  writeJSON(CHARACTERS_STORAGE_KEY, characters);
  const slug = currentCampaignSlug();
  const user = currentLocalUser();
  if (slug && localCampaign(slug)?.role === "player") assignLocalCharacterEditor(slug, id, user.id);
  removeLocalDraft(draft.draftId);
  return { ok: true, id, document: cloneJSON(document), local: true };
}

export async function finalizeCharacterBuildDraft(draftId, {
  cloudWrite = writeCloudJSON,
  localOnly = isLocalRuntimeHost(),
  characterList = listCharacters,
} = {}) {
  const id = validId(draftId);
  if (!id) throw new TypeError("Character build draft ID is invalid.");
  const draft = localCharacterBuildDraft(id);
  if (!draft) throw new CharacterBuildDraftError("Character draft not found.", { status: 404 });
  const characterId = validId(draft.document?.id);
  if (!characterId || draft.document?.build?.status !== "complete") {
    throw new CharacterBuildDraftError("Complete Character draft with valid Character ID is required.", { status: 400 });
  }
  if (localOnly) return finishLocally(draft, characterList);
  if (Object.hasOwn(storedCharacters(), characterId)) {
    throw new CharacterBuildDraftError("That character ID already exists in local recovery data.", { status: 409 });
  }
  try {
    const response = await cloudWrite(cloudPath(id, "finalize"), undefined, { method: "POST" });
    if (response?.id !== characterId || !response.document || typeof response.document !== "object") {
      throw new CharacterBuildDraftError("Cloud finalization returned an invalid Character document.", { status: 502 });
    }
    const characters = storedCharacters();
    characters[response.id] = cloneJSON(response.document);
    writeJSON(CHARACTERS_STORAGE_KEY, characters);
    removeLocalDraft(id);
    return { ...response, cloudSaved: true, cloudError: null };
  } catch (cloudError) {
    writeLocalDraft({ ...draft, sync: { state: "failed", operation: "finalize", error: errorText(cloudError) } }, { now: draft.updatedAt });
    throw new CharacterBuildDraftError(errorText(cloudError), { status: cloudError?.status || 0, cause: cloudError });
  }
}

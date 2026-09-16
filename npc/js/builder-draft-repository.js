// Keeps rules-built NPC drafts campaign-scoped locally and finalizes through the existing NPC repository.
import { readJSON, writeJSON } from "../../shared/js/storage.js";
import { cloneJSON } from "../../shared/js/text.js";
import { normalizeCharacterBuildDraft } from "../../char/js/builder/draft-repository.js";
import { NPC_BUILD_DRAFTS_STORAGE_KEY } from "../../char/js/storage-keys.js";
import { createBuiltNpc } from "./repository.js";

export function storedNpcBuildDrafts() {
  const value = readJSON(NPC_BUILD_DRAFTS_STORAGE_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function writeNpcBuildDraft(value, now = new Date().toISOString()) {
  const drafts = storedNpcBuildDrafts();
  const draft = normalizeCharacterBuildDraft(value, { now, previous: drafts[value.draftId] });
  drafts[draft.draftId] = { ...draft, sync: { state: "saved", error: "" } };
  writeJSON(NPC_BUILD_DRAFTS_STORAGE_KEY, drafts);
  return cloneJSON(drafts[draft.draftId]);
}

export async function saveNpcBuildDraft(value, { now = () => new Date().toISOString() } = {}) {
  const draft = writeNpcBuildDraft(value, now());
  return { draft, cloudSaved: false, cloudError: null };
}

export function deleteNpcBuildDraft(draftId) {
  const drafts = storedNpcBuildDrafts();
  const deleted = Object.hasOwn(drafts, draftId);
  delete drafts[draftId];
  writeJSON(NPC_BUILD_DRAFTS_STORAGE_KEY, drafts);
  return deleted;
}

export async function finalizeNpcBuildDraft(draftId, { createNpc = createBuiltNpc } = {}) {
  const draft = storedNpcBuildDrafts()[String(draftId || "")];
  if (!draft) throw new Error("NPC build draft not found.");
  if (draft.document?.build?.mode !== "rules" || draft.document?.build?.status !== "complete") {
    throw new Error("Complete rules-built NPC draft is required.");
  }
  const result = await createNpc(draft.document);
  deleteNpcBuildDraft(draftId);
  return result;
}

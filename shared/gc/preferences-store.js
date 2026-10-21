import { normalizeUiPreferences, changeUiPreferences, uiStorageKey } from "./preferences-model.js";

// Each instance owns one identity. A response may never clear a newer pending edit.
export function createUiPreferenceStore({ userId, storage, request, localOnly = false, onChange = () => {} }) {
  const key = uiStorageKey(userId);
  let cached;
  try { cached = JSON.parse(storage?.getItem(key) || "null"); } catch { cached = null; }
  let preferences = normalizeUiPreferences(cached?.preferences);
  let pending = cached?.pending === true;
  let editId = cached?.editId || "";
  let revision = 0;
  let queue = Promise.resolve();
  let status = "local";
  let message = "";
  const snapshot = () => ({ preferences: normalizeUiPreferences(preferences), pending, status, message });
  const notify = () => onChange(snapshot());
  function persist() {
    try { storage?.setItem(key, JSON.stringify({ preferences, pending, editId })); }
    catch { message = "Browser storage unavailable. Keep this page open until account sync succeeds."; }
  }
  function adoptExternalEdit() {
    try {
      const next = JSON.parse(storage?.getItem(key) || "null");
      if (!next?.editId || next.editId === editId) return false;
      preferences = normalizeUiPreferences(next.preferences);
      pending = next.pending === true;
      editId = next.editId;
      revision += 1;
      status = pending ? "saving" : localOnly ? "local" : "synced";
      return true;
    } catch { return false; }
  }
  async function send() {
    const sentRevision = revision;
    const sent = normalizeUiPreferences(preferences);
    status = "saving";
    notify();
    try {
      const result = await request("PUT", sent);
      if (revision === sentRevision && !adoptExternalEdit()) {
        preferences = normalizeUiPreferences(result.preferences);
        pending = false;
        status = "synced";
        message = "Appearance saved to your account.";
        persist();
      }
    } catch (error) {
      if (!adoptExternalEdit()) {
        status = "error";
        message = `${error.message} Your choice is kept in this browser; retry when connected.`;
        persist();
      }
    }
    notify();
    return snapshot();
  }
  function retry() {
    if (localOnly || !pending) return Promise.resolve(snapshot());
    queue = queue.then(send, send);
    return queue;
  }
  async function load() {
    if (localOnly) { notify(); return snapshot(); }
    const startRevision = revision;
    try {
      const result = await request("GET");
      adoptExternalEdit();
      if (!pending && startRevision === revision) {
        preferences = normalizeUiPreferences(result.preferences);
        status = "synced";
        persist();
        notify();
      }
    } catch (error) {
      status = "error";
      message = `${error.message} Using this browser's appearance settings.`;
      notify();
    }
    if (pending) await retry();
    return snapshot();
  }
  function update(changes) {
    preferences = changeUiPreferences(preferences, changes);
    revision += 1;
    editId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    pending = !localOnly;
    status = localOnly ? "local" : "saving";
    message = localOnly ? "Appearance saved in this browser." : "Saving appearance…";
    persist();
    notify();
    return retry();
  }
  function refreshFromStorage() {
    if (pending) return snapshot();
    try {
      const next = JSON.parse(storage?.getItem(key) || "null");
      preferences = normalizeUiPreferences(next?.preferences);
      pending = next?.pending === true;
      editId = next?.editId || "";
      revision += 1;
      status = pending ? "saving" : localOnly ? "local" : "synced";
      notify();
    } catch { /* A partial or unavailable cache must not replace current settings. */ }
    return snapshot();
  }
  return { snapshot, load, update, retry, refreshFromStorage };
}

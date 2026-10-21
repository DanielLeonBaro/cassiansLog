import { currentSession } from "../js/auth-client.js";
import { isLocalRuntimeHost } from "../js/runtime-host.js";
import { createUiPreferenceStore } from "./preferences-store.js";
import { normalizeUiPreferences, resolveDensity, uiStorageKey } from "./preferences-model.js";

let store;
let pageId = "";
let activeStorageKey = "";
let preferences = normalizeUiPreferences();
let state = { preferences, status: "local", pending: false, message: "" };

export function currentUiPreferences() { return normalizeUiPreferences(preferences); }
export function currentUiState() { return state; }

export function applyUiPage(id) {
  pageId = id || document.body?.dataset.gcPage || pageId;
  document.documentElement.dataset.density = resolveDensity(preferences, pageId);
  document.documentElement.dataset.sidebarCollapsed = String(preferences.sidebarCollapsed);
  if (document.body) {
    document.body.classList.add("gc-ui");
    document.body.dataset.gcPage = pageId;
  }
}

function publish(next) {
  state = next;
  preferences = next.preferences;
  applyUiPage();
  document.dispatchEvent(new CustomEvent("cassianslog:ui-preferences", { detail: next }));
}

async function request(method, value) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/auth/ui-preferences", {
      method, signal: controller.signal,
      headers: { accept: "application/json", ...(value ? { "content-type": "application/json" } : {}) },
      ...(value ? { body: JSON.stringify(value) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Appearance could not sync (${response.status}).`);
    return result;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Appearance sync timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const uiPreferencesReady = typeof document === "undefined" ? Promise.resolve(currentUiPreferences()) : (async () => {
  const { user } = await currentSession();
  let storage;
  try { storage = globalThis.localStorage; } catch { storage = null; }
  store = createUiPreferenceStore({
    userId: user?.id, storage, request,
    localOnly: !user || user.localBypass || isLocalRuntimeHost(), onChange: publish,
  });
  activeStorageKey = uiStorageKey(user?.id);
  publish(store.snapshot());
  // Cached settings render immediately; the promise resolves after D1 reconciliation.
  await store.load();
  return currentUiPreferences();
})();

export async function updateUiPreferences(changes) {
  await uiPreferencesReady;
  return store.update(changes);
}

export async function retryUiPreferences() {
  await uiPreferencesReady;
  return store.snapshot().pending ? store.retry() : store.load();
}

if (typeof window !== "undefined") {
  document.addEventListener("cassianslog:ui-page", (event) => {
    applyUiPage(event.detail.id);
    document.dispatchEvent(new CustomEvent("cassianslog:ui-preferences", { detail: state }));
  });
  window.addEventListener("online", () => { void retryUiPreferences(); });
  window.addEventListener("storage", (event) => {
    // A local pending edit remains authoritative until its own save finishes.
    if (!state.pending && event.key === activeStorageKey) store?.refreshFromStorage();
  });
}

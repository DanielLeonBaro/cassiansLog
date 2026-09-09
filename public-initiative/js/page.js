// Loads and renders the shared read-only Public Initiative snapshot.
import { readCloudJSON } from "../../shared/js/cloud-store.js";
import { isLocalRuntimeHost } from "../../shared/js/runtime-host.js";
import { localInitiativeNames } from "./api.js";

export function renderNames(list, names) {
  list.replaceChildren(...names.map((name, index) => {
    const item = document.createElement("li");
    item.className = "flex items-center gap-4 rounded-xl border border-stone-300 bg-parchment px-5 py-4 font-display text-2xl font-bold shadow-sm dark:border-white/10 dark:bg-stone-900";
    const badge = document.createElement("span");
    badge.className = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blood-500 font-sans text-base font-bold text-on-accent";
    badge.textContent = String(index + 1);
    badge.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = name;
    item.append(badge, label);
    return item;
  }));
}

export async function initializePublicInitiative() {
  const list = document.getElementById("initiative-list");
  const status = document.getElementById("initiative-status");
  if (!list || !status) return;

  try {
    const snapshot = isLocalRuntimeHost()
      ? { names: localInitiativeNames() }
      : await readCloudJSON("api/public-initiative", { fallback: null });
    if (!snapshot || !Array.isArray(snapshot.names)) throw new Error("The shared initiative is unavailable.");

    const names = snapshot.names;
    renderNames(list, names);
    status.textContent = "No initiative entries yet.";
    status.hidden = names.length > 0;
  } catch (error) {
    console.error("Could not load public initiative:", error);
    renderNames(list, []);
    status.textContent = "Initiative is unavailable. Refresh the page to try again.";
    status.hidden = false;
  }
}

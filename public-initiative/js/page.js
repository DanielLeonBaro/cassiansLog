// Loads and renders the shared read-only Public Initiative snapshot.
import { readCloudJSON } from "../../shared/js/cloud-store.js";
import { isLocalRuntimeHost } from "../../shared/js/runtime-host.js";
import { trackerLinkHref } from "../../shared/js/tracker-link.js";
import { localInitiativeEntries } from "./api.js";

export function renderEntries(list, entries) {
  list.replaceChildren(...entries.map((entry, index) => {
    const item = document.createElement("li");
    item.className = "flex items-center gap-4 rounded-xl border border-stone-300 bg-parchment px-5 py-4 font-display text-2xl font-bold shadow-sm dark:border-white/10 dark:bg-stone-900";
    const badge = document.createElement("span");
    badge.className = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blood-500 font-sans text-base font-bold text-on-accent";
    badge.textContent = String(index + 1);
    badge.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "min-w-0 grow";
    label.textContent = entry.name;
    item.append(badge, label);
    const href = trackerLinkHref(entry.characterLink);
    if (href) {
      const link = document.createElement("a");
      link.className = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blood-500 transition hover:bg-blood-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood-500";
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener";
      link.setAttribute("aria-label", "Open linked tracker in a new tab");
      link.title = "Open linked tracker";
      const icon = document.createElement("i");
      icon.className = "bi bi-box-arrow-up-right";
      icon.setAttribute("aria-hidden", "true");
      link.append(icon);
      item.append(link);
    }
    return item;
  }));
}

export function renderNames(list, names) {
  return renderEntries(list, names.map((name) => ({ name })));
}

export async function initializePublicInitiative() {
  const list = document.getElementById("initiative-list");
  const status = document.getElementById("initiative-status");
  if (!list || !status) return;

  try {
    const snapshot = isLocalRuntimeHost()
      ? { entries: localInitiativeEntries() }
      : await readCloudJSON("api/public-initiative", { fallback: null });
    if (!snapshot || (!Array.isArray(snapshot.entries) && !Array.isArray(snapshot.names))) {
      throw new Error("The shared initiative is unavailable.");
    }

    const entries = Array.isArray(snapshot.entries)
      ? snapshot.entries
      : snapshot.names.map((name) => ({ name }));
    renderEntries(list, entries);
    status.textContent = "No initiative entries yet.";
    status.hidden = entries.length > 0;
  } catch (error) {
    console.error("Could not load public initiative:", error);
    renderEntries(list, []);
    status.textContent = "Initiative is unavailable. Refresh the page to try again.";
    status.hidden = false;
  }
}

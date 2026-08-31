// Loads and renders the shared read-only Public Initiative snapshot.
import { readCloudJSON } from "../../shared/js/cloud-store.js";

function renderNames(list, names) {
  list.replaceChildren(...names.map((name) => {
    const item = document.createElement("li");
    item.className = "rounded-xl border border-stone-300 bg-parchment px-5 py-4 font-display text-2xl font-bold shadow-sm dark:border-white/10 dark:bg-stone-900";
    item.textContent = name;
    return item;
  }));
}

export async function initializePublicInitiative() {
  const list = document.getElementById("initiative-list");
  const status = document.getElementById("initiative-status");
  if (!list || !status) return;

  try {
    const snapshot = await readCloudJSON("api/public-initiative", { fallback: null });
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

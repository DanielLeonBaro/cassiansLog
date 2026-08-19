import { initializeTrackerHeader } from "../tracker/header.js";
import { applyCharacterSheetLayout } from "../tracker/layout.js";
import { runtimeSettingsReady } from "../../../shared/js/settings.js";

function showError(message) {
  document.body.innerHTML = `<main class="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8"><div class="rounded-2xl border border-blood-500/30 bg-blood-500/10 p-4 text-blood-600 dark:text-red-300">${message}</div></main>`;
}

const requested = new URLSearchParams(location.search).get("character") || "cassian";
const characterName = /^[a-z0-9-]+$/i.test(requested) ? requested : "cassian";
try {
  const [response, settings] = await Promise.all([
    fetch(new URL(`../../${characterName}/character.json`, import.meta.url)),
    runtimeSettingsReady,
  ]);
  if (!response.ok) throw new Error(`Could not load the character data (${response.status}).`);
  window.character = await response.json();
  document.body.dataset.characterShell = characterName;
  applyCharacterSheetLayout(settings, characterName);
  initializeTrackerHeader();
  await import("./tracker.js");
} catch (error) {
  console.error("Could not load standalone tracker:", error);
  showError(error.message);
}

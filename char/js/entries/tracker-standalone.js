// Starts the standalone tracker shell used outside a routed character page.
import { initializeTrackerHeader } from "../tracker/header.js";
import { applyCharacterSheetLayout } from "../tracker/layout.js";
import { runtimeSettingsReady } from "../../../shared/js/settings.js";
import { renderCharacterLoadError } from "../load-error.js";

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
  renderCharacterLoadError(error.message);
}

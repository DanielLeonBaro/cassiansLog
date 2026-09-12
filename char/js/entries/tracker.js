// Starts tracker behavior and connects focused character-editor actions.
import { initializeCharacterEditor } from "../editor/index.js";
import {
  character,
  initializeTracker,
  normalizeSpellcastingData,
  refreshUI,
} from "../tracker/index.js";

initializeTracker();
if (document.body.dataset.characterCanEdit === "false") {
  document.getElementById("notesSection")?.remove();
  const readOnlyControls = document.body.dataset.trackerKind === "npc"
    ? "main [data-tracker-action], #hp-controls button, #hp-controls input, #temp-hp-controls button, #temp-hp-controls input, #shortRest-btn, #longRest-btn"
    : "main button, main input, main select, main textarea";
  document.querySelectorAll(readOnlyControls).forEach((control) => { control.disabled = true; });
  const notice = document.createElement("p");
  notice.className = "mx-auto mb-4 max-w-7xl rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold";
  notice.textContent = document.body.dataset.trackerKind === "npc"
    ? "Player view. Only information revealed by a campaign DM is included."
    : "Read-only character. A campaign DM can assign you as an editor.";
  document.querySelector("main")?.prepend(notice);
} else {
  initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI });
}

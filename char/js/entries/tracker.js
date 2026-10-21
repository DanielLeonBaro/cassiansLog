// Starts tracker behavior and connects focused character-editor actions.
import { initializeCharacterEditor } from "../editor/index.js";
import {
  character,
  initializeTracker,
  normalizeSpellcastingData,
  refreshUI,
} from "../tracker/index.js";

await initializeTracker();
if (document.body.dataset.characterCanEdit === "false") {
  const editorToggle = document.getElementById("edit-character-toggle");
  if (editorToggle) editorToggle.disabled = true;
  document.getElementById("notesSection")?.remove();
  const v4 = (["v4", "v5", "v6"].includes(document.documentElement.dataset.characterSheetStyle));
  const readOnlyControls = v4
    ? 'main [data-tracker-action]:not([data-tracker-action="reset-filters"]):not([data-tracker-action="reset-spell-filters"]):not([data-tracker-action="reset-inventory-filters"]):not([data-tracker-action="open-v4-detail"]), main [data-v4-inventory-container], #hp-controls button, #hp-controls input, #temp-hp-controls button, #temp-hp-controls input, #v4-condition-form button, #v4-condition-form input, #shortRest-btn, #longRest-btn, main .character-tracker, main [data-character-editor-section]'
    : document.body.dataset.trackerKind === "npc"
      ? "main [data-tracker-action], #hp-controls button, #hp-controls input, #temp-hp-controls button, #temp-hp-controls input, #shortRest-btn, #longRest-btn"
    : "main button:not([data-roll-formula]), main input, main select, main textarea";
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

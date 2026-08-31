// Starts tracker behavior and connects focused character-editor actions.
import { initializeCharacterEditor } from "../editor/index.js";
import {
  character,
  initializeTracker,
  normalizeSpellcastingData,
  refreshUI,
} from "../tracker/index.js";

initializeTracker();
initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI });

import { initializeCharacterEditor } from "../character-editor.js";
import {
  character,
  initializeTracker,
  normalizeSpellcastingData,
  refreshUI,
} from "../script.js";

initializeTracker();
initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI });

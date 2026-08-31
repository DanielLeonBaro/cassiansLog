// Builds tracker navigation and mounts shared header, theme, and dice controls.
import { mountSiteHeader } from "../../../shared/js/site-header.js";
import { initializeTheme } from "../../../shared/js/theme.js";
import { initializeDiceRoller } from "../../../shared/js/dice/index.js";
import { placeCharacterSheetHeaderActions } from "./layout.js";

const button = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold text-white shadow-sm transition";
const jumpItems = [
  ["character-overview", "bodyStart", "bi-person-fill", "Character"],
  ["character-stats", "quickStats", "bi-bar-chart-fill", "Stats"],
  ["hit-points", "hpManager", "bi-heart-fill", "HP"],
  ["combat", "combatResources", "bi-hourglass-split", "Combat"],
  ["spellcasting", "spellcastingSection", "bi-magic", "Spellcasting"],
  ["prepared-spells", "preparedSpellsSection", "bi-journal-check", "Prepared Spells"],
  ["all-possibilities", "allPossibilities", "bi-stars", "All Possibilities"],
  ["inventory", "inventoryAccordion", "bi-backpack-fill", "Inventory"],
  ["notes", "notesSection", "bi-pen-fill", "Notes"],
];

function trackerActions() {
  const jumps = jumpItems.map(([section, target, icon, label]) =>
    `<button class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-blood-500 transition hover:bg-blood-500/10" type="button" data-scroll-to="${target}" data-section-link="${section}"><i class="bi ${icon}"></i>${label}</button>`,
  ).join("");
  return {
    start: `<button id="shortRest-btn" type="button" class="${button} border-stone-600 bg-stone-600 hover:bg-stone-700" aria-label="Take a short rest"><i class="bi bi-moon-fill"></i><span class="hidden md:inline">Short rest</span></button><button id="longRest-btn" type="button" class="${button} border-emerald-700 bg-emerald-700 hover:bg-emerald-800" aria-label="Take a long rest"><i class="bi bi-moon-stars-fill"></i><span class="hidden md:inline">Long rest</span></button>`,
    end: `<div id="editor-toggle-slot"></div><div class="relative" role="group"><button id="navigation-menu-button" type="button" class="${button} border-blood-500 bg-blood-500 hover:bg-blood-600" aria-expanded="false" aria-controls="navigation-menu"><i class="bi bi-compass-fill"></i><span class="hidden sm:inline">Jump to</span></button><div id="navigation-menu" class="absolute right-0 mt-2 hidden min-w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-stone-900" aria-labelledby="navigation-menu-button">${jumps}</div></div>`,
  };
}

export function initializeTrackerHeader() {
  mountSiteHeader({ tracker: true, actions: trackerActions() });
  placeCharacterSheetHeaderActions();
  initializeTheme();
  initializeDiceRoller();
}

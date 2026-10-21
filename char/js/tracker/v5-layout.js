// V5 rearranges the existing V4 rendering engine's live nodes, never copies controls.
import { applyV4CharacterSheetLayout, activateV4Tab } from "./v4-layout.js";

export const V5_TAB_DEFINITIONS = Object.freeze([
  { id: "overview", label: "Overview", icon: "bi-person-lines-fill" },
  { id: "actions", label: "Actions", icon: "bi-lightning-charge-fill" },
  { id: "spells", label: "Spells", icon: "bi-magic" },
  { id: "inventory", label: "Inventory", icon: "bi-backpack-fill" },
  { id: "features", label: "Features", icon: "bi-stars" },
  { id: "extras", label: "Extras", icon: "bi-people-fill" },
  { id: "notes", label: "Notes", icon: "bi-pen-fill" },
].map(Object.freeze));

export function applyV5CharacterSheetLayout() {
  if (!applyV4CharacterSheetLayout({ definitions: V5_TAB_DEFINITIONS })) return false;
  const sheet = document.getElementById("v4-sheet");
  if (sheet.dataset.gcTracker === "v5") return true;
  sheet.dataset.gcTracker = "v5";
  const core = document.getElementById("v4-core");
  const overview = document.getElementById("v4-panel-overview");
  const notes = document.getElementById("v4-panel-notes");
  const grid = document.getElementById("v4-core-grid");
  const quickStats = document.getElementById("quickStatsCard");
  const hp = document.getElementById("hpManager");
  const identity = document.getElementById("characterDescription");
  const flags = identity.querySelector('[aria-label="Character status"]');
  if (flags) document.getElementById("v4-character-actions")?.appendChild(flags);
  const identityDetails = document.createElement("section");
  identityDetails.className = "gc-panel p-4 gc-stack";
  identityDetails.innerHTML = "<h2>Identity details</h2>";
  for (const id of ["character-background", "character-alignment"]) {
    const paragraph = identity.querySelector(`#${id}`)?.closest("p");
    if (paragraph) identityDetails.appendChild(paragraph);
  }
  overview.appendChild(identityDetails);
  const vitals = document.createElement("div");
  vitals.className = "v5-persistent-vitals";
  [quickStats, hp].filter(Boolean).forEach((node) => vitals.appendChild(node));
  core.appendChild(vitals);
  const resourceSummary = document.createElement("div");
  resourceSummary.id = "v5-resource-summary";
  resourceSummary.className = "v5-resource-summary";
  resourceSummary.setAttribute("aria-label", "Resource summary");
  resourceSummary.setAttribute("aria-live", "polite");
  core.appendChild(resourceSummary);
  if (grid) overview.appendChild(grid);
  const background = document.getElementById("v4-background-section");
  if (background) overview.appendChild(background);
  const notesHost = document.getElementById("v4-notes-host");
  if (notesHost) notes.appendChild(notesHost);
  document.getElementById("v4-secondary")?.remove();
  document.getElementById("v4-tabs")?.classList.add("gc-tabs");
  activateV4Tab("overview");
  const targets = {
    bodyStart: "overview", quickStats: "overview", hpManager: "overview", combatResources: "actions",
    spellcastingSection: "spells", preparedSpellsSection: "spells", allPossibilities: "features",
    inventoryAccordion: "inventory", notesSection: "notes",
  };
  document.addEventListener("click", (event) => {
    const jump = event.target.closest?.("[data-scroll-to]");
    if (targets[jump?.dataset.scrollTo]) activateV4Tab(targets[jump.dataset.scrollTo]);
  }, true);
  return true;
}

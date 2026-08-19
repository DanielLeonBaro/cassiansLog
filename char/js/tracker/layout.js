import { resolveCharacterSheetStyle } from "../../../shared/js/settings.js";

const desktopQuery = window.matchMedia("(min-width: 1024px)");
const tabDefinitions = [
  { id: "stats", label: "Stats", icon: "bi-bar-chart-fill" },
  { id: "combat", label: "Combat", icon: "bi-shield-fill" },
  { id: "spellcasting", label: "Spellcasting", icon: "bi-magic" },
  { id: "possibilities", label: "Possibilities", icon: "bi-stars" },
  { id: "inventory", label: "Inventory", icon: "bi-backpack-fill" },
  { id: "notes", label: "Notes", icon: "bi-pen-fill" },
];
const targetTabs = {
  quickStats: "stats",
  hpManager: "combat",
  combatResources: "combat",
  spellcastingSection: "spellcasting",
  preparedSpellsSection: "spellcasting",
  allPossibilities: "possibilities",
  inventoryAccordion: "inventory",
  notesSection: "notes",
};
const sectionElements = {
  "character-overview": ["characterDescription"],
  "character-stats": ["quickStatsCard", "combatAccordion"],
  "hit-points": ["hpManager", "death-saves-section"],
  combat: ["combatResources"],
  spellcasting: ["spellcastingSection"],
  "prepared-spells": ["preparedSpellsSection"],
  "all-possibilities": ["allPossibilities"],
  inventory: ["inventory-page"],
  notes: ["notesSection"],
};

let controller = null;

function createPanel(id) {
  const panel = document.createElement("section");
  panel.id = `v2-panel-${id}`;
  panel.className = "v2-sheet-panel";
  panel.dataset.sheetPanel = id;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `v2-tab-${id}`);
  panel.tabIndex = 0;
  return panel;
}

function createTabs() {
  const tablist = document.createElement("div");
  tablist.id = "v2-sheet-tabs";
  tablist.className = "v2-sheet-tabs";
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Character sheet sections");
  tabDefinitions.forEach(({ id, label, icon }) => {
    const button = document.createElement("button");
    button.id = `v2-tab-${id}`;
    button.className = "v2-sheet-tab";
    button.type = "button";
    button.dataset.sheetTab = id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `v2-panel-${id}`);
    button.setAttribute("aria-selected", "false");
    button.tabIndex = -1;
    button.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    tablist.appendChild(button);
  });
  return tablist;
}

function applyConfiguredSections(sections) {
  Object.entries(sectionElements).forEach(([section, ids]) => {
    const disabled = sections?.[section] === false;
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.hidden = disabled;
      if (disabled) element.dataset.sheetSectionDisabled = "true";
      else delete element.dataset.sheetSectionDisabled;
    });
  });
}

function panelHasContent(panel) {
  if (!panel || panel.dataset.sheetSectionDisabled === "true") return false;
  return [...panel.children].some((child) => (
    child.dataset.sheetSectionDisabled !== "true" &&
    !child.hidden &&
    !child.classList.contains("hidden")
  ));
}

function availableTabIds() {
  return tabDefinitions
    .map(({ id }) => id)
    .filter((id) => controller.available.get(id));
}

function fallbackTab() {
  const available = availableTabIds();
  if (available.includes("combat")) return "combat";
  return available[0] || null;
}

export function chooseCharacterSheetTab({ requested, available, desktop = false, lastWorkspace = "combat" }) {
  const ids = tabDefinitions.map(({ id }) => id).filter((id) => available.includes(id));
  const fallback = ids.includes("combat") ? "combat" : ids[0] || null;
  let selected = ids.includes(requested) ? requested : fallback;
  if (desktop && selected === "stats") {
    selected = ids.includes(lastWorkspace) && lastWorkspace !== "stats"
      ? lastWorkspace
      : ids.find((id) => id !== "stats") || "stats";
  }
  return selected;
}

function renderActiveTab() {
  if (!controller) return;
  const desktop = desktopQuery.matches;
  const fallback = fallbackTab();
  if (!fallback) return;
  controller.activeTab = chooseCharacterSheetTab({
    requested: controller.activeTab,
    available: availableTabIds(),
    desktop,
    lastWorkspace: controller.lastWorkspaceTab,
  });
  if (controller.activeTab !== "stats") controller.lastWorkspaceTab = controller.activeTab;

  controller.tabs.forEach((tab, id) => {
    const available = controller.available.get(id);
    const desktopStats = desktop && id === "stats";
    tab.hidden = !available || desktopStats;
    const selected = !desktopStats && id === controller.activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  controller.panels.forEach((panel, id) => {
    const available = controller.available.get(id);
    panel.hidden = !available || (desktop
      ? id !== "stats" && id !== controller.activeTab
      : id !== controller.activeTab);
  });
}

export function activateCharacterSheetTab(id, { focus = false } = {}) {
  if (!controller || !controller.available.get(id)) return false;
  if (desktopQuery.matches && id === "stats") {
    controller.panels.get("stats")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }
  controller.activeTab = id;
  if (id !== "stats") controller.lastWorkspaceTab = id;
  renderActiveTab();
  if (focus) controller.tabs.get(id)?.focus();
  return true;
}

export function refreshCharacterSheetTabs() {
  if (!controller) return;
  controller.panels.forEach((panel, id) => {
    controller.available.set(id, panelHasContent(panel));
  });
  renderActiveTab();
}

export function placeCharacterSheetHeaderActions() {
  if (!controller) return;
  const host = document.getElementById("v2-character-actions");
  if (!host) return;
  ["shortRest-btn", "longRest-btn", "editor-toggle-slot"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) host.appendChild(element);
  });
}

function handleTabKeydown(event) {
  if (!controller || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = availableTabIds()
    .map((id) => controller.tabs.get(id))
    .filter((tab) => tab && !tab.hidden);
  if (!tabs.length) return;
  const currentIndex = Math.max(0, tabs.indexOf(event.target));
  const nextIndex = event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  activateCharacterSheetTab(tabs[nextIndex].dataset.sheetTab, { focus: true });
}

function handleJump(event) {
  const jump = event.target.closest?.("[data-scroll-to]");
  const tab = targetTabs[jump?.dataset.scrollTo];
  if (tab) activateCharacterSheetTab(tab);
}

export function applyCharacterSheetLayout(settings = {}, characterId = "") {
  const style = resolveCharacterSheetStyle(settings, characterId);
  document.documentElement.dataset.characterSheetStyle = style;
  if (style !== "v2" || controller) return style;

  const combatPage = document.getElementById("combat-page");
  const characterDescription = document.getElementById("characterDescription");
  const quickStatsCard = document.getElementById("quickStatsCard");
  const statsSection = document.getElementById("combatAccordion");
  if (!combatPage || !characterDescription || !quickStatsCard || !statsSection) return "v1";

  applyConfiguredSections(settings.sections || {});

  const actionsHost = document.createElement("div");
  actionsHost.id = "v2-character-actions";
  actionsHost.className = "v2-character-actions";
  characterDescription.querySelector(".p-5 > div")?.appendChild(actionsHost);

  const combatPanel = createPanel("combat");
  combatPanel.append(
    document.getElementById("hpManager"),
    document.getElementById("death-saves-section"),
    document.getElementById("combatResources"),
  );
  const spellcastingPanel = createPanel("spellcasting");
  spellcastingPanel.append(
    document.getElementById("spellcastingSection"),
    document.getElementById("preparedSpellsSection"),
  );
  const possibilitiesPanel = createPanel("possibilities");
  possibilitiesPanel.append(document.getElementById("allPossibilities"));
  const inventoryPanel = createPanel("inventory");
  inventoryPanel.append(document.getElementById("inventory-page"));
  const notesPanel = createPanel("notes");
  notesPanel.append(document.getElementById("notesSection"));
  const statsPanel = createPanel("stats");
  statsPanel.classList.add("v2-stats-panel");
  statsPanel.append(statsSection);

  const tablist = createTabs();
  const layout = document.createElement("div");
  layout.id = "v2-sheet-layout";
  layout.className = "v2-sheet-layout";
  const workspace = document.createElement("div");
  workspace.id = "v2-sheet-workspace";
  workspace.className = "v2-sheet-workspace";
  workspace.append(combatPanel, spellcastingPanel, possibilitiesPanel, inventoryPanel, notesPanel);
  layout.append(statsPanel, workspace);
  combatPage.replaceChildren(characterDescription, quickStatsCard, tablist, layout);

  controller = {
    activeTab: "combat",
    lastWorkspaceTab: "combat",
    available: new Map(),
    panels: new Map([
      ["stats", statsPanel],
      ["combat", combatPanel],
      ["spellcasting", spellcastingPanel],
      ["possibilities", possibilitiesPanel],
      ["inventory", inventoryPanel],
      ["notes", notesPanel],
    ]),
    tabs: new Map([...tablist.querySelectorAll("[data-sheet-tab]")]
      .map((tab) => [tab.dataset.sheetTab, tab])),
  };

  tablist.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-sheet-tab]");
    if (tab) activateCharacterSheetTab(tab.dataset.sheetTab);
  });
  tablist.addEventListener("keydown", handleTabKeydown);
  document.addEventListener("click", handleJump, true);
  desktopQuery.addEventListener("change", renderActiveTab);
  refreshCharacterSheetTabs();
  return style;
}

export function tabForScrollTarget(target) {
  return targetTabs[target] || null;
}

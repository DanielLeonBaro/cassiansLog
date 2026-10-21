// Combat Desk adapts the shared live tracker nodes and confirmed-use handlers.
import { applyV4CharacterSheetLayout, activateV4Tab, v4SummaryModel } from "./v4-layout.js";
import { escapeHTML as escape } from "../../../shared/js/text.js";
import { currentSession } from "../../../shared/js/auth-client.js";
import { currentCampaignSlug } from "../../../shared/js/campaign-context.js";
import { renderRollButton, renderRollableText, attackRollFormula, damageRollFormula } from "./rolls.js";
import { combatRecordKey, combatTiming, createCombatDeskState, partitionCombatRecords } from "./v6-model.js";

const definitions = [
  ["actions", "Combat", "bi-lightning-charge-fill"], ["resources", "Resources", "bi-battery-half"],
  ["sheet", "Sheet", "bi-person-lines-fill"], ["more", "More", "bi-three-dots"],
  ["spells", "Spells", "bi-magic"], ["inventory", "Inventory", "bi-backpack-fill"],
  ["features", "Features", "bi-stars"], ["extras", "Extras", "bi-people-fill"], ["notes", "Notes", "bi-pen-fill"],
].map(([id, label, icon]) => ({ id, label, icon }));
const primary = ["actions", "resources", "sheet", "more"];
let desk;
let callbacks;
let timing = "";
let activePanel = "actions";
const isDesk = () => document.documentElement.dataset.characterSheetStyle === "v6";
const get = (id) => document.getElementById(id);
const editable = () => document.body.dataset.characterCanEdit !== "false";

function syncNavigation(id = activePanel) {
  activePanel = id;
  get("v4-sheet").dataset.v6Panel = id;
  const selected = primary.includes(id) ? id : "more";
  definitions.forEach(({ id: tabId }) => {
    const tab = get(`v4-tab-${tabId}`);
    tab.hidden = !primary.includes(tabId);
    tab.setAttribute("aria-selected", String(tabId === selected));
    tab.tabIndex = tabId === selected ? 0 : -1;
  });
  get("v4-tab-more").setAttribute("aria-controls", `v4-panel-${primary.includes(id) ? "more" : id}`);
  if (!primary.includes(id)) get(`v4-panel-${id}`).setAttribute("aria-labelledby", "v4-tab-more");
  // Desktop keeps the same live resource panel next to combat; no copied controls.
  if (id === "actions" && matchMedia("(min-width: 1024px)").matches) get("v4-panel-resources").hidden = false;
}

export function applyV6CharacterSheetLayout() {
  if (!applyV4CharacterSheetLayout({ definitions })) return false;
  const sheet = get("v4-sheet");
  sheet.dataset.gcTracker = "v6";
  const core = get("v4-core");
  const characterSheet = get("v4-panel-sheet");
  characterSheet.append(get("characterDescription"), get("v4-core-grid"), get("v4-background-section"));
  const notes = get("notesSection");
  if (notes) get("v4-panel-notes").append(notes);
  get("v4-secondary").remove();
  core.insertAdjacentHTML("beforeend", `<div class="v6-banner"><img id="v6-portrait" alt="" width="40" height="40"><div class="v6-identity"><span class="v6-kicker">Combat Desk</span><strong id="v6-name"></strong></div><button type="button" data-v6-manage="hpManager" aria-label="Manage hit points"><span>HP</span><strong id="v6-hp"></strong></button><div class="v6-stat"><span>AC</span><strong id="v6-ac"></strong></div><div class="v6-stat"><span>Speed</span><strong id="v6-speed"></strong></div></div><button type="button" id="v6-conditions" data-v6-manage="v4-conditions"></button><div class="v6-turn-heading"><span class="v6-kicker">Your turn</span><button type="button" id="v6-guidance" aria-controls="v6-turn">Hide guidance</button></div><div id="v6-turn" class="v6-turn" role="group" aria-label="Advisory turn checklist">${[["action", "Action"], ["bonus", "Bonus"], ["reaction", "Reaction"]].map(([id, label]) => `<button type="button" data-v6-turn="${id}" aria-pressed="false"><span>${label}</span><strong>Available</strong></button>`).join("")}<button type="button" id="v6-start-turn">Start turn</button></div><p id="v6-status" class="sr-only" role="status" aria-live="polite"></p>`);
  get("v4-panel-resources").innerHTML = '<h2 class="v6-section-title">Resources</h2><div id="v6-pools"></div><div id="v6-rests" class="v6-rests"></div>';
  const resourcePanel = get("v4-panel-resources");
  ["trackers-card", "spellcastingSection"].forEach((id) => { const node = get(id); if (node) resourcePanel.append(node); });
  get("v4-panel-more").innerHTML = `<h2 class="v6-section-title">More tools</h2><div class="v6-more-links">${definitions.filter(({ id }) => !primary.includes(id)).map(({ id, label, icon }) => `<button type="button" data-v6-open="${id}"><i class="bi ${icon}" aria-hidden="true"></i>${label}<span aria-hidden="true">›</span></button>`).join("")}</div>`;
  get("v4-tabs").classList.add("v6-nav");
  get("v6-guidance").before(get("v6-start-turn"));
  document.addEventListener("tracker:v6-tab", (event) => syncNavigation(event.detail.id));
  matchMedia("(min-width: 1024px)").addEventListener("change", () => { activateV4Tab(activePanel); });
  document.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-scroll-to]");
    if (!jump) return;
    const targets = { bodyStart: "sheet", quickStats: "sheet", hpManager: "sheet", combatResources: "actions", spellcastingSection: "resources", preparedSpellsSection: "spells", allPossibilities: "features", inventoryAccordion: "inventory", notesSection: "notes" };
    if (targets[jump.dataset.scrollTo]) activateV4Tab(targets[jump.dataset.scrollTo]);
  }, true);
  activateV4Tab("actions");
  return true;
}

function safeStorage(name) { try { return globalThis[name]; } catch { return null; } }

export async function initializeV6Desk(options) {
  if (!isDesk()) return;
  callbacks = options;
  let user;
  try { ({ user } = await currentSession()); } catch { /* Anonymous memory preferences work with blocked storage. */ }
  desk = createCombatDeskState({ userId: user?.id, campaign: currentCampaignSlug(), kind: document.body.dataset.trackerKind || "character", entityId: options.character.id, local: safeStorage("localStorage"), session: safeStorage("sessionStorage"), canEdit: editable() });
  ["shortRest-btn", "longRest-btn"].forEach((id) => { const node = get(id); if (node) get("v6-rests").append(node); });
  document.addEventListener("click", (event) => {
    const pin = event.target.closest("[data-v6-pin]");
    if (pin) {
      const key = pin.dataset.v6Pin, inventory = Boolean(pin.closest("[data-v4-inventory-item]"));
      desk.togglePin(key); callbacks.reloadCombat(); callbacks.reloadInventory();
      [...document.querySelectorAll("[data-v6-pin]")].find((node) => node.dataset.v6Pin === key && Boolean(node.closest("[data-v4-inventory-item]")) === inventory)?.focus({ preventScroll: true });
      announce(desk.pins.has(key) ? "Pinned to combat." : "Removed from pinned options.");
      return;
    }
    const turn = event.target.closest("[data-v6-turn]");
    if (turn && editable() && desk.toggleTurn(turn.dataset.v6Turn)) { renderTurn(); announce("Turn checklist updated."); }
    const open = event.target.closest("[data-v6-open]");
    if (open) { activateV4Tab(open.dataset.v6Open); get(`v4-panel-${open.dataset.v6Open}`)?.focus(); }
    const manage = event.target.closest("[data-v6-manage]");
    if (manage) {
      activateV4Tab("sheet");
      const node = get(manage.dataset.v6Manage);
      node?.scrollIntoView({ block: "start" });
      node?.querySelector("input, button")?.focus({ preventScroll: true });
    }
    const filter = event.target.closest("[data-v6-timing]");
    if (filter) { timing = filter.dataset.v6Timing; callbacks.reloadCombat(); updateTimingButtons(); }
    const detail = event.target.closest("[data-v6-detail]");
    if (detail) openDetail(detail.dataset.v6Detail, detail);
  });
  get("v6-start-turn").addEventListener("click", () => { if (editable() && desk.startTurn()) { renderTurn(); announce("New turn. Action, bonus action, and reaction available. Resources unchanged."); } });
  get("v6-guidance").addEventListener("click", () => { desk.toggleGuidance(); renderTurn(); });
  // Keep focus inside existing confirmation/detail sheets without replacing their handlers.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const dialog = [...document.querySelectorAll('.v4-use-dialog.flex, .v4-detail-dialog.flex, #rest-dialog.flex')].find((node) => !node.classList.contains("hidden"));
    if (!dialog) return;
    const controls = [...dialog.querySelectorAll('button, input, select, textarea, a[href]')].filter((node) => !node.disabled && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  renderTurn();
}

function announce(message) { get("v6-status").textContent = message; }
function renderTurn() {
  if (!desk) return;
  get("v6-turn").hidden = !desk.guidance;
  get("v6-start-turn").hidden = !desk.guidance;
  get("v6-guidance").textContent = desk.guidance ? "Hide guidance" : "Show guidance";
  get("v6-guidance").setAttribute("aria-expanded", String(desk.guidance));
  document.querySelectorAll("[data-v6-turn]").forEach((button) => {
    const spent = desk.turn[button.dataset.v6Turn];
    button.setAttribute("aria-pressed", String(spent));
    button.querySelector("strong").textContent = spent ? "Used" : "Available";
    button.disabled = !editable();
  });
  get("v6-start-turn").disabled = !editable();
}

export function markV6Use(item, applied = true) {
  if (!isDesk() || !editable() || !desk?.recordUse(item, applied)) return;
  renderTurn();
  announce(`${item.name || "Option"} used. Turn checklist updated.`);
}

export function prepareV6Filters(container) {
  if (!isDesk()) return;
  const search = container.querySelector('[data-filter-key="search"]')?.closest("label");
  if (search) { search.classList.add("v6-search"); container.prepend(search); }
  const heading = container.querySelector('[data-collapse-target] .font-display');
  if (heading) heading.textContent = "Filters";
  container.insertAdjacentHTML("afterbegin", `<div class="v6-timing" role="group" aria-label="Filter combat timing">${[["", "All"], ["action", "Action"], ["bonus", "Bonus"], ["reaction", "Reaction"], ["other", "Other"]].map(([id, label]) => `<button type="button" data-v6-timing="${id}" aria-pressed="${id === timing}">${label}</button>`).join("")}</div>`);
  if (search) container.prepend(search);
}
function updateTimingButtons() {
  document.querySelectorAll("[data-v6-timing]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.v6Timing === timing)));
}
export function resetV6Timing() { timing = ""; if (isDesk()) updateTimingButtons(); }

export function v6PinButton(record) {
  if (!isDesk() || !desk) return "";
  const key = combatRecordKey(record), pinned = desk.pins.has(key);
  return `<button type="button" class="v6-pin" data-v6-pin="${escape(key)}" aria-pressed="${pinned}" aria-label="${pinned ? "Unpin" : "Pin"} ${escape(record.item.name || "option")}"><i class="bi bi-pin${pinned ? "-fill" : ""}" aria-hidden="true"></i></button>`;
}

function renderOption(record) {
  const { item, source, index } = record;
  const inventory = source === "inventory";
  const plan = inventory ? null : source === "spells" ? callbacks.planSpell(item.id) : callbacks.planAction(item.id);
  const status = inventory ? (item.charges ? `${item.charges.current}/${item.charges.max} charges` : "Inventory shortcut")
    : plan?.limited === false ? "At will" : plan?.message || "";
  const available = inventory ? Boolean(item.instanceId && item.charges?.current > 0) : plan?.canConfirm;
  const action = inventory ? "request-item-charge" : source === "spells" ? "request-spell-cast" : "request-use";
  const attributes = inventory ? `data-index="${index}"` : `data-id="${escape(item.id)}"`;
  const roll = (value, formula, label) => value ? formula ? renderRollButton({ formula, label: `${item.name} ${label}`, text: value }) : `<span>${escape(value)}</span>` : "";
  return `<article class="v6-option" data-v6-key="${escape(combatRecordKey(record))}"><div class="v6-option-heading"><button type="button" class="v6-option-name" data-v6-detail="${escape(combatRecordKey(record))}">${escape(item.name || "Unnamed option")}</button>${v6PinButton(record)}</div><div class="v6-option-facts"><span>${escape(item.action || "Other")}</span>${item.range ? `<span>${escape(item.range)}</span>` : ""}${roll(item.attack, attackRollFormula(item.attack), "Attack")}${roll(item.damage, damageRollFormula(item.damage), "Damage")}${item.save || item.dc ? `<span>${escape(item.save || `DC ${item.dc}`)}</span>` : ""}${item.concentration ? '<span>Concentration</span>' : ""}</div><div class="v6-option-footer"><span>${escape(status)}</span>${(!inventory || item.instanceId && item.charges) ? `<button type="button" data-tracker-action="${action}" ${attributes}${!editable() || !available ? " disabled" : ""}>${inventory ? "Use charge" : source === "spells" ? "Cast" : "Use"}</button>` : `<button type="button" data-v6-detail="${escape(combatRecordKey(record))}">Details</button>`}</div></article>`;
}

let detailReturn;
function openDetail(key, trigger) {
  const record = callbacks.records().find((item) => combatRecordKey(item) === key);
  if (!record) return;
  const { item } = record;
  detailReturn = trigger;
  get("v4-detail-title").textContent = item.name || "Details";
  get("v4-detail-eyebrow").textContent = item.category || record.source;
  get("v4-detail-content").innerHTML = `<p>${renderRollableText(item.description || "No description recorded.")}</p>${["action", "range", "attack", "damage", "duration", "components"].filter((id) => item[id]).map((id) => `<p><strong>${escape(id)}:</strong> ${escape(item[id])}</p>`).join("")}`;
  get("v4-detail-dialog").classList.remove("hidden");
  get("v4-detail-dialog").classList.add("flex");
  document.body.classList.add("overflow-hidden");
  get("v4-detail-close").focus();
}

export function restoreV6DetailFocus() {
  if (!isDesk() || !detailReturn) return;
  detailReturn.isConnected && detailReturn.focus(); detailReturn = null;
}

export function renderV6Combat(records) {
  if (!isDesk()) return false;
  if (!desk) return true;
  const container = get("resources-container");
  const { pinned, remaining } = partitionCombatRecords(records.filter((record) => record.source !== "inventory" || desk.pins.has(combatRecordKey(record))), desk.pins, timing);
  const focus = container.contains(document.activeElement) ? { key: document.activeElement.closest("[data-v6-key]")?.dataset.v6Key, pin: document.activeElement.hasAttribute("data-v6-pin"), action: document.activeElement.dataset.trackerAction, detail: document.activeElement.hasAttribute("data-v6-detail") } : null;
  const group = (label, items) => items.length ? `<section class="v6-option-group"><h2>${label} <span>${items.length}</span></h2>${items.map(renderOption).join("")}</section>` : "";
  container.innerHTML = group("Pinned", pinned) + group("Combat options", remaining) || '<p class="v6-empty">No matching combat options. Clear filters or add options through the editor.</p>';
  get("combat-filter-summary").textContent = `${pinned.length + remaining.length} options`;
  if (focus?.key) {
    const row = [...container.querySelectorAll("[data-v6-key]")].find((node) => node.dataset.v6Key === focus.key);
    row?.querySelector(focus.pin ? "[data-v6-pin]" : focus.action ? "[data-tracker-action]" : "[data-v6-detail]")?.focus({ preventScroll: true });
  }
  return true;
}

export function refreshV6Desk(character) {
  if (!isDesk()) return;
  const text = (id, value) => { get(id).textContent = value; };
  text("v6-name", character.name || "Character");
  text("v6-hp", `${character.hp.current}/${character.hp.max}${character.hp.temp ? ` +${character.hp.temp}` : ""}`);
  text("v6-ac", character.ac ?? "—"); text("v6-speed", `${character.walk || 0} ft`);
  const portrait = get("v6-portrait"), source = get("character-portrait")?.getAttribute("src");
  if (source && portrait.getAttribute("src") !== source) portrait.src = source;
  const conditions = v4SummaryModel(character).conditions;
  text("v6-conditions", conditions.length ? conditions.join(" · ") : "No conditions · Manage");
  const pools = [...(character.resources || []), ...(character.actions || []), ...(character.features || []), ...(character.spells || [])].filter((item) => item.uses);
  const labels = { short: "Short rest", long: "Long rest", turn: "Turn", manual: "Manual" };
  const focused = get("v6-pools").contains(document.activeElement) ? { id: document.activeElement.dataset.id, delta: document.activeElement.dataset.delta } : null;
  get("v6-pools").innerHTML = [...new Map(pools.map((item) => [item.id, item])).values()].map((item) => `<div class="v6-pool"><div><strong>${escape(item.name)}</strong><span>${escape(labels[item.uses.reset] || item.uses.reset || "Manual")}</span></div><div><button type="button" data-tracker-action="resource" data-id="${escape(item.id)}" data-delta="-1" aria-label="Decrease ${escape(item.name)}"${!editable() ? " disabled" : ""}>−</button><strong>${item.uses.current}/${item.uses.max}</strong><button type="button" data-tracker-action="resource" data-id="${escape(item.id)}" data-delta="1" aria-label="Increase ${escape(item.name)}"${!editable() ? " disabled" : ""}>+</button></div></div>`).join("") || '<p class="v6-empty">No limited-use pools recorded.</p>';
  if (focused) [...get("v6-pools").querySelectorAll("button")].find((node) => node.dataset.id === focused.id && node.dataset.delta === focused.delta)?.focus({ preventScroll: true });
  renderTurn();
}

// Presentation controller. All document operations go through the supplied adapter.
import { escapeHTML as escape } from "../../../shared/js/text.js";
import { rollDiceFormula } from "../../../shared/js/dice/formula.js";
import { SCREEN_NAVIGATION, SECTION_NAMES, PORTRAIT_FALLBACK, icon, button, unavailable, shell, description, summary, combatOverview, navigation, pageForVariant, conditions, toolbar, optionsList, resourceCounters, abilityTiles, skills, defenses, details, moreLinks, profile, noteContent, advancedFilters } from "./screen-view.js";

export function mountTrackerScreen(root, { adapter, variant = "v2.1", onAppearance = () => {}, onVariantChange = () => {} }) {
  variant = SCREEN_NAVIGATION[variant] ? variant : "v2.1";
  const state = { page: SCREEN_NAVIGATION[variant][0][0], query: "", timing: "", selected: "", selection: {}, pending: null, editingNote: null, advanced: {} };
  const scrollPositions = new Map(), queries = new Map();
  let returnFocus = "", toastTimer;
  const character = adapter.character;
  root.classList.add("tracker-app"); root.dataset.gcSkip = ""; root.dataset.variant = variant; root.dataset.kind = character.kind;
  root.innerHTML = shell(variant, character);
  document.querySelector("[data-site-header] .gc-skip-link")?.setAttribute("href", `${location.pathname}${location.search}#tracker-content`);
  const main = root.querySelector(".tracker-main"), dialog = root.querySelector("dialog"), dialogContent = dialog.firstElementChild;
  const wide = matchMedia("(min-width: 768px)");
  const nav = root.querySelector(".tracker-tabs");
  root.addEventListener("error", (event) => {
    if (event.target.matches?.("[data-tracker-portrait]") && event.target.src !== PORTRAIT_FALLBACK) event.target.src = PORTRAIT_FALLBACK;
  }, true);
  function notify(message) {
    const status = root.querySelector(".tracker-status");
    clearTimeout(toastTimer); status.hidden = false; status.textContent = message;
    toastTimer = setTimeout(() => { status.hidden = true; }, 4000);
  }
  function focusReturn() {
    [...root.querySelectorAll("[data-focus]")].find((node) => node.dataset.focus === returnFocus && node.getClientRects().length)?.focus({ preventScroll: true });
  }
  // Restore synchronously: the queued native close event can arrive after typing resumes.
  function closeDialog() { state.pending = null; state.pendingRest = null; dialog.close(); focusReturn(); }
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
  function modal(title, body, target) {
    if (target?.dataset.focus) returnFocus = target.dataset.focus;
    dialogContent.innerHTML = `<header class="tracker-dialog-header"><h2 id="tracker-dialog-title">${escape(title)}</h2>${button(icon("x-lg"), 'data-command="close-dialog" aria-label="Close"')}</header>${body}`;
    if (!dialog.open) dialog.showModal();
    dialogContent.querySelector("input, select, button")?.focus();
  }
  function renderDetail() {
    if (!wide.matches) return "";
    const record = adapter.record(state.selected);
    return record ? `<aside class="tracker-side-detail" aria-labelledby="tracker-detail-title"><header><span>Details</span>${button(icon("x-lg"), 'data-command="close-detail" aria-label="Close details"')}</header>${details(record, adapter)}</aside>`
      : `<aside class="tracker-side-detail tracker-resource-overview"><header><h2>At a glance</h2>${button("All resources", 'data-page="resources"')}</header>${resourceCounters(adapter)}<div class="tracker-side-conditions">${conditions(character) || '<span class="tracker-muted">No active conditions</span>'}</div>${button(`${icon("moon")} Take a rest`, 'data-command="rest"', "tracker-rest-link")}</aside>`;
  }
  function renderAuxiliary(page) {
    if (page === "resources") return `<div class="tracker-resources-page">${resourceCounters(adapter)}${button(`${icon("moon")} Take a rest`, 'data-command="rest"')}${button("Manage death saves", 'data-command="death-saves"')}</div>`;
    if (page === "features" || page === "extras") return `<div class="tracker-text-list">${(character[page] || []).map((item) => `<article><h2>${page === "features" ? button(escape(item.name), `data-detail="features:${escape(item.id)}" data-focus="detail:features:${escape(item.id)}"`, "tracker-feature-name") : escape(item.name)}</h2><p>${escape(item.description || "No description recorded.")}</p>${item.selections?.length ? `<ul>${item.selections.map(value => `<li>${escape(value)}</li>`).join("")}</ul>` : ""}${page === "extras" ? `<dl class="tracker-detail-facts">${["ac", "speed"].filter(key => item[key] !== undefined).map(key => `<div><dt>${escape(key)}</dt><dd>${escape(item[key])}</dd></div>`).join("")}</dl>${item.hp ? `<div class="tracker-extra-hp">${button("−", `data-extra-hp="${escape(item.id)}" data-delta="-1" aria-label="Decrease ${escape(item.name)} HP"${unavailable(adapter)}`)}<span>HP ${item.hp.current}/${item.hp.max}</span>${button("+", `data-extra-hp="${escape(item.id)}" data-delta="1" aria-label="Increase ${escape(item.name)} HP"${unavailable(adapter)}`)}</div>` : ""}` : ""}</article>`).join("") || '<p class="tracker-muted">None recorded.</p>'}</div>`;
    if (page === "notes") {
      const editing = character.notes[state.editingNote];
      return `<section class="tracker-notes">${character.notes.map((note, index) => `<article><h2>${escape(note.title)}</h2>${noteContent(note.body)}${adapter.canEdit && adapter.removeNote ? `<div class="tracker-note-actions">${button("Edit", `data-edit-note="${index}"`)}${button("Delete", `data-remove-note="${index}"`)}</div>` : ""}</article>`).join("") || '<p class="tracker-muted">No notes recorded.</p>'}${adapter.canEdit ? `<form data-note-form><h2>${editing ? "Edit note" : "Add a note"}</h2><label>Title<input name="title" required maxlength="100" value="${escape(editing?.title || "")}"></label><label>Note<textarea name="body" required rows="4">${escape(editing?.body || "")}</textarea></label><button type="submit">Save note</button></form>` : ""}</section>`;
    }
    if (page === "profile") return `<section class="tracker-profile">${profile(character)}<div class="tracker-flags">${["inspiration", "cinematic"].map((flag) => button(`${character[flag] ? icon("check2") : icon("plus")} ${flag}`, `data-flag="${flag}" aria-pressed="${Boolean(character[flag])}"${unavailable(adapter)}`)).join("")}</div>${button("Edit details", `data-command="edit"${unavailable(adapter)}`)}${adapter.openConversion ? button("Rules automation", `data-command="conversion"${unavailable(adapter)}`) : ""}</section>`;
    if (page === "trackers") return `<section class="tracker-toggle-list">${character.trackers.map((tracker) => `<label><input type="checkbox" data-tracker-toggle="${escape(tracker.id)}"${tracker.active ? " checked" : ""}${unavailable(adapter)}><span>${escape(tracker.name)}</span></label>`).join("") || '<p class="tracker-muted">No custom trackers recorded.</p>'}</section>`;
    if (page === "preparation") return `<section class="tracker-preparation"><p class="tracker-muted">Cantrips stay available. Prepared limits and always-prepared spells follow your existing spellcasting profiles.</p>${character.spellcasting.profiles.map(profile => `<p>${escape(profile.name)}: ${character.spells.filter(spell => spell.source === profile.id && Number(spell.level) > 0 && spell.prepared && !spell.alwaysPrepared).length} prepared${profile.preparedLimit > 0 ? ` / ${profile.preparedLimit}` : ""}</p>`).join("")}${character.spells.filter((spell) => Number(spell.level) > 0).map((spell) => `<label><input type="checkbox" data-prepared="${escape(spell.id)}"${spell.prepared ? " checked" : ""}${!adapter.canEdit || adapter.canPrepare && !adapter.canPrepare(spell) ? " disabled" : ""}><span><strong>${escape(spell.name)}</strong><small>Level ${escape(spell.level)} · ${escape(spell.school || "Spell")}</small></span></label>`).join("") || '<p class="tracker-muted">This character has no spells to prepare.</p>'}</section>`;
    return "";
  }
  function render() {
    adapter.refresh?.();
    const previous = document.activeElement, focusedSearch = previous?.id === "tracker-search";
    const previousKey = previous?.dataset.focus;
    const cursor = focusedSearch ? previous.selectionStart : null;
    const infoOpen = main.querySelector(".tracker-combat-info")?.open;
    const scroll = main.scrollTop;
    root.querySelector("[data-header-name]").textContent = character.name;
    root.querySelector("[data-header-hp]").textContent = `${character.hp.current ?? "—"}/${character.hp.max ?? "—"}${character.hp.temp ? ` +${character.hp.temp}` : ""}`;
    renderNavigation();
    const title = character.kind === "npc" && state.page === "sheet" ? "NPC stat block" : SECTION_NAMES[state.page];
    const listPage = ["play", "actions", "spells", "inventory"].includes(state.page);
    const heading = `<div class="tracker-page-heading"><div><p class="tracker-eyebrow">${escape(description(character))}</p><h1>${escape(title)}</h1></div>${["play", "actions", "spells"].includes(state.page) ? button("Resources", 'data-page="resources"', "tracker-heading-action") : ""}</div>`;
    let content;
    if (listPage) content = `${["play", "actions"].includes(state.page) ? combatOverview(character) + conditions(character) : ""}${state.page === "inventory" ? `<p class="tracker-inventory-summary">${Object.entries(character.currency || {}).map(([coin, amount]) => `${escape(coin.toUpperCase())} ${escape(amount)}`).join(" · ")}${character.inventoryWeight !== undefined ? ` · ${escape(character.inventoryWeight)} lb` : ""}</p>` : ""}${state.page === "spells" ? `<div class="tracker-spell-summary">${character.spellcasting.profiles.map((profile) => `<span>${escape(profile.name)} <strong>Attack ${escape(profile.attackBonus ?? profile.spellAttack ?? "—")} · DC ${escape(profile.saveDC ?? profile.spellSaveDC ?? "—")}</strong></span>`).join("")}${button("Prepare", 'data-page="preparation"')}</div>` : ""}<div class="tracker-list-layout"><section class="tracker-list-column">${toolbar(state.query, state.timing, state.page === "inventory", Number(Boolean(state.timing)) + Object.values(state.advanced).filter(Boolean).length)}${optionsList(adapter, state)}</section>${renderDetail()}</div>`;
    else if (["sheet", "checks"].includes(state.page)) content = `${summary(character)}${conditions(character)}<div class="tracker-sheet-grid">${abilityTiles(character, state.page === "sheet")}<div>${character.kind === "npc" ? defenses(character) : ""}${skills(character)}${character.kind !== "npc" ? defenses(character) : ""}</div></div>${character.kind === "npc" ? `<section class="tracker-npc-traits"><h2>Traits</h2>${character.features.map((item) => `<article><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p></article>`).join("")}</section>` : ""}`;
    else if (state.page === "more") content = moreLinks(character);
    else content = renderAuxiliary(state.page);
    main.innerHTML = `${!adapter.canEdit ? '<p class="tracker-read-only">Read-only view. Personal pins remain available.</p>' : ""}${heading}${content}`;
    if (infoOpen && main.querySelector(".tracker-combat-info")) main.querySelector(".tracker-combat-info").open = true;
    main.scrollTop = scroll;
    if (focusedSearch) { const input = main.querySelector("#tracker-search"); input?.focus({ preventScroll: true }); if (input && cursor !== null) input.setSelectionRange(cursor, cursor); }
    else if (previousKey && !previous.isConnected) [...main.querySelectorAll("[data-focus]")].find((node) => node.dataset.focus === previousKey)?.focus({ preventScroll: true });
  }
  function navigate(page) {
    scrollPositions.set(state.page, main.scrollTop); queries.set(state.page, { query: state.query, timing: state.timing, advanced: { ...state.advanced } });
    state.page = page; state.selected = "";
    Object.assign(state, queries.get(page) || { query: "", timing: "", advanced: {} });
    if (dialog.open) closeDialog();
    render(); main.scrollTop = scrollPositions.get(page) || 0;
  }
  function renderNavigation() {
    const selectedNav = SCREEN_NAVIGATION[variant].some(([id]) => id === state.page) ? state.page : "more";
    nav.querySelectorAll("button").forEach((tab) => { const active = tab.dataset.page === selectedNav; tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1; });
    main.setAttribute("aria-labelledby", `tracker-tab-${selectedNav}`);
    const toggle = root.querySelector('[data-command="switch-view"]');
    const label = variant === "v2.1" ? "Switch to V2.2 Character Sheet" : "Switch to V2.1 Base";
    toggle.setAttribute("aria-label", label); toggle.title = label;
    toggle.querySelector("[data-version-label]").textContent = variant.slice(1);
  }
  function switchVariant(next = variant === "v2.1" ? "v2.2" : "v2.1", { persist = true } = {}) {
    if (!SCREEN_NAVIGATION[next] || next === variant) return;
    const page = state.page, scroll = main.scrollTop;
    scrollPositions.set(page, scroll); queries.set(page, { query: state.query, timing: state.timing, advanced: { ...state.advanced } });
    if (dialog.open) closeDialog();
    variant = next; root.dataset.variant = next; state.page = pageForVariant(page, next);
    nav.innerHTML = navigation(next);
    // Shared pages keep their DOM, including unsaved note text and focused fields.
    if (state.page === page) renderNavigation(); else render();
    main.scrollTop = scroll;
    if (persist) Promise.resolve(onVariantChange(next)).catch(() => notify("View switched. Appearance could not sync; retry in Appearance."));
  }
  function openDetails(key, target) {
    const record = adapter.record(key); if (!record) return;
    state.selected = key; returnFocus = target?.dataset.focus || `detail:${key}`;
    if (wide.matches && ["play", "actions", "spells", "inventory"].includes(state.page)) { render(); main.querySelector(".tracker-side-detail")?.querySelector("button")?.focus({ preventScroll: true }); }
    else modal(record.item.name, `<div class="tracker-mobile-details">${details(record, adapter)}</div>`, target);
  }
  function openConfirmation(key, target, keepSelection = false) {
    if (!adapter.canEdit) return;
    if (!keepSelection) state.selection = {};
    state.pending = key;
    const plan = adapter.plan(key, state.selection), record = adapter.record(key);
    if (!record || !plan) { state.pending = null; return; }
    state.selection.mode = plan.mode || "standard"; state.selection.optionId = plan.selectedId || "";
    const options = plan.options || [];
    const methods = plan.ritualAvailable ? `<label>Cast method<select data-cast-mode><option value="standard"${plan.mode === "standard" ? " selected" : ""}>Use a spell slot</option><option value="ritual"${plan.mode === "ritual" ? " selected" : ""}>Cast as ritual</option></select></label>` : "";
    const chooser = options.length ? `<label>Resource${options.length === 1 ? `<p class="tracker-selected-resource">${escape(options[0].label)} · ${options[0].current}/${options[0].max}</p>` : `<select data-use-option>${options.map((option) => `<option value="${escape(option.id)}"${plan.selectedId === option.id ? " selected" : ""}>${escape(option.label)} · ${option.current}/${option.max}</option>`).join("")}</select>`}</label>` : "";
    modal(record.source === "spells" ? `Cast ${record.item.name}` : `Use ${record.item.name}`, `<p class="tracker-dialog-description">${escape(plan.message)}</p>${methods}${chooser}<p class="tracker-muted">Records this use${record.item.concentration ? " and concentration" : ""}. Apply target effects separately.</p><p class="tracker-dialog-error" role="alert"></p><footer>${button("Cancel", 'data-command="close-dialog"')}${button(record.source === "spells" ? "Confirm cast" : "Confirm use", `data-command="confirm-use"${plan.canConfirm ? "" : " disabled"}`, "tracker-primary")}</footer>`, target);
  }
  function openHp(target) {
    modal("Hit points", `<div class="tracker-hp-values"><div><span>Current</span><strong>${character.hp.current ?? "—"} / ${character.hp.max ?? "—"}</strong></div><div><span>Temporary</span><strong>${character.hp.temp ?? "—"}</strong></div></div><label>Amount<input id="tracker-hp-amount" type="number" min="0" step="1" inputmode="numeric" value="5"${unavailable(adapter)}></label><div class="tracker-hp-actions">${button("Damage", `data-hp="damage"${unavailable(adapter)}`, "tracker-danger")}${button("Heal", `data-hp="heal"${unavailable(adapter)}`)}${button("Set temp HP", `data-hp="temp"${unavailable(adapter)}`)}</div>${button("Death saves", 'data-command="death-saves"', "tracker-text-button")}`, target);
  }
  function openTurn(target) {
    modal("Your turn", `<p class="tracker-muted">Advisory only. Confirmed uses mark their action type; correct marks whenever needed.</p><div class="tracker-turn">${[["action", "Action"], ["bonus", "Bonus action"], ["reaction", "Reaction"]].map(([key, label]) => button(`<span>${label}</span><strong>${adapter.personal.turn[key] ? "Used" : "Available"}</strong>`, `data-turn="${key}" aria-pressed="${adapter.personal.turn[key]}"${unavailable(adapter)}`)).join("")}</div><footer>${button("Done", 'data-command="close-dialog"')}${button("Start turn", `data-command="start-turn"${unavailable(adapter)}`, "tracker-primary")}</footer>`, target);
  }
  function openConditions(target) {
    modal("Conditions & concentration", `<div class="tracker-condition-list">${character.conditions.map((condition, index) => `<div><span>${escape(typeof condition === "string" ? condition : condition.name)}</span>${button("Remove", `data-remove-condition="${index}"${unavailable(adapter)}`)}</div>`).join("")}${character.concentration ? `<div><span>Concentrating: ${escape(character.concentration.name)}</span>${button("End", `data-command="end-concentration"${unavailable(adapter)}`)}</div>` : ""}</div>${adapter.changeExhaustion ? `<div class="tracker-exhaustion">${button("−", `data-exhaustion="-1" aria-label="Decrease exhaustion"${unavailable(adapter)}`)}<span>Exhaustion ${character.exhaustion || 0}</span>${button("+", `data-exhaustion="1" aria-label="Increase exhaustion"${unavailable(adapter)}`)}</div>` : ""}<form data-condition-form><label>Condition name<input name="condition" maxlength="80" placeholder="e.g. Poisoned" required${unavailable(adapter)}></label><button type="submit"${unavailable(adapter)}>Add condition</button></form>`, target);
  }
  root.addEventListener("input", (event) => {
    if (event.target.id === "tracker-search") { state.query = event.target.value; render(); }
  });
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-use-option]")) { state.selection.optionId = target.value; openConfirmation(state.pending, null, true); }
    if (target.matches("[data-cast-mode]")) { state.selection.mode = target.value; openConfirmation(state.pending, null, true); }
    if (target.matches("[data-advanced-filter]")) { state.advanced[target.dataset.advancedFilter] = target.value; render(); }
    if (target.matches("[data-timing]")) { state.timing = target.value; render(); }
    if (!adapter.canEdit) return;
    if (target.matches("[data-prepared]")) { adapter.setPrepared(target.dataset.prepared, target.checked); render(); }
    if (target.matches("[data-tracker-toggle]")) adapter.toggleTracker(target.dataset.trackerToggle, target.checked);
    if (target.matches("[data-item-container]")) { adapter.inventoryChange(Number(target.dataset.index), { containerId: target.value }); render(); refreshOpenDetails(); }
  });
  root.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form.matches("[data-note-form], [data-condition-form], [data-edit-form]")) return;
    event.preventDefault(); if (!adapter.canEdit) return;
    const fields = new FormData(form);
    if (form.matches("[data-note-form]")) { adapter.addNote(fields.get("title"), fields.get("body"), state.editingNote); state.editingNote = null; render(); notify("Note saved."); }
    if (form.matches("[data-condition-form]")) { adapter.addCondition(fields.get("condition")); render(); openConditions(); }
    if (form.matches("[data-edit-form]")) { adapter.editBasics({ name: fields.get("name"), ac: Number(fields.get("ac")), walk: Number(fields.get("walk")) }); closeDialog(); render(); notify("Preview details updated."); }
  });
  root.addEventListener("click", (event) => {
    const target = event.target.closest("button"); if (!target || target.disabled) return;
    if (target.dataset.page) { navigate(target.dataset.page); return; }
    if (target.dataset.rollFormula) {
      if (adapter.roll) { event.stopPropagation(); if (dialog.open) closeDialog(); adapter.roll(target.dataset.rollFormula, target.dataset.rollLabel); return; }
      const result = rollDiceFormula(target.dataset.rollFormula);
      notify(`${target.dataset.rollLabel}: ${result.total}`); return;
    }
    if (target.dataset.detail) { openDetails(target.dataset.detail, target); return; }
    if (target.dataset.use) { openConfirmation(target.dataset.use, target); return; }
    if (target.hasAttribute("data-edit-note") && adapter.canEdit) { state.editingNote = Number(target.dataset.editNote); render(); main.querySelector("[data-note-form] input")?.focus(); return; }
    if (target.hasAttribute("data-remove-note") && adapter.canEdit) { adapter.removeNote(Number(target.dataset.removeNote)); state.editingNote = null; render(); return; }
    if (target.dataset.extraHp && adapter.canEdit) { adapter.extraHP(target.dataset.extraHp, Number(target.dataset.delta)); render(); return; }
    if (target.dataset.inventory && adapter.canEdit) {
      const item = character.inventory[Number(target.dataset.index)], field = target.dataset.inventory;
      adapter.inventoryChange(item.index, { [field]: field === "quantity" ? item.quantity + Number(target.dataset.delta) : !(field === "wearing" ? item.equipped : item[field]) });
      render(); refreshOpenDetails(); return;
    }
    if (target.dataset.pin) {
      adapter.personal.togglePin(target.dataset.pin); render();
      if (dialog.open) { const record = adapter.record(target.dataset.pin); modal(record.item.name, `<div class="tracker-mobile-details">${details(record, adapter)}</div>`); }
      notify(adapter.personal.pins.has(target.dataset.pin) ? "Pinned to Play." : "Unpinned."); return;
    }
    if (target.dataset.adjust) { adapter.adjust(target.dataset.adjust, target.dataset.id, Number(target.dataset.delta)); render(); return; }
    if (target.dataset.hp) { const amount = Number(dialog.querySelector("input")?.value); if (adapter.hp(target.dataset.hp, amount)) { render(); openHp(); notify("Hit points updated."); } return; }
    if (target.dataset.turn) { if (adapter.canEdit) adapter.personal.toggleTurn(target.dataset.turn); openTurn(); return; }
    if (target.dataset.flag && adapter.canEdit) { adapter.toggleFlag(target.dataset.flag); render(); return; }
    if (target.hasAttribute("data-remove-condition") && adapter.canEdit) { adapter.removeCondition(Number(target.dataset.removeCondition)); render(); openConditions(); return; }
    if (target.dataset.deathSave && adapter.canEdit) { adapter.toggleDeathSave(target.dataset.deathSave, Number(target.dataset.index)); openDeathSaves(); return; }
    const command = target.dataset.command;
    if (command === "switch-view") switchVariant();
    if (command === "close-dialog") closeDialog();
    if (command === "close-detail") { state.selected = ""; render(); focusReturn(); }
    if (command === "hp") openHp(target);
    if (command === "turn") openTurn(target);
    if (command === "start-turn" && adapter.canEdit) { adapter.personal.startTurn(); openTurn(); notify("New turn. Resources unchanged."); }
    if (command === "clear-filters") { state.query = ""; state.timing = ""; state.advanced = {}; render(); if (dialog.open) closeDialog(); }
    if (command === "filters") modal("Filter options", `<label>Action timing<select data-timing>${[["", "All options"], ["action", "Action"], ["bonus", "Bonus action"], ["reaction", "Reaction"], ["other", "Other / free action"]].map(([value, label]) => `<option value="${value}"${state.timing === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>${advancedFilters(adapter, state)}<footer>${button("Clear", 'data-command="clear-filters"')}${button("Show options", 'data-command="close-dialog"', "tracker-primary")}</footer>`, target);
    if (command === "confirm-use" && state.pending && adapter.canEdit) {
      const key = state.pending; state.pending = null; // A second click cannot commit this confirmation again.
      const result = adapter.confirm(key, state.selection);
      if (result.applied) { closeDialog(); render(); focusReturn(); notify(result.message); }
      else { state.pending = key; dialog.querySelector(".tracker-dialog-error").textContent = result.message; target.disabled = true; }
    }
    if (command === "menu") modal("Tracker menu", `<div class="tracker-menu">${[["turn", "Turn checklist", "check2-square"], ["resources", "Resources", "battery-half"], ["conditions", "Conditions", "activity"], ["rest", "Take a rest", "moon"], ["dice", "Roll dice", "dice-6"], ["edit", adapter.openEditor ? "Edit sheet & exports" : "Edit details", "pencil"], ["appearance", "Appearance", "palette"], ...(adapter.account ? [["account", "My account", "person-circle"]] : [])].map(([id, label, symbol]) => button(`${icon(symbol)}${label}`, `${id === "resources" ? 'data-page="resources"' : `data-command="${id}"`}${id === "edit" ? unavailable(adapter) : ""}`)).join("")}</div>`, target);
    if (command === "conditions") openConditions(target);
    if (command === "end-concentration" && adapter.canEdit) { adapter.endConcentration(); render(); openConditions(); }
    if (command === "rest") modal("Take a rest", `<p class="tracker-muted">Review before restoring resources.</p><div class="tracker-menu">${button("Short rest", `data-rest="short"${unavailable(adapter)}`)}${button("Long rest", `data-rest="long"${unavailable(adapter)}`)}</div>`, target);
    if (target.dataset.rest) { const rest = adapter.restDetails?.(target.dataset.rest); modal(rest?.title || (target.dataset.rest === "long" ? "Long rest" : "Short rest"), `${rest ? `<p>${escape(rest.description)}</p><p class="tracker-muted">${escape(rest.duration)}</p><ul>${rest.effects.map(effect => `<li>${escape(effect)}</li>`).join("")}</ul>` : `<p>${target.dataset.rest === "long" ? "Restore HP, clear temporary HP, and recover short/long-rest resources and slots." : "Recover short-rest resources. HP and long-rest slots stay unchanged."}</p>`}<footer>${button("Cancel", 'data-command="close-dialog"')}${button("Confirm rest", `data-confirm-rest="${target.dataset.rest}"`, "tracker-primary")}</footer>`); state.pendingRest = target.dataset.rest; }
    if (target.dataset.confirmRest && state.pendingRest === target.dataset.confirmRest && adapter.canEdit) { state.pendingRest = null; if (adapter.rest(target.dataset.confirmRest)) { closeDialog(); render(); notify("Rest completed."); } else { target.disabled = true; dialog.querySelector("footer").insertAdjacentHTML("beforebegin", '<p role="alert" class="tracker-dialog-error">Rest not completed. Check rest eligibility and current HP.</p>'); } }
    if (command === "dice") modal("Roll dice", `<div class="tracker-dice-grid">${[4, 6, 8, 10, 12, 20, 100].map((sides) => button(`d${sides}`, `data-roll-formula="1d${sides}" data-roll-label="d${sides}"`)).join("")}</div>`, target);
    if (command === "death-saves") openDeathSaves(target);
    if (command === "edit" && adapter.canEdit) {
      if (adapter.openEditor) { if (dialog.open) closeDialog(); adapter.openEditor(root.querySelector('[data-command="menu"]')); }
      else modal("Edit details", `<form data-edit-form><label>Name<input name="name" value="${escape(character.name)}" required maxlength="100"></label><label>Armor class<input name="ac" type="number" min="0" max="100" value="${character.ac}" required></label><label>Speed (ft)<input name="walk" type="number" min="0" max="1000" value="${character.walk}" required></label><footer><button type="button" data-command="close-dialog">Cancel</button><button type="submit" class="tracker-primary">Save details</button></footer></form>`, target);
    }
    if (command === "conversion" && adapter.canEdit) { if (dialog.open) closeDialog(); adapter.openConversion(root.querySelector('[data-command="menu"]')); }
    if (command === "account") { if (dialog.open) closeDialog(); adapter.account(); }
    if (command === "stable" && adapter.canEdit) { adapter.toggleStable?.(); openDeathSaves(); }
    if (target.dataset.exhaustion && adapter.canEdit) { adapter.changeExhaustion?.(Number(target.dataset.exhaustion)); render(); openConditions(); }
    if (command === "appearance") { closeDialog(); onAppearance(); }
  });
  function refreshOpenDetails() { if (dialog.open && state.selected) { const record = adapter.record(state.selected); if (record) modal(record.item.name, `<div class="tracker-mobile-details">${details(record, adapter)}</div>`); } }
  function openDeathSaves(target) {
    modal("Death saving throws", `<div class="tracker-death-saves">${["successes", "failures"].map((kind) => `<fieldset><legend>${kind === "successes" ? "Successes" : "Failures"}</legend>${[0, 1, 2].map((index) => button(String(index + 1), `data-death-save="${kind}" data-index="${index}" aria-pressed="${index < character.deathSaves[kind]}"${unavailable(adapter)}`)).join("")}</fieldset>`).join("")}${adapter.toggleStable ? button("Stable", `data-command="stable" aria-pressed="${Boolean(character.deathSaves.stable)}"${unavailable(adapter)}`) : ""}</div>`, target);
  }
  nav.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...nav.querySelectorAll("button")], current = tabs.indexOf(event.target);
    const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); navigate(tabs[index].dataset.page); tabs[index].focus();
  });
  wide.addEventListener("change", () => { if (dialog.open) closeDialog(); state.selected = ""; render(); });
  render();
  return { render, navigate, switchVariant, state, get variant() { return variant; } };
}

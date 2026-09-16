// Renders tracker cards, spell slots, prepared profiles, and inventory items.
import { escapeHTML, sanitizeIdentifier, trackerUI as ui } from "./rendering.js";
import {
  attackRollFormula,
  damageRollFormula,
  renderRollButton,
  renderRollableText,
} from "./rolls.js";
import { spellRepertoireLabels } from "./v4-spells.js";

export function createTrackerViews({
  formatReset,
  formatSpellLevel,
  getPreparedCount,
  getSpellcastingProfile,
  getSpells,
  isAlwaysPreparedSpell,
  isV4 = () => false,
}) {
  const attunedToggleClasses = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-stone-100 text-stone-600 shadow-sm transition hover:border-yellow-300 hover:text-yellow-500 aria-checked:border-yellow-200 aria-checked:bg-yellow-200 aria-checked:text-yellow-950 dark:border-white/15 dark:bg-white/10 dark:text-stone-300";
  const wearingToggleClasses = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-stone-100 text-stone-600 shadow-sm transition hover:border-violet-300 hover:text-violet-400 aria-checked:border-violet-300 aria-checked:bg-violet-300 aria-checked:text-violet-950 dark:border-white/15 dark:bg-white/10 dark:text-stone-300";

  function renderInventoryItem(item, index, state = {}) {
    const supportsAttunement = item.attunement === true || Number(item.attunement) === 1;
    const supportsWearing = item.wearable === true || Number(item.wearable) === 1;
    const attuned = supportsAttunement && Boolean(state.attuned);
    const wearing = supportsWearing && Boolean(state.wearing);
    const attunedToggle = supportsAttunement
      ? `<button type="button" role="switch" aria-checked="${attuned}" aria-label="Attuned: ${attuned ? "Yes" : "No"}" title="Attuned" data-tracker-action="inventory-item-status" data-index="${index}" data-field="attuned" class="${attunedToggleClasses}"><i class="bi bi-gem" aria-hidden="true"></i></button>`
      : "";
    const wearingToggle = supportsWearing
      ? `<button type="button" role="switch" aria-checked="${wearing}" aria-label="Wearing: ${wearing ? "Yes" : "No"}" title="Wearing" data-tracker-action="inventory-item-status" data-index="${index}" data-field="wearing" class="${wearingToggleClasses}"><i class="bi bi-person-check-fill" aria-hidden="true"></i></button>`
      : "";
    const statusToggles = attunedToggle || wearingToggle
      ? `<div class="flex shrink-0 items-start gap-2">${attunedToggle}${wearingToggle}</div>`
      : "";
    return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><span class="${ui.badge} ${ui.badgePrimary}">x${item.quantity}</span></div><div class="${ui.cardBody} flex items-start justify-between gap-3"><small class="min-w-0 grow text-left">${renderRollableText(item.description || "")}</small>${statusToggles}</div></div>`;
  }

  function renderV4InventoryItem(item, index) {
    const badges = [
      `<span class="${ui.badge} ${ui.badgePrimary}">×${item.quantity}</span>`,
      item.weight !== null && item.weight !== undefined ? `<span class="${ui.badge} ${ui.badgeSecondary}">${item.weight} lb.</span>` : "",
      item.containerName ? `<span class="${ui.badge} ${ui.badgeSecondary}">In ${escapeHTML(item.containerName)}</span>` : "",
      item.contentsWeight !== null && item.contentsWeight !== undefined ? `<span class="${ui.badge} ${ui.badgeSecondary}">Contents ${item.contentsWeight} lb.</span>` : "",
      !item.automatic ? `<span class="${ui.badge} ${ui.badgeWarning}">Manual rules</span>` : "",
    ].join("");
    const quantity = item.runtimeManaged
      ? `<div class="v4-inventory-stepper" role="group" aria-label="${escapeHTML(item.name)} quantity"><button type="button" data-tracker-action="inventory-quantity" data-index="${index}" data-delta="-1" aria-label="Decrease ${escapeHTML(item.name)} quantity">−</button><output aria-label="Quantity">${item.quantity}</output><button type="button" data-tracker-action="inventory-quantity" data-index="${index}" data-delta="1" aria-label="Increase ${escapeHTML(item.name)} quantity">+</button></div>`
      : "";
    const equipped = item.canEquip
      ? `<button type="button" class="v4-inventory-toggle" role="switch" aria-checked="${item.equipped}" data-tracker-action="inventory-runtime" data-index="${index}" data-field="equipped"><i class="bi bi-person-check-fill" aria-hidden="true"></i>${item.equipped ? "Equipped" : "Equip"}</button>`
      : "";
    const attuned = item.canAttune
      ? `<button type="button" class="v4-inventory-toggle" role="switch" aria-checked="${item.attuned}" data-tracker-action="inventory-runtime" data-index="${index}" data-field="attuned"><i class="bi bi-gem" aria-hidden="true"></i>${item.attuned ? "Attuned" : "Attune"}</button>`
      : "";
    const container = item.runtimeManaged && item.containers.length
      ? `<label class="v4-inventory-container"><span>Container</span><select data-v4-inventory-container data-index="${index}"><option value="">Not contained</option>${item.containers.map((candidate) => `<option value="${escapeHTML(candidate.id)}"${candidate.id === item.containerId ? " selected" : ""}>${escapeHTML(candidate.name)}</option>`).join("")}</select></label>`
      : "";
    const charges = item.charges
      ? `<div class="v4-inventory-charges"><span>${item.charges.current}/${item.charges.max} charges${item.charges.reset ? ` · ${escapeHTML(formatReset(item.charges.reset))}` : ""}</span><button type="button" data-tracker-action="request-item-charge" data-index="${index}"${item.charges.current < 1 ? " disabled" : ""}>Use charge</button></div>`
      : "";
    const description = item.description ? `<p>${renderRollableText(item.description)}</p>` : "";
    return `<article class="${ui.card} v4-inventory-item" data-v4-inventory-item="${index}"><div class="${ui.cardHeader}"><div><strong>${escapeHTML(item.name || "Unnamed item")}</strong><div class="mt-2 flex flex-wrap gap-2">${badges}</div></div>${quantity}</div><div class="p-5">${description}<div class="v4-inventory-controls">${equipped}${attuned}${container}</div>${charges}</div></article>`;
  }

  function renderV4Feature(feature) {
    const selections = feature.selections.length
      ? `<div class="v4-feature-selections"><strong>Selections</strong>${feature.selections.map((selection) => `<span>${escapeHTML(selection)}</span>`).join("")}</div>` : "";
    const resource = feature.resource?.uses
      ? `<div class="v4-feature-resource"><span>${escapeHTML(feature.resource.name || feature.name)}: ${feature.resource.uses.current}/${feature.resource.uses.max}</span><div role="group" aria-label="Track ${escapeHTML(feature.resource.name || feature.name)} uses"><button type="button" data-tracker-action="resource" data-id="${sanitizeIdentifier(feature.resource.id)}" data-delta="-1" aria-label="Decrease ${escapeHTML(feature.resource.name || feature.name)}">−</button><button type="button" data-tracker-action="resource" data-id="${sanitizeIdentifier(feature.resource.id)}" data-delta="1" aria-label="Increase ${escapeHTML(feature.resource.name || feature.name)}">+</button></div></div>` : "";
    return `<article class="v4-content-card" data-v4-feature="${sanitizeIdentifier(feature.id)}"><div><strong>${escapeHTML(feature.name)}</strong>${feature.sourceLabel ? `<span>${escapeHTML(feature.sourceLabel)}</span>` : ""}</div>${selections}${resource}<button type="button" class="v4-detail-open" data-tracker-action="open-v4-detail" data-kind="feature" data-id="${sanitizeIdentifier(feature.id)}">View details</button></article>`;
  }

  function renderV4Extra(extra) {
    const hp = extra.hp
      ? `<div class="v4-extra-hp"><span>HP ${extra.hp.current}/${extra.hp.max}${extra.hp.temp ? ` +${extra.hp.temp} temp` : ""}</span><div role="group" aria-label="Track ${escapeHTML(extra.name)} hit points"><button type="button" data-tracker-action="extra-hp" data-id="${sanitizeIdentifier(extra.id)}" data-delta="-1" aria-label="Decrease ${escapeHTML(extra.name)} hit points">−</button><button type="button" data-tracker-action="extra-hp" data-id="${sanitizeIdentifier(extra.id)}" data-delta="1" aria-label="Increase ${escapeHTML(extra.name)} hit points">+</button></div></div>` : "";
    const uses = extra.uses
      ? `<div class="v4-feature-resource"><span>Uses ${extra.uses.current}/${extra.uses.max}</span><div role="group" aria-label="Track ${escapeHTML(extra.name)} uses"><button type="button" data-tracker-action="resource" data-id="${sanitizeIdentifier(extra.id)}" data-delta="-1" aria-label="Decrease ${escapeHTML(extra.name)} uses">−</button><button type="button" data-tracker-action="resource" data-id="${sanitizeIdentifier(extra.id)}" data-delta="1" aria-label="Increase ${escapeHTML(extra.name)} uses">+</button></div></div>` : "";
    return `<article class="v4-content-card" data-v4-extra="${sanitizeIdentifier(extra.id)}"><div><strong>${escapeHTML(extra.name)}</strong><span>${escapeHTML(extra.sourceLabel)}</span></div><div class="flex flex-wrap gap-2">${extra.ac !== undefined ? `<span class="${ui.badge} ${ui.badgeSecondary}">AC ${escapeHTML(extra.ac)}</span>` : ""}${extra.speed ? `<span class="${ui.badge} ${ui.badgeSecondary}">${escapeHTML(extra.speed)}</span>` : ""}</div>${hp}${uses}<button type="button" class="v4-detail-open" data-tracker-action="open-v4-detail" data-kind="extra" data-id="${sanitizeIdentifier(extra.id)}">View details</button></article>`;
  }

  function renderDetailBadges(item) {
    const badges = [];
    if (item.level !== undefined && item.level !== null)
      badges.push(`<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">${formatSpellLevel(item.level)}</span>`);
    if (item.school)
      badges.push(`<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">${escapeHTML(item.school)}</span>`);
    if (item.range)
      badges.push(`<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">Range: ${escapeHTML(item.range)}</span>`);
    if (item.attack) {
      const formula = attackRollFormula(item.attack);
      badges.push(formula
        ? renderRollButton({ formula, label: `${item.name || "Ability"} Attack`, text: item.attack })
        : `<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">${escapeHTML(item.attack)}</span>`);
    }
    if (item.damage) {
      const formula = damageRollFormula(item.damage);
      badges.push(formula
        ? renderRollButton({ formula, label: `${item.name || "Ability"} Damage`, text: item.damage })
        : `<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">${escapeHTML(item.damage)}</span>`);
    }
    if (item.duration)
      badges.push(`<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">Duration: ${escapeHTML(item.duration)}</span>`);
    if (item.components)
      badges.push(`<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">${escapeHTML(item.components)}</span>`);
    if (item.spellcasting)
      badges.push(`<span class="${ui.badge} tracker-badge-neutral bg-stone-800 text-white">${escapeHTML(item.spellcasting)}</span>`);
    if (item.source) {
      const profile = getSpellcastingProfile(item.source);
      badges.push(`<span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(profile?.name || item.source)}</span>`);
    }
    if (
      item.level !== undefined &&
      Number(item.level) > 0 &&
      item.prepared &&
      !isAlwaysPreparedSpell(item)
    ) badges.push(`<span class="${ui.badge} ${ui.badgeSuccess}">Prepared</span>`);
    if (item.concentration)
      badges.push(`<span class="${ui.badge} ${ui.badgeWarning}">Concentration</span>`);
    return badges.length
      ? `<div class="mt-2 flex flex-wrap gap-2">${badges.join("")}</div>`
      : "";
  }

  function renderResourceCard(item) {
    let usage = "";
    if (item.uses) {
      usage = `<div class="inline-flex gap-2" role="group"><button type="button" class="${ui.iconButton}" aria-label="Decrease ${sanitizeIdentifier(item.name)}" data-tracker-action="resource" data-id="${sanitizeIdentifier(item.id)}" data-delta="-1">−</button><button type="button" class="${ui.iconButton}" aria-label="Increase ${sanitizeIdentifier(item.name)}" data-tracker-action="resource" data-id="${sanitizeIdentifier(item.id)}" data-delta="1">+</button></div><div class="flex gap-2"><span class="${ui.badge} ${ui.badgeSuccess}">${item.uses.current}/${item.uses.max}</span><span class="${ui.badge} ${ui.badgeWarning}">${formatReset(item.uses.reset)}</span></div>`;
    } else if (item.slotLevel) {
      usage = `<span class="${ui.badge} ${ui.badgePrimary}">Uses level ${item.slotLevel} slot</span>`;
    } else {
      usage = `<span class="${ui.badge} ${ui.badgeSecondary}">At will</span>`;
    }
    const useButton = isV4()
      ? `<button type="button" class="v4-use-action" data-tracker-action="request-use" data-id="${sanitizeIdentifier(item.id)}" aria-label="Use ${escapeHTML(item.name)}">Use</button>`
      : "";
    return `<div class="${ui.card}" data-v4-action-card="${sanitizeIdentifier(item.id)}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><span class="${ui.badge} ${ui.badgeDanger}">${escapeHTML(item.category || "Ability")}</span></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2"><div>${usage}</div>${useButton}</div>${renderDetailBadges(item)}<p class="mt-2 text-sm">${renderRollableText(item.description || "")}</p></div></div>`;
  }

  function renderSpellSlot(slot, profile) {
    const profileName = profile?.name || "spellcasting";
    return `<div class="rounded-xl border border-stone-200 bg-stone-50/70 dark:border-white/10 dark:bg-white/[.035]"><div class="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-white/10"><strong>Level ${slot.level}</strong><span class="${ui.badge} ${ui.badgeDanger}">Max: ${slot.max}</span></div><div class="p-4"><div class="flex items-center justify-between gap-3"><div class="inline-flex gap-2"><button type="button" class="${ui.iconButton}" aria-label="Decrease ${sanitizeIdentifier(profileName)} level ${slot.level} spell slots" data-tracker-action="spell-slot" data-id="${sanitizeIdentifier(slot.id)}" data-delta="-1">−</button><button type="button" class="${ui.iconButton}" aria-label="Increase ${sanitizeIdentifier(profileName)} level ${slot.level} spell slots" data-tracker-action="spell-slot" data-id="${sanitizeIdentifier(slot.id)}" data-delta="1">+</button></div><span class="${ui.badge} ${ui.badgeWarning}">${slot.current}/${slot.max}</span><span class="${ui.badge} ${ui.badgeSecondary}">${formatReset(slot.reset || "long")}</span></div></div></div>`;
  }

  function renderPreparedProfile(profile) {
    const spells = getSpells()
      .filter((spell) => spell.source === profile.id)
      .sort((left, right) =>
        Number(left.level || 0) - Number(right.level || 0) ||
        String(left.name).localeCompare(String(right.name)),
      );
    const preparedCount = getPreparedCount(profile.id);
    const atLimit = profile.preparedLimit > 0 && preparedCount >= profile.preparedLimit;
    const limitLabel = profile.preparedLimit > 0
      ? `${preparedCount} / ${profile.preparedLimit} prepared`
      : "No preparation required";
    return `<section class="${ui.card}"><div class="${ui.cardHeader}"><div><div class="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Spellcasting profile</div><strong>${escapeHTML(profile.name || "Spellcasting")}</strong></div><span class="${ui.badge} ${atLimit ? ui.badgeWarning : ui.badgeSuccess}">${limitLabel}</span></div><div class="divide-y divide-stone-200 dark:divide-white/10">${spells.length ? spells.map((spell) => renderPreparedSpell(spell, profile, atLimit)).join("") : '<p class="p-5 text-sm text-stone-500 dark:text-stone-400">No spells use this profile yet. Choose it as the source while editing a spell.</p>'}</div></section>`;
  }

  function renderPreparedSpell(spell, profile, atLimit) {
    const cantrip = Number(spell.level) === 0;
    const alwaysPrepared = isAlwaysPreparedSpell(spell);
    const canPrepare = profile.preparedLimit > 0 && !cantrip && !alwaysPrepared;
    const prepared = profile.preparedLimit <= 0 || alwaysPrepared || cantrip || Boolean(spell.prepared);
    const disabled = !canPrepare || (!prepared && atLimit);
    const status = cantrip
      ? "Cantrip · always ready"
      : alwaysPrepared
        ? "Always prepared"
        : profile.preparedLimit <= 0
          ? "Always available"
          : prepared
            ? "Prepared"
            : atLimit
              ? "Limit reached"
              : "Not prepared";
    return `<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><div class="font-bold">${escapeHTML(spell.name || "Unnamed spell")}</div><div class="mt-1 flex flex-wrap gap-2"><span class="${ui.badge} ${ui.badgeSecondary}">${formatSpellLevel(spell.level)}</span>${spell.category ? `<span class="text-xs text-stone-500 dark:text-stone-400">${escapeHTML(spell.category)}</span>` : ""}</div></div><button type="button" role="switch" aria-checked="${prepared}" ${disabled ? "disabled" : ""} data-tracker-action="prepared-spell" data-id="${sanitizeIdentifier(spell.id)}" class="inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-2 text-xs font-bold transition sm:self-auto ${prepared ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 bg-stone-100 text-stone-600 hover:border-blood-500 dark:border-white/15 dark:bg-white/10 dark:text-stone-300"} disabled:cursor-not-allowed disabled:opacity-60"><span class="relative h-5 w-9 rounded-full bg-black/20"><span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${prepared ? "left-[18px]" : "left-0.5"}"></span></span>${status}</button></div>`;
  }

  function renderAbilityCard(item) {
    const useBadges = item.uses
      ? `<span class="${ui.badge} ${ui.badgeSuccess}">${item.uses.current}/${item.uses.max}</span><span class="${ui.badge} ${ui.badgeSecondary}">${formatReset(item.uses.reset)}</span>`
      : "";
    const googleURL = `https://www.google.com/search?q=${encodeURIComponent(`${item.name} D&D 5e`)}`;
    return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><div class="flex items-center gap-2"><span class="${ui.badge} ${ui.badgeDanger}">${escapeHTML(item.category || "Ability")}</span><a class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-600 text-sky-600 transition hover:bg-sky-600 hover:text-white" href="${escapeHTML(googleURL)}" target="_blank" rel="noopener noreferrer" aria-label="Search Google for ${escapeHTML(item.name)}"><i class="bi bi-google"></i></a></div></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2"><div class="flex flex-wrap gap-2">${item.action ? `<span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(item.action)}</span>` : ""}</div><div class="flex flex-wrap gap-2">${useBadges}</div></div>${renderDetailBadges(item)}<p class="mt-2 text-sm">${renderRollableText(item.description || "")}</p></div></div>`;
  }

  function renderV4SpellCard(spell) {
    const profile = getSpellcastingProfile(spell.source);
    const cantrip = Number(spell.level) === 0;
    const alwaysPrepared = isAlwaysPreparedSpell(spell);
    const canPrepare = Boolean(profile?.preparedLimit > 0 && !cantrip && !alwaysPrepared);
    const prepared = cantrip || alwaysPrepared || profile?.preparedLimit <= 0 || Boolean(spell.prepared);
    const preparationControl = canPrepare
      ? `<button type="button" role="switch" aria-checked="${Boolean(spell.prepared)}" data-tracker-action="prepared-spell" data-id="${sanitizeIdentifier(spell.id)}" class="v4-spell-prepare"><span aria-hidden="true"></span>${spell.prepared ? "Prepared" : "Not prepared"}</button>`
      : `<span class="${ui.badge} ${prepared ? ui.badgeSuccess : ui.badgeSecondary}">${alwaysPrepared ? "Always prepared" : cantrip ? "Cantrip" : prepared ? "Available" : "Not prepared"}</span>`;
    const repertoire = spellRepertoireLabels(spell)
      .map((label) => `<span class="${ui.badge} ${ui.badgeSecondary}">${escapeHTML(label)}</span>`).join("");
    const traits = [
      spell.ritual || spell.ritualCastable ? `<span class="${ui.badge} ${ui.badgePrimary}">Ritual</span>` : "",
      spell.concentration ? `<span class="${ui.badge} ${ui.badgeWarning}">Concentration</span>` : "",
      spell.cantripScale > 1 ? `<span class="${ui.badge} ${ui.badgeDanger}">Cantrip tier ${spell.cantripScale}</span>` : "",
    ].join("");
    const unavailable = spell.castable === false && spell.ritualCastable !== true;
    const warning = spell.automation && spell.automation !== "rules-ready"
      ? `<p class="v4-spell-warning">${escapeHTML(spell.automation)} automation: review this spell manually.</p>`
      : "";
    return `<article class="${ui.card}" data-v4-spell-card="${sanitizeIdentifier(spell.id)}"><div class="${ui.cardHeader}"><div><strong>${escapeHTML(spell.name || "Unnamed spell")}</strong><div class="mt-1 text-xs text-theme-muted">${escapeHTML(formatSpellLevel(spell.level))}${spell.school ? ` · ${escapeHTML(spell.school)}` : ""}${profile?.name ? ` · ${escapeHTML(profile.name)}` : ""}</div></div><button type="button" class="v4-spell-cast" data-tracker-action="request-spell-cast" data-id="${sanitizeIdentifier(spell.id)}"${unavailable ? " disabled" : ""} aria-label="Cast ${escapeHTML(spell.name || "spell")}">Cast</button></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2"><div class="flex flex-wrap gap-2">${repertoire}${traits}</div>${preparationControl}</div>${renderDetailBadges(spell)}${warning}<p class="mt-3 text-sm">${renderRollableText(spell.description || "")}</p></div></article>`;
  }

  return {
    renderInventoryItem,
    renderV4InventoryItem,
    renderV4Feature,
    renderV4Extra,
    renderAbilityCard,
    renderDetailBadges,
    renderPreparedProfile,
    renderPreparedSpell,
    renderResourceCard,
    renderSpellSlot,
    renderV4SpellCard,
  };
}

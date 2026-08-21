import { escapeHTML, sanitizeIdentifier, trackerUI as ui } from "./rendering.js";

export function createTrackerViews({
  formatReset,
  formatSpellLevel,
  getPreparedCount,
  getSpellcastingProfile,
  getSpells,
  isAlwaysPreparedSpell,
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
    return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><span class="${ui.badge} ${ui.badgePrimary}">x${item.quantity}</span></div><div class="${ui.cardBody} flex items-start justify-between gap-3"><small class="min-w-0 grow text-left">${escapeHTML(item.description || "")}</small>${statusToggles}</div></div>`;
  }

  function renderDetailBadges(item) {
    const badges = [];
    if (item.level !== undefined && item.level !== null)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">${formatSpellLevel(item.level)}</span>`);
    if (item.school)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.school)}</span>`);
    if (item.range)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">Range: ${escapeHTML(item.range)}</span>`);
    if (item.attack)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.attack)}</span>`);
    if (item.damage)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.damage)}</span>`);
    if (item.duration)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">Duration: ${escapeHTML(item.duration)}</span>`);
    if (item.components)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.components)}</span>`);
    if (item.spellcasting)
      badges.push(`<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.spellcasting)}</span>`);
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
    return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><span class="${ui.badge} ${ui.badgeDanger}">${escapeHTML(item.category || "Ability")}</span></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2">${usage}</div>${renderDetailBadges(item)}<p class="mt-2 text-sm">${escapeHTML(item.description || "")}</p></div></div>`;
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
    return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><div class="flex items-center gap-2"><span class="${ui.badge} ${ui.badgeDanger}">${escapeHTML(item.category || "Ability")}</span><a class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-600 text-sky-600 transition hover:bg-sky-600 hover:text-white" href="${escapeHTML(googleURL)}" target="_blank" rel="noopener noreferrer" aria-label="Search Google for ${escapeHTML(item.name)}"><i class="bi bi-google"></i></a></div></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2"><div class="flex flex-wrap gap-2">${item.action ? `<span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(item.action)}</span>` : ""}</div><div class="flex flex-wrap gap-2">${useBadges}</div></div>${renderDetailBadges(item)}<p class="mt-2 text-sm">${escapeHTML(item.description || "")}</p></div></div>`;
  }

  return {
    renderInventoryItem,
    renderAbilityCard,
    renderDetailBadges,
    renderPreparedProfile,
    renderPreparedSpell,
    renderResourceCard,
    renderSpellSlot,
  };
}

// Coordinates Admin settings, users, themes, and local or D1 persistence.
import { initializeTheme } from "../../shared/js/theme.js";
import { escapeHTML } from "../../shared/js/text.js";
import {
  isLocalRuntimeHost,
  persistLocalRuntimeSettings,
  runtimeSettingsReady,
} from "../../shared/js/settings.js";
import { logout } from "../../shared/js/auth-client.js";
import { createDialogController } from "../../shared/js/dialog.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { DEFAULT_BACKGROUND_ID } from "../../shared/js/background-catalog.js";
import {
  BASE_THEME_ID,
  normalizeHex,
  readableForeground,
  sortThemes,
} from "../../shared/js/theme-catalog.js";

const localMode = isLocalRuntimeHost();
const legacyAccessLabels = {
  characters: "Characters",
  "player-screen": "Player Screen",
  "dm-screen": "DM Screen",
  wiki: "Wiki",
  compendium: "Compendium",
  "combat-loot": "Combat & Loot",
  "public-initiative": "Public Initiative",
  music: "Music",
};
const sectionLabels = {
  characters: "Characters navigation",
  npcs: "NPCs navigation",
  "player-screen": "Player Screen navigation",
  "dm-screen": "DM Screen navigation",
  "combat-loot": "Combat & Loot navigation",
  "public-initiative": "Public Initiative navigation",
  compendium: "Compendium navigation",
  music: "Music navigation",
  wiki: "Wiki navigation",
  "character-overview": "Character overview",
  "character-stats": "Character stats",
  "hit-points": "Hit points",
  combat: "Character combat controls",
  spellcasting: "Spellcasting",
  "prepared-spells": "Prepared spells",
  "all-possibilities": "All possibilities",
  inventory: "Inventory",
  notes: "Notes",
};

mountSiteHeader({ activePage: "admin" });
initializeTheme();

const status = document.getElementById("admin-status");
const content = document.getElementById("admin-content");
const sectionRoot = document.getElementById("section-settings");
const characterRoot = document.getElementById("character-settings");
const characterStyleRoot = document.getElementById("character-style-settings");
const userRoot = document.getElementById("user-settings");
const themeRoot = document.getElementById("theme-settings");
const themeUnavailable = document.getElementById("theme-admin-unavailable");
const addThemeButton = document.getElementById("add-theme");
const themeEditorRoot = document.getElementById("theme-editor-dialog");
const themeEditorForm = document.getElementById("theme-editor-form");
let themeEditorReturnFocus = addThemeButton;
const themeEditor = createDialogController(themeEditorRoot, {
  initialFocus: () => document.getElementById("theme-editor-name"),
  returnFocus: () => themeEditorReturnFocus,
});
const openWrites = document.getElementById("open-writes");
const characterStyleInputs = [...document.querySelectorAll('[name="character-sheet-style"]')];
let snapshot = null;

async function localCharacters() {
  let stored = {};
  try {
    const parsed = JSON.parse(localStorage.getItem("dnd-characters") || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) stored = parsed;
  } catch (error) {
    console.warn("Local characters could not be read for Admin style settings.", error);
  }

  let bundled = [];
  try {
    const catalogResponse = await fetch("char/catalog.json");
    if (catalogResponse.ok) {
      const catalog = await catalogResponse.json();
      bundled = await Promise.all((catalog.characters || []).map(async (id) => {
        const response = await fetch(`char/${encodeURIComponent(id)}/character.json`);
        const character = response.ok ? await response.json() : {};
        return { id, name: character.name || id, source: "bundled", active: true };
      }));
    }
  } catch (error) {
    console.warn("Bundled characters could not be listed for Admin style settings.", error);
  }

  const characters = new Map(bundled.map((character) => [character.id, character]));
  Object.entries(stored).forEach(([id, character]) => {
    if (!/^[a-z0-9][a-z0-9-]{0,127}$/i.test(id)) return;
    characters.set(id, {
      id,
      name: character?.name || characters.get(id)?.name || id,
      source: characters.has(id) ? "bundled/local" : "local",
      active: true,
    });
  });
  return [...characters.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function setStatus(message, kind = "neutral") {
  status.textContent = message;
  status.className = `mb-6 rounded-2xl border p-4 text-sm ${kind === "error"
    ? "border-danger-500/40 bg-danger-500/10 text-danger-600 dark:text-red-300"
    : kind === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-stone-300 bg-white/70 dark:border-white/10 dark:bg-white/[.05]"}`;
}

async function adminRequest(path = "", options = {}) {
  if (localMode) {
    const method = options.method || "GET";
    if (!path && method === "GET") {
      const [settings, characters] = await Promise.all([runtimeSettingsReady, localCharacters()]);
      return {
        settings,
        characters,
        campaigns: [],
        users: [],
        themes: [],
        campaignStorageAvailable: false,
        npcStorageAvailable: false,
        themeStorageAvailable: false,
      };
    }
    if (path === "/settings" && method === "PUT") {
      return { ok: true, settings: persistLocalRuntimeSettings(JSON.parse(options.body)) };
    }
    throw new Error("Character availability requires D1 and cannot be changed in local mode.");
  }
  const response = await fetch(`api/admin${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `Admin request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function campaignMembership(user, campaignId) {
  return (user.campaignMemberships || []).find((membership) => membership.campaignId === campaignId);
}

function characterAssigned(user, campaignId, characterId) {
  return (user.characterAssignments || []).some((assignment) => (
    assignment.campaignId === campaignId && assignment.characterId === characterId
  ));
}

function managedCharacterCount(user) {
  return (snapshot?.campaigns || []).reduce((count, campaign) => {
    const activeCharacters = (campaign.characters || []).filter((character) => character.active);
    const membership = campaignMembership(user, campaign.id);
    if (user.isPrimaryAdmin || membership?.role === "dm") return count + activeCharacters.length;
    if (membership?.role !== "player") return count;
    return count + activeCharacters.filter((character) => characterAssigned(user, campaign.id, character.id)).length;
  }, 0);
}

function visibleNpcCount(user) {
  return (snapshot?.campaigns || []).reduce((count, campaign) => {
    const membership = campaignMembership(user, campaign.id);
    if (!user.isPrimaryAdmin && !membership) return count;
    const npcs = (campaign.npcs || []).filter((npc) => npc.active);
    return count + (user.isPrimaryAdmin || membership?.role === "dm"
      ? npcs.length
      : npcs.filter((npc) => npc.playerVisible).length);
  }, 0);
}

function campaignRoleSummary(user) {
  const characterCount = managedCharacterCount(user);
  const npcCount = visibleNpcCount(user);
  const entityBadges = snapshot?.campaignStorageAvailable === false ? "" : `
    <span class="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-700 dark:text-sky-300" title="Characters this person can edit">${characterCount} Character${characterCount === 1 ? "" : "s"}</span>
    ${snapshot?.npcStorageAvailable === false ? "" : `<span class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300" title="NPCs this person can access">${npcCount} NPC${npcCount === 1 ? "" : "s"}</span>`}`;
  if (user.isPrimaryAdmin) {
    return `<span class="rounded-full bg-blood-500 px-2.5 py-1 text-xs font-bold text-white">Site admin · all campaigns</span>${entityBadges}`;
  }
  const memberships = user.campaignMemberships || [];
  if (!memberships.length) return `<span class="text-xs text-stone-500 dark:text-stone-400">No campaigns</span>${entityBadges}`;
  const dmCount = memberships.filter((membership) => membership.role === "dm").length;
  const playerCount = memberships.length - dmCount;
  return `<span class="rounded-full bg-theme-surface-strong px-2.5 py-1 text-xs font-bold">${memberships.length} campaign${memberships.length === 1 ? "" : "s"}</span>${dmCount ? `<span class="rounded-full bg-blood-500/15 px-2.5 py-1 text-xs font-bold text-blood-500">${dmCount} DM</span>` : ""}${playerCount ? `<span class="rounded-full bg-theme-surface-strong px-2.5 py-1 text-xs font-bold">${playerCount} Player</span>` : ""}${entityBadges}`;
}

function renderCampaignRoles(user) {
  if (snapshot?.campaignStorageAvailable === false) {
    return '<p class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Campaign roles require migration 0012.</p>';
  }
  if (!snapshot?.campaigns?.length) {
    return '<p class="text-sm text-stone-500 dark:text-stone-400">No campaigns found. Create one from the Campaigns page.</p>';
  }
  if (user.isPrimaryAdmin) {
    return `<p class="rounded-xl border border-blood-500/30 bg-blood-500/10 p-3 text-sm"><strong>Site admin access</strong><span class="mt-1 block text-stone-600 dark:text-stone-300">Full DM-level access to all ${snapshot.campaigns.length} campaign${snapshot.campaigns.length === 1 ? "" : "s"}; no membership record needed.</span></p>`;
  }
  return `<div class="grid gap-2">${snapshot.campaigns.map((campaign) => {
    const membership = campaignMembership(user, campaign.id);
    return `<label class="grid gap-3 rounded-xl border border-stone-300 p-3 dark:border-white/10 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
      <span class="min-w-0"><strong class="block truncate">${escapeHTML(campaign.name)}</strong><small class="text-stone-500 dark:text-stone-400">/${escapeHTML(campaign.slug)}</small></span>
      <select data-user-campaign-role data-campaign-id="${escapeHTML(campaign.id)}" class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold dark:border-white/15 dark:bg-stone-900" aria-label="Role in ${escapeHTML(campaign.name)}">
        <option value=""${membership ? "" : " selected"}>Not a member</option>
        <option value="player"${membership?.role === "player" ? " selected" : ""}>Player</option>
        <option value="dm"${membership?.role === "dm" ? " selected" : ""}>DM</option>
      </select>
    </label>`;
  }).join("")}</div>`;
}

function renderUserCharacterAssignments(user) {
  if (snapshot?.campaignStorageAvailable === false) {
    return '<p class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Character assignments require migration 0012.</p>';
  }
  if (user.isPrimaryAdmin) {
    return '<p class="rounded-xl border border-blood-500/30 bg-blood-500/10 p-3 text-sm">Site admin access already includes every campaign character and NPC.</p>';
  }
  const memberships = user.campaignMemberships || [];
  const playerCampaigns = (snapshot?.campaigns || []).filter((campaign) => (
    memberships.some((membership) => membership.campaignId === campaign.id && membership.role === "player")
  ));
  const dmCampaigns = (snapshot?.campaigns || []).filter((campaign) => (
    memberships.some((membership) => membership.campaignId === campaign.id && membership.role === "dm")
  ));
  const playerControls = playerCampaigns.map((campaign) => `
    <fieldset class="rounded-xl border border-stone-300 p-3 dark:border-white/10">
      <legend class="px-1 text-sm font-bold">${escapeHTML(campaign.name)}</legend>
      <div class="mt-1 grid gap-2 sm:grid-cols-2">${(campaign.characters || []).map((character) => `
        <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-white/10">
          <input type="checkbox" data-user-character-assignment data-campaign-id="${escapeHTML(campaign.id)}" data-character-id="${escapeHTML(character.id)}" class="accent-red-700"${characterAssigned(user, campaign.id, character.id) ? " checked" : ""}>
          <span class="min-w-0"><strong class="block truncate">${escapeHTML(character.name)}</strong>${character.active ? "" : '<small class="text-stone-500 dark:text-stone-400">Hidden from campaign list</small>'}</span>
        </label>`).join("") || '<span class="text-sm text-stone-500 dark:text-stone-400">No characters in this campaign.</span>'}</div>
    </fieldset>`).join("");
  const dmNote = dmCampaigns.length
    ? `<p class="rounded-xl bg-theme-surface-strong p-3 text-sm"><strong>DM access:</strong> all characters and NPCs in ${dmCampaigns.map((campaign) => escapeHTML(campaign.name)).join(", ")}.</p>`
    : "";
  return `${dmNote}${playerControls || (!dmNote
    ? '<p class="text-sm text-stone-500 dark:text-stone-400">Assign a Player campaign role before assigning characters.</p>'
    : "")}`;
}

function refreshUserEntityDisplays() {
  (snapshot?.users || []).forEach((user) => {
    const card = [...userRoot.querySelectorAll("[data-user]")].find((item) => item.dataset.user === user.id);
    if (!card) return;
    card.querySelector("[data-user-campaign-summary]").innerHTML = campaignRoleSummary(user);
    card.querySelector("[data-user-character-assignments]").innerHTML = renderUserCharacterAssignments(user);
  });
}

function renderUsers(users = []) {
  if (localMode) {
    userRoot.innerHTML = '<p class="text-sm text-stone-500">User accounts require D1 and are not available in local static mode.</p>';
    return;
  }
  userRoot.innerHTML = users.map((user) => `
    <details class="group rounded-2xl border border-stone-300 dark:border-white/15" data-user="${escapeHTML(user.id)}">
      <summary class="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blood-500/15 font-display text-lg font-bold text-blood-500">${escapeHTML(user.email.slice(0, 1).toUpperCase())}</span>
        <span class="min-w-0 grow"><strong class="block truncate">${escapeHTML(user.email)}</strong><span data-user-campaign-summary class="mt-1 flex flex-wrap gap-1.5">${campaignRoleSummary(user)}</span></span>
        <span class="ml-auto flex items-center gap-3"><small class="hidden text-stone-500 dark:text-stone-400 sm:block">Created ${escapeHTML(new Date(user.createdAt).toLocaleDateString())}</small><i class="bi bi-chevron-down transition group-open:rotate-180"></i></span>
      </summary>
      <div class="space-y-5 border-t border-stone-300 p-4 dark:border-white/10">
        <section><h3 class="font-display text-lg font-bold">Campaign roles</h3><p class="mb-3 mt-1 text-sm text-stone-500 dark:text-stone-400">Membership and permissions are isolated per campaign.</p>${renderCampaignRoles(user)}</section>
        <section class="border-t border-stone-300 pt-4 dark:border-white/10"><h3 class="font-display text-lg font-bold">Assigned characters</h3><p class="mb-3 mt-1 text-sm text-stone-500 dark:text-stone-400">Players edit checked characters. DMs already manage everything in their campaigns.</p><div data-user-character-assignments class="space-y-3">${renderUserCharacterAssignments(user)}</div></section>
        ${snapshot?.themeStorageAvailable === false
        ? '<p class="border-t border-stone-300 pt-4 text-sm text-stone-500 dark:border-white/10 dark:text-stone-400">Theme assignment requires migration 0008 and is currently unavailable.</p>'
        : `<label class="block border-t border-stone-300 pt-4 dark:border-white/10"><span class="mb-1 block text-sm font-bold">Theme</span>
        <select data-user-theme class="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-bold dark:border-white/15 dark:bg-stone-900">
          ${(snapshot?.themes || []).map((theme) => `<option value="${escapeHTML(theme.id)}"${(user.themePreference?.themeId || BASE_THEME_ID) === theme.id ? " selected" : ""}>${escapeHTML(theme.name)}</option>`).join("")}
        </select>
        <small class="mt-1 block text-stone-500 dark:text-stone-400">Keeps this user's Standard/Reversed and font choices. Latest save wins.</small>
        </label>`}
        <details class="rounded-xl border border-stone-300 dark:border-white/10">
          <summary class="cursor-pointer list-none px-3 py-2.5 text-sm font-bold"><i class="bi bi-box-arrow-up-right mr-2 text-blood-500"></i>Legacy page access</summary>
          <fieldset class="grid gap-2 border-t border-stone-300 p-3 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-3"${user.isPrimaryAdmin ? " disabled" : ""}>
            <legend class="sr-only">Legacy page access</legend>
            ${Object.entries(legacyAccessLabels).map(([role, label]) => `
              <label class="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-white/10">
                <input type="checkbox" data-user-role="${role}" class="accent-red-700"${user.roles.includes(role) ? " checked" : ""}${["characters", "player-screen"].includes(role) ? " disabled" : ""}> ${label}
              </label>`).join("")}
          </fieldset>
        </details>
      <div class="flex flex-col gap-3 border-t border-stone-300 pt-4 dark:border-white/10 sm:flex-row sm:items-end">
        <label class="grow"><span class="mb-1 block text-sm font-bold">New password</span><input type="password" data-user-password minlength="10" autocomplete="new-password" class="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5" placeholder="10+ characters, number, special character"></label>
        <button type="button" data-reset-password class="rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500">Reset password</button>
      </div>
      </div>
    </details>`).join("") || '<p class="text-sm text-stone-500">No user accounts found.</p>';
}

function themeSwatch(label, name, hex) {
  return `<div class="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2"><span class="h-8 w-8 rounded-lg border border-black/15" style="background:${escapeHTML(hex)}"></span><span class="min-w-0"><strong class="block truncate text-xs">${label}: ${escapeHTML(name)}</strong><code class="text-xs text-stone-500 dark:text-stone-400">${escapeHTML(hex)}</code></span></div>`;
}

function renderThemes(themes = []) {
  const available = !localMode && snapshot?.themeStorageAvailable !== false;
  themeUnavailable.classList.toggle("hidden", available);
  addThemeButton.disabled = !available;
  addThemeButton.classList.toggle("opacity-50", !available);
  if (!available) {
    themeRoot.replaceChildren();
    return;
  }
  themeRoot.innerHTML = themes.map((theme) => `
    <article data-admin-theme="${escapeHTML(theme.id)}" class="rounded-2xl border border-stone-300 p-4 dark:border-white/15">
      <div class="flex items-start justify-between gap-3"><h3 class="font-display text-lg font-bold">${escapeHTML(theme.name)}</h3>${theme.protected
        ? '<span class="rounded-full bg-theme-surface-strong px-2 py-1 text-xs font-bold">Protected</span>'
        : `<span class="flex gap-1"><button type="button" data-edit-theme class="rounded-lg border border-stone-300 px-2 py-1 text-xs font-bold hover:border-blood-500 hover:text-blood-500 dark:border-white/15"><i class="bi bi-pencil mr-1"></i>Edit</button><button type="button" data-remove-theme class="rounded-lg border border-danger-500 px-2 py-1 text-xs font-bold text-danger-500 hover:bg-danger-500 hover:text-white"><i class="bi bi-trash mr-1"></i>Remove</button></span>`}</div>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">${themeSwatch("Background", theme.backgroundName, theme.backgroundHex)}${themeSwatch("Accent", theme.accentName, theme.accentHex)}</div>
      <p class="mt-3 text-xs text-stone-500 dark:text-stone-400">People using this theme: ${Number(theme.peopleUsingTheme) || 0}</p>
    </article>`).join("");
}

function themeFormValue() {
  return {
    name: document.getElementById("theme-editor-name").value,
    backgroundName: document.getElementById("theme-editor-background-name").value,
    backgroundHex: document.getElementById("theme-editor-background-hex").value,
    accentName: document.getElementById("theme-editor-accent-name").value,
    accentHex: document.getElementById("theme-editor-accent-hex").value,
  };
}

function updateThemePreview() {
  const backgroundHex = normalizeHex(document.getElementById("theme-editor-background-hex").value) || "#18181B";
  const accentHex = normalizeHex(document.getElementById("theme-editor-accent-hex").value) || "#B83B35";
  const preview = document.getElementById("theme-editor-preview");
  preview.style.backgroundColor = backgroundHex;
  preview.style.color = readableForeground(backgroundHex);
  preview.style.borderColor = accentHex;
  preview.innerHTML = `<span><span class="block">Live preview</span><span class="mt-2 inline-block rounded-lg px-3 py-1 text-sm" style="background:${accentHex};color:${readableForeground(accentHex)}">Accent</span></span>`;
}

function openThemeEditor(theme = null, trigger = addThemeButton) {
  themeEditorReturnFocus = trigger;
  document.getElementById("theme-editor-title").textContent = theme ? "Edit Theme" : "Add Theme";
  document.getElementById("theme-editor-id").value = theme?.id || "";
  document.getElementById("theme-editor-name").value = theme?.name || "";
  document.getElementById("theme-editor-background-name").value = theme?.backgroundName || "";
  document.getElementById("theme-editor-background-hex").value = theme?.backgroundHex || "#18181B";
  document.getElementById("theme-editor-background-color").value = (theme?.backgroundHex || "#18181B").toLowerCase();
  document.getElementById("theme-editor-accent-name").value = theme?.accentName || "";
  document.getElementById("theme-editor-accent-hex").value = theme?.accentHex || "#B83B35";
  document.getElementById("theme-editor-accent-color").value = (theme?.accentHex || "#B83B35").toLowerCase();
  document.getElementById("theme-editor-status").textContent = "";
  updateThemePreview();
  themeEditor.open();
}

function renderSections(sections) {
  sectionRoot.innerHTML = Object.entries(sectionLabels).map(([id, label]) => `
    <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
      <input type="checkbox" data-section="${id}" class="h-5 w-5 accent-red-700"${sections[id] !== false ? " checked" : ""}>
      <span class="font-bold">${label}</span>
    </label>`).join("");
}

function campaignEntityRow(campaign, entity, kind) {
  const kindLabel = kind === "characters" ? "Character" : "NPC";
  const detail = kind === "characters"
    ? `${entity.id} · ${entity.source}`
    : `${entity.id} · ${entity.playerVisible ? "Shown to players" : "Hidden from players"}`;
  return `
    <label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
      <span class="min-w-0"><strong class="block truncate">${escapeHTML(entity.name)}</strong><small class="text-stone-500 dark:text-stone-400">${escapeHTML(detail)}</small></span>
      <span class="flex shrink-0 items-center gap-2 text-sm font-bold"><span data-entity-state>${entity.active ? "Available" : "Hidden"}</span><input type="checkbox" data-campaign-entity data-campaign-id="${escapeHTML(campaign.id)}" data-entity-kind="${kind}" data-entity-id="${escapeHTML(entity.id)}" class="h-5 w-5 accent-red-700" aria-label="${entity.active ? "Hide" : "Show"} ${kindLabel} ${escapeHTML(entity.name)}"${entity.active ? " checked" : ""}></span>
    </label>`;
}

function renderCampaignEntities(campaigns) {
  if (localMode) {
    characterRoot.innerHTML = '<p class="text-sm text-stone-500">Campaign character and NPC availability requires D1.</p>';
    return;
  }
  if (snapshot?.campaignStorageAvailable === false) {
    characterRoot.innerHTML = '<p class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Campaign availability requires migration 0012.</p>';
    return;
  }
  characterRoot.innerHTML = campaigns.map((campaign) => {
    const characters = campaign.characters || [];
    const npcs = campaign.npcs || [];
    const activeCharacters = characters.filter((character) => character.active).length;
    const activeNpcs = npcs.filter((npc) => npc.active).length;
    return `
      <details data-admin-campaign="${escapeHTML(campaign.id)}" class="group rounded-xl border border-stone-300 dark:border-white/10">
        <summary class="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
          <span class="min-w-0 grow"><strong class="block truncate">${escapeHTML(campaign.name)}</strong><small class="text-stone-500 dark:text-stone-400">/${escapeHTML(campaign.slug)}</small></span>
          <span data-campaign-character-count class="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-700 dark:text-sky-300">${activeCharacters}/${characters.length} Characters</span>
          ${snapshot?.npcStorageAvailable === false ? '<span class="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">NPC storage unavailable</span>' : `<span data-campaign-npc-count class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">${activeNpcs}/${npcs.length} NPCs</span>`}
          <i class="bi bi-chevron-down ml-1 transition group-open:rotate-180"></i>
        </summary>
        <div class="border-t border-stone-300 p-4 dark:border-white/10">
          <h4 class="font-display text-lg font-bold">Characters</h4>
          <div class="mt-2 space-y-2">${characters.map((character) => campaignEntityRow(campaign, character, "characters")).join("") || '<p class="text-sm text-stone-500 dark:text-stone-400">No characters stored.</p>'}</div>
          <div class="my-4 border-t border-stone-300 dark:border-white/10"></div>
          <h4 class="font-display text-lg font-bold">NPCs</h4>
          <div class="mt-2 space-y-2">${snapshot?.npcStorageAvailable === false
            ? '<p class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">NPC availability requires migration 0016.</p>'
            : npcs.map((npc) => campaignEntityRow(campaign, npc, "npcs")).join("") || '<p class="text-sm text-stone-500 dark:text-stone-400">No NPCs stored.</p>'}</div>
        </div>
      </details>`;
  }).join("") || '<p class="text-sm text-stone-500">No campaigns are stored in D1.</p>';
}

function renderCharacterStyles(characters, overrides = {}) {
  characterStyleRoot.innerHTML = characters.map((character) => {
    const selected = overrides[character.id] || "default";
    return `
      <label class="flex items-center justify-between gap-4 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
        <span class="min-w-0"><strong class="block truncate">${escapeHTML(character.name)}</strong><small class="text-stone-500 dark:text-stone-400">${escapeHTML(character.id)}</small></span>
        <select data-character-style="${escapeHTML(character.id)}" class="min-w-32 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold dark:border-white/15 dark:bg-stone-900">
          <option value="default"${selected === "default" ? " selected" : ""}>Use default</option>
          <option value="v1"${selected === "v1" ? " selected" : ""}>Style v1</option>
          <option value="v2"${selected === "v2" ? " selected" : ""}>Style v2</option>
          <option value="v3"${selected === "v3" ? " selected" : ""}>Style v3</option>
        </select>
      </label>`;
  }).join("") || '<p class="text-sm text-stone-500">No characters are currently available for individual overrides.</p>';
}

async function unlock() {
  try {
    snapshot = await adminRequest();
    document.getElementById("admin-campaign-count").textContent = String(snapshot.campaigns?.length || 0);
    document.getElementById("admin-user-count").textContent = String(snapshot.users?.length || 0);
    document.getElementById("admin-theme-count").textContent = String(snapshot.themes?.length || 0);
    openWrites.checked = snapshot.settings.openWrites;
    const selectedStyle = characterStyleInputs.find(
      (input) => input.value === snapshot.settings.characterSheetStyle,
    ) || characterStyleInputs[0];
    selectedStyle.checked = true;
    renderSections(snapshot.settings.sections);
    renderCharacterStyles(snapshot.characters, snapshot.settings.characterSheetStyleOverrides);
    renderCampaignEntities(snapshot.campaigns || []);
    renderThemes(snapshot.themes);
    renderUsers(snapshot.users);
    content.classList.remove("hidden");
    setStatus(localMode
      ? "Local mode: settings are stored in this browser's localStorage. No password or D1 connection is used."
      : "Connected to the shared D1 configuration.", "success");
  } catch (error) {
    content.classList.add("hidden");
    if (error.status === 401) location.replace("login/?error=Primary%20administrator%20access%20required.");
    else setStatus(error.message, "error");
  }
}

document.getElementById("save-settings").addEventListener("click", async () => {
  const sections = Object.fromEntries([...sectionRoot.querySelectorAll("[data-section]")]
    .map((input) => [input.dataset.section, input.checked]));
  const characterSheetStyle = characterStyleInputs.find((input) => input.checked)?.value || "v1";
  const characterSheetStyleOverrides = { ...(snapshot.settings.characterSheetStyleOverrides || {}) };
  characterStyleRoot.querySelectorAll("[data-character-style]").forEach((select) => {
    if (select.value === "default") delete characterSheetStyleOverrides[select.dataset.characterStyle];
    else characterSheetStyleOverrides[select.dataset.characterStyle] = select.value;
  });
  try {
    const result = await adminRequest("/settings", {
      method: "PUT",
      body: JSON.stringify({
        sections,
        openWrites: openWrites.checked,
        characterSheetStyle,
        characterSheetStyleOverrides,
      }),
    });
    snapshot.settings = result.settings;
    setStatus(localMode
      ? "Settings saved to localStorage. Other local pages will use them on their next load."
      : "Settings saved to D1. Other pages will use them on their next load.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

characterRoot.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-campaign-entity]");
  if (!input) return;
  const campaign = snapshot.campaigns.find((item) => item.id === input.dataset.campaignId);
  const collection = input.dataset.entityKind === "characters" ? campaign?.characters : campaign?.npcs;
  const entity = collection?.find((item) => item.id === input.dataset.entityId);
  if (!campaign || !entity) return;
  input.disabled = true;
  try {
    await adminRequest(`/campaigns/${encodeURIComponent(campaign.id)}/entities/${encodeURIComponent(input.dataset.entityKind)}/${encodeURIComponent(entity.id)}`, {
      method: "PUT",
      body: JSON.stringify({ active: input.checked }),
    });
    entity.active = input.checked;
    input.closest("label").querySelector("[data-entity-state]").textContent = input.checked ? "Available" : "Hidden";
    input.setAttribute("aria-label", `${input.checked ? "Hide" : "Show"} ${input.dataset.entityKind === "characters" ? "Character" : "NPC"} ${entity.name}`);
    const card = input.closest("[data-admin-campaign]");
    const activeCount = collection.filter((item) => item.active).length;
    const count = card.querySelector(input.dataset.entityKind === "characters" ? "[data-campaign-character-count]" : "[data-campaign-npc-count]");
    if (count) count.textContent = `${activeCount}/${collection.length} ${input.dataset.entityKind === "characters" ? "Characters" : "NPCs"}`;
    refreshUserEntityDisplays();
    setStatus(`${entity.name} is now ${input.checked ? "available" : "hidden"} in ${campaign.name}.`, "success");
  } catch (error) {
    input.checked = !input.checked;
    setStatus(error.message, "error");
  } finally {
    input.disabled = false;
  }
});

document.getElementById("admin-lock").addEventListener("click", () => {
  logout();
});

userRoot.addEventListener("change", async (event) => {
  const assignmentInput = event.target.closest("[data-user-character-assignment]");
  if (assignmentInput) {
    const card = assignmentInput.closest("[data-user]");
    const user = snapshot.users.find((item) => item.id === card.dataset.user);
    const campaign = snapshot.campaigns.find((item) => item.id === assignmentInput.dataset.campaignId);
    const character = campaign?.characters?.find((item) => item.id === assignmentInput.dataset.characterId);
    if (!user || !campaign || !character) return;
    assignmentInput.disabled = true;
    try {
      await adminRequest(`/users/${encodeURIComponent(user.id)}/campaigns/${encodeURIComponent(campaign.id)}/characters/${encodeURIComponent(character.id)}`, {
        method: assignmentInput.checked ? "PUT" : "DELETE",
      });
      user.characterAssignments = (user.characterAssignments || []).filter((assignment) => (
        assignment.campaignId !== campaign.id || assignment.characterId !== character.id
      ));
      if (assignmentInput.checked) user.characterAssignments.push({ campaignId: campaign.id, characterId: character.id });
      card.querySelector("[data-user-campaign-summary]").innerHTML = campaignRoleSummary(user);
      setStatus(`${character.name} ${assignmentInput.checked ? "assigned to" : "removed from"} ${user.email}.`, "success");
    } catch (error) {
      assignmentInput.checked = !assignmentInput.checked;
      setStatus(error.message, "error");
    } finally {
      assignmentInput.disabled = false;
    }
    return;
  }
  const themeSelect = event.target.closest("[data-user-theme]");
  if (themeSelect) {
    const card = themeSelect.closest("[data-user]");
    const previousPreference = snapshot.users.find((item) => item.id === card.dataset.user)?.themePreference;
    const previous = previousPreference?.themeId || BASE_THEME_ID;
    themeSelect.disabled = true;
    try {
      const result = await adminRequest(`/users/${encodeURIComponent(card.dataset.user)}/theme`, {
        method: "PUT",
        body: JSON.stringify({ themeId: themeSelect.value }),
      });
      const user = snapshot.users.find((item) => item.id === card.dataset.user);
      if (user) user.themePreference = result.themePreference;
      snapshot.themes.forEach((theme) => {
        if (previousPreference && theme.id === previous) theme.peopleUsingTheme = Math.max(0, (Number(theme.peopleUsingTheme) || 0) - 1);
        if (theme.id === themeSelect.value) theme.peopleUsingTheme = (Number(theme.peopleUsingTheme) || 0) + 1;
      });
      renderThemes(snapshot.themes);
      setStatus("User theme saved. Their reverse and font choices were preserved.", "success");
    } catch (error) {
      themeSelect.value = previous;
      setStatus(error.message, "error");
    } finally {
      themeSelect.disabled = false;
    }
    return;
  }
  const campaignSelect = event.target.closest("[data-user-campaign-role]");
  if (campaignSelect) {
    const card = campaignSelect.closest("[data-user]");
    const user = snapshot.users.find((item) => item.id === card.dataset.user);
    const campaign = snapshot.campaigns.find((item) => item.id === campaignSelect.dataset.campaignId);
    const previousMembership = campaignMembership(user, campaign.id);
    const previousRole = previousMembership?.role || "";
    const role = campaignSelect.value;
    if (!role && previousMembership && !globalThis.confirm(`Remove ${user.email} from ${campaign.name}? Their character assignments in this campaign will also be removed.`)) {
      campaignSelect.value = previousRole;
      return;
    }
    campaignSelect.disabled = true;
    try {
      const result = await adminRequest(`/users/${encodeURIComponent(user.id)}/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: role ? "PUT" : "DELETE",
        ...(role ? { body: JSON.stringify({ role }) } : {}),
      });
      user.campaignMemberships = (user.campaignMemberships || [])
        .filter((membership) => membership.campaignId !== campaign.id);
      if (result.membership) user.campaignMemberships.push(result.membership);
      if (!result.membership) {
        user.characterAssignments = (user.characterAssignments || [])
          .filter((assignment) => assignment.campaignId !== campaign.id);
      }
      refreshUserEntityDisplays();
      setStatus(role
        ? `${user.email} is now ${role === "dm" ? "DM" : "Player"} in ${campaign.name}.`
        : `${user.email} was removed from ${campaign.name}.`, "success");
    } catch (error) {
      campaignSelect.value = previousRole;
      setStatus(error.message, "error");
    } finally {
      campaignSelect.disabled = false;
    }
    return;
  }
  const input = event.target.closest("[data-user-role]");
  if (!input) return;
  const card = input.closest("[data-user]");
  const roles = [...card.querySelectorAll("[data-user-role]:checked")].map((item) => item.dataset.userRole);
  const roleInputs = [...card.querySelectorAll("[data-user-role]")];
  roleInputs.forEach((control) => { control.disabled = true; });
  try {
    const result = await adminRequest(`/users/${encodeURIComponent(card.dataset.user)}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roles }),
    });
    const user = snapshot.users.find((item) => item.id === card.dataset.user);
    if (user) user.roles = result.roles;
    setStatus("User roles saved.", "success");
  } catch (error) {
    input.checked = !input.checked;
    setStatus(error.message, "error");
  } finally {
    roleInputs.forEach((control) => {
      control.disabled = ["characters", "player-screen"].includes(control.dataset.userRole);
    });
  }
});

addThemeButton.addEventListener("click", () => openThemeEditor());
themeEditorRoot.querySelectorAll("[data-close-theme-editor]").forEach((button) => {
  button.addEventListener("click", themeEditor.close);
});

themeEditorForm.addEventListener("input", (event) => {
  const pairs = {
    "theme-editor-background-color": "theme-editor-background-hex",
    "theme-editor-accent-color": "theme-editor-accent-hex",
    "theme-editor-background-hex": "theme-editor-background-color",
    "theme-editor-accent-hex": "theme-editor-accent-color",
  };
  const pairedId = pairs[event.target.id];
  if (pairedId) {
    const normalized = normalizeHex(event.target.value);
    if (event.target.type === "color") document.getElementById(pairedId).value = normalized;
    else if (normalized) document.getElementById(pairedId).value = normalized.toLowerCase();
  }
  updateThemePreview();
});

themeEditorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("theme-editor-id").value;
  const saveButton = document.getElementById("save-theme");
  const editorStatus = document.getElementById("theme-editor-status");
  saveButton.disabled = true;
  editorStatus.textContent = "Saving theme...";
  try {
    const result = await adminRequest(id ? `/themes/${encodeURIComponent(id)}` : "/themes", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(themeFormValue()),
    });
    const existing = snapshot.themes.find((theme) => theme.id === result.theme.id);
    result.theme.peopleUsingTheme = existing?.peopleUsingTheme || 0;
    snapshot.themes = sortThemes([
      ...snapshot.themes.filter((theme) => theme.id !== result.theme.id),
      result.theme,
    ]);
    renderThemes(snapshot.themes);
    renderUsers(snapshot.users);
    themeEditor.forceClose("saved");
    setStatus(`${result.theme.name} ${id ? "updated" : "added"}.`, "success");
  } catch (error) {
    editorStatus.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

themeRoot.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-admin-theme]");
  if (!card) return;
  const theme = snapshot.themes.find((item) => item.id === card.dataset.adminTheme);
  if (!theme || theme.protected) return;
  const edit = event.target.closest("[data-edit-theme]");
  if (edit) {
    openThemeEditor(theme, edit);
    return;
  }
  const remove = event.target.closest("[data-remove-theme]");
  if (!remove) return;
  const people = Number(theme.peopleUsingTheme) || 0;
  const warning = `People using this theme: ${people}. Removing it will return them to Cassian’s Classic.`;
  if (!globalThis.confirm(`${warning}\n\nRemove ${theme.name}?`)) return;
  remove.disabled = true;
  try {
    const result = await adminRequest(`/themes/${encodeURIComponent(theme.id)}${people ? "?confirm=1" : ""}`, {
      method: "DELETE",
    });
    snapshot.themes = snapshot.themes.filter((item) => item.id !== theme.id);
    snapshot.users.forEach((user) => {
      if (user.themePreference?.themeId === theme.id) {
        user.themePreference = {
          themeId: BASE_THEME_ID,
          reversed: false,
          fontMode: "auto",
          backgroundId: DEFAULT_BACKGROUND_ID,
          updatedAt: null,
        };
      }
    });
    renderThemes(snapshot.themes);
    renderUsers(snapshot.users);
    setStatus(`${theme.name} removed. ${result.resetUsers || 0} user${result.resetUsers === 1 ? "" : "s"} returned to Cassian’s Classic.`, "success");
  } catch (error) {
    remove.disabled = false;
    setStatus(error.message, "error");
  }
});

userRoot.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-reset-password]");
  if (!button) return;
  const card = button.closest("[data-user]");
  const passwordInput = card.querySelector("[data-user-password]");
  if (!passwordInput.value) return setStatus("Enter a new password first.", "error");
  button.disabled = true;
  try {
    await adminRequest(`/users/${encodeURIComponent(card.dataset.user)}/password`, {
      method: "PUT",
      body: JSON.stringify({ password: passwordInput.value }),
    });
    passwordInput.value = "";
    setStatus("Password reset. That account has been signed out on every device.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

if (localMode) {
  document.getElementById("admin-lock").hidden = true;
  document.getElementById("admin-description").textContent = "Runtime settings are saved to this browser's localStorage on localhost; D1 is not required.";
}

unlock();

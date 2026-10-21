// Neutral presentation metadata; authorization remains with the existing role engine.
export const NAVIGATION_GROUPS = Object.freeze(["Campaign", "Play", "Reference", "Management"]);
export const PAGE_CATALOG = Object.freeze([
  { id: "campaigns", href: "campaigns/", icon: "bi-collection-fill", label: "Campaigns", group: "Campaign", global: true },
  { id: "characters", href: "char/", icon: "bi-people-fill", label: "Characters", group: "Play" },
  { id: "npcs", href: "npc/", icon: "bi-person-badge-fill", label: "NPCs", group: "Play" },
  { id: "combat-loot", href: "combat-loot/", icon: "bi-shield-shaded", label: "Combat & Loot", group: "Play" },
  { id: "player-screen", href: "player-screen/", icon: "bi-grid-fill", label: "Player Screen", group: "Play" },
  { id: "dm-screen", href: "dm-screen/", icon: "bi-shield-shaded", label: "DM Screen", group: "Play" },
  { id: "music", href: "music/", icon: "bi-music-note-beamed", label: "Music", group: "Play" },
  { id: "wiki", href: "wiki/", icon: "bi-book-half", label: "Wiki", group: "Reference" },
  { id: "compendium", href: "compendium/", icon: "bi-journals", label: "Compendium", group: "Reference" },
  { id: "public-initiative", href: "public-initiative/", icon: "bi-list-ol", label: "Public Initiative", group: "Play" },
  { id: "admin", href: "admin/", icon: "bi-shield-lock-fill", label: "Admin", group: "Management", global: true },
  { id: "campaign-manage", href: "manage", icon: "bi-gear-fill", label: "Manage Campaign", group: "Management" },
].map(Object.freeze));

export const DENSITY_PAGES = Object.freeze([
  ...PAGE_CATALOG,
  { id: "character-tracker", label: "Character tracker" },
  { id: "npc-tracker", label: "NPC tracker" },
  { id: "character-builder", label: "Character builder" },
  { id: "npc-builder", label: "NPC builder" },
  { id: "login", label: "Login" },
].map(Object.freeze));

export function uiPageId(activePage, { tracker = false, npc = false, builder = false } = {}) {
  if (tracker) return npc ? "npc-tracker" : "character-tracker";
  if (builder) return npc ? "npc-builder" : "character-builder";
  return activePage;
}

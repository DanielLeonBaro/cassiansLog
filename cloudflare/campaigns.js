// Resolves campaign identity and enforces membership-based access for every scoped route.
import { error, parseStored } from "./http.js";
import { hashPassword, userFromRequest, verifyPassword } from "./user-auth.js";

export const LEGACY_CAMPAIGN_ID = "campaign-breugaire";
export const LEGACY_CAMPAIGN_SLUG = "aotr";
export const CAMPAIGN_SLUG_PATTERN = /^[a-z]{2,48}$/;
export const CAMPAIGN_NAME_MAX = 80;
export const CAMPAIGN_PASSWORD_MAX = 128;
export const CAMPAIGN_DESCRIPTION_MAX = 280;
export const CAMPAIGN_BANNER_MAX = 700_000;

const DEFAULT_CAMPAIGN_SECTIONS = {
  characters: true,
  "player-screen": true,
  "dm-screen": true,
  "combat-loot": true,
  "public-initiative": true,
  music: true,
  compendium: true,
  wiki: true,
  "character-overview": true,
  "character-stats": true,
  "hit-points": true,
  combat: true,
  spellcasting: true,
  "prepared-spells": true,
  "all-possibilities": true,
  inventory: true,
  notes: true,
};

export function defaultCampaignSettings() {
  return {
    sections: { ...DEFAULT_CAMPAIGN_SECTIONS },
    characterSheetStyle: "v1",
    characterSheetStyleOverrides: {},
  };
}

export function normalizeCampaignSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 48);
}

export function validCampaignSlug(value) {
  return CAMPAIGN_SLUG_PATTERN.test(value || "");
}

export function campaignName(value) {
  const name = String(value || "").trim();
  return name && name.length <= CAMPAIGN_NAME_MAX ? name : "";
}

export function campaignDescription(value) {
  const description = String(value || "").trim();
  return description.length <= CAMPAIGN_DESCRIPTION_MAX ? description : null;
}

export function campaignBanner(value) {
  const banner = String(value || "");
  if (!banner) return "";
  return banner.length <= CAMPAIGN_BANNER_MAX && /^data:image\/(?:webp|png|jpe?g|gif);base64,/i.test(banner)
    ? banner
    : null;
}

export function campaignPasswordProblem(value) {
  if (typeof value !== "string" || value.length < 6) return "Campaign password must contain at least 6 characters.";
  if (value.length > CAMPAIGN_PASSWORD_MAX) return `Campaign password cannot exceed ${CAMPAIGN_PASSWORD_MAX} characters.`;
  if (!value.trim()) return "Campaign password cannot contain only spaces.";
  return "";
}

export async function campaignFromSlug(slug, env) {
  return env.DB.prepare(
    `SELECT campaigns.id, campaigns.name, campaigns.description, campaigns.banner, campaigns.join_enabled, campaigns.created_by_user_id,
      campaigns.join_password_hash, campaigns.join_password_salt, campaigns.join_password_iterations,
      requested.slug AS requested_slug, requested.is_current AS requested_is_current,
      current.slug AS current_slug, campaigns.created_at, campaigns.updated_at
    FROM campaign_slugs AS requested
    JOIN campaigns ON campaigns.id = requested.campaign_id
    JOIN campaign_slugs AS current ON current.campaign_id = campaigns.id AND current.is_current = 1
    WHERE requested.slug = ?`,
  ).bind(slug).first();
}

export function publicCampaign(row, { role = null, joined = false } = {}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    banner: row.banner || "",
    slug: row.current_slug,
    joined,
    role,
    joinEnabled: Boolean(row.join_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function campaignAccess(request, env, slug, { requireDM = false } = {}) {
  if (!validCampaignSlug(slug)) return { response: error("Campaign not found.", 404) };
  const [campaign, user] = await Promise.all([
    campaignFromSlug(slug, env),
    userFromRequest(request, env),
  ]);
  if (!campaign) return { response: error("Campaign not found.", 404) };
  if (!user) return { response: error("Sign in required.", 401) };

  let membership = null;
  if (!user.isPrimaryAdmin) {
    membership = await env.DB.prepare(
      "SELECT role, joined_at, updated_at FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?",
    ).bind(campaign.id, user.id).first();
    if (!membership) return { response: error("Join this campaign to access its content.", 403) };
    if (requireDM && membership.role !== "dm") return { response: error("Campaign DM access required.", 403) };
  }

  return {
    campaign,
    canonicalSlug: campaign.current_slug,
    membership,
    role: user.isPrimaryAdmin ? "admin" : membership.role,
    user,
  };
}

export function canManageCampaign(access) {
  return Boolean(access?.user?.isPrimaryAdmin || access?.membership?.role === "dm");
}

export async function canEditCharacter(access, characterId, env) {
  if (canManageCampaign(access)) return true;
  const row = await env.DB.prepare(
    "SELECT 1 AS allowed FROM campaign_character_editors WHERE campaign_id = ? AND character_id = ? AND user_id = ?",
  ).bind(access.campaign.id, characterId, access.user.id).first();
  return Boolean(row);
}

export async function createCampaignRecord(user, input, env) {
  const name = campaignName(input?.name);
  if (!name) return { response: error(`Campaign name must contain 1-${CAMPAIGN_NAME_MAX} characters.`) };
  const description = campaignDescription(input?.description);
  if (description === null) return { response: error(`Campaign description cannot exceed ${CAMPAIGN_DESCRIPTION_MAX} characters.`) };
  const banner = campaignBanner(input?.banner);
  if (banner === null) return { response: error("Campaign banner must be a supported image smaller than 500 KB.") };
  const slug = input?.slug ? String(input.slug) : normalizeCampaignSlug(name);
  if (!validCampaignSlug(slug)) return { response: error("Campaign slug must contain 2-48 lowercase letters from a to z.") };
  const passwordProblem = campaignPasswordProblem(input?.password);
  if (passwordProblem) return { response: error(passwordProblem) };
  const occupied = await env.DB.prepare("SELECT campaign_id FROM campaign_slugs WHERE slug = ?").bind(slug).first();
  if (occupied) return { response: error("That campaign slug is already reserved.", 409) };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const credentials = await hashPassword(input.password);
  const statements = [
    env.DB.prepare(
      `INSERT INTO campaigns (id, name, description, banner, join_password_hash, join_password_salt, join_password_iterations,
        join_enabled, created_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(id, name, description, banner, credentials.hash, credentials.salt, credentials.iterations, user.localBypass ? null : user.id, now, now),
    env.DB.prepare("INSERT INTO campaign_slugs (slug, campaign_id, is_current, created_at) VALUES (?, ?, 1, ?)")
      .bind(slug, id, now),
    env.DB.prepare("INSERT INTO campaign_settings (campaign_id, settings_json, updated_at) VALUES (?, ?, ?)")
      .bind(id, JSON.stringify(defaultCampaignSettings()), now),
    env.DB.prepare("INSERT INTO campaign_wiki_documents (campaign_id, pages_json, updated_at) VALUES (?, '[]', ?)")
      .bind(id, now),
    env.DB.prepare("INSERT INTO campaign_music_libraries (campaign_id, library_json, updated_at) VALUES (?, ?, ?)")
      .bind(id, JSON.stringify({ version: 1, tracks: [], settings: { fadeIn: 3, fadeOut: 2 } }), now),
    env.DB.prepare("INSERT INTO campaign_combat_documents (campaign_id, kind, document_json, updated_at) VALUES (?, 'draft', NULL, ?)")
      .bind(id, now),
    env.DB.prepare("INSERT INTO campaign_combat_documents (campaign_id, kind, document_json, updated_at) VALUES (?, 'party-library', ?, ?)")
      .bind(id, JSON.stringify({ version: 1, parties: [] }), now),
  ];
  if (!user.localBypass) {
    statements.splice(2, 0, env.DB.prepare(
      "INSERT INTO campaign_memberships (campaign_id, user_id, role, joined_at, updated_at) VALUES (?, ?, 'dm', ?, ?)",
    ).bind(id, user.id, now, now));
  }
  await env.DB.batch(statements);
  return { campaign: { id, name, description, banner, current_slug: slug, join_enabled: 1, created_at: now, updated_at: now } };
}

export async function listCampaignRecords(user, env) {
  const rows = user.localBypass
    ? await env.DB.prepare(
      `SELECT campaigns.id, campaigns.name, campaigns.description, campaigns.banner, campaigns.join_enabled, campaigns.created_at, campaigns.updated_at,
        current.slug AS current_slug, NULL AS member_role
      FROM campaigns JOIN campaign_slugs AS current ON current.campaign_id = campaigns.id AND current.is_current = 1
      ORDER BY campaigns.name COLLATE NOCASE`,
    ).all()
    : await env.DB.prepare(
      `SELECT campaigns.id, campaigns.name, campaigns.description, campaigns.banner, campaigns.join_enabled, campaigns.created_at, campaigns.updated_at,
        current.slug AS current_slug, campaign_memberships.role AS member_role
      FROM campaigns
      JOIN campaign_slugs AS current ON current.campaign_id = campaigns.id AND current.is_current = 1
      LEFT JOIN campaign_memberships ON campaign_memberships.campaign_id = campaigns.id AND campaign_memberships.user_id = ?
      ORDER BY campaigns.name COLLATE NOCASE`,
    ).bind(user.id).all();
  return rows.results.map((row) => publicCampaign(row, {
    joined: user.isPrimaryAdmin || Boolean(row.member_role),
    role: user.isPrimaryAdmin ? "admin" : row.member_role || null,
  }));
}

export async function campaignSettingsRecord(campaignId, env) {
  const row = await env.DB.prepare(
    "SELECT settings_json, updated_at FROM campaign_settings WHERE campaign_id = ?",
  ).bind(campaignId).first();
  return { ...defaultCampaignSettings(), ...parseStored(row?.settings_json, {}), updatedAt: row?.updated_at || null };
}

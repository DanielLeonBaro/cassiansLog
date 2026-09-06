// Handles campaign-scoped Wiki, Music, Combat, initiative, and runtime settings.
import { initiativeNamesFromSnapshot } from "../../public-initiative/js/model.js";
import { normalizeWikiPages } from "../../wiki/js/model.js";
import { canManageCampaign, campaignSettingsRecord, defaultCampaignSettings, LEGACY_CAMPAIGN_ID } from "../campaigns.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { CHARACTER_SHEET_STYLES, loadSettings } from "../settings.js";
import { normalizeMusicLibrary } from "./music.js";

function requireManager(access) {
  return canManageCampaign(access) ? null : error("Campaign DM access required.", 403);
}

async function wikiRoute(request, env, access) {
  const campaignId = access.campaign.id;
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT pages_json, updated_at FROM campaign_wiki_documents WHERE campaign_id = ?")
      .bind(campaignId).first();
    const stored = parseStored(row?.pages_json, []);
    if (!Array.isArray(stored) || !stored.every((page) => page?.id && page?.name)) return error("The Wiki document is invalid.", 500);
    const pages = normalizeWikiPages(stored);
    return json({ pages, updatedAt: row?.updated_at || null, canEdit: canManageCampaign(access) });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const denied = requireManager(access);
  if (denied) return denied;
  const body = await bodyJSON(request);
  if (!Array.isArray(body?.pages) || !body.pages.every((page) => page?.id && page?.name)) return error("Invalid Wiki document.");
  const pages = normalizeWikiPages(body.pages);
  const pagesJSON = JSON.stringify(pages);
  const now = new Date().toISOString();
  const statements = [env.DB.prepare(
    "INSERT INTO campaign_wiki_documents (campaign_id, pages_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(campaign_id) DO UPDATE SET pages_json = excluded.pages_json, updated_at = excluded.updated_at",
  ).bind(campaignId, pagesJSON, now)];
  if (campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
    "INSERT INTO wiki_documents (id, pages_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET pages_json = excluded.pages_json, updated_at = excluded.updated_at",
  ).bind(pagesJSON, now));
  await env.DB.batch(statements);
  return json({ ok: true, updatedAt: now });
}

async function musicRoute(request, env, access) {
  const campaignId = access.campaign.id;
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT library_json, updated_at FROM campaign_music_libraries WHERE campaign_id = ?")
      .bind(campaignId).first();
    return json({
      library: row ? parseStored(row.library_json, { version: 1, tracks: [], settings: { fadeIn: 3, fadeOut: 2 } }) : { version: 1, tracks: [], settings: { fadeIn: 3, fadeOut: 2 } },
      updatedAt: row?.updated_at || null,
      canEdit: canManageCampaign(access),
    });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const denied = requireManager(access);
  if (denied) return denied;
  const library = normalizeMusicLibrary(await bodyJSON(request));
  if (!library) return error("Invalid Music library.");
  const libraryJSON = JSON.stringify(library);
  const now = new Date().toISOString();
  const statements = [env.DB.prepare(
    "INSERT INTO campaign_music_libraries (campaign_id, library_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(campaign_id) DO UPDATE SET library_json = excluded.library_json, updated_at = excluded.updated_at",
  ).bind(campaignId, libraryJSON, now)];
  if (campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
    "INSERT INTO music_library (id, library_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET library_json = excluded.library_json, updated_at = excluded.updated_at",
  ).bind(libraryJSON, now));
  await env.DB.batch(statements);
  return json({ ok: true, updatedAt: now });
}

async function combatSnapshot(env, access) {
  const [presets, documents] = await Promise.all([
    env.DB.prepare("SELECT * FROM campaign_combat_presets WHERE campaign_id = ? ORDER BY created_at").bind(access.campaign.id).all(),
    env.DB.prepare("SELECT kind, document_json, updated_at FROM campaign_combat_documents WHERE campaign_id = ?").bind(access.campaign.id).all(),
  ]);
  const byKind = new Map(documents.results.map((row) => [row.kind, {
    document: row.document_json ? parseStored(row.document_json) : null,
    updatedAt: row.updated_at,
  }]));
  return {
    presets: presets.results.map((row) => ({
      id: row.id,
      baseName: row.base_name,
      label: row.label,
      document: parseStored(row.document_json, {}),
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    draft: byKind.get("draft")?.document || null,
    draftUpdatedAt: byKind.get("draft")?.updatedAt || null,
    partyLibrary: byKind.get("party-library")?.document || { version: 1, parties: [] },
    canEdit: canManageCampaign(access),
    authoritative: true,
  };
}

async function combatRoute(request, env, parts, access) {
  if (request.method === "GET" && parts.length === 0) return json(await combatSnapshot(env, access));
  const denied = requireManager(access);
  if (denied) return denied;
  const campaignId = access.campaign.id;
  if (parts[0] === "presets" && safeId(parts[1]) && request.method === "PUT") {
    const preset = await bodyJSON(request);
    if (preset?.id !== parts[1] || !preset.document || !preset.baseName || !preset.label) return error("Invalid preset document.");
    const statements = [env.DB.prepare(
      `INSERT INTO campaign_combat_presets (campaign_id, id, base_name, label, document_json, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(campaign_id, id) DO UPDATE SET base_name = excluded.base_name,
        label = excluded.label, document_json = excluded.document_json, active = excluded.active, updated_at = excluded.updated_at`,
    ).bind(campaignId, preset.id, preset.baseName, preset.label, JSON.stringify(preset.document), preset.active === false ? 0 : 1, preset.createdAt, preset.updatedAt)];
    if (campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
      "INSERT INTO combat_presets (id, base_name, label, document_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET base_name = excluded.base_name, label = excluded.label, document_json = excluded.document_json, active = excluded.active, updated_at = excluded.updated_at",
    ).bind(preset.id, preset.baseName, preset.label, JSON.stringify(preset.document), preset.active === false ? 0 : 1, preset.createdAt, preset.updatedAt));
    await env.DB.batch(statements);
    return json({ ok: true });
  }
  const kind = parts[0] === "party-library" ? "party-library" : parts[0] === "draft" ? "draft" : "";
  if (kind && parts.length === 1 && request.method === "PUT") {
    const document = await bodyJSON(request);
    if (kind === "party-library" && (document?.version !== 1 || !Array.isArray(document.parties))) return error("Invalid party library.");
    const now = new Date().toISOString();
    const value = JSON.stringify(document);
    const statements = [env.DB.prepare(
      "INSERT INTO campaign_combat_documents (campaign_id, kind, document_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(campaign_id, kind) DO UPDATE SET document_json = excluded.document_json, updated_at = excluded.updated_at",
    ).bind(campaignId, kind, value, now)];
    if (campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
      "INSERT INTO combat_drafts (id, draft_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at",
    ).bind(kind === "draft" ? "default" : "party-library", value, now));
    await env.DB.batch(statements);
    return json({ ok: true, updatedAt: now });
  }
  return error("Method not allowed.", 405);
}

function normalizeCampaignSettings(body) {
  const defaults = defaultCampaignSettings();
  if (!body?.sections || typeof body.sections !== "object" || Array.isArray(body.sections)) return null;
  if (!CHARACTER_SHEET_STYLES.has(body.characterSheetStyle)) return null;
  if (!body.characterSheetStyleOverrides || typeof body.characterSheetStyleOverrides !== "object" || Array.isArray(body.characterSheetStyleOverrides)) return null;
  const sections = {};
  for (const key of Object.keys(defaults.sections)) {
    if (typeof body.sections[key] !== "boolean") return null;
    sections[key] = body.sections[key];
  }
  if (!Object.entries(body.characterSheetStyleOverrides).every(([id, style]) => safeId(id) && CHARACTER_SHEET_STYLES.has(style))) return null;
  return { sections, characterSheetStyle: body.characterSheetStyle, characterSheetStyleOverrides: { ...body.characterSheetStyleOverrides } };
}

async function settingsRoute(request, env, access) {
  if (request.method === "GET") return json({ settings: await campaignSettingsRecord(access.campaign.id, env), canEdit: canManageCampaign(access) });
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const denied = requireManager(access);
  if (denied) return denied;
  const settings = normalizeCampaignSettings(await bodyJSON(request));
  if (!settings) return error("Invalid campaign settings.");
  const now = new Date().toISOString();
  const statements = [env.DB.prepare(
    "INSERT INTO campaign_settings (campaign_id, settings_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(campaign_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at",
  ).bind(access.campaign.id, JSON.stringify(settings), now)];
  if (access.campaign.id === LEGACY_CAMPAIGN_ID) {
    const legacy = await loadSettings(env);
    statements.push(env.DB.prepare(
      "INSERT INTO app_settings (id, settings_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at",
    ).bind(JSON.stringify({ ...settings, openWrites: legacy.openWrites }), now));
  }
  await env.DB.batch(statements);
  return json({ ok: true, settings: { ...settings, updatedAt: now } });
}

export async function campaignContentRoute(request, env, resource, parts, access) {
  if (resource === "wiki" && parts.length === 0) return wikiRoute(request, env, access);
  if (resource === "music" && parts.length === 0) return musicRoute(request, env, access);
  if (resource === "combat-loot") return combatRoute(request, env, parts, access);
  if (resource === "settings" && parts.length === 0) return settingsRoute(request, env, access);
  if (resource === "public-initiative" && parts.length === 0 && request.method === "GET") {
    const snapshot = await combatSnapshot(env, access);
    return json({ names: initiativeNamesFromSnapshot({ draft: snapshot.draft }), updatedAt: snapshot.draftUpdatedAt });
  }
  return error("Campaign resource not found.", 404);
}

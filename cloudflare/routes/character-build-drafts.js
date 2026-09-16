// Persists personal Character Builder drafts and atomically finalizes them into Characters.
import { canManageCampaign, LEGACY_CAMPAIGN_ID } from "../campaigns.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { userFromRequest } from "../user-auth.js";
import { normalizeCharacterDocument } from "../../char/js/model.js";

const BUILDER_STEPS = new Set(["home", "class", "background", "species", "abilities", "equipment", "description", "review"]);

function storageUnavailable(caught) {
  return /no such table|character_build_drafts/i.test(String(caught?.message || caught));
}

function uniqueViolation(caught) {
  return /unique constraint failed/i.test(String(caught?.message || caught));
}

function draftInput(body) {
  const suppliedDocument = body?.document;
  if (!suppliedDocument || typeof suppliedDocument !== "object" || Array.isArray(suppliedDocument)) {
    return { response: error("Character draft document is required.") };
  }
  if (suppliedDocument.characterSchemaVersion !== 2 || !suppliedDocument.build || typeof suppliedDocument.build !== "object") {
    return { response: error("Character draft must use schema version 2.") };
  }
  const document = normalizeCharacterDocument(suppliedDocument);
  const status = document.build.status;
  if (!["incomplete", "complete"].includes(status)) return { response: error("Character draft status is invalid.") };
  const version = Math.trunc(Number(document.build.version));
  if (!Number.isFinite(version) || version < 1) return { response: error("Character draft version is invalid.") };
  const currentStep = String(body.currentStep || "home").trim().toLowerCase();
  if (!BUILDER_STEPS.has(currentStep)) return { response: error("Character draft step is invalid.") };
  return { document, currentStep, status, version };
}

function draftRecord(row) {
  return {
    draftId: row.draft_id,
    document: parseStored(row.document_json, {}),
    currentStep: row.current_step,
    status: row.status,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftQueries(env, scope, draftId) {
  if (scope.campaignId) {
    return {
      select: env.DB.prepare(
        `SELECT draft_id, document_json, current_step, status, version, created_at, updated_at
        FROM campaign_character_build_drafts WHERE campaign_id = ? AND user_id = ? AND draft_id = ?`,
      ).bind(scope.campaignId, scope.user.id, draftId),
      upsert(input, now) {
        return env.DB.prepare(
          `INSERT INTO campaign_character_build_drafts
            (campaign_id, user_id, draft_id, document_json, current_step, status, version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(campaign_id, user_id, draft_id) DO UPDATE SET
            document_json = excluded.document_json, current_step = excluded.current_step,
            status = excluded.status, version = excluded.version, updated_at = excluded.updated_at`,
        ).bind(scope.campaignId, scope.user.id, draftId, JSON.stringify(input.document), input.currentStep, input.status, input.version, now, now);
      },
      remove: env.DB.prepare(
        "DELETE FROM campaign_character_build_drafts WHERE campaign_id = ? AND user_id = ? AND draft_id = ?",
      ).bind(scope.campaignId, scope.user.id, draftId),
    };
  }
  return {
    select: env.DB.prepare(
      `SELECT draft_id, document_json, current_step, status, version, created_at, updated_at
      FROM character_build_drafts WHERE user_id = ? AND draft_id = ?`,
    ).bind(scope.user.id, draftId),
    upsert(input, now) {
      return env.DB.prepare(
        `INSERT INTO character_build_drafts
          (user_id, draft_id, document_json, current_step, status, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, draft_id) DO UPDATE SET
          document_json = excluded.document_json, current_step = excluded.current_step,
          status = excluded.status, version = excluded.version, updated_at = excluded.updated_at`,
      ).bind(scope.user.id, draftId, JSON.stringify(input.document), input.currentStep, input.status, input.version, now, now);
    },
    remove: env.DB.prepare("DELETE FROM character_build_drafts WHERE user_id = ? AND draft_id = ?")
      .bind(scope.user.id, draftId),
  };
}

async function readDraft(env, scope, draftId) {
  return draftQueries(env, scope, draftId).select.first();
}

async function finalizeDraft(request, env, scope, draftId) {
  if (request.method !== "POST") return error("Method not allowed.", 405);
  const row = await readDraft(env, scope, draftId);
  if (!row) return error("Character draft not found.", 404);
  const document = parseStored(row.document_json, null);
  const characterId = safeId(document?.id);
  if (!characterId || document?.build?.status !== "complete") {
    return error("Complete Character draft with valid Character ID is required.");
  }
  const queries = draftQueries(env, scope, draftId);
  const now = new Date().toISOString();
  const documentJSON = JSON.stringify(document);
  const statements = [];
  if (scope.campaignId) {
    const occupied = await env.DB.prepare(
      "SELECT id FROM campaign_characters WHERE campaign_id = ? AND id = ?",
    ).bind(scope.campaignId, characterId).first();
    if (occupied) return error("That character ID already exists in this campaign.", 409);
    if (scope.campaignId === LEGACY_CAMPAIGN_ID) {
      const legacyOccupied = await env.DB.prepare("SELECT id FROM characters WHERE id = ?").bind(characterId).first();
      if (legacyOccupied) return error("That character ID already exists.", 409);
    }
    statements.push(env.DB.prepare(
      `INSERT INTO campaign_characters (campaign_id, id, document_json, source, active, created_at, updated_at)
      VALUES (?, ?, ?, 'custom', 1, ?, ?)`,
    ).bind(scope.campaignId, characterId, documentJSON, now, now));
    if (!canManageCampaign(scope.access) && !scope.user.localBypass) statements.push(env.DB.prepare(
      "INSERT INTO campaign_character_editors (campaign_id, character_id, user_id, assigned_at) VALUES (?, ?, ?, ?)",
    ).bind(scope.campaignId, characterId, scope.user.id, now));
    if (scope.campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
      "INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES (?, ?, 'custom', 1, ?, ?)",
    ).bind(characterId, documentJSON, now, now));
  } else {
    const occupied = await env.DB.prepare("SELECT id FROM characters WHERE id = ?").bind(characterId).first();
    if (occupied) return error("That character ID already exists.", 409);
    statements.push(env.DB.prepare(
      "INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES (?, ?, 'custom', 1, ?, ?)",
    ).bind(characterId, documentJSON, now, now));
  }
  statements.push(queries.remove);
  try {
    await env.DB.batch(statements);
  } catch (caught) {
    if (uniqueViolation(caught)) return error(scope.campaignId
      ? "That character ID already exists in this campaign."
      : "That character ID already exists.", 409);
    throw caught;
  }
  return json({ ok: true, id: characterId, document, updatedAt: now }, 201);
}

async function draftRoute(request, env, scope, parts) {
  const draftId = safeId(parts[0]);
  if (!draftId) return error("Invalid Character draft ID.");
  if (parts[1] === "finalize" && parts.length === 2) return finalizeDraft(request, env, scope, draftId);
  if (parts.length !== 1) return error("Character draft route not found.", 404);
  const queries = draftQueries(env, scope, draftId);
  if (request.method === "GET") {
    const row = await queries.select.first();
    return row ? json({ draft: draftRecord(row) }) : error("Character draft not found.", 404);
  }
  if (request.method === "PUT") {
    const input = draftInput(await bodyJSON(request));
    if (input.response) return input.response;
    const existing = await queries.select.first();
    const now = new Date().toISOString();
    await queries.upsert(input, now).run();
    return json({ draft: { draftId, document: input.document, currentStep: input.currentStep, status: input.status,
      version: input.version, createdAt: existing?.created_at || now, updatedAt: now } }, existing ? 200 : 201);
  }
  if (request.method === "DELETE") {
    const removed = await queries.remove.run();
    return json({ ok: true, deleted: Boolean(removed.meta?.changes) });
  }
  return error("Method not allowed.", 405);
}

export async function characterBuildDraftRoute(request, env, parts) {
  const user = await userFromRequest(request, env);
  if (!user) return error("Sign in to manage Character Builder drafts.", 401);
  try {
    return await draftRoute(request, env, { user, campaignId: "", access: null }, parts);
  } catch (caught) {
    if (storageUnavailable(caught)) return error("Character Builder draft storage is unavailable. Apply migration 0017.", 503);
    throw caught;
  }
}

export async function campaignCharacterBuildDraftRoute(request, env, parts, access) {
  try {
    return await draftRoute(request, env, { user: access.user, campaignId: access.campaign.id, access }, parts);
  } catch (caught) {
    if (storageUnavailable(caught)) return error("Character Builder draft storage is unavailable. Apply migration 0017.", 503);
    throw caught;
  }
}

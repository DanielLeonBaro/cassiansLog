// Handles campaign discovery, creation, joining, membership, and management APIs.
import {
  campaignAccess,
  campaignBanner,
  campaignDescription,
  campaignFromSlug,
  campaignName,
  campaignPasswordProblem,
  createCampaignRecord,
  listCampaignRecords,
  publicCampaign,
} from "../campaigns.js";
import { bodyJSON, error, json } from "../http.js";
import { hashPassword, userFromRequest, verifyPassword } from "../user-auth.js";
import { campaignCharacterRoute, listCampaignCharacters } from "./campaign-characters.js";
import { campaignContentRoute } from "./campaign-content.js";
import { campaignScreenRoute } from "./campaign-screens.js";

const JOIN_WINDOW_MS = 15 * 60_000;
const JOIN_FAILURE_LIMIT = 5;

async function signedIn(request, env) {
  const user = await userFromRequest(request, env);
  return user ? { user } : { response: error("Sign in required.", 401) };
}

async function listRoute(request, env) {
  const access = await signedIn(request, env);
  if (access.response) return access.response;
  if (request.method === "GET") return json({ campaigns: await listCampaignRecords(access.user, env) });
  if (request.method === "POST") {
    const created = await createCampaignRecord(access.user, await bodyJSON(request), env);
    return created.response || json({ campaign: publicCampaign(created.campaign, { joined: true, role: "dm" }) }, 201);
  }
  return error("Method not allowed.", 405);
}

async function failedJoin(campaign, user, previous, env) {
  const now = new Date();
  const previousStart = Date.parse(previous?.window_started_at || "");
  const sameWindow = Number.isFinite(previousStart) && now.getTime() - previousStart < JOIN_WINDOW_MS;
  const failures = sameWindow ? Number(previous.failures || 0) + 1 : 1;
  const blockedUntil = failures >= JOIN_FAILURE_LIMIT
    ? new Date(now.getTime() + JOIN_WINDOW_MS).toISOString()
    : null;
  await env.DB.prepare(
    `INSERT INTO campaign_join_attempts (campaign_id, user_id, window_started_at, failures, blocked_until)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, user_id) DO UPDATE SET
      window_started_at = excluded.window_started_at,
      failures = excluded.failures,
      blocked_until = excluded.blocked_until`,
  ).bind(campaign.id, user.id, sameWindow ? previous.window_started_at : now.toISOString(), failures, blockedUntil).run();
  return failures >= JOIN_FAILURE_LIMIT
    ? error("Too many failed attempts. Try again in 15 minutes.", 429)
    : error("Campaign password is incorrect.", 401);
}

async function joinRoute(request, env, slug) {
  if (request.method !== "POST") return error("Method not allowed.", 405);
  const access = await signedIn(request, env);
  if (access.response) return access.response;
  if (access.user.localBypass || access.user.isPrimaryAdmin) return json({ ok: true, role: "admin" });
  const campaign = await campaignFromSlug(slug, env);
  if (!campaign) return error("Campaign not found.", 404);
  const existing = await env.DB.prepare(
    "SELECT role FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?",
  ).bind(campaign.id, access.user.id).first();
  if (existing) return json({ ok: true, role: existing.role });
  if (!campaign.join_enabled) return error("Campaign joining is not enabled yet.", 409);

  const attempt = await env.DB.prepare(
    "SELECT window_started_at, failures, blocked_until FROM campaign_join_attempts WHERE campaign_id = ? AND user_id = ?",
  ).bind(campaign.id, access.user.id).first();
  if (attempt?.blocked_until && Date.parse(attempt.blocked_until) > Date.now()) {
    return error("Too many failed attempts. Try again later.", 429);
  }
  const body = await bodyJSON(request);
  const valid = await verifyPassword({
    password_hash: campaign.join_password_hash,
    password_salt: campaign.join_password_salt,
    password_iterations: campaign.join_password_iterations,
  }, body?.password);
  if (!valid) return failedJoin(campaign, access.user, attempt, env);

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO campaign_memberships (campaign_id, user_id, role, joined_at, updated_at) VALUES (?, ?, 'player', ?, ?)",
    ).bind(campaign.id, access.user.id, now, now),
    env.DB.prepare("DELETE FROM campaign_join_attempts WHERE campaign_id = ? AND user_id = ?")
      .bind(campaign.id, access.user.id),
  ]);
  return json({ ok: true, role: "player", slug: campaign.current_slug });
}

async function updateCampaign(request, env, access) {
  const body = await bodyJSON(request);
  const name = campaignName(body?.name);
  if (!name) return error("Campaign name must contain 1-80 characters.");
  const description = campaignDescription(body?.description ?? access.campaign.description);
  if (description === null) return error("Campaign description cannot exceed 280 characters.");
  const banner = campaignBanner(body?.banner ?? access.campaign.banner);
  if (banner === null) return error("Campaign banner must be a supported image smaller than 500 KB.");
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE campaigns SET name = ?, description = ?, banner = ?, updated_at = ? WHERE id = ?")
    .bind(name, description, banner, now, access.campaign.id).run();
  return json({ ok: true, name, description, banner, updatedAt: now });
}

async function passwordRoute(request, env, access) {
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const body = await bodyJSON(request);
  const problem = campaignPasswordProblem(body?.password);
  if (problem) return error(problem);
  const credentials = await hashPassword(body.password);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE campaigns SET join_password_hash = ?, join_password_salt = ?, join_password_iterations = ?,
      join_enabled = 1, updated_at = ? WHERE id = ?`,
  ).bind(credentials.hash, credentials.salt, credentials.iterations, now, access.campaign.id).run();
  return json({ ok: true, joinEnabled: true, updatedAt: now });
}

async function memberRows(campaignId, env) {
  const rows = await env.DB.prepare(
    `SELECT users.id, users.email, campaign_memberships.role, campaign_memberships.joined_at,
      campaign_memberships.updated_at
    FROM campaign_memberships JOIN users ON users.id = campaign_memberships.user_id
    WHERE campaign_memberships.campaign_id = ? ORDER BY users.email COLLATE NOCASE`,
  ).bind(campaignId).all();
  return rows.results.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  }));
}

async function lastDM(campaignId, userId, env) {
  const target = await env.DB.prepare(
    "SELECT role FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?",
  ).bind(campaignId, userId).first();
  if (!target) return { missing: true };
  if (target.role !== "dm") return { target };
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM campaign_memberships WHERE campaign_id = ? AND role = 'dm'",
  ).bind(campaignId).first();
  return { target, last: Number(count?.count || 0) <= 1 };
}

async function membersRoute(request, env, access, parts) {
  if (request.method === "GET" && parts.length === 1) return json({ members: await memberRows(access.campaign.id, env) });
  const userId = parts[1];
  if (!userId || parts.length !== 2) return error("Member not found.", 404);
  const guard = await lastDM(access.campaign.id, userId, env);
  if (guard.missing) return error("Member not found.", 404);
  if (request.method === "PATCH") {
    const role = (await bodyJSON(request))?.role;
    if (!["player", "dm"].includes(role)) return error("Member role must be player or dm.");
    if (guard.last && role !== "dm") return error("Assign another DM before demoting the final DM.", 409);
    const now = new Date().toISOString();
    const updated = await env.DB.prepare(
      `UPDATE campaign_memberships SET role = ?, updated_at = ? WHERE campaign_id = ? AND user_id = ?
      AND (role != 'dm' OR ? = 'dm' OR (SELECT COUNT(*) FROM campaign_memberships WHERE campaign_id = ? AND role = 'dm') > 1)`,
    ).bind(role, now, access.campaign.id, userId, role, access.campaign.id).run();
    if (!updated.meta?.changes) return error("Assign another DM before demoting the final DM.", 409);
    return json({ ok: true, role, updatedAt: now });
  }
  if (request.method === "DELETE") {
    if (guard.last) return error("Assign another DM before removing the final DM.", 409);
    const removed = await env.DB.prepare(
      `DELETE FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?
      AND (role != 'dm' OR (SELECT COUNT(*) FROM campaign_memberships WHERE campaign_id = ? AND role = 'dm') > 1)`,
    ).bind(access.campaign.id, userId, access.campaign.id).run();
    if (!removed.meta?.changes) return error("Assign another DM before removing the final DM.", 409);
    return json({ ok: true });
  }
  return error("Method not allowed.", 405);
}

async function leaveRoute(request, env, access) {
  if (request.method !== "DELETE") return error("Method not allowed.", 405);
  if (access.user.isPrimaryAdmin || access.user.localBypass) return error("Primary Admin access is not a campaign membership.", 409);
  const guard = await lastDM(access.campaign.id, access.user.id, env);
  if (guard.last) return error("Assign another DM before leaving this campaign.", 409);
  const removed = await env.DB.prepare(
    `DELETE FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?
    AND (role != 'dm' OR (SELECT COUNT(*) FROM campaign_memberships WHERE campaign_id = ? AND role = 'dm') > 1)`,
  ).bind(access.campaign.id, access.user.id, access.campaign.id).run();
  if (!removed.meta?.changes) return error("Assign another DM before leaving this campaign.", 409);
  return json({ ok: true });
}

export async function campaignRoute(request, env, parts) {
  try {
    if (!parts.length) return listRoute(request, env);
    const slug = parts[0];
    if (parts[1] === "join") return joinRoute(request, env, slug);

    const requireDM = parts[1] === "password" || parts[1] === "members" || request.method === "PATCH";
    const access = await campaignAccess(request, env, slug, { requireDM });
    if (access.response) return access.response;
    if (parts.length === 1 && request.method === "GET") {
      return json({ campaign: publicCampaign(access.campaign, { joined: true, role: access.role }), canonicalSlug: access.canonicalSlug });
    }
    if (parts.length === 1 && request.method === "PATCH") return updateCampaign(request, env, access);
    if (parts[1] === "password" && parts.length === 2) return passwordRoute(request, env, access);
    if (parts[1] === "members") return membersRoute(request, env, access, parts.slice(1));
    if (parts[1] === "membership" && parts[2] === "me" && parts.length === 3) return leaveRoute(request, env, access);
    if (parts[1] === "characters") {
      return parts.length === 2
        ? (request.method === "GET" ? listCampaignCharacters(env, access) : error("Method not allowed.", 405))
        : campaignCharacterRoute(request, env, parts.slice(2), access);
    }
    if (parts[1] === "screens") return campaignScreenRoute(request, env, parts.slice(2), access);
    if (["wiki", "music", "combat-loot", "public-initiative", "settings"].includes(parts[1])) {
      return campaignContentRoute(request, env, parts[1], parts.slice(2), access);
    }
    return error("Campaign route not found.", 404);
  } catch (caught) {
    if (/no such table|has no column/i.test(String(caught?.message || caught))) {
      return error("Campaign storage is unavailable. Apply migration 0012.", 503);
    }
    throw caught;
  }
}

// Handles admin API routing, validation, authorization, and D1 persistence.
import { adminAuthorized } from "../auth.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { loadSettings, updateSettings } from "../settings.js";
import { adminThemeRoute } from "./admin-themes.js";
import { validCampaignSlug } from "../campaigns.js";
import {
  assignUserTheme,
  loadThemeCatalog,
  preferenceFromRow,
} from "../themes.js";
import {
  ASSIGNABLE_ROLES,
  MANDATORY_ROLES,
  PRIMARY_ADMIN_EMAIL,
  hashPassword,
  normalizeEmail,
  passwordProblem,
} from "../user-auth.js";

export async function adminRoute(request, env, parts) {
  if (!await adminAuthorized(request, env)) return error("Primary administrator access required.", 401);
  if (request.method === "GET" && parts.length === 0) {
    const [settings, characters, themeCatalog] = await Promise.all([
      loadSettings(env),
      env.DB.prepare("SELECT id, document_json, source, active, updated_at FROM characters ORDER BY id").all(),
      loadThemeCatalog(env, { includeUsage: true }),
    ]);
    let users = { results: [] };
    let campaigns = { results: [] };
    try {
      users = await env.DB.prepare(
        `SELECT users.id, users.email, users.roles_json, users.created_at, users.updated_at,
          user_theme_preferences.theme_id, user_theme_preferences.reversed,
          user_theme_preferences.font_mode, user_theme_preferences.background_id,
          user_theme_preferences.updated_at AS theme_updated_at
        FROM users
        LEFT JOIN user_theme_preferences ON user_theme_preferences.user_id = users.id
        ORDER BY users.email COLLATE NOCASE`,
      ).all();
    } catch (caught) {
      try {
        users = await env.DB.prepare("SELECT id, email, roles_json, created_at, updated_at FROM users ORDER BY email COLLATE NOCASE").all();
      } catch (fallbackCaught) {
        console.warn("User accounts could not be listed. Apply migration 0006.", fallbackCaught);
      }
    }
    try {
      campaigns = await env.DB.prepare(
        `SELECT campaigns.id, campaigns.name, campaigns.description, campaigns.banner, campaigns.join_enabled, campaigns.created_at, campaigns.updated_at,
          current.slug
        FROM campaigns
        JOIN campaign_slugs AS current ON current.campaign_id = campaigns.id AND current.is_current = 1
        ORDER BY campaigns.name COLLATE NOCASE`,
      ).all();
    } catch (caught) {
      console.warn("Campaigns could not be listed. Apply migration 0012.", caught);
    }
    return json({
      settings,
      themes: themeCatalog.themes,
      themeStorageAvailable: themeCatalog.storageAvailable,
      characters: characters.results.map((row) => ({
        id: row.id,
        name: parseStored(row.document_json, {})?.name || row.id,
        source: row.source,
        active: Boolean(row.active),
        updatedAt: row.updated_at,
      })),
      campaigns: campaigns.results.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || "",
        banner: row.banner || "",
        slug: row.slug,
        joinEnabled: Boolean(row.join_enabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      users: users.results.map((row) => ({
        id: row.id,
        email: row.email,
        roles: normalizeEmail(row.email) === PRIMARY_ADMIN_EMAIL
          ? [...ASSIGNABLE_ROLES, "admin"]
          : [...new Set([
            ...MANDATORY_ROLES,
            ...parseStored(row.roles_json, []).filter((role) => ASSIGNABLE_ROLES.includes(role)),
          ])],
        isPrimaryAdmin: normalizeEmail(row.email) === PRIMARY_ADMIN_EMAIL,
        themePreference: preferenceFromRow(row.theme_id ? {
          theme_id: row.theme_id,
          reversed: row.reversed,
          font_mode: row.font_mode,
          background_id: row.background_id,
          updated_at: row.theme_updated_at,
        } : null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  }
  if (request.method === "PUT" && parts[0] === "settings" && parts.length === 1) {
    return updateSettings(request, env);
  }
  if (parts[0] === "themes") {
    try {
      return await adminThemeRoute(request, env, parts);
    } catch (caught) {
      console.warn("Admin theme storage is unavailable. Apply migration 0008.", caught);
      return error("Theme storage is unavailable. Apply migration 0008.", 503);
    }
  }
  if (request.method === "PUT" && parts[0] === "characters" && safeId(parts[1]) && parts.length === 2) {
    const body = await bodyJSON(request);
    if (typeof body?.active !== "boolean") return error("Character availability must be true or false.");
    const result = await env.DB.prepare(
      "UPDATE characters SET active = ?, updated_at = ? WHERE id = ?",
    ).bind(body.active ? 1 : 0, new Date().toISOString(), parts[1]).run();
    if (!result.meta?.changes) return error("Character not found.", 404);
    return json({ ok: true });
  }
  if (request.method === "PUT" && parts[0] === "users" && parts[1] && parts[2] === "roles" && parts.length === 3) {
    const body = await bodyJSON(request);
    if (!Array.isArray(body?.roles)) return error("Roles must be an array.");
    const requestedRoles = [...new Set(body.roles)];
    if (requestedRoles.some((role) => !ASSIGNABLE_ROLES.includes(role))) return error("One or more roles are invalid.");
    const roles = [...new Set([...MANDATORY_ROLES, ...requestedRoles])];
    const target = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(parts[1]).first();
    if (!target) return error("User not found.", 404);
    if (normalizeEmail(target.email) === PRIMARY_ADMIN_EMAIL) return error("The primary administrator always has full access.", 409);
    await env.DB.prepare("UPDATE users SET roles_json = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(roles), new Date().toISOString(), parts[1]).run();
    return json({ ok: true, roles });
  }
  if (request.method === "PUT" && parts[0] === "users" && parts[1] && parts[2] === "theme" && parts.length === 3) {
    const body = await bodyJSON(request);
    if (!safeId(body?.themeId)) return error("Theme ID is invalid.");
    try {
      const result = await assignUserTheme(parts[1], body.themeId, env);
      if (result.problem === "user") return error("User not found.", 404);
      if (result.problem === "theme") return error("Theme not found.", 404);
      return json({ ok: true, themePreference: result.preference });
    } catch (caught) {
      console.warn("Admin could not assign a user theme.", caught);
      return error("Theme storage is unavailable. Apply migration 0008.", 503);
    }
  }
  if (request.method === "PUT" && parts[0] === "users" && parts[1] && parts[2] === "password" && parts.length === 3) {
    const body = await bodyJSON(request);
    const problem = passwordProblem(body?.password);
    if (problem) return error(problem);
    const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(parts[1]).first();
    if (!target) return error("User not found.", 404);
    const credentials = await hashPassword(body.password);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ?",
    ).bind(credentials.hash, credentials.salt, credentials.iterations, new Date().toISOString(), parts[1]).run();
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(parts[1]).run();
    return json({ ok: true });
  }
  if (request.method === "PUT" && parts[0] === "campaigns" && parts[1] && parts[2] === "slug" && parts.length === 3) {
    const body = await bodyJSON(request);
    const slug = String(body?.slug || "");
    if (!validCampaignSlug(slug)) return error("Campaign slug must contain 2-48 lowercase letters from a to z.");
    const campaign = await env.DB.prepare(
      `SELECT campaigns.id, current.slug
      FROM campaigns JOIN campaign_slugs AS current ON current.campaign_id = campaigns.id AND current.is_current = 1
      WHERE campaigns.id = ?`,
    ).bind(parts[1]).first();
    if (!campaign) return error("Campaign not found.", 404);
    if (campaign.slug === slug) return json({ ok: true, slug });
    const occupied = await env.DB.prepare("SELECT campaign_id FROM campaign_slugs WHERE slug = ?").bind(slug).first();
    if (occupied) return error("That campaign slug is already reserved.", 409);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE campaign_slugs SET is_current = 0 WHERE campaign_id = ? AND is_current = 1").bind(parts[1]),
      env.DB.prepare("INSERT INTO campaign_slugs (slug, campaign_id, is_current, created_at) VALUES (?, ?, 1, ?)").bind(slug, parts[1], now),
      env.DB.prepare("UPDATE campaigns SET updated_at = ? WHERE id = ?").bind(now, parts[1]),
    ]);
    return json({ ok: true, slug, previousSlug: campaign.slug, updatedAt: now });
  }
  return error("Method not allowed.", 405);
}

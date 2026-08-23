import { adminAuthorized } from "../auth.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { loadSettings, updateSettings } from "../settings.js";
import {
  ASSIGNABLE_ROLES,
  PRIMARY_ADMIN_EMAIL,
  hashPassword,
  normalizeEmail,
  passwordProblem,
} from "../user-auth.js";

export async function adminRoute(request, env, parts) {
  if (!await adminAuthorized(request, env)) return error("Primary administrator access required.", 401);
  if (request.method === "GET" && parts.length === 0) {
    const [settings, characters] = await Promise.all([
      loadSettings(env),
      env.DB.prepare("SELECT id, document_json, source, active, updated_at FROM characters ORDER BY id").all(),
    ]);
    let users = { results: [] };
    try {
      users = await env.DB.prepare("SELECT id, email, roles_json, created_at, updated_at FROM users ORDER BY email COLLATE NOCASE").all();
    } catch (caught) {
      console.warn("User accounts could not be listed. Apply migration 0006.", caught);
    }
    return json({
      settings,
      characters: characters.results.map((row) => ({
        id: row.id,
        name: parseStored(row.document_json, {})?.name || row.id,
        source: row.source,
        active: Boolean(row.active),
        updatedAt: row.updated_at,
      })),
      users: users.results.map((row) => ({
        id: row.id,
        email: row.email,
        roles: normalizeEmail(row.email) === PRIMARY_ADMIN_EMAIL
          ? [...ASSIGNABLE_ROLES, "admin"]
          : [...new Set([
            "characters",
            ...parseStored(row.roles_json, []).filter((role) => ASSIGNABLE_ROLES.includes(role)),
          ])],
        isPrimaryAdmin: normalizeEmail(row.email) === PRIMARY_ADMIN_EMAIL,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  }
  if (request.method === "PUT" && parts[0] === "settings" && parts.length === 1) {
    return updateSettings(request, env);
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
    const roles = [...new Set(["characters", ...requestedRoles])];
    const target = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(parts[1]).first();
    if (!target) return error("User not found.", 404);
    if (normalizeEmail(target.email) === PRIMARY_ADMIN_EMAIL) return error("The primary administrator always has full access.", 409);
    await env.DB.prepare("UPDATE users SET roles_json = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(roles), new Date().toISOString(), parts[1]).run();
    return json({ ok: true, roles });
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
  return error("Method not allowed.", 405);
}

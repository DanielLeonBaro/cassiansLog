import { parseStored } from "./http.js";

export const PRIMARY_ADMIN_EMAIL = "dleonbaro@gmail.com";
export const DEFAULT_ROLES = [
  "characters",
  "player-screen",
  "wiki",
  "compendium",
  "combat-loot",
  "public-initiative",
  "music",
];
export const ASSIGNABLE_ROLES = [...DEFAULT_ROLES, "dm-screen"];
export const MANDATORY_ROLES = ["characters", "player-screen"];

const SESSION_COOKIE = "cassianslog_session";
// Cloudflare Workers Web Crypto rejects PBKDF2 counts above 100,000.
const PASSWORD_ITERATIONS = 100_000;
const SESSION_DAYS = 30;

export function isLocalRequest(request) {
  try {
    return new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
      .has(new URL(request.url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function localBypassUser() {
  return {
    id: "localhost",
    email: "localhost@cassianslog.local",
    roles: [...ASSIGNABLE_ROLES, "admin"],
    isPrimaryAdmin: true,
    localBypass: true,
    providers: [],
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 10) return "Password must contain at least 10 characters.";
  if (!/\d/.test(password)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character.";
  return "";
}

async function sha256(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

export async function hashPassword(password, salt = null, iterations = PASSWORD_ITERATIONS) {
  const saltBytes = salt ? base64ToBytes(salt) : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    material,
    256,
  );
  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(saltBytes),
    iterations,
  };
}

function cookieValue(request, name) {
  const match = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function publicUser(row) {
  if (!row) return null;
  const isPrimaryAdmin = normalizeEmail(row.email) === PRIMARY_ADMIN_EMAIL;
  const roles = isPrimaryAdmin
    ? [...ASSIGNABLE_ROLES, "admin"]
    : [...new Set([
      ...MANDATORY_ROLES,
      ...parseStored(row.roles_json, []).filter((role) => ASSIGNABLE_ROLES.includes(role)),
    ])];
  return { id: row.id, email: row.email, roles, isPrimaryAdmin };
}

export async function ensurePrimaryAdmin(env) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(PRIMARY_ADMIN_EMAIL).first();
  if (existing) return;
  const password = env.PRIMARY_ADMIN_PASSWORD || "adminPass1!";
  const credentials = await hashPassword(password);
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(),
    PRIMARY_ADMIN_EMAIL,
    credentials.hash,
    credentials.salt,
    credentials.iterations,
    JSON.stringify([...DEFAULT_ROLES, "admin"]),
    now,
    now,
  ).run();
}

export async function verifyPassword(row, password) {
  if (!row) {
    await hashPassword(password || "invalid-password");
    return false;
  }
  const candidate = await hashPassword(password, row.password_salt, row.password_iterations);
  const left = base64ToBytes(candidate.hash);
  const right = base64ToBytes(row.password_hash);
  if (left.length !== right.length) return false;
  let difference = 0;
  left.forEach((byte, index) => { difference |= byte ^ right[index]; });
  return difference === 0;
}

export async function userFromRequest(request, env) {
  if (isLocalRequest(request)) return localBypassUser();
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT users.id, users.email, users.roles_json FROM user_sessions JOIN users ON users.id = user_sessions.user_id WHERE user_sessions.token_hash = ? AND user_sessions.expires_at > ?",
  ).bind(tokenHash, new Date().toISOString()).first();
  return publicUser(row);
}

export async function createSession(userId, env) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await env.DB.prepare(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).bind(tokenHash, userId, expires.toISOString(), now.toISOString()).run();
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function destroySession(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM user_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function hasRole(user, role) {
  return Boolean(user?.isPrimaryAdmin || user?.roles?.includes(role));
}

export async function createOpaqueState(provider, context, env, minutes = 10) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(24)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const now = new Date();
  await env.DB.prepare(
    "INSERT INTO oauth_states (token_hash, provider, context_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(
    await sha256(token),
    provider,
    JSON.stringify(context || {}),
    new Date(now.getTime() + minutes * 60_000).toISOString(),
    now.toISOString(),
  ).run();
  return token;
}

export async function consumeOpaqueState(token, provider, env) {
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT context_json FROM oauth_states WHERE token_hash = ? AND provider = ? AND expires_at > ?",
  ).bind(tokenHash, provider, new Date().toISOString()).first();
  await env.DB.prepare("DELETE FROM oauth_states WHERE token_hash = ?").bind(tokenHash).run();
  return row ? parseStored(row.context_json, {}) : null;
}

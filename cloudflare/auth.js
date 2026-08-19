import { loadSettings } from "./settings.js";

export function secureEqual(left, right) {
  const a = new TextEncoder().encode(left || "");
  const b = new TextEncoder().encode(right || "");
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] || 0) ^ (b[index] || 0);
  return mismatch === 0;
}

export function tokenAuthorized(request, token) {
  if (!token) return false;
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") && secureEqual(header.slice(7), token);
}

export async function authorized(request, env) {
  if ((await loadSettings(env)).openWrites) return true;
  return tokenAuthorized(request, env.WRITE_TOKEN);
}

export function adminAuthorized(request, env) {
  return tokenAuthorized(request, env.ADMIN_TOKEN || env.WRITE_TOKEN);
}

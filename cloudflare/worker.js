import { error, json, safeId } from "./http.js";
import { publicSettings } from "./settings.js";
import { adminRoute } from "./routes/admin.js";
import { characterRoute, listCharacters } from "./routes/characters.js";
import { combatRoute } from "./routes/combat-loot.js";
import { compendiumCatalog, compendiumCategory } from "./routes/compendium.js";
import { musicRoute } from "./routes/music.js";
import { wikiRoute } from "./routes/wiki.js";
import { authRoute } from "./routes/auth.js";
import { themeCatalogRoute } from "./routes/themes.js";
import { ensurePrimaryAdmin, hasRole, isLocalRequest, userFromRequest } from "./user-auth.js";

const PUBLIC_ASSET_PATTERN = /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|map)$/i;
const PAGE_ROLES = [
  [/^\/admin(?:\/|$)/, "admin"],
  [/^\/char(?:\/|$)/, "characters"],
  [/^\/wiki(?:\/|$)/, "wiki"],
  [/^\/compendium(?:\/|$)/, "compendium"],
  [/^\/combat-loot(?:\/|$)/, "combat-loot"],
  [/^\/public-initiative(?:\/|$)/, "public-initiative"],
  [/^\/music(?:\/|$)/, "music"],
];

function requiredPageRole(pathname) {
  return PAGE_ROLES.find(([pattern]) => pattern.test(pathname))?.[1] || null;
}

function requiredApiRole(pathname) {
  if (pathname.startsWith("/api/characters")) return "characters";
  if (pathname.startsWith("/api/wiki")) return "wiki";
  if (pathname.startsWith("/api/compendium")) return "compendium";
  if (pathname.startsWith("/api/combat-loot")) return "combat-loot";
  if (pathname.startsWith("/api/music")) return "music";
  return null;
}

function loginRedirect(url, reason = "") {
  const target = new URL("/login/", url);
  if (url.pathname !== "/") target.searchParams.set("return", `${url.pathname}${url.search}`);
  if (reason) target.searchParams.set("error", reason);
  return Response.redirect(target.toString(), 302);
}

async function staticAsset(request, env, url) {
  if (url.pathname === "/login") return Response.redirect(new URL("/login/", url).toString(), 301);
  const localBypass = isLocalRequest(request);
  const publicPath = url.pathname === "/login" || url.pathname.startsWith("/login/") || PUBLIC_ASSET_PATTERN.test(url.pathname);
  if (!publicPath && !localBypass) {
    if (!env.DB) return loginRedirect(url, "Authentication storage is unavailable.");
    await ensurePrimaryAdmin(env);
    const user = await userFromRequest(request, env);
    if (!user) return loginRedirect(url);
    const role = requiredPageRole(url.pathname);
    if (role && !hasRole(user, role)) {
      const fallback = new URL("/char/", url);
      fallback.searchParams.set("access", "denied");
      return Response.redirect(fallback.toString(), 302);
    }
  } else if ((url.pathname === "/login" || url.pathname === "/login/") && localBypass) {
    return Response.redirect(new URL("/char/", url).toString(), 302);
  } else if ((url.pathname === "/login" || url.pathname === "/login/") && env.DB) {
    await ensurePrimaryAdmin(env);
    if (await userFromRequest(request, env)) return Response.redirect(new URL("/char/", url).toString(), 302);
  }
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || request.method !== "GET") return response;

  if (/^\/char\/[a-z0-9][a-z0-9-]{0,127}\/?$/i.test(url.pathname)) {
    const templateURL = new URL("/char/template/", url);
    templateURL.search = url.search;
    return env.ASSETS.fetch(new Request(templateURL.toString(), request));
  }
  if (/^\/wiki\/[^/]+\/?$/i.test(url.pathname)) {
    const wikiURL = new URL("/wiki/", url);
    return env.ASSETS.fetch(new Request(wikiURL.toString(), request));
  }
  return response;
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) {
    try {
      return await staticAsset(request, env, url);
    } catch (caught) {
      console.error(JSON.stringify({
        event: "static_request_failed",
        pathname: url.pathname,
        error: caught instanceof Error ? caught.message : String(caught),
      }));
      return error("Authentication service is temporarily unavailable.", 503);
    }
  }
  if (!env.DB) return error("D1 binding is unavailable.", 503);
  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      await env.DB.prepare("SELECT 1").first();
      return json({ ok: true });
    }
    if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
      const parts = url.pathname.slice("/api/auth".length).split("/").filter(Boolean).map(decodeURIComponent);
      return authRoute(request, env, parts);
    }
    if (!isLocalRequest(request) && env.AUTH_REQUIRED !== "false" && !url.pathname.startsWith("/api/admin")) {
      const user = await userFromRequest(request, env);
      if (!user) return error("Sign in required.", 401);
      const role = requiredApiRole(url.pathname);
      if (role && !hasRole(user, role)) return error("Your account cannot access this resource.", 403);
    }
    if (url.pathname === "/api/settings" && request.method === "GET") return publicSettings(env);
    if (url.pathname === "/api/themes" && request.method === "GET") return themeCatalogRoute(env);
    if (url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) {
      const parts = url.pathname.slice("/api/admin".length).split("/").filter(Boolean).map(decodeURIComponent);
      return adminRoute(request, env, parts);
    }
    if (url.pathname === "/api/compendium/catalog" && request.method === "GET") {
      return compendiumCatalog(env);
    }
    if (url.pathname.startsWith("/api/compendium/categories/") && request.method === "GET") {
      const category = safeId(decodeURIComponent(url.pathname.split("/").at(-1)));
      return category ? compendiumCategory(category, env) : error("Invalid category.");
    }
    if (url.pathname === "/api/characters" && request.method === "GET") return listCharacters(env);
    if (url.pathname.startsWith("/api/characters/")) {
      const parts = url.pathname.slice("/api/characters/".length).split("/").map(decodeURIComponent);
      return characterRoute(request, env, parts[0], parts[1] || "");
    }
    if (url.pathname === "/api/combat-loot" || url.pathname.startsWith("/api/combat-loot/")) {
      const parts = url.pathname.slice("/api/combat-loot".length).split("/").filter(Boolean).map(decodeURIComponent);
      return combatRoute(request, env, parts);
    }
    if (url.pathname === "/api/music") return musicRoute(request, env);
    if (url.pathname === "/api/wiki") return wikiRoute(request, env);
    return error("API route not found.", 404);
  } catch (caught) {
    console.error("API request failed", caught);
    if (caught instanceof SyntaxError) return error("Request body must be valid JSON.");
    if (caught instanceof RangeError) return error(caught.message, 413);
    return error("The database request failed.", 500);
  }
}

export default {
  fetch: handleRequest,
};

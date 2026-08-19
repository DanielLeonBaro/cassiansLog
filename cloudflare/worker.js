import { error, json, safeId } from "./http.js";
import { publicSettings } from "./settings.js";
import { adminRoute } from "./routes/admin.js";
import { characterRoute, listCharacters } from "./routes/characters.js";
import { combatRoute } from "./routes/combat-loot.js";
import { compendiumCatalog, compendiumCategory } from "./routes/compendium.js";
import { musicRoute } from "./routes/music.js";
import { wikiRoute } from "./routes/wiki.js";

async function staticAsset(request, env, url) {
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
  if (!url.pathname.startsWith("/api/")) return staticAsset(request, env, url);
  if (!env.DB) return error("D1 binding is unavailable.", 503);
  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      await env.DB.prepare("SELECT 1").first();
      return json({ ok: true });
    }
    if (url.pathname === "/api/settings" && request.method === "GET") return publicSettings(env);
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

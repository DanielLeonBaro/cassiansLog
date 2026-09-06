// Routes static pages and APIs while enforcing authentication and clean-route fallbacks.
import { error, json, safeId } from "./http.js";
import { publicSettings } from "./settings.js";
import { adminRoute } from "./routes/admin.js";
import { characterRoute, listCharacters } from "./routes/characters.js";
import { combatRoute } from "./routes/combat-loot.js";
import { campaignRoute } from "./routes/campaigns.js";
import { compendiumCatalog, compendiumCategory } from "./routes/compendium.js";
import { musicRoute } from "./routes/music.js";
import { publicInitiativeRoute } from "./routes/public-initiative.js";
import { screenRoute } from "./routes/screens.js";
import { wikiRoute } from "./routes/wiki.js";
import { authRoute } from "./routes/auth.js";
import { themeCatalogRoute } from "./routes/themes.js";
import { ensurePrimaryAdmin, hasRole, isLocalRequest, userFromRequest } from "./user-auth.js";
import { campaignAccess, canManageCampaign, LEGACY_CAMPAIGN_SLUG } from "./campaigns.js";

const PUBLIC_ASSET_PATTERN = /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|map)$/i;
const PAGE_ROLES = [
  [/^\/admin(?:\/|$)/, "admin"],
  [/^\/char(?:\/|$)/, "characters"],
  [/^\/player-screen(?:\/|$)/, "player-screen"],
  [/^\/dm-screen(?:\/|$)/, "dm-screen"],
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
  if (pathname.startsWith("/api/screens/player")) return "player-screen";
  if (pathname.startsWith("/api/screens/dm")) return "dm-screen";
  if (pathname.startsWith("/api/public-initiative")) return "public-initiative";
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
    const campaignsReady = await campaignStorageReady(env);
    if (role && (role === "admin" || !campaignsReady) && !hasRole(user, role)) {
      const fallback = new URL("/char/", url);
      fallback.searchParams.set("access", "denied");
      return Response.redirect(fallback.toString(), 302);
    }
  } else if ((url.pathname === "/login" || url.pathname === "/login/") && localBypass) {
    return Response.redirect(new URL("/char/", url).toString(), 302);
  } else if ((url.pathname === "/login" || url.pathname === "/login/") && env.DB) {
    await ensurePrimaryAdmin(env);
    if (await userFromRequest(request, env)) {
      const destination = await campaignStorageReady(env) ? "/campaigns/" : "/char/";
      return Response.redirect(new URL(destination, url).toString(), 302);
    }
  }

  if (await campaignStorageReady(env)) {
    if (url.pathname === "/") return Response.redirect(new URL("/campaigns/", url).toString(), 302);
    const campaignMatch = /^\/c\/([a-z]{2,48})(?:\/(.*))?$/.exec(url.pathname);
    if (campaignMatch) {
      const access = await campaignAccess(request, env, campaignMatch[1]);
      if (access.response) {
        const destination = new URL("/campaigns/", url);
        if (access.response.status === 403) destination.searchParams.set("join", campaignMatch[1]);
        return access.response.status === 401 ? loginRedirect(url) : Response.redirect(destination.toString(), 302);
      }
      const tail = campaignMatch[2] || "";
      if (access.canonicalSlug !== campaignMatch[1]) {
        return Response.redirect(new URL(`/c/${access.canonicalSlug}/${tail}`, url).toString(), 301);
      }
      if (!tail) return Response.redirect(new URL(`/c/${access.canonicalSlug}/char/`, url).toString(), 302);
      const segments = tail.split("/").filter(Boolean);
      const feature = segments[0];
      if (["dm-screen", "manage"].includes(feature) && !canManageCampaign(access)) {
        return Response.redirect(new URL(`/c/${access.canonicalSlug}/char/?access=denied`, url).toString(), 302);
      }
      const shells = {
        "combat-loot": "/combat-loot/",
        compendium: "/compendium/",
        "dm-screen": "/dm-screen/",
        manage: "/campaigns/manage.html",
        music: "/music/",
        "player-screen": "/player-screen/",
        "public-initiative": "/public-initiative/",
        wiki: "/wiki/",
      };
      const shell = feature === "char"
        ? (segments.length > 1 ? "/char/template/" : "/char/")
        : shells[feature];
      if (!shell) return error("Campaign page not found.", 404);
      const shellURL = new URL(shell, url);
      shellURL.search = url.search;
      return env.ASSETS.fetch(new Request(shellURL.toString(), request));
    }

    const legacyMatch = /^\/(char|wiki|music|combat-loot|public-initiative|player-screen|dm-screen)(?:\/|$)/.test(url.pathname);
    if (legacyMatch) {
      const access = await campaignAccess(request, env, LEGACY_CAMPAIGN_SLUG);
      if (!access.response) return Response.redirect(new URL(`/c/${LEGACY_CAMPAIGN_SLUG}${url.pathname}${url.search}`, url).toString(), 302);
      return Response.redirect(new URL(`/campaigns/?join=${LEGACY_CAMPAIGN_SLUG}`, url).toString(), 302);
    }
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

async function campaignStorageReady(env) {
  try {
    return Boolean(await env.DB.prepare("SELECT id FROM campaigns WHERE id = 'campaign-breugaire'").first());
  } catch {
    return false;
  }
}

async function legacyCampaignApi(request, env, url) {
  if (!await campaignStorageReady(env)) return null;
  const routes = [
    ["/api/characters", "characters"],
    ["/api/combat-loot", "combat-loot"],
    ["/api/public-initiative", "public-initiative"],
    ["/api/screens", "screens"],
    ["/api/settings", "settings"],
    ["/api/music", "music"],
    ["/api/wiki", "wiki"],
  ];
  const match = routes.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
  if (!match) return null;
  const tail = url.pathname.slice(match[0].length).split("/").filter(Boolean).map(decodeURIComponent);
  return campaignRoute(request, env, [LEGACY_CAMPAIGN_SLUG, match[1], ...tail]);
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
    if (url.pathname === "/api/campaigns" || url.pathname.startsWith("/api/campaigns/")) {
      const parts = url.pathname.slice("/api/campaigns".length).split("/").filter(Boolean).map(decodeURIComponent);
      return campaignRoute(request, env, parts);
    }
    if (!isLocalRequest(request) && env.AUTH_REQUIRED !== "false" && !url.pathname.startsWith("/api/admin")) {
      const user = await userFromRequest(request, env);
      if (!user) return error("Sign in required.", 401);
      const role = requiredApiRole(url.pathname);
      if (role && !await campaignStorageReady(env) && !hasRole(user, role)) return error("Your account cannot access this resource.", 403);
    }
    if (url.pathname === "/api/themes" && request.method === "GET") return themeCatalogRoute(env);
    if (url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) {
      const parts = url.pathname.slice("/api/admin".length).split("/").filter(Boolean).map(decodeURIComponent);
      return adminRoute(request, env, parts);
    }
    const legacyCampaignResponse = await legacyCampaignApi(request, env, url);
    if (legacyCampaignResponse) return legacyCampaignResponse;
    if (url.pathname === "/api/settings" && request.method === "GET") return publicSettings(env);
    if (url.pathname === "/api/compendium/catalog" && request.method === "GET") {
      return compendiumCatalog(env);
    }
    if (url.pathname === "/api/public-initiative" && request.method === "GET") {
      return publicInitiativeRoute(env);
    }
    if (url.pathname === "/api/screens" || url.pathname.startsWith("/api/screens/")) {
      const parts = url.pathname.slice("/api/screens".length).split("/").filter(Boolean).map(decodeURIComponent);
      return screenRoute(request, env, parts);
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

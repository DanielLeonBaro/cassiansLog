// Proxies one fixed D&D Beyond character endpoint because its browser API does not allow cross-origin reads.
import { error } from "../http.js";

const CHARACTER_ID = /^\d{1,12}$/;
const MAX_UPSTREAM_BYTES = 2_000_000;

export function dndBeyondCharacterURL(id) {
  if (!CHARACTER_ID.test(id || "")) return null;
  return `https://character-service.dndbeyond.com/character/v5/character/${id}?includeCustomItems=true`;
}

export async function dndBeyondCharacterRoute(request, id) {
  if (request.method !== "GET") return error("Method not allowed.", 405);
  const upstreamURL = dndBeyondCharacterURL(id);
  if (!upstreamURL) return error("Invalid D&D Beyond character ID.");

  const response = await fetch(upstreamURL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    await response.body?.cancel();
    const unavailable = response.status === 401 || response.status === 403 || response.status === 404;
    return error(
      unavailable
        ? "D&D Beyond could not share that character. Make the sheet public or import its exported PDF."
        : "D&D Beyond is temporarily unavailable.",
      unavailable ? 422 : 502,
    );
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    await response.body?.cancel();
    return error("D&D Beyond returned an unexpected response.", 502);
  }
  const length = Number(response.headers.get("content-length")) || 0;
  if (length > MAX_UPSTREAM_BYTES) {
    await response.body?.cancel();
    return error("The D&D Beyond character is too large to import.", 413);
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

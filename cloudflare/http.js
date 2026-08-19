const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const MAX_JSON_BYTES = 1_800_000;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/i;

export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export function safeId(value) {
  return ID_PATTERN.test(value || "") ? value : null;
}

export async function bodyJSON(request) {
  const length = Number(request.headers.get("content-length")) || 0;
  if (length > MAX_JSON_BYTES) throw new RangeError("The document is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) {
    throw new RangeError("The document is too large.");
  }
  return JSON.parse(text);
}

export function parseStored(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

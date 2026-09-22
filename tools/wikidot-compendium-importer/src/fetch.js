import { readFile } from "node:fs/promises";
import path from "node:path";
import { robotsAllows } from "./robots.js";
import { sha256, urlKey, writeAtomic } from "./paths.js";

const retryable = new Set([408, 425, 429, 500, 502, 503, 504]);

async function optionalJSON(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function createRetriever({
  fetchImpl = globalThis.fetch,
  cacheDir = ".cache",
  rateMs = 1000,
  retries = 2,
  obeyRobots = true,
  userAgent = "wikidot-compendium-importer/0.1",
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = () => Date.now(),
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const lastRequest = new Map();
  const robotsCache = new Map();

  async function throttle(url) {
    const origin = new URL(url).origin;
    const previous = lastRequest.get(origin);
    const wait = previous === undefined ? 0 : Math.max(0, Number(rateMs) - (now() - previous));
    if (wait) await sleep(wait);
    lastRequest.set(origin, now());
  }

  async function request(url) {
    let lastError;
    for (let attempt = 0; attempt <= Number(retries); attempt += 1) {
      await throttle(url);
      try {
        const response = await fetchImpl(url, { headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1", "user-agent": userAgent } });
        if (response.ok) return response;
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        if (!retryable.has(response.status) || attempt === Number(retries)) throw lastError;
      } catch (error) {
        lastError = error;
        if (attempt === Number(retries)) throw error;
      }
      await sleep(Math.max(Number(rateMs), 100) * (attempt + 1));
    }
    throw lastError;
  }

  async function robotsBody(url) {
    const origin = new URL(url).origin;
    if (robotsCache.has(origin)) return robotsCache.get(origin);
    const robotsUrl = `${origin}/robots.txt`;
    const cachePath = path.join(cacheDir, "robots", `${urlKey(origin)}.txt`);
    let body;
    try {
      body = await readFile(cachePath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      try {
        const response = await request(robotsUrl);
        body = await response.text();
        await writeAtomic(cachePath, body);
      } catch {
        body = "User-agent: *\nDisallow:";
      }
    }
    robotsCache.set(origin, body);
    return body;
  }

  async function retrieve(url, { resume = false } = {}) {
    const target = new URL(url).href;
    const cachePath = path.join(cacheDir, "pages", `${urlKey(target)}.json`);
    if (resume) {
      const cached = await optionalJSON(cachePath);
      if (cached?.url === target && typeof cached.body === "string") return { ...cached, fromCache: true };
    }
    if (obeyRobots && !robotsAllows(await robotsBody(target), target, userAgent)) throw new Error(`Blocked by robots.txt: ${target}`);
    const response = await request(target);
    const body = await response.text();
    const record = {
      url: target,
      status: response.status,
      contentType: response.headers?.get?.("content-type") || "",
      retrievedAt: new Date(now()).toISOString(),
      sha256: sha256(body),
      body,
      fromCache: false,
    };
    await writeAtomic(cachePath, `${JSON.stringify(record)}\n`);
    return record;
  }

  return { retrieve };
}

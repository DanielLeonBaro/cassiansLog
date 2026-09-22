import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRetriever } from "../src/fetch.js";

test("retrieval obeys robots, rate limits, caches, and resumes", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wikidot-retriever-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const waits = [];
  let clock = 0;
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /private\nAllow: /background", { status: 200 });
    return new Response("<html>Far Traveler</html>", { status: 200, headers: { "content-type": "text/html" } });
  };
  const retriever = createRetriever({ fetchImpl, cacheDir: root, rateMs: 250, retries: 0, now: () => clock, sleep: async (milliseconds) => { waits.push(milliseconds); clock += milliseconds; } });
  const url = "https://dnd5e.wikidot.com/background:far-traveler";
  const first = await retriever.retrieve(url);
  const resumed = await retriever.retrieve(url, { resume: true });
  assert.equal(first.fromCache, false);
  assert.equal(resumed.fromCache, true);
  assert.equal(first.sha256, resumed.sha256);
  assert.equal(calls.length, 2, "robots and page should each fetch once");
  assert.deepEqual(waits, [250]);
  await assert.rejects(() => retriever.retrieve("https://dnd5e.wikidot.com/private:secret"), /Blocked by robots\.txt/);
});

test("retryable HTTP failures retry with bounded backoff", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wikidot-retry-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  let pageAttempts = 0;
  let clock = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow:", { status: 200 });
    pageAttempts += 1;
    return pageAttempts === 1 ? new Response("busy", { status: 503 }) : new Response("ok", { status: 200 });
  };
  const retriever = createRetriever({ fetchImpl, cacheDir: root, rateMs: 10, retries: 1, now: () => clock, sleep: async (milliseconds) => { clock += milliseconds; } });
  const result = await retriever.retrieve("https://dnd5e.wikidot.com/feat:alert");
  assert.equal(result.body, "ok");
  assert.equal(pageAttempts, 2);
});

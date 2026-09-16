// Verifies headless Firefox browser smoke behavior.
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { COMPONENT_TAGS, matchesTags, parseRequestedTags } = require("./component-tags.cjs");

const root = process.cwd();
const timeoutMilliseconds = 30_000;
const requestedTags = parseRequestedTags(process.argv.slice(2));

if (process.argv.includes("--list-tags")) {
  console.log(COMPONENT_TAGS.join("\n"));
  process.exit(0);
}

function includesTag(...tags) {
  return matchesTags(requestedTags, tags);
}

function executable(name, explicitPath) {
  if (explicitPath) return explicitPath;
  for (const directory of String(process.env.PATH || "").split(path.delimiter)) {
    const candidate = path.join(directory, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Try the next PATH entry.
    }
  }
  return null;
}

function contentType(file) {
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  })[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function staticServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/api/campaigns") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ campaigns: [
        { id: "one", name: "Joined Campaign", description: "A joined adventure.", banner: "", slug: "joined", joined: true, role: "dm", joinEnabled: true },
        { id: "two", name: "Open Campaign", description: "A campaign waiting for you.", banner: "", slug: "open", joined: false, role: null, joinEnabled: true },
      ] }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/campaigns/joined") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end('{"campaign":{"id":"one","name":"Joined Campaign","description":"A joined adventure.","banner":"","slug":"joined","joined":true,"role":"dm","joinEnabled":true}}');
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/campaigns/joined/characters") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end('{"characters":[],"authoritative":true}');
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/campaigns/joined/wiki") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end('{"pages":[{"id":"home","name":"Local Campaign Home","type":"Lore","summary":"Loaded through the campaign API.","body":"Local campaign wiki."}],"canEdit":true}');
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/campaigns/joined/members") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end('{"members":[{"id":"localhost","email":"localhost@cassianslog.local","role":"dm"}]}');
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/campaigns/joined/settings") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end('{"settings":{"sections":{"characters":true,"wiki":true,"dm-screen":true},"characterSheetStyle":"v1","characterSheetStyleOverrides":{}},"canEdit":true}');
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/campaigns/joined/characters/cassian") {
      const document = JSON.parse(fs.readFileSync(path.join(root, "char/cassian/character.json"), "utf8"));
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ id: "cassian", document, canEdit: true, canManage: true }));
      return;
    }
    if (request.method === "GET" && /^\/api\/campaigns\/joined\/characters\/cassian\/(?:state|notes)$/.test(url.pathname)) {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end('{"value":null,"canEdit":true}');
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/dnd-beyond/characters/123456789") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ success: true, data: {
        name: "Imported Browser Hero",
        classes: [{ level: 3, definition: { name: "Wizard", classFeatures: [] }, subclassDefinition: { name: "Evoker", classFeatures: [] } }],
        race: { fullName: "High Elf", weightSpeeds: { normal: { walk: 30, fly: 0 } }, racialTraits: [] },
        background: { definition: { name: "Sage" } },
        stats: [
          { id: 1, value: 8 }, { id: 2, value: 14 }, { id: 3, value: 12 },
          { id: 4, value: 16 }, { id: 5, value: 10 }, { id: 6, value: 10 },
        ],
        bonusStats: [], overrideStats: [], modifiers: {}, baseHitPoints: 17,
        inventory: [], actions: {}, feats: [], spells: {}, classSpells: [], spellSlots: [], pactMagic: [], currencies: {},
      } }));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end('{"error":"Local browser smoke test has no D1 API."}');
      return;
    }

    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!relative || relative.endsWith("/")) relative += "index.html";
    const file = path.resolve(root, relative);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    fs.createReadStream(file).pipe(response);
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function availablePort() {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function eventually(check, message, timeout = timeoutMilliseconds) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function webdriverRequest(port, method, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.value?.error) {
    throw new Error(result.value?.message || `WebDriver ${method} ${pathname} failed (${response.status}).`);
  }
  return result.value;
}

async function main() {
  const geckodriver = executable("geckodriver", process.env.GECKODRIVER);
  if (!geckodriver) {
    throw new Error("GeckoDriver is required. Install it or set GECKODRIVER to its executable path.");
  }

  const server = staticServer();
  const serverPort = await listen(server);
  const driverPort = await availablePort();
  const driver = childProcess.spawn(geckodriver, ["--port", String(driverPort)], {
    env: { ...process.env, MOZ_HEADLESS: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let driverOutput = "";
  driver.stdout.on("data", (chunk) => { driverOutput += chunk; });
  driver.stderr.on("data", (chunk) => { driverOutput += chunk; });
  let sessionId = null;

  const close = async () => {
    if (sessionId) {
      await webdriverRequest(driverPort, "DELETE", `/session/${sessionId}`).catch(() => undefined);
    }
    if (!driver.killed) driver.kill("SIGTERM");
    await new Promise((resolve) => server.close(resolve));
  };

  process.once("SIGINT", () => close().finally(() => process.exit(130)));
  process.once("SIGTERM", () => close().finally(() => process.exit(143)));

  try {
    await eventually(
      () => webdriverRequest(driverPort, "GET", "/status").then((status) => status?.ready),
      "GeckoDriver did not become ready",
    );
    const session = await webdriverRequest(driverPort, "POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          acceptInsecureCerts: true,
          "moz:firefoxOptions": { args: ["-headless"] },
        },
      },
    });
    sessionId = session.sessionId;
    const base = `http://127.0.0.1:${serverPort}`;
    console.log(`Browser smoke selection: ${requestedTags.size ? [...requestedTags].join(", ") : "all tags"}`);

    async function command(method, pathname, body) {
      return webdriverRequest(driverPort, method, `/session/${sessionId}${pathname}`, body);
    }

    async function execute(script, args = []) {
      return command("POST", "/execute/sync", { script, args });
    }

    async function navigate(route) {
      await command("POST", "/url", { url: `${base}${route}` });
    }

    async function waitFor(script, message) {
      return eventually(() => execute(script), message);
    }

    async function smoke(label, route, readyScript, verifyScript) {
      await navigate(route);
      await waitFor(readyScript, `${label} did not become ready`);
      const result = await execute(verifyScript);
      assert.equal(result, true, `${label} browser contract failed.`);
      console.log(`Browser smoke passed: ${label}`);
    }

    if (requestedTags.size && !requestedTags.has("@campaigns") && !requestedTags.has("@auth")) {
      await navigate("/login/");
      await waitFor('return document.querySelectorAll("#local-test-user option").length === 21;', "Focused browser setup did not load");
      await execute(`
        localStorage.setItem("cassianslog-local-user-v1", "localhost-admin");
        localStorage.setItem("cassianslog-last-campaign-v1:localhost-admin", JSON.stringify({ id: "campaign-breugaire", slug: "aotr" }));
        return true;
      `);
      await navigate("/campaigns/");
      await waitFor('return Boolean(navigator.serviceWorker.controller);', "Focused browser route fallback did not activate");
    }

    async function auditCurrentLayout(label) {
      const result = await execute(`
        const visible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const insideScroller = (element) => {
          let ancestor = element.parentElement;
          while (ancestor && ancestor !== document.body) {
            if (["auto", "scroll"].includes(getComputedStyle(ancestor).overflowX)) return true;
            ancestor = ancestor.parentElement;
          }
          return false;
        };
        const escapedControls = [...document.querySelectorAll("button, input, select, textarea, .tracker-badge")]
          .filter(visible)
          .filter((element) => !insideScroller(element))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > innerWidth + 1;
          })
          .map((element) => element.id || element.getAttribute("aria-label") || element.tagName)
          .slice(0, 5);
        const escapedHeaderBadges = [...document.querySelectorAll(".tracker-card-header .tracker-badge")]
          .filter(visible)
          .filter((badge) => {
            const badgeRect = badge.getBoundingClientRect();
            const headerRect = badge.closest(".tracker-card-header").getBoundingClientRect();
            return badgeRect.left < headerRect.left - 1 || badgeRect.right > headerRect.right + 1;
          }).length;
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          escapedControls,
          escapedHeaderBadges,
        };
      `);
      assert.deepEqual(result, { overflow: false, escapedControls: [], escapedHeaderBadges: 0 }, `${label} alignment audit failed.`);
    }

    if (includesTag("@auth", "@campaigns")) await smoke(
      "Local test-user login",
      "/login/",
      'return document.querySelectorAll("#local-test-user option").length === 21;',
      'return !document.getElementById("local-test-login").classList.contains("hidden") && document.getElementById("local-test-user").value === "localhost-admin";',
    );
    if (includesTag("@campaigns")) {
    await smoke(
      "Campaign discovery placeholder",
      "/campaigns/",
      'return document.querySelectorAll("#campaign-list article").length === 1 && Boolean(document.querySelector("[data-create-campaign]"));',
      `
        const create = document.querySelector("[data-create-campaign]");
        const badges = [...document.querySelectorAll("#campaign-list article span")].map((badge) => badge.textContent.trim());
        create.click();
        return Boolean(document.getElementById("campaign-create-dialog").classList.contains("flex")
          && document.querySelector("a[href='/c/aotr/char/']")
          && document.querySelector("a[href='/c/aotr/manage/']")
          && badges.includes("/aotr") && badges.includes("Admin") && badges.includes("Active"));
      `,
    );
    await execute(`
      const form = document.getElementById("campaign-create");
      form.elements.name.value = "Sita Campaign";
      form.elements.slug.value = "sita";
      form.elements.description.value = "Screen isolation test.";
      form.elements.status.value = "Paused";
      form.elements.password.value = "secret";
      form.requestSubmit();
      return true;
    `);
    await waitFor('return Boolean(navigator.serviceWorker.controller);', "Local campaign-route fallback did not activate");
    await smoke(
      "Empty new campaign Character list",
      "/c/sita/char/",
      'return document.querySelector("#characters")?.children.length === 0 && document.getElementById("site-campaign")?.textContent === "Sita Campaign";',
      'return location.pathname === "/c/sita/char/";',
    );
    await smoke(
      "AOTR Character archive",
      "/c/aotr/char/",
      'return document.querySelectorAll("#characters article").length === 5 && Boolean(document.querySelector("#site-campaign-menu a[href=\'/c/sita/char/\']"));',
      `
        const quickLinks = [...document.querySelectorAll('main nav [data-section-link]')];
        document.getElementById('site-pages-menu-button').click();
        const clickOpened = !document.getElementById('site-pages-menu').classList.contains('hidden');
        document.getElementById('site-pages-menu-button').click();
        document.getElementById('site-campaign').click();
        return document.getElementById("site-campaign")?.textContent === "Apotheosis of the Rings"
          && document.getElementById("site-campaign").classList.contains("rounded-full")
          && !document.getElementById("site-campaign-menu").classList.contains("hidden")
          && clickOpened
          && quickLinks.every((link) => link.getAttribute("href").startsWith("/c/aotr/"))
          && [...document.querySelectorAll("#characters article span")].filter((badge) => badge.textContent === "Active").length === 5;
      `,
    );
    await smoke(
      "AOTR Cassian localhost tracker",
      "/c/aotr/char/cassian/",
      'return window.character?.id === "cassian" && document.getElementById("character-name")?.textContent.startsWith("Cassian");',
      'return document.body.dataset.characterCanManage === "true" && document.body.dataset.characterCanEdit === "true" && document.getElementById("character-status")?.textContent === "Active";',
    );
    await smoke(
      "AOTR localhost members and characters",
      "/c/aotr/manage/",
      'return document.querySelectorAll("#campaign-members [data-member]").length === 21 && document.querySelectorAll("#campaign-characters [data-character]").length === 5;',
      `
        const cassian = document.querySelector('[data-character="cassian"]');
        const player = cassian?.querySelector('input[value="localhost-player-01"]');
        if (!player) return false;
        player.checked = true;
        cassian.querySelector("[data-save-editors]").click();
        return true;
      `,
    );
    await waitFor('return document.getElementById("manage-status").textContent === "Local character editors saved.";', "Local character assignment did not save");
    await navigate("/login/?return=/c/aotr/char/cassian/");
    await waitFor('return document.querySelectorAll("#local-test-user option").length === 21;', "Local test login did not reopen");
    await execute(`
      const select = document.getElementById("local-test-user");
      select.value = "localhost-player-01";
      document.getElementById("local-test-submit").click();
      return true;
    `);
    await waitFor('return window.character?.id === "cassian";', "Assigned test player could not open Cassian");
    assert.equal(await execute('return document.body.dataset.characterCanEdit === "true" && document.body.dataset.characterCanManage === "false";'), true, "Assigned local player should edit but not manage Cassian.");
    console.log("Browser smoke passed: Local test-user character assignment");

    await navigate("/campaigns/");
    await waitFor('return Boolean(document.querySelector("form[data-join=sita]") && [...document.querySelectorAll("form[data-join=sita] ~ *")]);', "Sita join form was not shown to the test player");
    assert.equal(await execute('return [...document.querySelector("form[data-join=sita]").closest("article").querySelectorAll("span")].some((badge) => badge.textContent === "Paused");'), true, "Campaign status badge should survive local creation.");
    await execute(`
      const form = document.querySelector("form[data-join=sita]");
      form.elements.password.value = "secret";
      form.requestSubmit();
      return true;
    `);
    await waitFor('return location.pathname === "/c/sita/char/";', "Test player did not join Sita");

    await execute(`
      const screen = (title) => JSON.stringify({ document: { version: 1, widgets: [{ id: title.toLowerCase().replaceAll(" ", "-"), type: "note", title, body: "Campaign-specific" }] }, pending: false });
      localStorage.setItem("cassianslog-screen-v1:localhost-player-01:player:campaign:aotr", screen("AOTR Screen"));
      localStorage.setItem("cassianslog-screen-v1:localhost-player-01:player:campaign:sita", screen("Sita Screen"));
      return true;
    `);
    await smoke(
      "AOTR Player Screen isolation",
      "/c/aotr/player-screen/",
      'return document.getElementById("screen-grid")?.textContent.includes("AOTR Screen");',
      'return !document.body.textContent.includes("Sita Screen") && location.pathname === "/c/aotr/player-screen/";',
    );
    await smoke(
      "Sita Player Screen isolation",
      "/c/sita/player-screen/",
      'return document.getElementById("screen-grid")?.textContent.includes("Sita Screen");',
      `
        const campaignLinks = [...document.querySelectorAll('[data-role-link]:not([data-role-link="campaigns"]):not([data-role-link="admin"])')];
        return !document.body.textContent.includes("AOTR Screen")
          && location.pathname === "/c/sita/player-screen/"
          && campaignLinks.every((link) => link.getAttribute("href").startsWith("/c/sita/"));
      `,
    );

    await smoke(
      "Last campaign on global pages",
      "/campaigns/",
      'return document.getElementById("site-campaign")?.textContent === "Sita Campaign";',
      `
        return document.querySelector('[data-site-home]').getAttribute("href") === "/c/sita/char/"
          && document.querySelector('[data-section-link="wiki"]').getAttribute("href") === "/c/sita/wiki/";
      `,
    );

    await navigate("/login/?return=/c/aotr/char/");
    await waitFor('return document.querySelectorAll("#local-test-user option").length === 21;', "Local Admin login did not reopen");
    await execute(`
      const select = document.getElementById("local-test-user");
      select.value = "localhost-admin";
      document.getElementById("local-test-submit").click();
      return true;
    `);
    await waitFor('return location.pathname === "/c/aotr/char/";', "Local Admin did not return to AOTR");
    }

    if (includesTag("@characters")) {
    await smoke(
      "Character archive and Quick Setup",
      "/c/aotr/char/",
      'return document.querySelectorAll("#characters article").length >= 5;',
      `
        const open = document.getElementById("add-character");
        const dialog = document.getElementById("character-dialog");
        open.click();
        const opened = !dialog.classList.contains("hidden") && dialog.classList.contains("flex");
        document.getElementById("cancel-dialog").click();
        return opened;
      `,
    );
    await waitFor(
      'return document.getElementById("character-dialog").classList.contains("hidden");',
      "Quick Setup did not close",
    );
    await execute(`
      document.getElementById("add-character").click();
      document.getElementById("dnd-beyond-import-toggle").click();
      document.getElementById("dnd-beyond-url").value = "https://www.dndbeyond.com/characters/123456789/browser";
      document.getElementById("dnd-beyond-url-import").click();
      return true;
    `);
    await waitFor(
      'return document.getElementById("new-character-name").value === "Imported Browser Hero" && document.getElementById("new-character-class").value === "Wizard" && !document.getElementById("dnd-beyond-import-summary").classList.contains("hidden");',
      "D&D Beyond page import did not populate Quick Setup",
    );
    await execute('document.getElementById("cancel-dialog").click(); return true;');
    await waitFor(
      'return document.getElementById("character-dialog").classList.contains("hidden");',
      "Imported Quick Setup did not close",
    );
    console.log("Browser smoke passed: D&D Beyond page import");

    await execute(`
      localStorage.removeItem("dnd-character-build-drafts-v1");
      localStorage.removeItem("dnd-character-build-drafts-v1:campaign:aotr");
      document.getElementById("add-character").click();
      document.getElementById("detailed-build-entry").click();
      return true;
    `);
    await waitFor(
      `
        const shell = document.getElementById("character-builder-shell");
        const states = [...document.querySelectorAll("[data-builder-step-state]")].map((node) => node.dataset.builderStepState);
        return !shell.hidden
          && document.querySelector('[data-builder-step="home"]').getAttribute("aria-current") === "step"
          && ["complete", "incomplete", "warning", "blocked"].every((state) => states.includes(state))
          && document.getElementById("character-builder-save-status").textContent.includes("synced");
      `,
      "Detailed Character Builder shell did not open and save",
    );
    await waitFor(
      `
        const filters = document.getElementById("builder-ruleset-and-filters");
        return filters && !filters.disabled
          && document.getElementById("builder-filter-summary").textContent.includes("compatible entries available for 2014 rules");
      `,
      "Character Builder Home filters did not load for 2014 rules",
    );
    await execute(`
      const progression = document.getElementById("builder-preference-progression");
      progression.value = "milestone";
      progression.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        return Object.values(stored)[0]?.document?.build?.preferences?.progression === "milestone"
          && document.getElementById("character-builder-save-status").textContent.includes("synced");
      `,
      "Character Builder Home preference did not save",
    );
    await execute(`
      const publisher = document.getElementById("builder-filter-publisher");
      publisher.value = [...publisher.options].find((option) => option.value.includes("Wizards"))?.value || "";
      publisher.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      'return document.getElementById("builder-filter-publisher")?.value.includes("Wizards") && !document.getElementById("builder-filter-automation").disabled;',
      "Character Builder publisher filter did not apply",
    );
    await execute(`
      const automation = document.getElementById("builder-filter-automation");
      automation.value = "rules-ready";
      automation.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      `
        const sources = document.getElementById("builder-filter-sources");
        return document.getElementById("builder-filter-automation")?.value === "rules-ready"
          && [...sources.options].some((option) => option.value.includes("Player") && !option.value.includes("2024"));
      `,
      "Character Builder automation and publication filters were not mutually consistent",
    );
    await execute(`
      const sources = document.getElementById("builder-filter-sources");
      const source = [...sources.options].find((option) => option.value.includes("Player") && !option.value.includes("2024"));
      source.selected = true;
      sources.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        return Object.values(stored)[0]?.document?.build?.preferences?.enabledSources?.length === 1;
      `,
      "Character Builder publication filter did not save",
    );
    await execute('document.getElementById("builder-ruleset-5-5e").click(); return true;');
    await waitFor(
      `
        const preview = document.getElementById("builder-ruleset-change-preview");
        return !preview.hidden
          && preview.textContent.includes("Rulesets never mix")
          && preview.textContent.includes("incompatible")
          && document.activeElement === document.getElementById("builder-ruleset-change-title");
      `,
      "Character Builder ruleset change preview did not open",
    );
    await execute('document.getElementById("builder-ruleset-change-cancel").click(); return true;');
    await waitFor(
      `
        return document.getElementById("builder-ruleset-5e").checked
          && document.getElementById("builder-filter-sources").selectedOptions.length === 1;
      `,
      "Cancelling the ruleset preview changed the draft",
    );
    await execute('document.getElementById("builder-ruleset-5-5e").click(); return true;');
    await waitFor('return !document.getElementById("builder-ruleset-change-preview").hidden;', "Ruleset preview did not reopen");
    await execute('document.getElementById("builder-ruleset-change-confirm").click(); return true;');
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        const build = Object.values(stored)[0]?.document?.build;
        return build?.ruleset === "5.5e"
          && build.preferences.enabledSources.length === 0
          && document.getElementById("builder-ruleset-5-5e").checked
          && document.getElementById("builder-filter-summary").textContent.includes("2024 rules")
          && document.getElementById("character-builder-save-status").textContent.includes("synced");
      `,
      "Confirmed ruleset change did not clear incompatible filters and save 2024 rules",
    );
    console.log("Browser smoke passed: Character Builder Home preferences, filters, and ruleset safety");
    await execute(`
      document.querySelector('[data-builder-step="class"]').click();
      return true;
    `);
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        const draft = Object.values(stored)[0];
        return draft?.currentStep === "class"
          && draft?.sync?.state === "saved"
          && document.querySelector('[data-builder-step="class"]').getAttribute("aria-current") === "step"
          && document.activeElement === document.getElementById("character-builder-step-title");
      `,
      "Builder navigation did not save or move focus",
    );
    await execute(`
      const select = document.getElementById("builder-class-choice");
      select.value = "phb24ClassFighter";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        return Object.values(stored)[0]?.document?.build?.levels?.[0]?.classId === "phb24ClassFighter"
          && document.getElementById("builder-class-level")
          && document.getElementById("character-builder-save-status").textContent.includes("synced");
      `,
      "2024 Fighter choice did not save",
    );
    await execute(`
      const level = document.getElementById("builder-class-level");
      level.value = "3";
      level.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        return Object.values(stored)[0]?.document?.build?.levels?.[0]?.level === 3
          && document.getElementById("builder-subclass-choice")
          && document.getElementById("character-builder-save-status").textContent.includes("synced");
      `,
      "Fighter level gate did not reveal subclass choices",
    );
    await execute(`
      const subclass = document.getElementById("builder-subclass-choice");
      subclass.value = "phb24SubclassChampion";
      subclass.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        return Object.values(stored)[0]?.document?.build?.levels?.[0]?.subclassId === "phb24SubclassChampion"
          && document.getElementById("character-builder-save-status").textContent.includes("synced");
      `,
      "2024 Champion choice did not save",
    );

    async function completeBuilderChoices(step) {
      for (let guard = 0; guard < 12; guard += 1) {
        const pending = await execute(`
          const fieldset = document.querySelector('[data-builder-choice-state="incomplete"]');
          if (!fieldset) return null;
          const minimum = Number(fieldset.dataset.builderChoiceMinimum || 0);
          const controls = [...fieldset.querySelectorAll('[data-builder-choice-key]:not(:disabled)')];
          controls.slice(0, minimum).forEach((control) => { control.checked = true; });
          controls[0]?.dispatchEvent(new Event("change", { bubbles: true }));
          return fieldset.dataset.builderRuleChoice;
        `);
        if (!pending) return;
        await waitFor(
          `return document.getElementById("character-builder-save-status").textContent.includes("synced")
            && !document.querySelector('[data-builder-rule-choice="${pending}"][data-builder-choice-state="incomplete"]');`,
          `${step} choice ${pending} did not save`,
        );
      }
      throw new Error(`${step} choices did not complete.`);
    }

    await completeBuilderChoices("Class");
    await execute('document.querySelector(\'[data-builder-step="background"]\').click(); return true;');
    await waitFor('return Boolean(document.getElementById("builder-background-choice"));', "Background step did not render");
    await execute(`
      const select = document.getElementById("builder-background-choice");
      select.value = "phb24BackgroundSoldier";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor('return Boolean(document.querySelector("[data-builder-rule-choice]")) && document.getElementById("character-builder-save-status").textContent.includes("synced");', "2024 Soldier choice did not save");
    await completeBuilderChoices("Background");

    await execute('document.querySelector(\'[data-builder-step="species"]\').click(); return true;');
    await waitFor('return Boolean(document.getElementById("builder-species-choice"));', "Species/Race step did not render");
    await execute(`
      const select = document.getElementById("builder-species-choice");
      select.value = "phb24RaceHuman";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor('return Boolean(document.querySelector("[data-builder-rule-choice]")) && document.getElementById("character-builder-save-status").textContent.includes("synced");', "2024 Human choice did not save");
    await completeBuilderChoices("Species/Race");
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        const build = Object.values(stored)[0]?.document?.build;
        return build?.levels?.[0]?.classId === "phb24ClassFighter"
          && build.levels[0].subclassId === "phb24SubclassChampion"
          && build.backgroundId === "phb24BackgroundSoldier"
          && build.speciesId === "phb24RaceHuman"
          && Object.keys(build.selections).length >= 8
          && ["class", "background", "species"].every((step) => document.querySelector('[data-builder-step="' + step + '"] [data-builder-step-state]').dataset.builderStepState === "complete");
      `,
      "First-slice Class, Background, Species/Race choices did not complete and persist",
    );
    console.log("Browser smoke passed: Character Builder first-slice class and origin choices");
    await execute('document.getElementById("close-dialog").click(); return true;');
    await waitFor(
      'return document.getElementById("character-dialog").classList.contains("hidden");',
      "Detailed Character Builder did not close",
    );
    await execute(`
      document.getElementById("add-character").click();
      document.getElementById("detailed-build-entry").click();
      return true;
    `);
    await waitFor(
      `
        return document.querySelector('[data-builder-step="abilities"]').getAttribute("aria-current") === "step"
          && document.activeElement === document.getElementById("character-builder-step-title");
      `,
      "Detailed Character Builder did not resume the next incomplete Abilities step",
    );
    await command("POST", "/window/rect", { width: 375, height: 800 });
    const mobileBuilder = await execute(`
      const progress = document.getElementById("character-builder-progress");
      return {
        columns: getComputedStyle(progress).gridTemplateColumns.split(" ").length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        controlsVisible: ["character-builder-quick-setup", "character-builder-back", "character-builder-next"]
          .every((id) => document.getElementById(id).getBoundingClientRect().width > 0),
      };
    `);
    assert.deepEqual(mobileBuilder, { columns: 1, overflow: false, controlsVisible: true }, "Detailed Character Builder should remain usable without horizontal overflow on mobile.");
    await command("POST", "/window/rect", { width: 1280, height: 900 });

    await execute('document.getElementById("builder-ability-method-point-buy").click(); return true;');
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        const build = Object.values(stored)[0]?.document?.build;
        return build?.abilityScores?.method === "point-buy"
          && Object.values(build.abilityScores.base).every((score) => score === 8)
          && document.getElementById("builder-ability-status").textContent.includes("27 of 27");
      `,
      "Point-buy method did not initialize and save",
    );
    await execute(`
      const strength = document.getElementById("builder-ability-str");
      strength.value = "15";
      strength.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor('return document.getElementById("builder-ability-status")?.textContent.includes("18 of 27");', "Point-buy cost did not recalculate");
    await execute('document.getElementById("builder-ability-method-manual").click(); return true;');
    await waitFor('return Boolean(document.getElementById("builder-ability-str")?.getAttribute("max") === "30");', "Manual ability method did not render");
    await execute('document.getElementById("builder-ability-method-rolled").click(); return true;');
    await waitFor('return Boolean(document.getElementById("builder-roll-abilities"));', "Rolled ability method did not render");
    await execute('document.getElementById("builder-roll-abilities").click(); return true;');
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        const scores = Object.values(stored)[0]?.document?.build?.abilityScores;
        return scores?.method === "rolled" && scores.rolls.length === 6 && scores.rolls.every((score) => score >= 3 && score <= 18);
      `,
      "Rolled scores were not stored",
    );
    await execute('document.getElementById("builder-ability-method-standard").click(); return true;');
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        const scores = Object.values(stored)[0]?.document?.build?.abilityScores;
        return scores?.method === "standard"
          && Object.values(scores.base).sort((a, b) => b - a).join(",") === "15,14,13,12,10,8"
          && document.querySelector('[data-builder-step="abilities"] [data-builder-step-state]').dataset.builderStepState === "complete";
      `,
      "Standard array did not complete and save",
    );

    await execute('document.querySelector(\'[data-builder-step="equipment"]\').click(); return true;');
    await waitFor('return Boolean(document.getElementById("character-builder-equipment"));', "Equipment step did not render");
    await execute('document.getElementById("builder-equipment-method-gold").click(); return true;');
    await waitFor('return document.getElementById("builder-equipment-method-gold")?.checked;', "Starting gold method did not save");
    await execute(`
      const gp = document.getElementById("builder-currency-gp");
      gp.value = "100";
      gp.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        return Object.values(stored)[0]?.document?.build?.currency?.gp === 100
          && document.querySelector('[data-builder-step="equipment"] [data-builder-step-state]').dataset.builderStepState === "complete";
      `,
      "Starting gold did not save",
    );

    await execute('document.querySelector(\'[data-builder-step="description"]\').click(); return true;');
    await waitFor('return Boolean(document.getElementById("character-builder-description"));', "Description step did not render");
    await execute(`
      const name = document.getElementById("builder-character-name");
      name.value = "Task Sixteen Browser Hero";
      name.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor('return document.getElementById("builder-character-id")?.value === "task-sixteen-browser-hero";', "Character name did not generate a clean ID");
    await execute(`
      const backstory = document.getElementById("builder-description-backstory");
      backstory.value = "Browser-reviewed builder character.";
      backstory.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor('return document.getElementById("builder-description-status")?.textContent.includes("1 descriptive field");', "Description did not save");
    await execute(`
      const id = document.getElementById("builder-character-id");
      id.value = "cassian";
      id.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor('return document.getElementById("builder-character-id")?.value === "cassian" && document.getElementById("character-builder-save-status").textContent.includes("synced");', "Collision test ID did not save");

    await execute('document.querySelector(\'[data-builder-step="review"]\').click(); return true;');
    await waitFor(
      `
        const finish = document.getElementById("builder-finish");
        return Boolean(finish && !finish.disabled)
          && document.getElementById("builder-review-summary-title")
          && document.getElementById("builder-finish-title");
      `,
      "Complete draft did not enable Review Finish",
    );
    await execute('document.getElementById("builder-finish").click(); return true;');
    await waitFor(
      `
        return document.getElementById("builder-finalize-error")?.textContent.includes("already exists")
          && document.getElementById("builder-finish")?.textContent.includes("Retry")
          && document.activeElement === document.getElementById("builder-finalize-error");
      `,
      "Finalization collision did not preserve the draft and expose retry",
    );
    await execute('document.querySelector(\'[data-builder-step="description"]\').click(); return true;');
    await waitFor('return Boolean(document.getElementById("builder-character-id"));', "Could not return to Description after collision");
    await execute(`
      const id = document.getElementById("builder-character-id");
      id.value = "task-sixteen-browser-hero";
      id.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor('return document.getElementById("builder-character-id")?.value === "task-sixteen-browser-hero" && document.getElementById("character-builder-save-status").textContent.includes("synced");', "Corrected Character ID did not save");
    await execute('document.querySelector(\'[data-builder-step="review"]\').click(); return true;');
    await waitFor('return Boolean(document.getElementById("builder-finish") && !document.getElementById("builder-finish").disabled);', "Corrected draft did not return to finishable Review");
    await execute('document.getElementById("builder-finish").click(); return true;');
    await waitFor(
      `
        const drafts = JSON.parse(localStorage.getItem("dnd-character-build-drafts-v1:campaign:aotr") || "{}");
        return location.pathname === "/c/aotr/char/task-sixteen-browser-hero/"
          && window.character?.id === "task-sixteen-browser-hero"
          && window.character?.build?.status === "complete"
          && window.character?.currency?.gp === 100
          && window.character?.backstory === "Browser-reviewed builder character."
          && Object.keys(drafts).length === 0;
      `,
      "Successful builder finalization did not materialize, redirect, and remove the draft",
    );
    console.log("Browser smoke passed: Character Builder abilities, equipment, description, collision retry, and Finish");
    }

    if (includesTag("@themes")) {
    await navigate("/char/cassian/");
    await waitFor('return Boolean(document.getElementById("theme-toggle"));', "Theme picker host page did not load");
    const themePicker = await execute(`
      const toggle = document.getElementById("theme-toggle");
      toggle.click();
      const cards = [...document.querySelectorAll("[data-theme-card]")];
      const backgroundCards = [...document.querySelectorAll("[data-background-card]")];
      document.querySelector('[data-theme-card="peach-and-lime"]').click();
      document.querySelector('[data-theme-reverse="true"]').click();
      document.querySelector('[data-theme-font="black"]').click();
      const invalidBackgrounds = backgroundCards.map((card) => card.dataset.backgroundCard).filter((id) => {
        document.querySelector('[data-background-card="' + id + '"]').click();
        const style = getComputedStyle(document.body);
        return style.backgroundImage === "none" || style.animationName !== "none";
      });
      document.querySelector('[data-background-card="graph-paper"]').click();
      const result = {
        count: cards.length,
        firstThemes: cards.slice(0, 4).map((card) => card.firstElementChild.textContent.trim()),
        backgroundCount: backgroundCards.length,
        backgroundGroups: [...document.querySelectorAll("[data-background-groups] h4")].map((heading) => heading.textContent),
        firstBackgrounds: backgroundCards.slice(0, 4).map((card) => card.textContent.trim()),
        invalidBackgrounds,
        theme: document.documentElement.dataset.themePalette,
        reversed: document.documentElement.dataset.themeReversed,
        background: document.documentElement.dataset.background,
        backgroundToken: getComputedStyle(document.documentElement).getPropertyValue("--theme-background").trim(),
        accent: getComputedStyle(document.documentElement).getPropertyValue("--theme-accent").trim(),
        hasPattern: getComputedStyle(document.body).backgroundImage.includes("linear-gradient"),
        hasVignette: getComputedStyle(document.body).boxShadow.includes("rgba(0, 0, 0, 0.18)"),
        hasSoftener: getComputedStyle(document.body).boxShadow.includes("rgba(154, 118, 0, 0.18)"),
        storedTheme: localStorage.getItem("dnd-theme"),
        storedFont: localStorage.getItem("dnd-theme-font"),
        storedBackground: localStorage.getItem("dnd-theme-background"),
      };
      document.querySelector("[data-theme-dialog]").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return result;
    `);
    assert.deepEqual(themePicker, {
      count: 28,
      firstThemes: ["Cassian’s Classic", "Evil Cassian", "Black and White", "Aloe"],
      backgroundCount: 42,
      backgroundGroups: ["Static backgrounds"],
      firstBackgrounds: ["Default Squared", "Arcs", "Argyle", "Carbon Fiber"],
      invalidBackgrounds: [],
      theme: "peach-and-lime",
      reversed: "true",
      background: "graph-paper",
      backgroundToken: "154 118 0",
      accent: "244 184 196",
      hasPattern: true,
      hasVignette: true,
      hasSoftener: true,
      storedTheme: "peach-and-lime",
      storedFont: "black",
      storedBackground: "graph-paper",
    }, "Theme picker should apply and persist the complete local preference.");
    await waitFor(
      'return getComputedStyle(document.body).backgroundColor === "rgb(154, 118, 0)";',
      "Theme background transition did not reach the selected color",
    );
    await waitFor(
      'return document.querySelector("[data-theme-dialog]").classList.contains("hidden");',
      "Theme picker did not close with Escape",
    );
    console.log("Browser smoke passed: Theme picker");
    }

    if (includesTag("@characters")) {
    await smoke(
      "Character tracker and editor",
      "/char/cassian/",
      'return window.character?.id === "cassian" && Boolean(document.getElementById("edit-character-toggle"));',
      `
        const name = document.getElementById("character-name")?.textContent.trim();
        document.getElementById("edit-character-toggle").click();
        const editor = document.getElementById("character-editor");
        return name === window.character.name && !editor.classList.contains("hidden") && Boolean(document.getElementById("editor-fields").children.length);
      `,
    );
    await execute(`
      window.__characterExports = [];
      URL.createObjectURL = (blob) => {
        const exported = { type: blob.type, size: blob.size, filename: "", signature: "" };
        window.__characterExports.push(exported);
        blob.arrayBuffer().then((buffer) => {
          exported.signature = String.fromCharCode(...new Uint8Array(buffer).slice(0, 4));
        });
        return "blob:http://127.0.0.1/export-test";
      };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () {
        window.__characterExports.at(-1).filename = this.download;
      };
      document.getElementById("editor-export-menu").open = true;
      document.getElementById("editor-export-json").click();
      return true;
    `);
    await waitFor(
      'return window.__characterExports.length === 1 && window.__characterExports[0].signature === "{\\n  ";',
      "Character JSON export did not finish",
    );
    await execute(`
      document.getElementById("editor-export-menu").open = true;
      document.getElementById("editor-export-pdf").click();
      return true;
    `);
    await waitFor(
      'return window.__characterExports.length === 2 && window.__characterExports[1].signature === "%PDF" && !document.getElementById("editor-export-pdf").disabled;',
      "Filled character PDF export did not finish",
    );
    const characterExports = await execute('return window.__characterExports;');
    assert.equal(characterExports[0].type, "application/json");
    assert.equal(characterExports[0].filename, "cassian-aurelius-von-bloodington-iii.json");
    assert.equal(characterExports[1].type, "application/pdf");
    assert.equal(characterExports[1].filename, "cassian-aurelius-von-bloodington-iii.pdf");
    assert.ok(characterExports[1].size > 100_000, "Filled character PDF download should contain the complete sheet.");
    console.log("Browser smoke passed: Character JSON and filled PDF export");
    const characterFlags = await execute(`
      const inspiration = document.getElementById("inspiration-toggle");
      const cinematic = document.getElementById("cinematic-toggle");
      inspiration.click();
      cinematic.click();
      return {
        inspiration: inspiration.getAttribute("aria-checked"),
        cinematic: cinematic.getAttribute("aria-checked"),
        inspirationValue: window.character.inspiration,
        cinematicValue: window.character.cinematic,
      };
    `);
    assert.deepEqual(characterFlags, {
      inspiration: "true",
      cinematic: "true",
      inspirationValue: 1,
      cinematicValue: 1,
    }, "Character status switches should respond to clicks.");
    await waitFor(
      `
        return getComputedStyle(document.getElementById("inspiration-toggle")).backgroundColor === "rgb(254, 240, 138)"
          && getComputedStyle(document.getElementById("cinematic-toggle")).backgroundColor === "rgb(196, 181, 253)";
      `,
      "Character status switches did not show their active colors",
    );
    await execute('document.getElementById("editor-cancel").click(); return true;');
    await waitFor(
      'return document.getElementById("character-editor").classList.contains("hidden");',
      "Character editor did not close",
    );
    const characterRoll = await execute(`
      const clear = document.getElementById("dice-history-clear");
      if (!clear.classList.contains("hidden")) clear.click();
      const attack = document.querySelector('[data-roll-label="Shortsword Attack"]');
      attack.click();
      const attackResult = document.getElementById("dice-roller-result").textContent.replace(/\\s+/g, " ").trim();
      document.querySelector('[data-roll-label="Shortsword Damage"]').click();
      const damageResult = document.getElementById("dice-roller-result").textContent.replace(/\\s+/g, " ").trim();
      document.getElementById("dice-formula").value = "2d20+5";
      document.getElementById("dice-roller-form").requestSubmit();
      const historyKey = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .find((key) => key === "dnd-cassian-roll-history" || key.startsWith("dnd-cassian-roll-history:campaign:"));
      const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
      return {
        hasSkillRoll: Boolean(document.querySelector('[data-roll-label="Acrobatics Skill"]')),
        hasSaveRoll: Boolean(document.querySelector('[data-roll-label="Strength Saving Throw"]')),
        attackResult,
        damageResult,
        result: document.getElementById("dice-roller-result").textContent.replace(/\\s+/g, " ").trim(),
        historyLabels: [...document.querySelectorAll("#dice-history-list strong")].slice(0, 3).map((label) => label.textContent),
        storedLabels: history.slice(0, 3).map((entry) => entry.label),
        storedTotal: history[0]?.total,
      };
    `);
    assert.equal(characterRoll.hasSkillRoll, true, "Character skills should be rollable.");
    assert.equal(characterRoll.hasSaveRoll, true, "Character saving throws should be rollable.");
    assert.match(characterRoll.attackResult, /^\d+ \+ 8 = \d+$/, "Shortsword Attack should roll 1d20+8.");
    assert.match(characterRoll.damageResult, /^\d+ \+ 5 = \d+$/, "Shortsword Damage should roll 1d6+5.");
    assert.match(characterRoll.result, /^\(\d+ \+ \d+\) \+ 5 = \d+$/, "The manual dice roller should roll 2d20+5.");
    assert.deepEqual(characterRoll.historyLabels, ["Dice Roller 2d20+5", "Shortsword Damage", "Shortsword Attack"]);
    assert.deepEqual(characterRoll.storedLabels, characterRoll.historyLabels);
    assert.equal(characterRoll.storedTotal, Number(characterRoll.result.split("=").at(-1).trim()), "Saved roll total should match the visible result.");
    await execute('document.getElementById("dice-roller-close").click(); return true;');
    await navigate("/char/cassian/");
    await waitFor(
      'return document.querySelector("#dice-history-list strong")?.textContent === "Dice Roller 2d20+5";',
      "Character roll history did not persist after reload",
    );
    console.log("Browser smoke passed: Character tracker dice rolls and history");
    const characterNoteFormatting = await execute(`
      const textarea = document.getElementById("note-body");
      const bold = document.querySelector('#note-format-toolbar [data-markdown-format="bold"]');
      textarea.value = "";
      textarea.setSelectionRange(0, 0);
      bold.click();
      return { value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd };
    `);
    assert.deepEqual(characterNoteFormatting, { value: "****", start: 2, end: 2 }, "Character Notes Bold should place the cursor inside the markers.");

    await execute(`
      const settings = JSON.stringify({ characterSheetStyle: "v4", characterSheetStyleOverrides: { cassian: "v4" }, sections: {}, openWrites: true });
      localStorage.setItem("cassianslog-runtime-settings", settings);
      localStorage.setItem("cassianslog-runtime-settings:campaign:aotr", settings);
      return true;
    `);
    await navigate("/c/aotr/char/cassian/");
    await waitFor(
      'return document.documentElement.dataset.characterSheetStyle === "v4" && document.querySelectorAll("[data-v4-tab]").length === 5 && document.querySelectorAll(".v4-ability").length === 6;',
      "V4 tracker did not load",
    );
    const v4Core = await execute(`
      const liveIds = ["characterDescription", "combatAccordion", "quickStatsCard", "hpManager", "death-saves-section", "combatResources", "spellcastingSection", "preparedSpellsSection", "inventory-page", "notesSection"];
      const actionTab = document.querySelector('[data-v4-tab="actions"]');
      actionTab.focus();
      actionTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const keyboardTab = document.activeElement?.dataset.v4Tab;
      const keyboardPanel = [...document.querySelectorAll("[data-v4-panel]")].find((panel) => !panel.hidden)?.dataset.v4Panel;
      document.querySelector('[data-v4-tab="actions"]').click();
      return {
        tabs: [...document.querySelectorAll("[data-v4-tab]")].map((tab) => tab.textContent.trim()),
        keyboardTab,
        keyboardPanel,
        activePanel: [...document.querySelectorAll("[data-v4-panel]")].find((panel) => !panel.hidden)?.dataset.v4Panel,
        liveNodesUnique: liveIds.every((id) => document.querySelectorAll("#" + id).length === 1),
        abilityCount: document.querySelectorAll(".v4-ability").length,
        hasRolls: Boolean(document.querySelector('.v4-ability [data-roll-formula]') && document.querySelector('.v4-skill-list [data-roll-formula]')),
        summaryTitles: [...document.querySelectorAll("#v4-summary-details h2")].map((heading) => heading.textContent.trim()),
        background: document.getElementById("v4-background-content")?.textContent.trim(),
        identity: document.getElementById("character-name")?.textContent.trim(),
        deathSavesVisible: !document.getElementById("death-saves-section").classList.contains("hidden"),
      };
    `);
    assert.deepEqual(v4Core.tabs, ["Actions", "Spells", "Inventory", "Features & Traits", "Extras"]);
    assert.equal(v4Core.keyboardTab, "spells", "V4 tabs should support ArrowRight focus movement.");
    assert.equal(v4Core.keyboardPanel, "spells", "V4 keyboard navigation should activate the matching panel.");
    assert.equal(v4Core.activePanel, "actions");
    assert.equal(v4Core.liveNodesUnique, true, "V4 must reuse each live tracker node exactly once.");
    assert.equal(v4Core.abilityCount, 6);
    assert.equal(v4Core.hasRolls, true);
    assert.deepEqual(v4Core.summaryTitles, ["Speed", "Senses", "Proficiencies & Languages", "Defenses"]);
    assert.equal(v4Core.background, "Noble", "V4 background should render.");
    assert.equal(v4Core.identity, "Cassian Aurelius von Bloodington III");
    assert.equal(v4Core.deathSavesVisible, true, "V4 should keep death saves available beside HP.");
    await command("POST", "/window/rect", { width: 375, height: 800 });
    const mobileV4 = await execute(`return {
      columns: getComputedStyle(document.getElementById("v4-core-grid")).gridTemplateColumns.split(" ").length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      tabsScrollable: getComputedStyle(document.getElementById("v4-tabs")).overflowX === "auto",
    };`);
    assert.deepEqual(mobileV4, { columns: 1, overflow: false, tabsScrollable: true }, "V4 should collapse without page overflow on mobile.");
    await command("POST", "/window/rect", { width: 1280, height: 900 });
    console.log("Browser smoke passed: V4 core summary, tabs, live-node reuse, and mobile layout");

    const v4Filters = await execute(`
      document.querySelector('[data-collapse-target="combatFiltersCollapse"]').click();
      const filter = document.querySelector('#combat-filters [data-filter-key="usage"]');
      const counts = {};
      for (const value of ["attack", "action", "bonus-action", "reaction", "other", "limited"]) {
        filter.value = value;
        filter.dispatchEvent(new Event("change", { bubbles: true }));
        counts[value] = document.querySelectorAll("#resources-container [data-v4-action-card]").length;
      }
      filter.value = "";
      filter.dispatchEvent(new Event("change", { bubbles: true }));
      return { options: [...filter.options].map((option) => option.value), counts };
    `);
    assert.deepEqual(v4Filters.options, ["", "attack", "action", "bonus-action", "reaction", "other", "limited"]);
    Object.entries(v4Filters.counts).forEach(([filter, count]) => assert.ok(count > 0, `V4 ${filter} filter should match Cassian's actions.`));

    const v4UseCancel = await execute(`
      const use = document.querySelector('[data-v4-action-card="action-surge"] [data-tracker-action="request-use"]');
      const before = window.character.actions.find((item) => item.id === "action-surge").uses.current;
      use.click();
      const opened = !document.getElementById("v4-use-dialog").classList.contains("hidden")
        && document.activeElement === document.getElementById("v4-use-confirm");
      document.getElementById("v4-use-cancel").click();
      return {
        before,
        after: window.character.actions.find((item) => item.id === "action-surge").uses.current,
        opened,
        closed: document.getElementById("v4-use-dialog").classList.contains("hidden"),
        focusRestored: document.activeElement === use,
      };
    `);
    assert.deepEqual(v4UseCancel, { before: 1, after: 1, opened: true, closed: true, focusRestored: true }, "Cancel should preserve the resource and restore focus.");
    await execute(`
      document.querySelector('[data-v4-action-card="action-surge"] [data-tracker-action="request-use"]').click();
      document.getElementById("v4-use-confirm").click();
      return true;
    `);
    await waitFor(`return window.character.actions.find((item) => item.id === "action-surge").uses.current === 0
      && document.getElementById("v4-use-dialog").classList.contains("hidden")
      && document.activeElement?.dataset.id === "action-surge"
      && document.getElementById("v4-action-status").textContent.includes("0 of 1 remaining");`, "Confirmed V4 action use did not consume one resource and restore focus");

    const conditionAdded = await execute(`
      const input = document.getElementById("v4-condition-name");
      input.value = "Frightened";
      document.getElementById("v4-condition-form").requestSubmit();
      return window.character.conditions.some((condition) => condition.name === "Frightened")
        && document.getElementById("v4-condition-list").textContent.includes("Frightened");
    `);
    assert.equal(conditionAdded, true, "V4 should add conditions through the runtime state.");
    await execute(`document.querySelector('[data-tracker-action="remove-condition"][data-condition="Frightened"]').click(); return true;`);
    await waitFor('return !window.character.conditions.some((condition) => condition.name === "Frightened") && !document.getElementById("v4-condition-list").textContent.includes("Frightened");', "V4 condition removal did not persist");

    const restCancel = await execute(`
      const trigger = document.getElementById("shortRest-btn");
      trigger.click();
      const opened = !document.getElementById("rest-dialog").classList.contains("hidden")
        && document.activeElement === document.getElementById("confirm-rest");
      document.getElementById("cancel-rest").click();
      return {
        uses: window.character.actions.find((item) => item.id === "action-surge").uses.current,
        opened,
        focusRestored: document.activeElement === trigger,
      };
    `);
    assert.deepEqual(restCancel, { uses: 0, opened: true, focusRestored: true }, "Cancelled rest should preserve state and restore focus.");
    await execute('document.getElementById("shortRest-btn").click(); document.getElementById("confirm-rest").click(); return true;');
    await waitFor('return window.character.actions.find((item) => item.id === "action-surge").uses.current === 1 && document.activeElement === document.getElementById("shortRest-btn");', "Confirmed short rest did not restore the eligible resource and focus");

    const v4AttackRoll = await execute(`
      document.querySelector('[data-v4-action-card="shortsword-action"] [data-roll-label="Shortsword Attack"]').click();
      return document.getElementById("dice-roller-result").textContent.replace(/\\s+/g, " ").trim();
    `);
    assert.match(v4AttackRoll, /^\d+ \+ 8 = \d+$/, "V4 attack controls should reuse the existing dice roller.");
    await execute('document.getElementById("dice-roller-close").click(); localStorage.setItem("cassianslog-local-user-v1", "localhost-player-02"); return true;');
    await navigate("/c/aotr/char/cassian/");
    await waitFor('return document.documentElement.dataset.characterSheetStyle === "v4" && document.body.dataset.characterCanEdit === "false" && document.querySelector("[data-v4-action-card]");', "Read-only V4 tracker did not load");
    const readOnlyV4 = await execute(`
      const use = document.querySelector('[data-v4-action-card="action-surge"] [data-tracker-action="request-use"]');
      const before = window.character.actions.find((item) => item.id === "action-surge").uses.current;
      use.click();
      return {
        useDisabled: use.disabled,
        conditionDisabled: document.getElementById("v4-condition-name").disabled,
        restDisabled: document.getElementById("shortRest-btn").disabled,
        unchanged: window.character.actions.find((item) => item.id === "action-surge").uses.current === before,
        dialogClosed: document.getElementById("v4-use-dialog").classList.contains("hidden"),
        rollEnabled: !document.querySelector('[data-v4-action-card="shortsword-action"] [data-roll-label="Shortsword Attack"]').disabled,
      };
    `);
    assert.deepEqual(readOnlyV4, { useDisabled: true, conditionDisabled: true, restDisabled: true, unchanged: true, dialogClosed: true, rollEnabled: true }, "Read-only V4 should block mutations while keeping dice available.");
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-admin"); return true;');
    console.log("Browser smoke passed: V4 filters, action confirmation, conditions, rests, dice, and read-only authority");

    await execute(`
      const settings = JSON.stringify({ characterSheetStyle: "v4", characterSheetStyleOverrides: { cassian: "v4", karma: "v4" }, sections: {}, openWrites: true });
      localStorage.setItem("cassianslog-runtime-settings", settings);
      localStorage.setItem("cassianslog-runtime-settings:campaign:aotr", settings);
      return true;
    `);
    await navigate("/c/aotr/char/karma/");
    await waitFor('return window.character?.id === "karma" && document.querySelectorAll("[data-v4-spell-card]").length > 10;', "Karma V4 Spells did not load");
    await execute(`
      const characters = JSON.parse(localStorage.getItem("dnd-characters:campaign:aotr") || "{}");
      const document = structuredClone(window.character);
      document.spellcasting.profiles.find((profile) => profile.id === "cleric").preparedLimit = 20;
      const bane = document.spells.find((spell) => spell.id === "bane");
      Object.assign(bane, { known: true, repertoire: ["known"], prepared: true, preparationRequired: true, castable: true, concentration: true, slotOptions: ["slot-1", "slot-2"] });
      const healing = document.spells.find((spell) => spell.id === "healing-word");
      Object.assign(healing, { spellbook: true, repertoire: ["spellbook"], prepared: false, preparationRequired: true, castable: false, slotOptions: ["slot-1", "slot-2"] });
      const ritual = document.spells.find((spell) => spell.id === "gentle-repose");
      Object.assign(ritual, { spellbook: true, repertoire: ["spellbook"], prepared: false, preparationRequired: true, castable: false, ritual: true, ritualCastable: true, slotOptions: ["slot-2"] });
      document.spellcasting.slots.find((slot) => slot.id === "slot-1").current = 1;
      document.spellcasting.slots.find((slot) => slot.id === "slot-2").current = 3;
      characters.karma = document;
      localStorage.setItem("dnd-characters:campaign:aotr", JSON.stringify(characters));
      return true;
    `);
    await navigate("/c/aotr/char/karma/");
    await waitFor(`return document.querySelector('[data-v4-spell-card="bane"]')?.textContent.includes("Known") && document.querySelector('[data-v4-spell-card="gentle-repose"]')?.textContent.includes("Spellbook");`, "V4 known and spellbook distinctions did not render");
    await execute('document.querySelector("[data-v4-tab=spells]").click(); return true;');
    const spellFilters = await execute(`
      const search = document.querySelector('[data-v4-spell-filter="search"]');
      const level = document.querySelector('[data-v4-spell-filter="level"]');
      const repertoire = document.querySelector('[data-v4-spell-filter="repertoire"]');
      search.value = "gentle";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      level.value = "2";
      level.dispatchEvent(new Event("change", { bubbles: true }));
      repertoire.value = "spellbook";
      repertoire.dispatchEvent(new Event("change", { bubbles: true }));
      const result = {
        count: document.querySelectorAll("#v4-spell-list [data-v4-spell-card]").length,
        name: document.querySelector("#v4-spell-list [data-v4-spell-card] strong")?.textContent,
      };
      document.querySelector('[data-tracker-action="reset-spell-filters"]').click();
      return result;
    `);
    assert.deepEqual(spellFilters, { count: 1, name: "Gentle Repose" }, "V4 spell search, level, and repertoire filters should combine.");

    await execute('document.querySelector("[data-v4-spell-card=healing-word] [data-tracker-action=prepared-spell]").click(); return true;');
    await waitFor(`return window.character.spells.find((spell) => spell.id === "healing-word").prepared === true && document.querySelector('[data-v4-spell-card="healing-word"] [data-tracker-action="prepared-spell"]').getAttribute("aria-checked") === "true";`, "V4 spell preparation did not persist");

    const spellCastCancel = await execute(`
      const trigger = document.querySelector('[data-v4-spell-card="bane"] [data-tracker-action="request-spell-cast"]');
      const before = window.character.spellcasting.slots.find((slot) => slot.id === "slot-2").current;
      trigger.click();
      const slot = document.getElementById("v4-spell-slot");
      slot.value = "slot:slot-2";
      slot.dispatchEvent(new Event("change", { bubbles: true }));
      const opened = !document.getElementById("v4-spell-cast-dialog").classList.contains("hidden")
        && document.activeElement === document.getElementById("v4-spell-cast-confirm");
      document.getElementById("v4-spell-cast-cancel").click();
      return {
        before,
        after: window.character.spellcasting.slots.find((item) => item.id === "slot-2").current,
        opened,
        focusRestored: document.activeElement === trigger,
      };
    `);
    assert.deepEqual(spellCastCancel, { before: 3, after: 3, opened: true, focusRestored: true }, "Cancelled spell casting should preserve slots and restore focus.");
    await execute(`
      document.querySelector('[data-v4-spell-card="bane"] [data-tracker-action="request-spell-cast"]').click();
      const slot = document.getElementById("v4-spell-slot");
      slot.value = "slot:slot-2";
      slot.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("v4-spell-cast-confirm").click();
      return true;
    `);
    await waitFor(`return window.character.spellcasting.slots.find((slot) => slot.id === "slot-2").current === 2
      && window.character.concentration?.id === "bane"
      && document.getElementById("v4-condition-list").textContent.includes("Concentrating: Bane")
      && document.getElementById("v4-spell-status").textContent.includes("upcast by 1")
      && document.activeElement?.dataset.id === "bane";`, "V4 upcast did not consume the selected slot, set concentration, announce, and restore focus");

    const ritualCast = await execute(`
      const before = window.character.spellcasting.slots.find((slot) => slot.id === "slot-2").current;
      document.querySelector('[data-v4-spell-card="gentle-repose"] [data-tracker-action="request-spell-cast"]').click();
      const ritualSelected = document.querySelector('input[name="v4-spell-cast-mode"][value="ritual"]').checked;
      const slotHidden = document.getElementById("v4-spell-slot").classList.contains("hidden");
      document.getElementById("v4-spell-cast-confirm").click();
      return {
        before,
        after: window.character.spellcasting.slots.find((slot) => slot.id === "slot-2").current,
        ritualSelected,
        slotHidden,
        announced: document.getElementById("v4-spell-status").textContent.includes("as a ritual"),
      };
    `);
    assert.deepEqual(ritualCast, { before: 2, after: 2, ritualSelected: true, slotHidden: true, announced: true }, "Ritual casting should consume no slot.");
    const spellDamageRoll = await execute(`
      document.querySelector('[data-v4-spell-card="sacred-flame"] [data-roll-label="Sacred Flame Damage"]').click();
      return document.getElementById("dice-roller-result").textContent.replace(/\\s+/g, " ").trim();
    `);
    assert.match(spellDamageRoll, /^\d+ = \d+$/, "V4 spell damage should reuse the dice roller.");
    await execute('document.getElementById("dice-roller-close").click(); localStorage.setItem("cassianslog-local-user-v1", "localhost-player-02"); return true;');
    await navigate("/c/aotr/char/karma/");
    await waitFor('return document.body.dataset.characterCanEdit === "false" && document.querySelector("[data-v4-spell-card=healing-word]");', "Read-only V4 Spells did not load");
    const readOnlySpells = await execute(`return {
      castDisabled: document.querySelector('[data-v4-spell-card="bane"] [data-tracker-action="request-spell-cast"]').disabled,
      prepareDisabled: document.querySelector('[data-v4-spell-card="healing-word"] [data-tracker-action="prepared-spell"]').disabled,
      filterEnabled: !document.querySelector('[data-v4-spell-filter="search"]').disabled,
      diceEnabled: !document.querySelector('[data-v4-spell-card="sacred-flame"] [data-roll-label="Sacred Flame Damage"]').disabled,
    };`);
    assert.deepEqual(readOnlySpells, { castDisabled: true, prepareDisabled: true, filterEnabled: true, diceEnabled: true }, "Read-only V4 should block spell mutations while preserving filters and dice.");
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-admin"); return true;');
    console.log("Browser smoke passed: V4 spell filtering, preparation, upcasting, ritual, concentration, dice, focus, and read-only authority");

    await execute(`
      const characters = JSON.parse(localStorage.getItem("dnd-characters:campaign:aotr") || "{}");
      const document = structuredClone(window.character);
      document.currency = { cp: 4, sp: 3, ep: 2, gp: 25, pp: 1 };
      document.inventoryWeight = 40;
      document.encumbrance = { mode: "variant", capacity: 120, status: "normal" };
      document.inventory = [
        { instanceId: "pack", definitionId: "backpack", name: "Backpack", quantity: 1, automatic: true, weight: 5, unitWeight: 5, containerId: "", containerCapacity: 30, contentsWeight: 0, canEquip: false, canAttune: false },
        { instanceId: "blade", definitionId: "blade", name: "Silver Blade", quantity: 1, automatic: true, weight: 3, unitWeight: 3, containerId: "", containerCapacity: null, canEquip: true, canAttune: false },
        { instanceId: "boots", definitionId: "boots", name: "Swift Boots", quantity: 1, automatic: true, weight: 2, unitWeight: 2, containerId: "", containerCapacity: null, canEquip: true, canAttune: true },
        { instanceId: "ring-one", definitionId: "ring-one", name: "Ring One", quantity: 1, automatic: true, weight: 0, unitWeight: 0, containerId: "", containerCapacity: null, canEquip: false, canAttune: true },
        { instanceId: "ring-two", definitionId: "ring-two", name: "Ring Two", quantity: 1, automatic: true, weight: 0, unitWeight: 0, containerId: "", containerCapacity: null, canEquip: false, canAttune: true },
        { instanceId: "ring-three", definitionId: "ring-three", name: "Ring Three", quantity: 1, automatic: true, weight: 0, unitWeight: 0, containerId: "", containerCapacity: null, canEquip: false, canAttune: true },
        { instanceId: "wand", definitionId: "wand", name: "Unstable Wand", quantity: 1, automatic: false, weight: null, unitWeight: null, containerId: "", containerCapacity: null, canEquip: false, canAttune: false, charges: { current: 2, max: 2, reset: "long" } }
      ];
      characters.karma = document;
      localStorage.setItem("dnd-characters:campaign:aotr", JSON.stringify(characters));
      localStorage.removeItem("dnd-karma-state:campaign:aotr");
      return true;
    `);
    await navigate("/c/aotr/char/karma/");
    await waitFor('return document.querySelectorAll("[data-v4-inventory-item]").length === 7;', "V4 Inventory did not load rules inventory");
    await execute('document.querySelector("[data-v4-tab=inventory]").click(); return true;');
    const inventoryFilters = await execute(`
      const search = document.querySelector('[data-v4-inventory-filter="search"]');
      const status = document.querySelector('[data-v4-inventory-filter="status"]');
      search.value = "wand";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      status.value = "manual";
      status.dispatchEvent(new Event("change", { bubbles: true }));
      const result = {
        count: document.querySelectorAll("[data-v4-inventory-item]").length,
        name: document.querySelector("[data-v4-inventory-item] strong")?.textContent,
        currency: document.getElementById("currency-container").textContent.replace(/\s+/g, " ").trim(),
      };
      document.querySelector('[data-tracker-action="reset-inventory-filters"]').click();
      return result;
    `);
    assert.equal(inventoryFilters.count, 1);
    assert.equal(inventoryFilters.name, "Unstable Wand");
    assert.match(inventoryFilters.currency, /GP: 25/);
    const inventoryMutation = await execute(`
      document.querySelector('[data-v4-inventory-item="1"] [data-tracker-action="inventory-quantity"][data-delta="1"]').click();
      document.querySelector('[data-v4-inventory-item="1"] [data-tracker-action="inventory-runtime"][data-field="equipped"]').click();
      const container = document.querySelector('[data-v4-inventory-item="1"] [data-v4-inventory-container]');
      container.value = "pack";
      container.dispatchEvent(new Event("change", { bubbles: true }));
      for (const index of [2, 3, 4, 5]) document.querySelector('[data-v4-inventory-item="' + index + '"] [data-tracker-action="inventory-runtime"][data-field="attuned"]').click();
      const runtimeKey = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).find((key) => key.includes("dnd-karma-state") && key.includes("campaign:aotr"));
      const runtime = JSON.parse(localStorage.getItem(runtimeKey) || "{}");
      return {
        weight: [...document.querySelectorAll("#v4-inventory-summary dd")][1].textContent,
        blade: runtime.inventory.find((item) => item.instanceId === "blade"),
        attuned: runtime.inventory.filter((item) => item.attuned).length,
        warning: document.getElementById("v4-inventory-status").textContent,
      };
    `);
    assert.match(inventoryMutation.weight, /^43 lb\. \/ 120 lb\.$/);
    assert.equal(inventoryMutation.blade.quantity, 2);
    assert.equal(inventoryMutation.blade.equipped, true);
    assert.equal(inventoryMutation.blade.containerId, "pack");
    assert.equal(inventoryMutation.attuned, 3);
    assert.match(inventoryMutation.warning, /no more than three items/i);
    const chargeCancel = await execute(`
      const trigger = document.querySelector('[data-v4-inventory-item="6"] [data-tracker-action="request-item-charge"]');
      trigger.click();
      const opened = document.activeElement === document.getElementById("v4-inventory-charge-confirm");
      document.getElementById("v4-inventory-charge-cancel").click();
      return { opened, focusRestored: document.activeElement === trigger, charges: trigger.closest("[data-v4-inventory-item]").textContent.includes("2/2 charges") };
    `);
    assert.deepEqual(chargeCancel, { opened: true, focusRestored: true, charges: true });
    await execute('document.querySelector(\'[data-v4-inventory-item="6"] [data-tracker-action="request-item-charge"]\').click(); document.getElementById("v4-inventory-charge-confirm").click(); return true;');
    await waitFor('return document.querySelector(\'[data-v4-inventory-item="6"]\').textContent.includes("1/2 charges");', "V4 item charge did not persist");
    await command("POST", "/window/rect", { width: 375, height: 800 });
    assert.equal(await execute('return document.documentElement.scrollWidth <= innerWidth;'), true, "V4 Inventory should not overflow on mobile.");
    await command("POST", "/window/rect", { width: 1280, height: 900 });
    await navigate("/c/aotr/char/karma/");
    await waitFor('return document.querySelector(\'[data-v4-inventory-item="1"]\')?.textContent.includes("×2") && document.querySelector(\'[data-v4-inventory-item="6"]\')?.textContent.includes("1/2 charges");', "V4 inventory runtime did not survive refresh");
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-player-02"); return true;');
    await navigate("/c/aotr/char/karma/");
    await waitFor('return document.body.dataset.characterCanEdit === "false" && document.querySelector("[data-v4-inventory-item]");', "Read-only V4 Inventory did not load");
    const readOnlyInventory = await execute(`return {
      quantityDisabled: document.querySelector('[data-tracker-action="inventory-quantity"]').disabled,
      containerDisabled: document.querySelector('[data-v4-inventory-container]').disabled,
      chargeDisabled: document.querySelector('[data-tracker-action="request-item-charge"]').disabled,
      filterEnabled: !document.querySelector('[data-v4-inventory-filter="search"]').disabled,
      editDisabled: document.querySelector('[data-character-editor-section="inventory"]').disabled,
    };`);
    assert.deepEqual(readOnlyInventory, { quantityDisabled: true, containerDisabled: true, chargeDisabled: true, filterEnabled: true, editDisabled: true });
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-admin"); return true;');
    console.log("Browser smoke passed: V4 inventory filters, totals, currency, containers, equip, attunement, charges, persistence, mobile, and read-only authority");

    await execute(`
      const characters = JSON.parse(localStorage.getItem("dnd-characters:campaign:aotr") || "{}");
      const document = structuredClone(window.character);
      document.class = "Cleric";
      document.subclass = "Grave Domain";
      document.race = "Tiefling";
      document.background = "Wayfinder";
      document.proficiencies = { armor: ["Light Armor"], tools: ["Herbalism Kit"] };
      document.languages = ["Common", "Infernal"];
      document.build = { ...(document.build || {}), selections: { ...(document.build?.selections || {}), "cleric-feature:choice": ["Preserve Life"] }, description: { ...(document.build?.description || {}), personalityTraits: "I listen before I speak.", backstory: "Mapped the old roads." } };
      document.resources = [...(document.resources || []).filter((item) => item.id !== "grave-focus"), { id: "grave-focus", name: "Grave Focus", category: "Resource", action: "Other", uses: { current: 2, max: 2, reset: "long" } }];
      document.features = [
        { id: "cleric-feature", name: "Channel Divinity", type: "Class Feature", source: "Cleric", resourceId: "grave-focus", description: "Channel divine power." },
        { id: "circle", name: "Circle of Mortality", type: "Subclass", source: "Grave Domain", selections: ["Spare the Dying"], description: "Aid creatures near death." },
        { id: "legacy", name: "Infernal Legacy", category: "Racial Trait", source: "Tiefling", description: "A fiendish inheritance." },
        { id: "wayfinder", name: "Wayfinder", category: "Background Feature", source: "Wayfinder", description: "Find paths through wild places." },
        { id: "observant", name: "Observant", category: "Feat", description: "Notice small details." }
      ];
      document.extras = [
        { id: "wolf", name: "Trail Wolf", type: "companion", sourceId: "companion-wolf", ac: 13, speed: "40 ft.", hp: { current: 5, max: 5, temp: 0 }, description: "A loyal trail companion." },
        { id: "owl", name: "Night Owl", type: "familiar", sourceId: "find-familiar", ac: 11, hp: { current: 1, max: 1, temp: 0 }, description: "A silent familiar." },
        { id: "bear-form", name: "Brown Bear", type: "wild-shape", sourceId: "wild-shape-bear", ac: 11, hp: { current: 34, max: 34, temp: 0 }, description: "A recorded wild shape." },
        { id: "wagon", name: "Wayfinder Wagon", type: "vehicle", sourceId: "wagon", ac: 15, hp: { current: 20, max: 30, temp: 0 }, uses: { current: 2, max: 3, reset: "manual" }, description: "Carries field supplies." },
        { id: "token", name: "Speaking Token", type: "custom", source: "Manual", description: "A custom story companion." }
      ];
      characters.karma = document;
      localStorage.setItem("dnd-characters:campaign:aotr", JSON.stringify(characters));
      return true;
    `);
    await navigate("/c/aotr/char/karma/");
    await waitFor('return document.querySelectorAll("[data-v4-feature]").length === 5 && document.querySelectorAll("[data-v4-extra]").length === 5;', "V4 Features and Extras did not load");
    const contentSummary = await execute(`return {
      featureGroups: [...document.querySelectorAll("#v4-feature-groups > section > h3")].map((item) => item.textContent.replace(/\\s+/g, " ").trim()),
      extraGroups: [...document.querySelectorAll("#v4-extra-groups > section > h3")].map((item) => item.textContent.replace(/\\s+/g, " ").trim()),
      proficiencies: document.getElementById("v4-proficiencies-title").parentElement.textContent.replace(/\\s+/g, " ").trim(),
      background: document.getElementById("v4-background-content").textContent.replace(/\\s+/g, " ").trim(),
    };`);
    assert.deepEqual(contentSummary.featureGroups, ["Class 1", "Subclass 1", "Species / Race 1", "Background 1", "Feats 1"]);
    assert.deepEqual(contentSummary.extraGroups, ["Companions 1", "Familiars 1", "Wild Shapes 1", "Vehicles 1", "Custom Extras 1"]);
    assert.match(contentSummary.proficiencies, /Light Armor/);
    assert.match(contentSummary.proficiencies, /Infernal/);
    assert.match(contentSummary.background, /I listen before I speak/);
    assert.match(contentSummary.background, /Mapped the old roads/);
    await execute('document.querySelector("[data-v4-tab=features]").click(); return true;');
    const featureDetail = await execute(`
      const trigger = document.querySelector('[data-v4-feature="circle"] [data-tracker-action="open-v4-detail"]');
      trigger.click();
      const result = {
        title: document.getElementById("v4-detail-title").textContent,
        selection: document.getElementById("v4-detail-content").textContent.includes("Spare the Dying"),
        closeFocused: document.activeElement === document.getElementById("v4-detail-close"),
      };
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      result.focusRestored = document.activeElement === trigger;
      return result;
    `);
    assert.deepEqual(featureDetail, { title: "Circle of Mortality", selection: true, closeFocused: true, focusRestored: true });
    await execute('document.querySelector(\'[data-v4-feature="cleric-feature"] [data-tracker-action="resource"][data-delta="-1"]\').click(); document.querySelector("[data-v4-tab=extras]").click(); return true;');
    const extraTracking = await execute(`
      document.querySelector('[data-v4-extra="wolf"] [data-tracker-action="extra-hp"][data-delta="-1"]').click();
      document.querySelector('[data-v4-extra="wagon"] [data-tracker-action="resource"][data-delta="-1"]').click();
      const trigger = document.querySelector('[data-v4-extra="wagon"] [data-tracker-action="open-v4-detail"]');
      trigger.click();
      const result = {
        wolf: window.character.extras.find((item) => item.id === "wolf").hp.current,
        wagonUses: window.character.extras.find((item) => item.id === "wagon").uses.current,
        focus: document.activeElement === document.getElementById("v4-detail-close"),
        detail: document.getElementById("v4-detail-content").textContent.replace(/\\s+/g, " ").trim(),
      };
      document.getElementById("v4-detail-close").click();
      result.focusRestored = document.activeElement === trigger;
      document.getElementById("note-title").value = "Route";
      document.getElementById("note-body").value = "North road is clear.";
      document.getElementById("save-note-btn").click();
      result.note = document.getElementById("notes-container").textContent.includes("North road is clear.");
      return result;
    `);
    assert.equal(extraTracking.wolf, 4);
    assert.equal(extraTracking.wagonUses, 1);
    assert.equal(extraTracking.focus, true);
    assert.match(extraTracking.detail, /HP\s*20\/30/);
    assert.match(extraTracking.detail, /Uses\s*1\/3/);
    assert.equal(extraTracking.focusRestored, true);
    assert.equal(extraTracking.note, true);
    await command("POST", "/window/rect", { width: 375, height: 800 });
    assert.equal(await execute('return document.documentElement.scrollWidth <= innerWidth;'), true, "V4 Features and Extras should not overflow on mobile.");
    await command("POST", "/window/rect", { width: 1280, height: 900 });
    await navigate("/c/aotr/char/karma/");
    await waitFor('return window.character.extras?.find((item) => item.id === "wolf")?.hp.current === 4 && window.character.extras?.find((item) => item.id === "wagon")?.uses.current === 1;', "V4 Extra runtime did not survive refresh");
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-player-02"); return true;');
    await navigate("/c/aotr/char/karma/");
    await waitFor('return document.body.dataset.characterCanEdit === "false" && document.querySelector("[data-v4-feature]") && document.querySelector("[data-v4-extra]");', "Read-only V4 Features and Extras did not load");
    const readOnlyContent = await execute(`
      const detail = document.querySelector('[data-v4-extra="wagon"] [data-tracker-action="open-v4-detail"]');
      detail.click();
      return {
        detailEnabled: !detail.disabled,
        drawerOpen: !document.getElementById("v4-detail-dialog").classList.contains("hidden"),
        hpDisabled: document.querySelector('[data-v4-extra="wolf"] [data-tracker-action="extra-hp"]').disabled,
        usesDisabled: document.querySelector('[data-v4-extra="wagon"] [data-tracker-action="resource"]').disabled,
        editDisabled: document.querySelector('#v4-extras-browser [data-character-editor-section="features"]').disabled,
      };
    `);
    assert.deepEqual(readOnlyContent, { detailEnabled: true, drawerOpen: true, hpDisabled: true, usesDisabled: true, editDisabled: true });
    await execute('document.getElementById("v4-detail-close").click(); localStorage.setItem("cassianslog-local-user-v1", "localhost-admin"); return true;');
    console.log("Browser smoke passed: V4 feature groups, selections, resources, Extras, Background, proficiencies, Notes, details, persistence, mobile, focus, and read-only authority");

    await execute(`
      const characters = JSON.parse(localStorage.getItem("dnd-characters:campaign:aotr") || "{}");
      const document = structuredClone(characters.karma || window.character);
      document.class = "Fighter";
      document.subclass = "";
      document.race = "Human";
      document.background = "Soldier";
      document.level = 3;
      document.ac = 17;
      document.hp = { max: 31, current: 23, temp: 4 };
      document.inventory = [{ id: "unknown-token", name: "Unknown Token", quantity: 1 }];
      document.spells = [{ id: "manual-spell", name: "Manual Spell", level: 1, prepared: true }];
      document.build = { ...(document.build || {}), mode: "manual", status: "complete", ruleset: "5e" };
      delete document.build.conversion;
      delete document.importSnapshot;
      characters.karma = document;
      localStorage.setItem("dnd-characters:campaign:aotr", JSON.stringify(characters));
      return true;
    `);
    await navigate("/c/aotr/char/karma/");
    await waitFor('return Boolean(document.getElementById("v4-conversion-open"));', "V4 conversion action did not load");
    const conversionCancel = await execute(`
      const before = JSON.stringify(window.character);
      const trigger = document.getElementById("v4-conversion-open");
      trigger.focus();
      trigger.click();
      return { before, rulesetFocused: document.activeElement === document.getElementById("v4-conversion-ruleset") };
    `);
    assert.equal(conversionCancel.rulesetFocused, true);
    await waitFor('return document.getElementById("v4-conversion-confirm")?.disabled === false && document.getElementById("v4-conversion-status")?.textContent.includes("matched");', "V4 conversion preview did not finish");
    const conversionPreview = await execute(`
      const groups = [...document.querySelectorAll("[data-conversion-group]")].map((section) => ({
        id: section.dataset.conversionGroup,
        count: Number(section.querySelector("[data-conversion-count]").textContent),
        text: section.textContent.replace(/\\s+/g, " ").trim(),
      }));
      document.getElementById("v4-conversion-cancel").click();
      return {
        groups,
        unchanged: JSON.stringify(window.character) === arguments[0],
        focusRestored: document.activeElement === document.getElementById("v4-conversion-open"),
      };
    `, [conversionCancel.before]);
    assert.deepEqual(conversionPreview.groups.map((group) => group.id), ["matched", "unresolved", "added", "removed", "changed"]);
    assert.match(conversionPreview.groups.find((group) => group.id === "matched").text, /Fighter/);
    assert.match(conversionPreview.groups.find((group) => group.id === "matched").text, /Human/);
    assert.match(conversionPreview.groups.find((group) => group.id === "matched").text, /Soldier/);
    assert.match(conversionPreview.groups.find((group) => group.id === "unresolved").text, /Ability score bases/);
    assert.equal(conversionPreview.unchanged, true, "Cancel must leave the exact source document untouched.");
    assert.equal(conversionPreview.focusRestored, true);
    await execute('document.getElementById("v4-conversion-open").click(); return true;');
    await waitFor('return document.getElementById("v4-conversion-confirm")?.disabled === false;', "V4 conversion confirmation did not become ready");
    await execute('document.getElementById("v4-conversion-confirm").click(); return true;');
    await waitFor('return window.character.build?.mode === "rules" && Boolean(window.character.build?.conversion?.rollbackDocument) && document.getElementById("v4-conversion-open")?.dataset.mode === "rollback";', "V4 conversion did not save rollback data");
    const convertedState = await execute(`
      const stored = JSON.parse(localStorage.getItem("dnd-characters:campaign:aotr") || "{}").karma;
      return {
        hp: window.character.hp,
        ac: window.character.ac,
        mode: stored.build.mode,
        status: stored.build.status,
        rollbackExact: JSON.stringify(stored.build.conversion.rollbackDocument) === arguments[0],
        removed: stored.build.conversion.preview.removed.length,
      };
    `, [conversionCancel.before]);
    assert.deepEqual(convertedState.hp, JSON.parse(conversionCancel.before).hp, "Conversion must preserve the live pre-conversion HP snapshot.");
    assert.equal(convertedState.ac, 17);
    assert.equal(convertedState.mode, "rules");
    assert.equal(convertedState.status, "incomplete");
    assert.equal(convertedState.rollbackExact, true);
    assert.equal(convertedState.removed, 0);
    await execute('document.getElementById("v4-conversion-open").click(); document.getElementById("v4-conversion-confirm").click(); return true;');
    await waitFor('return window.character.build?.mode === "manual" && document.getElementById("v4-conversion-open")?.dataset.mode === "convert";', "V4 conversion rollback did not restore the manual snapshot");
    assert.equal(await execute('return JSON.stringify(window.character) === arguments[0];', [conversionCancel.before]), true, "Rollback must restore the exact pre-conversion document.");
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-player-02"); return true;');
    await navigate("/c/aotr/char/karma/");
    await waitFor('return document.body.dataset.characterCanEdit === "false";', "Read-only conversion fixture did not load");
    assert.equal(await execute('return Boolean(document.getElementById("v4-conversion-open"));'), false, "Read-only viewers must not receive conversion controls.");
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-admin"); return true;');
    console.log("Browser smoke passed: V4 reviewed conversion preview, cancel, preserved totals, rollback, persistence, and read-only authority");
    }

    if (includesTag("@npcs")) {
    await navigate("/char/cassian/");
    await waitFor('return window.character?.id === "cassian";', "NPC fixture character did not load");
    await execute(`
      const template = JSON.parse(JSON.stringify(window.character));
      const shown = {
        ...template,
        id: "known-npc",
        name: "Known NPC",
        ac: 19,
        background: "Player-hidden secret",
        features: [{ name: "Public Feature", description: "Hidden feature detail", source: "NPC stat block" }],
      };
      delete shown.build;
      delete shown.characterSchemaVersion;
      const hidden = { ...template, id: "hidden-npc", name: "Hidden NPC" };
      localStorage.setItem("dnd-npcs:campaign:aotr", JSON.stringify({
        "known-npc": { document: shown, visibility: { name: true, "actions.0.name": true, "features.0.name": true }, playerVisible: true },
        "hidden-npc": { document: hidden, visibility: { name: true }, playerVisible: false },
      }));
      localStorage.setItem("cassianslog-runtime-settings:campaign:aotr", JSON.stringify({
        characterSheetStyle: "v1",
        characterSheetStyleOverrides: {},
        npcSheetStyleOverrides: { "known-npc": "v4" },
        sections: {},
        openWrites: true,
      }));
      localStorage.setItem("cassianslog-local-user-v1", "localhost-admin");
      return true;
    `);
    await smoke(
      "NPC archive manager controls",
      "/c/aotr/npc/",
      'return document.querySelectorAll("#npcs article").length === 2;',
      'return !document.getElementById("add-npc").classList.contains("hidden") && document.body.textContent.includes("Shown to players") && document.body.textContent.includes("Hidden from players");',
    );
    await execute(`
      localStorage.setItem("dnd-npc-build-drafts-v1:campaign:aotr", JSON.stringify({
        "draft-rules-browser-npc": {
          draftId: "draft-rules-browser-npc",
          currentStep: "review",
          createdAt: "2026-09-16T00:00:00.000Z",
          updatedAt: "2026-09-16T00:00:00.000Z",
          sync: { state: "saved", error: "" },
          document: {
            id: "rules-browser-npc",
            name: "Rules Browser NPC",
            status: "Draft",
            hp: { max: 0, current: 0, temp: 0 },
            characterSchemaVersion: 2,
            build: {
              version: 1,
              mode: "rules",
              status: "incomplete",
              ruleset: "5e",
              preferences: { hitPoints: "fixed", encumbrance: "none", coinWeight: true, prerequisites: true, enabledSources: [] },
              levels: [{ classId: "phbClassFighter", subclassId: "", level: 1, hitPointRolls: [] }],
              speciesId: "phbRaceHuman",
              backgroundId: "phbBackgroundSoldier",
              abilityScores: { method: "standard", base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } },
              selections: {
                "phbClassFighter:selection:0": ["athletics", "perception"],
                "phbClassFighter:selection:1": ["defense"],
                "phbRaceHuman:selection:0": ["elvish"],
                "phbBackgroundSoldier:selection:0": ["dice-set"]
              },
              spells: { knownIds: [], spellbookIds: [], assignments: {} },
              inventory: [],
              description: { backstory: "Built through shared Character rules." },
              overrides: {}
            }
          }
        }
      }));
      document.getElementById("add-npc").click();
      document.getElementById("detailed-build-entry").click();
      return true;
    `);
    await waitFor(
      `return document.querySelector('[data-builder-step="review"]')?.getAttribute("aria-current") === "step"
        && document.getElementById("builder-finish")
        && !document.getElementById("builder-finish").disabled
        && document.getElementById("builder-review-summary-title")?.textContent.includes("NPC summary")
        && document.getElementById("character-builder-save-status")?.textContent.includes("browser");`,
      "Rules-built NPC draft did not resume at finishable Review",
    );
    await command("POST", "/window/rect", { width: 375, height: 800 });
    assert.equal(await execute('return document.documentElement.scrollWidth <= innerWidth + 1;'), true, "Rules-built NPC builder must not overflow mobile width.");
    await command("POST", "/window/rect", { width: 1280, height: 900 });
    await execute('document.getElementById("builder-finish").click(); return true;');
    await waitFor(
      `return location.pathname === "/c/aotr/npc/rules-browser-npc/"
        && window.character?.build?.mode === "rules"
        && window.character?.build?.status === "complete"
        && window.character?.hp?.max === 12
        && window.character?.resources?.some((resource) => resource.name === "Second Wind")
        && document.body.dataset.npcPlayerVisible === "false"
        && Object.keys(JSON.parse(localStorage.getItem("dnd-npc-build-drafts-v1:campaign:aotr") || "{}")).length === 0;`,
      "Rules-built NPC did not materialize, remain hidden, redirect, and remove its draft",
    );
    console.log("Browser smoke passed: rules-built NPC shared builder, engine, runtime, privacy, and mobile layout");
    await navigate("/c/aotr/npc/");
    await waitFor('return document.querySelectorAll("#npcs article").length === 3;', "Rules-built NPC did not return in the manager archive");
    await execute(`
      document.getElementById("add-npc").click();
      document.getElementById("dnd-beyond-import-toggle").click();
      document.getElementById("dnd-beyond-url").value = "https://www.dndbeyond.com/characters/123456789";
      document.getElementById("dnd-beyond-url-import").click();
      return true;
    `);
    await waitFor(
      'return document.getElementById("new-npc-name").value === "Imported Browser Hero" && !document.getElementById("dnd-beyond-import-summary").classList.contains("hidden");',
      "NPC D&D Beyond import did not populate Quick Setup",
    );
    await execute('document.getElementById("create-npc-submit").click(); return true;');
    await eventually(async () => {
      const state = await execute(`return {
        pathname: location.pathname,
        name: window.character?.name || "",
        intelligence: window.character?.stats?.int?.score,
        status: document.getElementById("npc-form-status")?.textContent || "",
        storedIds: Object.keys(JSON.parse(localStorage.getItem("dnd-npcs:campaign:aotr") || "{}")),
      };`);
      if (state.pathname === "/c/aotr/npc/imported-browser-hero/" && state.name === "Imported Browser Hero" && state.intelligence === 16) return state;
      throw new Error(JSON.stringify(state));
    }, "Imported D&D Beyond NPC did not open in the tracker");
    await waitFor(
      'return Boolean(document.querySelector(\'[data-npc-field-visibility="ac"]\'));',
      "Imported NPC editor visibility controls did not mount",
    );
    assert.equal(await execute('return document.body.dataset.npcPlayerVisible === "false" && document.body.dataset.trackerKind === "npc" && window.npcVisibility?.$default === true && document.querySelector(\'[data-npc-field-visibility="ac"]\')?.textContent.includes("Shown");'), true, "Imported NPC should remain hidden while its fields start shown by default.");
    console.log("Browser smoke passed: NPC D&D Beyond import");
    await smoke(
      "NPC tracker field controls",
      "/c/aotr/npc/known-npc/",
      'return window.character?.id === "known-npc" && document.documentElement.dataset.characterSheetStyle === "v4" && document.getElementById("v4-sheet")?.dataset.v4Entity === "npc" && Boolean(document.getElementById("edit-character-toggle"));',
      `
        document.getElementById("edit-character-toggle").click();
        const hasRoll = Boolean(document.querySelector('[data-roll-label="Shortsword Attack"]'));
        const initial = document.querySelector('[data-npc-field-visibility="name"]')?.textContent.includes("Shown")
          && document.querySelector('[data-npc-field-visibility="ac"]')?.textContent.includes("Hidden");
        const v4Selected = document.getElementById("editor-character-sheet-style")?.value === "v4";
        const npcCopy = document.getElementById("character-editor")?.textContent.includes("NPC tracker layout");
        document.querySelector('[data-npc-visibility-preset="show-all"]').click();
        const showsAll = document.querySelector('[data-npc-field-visibility="ac"]')?.textContent.includes("Shown");
        document.querySelector('[data-npc-visibility-preset="hide-all"]').click();
        document.querySelector('[data-npc-field-visibility="name"]').click();
        const checks = {
          hasRoll,
          initial,
          showsAll,
          v4Selected,
          npcCopy,
          noConversion: !document.getElementById("v4-conversion-open"),
          playerVisible: Boolean(document.querySelector("[data-npc-player-visible]:checked")),
        };
        return Object.values(checks).every(Boolean) ? true : JSON.stringify(checks);
      `,
    );
    await execute('window.confirm = () => true; document.getElementById("editor-cancel").click(); return true;');
    await command("POST", "/window/rect", { width: 375, height: 800 });
    const npcV4Themes = await execute(`
      document.getElementById("theme-toggle").click();
      document.querySelector('[data-theme-reverse="false"]').click();
      document.querySelector('[data-theme-font="auto"]').click();
      document.querySelector('[data-theme-card="evil-cassian"]').click();
      const lightMode = document.documentElement.dataset.theme;
      const lightToken = getComputedStyle(document.documentElement).getPropertyValue("--theme-background").trim();
      document.querySelector('[data-theme-card="cassians-classic"]').click();
      const darkMode = document.documentElement.dataset.theme;
      const darkToken = getComputedStyle(document.documentElement).getPropertyValue("--theme-background").trim();
      document.querySelector("[data-theme-dialog]").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return {
        noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
        themed: lightMode === "light" && darkMode === "dark" && lightToken !== darkToken,
      };
    `);
    assert.deepEqual(npcV4Themes, { noOverflow: true, themed: true }, "Freeform NPC V4 should support mobile width and both themes.");
    await command("POST", "/window/rect", { width: 1280, height: 900 });
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-player-01"); return true;');
    await smoke(
      "NPC player privacy",
      "/c/aotr/npc/",
      'return document.querySelectorAll("#npcs article").length === 1;',
      'return document.body.textContent.includes("Known NPC") && !document.body.textContent.includes("Hidden NPC") && document.getElementById("add-npc").classList.contains("hidden");',
    );
    await smoke(
      "NPC player field redaction",
      "/c/aotr/npc/known-npc/",
      'return window.character?.id === "known-npc" && document.documentElement.dataset.characterSheetStyle === "v4" && document.body.dataset.characterCanEdit === "false" && document.getElementById("character-name")?.textContent.trim() === "Known NPC" && !document.getElementById("edit-character-toggle");',
      `
        const detail = document.querySelector('[data-v4-feature="feature-1"] [data-tracker-action="open-v4-detail"]');
        const use = document.querySelector('[data-v4-action-card] [data-tracker-action="request-use"]');
        const nonMutatingEnabled = Boolean(detail && !detail.disabled);
        detail?.click();
        return document.getElementById("character-name").textContent.trim() === "Known NPC"
          && document.getElementById("v4-sheet")?.dataset.v4Entity === "npc"
          && !window.character.build
          && !document.getElementById("v4-conversion-open")
          && !document.body.textContent.includes("Player-hidden secret")
          && !document.body.textContent.includes("Hidden feature detail")
          && !document.getElementById("edit-character-toggle")
          && Boolean(use?.disabled)
          && nonMutatingEnabled
          && !document.getElementById("v4-detail-dialog").classList.contains("hidden")
          && document.getElementById("v4-detail-content").textContent.includes("No description recorded");
      `,
    );
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-admin"); return true;');
    }

    if (includesTag("@character-layout")) {
    await execute(`
      localStorage.setItem("cassianslog-runtime-settings", JSON.stringify({ characterSheetStyle: "v3", characterSheetStyleOverrides: { cassian: "v3" }, sections: {}, openWrites: true }));
      const sections = [
        ["character-overview", 2], ["quick-stats", 1], ["skills-and-saves", 3],
        ["hit-points", 1], ["combat", 1], ["inventory", 1],
        ["all-possibilities", 1], ["spellcasting", 1], ["notes", 1],
      ].map(([id, span]) => ({ id, span }));
      localStorage.setItem("cassianslog-character-layout-v3:localhost-admin:cassian", JSON.stringify({ layout: { version: 1, columns: 3, sections }, pending: false }));
      return true;
    `);
    await navigate("/char/cassian/");
    await waitFor('return document.documentElement.dataset.characterSheetStyle === "v3" && document.querySelectorAll("[data-v3-section]").length === 9;', "V3 tracker did not load");
    const threeColumnLayout = await execute(`
      const grid = document.getElementById("v3-sheet-grid");
      const tile = (id) => document.querySelector('[data-v3-section="' + id + '"]').getBoundingClientRect();
      const sameRow = (...ids) => ids.map((id) => Math.round(tile(id).top)).every((top, _, values) => top === values[0]);
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        infoQuick: sameRow("character-overview", "quick-stats"),
        savesFull: Math.abs(tile("skills-and-saves").width - grid.getBoundingClientRect().width) < 2,
        rowThree: sameRow("hit-points", "combat", "inventory"),
        rowFour: sameRow("all-possibilities", "spellcasting", "notes"),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    `);
    assert.deepEqual(threeColumnLayout, {
      columns: 3,
      infoQuick: true,
      savesFull: true,
      rowThree: true,
      rowFour: true,
      overflow: false,
    }, "V3 should render the requested three-column example exactly.");

    await execute(`
      document.getElementById("edit-character-toggle").click();
      document.querySelector('[data-editor-section-button="advanced"]').click();
      return true;
    `);
    await waitFor('return document.getElementById("editor-v3-columns")?.value === "3" && document.querySelectorAll("[data-v3-section-row]").length === 9;', "V3 grid editor did not open");
    const v3Editor = await execute(`
      const columns = document.getElementById("editor-v3-columns");
      columns.value = "2";
      columns.dispatchEvent(new Event("change", { bubbles: true }));
      const clamped = document.querySelector('[data-v3-section-span="skills-and-saves"]').value;
      document.querySelector('[data-v3-section-move="notes"][data-delta="-1"]').click();
      const order = [...document.querySelectorAll("[data-v3-section-row]")].map((row) => row.dataset.v3SectionRow);
      document.getElementById("editor-save").click();
      return { clamped, notesBeforeSpellcasting: order.indexOf("notes") < order.indexOf("spellcasting") };
    `);
    assert.deepEqual(v3Editor, { clamped: "2", notesBeforeSpellcasting: true }, "V3 editor should clamp spans and support keyboard-accessible movement.");
    await waitFor('return document.getElementById("character-editor").classList.contains("hidden");', "V3 editor did not save");
    await navigate("/char/cassian/");
    await waitFor('return document.documentElement.dataset.characterSheetStyle === "v3" && getComputedStyle(document.getElementById("v3-sheet-grid")).gridTemplateColumns.split(" ").length === 2;', "V3 layout did not persist after reload");

    await command("POST", "/window/rect", { width: 375, height: 800 });
    const mobileV3 = await execute(`
      const grid = document.getElementById("v3-sheet-grid");
      const tops = [...grid.children].map((tile) => Math.round(tile.getBoundingClientRect().top));
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        readingOrder: tops.every((top, index) => index === 0 || top > tops[index - 1]),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    `);
    assert.deepEqual(mobileV3, { columns: 1, readingOrder: true, overflow: false }, "V3 should collapse to one saved-order column on mobile.");
    await command("POST", "/window/rect", { width: 1280, height: 900 });

    await execute(`
      const playerLayout = { version: 1, columns: 2, sections: JSON.parse(localStorage.getItem("cassianslog-character-layout-v3:localhost-admin:cassian")).layout.sections.map((section) => ({ ...section, span: Math.min(section.span, 2) })) };
      const adminLayout = { ...playerLayout, columns: 3 };
      localStorage.setItem("cassianslog-runtime-settings:campaign:aotr", JSON.stringify({ characterSheetStyle: "v3", characterSheetStyleOverrides: { cassian: "v3" }, sections: {}, openWrites: true }));
      localStorage.setItem("cassianslog-character-layout-v3:localhost-player-01:cassian:campaign:aotr", JSON.stringify({ layout: playerLayout, pending: false }));
      localStorage.setItem("cassianslog-character-layout-v3:localhost-admin:cassian:campaign:aotr", JSON.stringify({ layout: adminLayout, pending: false }));
      localStorage.setItem("cassianslog-local-user-v1", "localhost-player-01");
      return true;
    `);
    await navigate("/c/aotr/char/cassian/");
    await waitFor('return document.documentElement.dataset.characterSheetStyle === "v3" && getComputedStyle(document.getElementById("v3-sheet-grid")).gridTemplateColumns.split(" ").length === 2;', "Second user's V3 layout did not load");
    await execute(`
      localStorage.setItem("cassianslog-local-user-v1", "localhost-admin");
      return true;
    `);
    await navigate("/c/aotr/char/cassian/");
    await waitFor('return getComputedStyle(document.getElementById("v3-sheet-grid")).gridTemplateColumns.split(" ").length === 3;', "First user's separate V3 layout did not return");
    console.log("Browser smoke passed: configurable and user-isolated V3 tracker");
    }

    if (includesTag("@combat")) {
    await smoke(
      "Combat & Loot",
      "/combat-loot/",
      'return document.getElementById("tracker-list").children.length >= 3;',
      'return Boolean(document.getElementById("preset-select") && document.querySelector("[data-table-id]"));',
    );
    const combatCellFormatting = await execute(`
      const cell = [...document.querySelectorAll('[data-action="open-cell-editor"]')]
        .find((candidate) => !candidate.hasAttribute("data-damage-cell"));
      cell.click();
      const textarea = document.getElementById("editor-value");
      textarea.value = "";
      textarea.setSelectionRange(0, 0);
      document.querySelector('#editor-format-toolbar [data-markdown-format="bold"]').click();
      const result = {
        value: textarea.value,
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
        toolbarVisible: !document.getElementById("editor-format-toolbar").classList.contains("hidden"),
      };
      document.querySelector('#editor-dialog [data-close-dialog="editor-dialog"]').click();
      return result;
    `);
    assert.deepEqual(combatCellFormatting, { value: "****", start: 2, end: 2, toolbarVisible: true }, "Combat text-cell Bold should place the cursor inside the markers.");

    await execute(`
      document.querySelector('[data-tracker] [data-action="edit-character-link"]').click();
      return true;
    `);
    await waitFor(
      'return Boolean(document.querySelector(\'#character-link-entity option[value="character:cassian"]\'));',
      "Combat tracker Character choices did not load",
    );
    await execute(`
      const enabled = document.getElementById("character-link-enabled");
      const entity = document.getElementById("character-link-entity");
      enabled.checked = true;
      enabled.dispatchEvent(new Event("change", { bubbles: true }));
      entity.value = "character:cassian";
      entity.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("character-link-form").requestSubmit();
      return true;
    `);
    await waitFor(
      'return Boolean(document.querySelector(\'[data-tracker] a[href$="/char/cassian/"][target="_blank"]\'));',
      "Combat tracker link did not save",
    );
    await execute(`
      document.querySelector('[data-action="set-party"]').click();
      return true;
    `);
    await waitFor(
      'return Boolean(document.querySelector(\'#party-members [data-party-link] option[value="character:cassian"]\'));',
      "Party Character and NPC choices did not load",
    );
    await execute(`
      document.getElementById("party-name").value = "Linked Party";
      const member = document.querySelector("[data-party-member]");
      member.querySelector("[data-party-character]").value = "Cassian";
      member.querySelector("[data-party-hp]").value = "40";
      member.querySelector("[data-party-ac]").value = "16";
      member.querySelector("[data-party-link]").value = "character:cassian";
      document.getElementById("party-form").requestSubmit();
      return true;
    `);
    await waitFor(
      'return document.getElementById("party-dialog").classList.contains("hidden");',
      "Linked party did not save",
    );
    await execute(`
      document.querySelector('[data-action="bring-party"]').click();
      return true;
    `);
    await waitFor(
      'return document.getElementById("bring-party-list").textContent.includes("Linked Party");',
      "Linked saved party did not appear",
    );
    await execute(`
      const party = [...document.querySelectorAll('#bring-party-list label')]
        .find((label) => label.textContent.includes("Linked Party"));
      party.querySelector('input[name="party"]').checked = true;
      document.getElementById("bring-party-form").requestSubmit();
      return true;
    `);
    await waitFor(
      `
        const row = document.querySelector('[data-tracker] [data-table-row]');
        return row?.querySelector('[data-inline-cell]')?.value === "Cassian"
          && Boolean(row.querySelector('a[href$="/char/cassian/"][target="_blank"]'));
      `,
      "Party link did not reach Initiative",
    );
    console.log("Browser smoke passed: Combat row and saved-party tracker links");
    }

    if (includesTag("@music")) {
    await smoke(
      "Music",
      "/music/",
      'return !document.getElementById("track-form").elements.title.disabled;',
      `
        const input = document.getElementById("tag-input");
        input.value = "calm,";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return document.querySelectorAll("#tag-entry-badges [data-entry-tag]").length === 1;
      `,
    );
    }

    if (includesTag("@wiki")) {
    await smoke(
      "Wiki",
      "/wiki/",
      'return document.querySelectorAll("#wiki-sidebar a").length > 0;',
      `
        const create = document.querySelector('[data-action="new"]');
        if (!create) return false;
        create.click();
        const opened = !document.getElementById("wiki-editor").classList.contains("hidden");
        const body = document.getElementById("wiki-page-body");
        document.querySelector('[data-markdown-format="bold"]').click();
        const formatted = body.value === "****" && body.selectionStart === 2 && body.selectionEnd === 2;
        document.getElementById("wiki-editor-cancel").click();
        document.querySelector('[data-action="edit-home"]').click();
        const bannerOpened = !document.getElementById("wiki-home-editor").classList.contains("hidden")
          && document.getElementById("wiki-home-title").value === "Campaign Wiki";
        document.getElementById("wiki-home-title").value = "Campaign Archive";
        document.getElementById("wiki-home-form").requestSubmit();
        return opened && formatted && bannerOpened;
      `,
    );
    await waitFor(
      `
        const stored = JSON.parse(localStorage.getItem("dnd-wiki-pages-v1:campaign:aotr") || "[]");
        return document.getElementById("wiki-home-editor").classList.contains("hidden")
          && document.getElementById("wiki-title").textContent === "Campaign Archive"
          && stored.some((page) => page.homeBanner?.title === "Campaign Archive");
      `,
      "Wiki home banner did not save and render",
    );
    }

    if (includesTag("@compendium")) {
    await smoke(
      "Compendium",
      "/compendium/",
      'return document.querySelectorAll("#compendium-results article").length > 0;',
      `
        const search = document.getElementById("compendium-search");
        search.value = "Oathbreaker";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      `,
    );
    await waitFor(
      'return [...document.querySelectorAll("#compendium-results h3")].some((heading) => heading.textContent.includes("Oathbreaker"));',
      "Compendium search did not update",
    );
    await execute(`
      document.getElementById("compendium-clear").click();
      const type = document.getElementById("compendium-type");
      const kind = document.getElementById("compendium-kind");
      type.value = "Weapon";
      kind.value = "Swords";
      kind.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      'return [...document.querySelectorAll("#compendium-results h3")].some((heading) => heading.textContent === "Shortsword");',
      "Compendium facets did not find swords",
    );
    await execute(`
      const card = [...document.querySelectorAll("#compendium-results article")]
        .find((item) => item.querySelector("h3")?.textContent === "Shortsword");
      card.querySelector("[data-detail-id]").click();
      return true;
    `);
    await waitFor(
      `
        const body = document.getElementById("compendium-detail-body");
        const technical = body.querySelector("[data-technical-identifiers]");
        return body.textContent.includes("Martial Melee") &&
          !body.textContent.includes("ID_INTERNAL") && technical && !technical.open;
      `,
      "Compendium detail metadata was not friendly",
    );
    }

    if (includesTag("@initiative")) {
    await smoke(
      "Public Initiative",
      "/public-initiative/",
      'return document.getElementById("initiative-status").textContent !== "Loading initiative...";',
      'return Boolean(document.querySelector(\'#initiative-list a[href$="/char/cassian/"][target="_blank"]\')) && !document.querySelector("form, input, textarea, select");',
    );
    }

    if (includesTag("@screens")) {
    await navigate("/player-screen/");
    await waitFor(
      'return Boolean(document.querySelector("[data-add-widget]"));',
      "Player Screen did not become ready",
    );
    await execute(`
      localStorage.removeItem("cassianslog-screen-v1:localhost:player");
      localStorage.removeItem("cassianslog-screen-v1:localhost:dm");
      location.reload();
      return true;
    `);
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 0 && Boolean(document.querySelector("[data-add-widget]"));',
      "Player Screen did not show its blank state",
    );
    await execute(`
      document.querySelector("[data-add-widget]").click();
      const type = document.getElementById("screen-widget-type");
      type.value = "note";
      type.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector('[name="title"]').value = "Table note";
      const body = document.querySelector('[name="body"]');
      body.value = "## Reminder\\n\\nUse ";
      body.setSelectionRange(body.value.length, body.value.length);
      document.querySelector('[data-markdown-format="bold"]').click();
      if (!body.value.endsWith("****") || body.selectionStart !== body.value.length - 2) {
        throw new Error("Screen Markdown toolbar did not place the cursor inside bold markers");
      }
      body.setRangeText("cover", body.selectionStart, body.selectionEnd, "end");
      body.value += ".";
      document.getElementById("screen-editor-form").requestSubmit();
      return true;
    `);
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 1 && document.querySelector("[data-widget-id] h2")?.textContent === "Table note";',
      "Player Screen Note was not saved",
    );
    const noteDialog = await execute(`
      const trigger = document.querySelector("[data-view-widget]");
      trigger.focus();
      trigger.click();
      const detail = document.getElementById("screen-detail");
      const opened = !detail.classList.contains("hidden") && detail.textContent.includes("Reminder");
      detail.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return { opened, restored: document.activeElement === trigger };
    `);
    assert.deepEqual(noteDialog, { opened: true, restored: true }, "Note detail should open, close with Escape, and restore focus.");
    await execute(`
      document.querySelector("[data-edit-widget]").click();
      document.querySelector('[name="title"]').value = "Updated table note";
      document.getElementById("screen-editor-form").requestSubmit();
      return true;
    `);
    await waitFor(
      'return document.querySelector("[data-widget-id] h2")?.textContent === "Updated table note";',
      "Player Screen Note edit was not saved",
    );

    await execute(`
      document.querySelector("[data-add-widget]").click();
      const type = document.getElementById("screen-widget-type");
      type.value = "manual";
      type.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector('[name="title"]').value = "Image reference";
      document.querySelector('[name="body"]').value = "Uploaded image";
      const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], "pixel.png", { type: "image/png" }));
      const upload = document.querySelector('[name="imageUpload"]');
      upload.files = transfer.files;
      upload.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    await waitFor(
      'return document.querySelector(\'[name="storedImage"]\')?.value.startsWith("data:image/webp;base64,");',
      "Manual Reference image was not compressed to WebP",
    );
    await execute('document.getElementById("screen-editor-form").requestSubmit(); return true;');
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 2 && Boolean(document.querySelector("[data-screen-image]"));',
      "Manual Reference image was not saved",
    );
    const imageDialog = await execute(`
      const image = document.querySelector("[data-screen-image]");
      image.focus();
      image.click();
      const modal = document.getElementById("screen-image-modal");
      const opened = !modal.classList.contains("hidden") && document.getElementById("screen-modal-image").src.startsWith("data:image/webp");
      document.getElementById("screen-modal-image").parentElement.click();
      return { opened, restored: document.activeElement === image };
    `);
    assert.deepEqual(imageDialog, { opened: true, restored: true }, "Uploaded images should open full-size and close from the backdrop with focus restored.");
    await execute(`
      window.confirm = () => true;
      const imageCard = document.querySelector("[data-screen-image]").closest("[data-widget-id]");
      imageCard.querySelector("[data-remove-widget]").click();
      return true;
    `);
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 1 && !document.querySelector("[data-screen-image]");',
      "Manual Reference was not removed",
    );

    await execute(`
      document.querySelector("[data-add-widget]").click();
      const type = document.getElementById("screen-widget-type");
      type.value = "calculator";
      type.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("screen-editor-form").requestSubmit();
      return true;
    `);
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 2 && Boolean(document.querySelector("[data-calculator-expression]"));',
      "Player Screen Calculator was not saved",
    );
    await execute(`
      const input = document.querySelector("[data-calculator-expression]");
      input.value = "1+3/2(3+2)";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return true;
    `);
    await waitFor(
      'return document.querySelector("[data-calculator-expression]")?.value === "8.5";',
      "Player Screen Calculator did not return 8.5",
    );
    await execute(`
      const calculator = document.querySelector("[data-calculator-expression]").closest("[data-widget-id]");
      calculator.querySelector("[data-view-widget]").click();
      return true;
    `);
    await waitFor(
      'return document.querySelector("[data-history-list]")?.textContent.includes("1+3/2(3+2)");',
      "Calculator history did not persist the expression",
    );
    await execute('document.querySelector("[data-close-detail]").click(); return true;');

    await execute(`
      document.querySelector("[data-add-widget]").click();
      const type = document.getElementById("screen-widget-type");
      type.value = "initiative";
      type.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("screen-editor-form").requestSubmit();
      return true;
    `);
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 3;',
      "Player Screen Initiative was not saved",
    );
    const playerActions = await execute(`
      const initiative = [...document.querySelectorAll("[data-widget-id]")].find((card) => card.textContent.includes("Initiative Order"));
      initiative.querySelector('[data-move-widget="-1"]').click();
      return {
        publicLink: Boolean(initiative.querySelector('a[href="/c/aotr/public-initiative/"]')),
        combatLink: Boolean(initiative.querySelector('a[href="/c/aotr/combat-loot/"]')),
      };
    `);
    assert.deepEqual(playerActions, { publicLink: true, combatLink: false }, "Player Initiative should not expose Combat & Loot.");
    await navigate("/player-screen/");
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 3 && document.querySelector("[data-calculator-expression]")?.value === "8.5";',
      "Player Screen did not restore its saved layout",
    );
    await command("POST", "/window/rect", { width: 375, height: 800 });
    const mobileScreen = await execute(`
      const grid = document.getElementById("screen-grid");
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        viewport: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    `);
    assert.equal(mobileScreen.columns, 1, "Player Screen should use one grid column at Firefox's minimum mobile viewport.");
    assert.equal(mobileScreen.overflow, false, "Player Screen should not overflow horizontally on mobile.");
    assert.ok(mobileScreen.viewport <= 500, `Expected a mobile-width viewport, received ${mobileScreen.viewport}px.`);

    await navigate("/dm-screen/");
    await waitFor(
      'return document.querySelectorAll("[data-widget-id]").length === 0 && Boolean(document.querySelector("[data-add-widget]"));',
      "DM Screen should have a separate blank layout",
    );
    await execute(`
      document.querySelector("[data-add-widget]").click();
      const type = document.getElementById("screen-widget-type");
      type.value = "initiative";
      type.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("screen-editor-form").requestSubmit();
      return true;
    `);
    await waitFor(
      'return document.querySelector("[data-widget-id]")?.querySelector(\'a[href="/c/aotr/combat-loot/"]\');',
      "DM Screen Initiative did not expose the authorized Combat & Loot action",
    );
    console.log("Browser smoke passed: Player Screen widgets and responsive layout");
    console.log("Browser smoke passed: separate DM Screen actions");
    await command("POST", "/window/rect", { width: 1280, height: 900 });
    }

    if (includesTag("@admin")) {
    await smoke(
      "Admin localhost mode",
      "/admin/",
      'return !document.getElementById("admin-content").classList.contains("hidden");',
      'return document.getElementById("admin-description").textContent.includes("localStorage") && document.getElementById("admin-lock").hidden && document.querySelector("[data-site-header] #site-pages-menu-button") && !document.getElementById("themes").open && !document.getElementById("theme-admin-unavailable").classList.contains("hidden") && document.getElementById("add-theme").disabled;',
    );
    }

    const auditEntries = [
      ["Login", "/login/", 'return document.querySelectorAll("#local-test-user option").length === 21;', "", ["@auth"]],
      ["Campaigns", "/campaigns/", 'return document.querySelectorAll("#campaign-list article").length > 0;', "", ["@campaigns"]],
      ["Campaign Manage", "/c/aotr/manage/", 'return Boolean(document.getElementById("campaign-settings"));', "", ["@campaigns"]],
      ["Characters", "/c/aotr/char/", 'return document.querySelectorAll("#characters article").length > 0;', "", ["@characters"]],
      ["Tracker V1", "/c/aotr/char/cassian/", 'return document.documentElement.dataset.characterSheetStyle === "v1" && Boolean(document.getElementById("edit-character-toggle"));', "v1", ["@characters"]],
      ["Tracker V2", "/c/aotr/char/cassian/", 'return document.documentElement.dataset.characterSheetStyle === "v2" && Boolean(document.getElementById("v2-sheet-layout"));', "v2", ["@characters"]],
      ["Tracker V3", "/c/aotr/char/cassian/", 'return document.documentElement.dataset.characterSheetStyle === "v3" && Boolean(document.getElementById("v3-sheet-grid"));', "v3", ["@character-layout"]],
      ["Tracker V4", "/c/aotr/char/cassian/", 'return document.documentElement.dataset.characterSheetStyle === "v4" && Boolean(document.getElementById("v4-sheet"));', "v4", ["@characters"]],
      ["Player Screen", "/player-screen/", 'return Boolean(document.getElementById("screen-grid"));', "", ["@screens"]],
      ["DM Screen", "/dm-screen/", 'return Boolean(document.getElementById("screen-grid"));', "", ["@screens"]],
      ["Combat & Loot", "/combat-loot/", 'return document.getElementById("tracker-list").children.length > 0;', "", ["@combat"]],
      ["Public Initiative", "/public-initiative/", 'return document.getElementById("initiative-status").textContent !== "Loading initiative...";', "", ["@initiative"]],
      ["Music", "/music/", 'return Boolean(document.getElementById("track-form"));', "", ["@music"]],
      ["Wiki", "/wiki/", 'return document.querySelectorAll("#wiki-sidebar a").length > 0;', "", ["@wiki"]],
      ["Compendium", "/compendium/", 'return document.querySelectorAll("#compendium-results article").length > 0;', "", ["@compendium"]],
      ["Admin", "/admin/", 'return !document.getElementById("admin-content").classList.contains("hidden");', "", ["@admin"]],
    ].filter(([, , , , tags]) => includesTag(...tags) || requestedTags.has("@themes"));
    if (auditEntries.length) {
      for (const mode of [
        { label: "Standard desktop", reversed: false, width: 1280, height: 900 },
        { label: "Reversed mobile", reversed: true, width: 375, height: 800 },
      ]) {
        await command("POST", "/window/rect", { width: mode.width, height: mode.height });
        for (const [label, route, ready, style] of auditEntries) {
          await execute(`
            localStorage.setItem("dnd-theme", "cassians-classic");
            localStorage.setItem("dnd-theme-reversed", String(arguments[0]));
            localStorage.setItem("dnd-theme-font", "auto");
            if (arguments[1]) {
              const settings = JSON.stringify({ characterSheetStyle: arguments[1], characterSheetStyleOverrides: { cassian: arguments[1] }, sections: {}, openWrites: true });
              localStorage.setItem("cassianslog-runtime-settings", settings);
              localStorage.setItem("cassianslog-runtime-settings:campaign:aotr", settings);
            }
            return true;
          `, [mode.reversed, style || ""]);
          await navigate(route);
          await waitFor(ready, `${label} did not become ready for alignment audit`);
          await auditCurrentLayout(`${mode.label}: ${label}`);
        }
      }
      await command("POST", "/window/rect", { width: 1280, height: 900 });
      console.log(`Browser alignment audit passed: ${requestedTags.size ? [...requestedTags].join(", ") : "all shipped routes"}, tracker styles, desktop/mobile, Standard/Reversed`);
    }

    console.log(`Headless Firefox browser smoke tests passed${requestedTags.size ? ` (${[...requestedTags].join(", ")})` : ""}.`);
  } catch (error) {
    if (driverOutput.trim()) console.error(driverOutput.trim());
    throw error;
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

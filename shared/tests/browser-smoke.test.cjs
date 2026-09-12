// Verifies headless Firefox browser smoke behavior.
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = process.cwd();
const timeoutMilliseconds = 30_000;

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

    await smoke(
      "Local test-user login",
      "/login/",
      'return document.querySelectorAll("#local-test-user option").length === 21;',
      'return !document.getElementById("local-test-login").classList.contains("hidden") && document.getElementById("local-test-user").value === "localhost-admin";',
    );
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
      const template = JSON.parse(JSON.stringify(window.character));
      const shown = { ...template, id: "known-npc", name: "Known NPC", ac: 19, background: "Player-hidden secret" };
      const hidden = { ...template, id: "hidden-npc", name: "Hidden NPC" };
      localStorage.setItem("dnd-npcs:campaign:aotr", JSON.stringify({
        "known-npc": { document: shown, visibility: { name: true }, playerVisible: true },
        "hidden-npc": { document: hidden, visibility: { name: true }, playerVisible: false },
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
    await smoke(
      "NPC tracker field controls",
      "/c/aotr/npc/known-npc/",
      'return window.character?.id === "known-npc" && Boolean(document.getElementById("edit-character-toggle"));',
      `
        document.getElementById("edit-character-toggle").click();
        return document.querySelector('[data-npc-field-visibility="name"]')?.textContent.includes("Shown")
          && document.querySelector('[data-npc-field-visibility="ac"]')?.textContent.includes("Hidden")
          && Boolean(document.querySelector("[data-npc-player-visible]:checked"));
      `,
    );
    await execute('document.getElementById("editor-cancel").click(); localStorage.setItem("cassianslog-local-user-v1", "localhost-player-01"); return true;');
    await smoke(
      "NPC player privacy",
      "/c/aotr/npc/",
      'return document.querySelectorAll("#npcs article").length === 1;',
      'return document.body.textContent.includes("Known NPC") && !document.body.textContent.includes("Hidden NPC") && document.getElementById("add-npc").classList.contains("hidden");',
    );
    await smoke(
      "NPC player field redaction",
      "/c/aotr/npc/known-npc/",
      'return window.character?.id === "known-npc" && document.body.dataset.characterCanEdit === "false";',
      'return document.getElementById("character-name").textContent.trim() === "Known NPC" && !document.body.textContent.includes("Player-hidden secret") && !document.getElementById("edit-character-toggle");',
    );
    await execute('localStorage.setItem("cassianslog-local-user-v1", "localhost-admin"); return true;');

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

    await smoke(
      "Public Initiative",
      "/public-initiative/",
      'return document.getElementById("initiative-status").textContent !== "Loading initiative...";',
      'return Boolean(document.getElementById("initiative-list")) && !document.querySelector("form, input, textarea, select");',
    );

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

    await smoke(
      "Admin localhost mode",
      "/admin/",
      'return !document.getElementById("admin-content").classList.contains("hidden");',
      'return document.getElementById("admin-description").textContent.includes("localStorage") && document.getElementById("admin-lock").hidden && !document.getElementById("theme-admin-unavailable").classList.contains("hidden") && document.getElementById("add-theme").disabled;',
    );

    const auditEntries = [
      ["Login", "/login/", 'return document.querySelectorAll("#local-test-user option").length === 21;'],
      ["Campaigns", "/campaigns/", 'return document.querySelectorAll("#campaign-list article").length > 0;'],
      ["Campaign Manage", "/c/aotr/manage/", 'return Boolean(document.getElementById("campaign-settings"));'],
      ["Characters", "/c/aotr/char/", 'return document.querySelectorAll("#characters article").length > 0;'],
      ["Tracker V1", "/c/aotr/char/cassian/", 'return document.documentElement.dataset.characterSheetStyle === "v1" && Boolean(document.getElementById("edit-character-toggle"));', "v1"],
      ["Tracker V2", "/c/aotr/char/cassian/", 'return document.documentElement.dataset.characterSheetStyle === "v2" && Boolean(document.getElementById("v2-sheet-layout"));', "v2"],
      ["Tracker V3", "/c/aotr/char/cassian/", 'return document.documentElement.dataset.characterSheetStyle === "v3" && Boolean(document.getElementById("v3-sheet-grid"));', "v3"],
      ["Player Screen", "/player-screen/", 'return Boolean(document.getElementById("screen-grid"));'],
      ["DM Screen", "/dm-screen/", 'return Boolean(document.getElementById("screen-grid"));'],
      ["Combat & Loot", "/combat-loot/", 'return document.getElementById("tracker-list").children.length > 0;'],
      ["Public Initiative", "/public-initiative/", 'return document.getElementById("initiative-status").textContent !== "Loading initiative...";'],
      ["Music", "/music/", 'return Boolean(document.getElementById("track-form"));'],
      ["Wiki", "/wiki/", 'return document.querySelectorAll("#wiki-sidebar a").length > 0;'],
      ["Compendium", "/compendium/", 'return document.querySelectorAll("#compendium-results article").length > 0;'],
      ["Admin", "/admin/", 'return !document.getElementById("admin-content").classList.contains("hidden");'],
    ];
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
    console.log("Browser alignment audit passed: all shipped routes, tracker styles, desktop/mobile, Standard/Reversed");

    console.log("Headless Firefox browser smoke tests passed.");
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

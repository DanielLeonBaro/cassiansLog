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
    ".png": "image/png",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  })[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function staticServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
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

    await smoke(
      "Character archive and Quick Setup",
      "/char/",
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
    const themePicker = await execute(`
      const toggle = document.getElementById("theme-toggle");
      toggle.click();
      const cards = [...document.querySelectorAll("[data-theme-card]")];
      document.querySelector('[data-theme-card="peach-and-lime"]').click();
      document.querySelector('[data-theme-reverse="true"]').click();
      document.querySelector('[data-theme-font="black"]').click();
      const result = {
        count: cards.length,
        firstThemes: cards.slice(0, 4).map((card) => card.firstElementChild.textContent.trim()),
        theme: document.documentElement.dataset.themePalette,
        reversed: document.documentElement.dataset.themeReversed,
        backgroundToken: getComputedStyle(document.documentElement).getPropertyValue("--theme-background").trim(),
        accent: getComputedStyle(document.documentElement).getPropertyValue("--theme-accent").trim(),
        storedTheme: localStorage.getItem("dnd-theme"),
        storedFont: localStorage.getItem("dnd-theme-font"),
      };
      document.querySelector("[data-theme-dialog]").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return result;
    `);
    assert.deepEqual(themePicker, {
      count: 28,
      firstThemes: ["Cassian’s Classic", "Evil Cassian", "Black and White", "Aloe"],
      theme: "peach-and-lime",
      reversed: "true",
      backgroundToken: "154 118 0",
      accent: "244 184 196",
      storedTheme: "peach-and-lime",
      storedFont: "black",
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

    await smoke(
      "Combat & Loot",
      "/combat-loot/",
      'return document.getElementById("tracker-list").children.length >= 3;',
      'return Boolean(document.getElementById("preset-select") && document.querySelector("[data-table-id]"));',
    );

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
        document.getElementById("wiki-editor-cancel").click();
        return opened;
      `,
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

    await smoke(
      "Public Initiative",
      "/public-initiative/",
      'return document.getElementById("initiative-status").textContent !== "Loading initiative...";',
      'return Boolean(document.getElementById("initiative-list")) && !document.querySelector("form, input, textarea, select");',
    );

    await smoke(
      "Admin localhost mode",
      "/admin/",
      'return !document.getElementById("admin-content").classList.contains("hidden");',
      'return document.getElementById("admin-description").textContent.includes("localStorage") && document.getElementById("admin-lock").hidden && !document.getElementById("theme-admin-unavailable").classList.contains("hidden") && document.getElementById("add-theme").disabled;',
    );

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

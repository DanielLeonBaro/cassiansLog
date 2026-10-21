// Real Chromium fallback for Combat Desk when the Firefox smoke prerequisites are absent.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");

const root = process.cwd();
const browserPath = process.env.CHROMIUM || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((file) => fs.existsSync(file));
async function eventually(check, message) {
  const end = Date.now() + 30000; let last;
  while (Date.now() < end) {
    try { const result = await check(); if (result) return result; } catch (error) { last = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`${message}${last ? `: ${last}` : ""}`);
}
async function listen(server) { await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return server.address().port; }

(async () => {
  if (!browserPath) throw Error("Set CHROMIUM to a Chrome/Edge executable.");
  const server = http.createServer((request, response) => {
    let relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).slice(1);
    if (relative.startsWith("api/")) { response.writeHead(404); response.end("{}"); return; }
    const campaignTracker = /^c\/aotr\/(char|npc)\/([^/]+)\/?$/.exec(relative);
    if (campaignTracker) relative = campaignTracker[1] === "npc" ? "npc/template/index.html" : "char/cassian/index.html";
    if (!relative || relative.endsWith("/")) relative += "index.html";
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end("{}"); return; }
    const type = ({ ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" })[path.extname(file)] || "application/octet-stream";
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    response.end(campaignTracker ? fs.readFileSync(file, "utf8").replace(/<base href="[^"]+">/, '<base href="/">') : fs.readFileSync(file));
  });
  const port = await listen(server);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cassianslog-v6-browser-"));
  const child = spawn(browserPath, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket;
  try {
    const activePort = path.join(profile, "DevToolsActivePort");
    await eventually(() => fs.existsSync(activePort), "Chromium debugging did not start");
    const debugPort = fs.readFileSync(activePort, "utf8").split("\n")[0];
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(5000) })).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error("Debugger socket timed out")), 10000); socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }); socket.addEventListener("error", reject); });
    let sequence = 0; const pending = new Map(), errors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error(`Debugger timed out: ${method}`)); }, 15000); pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
    const execute = async (body) => {
      const result = await command("Runtime.evaluate", { expression: `(async () => {${body}})()`, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await command("Runtime.enable"); await command("Page.enable");
    const hero = JSON.parse(fs.readFileSync("char/cassian/character.json", "utf8"));
    Object.assign(hero, {
      id: "cassian", name: "Combat Browser Hero", hp: { current: 25, max: 30, temp: 3 },
      actions: [
        { id: "strike", name: "Sword with a deliberately long readable name", action: "Action", attack: "+5", damage: "1d8+3", range: "5 ft", description: "Attack description." },
        { id: "bonus", name: "Second Wind", action: "Bonus Action", resourceId: "pool", description: "Spend shared pool." },
        { id: "reaction", name: "Parry", action: "Reaction", uses: { current: 1, max: 1, reset: "short" } },
      ], features: [], resources: [{ id: "pool", name: "Shared pool", uses: { current: 2, max: 2, reset: "short" } }],
      spells: [{ id: "light", name: "Light", source: "wizard", action: "Action", level: 0, known: true, prepared: true, description: "Sheds light." }],
      spellcasting: { enabled: true, profiles: [{ id: "wizard", name: "Wizard", ability: "int", preparedLimit: 0 }], slots: [{ id: "slot", profileId: "wizard", level: 1, current: 2, max: 2, reset: "long" }] },
      inventory: [{ id: "rope", name: "Rope", quantity: 1, description: "A plain rope." }, { instanceId: "wand-1", id: "wand", name: "Wand", charges: { current: 2, max: 3, reset: "long" }, quantity: 1, automatic: true }],
    });
    const seed = `if (!localStorage.getItem("v6-browser-seeded")) {
      localStorage.setItem("v6-browser-seeded", "yes");
      localStorage.setItem("cassianslog-local-user-v1", "localhost-admin");
      localStorage.setItem("cassianslog-last-campaign-v1:localhost-admin", JSON.stringify({id:"campaign-breugaire",slug:"aotr"}));
      localStorage.setItem("dnd-characters:campaign:aotr", JSON.stringify({cassian:${JSON.stringify(hero)}}));
      localStorage.setItem("cassianslog-runtime-settings:campaign:aotr", JSON.stringify({characterSheetStyle:"v6",sections:{},openWrites:true}));
      localStorage.setItem("cassianslog-ui-preferences:localhost-admin", JSON.stringify({preferences:{version:1,density:"comfortable",pageDensity:{},sidebarCollapsed:true,trackerStyles:{character:"v6",npc:"v6"}},pending:false}));
    }`;
    await command("Page.addScriptToEvaluateOnNewDocument", { source: seed });
    const navigate = async (route, reader = false) => { await command("Page.navigate", { url: `http://127.0.0.1:${port}${route}` }); await eventually(() => execute(`return Boolean(document.querySelector(".v6-option")) && ${reader ? 'document.body.dataset.characterCanEdit === "false"' : 'Boolean(document.getElementById("edit-character-toggle"))'};`), "Combat Desk did not render"); };
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await command("Emulation.setTouchEmulationEnabled", { enabled: true });
    await navigate("/c/aotr/char/cassian/");
    assert.deepEqual(errors, [], "Page initialization must not throw");
    assert.equal(await execute('return document.documentElement.dataset.characterSheetStyle === "v6" && !document.getElementById("v4-panel-actions").hidden;'), true);
    assert.equal(await execute('document.querySelector("[data-id=bonus][data-tracker-action=request-use]").click(); document.getElementById("v4-use-cancel").click(); return window.character.resources[0].uses.current === 2 && document.querySelector("[data-v6-turn=bonus]").getAttribute("aria-pressed") === "false";'), true);
    assert.equal(await execute('document.querySelector("[data-id=bonus][data-tracker-action=request-use]").click(); document.getElementById("v4-use-confirm").click(); document.getElementById("v4-use-confirm").click(); return window.character.resources[0].uses.current === 1 && document.querySelector("[data-v6-turn=bonus]").getAttribute("aria-pressed") === "true" && document.getElementById("v6-pools").textContent.includes("1/2");'), true);
    assert.equal(await execute('document.getElementById("v6-start-turn").click(); document.querySelector("[data-roll-formula]").click(); return document.querySelector("[data-v6-turn=action]").getAttribute("aria-pressed") === "false" && window.character.resources[0].uses.current === 1;'), true);
    assert.equal(await execute('document.querySelector("[data-id=light][data-tracker-action=request-spell-cast]").click(); document.getElementById("v4-spell-cast-confirm").click(); return document.querySelector("[data-v6-turn=action]").getAttribute("aria-pressed") === "true";'), true, "Casting must mark its explicit timing");
    await execute('document.querySelector("[data-v6-pin=\\"actions:strike\\"]").click(); document.getElementById("v6-guidance").click(); return true;');
    await navigate("/c/aotr/char/cassian/");
    assert.equal(await execute('return document.querySelector(".v6-option-group h2").textContent.startsWith("Pinned") && document.getElementById("v6-turn").hidden && document.querySelector("[data-v6-turn=action]").getAttribute("aria-pressed") === "true" && document.querySelectorAll("[data-v6-key=\\"actions:strike\\"]").length === 1;'), true, "Pins, guidance, turn state, and deduplication survive refresh");
    assert.equal(await execute('const search=document.querySelector("#combat-filters [type=search]"); search.value="zzmissing";search.dispatchEvent(new Event("input",{bubbles:true}));const empty=document.querySelector(".v6-empty");search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));return Boolean(empty)&&document.querySelectorAll(".v6-option").length>0;'), true);
    await execute('document.querySelector("[data-v6-detail]").click(); return true;');
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await execute('return document.getElementById("v4-detail-dialog").contains(document.activeElement);'), true, "Detail sheet traps focus");
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    assert.equal(await execute('return document.getElementById("v4-detail-dialog").classList.contains("hidden") && document.activeElement.hasAttribute("data-v6-detail");'), true, "Closing details restores focus");
    await execute('document.getElementById("v4-tab-more").click();document.querySelector("[data-v6-open=inventory]").click();document.querySelector("[data-v6-pin=\\"inventory:rope\\"]").click();document.querySelector("[data-v6-pin=\\"inventory:wand-1\\"]").click();document.getElementById("v4-tab-actions").click();return true;');
    assert.equal(await execute('return Boolean(document.querySelector("[data-v6-key=\\"inventory:rope\\"] [data-v6-detail]")) && Boolean(document.querySelector("[data-v6-key=\\"inventory:wand-1\\"] [data-tracker-action=request-item-charge]"));'), true);
    assert.equal(await execute('document.querySelector("[data-v6-key=\\"inventory:wand-1\\"] [data-tracker-action=request-item-charge]").click();document.getElementById("v4-inventory-charge-confirm").click();return document.querySelector("[data-v6-key=\\"inventory:wand-1\\"]").textContent.includes("1/3");'), true, "Inventory shortcut reuses charge handler");
    assert.equal(await execute('document.getElementById("v4-tab-resources").click();const slot=document.querySelector("[data-tracker-action=spell-slot][data-delta=\\"-1\\"]");slot.focus();slot.click();return document.activeElement.dataset.trackerAction==="spell-slot"&&document.activeElement.dataset.delta==="-1"&&window.character.spellcasting.slots[0].current===1;'), true, "Manual slot corrections preserve keyboard focus");
    assert.equal(await execute('document.getElementById("v4-tab-more").click();document.querySelector("[data-v6-open=spells]").click();document.querySelector("#v4-spell-list [data-tracker-action=request-spell-cast]").click();document.getElementById("v4-spell-cast-confirm").click();return Boolean(document.activeElement.closest("#v4-panel-spells"));'), true, "Casting from full repertoire returns focus to visible spell row");
    const screenshotDirectory = path.join(os.tmpdir(), "cassianslog-v6-previews"); fs.mkdirSync(screenshotDirectory, { recursive: true });
    await execute('if(document.getElementById("v6-turn").hidden) document.getElementById("v6-guidance").click(); return true;');
    for (const width of [320, 390, 768, 1280]) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 });
      await execute('document.getElementById("v4-tab-actions").click(); return true;');
      for (const density of ["comfortable", "compact"]) {
        await execute(`document.documentElement.dataset.density=${JSON.stringify(density)};return true;`);
        assert.equal(await execute('return document.documentElement.scrollWidth <= innerWidth+1;'), true, `No overflow at ${width}/${density}`);
        assert.equal(await execute('return [...document.querySelectorAll("main button")].filter(node=>node.getClientRects().length).every(node=>node.getBoundingClientRect().height>=43.9);'), true, `Comfortable touch targets at ${width}/${density}`);
        assert.equal(await execute(`return document.getElementById("v4-panel-resources").hidden === ${width < 1024};`), true, "Resources share desktop combat workspace only");
      }
      for (const panel of ["resources", "sheet", "more", "spells", "inventory", "features", "extras", "notes"]) {
        await execute(`const id=${JSON.stringify(panel)}; if(["resources","sheet","more"].includes(id))document.getElementById("v4-tab-"+id).click();else {document.getElementById("v4-tab-more").click();document.querySelector('[data-v6-open="'+id+'"]').click();}window.scrollTo(0,0);return true;`);
        assert.equal(await execute('return document.documentElement.scrollWidth <= innerWidth+1;'), true, `No overflow in ${panel} at ${width}`);
      }
      await execute('document.getElementById("v4-tab-actions").click();document.activeElement.blur();window.scrollTo(0,0);return true;');
      const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.writeFileSync(path.join(screenshotDirectory, `combat-${width}.png`), Buffer.from(screenshot.data, "base64"));
    }
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await execute('const {applyTheme}=await import("/shared/js/theme.js");applyTheme("evil-cassian",{persist:false});window.scrollTo(0,0);return true;');
    fs.writeFileSync(path.join(screenshotDirectory, "combat-light-390.png"), Buffer.from((await command("Page.captureScreenshot", { format: "png" })).data, "base64"));
    // Read-only guards remain effective for dispatched events and personal pins remain available.
    assert.equal(await execute('document.body.dataset.characterCanEdit="false";const before=JSON.stringify(window.character);const turn=document.querySelector("[data-v6-turn=action]");const pressed=turn.getAttribute("aria-pressed");turn.click();document.getElementById("v6-start-turn").click();document.querySelector("[data-tracker-action=request-use]").dispatchEvent(new MouseEvent("click",{bubbles:true}));const pin=document.querySelector("[data-v6-pin]");const pinned=pin.getAttribute("aria-pressed");const key=pin.dataset.v6Pin;pin.click();return before===JSON.stringify(window.character)&&turn.getAttribute("aria-pressed")===pressed&&[...document.querySelectorAll("[data-v6-pin]")].find(node=>node.dataset.v6Pin===key).getAttribute("aria-pressed")!==pinned;'), true);
    await execute(`const npc=${JSON.stringify(hero)};npc.id="desk-npc";npc.name="Desk NPC";npc.background="NPC SECRET BACKGROUND";localStorage.setItem("dnd-npcs:campaign:aotr",JSON.stringify({"desk-npc":{document:npc,playerVisible:true,visibility:{$default:true,background:false}}}));return true;`);
    await navigate("/c/aotr/npc/desk-npc/");
    assert.equal(await execute('return document.body.dataset.trackerKind==="npc" && document.querySelector(".v6-option-group h2").textContent.startsWith("Combat options") && [...document.querySelectorAll("[data-v6-turn]")].every(node=>node.getAttribute("aria-pressed")==="false");'), true, "NPC personal state is isolated from character state");
    await execute('localStorage.setItem("dnd-npc-desk-npc-state:campaign:aotr",JSON.stringify({conditions:["NPC SECRET CONDITION"],concentration:{name:"NPC SECRET CONCENTRATION"}}));localStorage.setItem("cassianslog-local-user-v1","localhost-player-01");localStorage.setItem("cassianslog-ui-preferences:localhost-player-01",JSON.stringify({preferences:{version:1,density:"comfortable",pageDensity:{},sidebarCollapsed:true,trackerStyles:{character:"v6",npc:"v6"}},pending:false}));return true;');
    await navigate("/c/aotr/npc/desk-npc/", true);
    assert.equal(await execute('const before=JSON.stringify(window.character);document.querySelector("[data-v6-turn=action]").dispatchEvent(new MouseEvent("click",{bubbles:true}));document.getElementById("v6-start-turn").dispatchEvent(new MouseEvent("click",{bubbles:true}));document.querySelector("[data-tracker-action=request-use]").dispatchEvent(new MouseEvent("click",{bubbles:true}));return before===JSON.stringify(window.character)&&!before.includes("NPC SECRET")&&!document.body.textContent.includes("NPC SECRET")&&[...document.querySelectorAll("[data-v6-turn]")].every(node=>node.disabled&&node.getAttribute("aria-pressed")==="false")&&document.querySelector("[data-v6-pin]").disabled===false;'), true, "Actual NPC player projection and read-only controls remain protected");
    for (const style of ["v1", "v2", "v3", "v4", "v5"]) {
      await execute(`localStorage.setItem("cassianslog-local-user-v1","localhost-admin");const key="cassianslog-ui-preferences:localhost-admin";const cache=JSON.parse(localStorage.getItem(key));cache.preferences.trackerStyles.character=${JSON.stringify(style)};localStorage.setItem(key,JSON.stringify(cache));return true;`);
      await command("Page.navigate", { url: `http://127.0.0.1:${port}/c/aotr/char/cassian/` });
      await eventually(() => execute(`return document.documentElement.dataset.characterSheetStyle===${JSON.stringify(style)} && document.getElementById("character-name")?.textContent.trim()==="Combat Browser Hero" && Boolean(document.getElementById("edit-character-toggle"));`), `Existing ${style} layout did not reopen`);
    }
    assert.deepEqual(errors, [], "Combat interactions must not throw");
    console.log(`V6 Chromium browser checks passed: uses/casts/charges, cancellation, double confirm, turns, pins, refresh, focus, read-only characters/NPCs, NPC redaction, all utility panels, V1–V5 compatibility, 4 widths and 2 densities. Screenshots: ${screenshotDirectory}`);
  } finally {
    socket?.close(); child.kill(); server.closeAllConnections(); server.close();
    // Browser-owned temporary profile may stay locked briefly after process exit.
    if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith("cassianslog-v6-browser-")) {
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* OS temp cleanup can reclaim it. */ }
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

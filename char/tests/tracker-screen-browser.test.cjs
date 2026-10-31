// Native Chromium checks for the isolated, fixture-only design review.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { createPreviewServer } = require("./preview-server.cjs");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(check, message) {
  const end = Date.now() + 30000; let last;
  while (Date.now() < end) {
    try { const value = await check(); if (value) return value; } catch (error) { last = error.message; }
    await delay(100);
  }
  throw Error(`${message}${last ? `: ${last}` : ""}`);
}

(async () => {
  const browser = process.env.CHROMIUM || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
  if (!browser) throw Error("Set CHROMIUM to a Chrome/Edge executable.");
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cassianslog-screen-browser-"));
  const child = spawn(browser, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket;
  try {
    const activePort = path.join(profile, "DevToolsActivePort");
    await eventually(() => fs.existsSync(activePort), "Chromium debugging did not start");
    const port = fs.readFileSync(activePort, "utf8").split("\n")[0];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(5000) })).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error("Debugger socket timed out")), 10000); socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }); socket.addEventListener("error", reject); });
    let sequence = 0; const pending = new Map(), errors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const request = pending.get(message.id); if (request) { pending.delete(message.id); message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result); } }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error(`Debugger timed out: ${method}`)); }, 15000); pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
    const execute = async (source) => {
      const result = await command("Runtime.evaluate", { expression: `(async()=>{${source}})()`, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await command("Runtime.enable"); await command("Page.enable");
    const size = async (width, height = width < 768 ? 844 : 900) => { await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 1024 }); await delay(50); };
    const navigate = async (variant = "v2.1", fixture = "fighter", extra = "") => {
      await command("Page.navigate", { url: `${origin}/char/tests/previews/screen.html?variant=${variant}&fixture=${fixture}${extra}` });
      await eventually(() => execute(`return window.trackerPreview?.variant===${JSON.stringify(variant)} && window.trackerPreview.adapter.character.id===${JSON.stringify(`preview-${fixture}`)};`), "Preview did not mount");
      await execute("await document.fonts.ready; return true;");
    };
    const click = async (selector) => execute(`const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing '+${JSON.stringify(selector)});node.click();return true;`);
    const checkLayout = async (label) => {
      assert.equal(await execute('return document.documentElement.scrollWidth<=innerWidth+1 && document.querySelector(".tracker-main").scrollWidth<=document.querySelector(".tracker-main").clientWidth+1;'), true, `No horizontal overflow: ${label}`);
      assert.equal(await execute('return document.querySelector(".tracker-header").getBoundingClientRect().height===56;'), true, `One 56px header: ${label}`);
      assert.equal(await execute('return [...document.querySelectorAll(".tracker-header, .tracker-tabs, .tracker-option-group, .tracker-abilities-section")].every(n=>parseFloat(getComputedStyle(n).borderTopLeftRadius)>0)&&getComputedStyle(document.querySelector(".tracker-app")).backgroundColor==="rgba(0, 0, 0, 0)";'), true, `Themed panels and transparent canvas: ${label}`);
      const small = await execute('return [...document.querySelectorAll(".tracker-app button,.tracker-header a")].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<43.9).map(n=>n.textContent);');
      assert.deepEqual(small, [], `44px touch controls: ${label}`);
      assert.equal(await execute('const ids=[...document.querySelectorAll("[id]")].map(n=>n.id);return ids.length===new Set(ids).size;'), true, `Unique IDs: ${label}`);
      assert.equal(await execute('return localStorage.length===0&&sessionStorage.length===0;'), true, "Previews must not write browser storage");
    };
    const screenshots = path.resolve(".cloudflare/previews/tracker-2x"); fs.mkdirSync(screenshots, { recursive: true });
    for (const variant of ["v2.1", "v2.2"]) for (const fixture of ["fighter", "caster", "npc"]) {
      for (const width of [320, 390, 768, 1024, 1280]) {
        await size(width); await navigate(variant, fixture);
        for (const density of ["comfortable", "compact"]) for (const theme of ["light", "dark"]) {
          await execute(`document.documentElement.dataset.density=${JSON.stringify(density)};trackerPreview.setTheme(${JSON.stringify(theme)});return true;`);
          await checkLayout(`${variant}/${fixture}/${width}/${density}/${theme}`);
        }
        if (variant === "v2.1" && width === 390) assert.equal(await execute('document.documentElement.dataset.density="comfortable";return [...document.querySelectorAll(".tracker-option")].slice(0,3).every(n=>n.getBoundingClientRect().bottom<=document.querySelector(".tracker-tabs").getBoundingClientRect().top);'), true, `Three complete usable rows without scrolling: ${fixture}`);
        if (width === 390 || fixture === "fighter" && [768, 1024, 1280].includes(width)) {
          await execute('document.documentElement.dataset.density="comfortable";trackerPreview.setTheme("light");return true;');
          const name = `${variant}${fixture === "fighter" ? "" : `-${fixture}`}-${width}`;
          fs.writeFileSync(path.join(screenshots, `${name}.png`), Buffer.from((await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })).data, "base64"));
          if (width === 390 && fixture === "fighter") {
            await execute('trackerPreview.setTheme("dark");return true;');
            fs.writeFileSync(path.join(screenshots, `${name}-dark.png`), Buffer.from((await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })).data, "base64"));
          }
        }
      }
    }
    await size(390); await navigate();
    await execute('const s=document.querySelector("#tracker-search");s.value="wind";s.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector(".tracker-combat-info").open=true;document.querySelector("[data-command=switch-view]").focus();return true;');
    await click('[data-command="switch-view"]');
    assert.equal(await execute('return trackerPreview.screen.variant==="v2.2"&&trackerPreview.screen.state.page==="actions"&&document.querySelector("#tracker-search").value==="wind"&&document.querySelector(".tracker-combat-info").open&&document.querySelectorAll("[role=tab]").length===5&&document.activeElement.dataset.command==="switch-view";'),true,"Hot switch preserves combat context, filters, expanded info, and focus");
    await click('[data-command="switch-view"]');await execute('const s=document.querySelector("#tracker-search");s.value="";s.dispatchEvent(new Event("input",{bubbles:true}));return true;');
    await execute('trackerPreview.screen.navigate("notes");document.querySelector("[data-note-form] input").value="Unsaved note";return true;');
    await click('[data-command="switch-view"]');await click('[data-command="switch-view"]');
    assert.equal(await execute('return document.querySelector("[data-note-form] input").value==="Unsaved note";'),true,"Shared pages retain unsaved text while switching");
    await execute('trackerPreview.screen.navigate("play");return true;');
    await click('[data-use="actions:second-wind"]'); await click('[data-command="close-dialog"]');
    assert.equal(await execute('return trackerPreview.adapter.character.actions[1].uses.current===1&&!trackerPreview.adapter.personal.turn.bonus;'), true);
    await click('[data-use="actions:sweep"]');
    assert.equal(await execute('const b=document.querySelector("[data-command=confirm-use]");b.click();b.click();return trackerPreview.adapter.character.resources[0].uses.current===2&&trackerPreview.adapter.personal.turn.action;'), true, "Confirmation commits once");
    await click('[data-detail="actions:longsword"]'); await checkLayout("phone detail sheet");
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await execute('return document.querySelector("dialog").contains(document.activeElement);'), true, "Native modal traps focus");
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await delay(50);
    assert.equal(await execute('return !document.querySelector("dialog").open&&document.activeElement.dataset.detail==="actions:longsword";'), true, "Escape restores focus");
    await execute('trackerPreview.adapter.personal.startTurn();document.querySelector(".tracker-option [data-roll-formula]").click();return true;');
    assert.equal(await execute('return !trackerPreview.adapter.personal.turn.action&&document.querySelector(".tracker-status").textContent.includes("Longsword");'), true, "Rolls never mark a turn");
    await click('[data-command="hp"]'); await click('[data-hp="damage"]');
    assert.equal(await execute('return trackerPreview.adapter.character.hp.current===33;'), true); await click('[data-command="close-dialog"]');
    await click('[data-command="filters"]');
    await execute('const s=document.querySelector("[data-timing]");s.value="reaction";s.dispatchEvent(new Event("change",{bubbles:true}));return true;'); await click('[data-command="close-dialog"]');
    assert.equal(await execute('return document.querySelectorAll(".tracker-option").length===1&&document.querySelector(".tracker-option").textContent.includes("Parry");'), true);
    await click('[data-command="filters"]'); await click('[data-command="clear-filters"]');
    await execute('const s=document.querySelector("#tracker-search");s.focus();s.value="missing";s.dispatchEvent(new Event("input",{bubbles:true}));return true;');
    await execute('document.querySelector("dialog").dispatchEvent(new Event("close"));return true;');
    assert.deepEqual(await execute('return {empty:Boolean(document.querySelector(".tracker-empty")),active:document.activeElement.id,query:trackerPreview.screen.state.query,modal:document.querySelector("dialog").open};'), {empty:true,active:"tracker-search",query:"missing",modal:false}, "Search must retain focus after filters close"); await click('[data-command="clear-filters"]');
    for (const page of ["resources", "checks", "inventory", "more", "spells", "preparation", "features", "extras", "notes", "profile", "trackers"]) {
      await execute(`trackerPreview.screen.navigate(${JSON.stringify(page)});return true;`); await checkLayout(page);
    }
    await execute('trackerPreview.screen.navigate("notes");const f=document.querySelector("[data-note-form]");f.elements.title.value="Session reminder";f.elements.body.value="Bring the map.";f.requestSubmit();return true;');
    assert.equal(await execute('return trackerPreview.adapter.character.notes.at(-1).body==="Bring the map.";'), true, "Notes work in the preview");
    await execute('trackerPreview.screen.navigate("play");document.querySelector(".tracker-main").scrollTop=150;trackerPreview.screen.navigate("resources");trackerPreview.screen.navigate("play");return true;');
    assert.equal(await execute('return document.querySelector(".tracker-main").scrollTop===150;'), true, "Navigation restores scroll position");
    await execute('document.querySelector("[data-page=play]").focus();return true;');
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    assert.equal(await execute('return trackerPreview.screen.state.page==="checks"&&document.activeElement.dataset.page==="checks";'), true, "Tabs support keyboard navigation");
    await execute('trackerPreview.screen.navigate("play");return true;'); await click('[data-command="menu"]'); await click('[data-command="turn"]');
    await click('[data-turn="reaction"]'); await click('[data-command="start-turn"]');
    assert.equal(await execute('return Object.values(trackerPreview.adapter.personal.turn).every(v=>!v)&&trackerPreview.adapter.character.resources[0].uses.current===2;'), true);
    await navigate("v2.2", "caster"); await click('[data-page="spells"]'); await click('[data-use="spells:missile"]');
    await execute('const s=document.querySelector("[data-use-option]");s.value="slot:level-3";s.dispatchEvent(new Event("change",{bubbles:true}));return true;'); await click('[data-command="confirm-use"]');
    assert.equal(await execute('return trackerPreview.adapter.character.spellcasting.slots[2].current===0;'), true, "Upcasting uses chosen slot");
    await click('[data-use="spells:web"]'); await click('[data-command="confirm-use"]');
    assert.equal(await execute('return trackerPreview.adapter.character.concentration.name==="Web";'), true);
    await size(768); await click('[data-page="actions"]'); await click('[data-detail="spells:fire-bolt"]');
    assert.equal(await execute('return !document.querySelector("dialog").open&&document.querySelector(".tracker-side-detail").textContent.includes("Fire Bolt");'), true, "Tablet details use side panel");
    await checkLayout("tablet details");
    await navigate("v2.2", "npc", "&readonly=1");
    await click('[data-command="switch-view"]');
    assert.equal(await execute('return trackerPreview.screen.variant==="v2.1"&&!trackerPreview.adapter.canEdit;'),true,"Read-only viewers may switch layouts");
    await click('[data-command="switch-view"]');
    assert.equal(await execute('return !document.body.textContent.includes("DM notes")&&!JSON.stringify(trackerPreview.adapter.character).includes("signet");'), true);
    await click('[data-page="actions"]'); await click('[data-detail="actions:breath"]'); await click('[data-pin="actions:breath"]');
    assert.equal(await execute('return document.querySelector("[data-use=\\"actions:breath\\"]").disabled&&trackerPreview.adapter.character.actions[2].uses.current===1;'), true);
    await size(320, 450); await navigate("v2.1", "fighter"); await click('[data-command="hp"]');
    await execute('document.querySelector("#tracker-hp-amount").focus();return true;'); await checkLayout("reduced keyboard viewport");
    assert.equal(await execute('const n=document.querySelector("dialog");return n.scrollHeight>n.clientHeight&&n.scrollWidth<=n.clientWidth+1;'), true);
    await click('[data-command="close-dialog"]');
    await execute('trackerPreview.adapter.character.name="A character with an unusually long name and many titles";trackerPreview.adapter.character.actions[0].name="A very long combat option with several descriptive words and anunbrokenwordthatmustwrapwithoutsqueezingcontrols";trackerPreview.screen.render();return true;');
    await checkLayout("320px long names");
    await execute('window.previewRestCalls=0;trackerPreview.adapter.rest=()=>{previewRestCalls++;return false;};return true;');
    await click('[data-command="menu"]'); await click('[data-command="rest"]'); await click('[data-rest="long"]');
    await execute('const b=document.querySelector("[data-confirm-rest]");b.click();b.click();return true;');
    assert.equal(await execute('return previewRestCalls===1&&Boolean(document.querySelector("dialog [role=alert]"))&&document.querySelector("[data-confirm-rest]").disabled;'),true,"Failed rest reports inside the sheet and cannot confirm twice");
    assert.deepEqual(errors, [], "Preview interactions must not throw");
    for (const route of ["/api/characters", "/char/cassian/character.json", "/char/js/../../../package.json", "/char/js/%2e%2e/%2e%2e/cloudflare/settings.js"]) assert.equal((await fetch(origin + route)).status, 404, "Preview server cannot expose live documents or APIs");
    console.log(`Tracker preview browser checks passed: 120 viewport/theme/density combinations, all fixtures/views, details/focus, cancellation, double confirmation, HP, filters, rolls, upcasting, concentration, Turn, read-only, secondary pages, and reduced keyboard viewport. Screenshots: ${screenshots}`);
  } finally {
    socket?.close(); child.kill(); server.closeAllConnections(); server.close();
    if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith("cassianslog-screen-browser-")) { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Browser locks can be reclaimed by OS temp cleanup. */ } }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

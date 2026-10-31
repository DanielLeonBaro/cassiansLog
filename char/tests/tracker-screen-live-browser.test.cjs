// Live 2.1/2.2 tracker integration in Chromium; shared runtime, real storage, and permissions.
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
  const account = { preferences: { version: 1, density: "comfortable", pageDensity: {}, sidebarCollapsed: true, trackerStyles: { character: "v5", npc: "v4" } }, settings: { characterSheetStyle: "v1", characterSheetStyleOverrides: {}, sections: {}, openWrites: true }, gets: 0, puts: [], styleWrites: 0, holdPut: false, failPut: false };
  const campaign = { id: "campaign-breugaire", slug: "aotr", name: "Authenticated test campaign", joined: true, role: "admin" };
  const server = http.createServer((request, response) => {
    let relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).slice(1);
    if (request.headers.host?.startsWith("tracker.test:") && relative.startsWith("api/")) {
      const send = (body, status = 200) => { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(body)); };
      const read = (accept) => { let body = ""; request.on("data", (chunk) => { body += chunk; }); request.on("end", () => accept(JSON.parse(body))); };
      if (relative === "api/auth/session") { send({ user: { id: "screen-account-user", email: "screen@example.test", roles: ["admin", "characters"], isPrimaryAdmin: true, themePreference: { themeId: "dark" } } }); return; }
      if (relative === "api/auth/ui-preferences") {
        if (request.method === "GET") { account.gets += 1; send({ preferences: account.preferences }); return; }
        read((preferences) => {
          account.puts.push(preferences);
          const finish = () => { if (account.failPut) send({ error: "Preference storage temporarily unavailable." }, 503); else { account.preferences = preferences; send({ ok: true, preferences }); } };
          if (account.holdPut) account.finishPut = finish; else setTimeout(finish, 100);
        });
        return;
      }
      if (relative === "api/campaigns") { send({ campaigns: [campaign] }); return; }
      if (relative === "api/campaigns/aotr") { send({ campaign }); return; }
      if (relative === "api/campaigns/aotr/settings") { send(account.settings); return; }
      if (relative === "api/campaigns/aotr/characters/cassian") {
        if (request.method === "PUT") read(({ document }) => { account.document = document; send({ ok: true }); });
        else send({ document: account.document, canEdit: true, canManage: account.canManage !== false });
        return;
      }
      if (relative === "api/campaigns/aotr/characters/cassian/style") { read(({ style }) => { account.styleWrites += 1; account.settings.characterSheetStyleOverrides.cassian = style; send({ ok: true, style }); }); return; }
      if (relative === "api/campaigns/aotr/characters/cassian/state") { send({ value: null }); return; }
      if (relative === "api/campaigns/aotr/characters/cassian/notes") { send({ value: [] }); return; }
      if (relative === "api/themes") { send({ themes: account.themes, storageAvailable: false }); return; }
    }
    if (relative.startsWith("api/")) { response.writeHead(404); response.end("{}"); return; }
    if (relative === "char/tracker") relative = "char/tracker.html";
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cassianslog-screen-live-"));
  const child = spawn(browserPath, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--no-proxy-server", "--host-resolver-rules=MAP tracker.test 127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket;
  try {
    const activePort = path.join(profile, "DevToolsActivePort");
    await eventually(() => fs.existsSync(activePort), "Chromium debugging did not start");
    const debugPort = fs.readFileSync(activePort, "utf8").split("\n")[0];
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(5000) })).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error("Debugger socket timed out")), 10000); socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }); socket.addEventListener("error", reject); });
    let sequence = 0, openedDialog; const pending = new Map(), errors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === "Page.javascriptDialogOpening") openedDialog = message.params;
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error(`Debugger timed out: ${method}`)); }, 15000); pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
    const execute = async (body) => {
      const result = await command("Runtime.evaluate", { expression: `(async () => {${body}})()`, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await command("Runtime.enable"); await command("Page.enable");

    const { previewDocument } = await import("./previews/fixtures.js");
    const hero = { ...JSON.parse(fs.readFileSync("char/cassian/character.json", "utf8")), ...previewDocument("caster"), id: "cassian", name: "Live Screen Hero" };
    hero.actions = previewDocument("fighter").actions;
    hero.resources.push(...previewDocument("fighter").resources);
    hero.inventory = [{ id: "rope", name: "Rope", quantity: 1, wearable: 1 }, { id: "wand", instanceId: "wand-1", name: "Wand", quantity: 1, automatic: true, charges: { current: 2, max: 3, reset: "long" }, canEquip: true, canAttune: true, equipped: false, attuned: false }];
    hero.trackers = [{id:"torch",name:"Torch",active:false}];
    hero.portrait = "shared/assets/bat.ico";
    account.document = hero;
    account.themes = (await import("../../shared/gc/theme-catalog.js")).BUILT_IN_THEMES;
    const seed = `if(location.hostname==="127.0.0.1"&&!localStorage.getItem("screen-live-seeded")) {
      localStorage.setItem("screen-live-seeded","yes");
      localStorage.setItem("cassianslog-local-user-v1","localhost-admin");
      localStorage.setItem("cassianslog-last-campaign-v1:localhost-admin",JSON.stringify({id:"campaign-breugaire",slug:"aotr"}));
      localStorage.setItem("dnd-characters:campaign:aotr",JSON.stringify({cassian:${JSON.stringify(hero)}}));
      localStorage.setItem("cassianslog-runtime-settings:campaign:aotr",JSON.stringify({characterSheetStyle:"v6",sections:{},openWrites:true}));
      localStorage.setItem("cassianslog-ui-preferences:localhost-admin",JSON.stringify({preferences:{version:1,density:"comfortable",pageDensity:{},sidebarCollapsed:true,trackerStyles:{character:"v2.1",npc:"v2.1"}},pending:false}));
    }`;
    await command("Page.addScriptToEvaluateOnNewDocument", { source: seed });
    const navigate = async (route="/c/aotr/char/cassian/", style="v2.1", reader=false) => {
      await command("Page.navigate",{url:`http://127.0.0.1:${port}${route}`});
      await eventually(()=>execute(`return document.documentElement.dataset.characterSheetStyle===${JSON.stringify(style)} && Boolean(document.querySelector("#tracker-screen .tracker-option, #tracker-screen .tracker-ability")) && ${reader?'document.body.dataset.characterCanEdit==="false"':'Boolean(document.getElementById("edit-character-toggle"))'};`),`Live ${style} tracker did not render`);
    };
    const click=async(selector)=>execute(`const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error("Missing "+${JSON.stringify(selector)});n.click();return true;`);
    const pointerClick=async(selector)=>{
      const point=await execute(`const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error("Missing "+${JSON.stringify(selector)});const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!n.contains(document.elementFromPoint(x,y)))throw Error("Blocked "+${JSON.stringify(selector)});return {x,y};`);
      await command("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...point});
      await command("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...point});
    };
    const menu=async(commandName)=>{await click('#tracker-screen [data-command="menu"]');await click(`#tracker-screen [${commandName === "resources" ? "data-page" : "data-command"}="${commandName}"]`);};
    const go=async(page)=>execute(`const b=document.createElement("button");b.dataset.page=${JSON.stringify(page)};document.getElementById("tracker-screen").append(b);b.click();b.remove();return true;`);
    const setStyle=async(style,kind="character")=>execute(`const key="cassianslog-ui-preferences:localhost-admin",record=JSON.parse(localStorage.getItem(key));record.preferences.trackerStyles[${JSON.stringify(kind)}]=${JSON.stringify(style)};localStorage.setItem(key,JSON.stringify(record));return true;`);
    const chooseStyle=async(style,kind="character")=>execute(`const select=document.querySelector('[data-gc-tracker-style="${kind}"]');select.value=${JSON.stringify(style)};select.dispatchEvent(new Event("change",{bubbles:true}));return true;`);
    await command("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await navigate();
    assert.equal(await execute('const header=document.querySelector("[data-site-header]"),tracker=document.getElementById("tracker-screen"),skip=document.querySelector(".gc-skip-link");return header.getBoundingClientRect().height>0&&tracker.getBoundingClientRect().top>=header.getBoundingClientRect().bottom&&getComputedStyle(tracker).position!=="fixed"&&getComputedStyle(tracker).backgroundColor==="rgba(0, 0, 0, 0)"&&skip.hash==="#tracker-content"&&skip.pathname===location.pathname;'),true,"Tracker uses the visible site navbar and transparent workspace canvas");
    await pointerClick('#site-pages-menu-button');
    assert.equal(await execute('return document.documentElement.dataset.navOpen==="true"&&document.getElementById("tracker-screen").inert&&document.getElementById("site-pages-menu").getAttribute("aria-modal")==="true";'),true,"Mobile site navigation opens above the tracker");
    await command("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await command("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    assert.equal(await execute('return document.documentElement.dataset.navOpen==="false"&&!document.getElementById("tracker-screen").inert&&document.activeElement.id==="site-pages-menu-button";'),true,"Closing site navigation restores tracker access and keyboard focus");
    await execute('document.querySelector(".gc-skip-link").click();return true;');
    assert.equal(await execute('return document.activeElement.id==="tracker-content";'),true,"Skip to content focuses the visible tracker");
    await pointerClick('#theme-toggle');
    assert.equal(await execute('return !document.getElementById("theme-dialog").classList.contains("hidden");'),true,"Site navbar opens Appearance above the tracker");
    await command("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await command("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    assert.equal(await execute('return document.getElementById("theme-dialog").classList.contains("hidden");'),true,"Appearance closes with the keyboard");
    await execute('window.hotSwitchDocument=character;document.querySelector("#tracker-screen #tracker-search").value="wind";document.querySelector("#tracker-screen #tracker-search").dispatchEvent(new Event("input",{bubbles:true}));return true;');
    await pointerClick('#tracker-screen [data-command="switch-view"]');
    assert.equal(await execute('const prefs=JSON.parse(localStorage.getItem("cassianslog-ui-preferences:localhost-admin")).preferences;return character===hotSwitchDocument&&document.documentElement.dataset.characterSheetStyle==="v2.2"&&document.querySelector("#tracker-screen [data-page=actions]").getAttribute("aria-selected")==="true"&&document.querySelector("#tracker-screen #tracker-search").value==="wind"&&prefs.trackerStyles.character==="v2.2"&&prefs.trackerStyles.npc==="v2.1";'),true,"Hot switch is immediate, retains the engine, and saves only the current entity kind");
    await navigate(undefined,"v2.2");
    await pointerClick('#tracker-screen [data-command="switch-view"]');
    assert.equal(await execute('return document.documentElement.dataset.characterSheetStyle==="v2.1"&&Boolean(document.getElementById("tracker-tab-checks"));'),true,"Saved view survives refresh and switches back without reloading");
    await go("play");
    assert.equal(await execute('return Boolean(document.querySelector("#tracker-screen .tracker-portrait"))&&document.querySelector("#tracker-screen .tracker-combat-metrics").textContent.includes("Fly")&&document.querySelector("#tracker-screen .tracker-combat-senses").textContent.includes("Darkvision");'),true,"Play exposes the portrait, extra movement, and senses");
    const screenshots = path.resolve(".cloudflare/previews/tracker-2x-live"); fs.mkdirSync(screenshots,{recursive:true});
    fs.writeFileSync(path.join(screenshots,"v2.1-390.png"),Buffer.from((await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})).data,"base64"));
    assert.equal(await execute('return [...document.querySelectorAll("#tracker-screen .tracker-option")].slice(0,3).every(n=>n.getBoundingClientRect().bottom<=document.querySelector("#tracker-screen .tracker-tabs").getBoundingClientRect().top);'),true,"Three live Base rows fit 390x844");
    assert.deepEqual(errors,[],"Live tracker initialization must not throw");
    assert.equal(await execute('return document.querySelector("#tracker-screen .tracker-header").getBoundingClientRect().height===56 && document.querySelector("[data-tracker-legacy]").hidden && !document.querySelector("#tracker-screen dialog").open;'),true);
    await click('[data-use="actions:second-wind"]');await click('#tracker-screen [data-command="close-dialog"]');
    assert.equal(await execute('return character.actions.find(i=>i.id==="second-wind").uses.current===1;'),true,"Cancel spends nothing");
    await click('[data-use="actions:sweep"]');
    assert.equal(await execute('const b=document.querySelector("#tracker-screen [data-command=confirm-use]");b.click();b.click();return character.resources.find(i=>i.id==="superiority").uses.current===2;'),true,"Duplicate confirmation cannot spend twice");
    await menu("turn");
    assert.equal(await execute('return document.querySelector("#tracker-screen [data-turn=action]").getAttribute("aria-pressed")==="true";'),true);
    await click('#tracker-screen [data-command="start-turn"]');await click('#tracker-screen [data-command="close-dialog"]');
    await click('#tracker-screen .tracker-option [data-roll-formula]');
    assert.equal(await execute('return !document.getElementById("dice-roller-dialog").classList.contains("hidden")&&document.querySelectorAll("#dice-history-list li").length===1;'),true,"Roll uses shared history exactly once");await click('#dice-roller-close');
    await menu("turn");assert.equal(await execute('return document.querySelector("#tracker-screen [data-turn=action]").getAttribute("aria-pressed")==="false";'),true);await click('#tracker-screen [data-command="close-dialog"]');
    await click('[data-use="spells:missile"]');
    await execute('const s=document.querySelector("#tracker-screen [data-use-option]");s.value="slot:level-3";s.dispatchEvent(new Event("change",{bubbles:true}));return true;');await click('#tracker-screen [data-command="confirm-use"]');
    assert.equal(await execute('return character.spellcasting.slots.find(i=>i.level===3).current===0;'),true,"Upcast spends selected live slot");
    await click('[data-use="spells:web"]');await click('#tracker-screen [data-command="confirm-use"]');
    assert.equal(await execute('return character.concentration.name==="Web";'),true);
    await go("inventory");await click('[data-detail="inventory:wand-1"]');await click('#tracker-screen [data-pin="inventory:wand-1"]');await click('#tracker-screen [data-command="close-dialog"]');
    await go("play");assert.equal(await execute('return document.querySelectorAll("#tracker-screen [data-record=\\"inventory:wand-1\\"]").length===1;'),true);
    await click('[data-use="inventory:wand-1"]');await click('#tracker-screen [data-command="confirm-use"]');
    assert.equal(await execute('return document.querySelector("#tracker-screen [data-record=\\"inventory:wand-1\\"]").textContent.includes("1/3");'),true,"Charges use existing inventory runtime");
    await menu("resources");await click('#tracker-screen [data-adjust="slot"][data-delta="1"]');
    await go("notes");await execute('const f=document.querySelector("#tracker-screen [data-note-form]");f.elements.title.value="Live note";f.elements.body.value="**Saved** through existing notes.";f.requestSubmit();return true;');
    assert.equal(await execute('return document.querySelector("#tracker-screen .tracker-notes strong").textContent==="Saved"&&JSON.parse(localStorage.getItem("dnd-cassian-notes:campaign:aotr")).length===1;'),true,"Notes reuse existing storage and Markdown");
    await go("play");await menu("rest");await click('#tracker-screen [data-rest="long"]');await click('#tracker-screen [data-confirm-rest="long"]');
    assert.equal(await execute('return character.hp.current===character.hp.max&&character.spellcasting.slots.every(s=>s.current===s.max)&&character.resources.find(i=>i.id==="superiority").uses.current===4;'),true,"Rest uses live recovery controller");
    await menu("edit");assert.equal(await execute('return !document.getElementById("character-editor").classList.contains("hidden")&&Boolean(document.getElementById("editor-export-json"));'),true,"Full editor and exports remain reachable");await click('#editor-cancel');
    await navigate();
    assert.equal(await execute('return Boolean(document.querySelector("#tracker-screen [data-record=\\"inventory:wand-1\\"]"))&&document.querySelector("#tracker-screen [data-record=\\"inventory:wand-1\\"]").textContent.includes("1/3");'),true,"Pins and inventory runtime survive refresh");
    await go("notes");assert.equal(await execute('return document.querySelector("#tracker-screen .tracker-notes").textContent.includes("Live note");'),true);
    await setStyle("v2.2");await navigate(undefined,"v2.2");
    await menu("appearance");
    await execute('window.appearanceDocument=character;return true;');
    await chooseStyle("v2.1");
    assert.equal(await execute('return document.documentElement.dataset.characterSheetStyle==="v2.1"&&document.querySelector("#tracker-screen").dataset.variant==="v2.1"&&Boolean(document.getElementById("tracker-tab-checks"))&&appearanceDocument===character;'),true,"Appearance switches 2.x immediately through the same live engine");
    await chooseStyle("v2.2","npc");
    assert.equal(await execute('return document.querySelector("#tracker-screen").dataset.variant==="v2.1";'),true,"Choosing the NPC layout must not switch the character tracker");
    await chooseStyle("campaign");
    await eventually(()=>execute('return document.documentElement.dataset.characterSheetStyle==="v6"&&Boolean(document.getElementById("edit-character-toggle"))&&!document.getElementById("tracker-screen");'),"Selecting Follow campaign must apply the inherited layout without an extra click");
    for(const style of ["v5","v2.1","v1","v2.2"]){
      if(await execute('return Boolean(document.getElementById("tracker-screen"));'))await menu("appearance");else await click('#theme-toggle');
      await chooseStyle(style);
      await eventually(()=>execute(`return document.documentElement.dataset.characterSheetStyle===${JSON.stringify(style)}&&Boolean(document.getElementById("edit-character-toggle"))&&${style.startsWith("v2.")?'Boolean(document.querySelector("#tracker-screen .tracker-option, #tracker-screen .tracker-ability"))':'!document.getElementById("tracker-screen")'};`),`Selecting ${style} must apply automatically`);
      assert.equal(await execute(`return JSON.parse(localStorage.getItem("cassianslog-ui-preferences:localhost-admin")).preferences.trackerStyles.character===${JSON.stringify(style)};`),true,"The selected personal layout survives its automatic reload");
      if(style==="v5")assert.equal(await execute('return Boolean(document.querySelector("#v4-sheet[data-gc-tracker=v5]"));'),true,"Start from the V5 layout shown in the report");
      if(style==="v1")assert.equal(await execute('return !document.getElementById("v4-sheet")&&!document.getElementById("tracker-tab-play");'),true,"V1 must render its own layout rather than retaining V5 or 2.x");
    }
    for(const width of [320,390,768,1024,1280]){
      await command("Emulation.setDeviceMetricsOverride",{width,height:844,deviceScaleFactor:1,mobile:width<1024});
      for(const sidebarCollapsed of [false,true]) for(const density of ["comfortable","compact"]) for(const theme of ["cassians-classic","evil-cassian"]) {
        await execute(`const {applyTheme}=await import("/shared/js/theme.js");applyTheme(${JSON.stringify(theme)},{persist:false,reversed:false,backgroundId:"default-squared"});document.documentElement.dataset.density=${JSON.stringify(density)};document.documentElement.dataset.sidebarCollapsed=${JSON.stringify(String(sidebarCollapsed))};await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true;`);
        await go("actions");
        assert.equal(await execute('const root=document.getElementById("tracker-screen"),header=document.querySelector("[data-site-header]").getBoundingClientRect(),bounds=root.getBoundingClientRect(),sidebar=document.getElementById("site-pages-menu").getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&root.querySelector(".tracker-main").scrollWidth<=root.querySelector(".tracker-main").clientWidth+1&&bounds.top>=header.bottom-1&&bounds.bottom<=innerHeight+1&&bounds.width<=1200&&getComputedStyle(document.body).backgroundImage!=="none"&&getComputedStyle(root).backgroundColor==="rgba(0, 0, 0, 0)"&&(innerWidth<1024||bounds.left>=sidebar.right);'),true,`Workspace geometry and background: ${width}/${sidebarCollapsed}/${density}/${theme}`);
      }
      await execute('const {applyTheme}=await import("/shared/js/theme.js");applyTheme("cassians-classic",{persist:false,reversed:false});document.documentElement.dataset.density="comfortable";document.documentElement.dataset.sidebarCollapsed="true";await new Promise(resolve=>setTimeout(resolve,200));return true;');
      for(const page of ["sheet","actions","spells","inventory","more","resources","preparation","features","extras","notes","profile","trackers"]){
        await go(page);
        if(["sheet","actions"].includes(page)) fs.writeFileSync(path.join(screenshots,`v2.2-${page}-${width}.png`),Buffer.from((await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})).data,"base64"));
        assert.equal(await execute('return document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector("#tracker-screen .tracker-main").scrollWidth<=document.querySelector("#tracker-screen .tracker-main").clientWidth+1;'),true,`No overflow: ${width}/${page}`);
        assert.deepEqual(await execute('return [...document.querySelectorAll("#tracker-screen button")].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<43.9).map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,class:n.className}));'),[],`44px touch controls: ${width}/${page}`);
      }
      await menu("edit");
      await eventually(()=>execute('return document.querySelector("#character-editor [role=tablist]").classList.contains("gc-tabs");'),"Editor tabs must be checked after shared enhancement");
      if(width>=1024){
        assert.equal(await execute('const nav=document.querySelector("#character-editor [role=tablist]"),bounds=nav.getBoundingClientRect(),rows=[...nav.querySelectorAll("[role=tab]")].map(n=>n.getBoundingClientRect());return getComputedStyle(nav).display!=="none"&&rows.every((r,i)=>Math.abs(r.left-bounds.left)<1&&r.right<=bounds.right+1&&(!i||r.top>=rows[i-1].bottom));'),true,`Editor sections stack vertically: ${width}`);
        await pointerClick('#editor-tab-basics');
        await command("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowDown",code:"ArrowDown",windowsVirtualKeyCode:40});
        await command("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowDown",code:"ArrowDown",windowsVirtualKeyCode:40});
        assert.equal(await execute('return document.activeElement.id==="editor-tab-combat"&&document.activeElement.getAttribute("aria-selected")==="true"&&!document.getElementById("editor-panel-combat").hidden;'),true,"Vertical section navigation keeps arrow-key focus");
      }else{
        assert.equal(await execute('return getComputedStyle(document.querySelector("#character-editor [role=tablist]")).display==="none"&&document.getElementById("editor-mobile-section").getClientRects().length>0;'),true,`Mobile editor uses its vertical section menu: ${width}`);
        await execute('const select=document.getElementById("editor-mobile-section");select.value="combat";select.dispatchEvent(new Event("change",{bubbles:true}));return true;');
        assert.equal(await execute('return !document.getElementById("editor-panel-combat").hidden;'),true,"Mobile section selection opens the matching panel");
      }
      if([390,1280].includes(width))fs.writeFileSync(path.join(screenshots,`editor-sections-${width}.png`),Buffer.from((await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})).data,"base64"));
      await click('#editor-cancel');
    }
    await execute(`const npc=${JSON.stringify(hero)};npc.id="screen-npc";npc.name="Live NPC";npc.background="HIDDEN NPC BACKGROUND";npc.portrait="/HIDDEN-NPC-PORTRAIT.png";localStorage.setItem("dnd-npcs:campaign:aotr",JSON.stringify({"screen-npc":{document:npc,playerVisible:true,visibility:{$default:true,background:false,portrait:false,fly:false,darkvision:false,passivePerception:false}}}));localStorage.setItem("dnd-npc-screen-npc-state:campaign:aotr",JSON.stringify({conditions:["HIDDEN NPC RUNTIME"]}));return true;`);
    await setStyle("v2.2","npc");await navigate("/c/aotr/npc/screen-npc/","v2.2");
    await execute('localStorage.setItem("cassianslog-local-user-v1","localhost-player-01");localStorage.setItem("cassianslog-ui-preferences:localhost-player-01",JSON.stringify({preferences:{version:1,trackerStyles:{character:"v2.2",npc:"v2.2"}},pending:false}));return true;');
    await navigate("/c/aotr/npc/screen-npc/","v2.2",true);await go("actions");
    assert.equal(await execute('const before=JSON.stringify(character);document.querySelector("#tracker-screen [data-use]").dispatchEvent(new MouseEvent("click",{bubbles:true}));return before===JSON.stringify(character)&&!before.includes("HIDDEN NPC")&&!document.getElementById("tracker-screen").textContent.includes("HIDDEN NPC");'),true,"Player projection protects NPC values/runtime");
    assert.equal(await execute('return !document.querySelector("#tracker-screen .tracker-portrait").src.includes("HIDDEN")&&!document.querySelector("#tracker-screen .tracker-combat-metrics").textContent.includes("Fly")&&!performance.getEntriesByType("resource").some(entry=>entry.name.includes("HIDDEN-NPC-PORTRAIT"));'),true,"Combat info never fetches or displays a hidden NPC portrait or movement");
    await menu("turn");assert.equal(await execute('return [...document.querySelectorAll("#tracker-screen [data-turn]")].every(n=>n.disabled&&n.getAttribute("aria-pressed")==="false");'),true);await click('#tracker-screen [data-command="close-dialog"]');
    await click('#tracker-screen [data-command="switch-view"]');
    assert.equal(await execute('const p=JSON.parse(localStorage.getItem("cassianslog-ui-preferences:localhost-player-01")).preferences;return p.trackerStyles.npc==="v2.1"&&p.trackerStyles.character==="v2.2"&&document.body.dataset.characterCanEdit==="false";'),true,"Read-only NPC switch saves personal appearance without changing character preference");
    await execute('localStorage.setItem("cassianslog-local-user-v1","localhost-admin");return true;');
    for(const style of ["v1","v2","v3","v4","v5","v6"]){
      await setStyle(style);await command("Page.navigate",{url:`http://127.0.0.1:${port}/c/aotr/char/cassian/`});
      await eventually(()=>execute(`return document.documentElement.dataset.characterSheetStyle===${JSON.stringify(style)}&&Boolean(document.getElementById("edit-character-toggle"))&&!document.getElementById("tracker-screen");`),`Existing ${style} must remain available`);
    }
    // Exercise authenticated hydration and saving, outside the localhost bypass.
    const accountReady = (style) => eventually(()=>execute(`return location.hostname==="tracker.test"&&document.documentElement.dataset.characterSheetStyle===${JSON.stringify(style)}&&Boolean(document.getElementById("edit-character-toggle"))&&${style.startsWith("v2.")?'Boolean(document.querySelector("#tracker-screen .tracker-option, #tracker-screen .tracker-ability"))':'!document.getElementById("tracker-screen")'};`),`Authenticated ${style} tracker did not render`);
    await command("Page.navigate",{url:`http://tracker.test:${port}/c/aotr/char/cassian/`});await accountReady("v5");
    assert.ok(account.gets>0,"Cold V5 must hydrate preferences through the account API");
    assert.equal(await execute('return Boolean(document.querySelector("#v4-sheet[data-gc-tracker=v5]"))&&!localStorage.getItem("screen-live-seeded");'),true,"Authenticated test starts in actual V5 without local fixture preference seeding");
    await pointerClick('#theme-toggle');account.holdPut=true;await chooseStyle("v2.1");
    await eventually(()=>account.finishPut,"Authenticated layout must send its preference PUT");
    assert.equal(account.preferences.trackerStyles.character,"v5","Delayed PUT has not saved the new account choice yet");
    assert.equal(await execute('const p=JSON.parse(localStorage.getItem("cassianslog-ui-preferences:screen-account-user"));return document.documentElement.dataset.characterSheetStyle==="v5"&&p.pending&&p.preferences.trackerStyles.character==="v2.1";'),true,"Legacy tracker waits for saving while retaining the pending choice locally");
    account.holdPut=false;account.finishPut();await accountReady("v2.1");
    assert.deepEqual(account.preferences.trackerStyles,{character:"v2.1",npc:"v4"},"Authenticated switch saves only the character layout");
    const beforeRefreshGets=account.gets;await command("Page.reload");await eventually(()=>account.gets>beforeRefreshGets,"Refresh must read the saved account preference again");await accountReady("v2.1");
    await menu("appearance");await chooseStyle("v1");await accountReady("v1");
    assert.equal(account.preferences.trackerStyles.character,"v1","2.1 to V1 applies through the same authenticated save and reload path");
    assert.equal(await execute('return !document.getElementById("v4-sheet");'),true,"Authenticated V1 cannot retain the previous V5 layout");
    const beforeV1RefreshGets=account.gets;await command("Page.reload");await eventually(()=>account.gets>beforeV1RefreshGets,"V1 refresh must hydrate the saved preference");await accountReady("v1");
    account.failPut=true;await pointerClick('#theme-toggle');await chooseStyle("v2.2");await accountReady("v2.2");
    assert.equal(account.preferences.trackerStyles.character,"v1","A failed save cannot change the stored account choice");
    assert.equal(await execute('const p=JSON.parse(localStorage.getItem("cassianslog-ui-preferences:screen-account-user"));return p.pending&&p.preferences.trackerStyles.character==="v2.2";'),true,"Failed authenticated save still applies the pending local layout after reload");
    account.failPut=false;await menu("appearance");await click('[data-gc-retry]');
    await eventually(()=>execute('return !JSON.parse(localStorage.getItem("cassianslog-ui-preferences:screen-account-user")).pending;'),"Authenticated pending layout must retry successfully");
    assert.deepEqual(account.preferences.trackerStyles,{character:"v2.2",npc:"v4"},"Retry syncs the pending choice without changing the other entity kind");
    // Regression: the reported control is Edit sheet > Advanced, with personal V5 over campaign V1.
    await click('[data-close-theme]');await menu("appearance");await chooseStyle("v5");await accountReady("v5");
    await click('#edit-character-toggle');await click('#editor-tab-advanced');
    assert.equal(await execute('return document.getElementById("editor-character-sheet-style").value;'),"v5","Advanced must show the active personal V5, rather than the hidden campaign V1");
    const chooseEditorStyle=async(style)=>execute(`const select=document.getElementById("editor-character-sheet-style");select.value=${JSON.stringify(style)};select.dispatchEvent(new Event("change",{bubbles:true}));return true;`);
    const beforeEditorPuts=account.puts.length;
    await chooseEditorStyle("v2.1");openedDialog=null;const discard=click('#editor-cancel');
    await eventually(()=>openedDialog,"Cancelling the layout draft must offer discard confirmation");
    assert.equal(openedDialog.type,"confirm");await command("Page.handleJavaScriptDialog",{accept:true});await discard;
    assert.deepEqual(account.preferences.trackerStyles,{character:"v5",npc:"v4"},"Cancelling an editor layout change cannot change personal preferences");
    assert.deepEqual(account.settings.characterSheetStyleOverrides,{},"Cancelling cannot change the shared entity layout");
    await click('#edit-character-toggle');await execute('const input=document.querySelector("#character-editor [data-path=name]");input.value="Saved without layout change";input.dispatchEvent(new Event("input",{bubbles:true}));window.ordinaryEditorStayed=true;return true;');await click('#editor-save');
    await eventually(()=>account.document.name==="Saved without layout change","Ordinary editor save must persist the character document");
    assert.equal(account.puts.length,beforeEditorPuts,"Ordinary editor save must not write layout preferences");
    assert.deepEqual(account.settings.characterSheetStyleOverrides,{},"Ordinary save must not overwrite a campaign layout with personal V5");
    assert.equal(await execute('return window.ordinaryEditorStayed&&document.documentElement.dataset.characterSheetStyle==="v5";'),true,"Ordinary editor save must retain the current tracker");
    await click('#edit-character-toggle');await click('#editor-tab-advanced');await chooseEditorStyle("v2.1");await click('#editor-save');await accountReady("v2.1");
    assert.equal(account.settings.characterSheetStyle,"v1","Editor layout choice must not alter the shared campaign default");
    assert.deepEqual(account.settings.characterSheetStyleOverrides,{},"Editor layout choice must not alter shared entity settings");
    assert.deepEqual(account.preferences.trackerStyles,{character:"v2.1",npc:"v4"},"Explicit editor change applies the personal layout, without changing NPC preference");
    await menu("edit");await click('#editor-tab-advanced');
    assert.equal(await execute('return document.getElementById("editor-character-sheet-style").value;'),"v2.1","Advanced reflects the selected view after automatic reload");
    await chooseEditorStyle("v1");await click('#editor-save');await accountReady("v1");
    assert.deepEqual(account.settings.characterSheetStyleOverrides,{},"Explicit personal V1 must not write a shared entity override");
    assert.deepEqual(account.preferences.trackerStyles,{character:"v1",npc:"v4"},"Editor V1 selection replaces the stale personal V5 preference");
    assert.equal(account.styleWrites,0,"Advanced personal layout must never call the shared style endpoint");
    account.settings.characterSheetStyle="v6";
    const afterEditorGets=account.gets;await command("Page.reload");await eventually(()=>account.gets>afterEditorGets,"Editor preference must hydrate after another refresh");await accountReady("v1");
    assert.equal(await execute('return document.documentElement.dataset.campaignSheetStyle==="v6"&&document.documentElement.dataset.characterSheetStyle==="v1";'),true,"Later admin/DM settings cannot displace the layout selected in Edit sheet");
    account.canManage=false;const beforeAssignedGets=account.gets;await command("Page.reload");await eventually(()=>account.gets>beforeAssignedGets,"Assigned editor must hydrate its existing personal layout");await accountReady("v1");
    await click('#edit-character-toggle');await click('#editor-tab-advanced');
    assert.equal(await execute('const select=document.getElementById("editor-character-sheet-style");return document.body.dataset.characterCanEdit==="true"&&document.body.dataset.characterCanManage==="false"&&select.getClientRects().length>0&&select.closest("label").textContent.includes("My layout")&&document.getElementById("editor-id").readOnly&&!document.querySelector("[data-v1-section-list]");'),true,"Editable non-managers can choose their personal layout while management controls stay restricted");
    await chooseEditorStyle("v2.2");await click('#editor-save');await accountReady("v2.2");
    assert.deepEqual(account.preferences.trackerStyles,{character:"v2.2",npc:"v4"},"Assigned editor changes only its personal character layout");
    assert.equal(account.styleWrites,0,"Assigned personal layout changes never call the shared style endpoint");
    assert.equal(account.settings.characterSheetStyle,"v6");assert.deepEqual(account.settings.characterSheetStyleOverrides,{});
    await command("Page.navigate",{url:`http://127.0.0.1:${port}/campaigns/`});
    await eventually(()=>execute('return Boolean(document.querySelector(".gc-header .gc-header-inner"))&&Boolean(document.querySelector(".gc-panel"));'),"Campaign workspace reference must render");
    fs.writeFileSync(path.join(screenshots,"workspace-reference-1280.png"),Buffer.from((await command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false})).data,"base64"));
    assert.deepEqual(errors,[],"Live integration must not throw");
    console.log("Live 2.1/2.2 checks passed: navbar/mobile navigation, skip-link focus, Appearance, 40 theme/density/sidebar/viewport combinations, backgrounds, shared use/cast/charges, double confirmation, rolls/history, HP/slots/rests, notes, editor/exports, persistence, NPC projection/read-only, all utility pages, V1-V6 compatibility, authenticated layout hydration/save/reload/retry, and Advanced editor layout save/cancel/isolation.");
  } finally {
    socket?.close(); child.kill(); server.closeAllConnections(); server.close();
    // Browser-owned temporary profile may stay locked briefly after process exit.
    if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith("cassianslog-screen-live-")) {
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* OS temp cleanup can reclaim it. */ }
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

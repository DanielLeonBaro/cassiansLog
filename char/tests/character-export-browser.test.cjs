// Verifies real PDF downloads from current and legacy character editors in Chromium.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");
const root = path.resolve(__dirname, "../..");
async function eventually(check, message) {
  const end = Date.now() + 30000; let last;
  while (Date.now() < end) {
    try { const value = await check(); if (value) return value; } catch (error) { last = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`${message}${last ? `: ${last}` : ""}`);
}

(async () => {
  const browser = process.env.CHROMIUM || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
  if (!browser) throw Error("Set CHROMIUM to a Chrome/Edge executable.");
  const server = http.createServer((request, response) => {
    let relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).slice(1);
    if (relative.startsWith("api/")) { response.writeHead(404); response.end("{}"); return; }
    const campaignTracker = /^c\/aotr\/char\/cassian\/?$/.test(relative);
    if (campaignTracker) relative = "char/cassian/index.html";
    if (!relative || relative.endsWith("/")) relative += "index.html";
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    const type = ({ ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json", ".pdf": "application/pdf", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff" })[path.extname(file)] || "application/octet-stream";
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    response.end(campaignTracker ? fs.readFileSync(file, "utf8").replace(/<base href="[^"]+">/, '<base href="/">') : fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cassianslog-pdf-browser-"));
  const downloads = path.join(profile, "downloads"); fs.mkdirSync(downloads);
  const child = spawn(browser, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket, execute; const errors = [];
  try {
    const activePort = path.join(profile, "DevToolsActivePort");
    await eventually(() => fs.existsSync(activePort), "Chromium debugging did not start");
    const port = fs.readFileSync(activePort, "utf8").split("\n")[0];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(5000) })).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error("Debugger socket timed out")), 10000); socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }); socket.addEventListener("error", reject); });
    let sequence = 0; const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); } }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((argument) => argument.description || argument.value).join(" "));
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error(`Debugger timed out: ${method}`)); }, 15000); pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
    execute = async (source) => {
      const result = await command("Runtime.evaluate", { expression: `(async()=>{${source}})()`, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const click = async (selector) => {
      const point = await execute(`const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error("Missing control");node.scrollIntoView({block:"center"});const r=node.getBoundingClientRect();if(!r.width||!r.height)throw Error("Hidden control");return {x:r.x+r.width/2,y:r.y+r.height/2};`);
      await command("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    };
    await command("Runtime.enable"); await command("Page.enable");
    await command("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
    const hero = JSON.parse(fs.readFileSync(path.join(root, "char/cassian/character.json"), "utf8"));
    Object.assign(hero, { id: "cassian", name: "Saved PDF Hero", hp: { current: 30, max: 40, temp: 0 } });
    await command("Page.addScriptToEvaluateOnNewDocument", { source: `
      const style=new URL(location.href).searchParams.get("testStyle")||"v1";
      localStorage.setItem("cassianslog-local-user-v1","localhost-admin");
      localStorage.setItem("cassianslog-last-campaign-v1:localhost-admin",JSON.stringify({id:"campaign-breugaire",slug:"aotr"}));
      const hero=${JSON.stringify(hero)};
      if(style==="v2.2")hero.portrait="data:image/jpeg;base64,AQID";
      localStorage.setItem("dnd-characters:campaign:aotr",JSON.stringify({cassian:hero}));
      localStorage.setItem("dnd-cassian-state:campaign:aotr",JSON.stringify({hp:{current:17,temp:2}}));
      localStorage.setItem("cassianslog-runtime-settings:campaign:aotr",JSON.stringify({characterSheetStyle:style,sections:{},openWrites:true}));
      localStorage.setItem("cassianslog-ui-preferences:localhost-admin",JSON.stringify({preferences:{version:1,density:"comfortable",pageDensity:{},sidebarCollapsed:true,trackerStyles:{character:style,npc:"v1"}},pending:false}));
    ` });
    for (const style of ["v2.1", "v2.2", "v1"]) {
      await command("Page.navigate", { url: `${origin}/c/aotr/char/cassian/?testStyle=${style}` });
      await eventually(() => execute(`return document.documentElement.dataset.characterSheetStyle===${JSON.stringify(style)}&&Boolean(document.getElementById("edit-character-toggle"))&&window.character?.hp.current===17;`), `${style} tracker did not render with current HP`);
      if (style.startsWith("v2.")) { await click('[data-command="menu"]'); await click('[data-command="edit"]'); }
      else await click("#edit-character-toggle");
      const name = `Export ${style}`;
      await execute(`const input=document.querySelector('#character-editor [data-path="name"]');input.value=${JSON.stringify(name)};input.dispatchEvent(new Event("input",{bubbles:true}));return true;`);
      const file = path.join(downloads, `export-${style.replaceAll(".", "-")}.pdf`);
      await click("#editor-export-menu summary");
      if (style === "v1") {
        await execute('const original=window.fetch;window.fetch=(...args)=>{if(String(args[0]).includes("Form%20Fillable.pdf")){window.fetch=original;return Promise.resolve(new Response("",{status:503}));}return original(...args);};return true;');
        await click("#editor-export-pdf");
        await eventually(() => execute('return !document.getElementById("editor-export-pdf").disabled&&document.getElementById("editor-validation-status").textContent.includes("503");'), "Export error must be visible and retry enabled");
        assert.equal(fs.existsSync(file), false, "Failed export must not create a download");
        assert.match(errors.pop(), /Could not load the character sheet PDF \(503\)/);
      }
      await click("#editor-export-pdf");
      await eventually(() => fs.existsSync(file) && fs.statSync(file).size > 100000, `${style} PDF did not download`);
      await eventually(() => execute('return !document.getElementById("editor-export-pdf").disabled;'), `${style} export did not reset`);
      const pdf = await PDFDocument.load(fs.readFileSync(file)); const form = pdf.getForm();
      assert.equal(form.getTextField("CharacterName").getText(), name, `${style} exports unsaved name`);
      assert.equal(form.getTextField("HPCurrent").getText(), "17", `${style} exports current tracked HP`);
      assert.equal(form.getTextField("HPTemp").getText(), "2");
      assert.equal(form.getTextField("HPMax").getText(), "40");
      assert.equal(await execute('return window.character.name;'), hero.name, "Export must not save draft edits");
      assert.equal(await execute('return document.getElementById("editor-validation-status").textContent;'), "");
    }
    assert.deepEqual(errors, [], "PDF export must not report browser errors");
    console.log("Character PDF Chromium checks passed: real V2.1/V2.2/V1 downloads, unsaved edits, tracked HP, malformed portrait fallback, failure/retry, and unchanged saved character.");
  } catch (error) {
    const status = await execute?.('return document.getElementById("editor-validation-status")?.textContent;').catch(() => "unavailable");
    throw Error(`${error.message}\nEditor status: ${status}\nBrowser errors: ${errors.join("\n")}`, { cause: error });
  } finally {
    socket?.close(); child.kill(); server.closeAllConnections(); server.close();
    if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith("cassianslog-pdf-browser-")) {
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Browser may briefly retain its temporary profile. */ }
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

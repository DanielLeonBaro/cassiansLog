// Verifies static routes and colocated data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = process.cwd();
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  let relative = pathname.replace(/^\/+/, "");
  if (!relative || relative.endsWith("/")) relative += "index.html";
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200).end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ["/", "/admin/", "/char/", "/char/tracker.html", "/combat-loot/", "/compendium/", "/dm-screen/", "/music/", "/player-screen/", "/public-initiative/", "/wiki/"]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, `${route} should load over HTTP.`);
  }
  assert.match(await (await fetch(`${base}/`)).text(), /url=char\//);

  const catalog = await (await fetch(`${base}/char/catalog.json`)).json();
  for (const id of [...catalog.characters, "template"]) {
    assert.equal((await fetch(`${base}/char/${id}/`)).status, 200, `${id} route should load.`);
    const characterResponse = await fetch(`${base}/char/${id}/character.json`);
    assert.equal(characterResponse.status, 200, `${id} data should be colocated.`);
    const character = await characterResponse.json();
    assert.equal(character.id, id);
    assert.equal((await fetch(`${base}/${character.portrait}`)).status, 200, `${id} portrait should load.`);
  }

  for (const asset of [
    "/shared/assets/tailwind.css",
    "/shared/assets/icons/bootstrap-icons.css",
    "/shared/config/sections.json",
    "/compendium/data/manifest.json",
    "/wiki/data/pages.json",
  ]) {
    assert.equal((await fetch(`${base}${asset}`)).status, 200, `${asset} should load.`);
  }
  console.log("Static route and colocated data tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => server.close());

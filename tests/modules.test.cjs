const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pageShells = ["index.html", "compendium/index.html", "wiki/index.html", "char/tracker.html"];
for (const file of pageShells) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /<nav data-site-header><\/nav>/, `${file} must use the shared header`);
  assert.match(source, /<script type="module"/, `${file} must use a module entrypoint`);
}

for (const character of ["ally", "cassian", "elaria", "karma", "leon", "template"]) {
  const source = fs.readFileSync(`char/${character}/index.html`, "utf8");
  assert.match(source, /js\/entries\/character-page\.js/, `${character} must use the shared character loader`);
  assert.match(source, /type="module"/, `${character} loader must be a module`);
}

for (const file of [
  ...pageShells,
  "char/tracker.html",
  ...fs.readdirSync("js", { recursive: true })
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join("js", name)),
]) {
  assert.ok(!fs.readFileSync(file, "utf8").includes("onclick="), `${file} must not use inline click handlers`);
}

for (const name of fs.readdirSync("js/shared")) {
  const source = fs.readFileSync(path.join("js/shared", name), "utf8");
  assert.ok(!source.includes("/features/"), `shared/${name} must not import a feature`);
}

const characterLoader = fs.readFileSync("js/features/characters/page-loader.js", "utf8");
for (const key of ["dnd-characters", "dnd-new-character"]) assert.ok(characterLoader.includes(key));
const tracker = fs.readFileSync("js/script.js", "utf8");
assert.ok(tracker.includes("dnd-${CHARACTER_ID}-state"));
assert.ok(tracker.includes("dnd-${CHARACTER_ID}-notes"));
const trackerShell = fs.readFileSync("char/tracker.html", "utf8");
for (const id of ["rest-dialog", "confirm-rest", "cancel-rest", "rest-toast"])
  assert.ok(trackerShell.includes(`id="${id}"`), `tracker must include ${id}`);

for (const file of [
  "js/entries/wiki.js",
  "js/entries/compendium.js",
  "js/features/characters/index.js",
  "js/features/tracker/header.js",
]) {
  assert.ok(
    fs.readFileSync(file, "utf8").includes("initializeDiceRoller"),
    `${file} must mount the dice roller`,
  );
}

console.log("Module boundary and compatibility tests passed.");

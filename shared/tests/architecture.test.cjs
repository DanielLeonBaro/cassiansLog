const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const features = new Set(["char", "compendium", "wiki"]);
const removedRoots = ["data", "js", "scripts", "tests", "config", "bootstrap", "src", "dist", "stuffToParse"];

for (const directory of removedRoots) {
  assert.ok(!fs.existsSync(directory), `Obsolete top-level directory must be removed: ${directory}/`);
}

function javascriptFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { recursive: true })
    .filter((name) => /\.(?:c?js)$/.test(name))
    .map((name) => path.join(directory, name));
}

function targetRoot(file, specifier) {
  if (!specifier.startsWith(".")) return "external";
  const resolved = path.resolve(path.dirname(file), specifier);
  assert.ok(fs.existsSync(resolved), `${file} imports a missing module: ${specifier}`);
  return path.relative(root, resolved).split(path.sep)[0];
}

function imports(file) {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(/(?:from\s+|import\s*\(|require\s*\()(["'])([^"']+)\1/g)].map((match) => match[2]);
}

for (const feature of features) {
  for (const file of javascriptFiles(feature)) {
    for (const specifier of imports(file)) {
      const dependency = targetRoot(file, specifier);
      assert.ok(
        dependency === feature || dependency === "shared" || dependency === "external",
        `${file} must not import ${dependency}: ${specifier}`,
      );
    }
  }
}

for (const file of javascriptFiles("shared")) {
  for (const specifier of imports(file)) {
    const dependency = targetRoot(file, specifier);
    assert.ok(dependency === "shared" || dependency === "external", `${file} must remain feature-neutral: ${specifier}`);
  }
}

const allowedIntegrationEntrypoints = new Set([
  path.normalize("char/js/editor/extensions.js"),
  path.normalize("compendium/js/api.js"),
]);
for (const file of javascriptFiles("integrations")) {
  for (const specifier of imports(file)) {
    const resolved = path.relative(root, path.resolve(path.dirname(file), specifier));
    const dependency = resolved.split(path.sep)[0];
    if (features.has(dependency)) {
      assert.ok(allowedIntegrationEntrypoints.has(path.normalize(resolved)), `${file} imports a private feature module: ${specifier}`);
    } else {
      assert.ok(["integrations", "shared", "external"].includes(dependency), `${file} has an invalid dependency: ${specifier}`);
    }
  }
}

const rootHTML = fs.readFileSync("index.html", "utf8");
assert.match(rootHTML, /url=char\//, "The root page must redirect to /char/.");

for (const file of ["char/index.html", "char/tracker.html", "compendium/index.html", "wiki/index.html"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /<nav data-site-header><\/nav>/, `${file} must mount the shared header.`);
  assert.match(source, /<script type="module"/, `${file} must use a module entrypoint.`);
}

const catalog = JSON.parse(fs.readFileSync("char/catalog.json", "utf8"));
for (const character of [...catalog.characters, "template"]) {
  const directory = `char/${character}`;
  assert.ok(fs.existsSync(`${directory}/index.html`), `${character} must own its route.`);
  const data = JSON.parse(fs.readFileSync(`${directory}/character.json`, "utf8"));
  assert.equal(typeof data.name, "string", `${character} must own valid character JSON.`);
  assert.ok(!data.portrait.startsWith("data/"), `${character} must not reference legacy data paths.`);
}

const characterLoader = fs.readFileSync("char/js/page-loader.js", "utf8");
for (const key of ["dnd-characters", "dnd-new-character"]) assert.ok(characterLoader.includes(key));
const trackerState = fs.readFileSync("char/js/tracker/state.js", "utf8");
const trackerNotes = fs.readFileSync("char/js/tracker/notes.js", "utf8");
assert.ok(trackerState.includes('dnd-${character.id || "character"}-state'));
assert.ok(trackerNotes.includes('dnd-${characterId || "character"}-notes'));

for (const file of [
  "wiki/js/entry.js",
  "compendium/js/entry.js",
  "char/js/archive/index.js",
  "char/js/tracker/header.js",
]) {
  assert.ok(fs.readFileSync(file, "utf8").includes("initializeDiceRoller"), `${file} must mount the shared dice roller.`);
}

console.log("Vertical module boundaries and compatibility tests passed.");

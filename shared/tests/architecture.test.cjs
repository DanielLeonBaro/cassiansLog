// Verifies architecture and module boundaries.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const features = new Set(["campaigns", "char", "combat-loot", "compendium", "music", "public-initiative", "screens", "wiki"]);
const workerRouteFiles = ["admin", "campaigns", "characters", "combat-loot", "compendium", "music", "public-initiative", "screens", "themes", "wiki"]
  .map((name) => `cloudflare/routes/${name}.js`);
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
        dependency === feature || dependency === "shared" || dependency === "external" || (feature === "screens" && dependency === "integrations"),
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

for (const file of workerRouteFiles) {
  assert.ok(fs.existsSync(file), `${file} must own its Worker route family.`);
  assert.ok(fs.readFileSync("cloudflare/worker.js", "utf8").includes(`./routes/${path.basename(file)}`));
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
assert.ok(fs.existsSync("admin/index.html"), "The admin route must exist.");
assert.ok(fs.readFileSync("shared/js/site-header.js", "utf8").includes("admin/"), "Role-aware navigation must include Admin.");
assert.ok(fs.readFileSync("shared/js/site-header.js", "utf8").includes('id: "wiki"'), "Role-aware navigation must include Wiki.");
assert.ok(fs.existsSync("login/index.html"), "The authentication route must exist.");
assert.ok(fs.existsSync("shared/js/account-menu.js"), "The shared Me account panel must exist.");
assert.ok(fs.readFileSync("shared/js/site-header.js", "utf8").includes("mountAccountMenu"), "The site header must mount the Me account panel.");
const accountMenu = fs.readFileSync("shared/js/account-menu.js", "utf8");
for (const control of ["data-email-form", "data-password-form", "google", "data-unlink-provider"]) {
  assert.ok(accountMenu.includes(control), `The Me account panel must include ${control}.`);
}
assert.ok(!accountMenu.toLowerCase().includes("facebook"), "The Me account panel must not offer Facebook.");
assert.ok(!fs.readFileSync("login/index.html", "utf8").toLowerCase().includes("facebook"), "Login must not offer Facebook.");
assert.match(fs.readFileSync("admin/index.html", "utf8"), /name="character-sheet-style" value="v1"/);
assert.match(fs.readFileSync("admin/index.html", "utf8"), /name="character-sheet-style" value="v2"/);
assert.match(fs.readFileSync("admin/index.html", "utf8"), /id="character-style-settings"/);
const adminEntrypoint = fs.readFileSync("admin/js/entry.js", "utf8");
assert.ok(adminEntrypoint.includes("isLocalRuntimeHost"), "Admin should detect its localhost storage mode.");
assert.ok(adminEntrypoint.includes("persistLocalRuntimeSettings"), "Local Admin settings should persist without D1.");
assert.ok(adminEntrypoint.includes("characterSheetStyleOverrides"), "Admin should save per-character style choices.");
assert.ok(adminEntrypoint.includes("data-user-theme"), "Admin should support per-user theme assignment.");
assert.ok(adminEntrypoint.includes("data-remove-theme"), "Admin should support unprotected theme removal.");

const siteBuild = fs.readFileSync("shared/build/site.cjs", "utf8");
const tailwindConfig = fs.readFileSync("shared/styles/tailwind.config.cjs", "utf8");
for (const feature of features) {
  assert.ok(siteBuild.includes(`"${feature}"`), `${feature} must be included in the Cloudflare static site build.`);
  assert.ok(tailwindConfig.includes(`./${feature}/**/*.{html,js}`), `${feature} must be included in the Tailwind source scan.`);
}
assert.ok(siteBuild.includes('"login"'), "Login must be included in the Cloudflare static site build.");
assert.ok(tailwindConfig.includes('./login/**/*.{html,js}'), "Login must be included in the Tailwind source scan.");
assert.ok(siteBuild.includes('"character-route-worker.js"'), "The localhost character-route fallback must be deployed.");

const pageShells = new Map([
  ["campaigns/index.html", "campaigns/js/hub.js"],
  ["campaigns/manage.html", "campaigns/js/manage.js"],
  ["char/index.html", "char/js/entries/characters.js"],
  ["char/tracker.html", "char/js/entries/tracker-standalone.js"],
  ["combat-loot/index.html", "combat-loot/js/entry.js"],
  ["compendium/index.html", "compendium/js/entry.js"],
  ["dm-screen/index.html", "screens/js/entry.js"],
  ["music/index.html", "music/js/entry.js"],
  ["public-initiative/index.html", "public-initiative/js/entry.js"],
  ["player-screen/index.html", "screens/js/entry.js"],
  ["wiki/index.html", "wiki/js/entry.js"],
]);
for (const [file, entrypoint] of pageShells) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /<nav data-site-header><\/nav>/, `${file} must mount the shared header.`);
  assert.match(source, /<script type="module"/, `${file} must use a module entrypoint.`);
  assert.ok(source.includes(`src="${entrypoint}"`), `${file} must load ${entrypoint}.`);
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
for (const key of ["CHARACTERS_STORAGE_KEY", "PENDING_CHARACTER_STORAGE_KEY"]) assert.ok(characterLoader.includes(key));
assert.ok(characterLoader.includes("applyCharacterSheetLayout"), "Every routed character should apply the configured sheet layout.");
assert.ok(characterLoader.includes("applyCharacterSheetLayout(settings, characterName)"), "Character routes should resolve style overrides by ID.");
assert.ok(characterLoader.includes("history.replaceState"), "Legacy template links should receive their canonical character URL.");
assert.ok(characterLoader.includes("dataset.characterShell"), "Tracker loading should preserve the owning character shell.");
assert.ok(fs.readFileSync("char/js/editor/index.js", "utf8").includes("dataset.characterShell"), "Character saves should preserve bundled ownership after tracker injection.");
const characterCards = fs.readFileSync("char/js/archive/cards.js", "utf8");
const characterArchive = fs.readFileSync("char/js/archive/index.js", "utf8");
assert.ok(!characterCards.includes("template/?character="), "Character cards must never generate template query routes.");
assert.ok(!characterArchive.includes("template/?character="), "New characters must never generate template query routes.");
assert.ok(characterCards.includes('campaignPagePath("char")'), "Every character card should preserve campaign URL context.");
assert.ok(characterArchive.includes('campaignPagePath("char")'), "New characters should preserve campaign URL context.");
assert.ok(fs.readFileSync("character-route-worker.js", "utf8").includes("/char/template/"), "Localhost should fall back to the shared template shell behind clean character URLs.");
const trackerState = fs.readFileSync("char/js/tracker/state.js", "utf8");
const trackerNotes = fs.readFileSync("char/js/tracker/notes.js", "utf8");
assert.ok(trackerState.includes("characterStateStorageKey(character.id)"));
assert.ok(trackerNotes.includes("characterNotesStorageKey(characterId)"));

for (const file of [
  "wiki/js/entry.js",
  "compendium/js/entry.js",
  "combat-loot/js/entry.js",
  "music/js/entry.js",
  "char/js/archive/index.js",
  "char/js/tracker/header.js",
]) {
  assert.ok(fs.readFileSync(file, "utf8").includes("initializeDiceRoller"), `${file} must mount the shared dice roller.`);
}

console.log("Vertical module boundaries and compatibility tests passed.");

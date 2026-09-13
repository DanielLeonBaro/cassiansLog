// Runs each test suite under a human-readable title so failures identify the broken behavior.
const { spawnSync } = require("node:child_process");
const { COMPONENT_TAGS, matchesTags, parseRequestedTags } = require("./component-tags.cjs");

const requestedTags = parseRequestedTags(process.argv.slice(2));

if (process.argv.includes("--list-tags")) {
  console.log(COMPONENT_TAGS.join("\n"));
  process.exit(0);
}

const suites = [
  ["Shared text escaping and JSON cloning", "shared/tests/text.test.js"],
  ["Shared Markdown toolbar editing", "shared/tests/markdown-toolbar.test.js"],
  ["Local runtime host detection", "shared/tests/runtime-host.test.js"],
  ["Campaign URL and browser-cache isolation", "shared/tests/campaign-context.test.js"],
  ["NPC field visibility projection", "shared/tests/npc-visibility.test.js"],
  ["Theme catalog, normalization, and contrast", "shared/tests/theme.test.js"],
  ["Character storage keys", "char/tests/storage-keys.test.js"],
  ["Character rendering helpers", "char/tests/rendering.test.js"],
  ["Character load-error rendering", "char/tests/load-error.test.js"],
  ["Character tracker filters", "char/tests/filters.test.js"],
  ["Character rest controller", "char/tests/rest-controller.test.js"],
  ["Character tracker inventory state", "char/tests/tracker-state.test.js"],
  ["Character tracker views", "char/tests/tracker-views.test.js"],
  ["Character editor field schema", "char/tests/editor-field-schema.test.js"],
  ["Character editor field rendering", "char/tests/editor-field-renderer.test.js"],
  ["Spellcasting profiles and preparation", "char/tests/spellcasting.test.cjs"],
  ["Character repository and creation", "char/tests/repository.test.cjs"],
  ["D&D Beyond character import conversion", "char/tests/dnd-beyond-import.test.js"],
  ["Character JSON and filled PDF export", "char/tests/character-export.test.js"],
  ["Character editor draft model", "char/tests/editor-model.test.cjs"],
  ["Character archive shortcuts and editor UI", "char/tests/editor-ui.test.cjs"],
  ["Character sheet layout and ownership", "char/tests/layout.test.cjs"],
  ["V1 character section ordering", "char/tests/section-order.test.cjs"],
  ["V3 configurable character layout", "char/tests/v3-layout.test.js"],
  ["V3 personal layout persistence", "char/tests/v3-layout-repository.test.js"],
  ["Dice formula parsing and rolling", "shared/tests/dice.test.js"],
  ["Combat and Loot model", "combat-loot/tests/model.test.js"],
  ["Combat party library", "combat-loot/tests/party-library.test.js"],
  ["Combat Character and NPC choices", "combat-loot/tests/entity-integration.test.js"],
  ["Combat tracker view", "combat-loot/tests/view.test.js"],
  ["Combat and Loot repository", "combat-loot/tests/repository.test.cjs"],
  ["Combat action dispatcher", "combat-loot/tests/action-dispatcher.test.js"],
  ["Combat cloud synchronization", "combat-loot/tests/cloud-sync.test.js"],
  ["Combat dialog controller", "combat-loot/tests/dialog-controller.test.js"],
  ["Public Initiative model", "public-initiative/tests/model.test.js"],
  ["Public Initiative page structure", "public-initiative/tests/page.test.cjs"],
  ["Screen model", "screens/tests/model.test.js"],
  ["Screen calculator parser", "screens/tests/calculator.test.js"],
  ["Screen repository", "screens/tests/repository.test.js"],
  ["Screen Compendium snapshots", "screens/tests/compendium-integration.test.js"],
  ["Player and DM Screen page contracts", "screens/tests/page.test.cjs"],
  ["Music model", "music/tests/model.test.js"],
  ["Music library view", "music/tests/library-view.test.js"],
  ["Music player loops and fades", "music/tests/player.test.js"],
  ["Music page structure", "music/tests/page.test.cjs"],
  ["Compendium generation", "compendium/tests/compendium.test.cjs"],
  ["Compendium facet derivation", "compendium/tests/facets.test.cjs"],
  ["Compendium search and friendly metadata", "compendium/tests/search.test.js"],
  ["Compendium repository facet fallback", "compendium/tests/repository.test.js"],
  ["Compendium D1 cleanup and restore", "cloudflare/tests/compendium-cleanup.test.cjs", ["--no-warnings"]],
  ["Wiki view model", "wiki/tests/view-model.test.js"],
  ["Wiki image modal", "wiki/tests/image-modal.test.js"],
  ["Wiki backup export", "wiki/tests/backup.test.js"],
  ["Wiki content difference", "wiki/tests/content-diff.test.cjs"],
  ["Wiki seed and clean routes", "wiki/tests/wiki.test.cjs"],
  ["Character and Compendium integration", "integrations/character-compendium/integration.test.cjs"],
  ["Cloudflare Worker helper modules", "cloudflare/tests/modules.test.js"],
  ["D&D Beyond Worker proxy", "cloudflare/tests/dnd-beyond.test.js"],
  ["User authentication and password policy", "cloudflare/tests/auth.test.js"],
  ["Campaign discovery, membership, permissions, and isolation", "cloudflare/tests/campaigns.test.js", ["--no-warnings"]],
  ["Personal character-layout API", "cloudflare/tests/character-layouts.test.js", ["--no-warnings"]],
  ["Per-user Screen and Public Initiative APIs", "cloudflare/tests/screens.test.js"],
  ["Screen D1 migration and rollback compatibility", "cloudflare/tests/screens-migration.test.cjs", ["--no-warnings"]],
  ["Campaign D1 migration and legacy preservation", "cloudflare/tests/campaigns-migration.test.cjs", ["--no-warnings"]],
  ["Character-layout D1 migration compatibility", "cloudflare/tests/character-layouts-migration.test.cjs", ["--no-warnings"]],
  ["Theme background D1 migration compatibility", "cloudflare/tests/theme-backgrounds-migration.test.cjs", ["--no-warnings"]],
  ["Theme D1 CRUD and assignments", "cloudflare/tests/themes.test.js"],
  ["Cloudflare Worker routing and write protection", "cloudflare/tests/worker.test.cjs"],
  ["Runtime settings and fallbacks", "shared/tests/settings.test.cjs"],
  ["Section configuration and visibility", "shared/tests/sections.test.cjs"],
  ["Architecture and module boundaries", "shared/tests/architecture.test.cjs"],
  ["URL, storage, API, and seed compatibility", "shared/tests/compatibility.test.cjs"],
  ["Static routes and colocated data", "shared/tests/routes.test.cjs"],
];

function run(title, command, args) {
  console.log(`\nTEST: ${title}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status === 0) return;
  console.error(`\nFAILED: ${title}`);
  if (result.error) console.error(result.error.message);
  process.exit(result.status || 1);
}

function tagsForSuite(file) {
  if (file.includes("v3-layout") || file.includes("character-layout")) return ["@character-layout"];
  if (file.includes("dnd-beyond")) return ["@characters", "@npcs"];
  if (file.includes("compendium-integration")) return ["@compendium", "@screens"];
  if (file.startsWith("char/")) return ["@characters"];
  if (file.startsWith("combat-loot/")) return ["@combat"];
  if (file.startsWith("public-initiative/")) return ["@initiative"];
  if (file.startsWith("screens/")) return ["@screens"];
  if (file.startsWith("music/")) return ["@music"];
  if (file.startsWith("compendium/") || file.includes("compendium-cleanup")) return ["@compendium"];
  if (file.startsWith("wiki/")) return ["@wiki"];
  if (file.includes("character-compendium")) return ["@characters", "@compendium"];
  if (file.includes("campaign-context") || file.includes("campaigns")) return ["@campaigns"];
  if (file.includes("npc-visibility")) return ["@npcs"];
  if (file.includes("theme")) return ["@themes"];
  if (file.includes("auth")) return ["@auth"];
  if (file.includes("screens")) return ["@screens", "@initiative"];
  if (file.includes("markdown-toolbar")) return ["@characters", "@combat", "@screens", "@wiki"];
  if (file.includes("dice")) return ["@characters", "@combat", "@screens"];
  if (file.includes("settings")) return ["@admin", "@campaigns", "@characters", "@themes"];
  if (file.includes("sections")) return ["@admin", "@campaigns"];
  if (file.includes("worker.test")) return ["@admin", "@auth"];
  return ["@core"];
}

const selectedSuites = suites.filter(([, file]) => matchesTags(requestedTags, tagsForSuite(file)));
console.log(`Test selection: ${requestedTags.size ? [...requestedTags].join(", ") : "all tags"} (${selectedSuites.length}/${suites.length} suites)`);

for (const [title, file, nodeOptions = []] of selectedSuites) {
  run(title, process.execPath, [...nodeOptions, file]);
}

if (matchesTags(requestedTags, ["@themes"])) {
  run("Tailwind CSS build", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:css"]);
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const config = JSON.parse(fs.readFileSync("shared/config/sections.json", "utf8"));
const sectionNames = Object.keys(config.sections);

assert.ok(sectionNames.length > 0, "Section configuration should not be empty.");
sectionNames.forEach((name) => {
  assert.equal(
    typeof config.sections[name],
    "boolean",
    `${name} should be configured with true or false.`,
  );
});
assert.equal(config.sections["combat-loot"], true, "Combat & Loot navigation should be enabled.");
assert.equal(config.sections["public-initiative"], true, "Public Initiative navigation should be enabled.");
assert.equal(config.sections.combat, true, "Character combat controls should keep their independent setting.");
assert.equal(config.sections.wiki, false, "The existing Wiki navigation setting should remain disabled.");

const siteHeader = fs.readFileSync("shared/js/site-header.js", "utf8");
const siteSections = ["characters", "combat-loot", "compendium", "music", "public-initiative", "wiki"];
for (const name of siteSections) {
  assert.ok(siteHeader.includes(`id: "${name}"`), `${name} should be defined in the shared site header.`);
}
assert.match(
  siteHeader,
  /id: "combat-loot", href: "combat-loot\/", icon: "bi-shield-shaded", label: "Combat & Loot"/,
  "Combat & Loot should use its configured route, Bootstrap icon, and label.",
);
assert.match(
  siteHeader,
  /id: "music", href: "music\/", icon: "bi-music-note-beamed", label: "Music"/,
  "Music should use its configured route, Bootstrap icon, and label.",
);
assert.match(
  siteHeader,
  /id: "public-initiative", href: "public-initiative\/", icon: "bi-list-ol", label: "Public Initiative"/,
  "Public Initiative should use its configured route, Bootstrap icon, and label.",
);
assert.match(siteHeader, /data-section-link="\$\{page\.id\}"/, "Site links should expose their section IDs.");
assert.match(siteHeader, /id="site-pages-menu-button"/, "Site navigation should use a Pages dropdown.");
assert.match(siteHeader, /sectionConfigReady\.then\(syncAvailability\)/, "The Pages dropdown should react to runtime section settings.");
assert.doesNotMatch(
  siteHeader,
  /tracker && page\.id === "characters"/,
  "Character sheets should keep the Characters index inside the Pages dropdown.",
);
assert.doesNotMatch(siteHeader, /const home = tracker/, "Every page should use the same Cassian's Log home link.");
assert.match(siteHeader, /aria-label="Cassian's Log home"/, "Character sheets should show the Cassian's Log brand link.");

const trackerHeader = fs.readFileSync("char/js/tracker/header.js", "utf8");
for (const name of sectionNames.filter((name) => !siteSections.includes(name))) {
  assert.ok(trackerHeader.includes(`"${name}"`), `${name} should be defined in the tracker navigation.`);
}
assert.match(trackerHeader, /data-section-link="\$\{section\}"/, "Jump links should expose their section IDs.");

const editorSource = fs.readFileSync("integrations/character-compendium/index.js", "utf8");
assert.ok(
  editorSource.match(/data-section-link="compendium"/g)?.length >= 3,
  "Every character-editor Compendium entry point should use the section toggle.",
);
assert.match(editorSource, /applySectionVisibility\(host\.fieldsRoot\)/, "Dynamic integration controls should reapply section visibility.");

function sectionElement(section, hidden) {
  const declarations = new Map();
  return {
    dataset: { sectionLink: section },
    hidden,
    matches: () => false,
    querySelectorAll: () => [],
    style: {
      setProperty: (name, value, priority) => declarations.set(name, { value, priority }),
      removeProperty: (name) => declarations.delete(name),
      getPropertyValue: (name) => declarations.get(name)?.value || "",
      getPropertyPriority: (name) => declarations.get(name)?.priority || "",
    },
  };
}

const elements = [
  sectionElement("wiki", false),
  sectionElement("compendium", true),
  sectionElement("future-section", true),
];
global.document = {
  baseURI: "https://example.test/cassiansLog/",
  matches: () => false,
  querySelectorAll: () => elements,
};
global.fetch = async (url) => {
  assert.equal(url, "api/settings");
  return { ok: true, json: async () => ({ sections: { wiki: false, compendium: true } }) };
};

(async () => {
  const moduleURL = `${pathToFileURL(path.resolve("shared/js/sections.js"))}?test=${Date.now()}`;
  const { sectionConfigReady } = await import(moduleURL);
  await sectionConfigReady;

  assert.equal(elements[0].hidden, true, "Disabled Wiki links should be hidden.");
  assert.equal(elements[0].style.getPropertyValue("display"), "none");
  assert.equal(elements[0].style.getPropertyPriority("display"), "important");
  assert.equal(elements[1].hidden, false, "Enabled Compendium links should be shown.");
  assert.equal(elements[1].style.getPropertyValue("display"), "");
  assert.equal(elements[2].hidden, false, "Unknown sections should remain visible.");
  assert.ok(fs.existsSync("wiki/index.html"), "The direct Wiki page should remain available.");
  console.log(`Section toggle tests passed (${sectionNames.length} configured sections).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

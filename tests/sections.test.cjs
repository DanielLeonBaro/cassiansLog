const assert = require("node:assert/strict");
const fs = require("node:fs");

const config = JSON.parse(fs.readFileSync("config/sections.json", "utf8"));
const sectionNames = Object.keys(config.sections);

assert.ok(sectionNames.length > 0, "Section configuration should not be empty.");
sectionNames.forEach((name) => {
  assert.equal(
    typeof config.sections[name],
    "boolean",
    `${name} should be configured with true or false.`,
  );
});

const siteHeader = fs.readFileSync("js/shared/site-header.js", "utf8");
for (const name of ["characters", "compendium", "wiki"]) {
  assert.ok(siteHeader.includes(`id: "${name}"`), `${name} should be defined in the shared site header.`);
}
assert.match(siteHeader, /data-section-link="\$\{page\.id\}"/, "Site links should expose their section IDs.");

const trackerHeader = fs.readFileSync("js/features/tracker/header.js", "utf8");
for (const name of sectionNames.filter((name) => !["characters", "compendium", "wiki"].includes(name))) {
  assert.ok(trackerHeader.includes(`"${name}"`), `${name} should be defined in the tracker navigation.`);
}
assert.match(trackerHeader, /data-section-link="\$\{section\}"/, "Jump links should expose their section IDs.");

const editorSource = fs.readFileSync("js/character-editor.js", "utf8");
assert.ok(
  editorSource.match(/data-section-link="compendium"/g)?.length >= 4,
  "Every character-editor Compendium entry point should use the section toggle.",
);
assert.match(editorSource, /applySectionVisibility\(fields\)/, "Dynamic editor controls should reapply section visibility.");

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
  assert.equal(url.href, "https://example.test/cassiansLog/config/sections.json");
  return { ok: true, json: async () => ({ sections: { wiki: false, compendium: true } }) };
};

(async () => {
  const source = fs.readFileSync("js/shared/sections.js", "utf8");
  const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
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

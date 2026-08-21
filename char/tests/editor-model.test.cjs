const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const moduleURL = `${pathToFileURL(path.resolve("char/js/editor/model.js"))}?test=${Date.now()}`;
  const {
    clone,
    createBlankCollectionItem,
    draftsDiffer,
    duplicateCollectionItem,
    pathValue,
  } = await import(moduleURL);

  const original = {
    id: "hero",
    customRule: { enabled: true },
    actions: [{ id: "action-one", name: "Strike", description: "Keep me" }],
    spellcasting: { profiles: [{ id: "wizard" }] },
  };
  const draft = clone(original);
  assert.equal(draftsDiffer(original, draft), false);
  draft.customRule.enabled = false;
  assert.equal(draftsDiffer(original, draft), true, "Nested homebrew edits should mark the draft dirty.");
  assert.equal(original.customRule.enabled, true, "Draft edits must not mutate the saved character.");
  assert.equal(pathValue(draft, ["actions", 0, "name"]), "Strike");

  const duplicate = duplicateCollectionItem(original.actions[0], "actions");
  assert.notEqual(duplicate.id, original.actions[0].id);
  assert.equal(duplicate.name, "Strike");
  assert.equal(duplicate.description, "Keep me");

  const spell = createBlankCollectionItem(["spells"], [], original);
  assert.equal(spell.source, "wizard");
  assert.equal(spell.action, "Action");
  assert.equal(spell.prepared, false);

  const inventory = createBlankCollectionItem(["inventory"], [], original);
  assert.equal(inventory.quantity, 1);
  assert.equal(inventory.attunement, false);
  assert.equal(inventory.wearable, false);
  console.log("Character editor draft and collection model tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

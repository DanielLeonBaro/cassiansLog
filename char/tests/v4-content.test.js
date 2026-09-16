// Verifies V4 feature grouping, selections/resources, Extras, Background, and detail records.
import assert from "node:assert/strict";
import {
  v4BackgroundDetails,
  v4DetailRecord,
  v4ExtraGroups,
  v4FeatureGroupId,
  v4FeatureGroups,
} from "../js/tracker/v4-content.js";

const character = {
  class: "Wizard",
  subclass: "School of Evocation",
  race: "Human",
  background: "Sage",
  build: {
    selections: { "wizard-feature:school": ["evocation"] },
    description: { personalityTraits: "Always asks why.", backstory: "Learned among old stacks." },
  },
  resources: [{ id: "focus", name: "Arcane Focus", uses: { current: 1, max: 2, reset: "long" } }],
  features: [
    { id: "wizard-feature", name: "Arcane Tradition", type: "Class Feature", source: "Wizard", resourceId: "focus" },
    { id: "sculpt", name: "Sculpt Spells", type: "Subclass", source: "School of Evocation", selections: ["Safe allies"] },
    { id: "versatile", name: "Versatile", category: "Racial Trait" },
    { id: "researcher", name: "Researcher", category: "Background Feature", source: "Sage" },
    { id: "alert", name: "Alert", category: "Feat", description: "Stay ready." },
  ],
  extras: [
    { id: "owl", name: "Scholar Owl", type: "familiar", sourceId: "find-familiar", ac: 11, speed: "5 ft., fly 60 ft.", hp: { current: 1, max: 1 }, description: "A watchful owl." },
    { id: "wagon", name: "Library Wagon", type: "vehicle", hp: { current: 20, max: 30, temp: 2 }, uses: { current: 2, max: 3 }, notes: "Carries books." },
    { id: "token", name: "Speaking Token", type: "unknown" },
  ],
};

assert.equal(v4FeatureGroupId(character.features[1], character), "subclass");
assert.equal(v4FeatureGroupId(character.features[2], character), "species");
assert.deepEqual(v4FeatureGroups(character).map((group) => [group.id, group.features.length]), [
  ["class", 1], ["subclass", 1], ["species", 1], ["background", 1], ["feat", 1],
]);
const classFeature = v4FeatureGroups(character)[0].features[0];
assert.deepEqual(classFeature.selections, ["evocation"]);
assert.equal(classFeature.resource.id, "focus");
assert.deepEqual(v4ExtraGroups(character).map((group) => [group.id, group.extras.length]), [
  ["familiar", 1], ["vehicle", 1], ["custom", 1],
]);
assert.equal(v4ExtraGroups(character)[1].extras[0].hp.current, 20);
assert.deepEqual(v4BackgroundDetails(character), {
  name: "Sage",
  fields: [
    { label: "Personality", value: "Always asks why." },
    { label: "Backstory", value: "Learned among old stacks." },
  ],
});
assert.deepEqual(v4DetailRecord(character, "feature", "sculpt").selections, ["Safe allies"]);
assert.deepEqual(v4DetailRecord(character, "extra", "owl").stats, [["AC", 11], ["HP", "1/1"], ["Speed", "5 ft., fly 60 ft."]]);
assert.equal(v4DetailRecord(character, "extra", "missing"), null);

console.log("V4 Character feature and Extras model tests passed.");

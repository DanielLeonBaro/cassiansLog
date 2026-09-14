// Verifies pure ruleset-safe grant, choice, prerequisite, and level-gate evaluation.
import assert from "node:assert/strict";
import {
  characterChoiceKey,
  evaluateCharacterBuild,
} from "../js/rules/evaluator.js";
import {
  evaluateIdRequirement,
  evaluatePrerequisite,
} from "../js/rules/requirements.js";

function entry({
  id,
  originalId,
  name = id,
  type = "Class Feature",
  ruleset = "agnostic",
  automation = "rules-ready",
  rules = null,
  supports = "",
  prerequisite = "",
  requirements = "",
}) {
  return {
    id,
    originalId,
    name,
    type,
    category: "features",
    publication: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    source: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    publisher: "Wizards of the Coast",
    ruleset,
    automation: { status: automation, reasons: [], expressions: [] },
    rules,
    supports,
    prerequisite,
    requirements,
  };
}

function rulesCharacter({
  ruleset = "5e",
  classId = "fighter5e",
  level = 2,
  selections = {},
  prerequisites = true,
} = {}) {
  return {
    name: "Evaluator fixture",
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "incomplete",
      ruleset,
      preferences: { prerequisites },
      levels: [{ classId, subclassId: "", level, hitPointRolls: [] }],
      speciesId: "",
      backgroundId: "",
      selections,
    },
  };
}

const skillChoice = characterChoiceKey("fighter5e", 0);
const styleChoice = characterChoiceKey("fighter5e", 1);
const featChoice = characterChoiceKey("fighter5e", 2);
const catalog = [
  entry({
    id: "fighter5e",
    originalId: "ID_CLASS_FIGHTER_5E",
    name: "Fighter",
    type: "Class",
    ruleset: "5e",
    rules: {
      grants: [
        { type: "Proficiency", id: "ID_ARMOR_LIGHT" },
        { type: "Class Feature", id: "ID_ACTION_SURGE", level: "2" },
        { type: "Class Feature", id: "ID_MISSING_LEVEL_3", level: "3" },
        { type: "Class Feature", id: "ID_DEFAULT_STYLE", requirements: "!ID_STYLE_DEFENSE" },
      ],
      selections: [
        {
          type: "Proficiency",
          name: "Fighter skills",
          number: "2",
          supports: "Skill,Fighter",
        },
        {
          type: "Class Feature",
          name: "Fighting style",
          supports: "ID_STYLE_DEFENSE|ID_STYLE_ARCHERY",
        },
        {
          type: "Feat",
          name: "Level 4 feat",
          level: "4",
          supports: "ID_FEAT_READY|ID_FEAT_TOO_SOON|ID_FEAT_UNSUPPORTED",
        },
      ],
      stats: [],
    },
  }),
  entry({
    id: "fighter55e",
    originalId: "ID_CLASS_FIGHTER_55E",
    name: "Fighter",
    type: "Class",
    ruleset: "5.5e",
    rules: {
      grants: [{ type: "Class Feature", id: "ID_WEAPON_MASTERY" }],
      selections: [],
      stats: [],
    },
  }),
  entry({ id: "armorLight", originalId: "ID_ARMOR_LIGHT", name: "Light Armor", type: "Proficiency" }),
  entry({ id: "actionSurge", originalId: "ID_ACTION_SURGE", name: "Action Surge" }),
  entry({ id: "defaultStyle", originalId: "ID_DEFAULT_STYLE", name: "Default Style" }),
  entry({ id: "weaponMastery", originalId: "ID_WEAPON_MASTERY", name: "Weapon Mastery" }),
  entry({ id: "athletics", originalId: "ID_SKILL_ATHLETICS", name: "Athletics", type: "Proficiency", supports: "Skill,Fighter" }),
  entry({ id: "perception", originalId: "ID_SKILL_PERCEPTION", name: "Perception", type: "Proficiency", supports: "Skill,Fighter" }),
  entry({ id: "arcana", originalId: "ID_SKILL_ARCANA", name: "Arcana", type: "Proficiency", supports: "Skill,Wizard" }),
  entry({ id: "defense", originalId: "ID_STYLE_DEFENSE", name: "Defense" }),
  entry({ id: "archery", originalId: "ID_STYLE_ARCHERY", name: "Archery" }),
  entry({ id: "featReady", originalId: "ID_FEAT_READY", name: "Ready Feat", type: "Feat", prerequisite: "Level 4+" }),
  entry({ id: "featTooSoon", originalId: "ID_FEAT_TOO_SOON", name: "Too Soon Feat", type: "Feat", prerequisite: "Level 5+" }),
  entry({
    id: "featUnsupported",
    originalId: "ID_FEAT_UNSUPPORTED",
    name: "Unsupported Feat",
    type: "Feat",
    prerequisite: "Strength 13 or higher",
  }),
];

const character = rulesCharacter({
  selections: {
    [skillChoice]: ["ID_SKILL_ATHLETICS", "perception"],
    [styleChoice]: "ID_STYLE_DEFENSE",
  },
});
const snapshot = structuredClone({ character, catalog });
const result = evaluateCharacterBuild({ character, catalog });
assert.deepEqual({ character, catalog }, snapshot, "evaluation must not mutate caller inputs");
assert.equal(result.ruleset, "5e");
assert.deepEqual(result.roots, [{
  kind: "class",
  path: "build.levels.0.classId",
  requestedId: "fighter5e",
  entryId: "fighter5e",
  originalId: "ID_CLASS_FIGHTER_5E",
  level: 2,
  status: "active",
}]);
assert.deepEqual(
  result.activeEntries.map((active) => active.id),
  ["actionSurge", "armorLight", "athletics", "defense", "fighter5e", "perception"],
);
assert.equal(result.grants.find((grant) => grant.targetId === "actionSurge").status, "applied");
assert.equal(result.grants.find((grant) => grant.targetOriginalId === "ID_MISSING_LEVEL_3").status, "level-gated");
assert.equal(result.grants.find((grant) => grant.targetId === "defaultStyle").status, "requirements-unmet");
assert.equal(result.choices.find((choice) => choice.key === skillChoice).status, "complete");
assert.equal(result.choices.find((choice) => choice.key === featChoice).unavailableReason, "level-gated");
assert.equal(result.warnings.length, 0, "future unresolved grants and gated choices must not warn early");

const reachedMissingGrant = evaluateCharacterBuild({
  character: rulesCharacter({
    level: 3,
    selections: {
      [skillChoice]: ["athletics", "perception"],
      [styleChoice]: "defense",
    },
  }),
  catalog,
});
assert.ok(reachedMissingGrant.warnings.some((warning) =>
  warning.code === "unresolved-reference" && warning.entryId === "ID_MISSING_LEVEL_3"));

const reversed = evaluateCharacterBuild({ character, catalog: [...catalog].reverse() });
assert.deepEqual(reversed, result, "catalog ordering must not affect rule evaluation");

const modern = evaluateCharacterBuild({
  character: rulesCharacter({ ruleset: "5.5e", classId: "ID_CLASS_FIGHTER_55E", level: 1 }),
  catalog,
});
assert.deepEqual(modern.activeEntries.map((active) => active.id), ["fighter55e", "weaponMastery"]);
assert.equal(modern.grants[0].status, "applied");

const mixedRules = evaluateCharacterBuild({
  character: rulesCharacter({ ruleset: "5.5e", classId: "fighter5e" }),
  catalog,
});
assert.equal(mixedRules.roots[0].status, "unavailable");
assert.equal(mixedRules.activeEntries.length, 0);
assert.ok(mixedRules.warnings.some((warning) => warning.code === "ruleset-mismatch"));

const unresolvedRoot = evaluateCharacterBuild({
  character: rulesCharacter({ classId: "missingClass" }),
  catalog,
});
assert.ok(unresolvedRoot.warnings.some((warning) =>
  warning.code === "unresolved-reference" && warning.entryId === "missingClass"));

const invalidChoices = evaluateCharacterBuild({
  character: rulesCharacter({
    selections: {
      [skillChoice]: ["ID_SKILL_ATHLETICS", "ID_SKILL_ATHLETICS", "missingSkill"],
      [styleChoice]: [],
      stale: ["ID_SKILL_ARCANA"],
    },
  }),
  catalog,
});
assert.ok(invalidChoices.warnings.some((warning) => warning.code === "selection-duplicate"));
assert.ok(invalidChoices.warnings.some((warning) => warning.code === "selection-invalid"));
assert.ok(invalidChoices.warnings.some((warning) => warning.code === "selection-required"));
assert.ok(invalidChoices.warnings.some((warning) => warning.code === "unresolved-selection"));

const levelFour = evaluateCharacterBuild({
  character: rulesCharacter({
    level: 4,
    selections: {
      [skillChoice]: ["athletics", "perception"],
      [styleChoice]: "defense",
      [featChoice]: "featReady",
    },
  }),
  catalog,
});
assert.ok(levelFour.activeEntries.some((active) => active.id === "featReady"));
assert.equal(levelFour.choices.find((choice) => choice.key === featChoice).status, "complete");

const unmetPrerequisite = evaluateCharacterBuild({
  character: rulesCharacter({
    level: 4,
    selections: {
      [skillChoice]: ["athletics", "perception"],
      [styleChoice]: "defense",
      [featChoice]: "featTooSoon",
    },
  }),
  catalog,
});
assert.ok(!unmetPrerequisite.activeEntries.some((active) => active.id === "featTooSoon"));
assert.equal(unmetPrerequisite.choices.find((choice) => choice.key === featChoice).status, "invalid");
assert.equal(
  unmetPrerequisite.choices.find((choice) => choice.key === featChoice)
    .options.find((option) => option.id === "featTooSoon").unavailableReason,
  "prerequisite-unmet",
);
assert.ok(unmetPrerequisite.warnings.some((warning) =>
  warning.code === "unmet-prerequisite" && warning.entryId === "featTooSoon"));

const unsupportedPrerequisite = evaluateCharacterBuild({
  character: rulesCharacter({
    level: 4,
    selections: {
      [skillChoice]: ["athletics", "perception"],
      [styleChoice]: "defense",
      [featChoice]: "featUnsupported",
    },
  }),
  catalog,
});
assert.ok(!unsupportedPrerequisite.activeEntries.some((active) => active.id === "featUnsupported"));
assert.equal(unsupportedPrerequisite.choices.find((choice) => choice.key === featChoice).status, "invalid");
assert.ok(unsupportedPrerequisite.warnings.some((warning) =>
  warning.code === "unsupported-rule-expression" && warning.entryId === "featUnsupported"));

const ignoredPrerequisite = evaluateCharacterBuild({
  character: rulesCharacter({
    level: 4,
    prerequisites: false,
    selections: {
      [skillChoice]: ["athletics", "perception"],
      [styleChoice]: "defense",
      [featChoice]: "featUnsupported",
    },
  }),
  catalog,
});
assert.ok(ignoredPrerequisite.activeEntries.some((active) => active.id === "featUnsupported"));
assert.ok(!ignoredPrerequisite.warnings.some((warning) => warning.entryId === "featUnsupported"));

const partialCatalog = [
  entry({
    id: "partialClass",
    originalId: "ID_PARTIAL_CLASS",
    name: "Partial Class",
    type: "Class",
    ruleset: "5e",
    automation: "partial",
    rules: { grants: [{ id: "ID_ARMOR_LIGHT" }], selections: [], stats: [] },
  }),
  catalog.find((candidate) => candidate.id === "armorLight"),
];
const partial = evaluateCharacterBuild({
  character: rulesCharacter({ classId: "partialClass", level: 1 }),
  catalog: partialCatalog,
});
assert.deepEqual(partial.activeEntries.map((active) => active.id), ["partialClass"]);
assert.equal(partial.grants.length, 0, "partial content must not apply guessed rules");
assert.ok(partial.warnings.some((warning) => warning.code === "partial-automation"));

const manual = evaluateCharacterBuild({ character: { name: "Legacy" }, catalog });
assert.deepEqual(manual, {
  ruleset: "5e",
  roots: [],
  activeEntries: [],
  grants: [],
  choices: [],
  warnings: [],
});

assert.deepEqual(evaluateIdRequirement("ID_A,!ID_B", new Set(["ID_A"])), {
  status: "met",
  expression: "ID_A,!ID_B",
});
assert.equal(evaluateIdRequirement("!(ID_A||ID_B)", new Set(["ID_A"])).status, "unmet");
assert.equal(evaluateIdRequirement("[psi-limit:1]", new Set()).status, "unsupported");
assert.equal(evaluatePrerequisite("Level 4+", { level: 3 }).status, "unmet");
assert.equal(evaluatePrerequisite("Level 4+", { level: 4 }).status, "met");
assert.equal(evaluatePrerequisite("Level 2+ Fighter", {
  level: 1,
  classLevels: new Map([["fighter", 2]]),
}).status, "met");

console.log("Character rules graph evaluator tests passed.");

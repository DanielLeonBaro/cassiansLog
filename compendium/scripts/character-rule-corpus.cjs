// Builds the compact contract that maps Character rules domains to evidence and coverage.
const RULESETS = Object.freeze(["5e", "5.5e"]);
const STATUSES = new Set(["rules-ready", "partial", "manual"]);

const SOURCES = Object.freeze({
  "compendium-rules-metadata": { kind: "artifact", path: "compendium/data/rules-metadata.json" },
  "character-certifications": { kind: "artifact", path: "compendium/data/character-certification-report.json" },
  "5e-class-progression-report": { kind: "artifact", ruleset: "5e", path: "compendium/data/class-progression-5e-report.json" },
  "5.5e-class-progression-report": { kind: "artifact", ruleset: "5.5e", path: "compendium/data/class-progression-5-5e-report.json" },
  "subclass-coverage-report": { kind: "artifact", path: "compendium/data/subclass-coverage-report.json" },
  "origin-coverage-report": { kind: "artifact", path: "compendium/data/origin-coverage-report.json" },
  "feat-choice-coverage-report": { kind: "artifact", path: "compendium/data/feat-choice-coverage-report.json" },
  "spell-coverage-report": { kind: "artifact", path: "compendium/data/spell-coverage-report.json" },
  "equipment-coverage-report": { kind: "artifact", path: "compendium/data/equipment-coverage-report.json" },
  "cassian-rules-engine": { kind: "module", path: "char/js/rules/engine.js" },
  "srd-5.1-cc": { kind: "official", ruleset: "5e", url: "https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf" },
  "srd-5.2.1-cc": { kind: "official", ruleset: "5.5e", url: "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf" },
  "dnd-beyond-2014-classes": { kind: "official", ruleset: "5e", url: "https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes" },
  "dnd-beyond-2014-origins": { kind: "official", ruleset: "5e", url: "https://www.dndbeyond.com/sources/dnd/basic-rules-2014/personality-and-background" },
  "dnd-beyond-2024-classes": { kind: "official", ruleset: "5.5e", url: "https://www.dndbeyond.com/sources/dnd/br-2024/character-classes" },
  "dnd-beyond-2024-origins": { kind: "official", ruleset: "5.5e", url: "https://www.dndbeyond.com/sources/dnd/br-2024/character-origins" },
  "dnd-beyond-2024-creation": { kind: "official", ruleset: "5.5e", url: "https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character" },
});

const FIXTURES = Object.freeze({
  builder: ["char/tests/builder-choice-model.test.js", "char/tests/builder-completion-model.test.js"],
  classes: [
    "char/tests/fixtures/fighter-wizard-levels-1-20.json",
    "char/tests/fixtures/cleric-paladin-levels-1-20.json",
    "char/tests/fixtures/druid-ranger-levels-1-20.json",
    "char/tests/fixtures/bard-sorcerer-levels-1-20.json",
    "char/tests/fixtures/warlock-levels-1-20.json",
    "char/tests/fixtures/barbarian-monk-levels-1-20.json",
    "char/tests/fixtures/rogue-levels-1-20.json",
  ],
  origins: ["char/tests/fixtures/first-slice-origins.json", "char/tests/first-slice-certification.test.js"],
  rules: ["char/tests/rules-engine.test.js", "char/tests/rules-evaluator.test.js"],
  spells: ["char/tests/spell-rules.test.js", "char/tests/v4-spells.test.js"],
  inventory: ["char/tests/inventory-rules.test.js", "char/tests/v4-inventory.test.js"],
  runtime: ["char/tests/rules-runtime.test.js", "char/tests/rest-controller.test.js"],
});

const DOMAINS = Object.freeze({
  identity: {
    label: "Identity and description",
    requirements: ["name", "portrait", "pronouns", "alignment", "deity", "campaign", "status", "notes", "appearance", "personality", "ideals", "bonds", "flaws", "organizations", "backstory"],
    status: "manual", dependencies: [], fixtures: FIXTURES.builder,
  },
  advancement: {
    label: "Advancement and multiclass structure",
    requirements: ["ruleset", "total level", "ordered class levels", "subclasses", "xp or milestone", "level-up history", "hit-point choices", "multiclass prerequisites", "first-class and later-class grants"],
    status: "partial", dependencies: ["identity"], fixtures: [...FIXTURES.builder, ...FIXTURES.classes],
  },
  origin: {
    label: "Race, species, and background",
    requirements: ["race or species", "subrace or lineage", "size", "speed", "senses", "languages", "proficiencies", "traits", "innate spells", "background grants", "origin feats", "starting equipment or currency", "variants and replacements"],
    status: "partial", dependencies: ["abilities", "proficiencies", "feats-choices"], fixtures: FIXTURES.origins,
  },
  abilities: {
    label: "Ability scores",
    requirements: ["standard array", "27-point buy", "rolled scores", "manual scores", "ability increases", "score limits", "overrides", "modifier traces"],
    status: "rules-ready", dependencies: [], fixtures: [...FIXTURES.builder, ...FIXTURES.rules],
  },
  proficiencies: {
    label: "Saves, skills, and proficiencies",
    requirements: ["saving throws", "skills", "expertise", "half proficiency", "tools", "weapons", "armor", "shields", "languages", "initiative", "passive scores", "trace sources"],
    status: "rules-ready", dependencies: ["abilities", "advancement"], fixtures: FIXTURES.rules,
  },
  "class-progression": {
    label: "Class and subclass progression",
    requirements: ["hit die", "hit points", "primary abilities", "saving throws", "starting proficiencies", "starting equipment", "multiclass grants", "spellcasting model", "features levels 1-20", "resources", "rest timing", "scaling", "actions", "choices", "replacements", "subclass levels", "ASI levels", "Epic Boons", "Extra Attack", "capstones"],
    status: "partial", dependencies: ["advancement", "abilities", "proficiencies", "feats-choices", "spellcasting", "runtime-rests"], fixtures: FIXTURES.classes,
  },
  "feats-choices": {
    label: "Feats and class-specific choices",
    requirements: ["category", "ruleset", "prerequisites", "repeatability", "level gates", "ability increases", "grants", "replacements", "choice counts", "fighting styles", "weapon masteries", "invocations", "metamagic", "maneuvers", "infusions", "magical secrets", "expertise"],
    status: "partial", dependencies: ["abilities", "proficiencies"], fixtures: [...FIXTURES.rules, ...FIXTURES.classes],
  },
  spellcasting: {
    label: "Spellcasting",
    requirements: ["casting ability", "focus", "class lists", "cantrips", "known spells", "prepared spells", "spellbook", "always-prepared spells", "granted spells", "rituals", "replacement rules", "slot progression", "Pact Magic", "multiclass slots", "recovery", "upcasting", "concentration", "components", "range", "duration", "attacks", "saving throws", "damage", "healing", "scaling", "source and edition"],
    status: "partial", dependencies: ["advancement", "abilities", "runtime-rests"], fixtures: FIXTURES.spells,
  },
  equipment: {
    label: "Equipment and inventory",
    requirements: ["starting packages", "alternatives", "currency", "items", "quantities", "containers", "cost", "weight", "capacity", "equip state", "attunement", "charges", "recharge", "prerequisites", "modifiers", "armor formulas", "weapon properties", "weapon masteries", "range", "damage", "ammunition", "unarmed strikes"],
    status: "partial", dependencies: ["abilities", "proficiencies", "runtime-rests"], fixtures: FIXTURES.inventory,
  },
  "derived-sheet": {
    label: "Derived character sheet",
    requirements: ["HP", "temporary HP", "hit dice", "Armor Class", "initiative", "movement", "senses", "defenses", "conditions", "exhaustion", "death saves", "attacks", "spell DC", "spell attack", "passive scores", "carrying capacity", "encumbrance", "source traces", "overrides"],
    status: "partial", dependencies: ["abilities", "proficiencies", "class-progression", "spellcasting", "equipment", "runtime-rests"], fixtures: [...FIXTURES.rules, ...FIXTURES.inventory],
  },
  "runtime-rests": {
    label: "Runtime state and rests",
    requirements: ["current HP", "temporary HP", "death saves", "conditions", "exhaustion", "concentration", "prepared spells", "slots", "limited resources", "charges", "short rests", "long rests", "runtime state separate from build choices"],
    status: "partial", dependencies: ["advancement"], fixtures: FIXTURES.runtime,
  },
});

function sourceIds(ruleset, domainId) {
  const official = ruleset === "5e"
    ? ["srd-5.1-cc", domainId === "origin" ? "dnd-beyond-2014-origins" : "dnd-beyond-2014-classes"]
    : ["srd-5.2.1-cc", domainId === "origin" ? "dnd-beyond-2024-origins" : "dnd-beyond-2024-classes", "dnd-beyond-2024-creation"];
  const reports = domainId === "class-progression"
    ? [ruleset === "5e" ? "5e-class-progression-report" : "5.5e-class-progression-report", "subclass-coverage-report"]
    : [];
  const originReports = domainId === "origin" ? ["origin-coverage-report"] : [];
  const choiceReports = domainId === "feats-choices" ? ["feat-choice-coverage-report"] : [];
  const spellReports = domainId === "spellcasting" ? ["spell-coverage-report"] : [];
  const equipmentReports = domainId === "equipment" ? ["equipment-coverage-report"] : [];
  return [...new Set(["compendium-rules-metadata", "character-certifications", "cassian-rules-engine", ...reports, ...originReports, ...choiceReports, ...spellReports, ...equipmentReports, ...official])];
}

function certifiedEntryIds(entries, rulesMetadata, ruleset, domainId) {
  const categories = domainId === "origin" ? new Set(["backgrounds", "races"])
    : domainId === "class-progression" ? new Set(["classes", "subclasses"])
      : new Set();
  if (!categories.size) return [];
  return entries.filter((entry) => categories.has(entry.category)
    && rulesMetadata[entry.id]?.ruleset === ruleset
    && rulesMetadata[entry.id]?.automation?.status === "rules-ready")
    .map(({ id }) => id).sort();
}

function validateCharacterRuleCorpus(corpus) {
  if (corpus?.version !== 1 || !/^sha256-[a-f0-9]{20}$/.test(corpus.catalogVersion || "")) throw new TypeError("Character rule corpus needs a versioned Compendium catalog.");
  const domainIds = new Set(Object.keys(corpus.domains || {}));
  Object.entries(corpus.domains || {}).forEach(([domainId, domain]) => {
    if (!Array.isArray(domain.requirements) || !domain.requirements.length) throw new TypeError(`Character rule corpus domain ${domainId} has no requirements.`);
    RULESETS.forEach((ruleset) => {
      const edition = domain.editions?.[ruleset];
      if (!edition || !STATUSES.has(edition.status)) throw new TypeError(`Character rule corpus domain ${domainId} lacks ${ruleset} status.`);
      if (!edition.sourceIds?.length || edition.sourceIds.some((id) => !corpus.sources[id])) throw new TypeError(`Character rule corpus domain ${domainId} has invalid ${ruleset} sources.`);
      if (!edition.fixtures?.length) throw new TypeError(`Character rule corpus domain ${domainId} has no ${ruleset} fixtures.`);
      if (edition.dependencies.some((id) => !domainIds.has(id))) throw new TypeError(`Character rule corpus domain ${domainId} has an invalid dependency.`);
    });
  });
  return corpus;
}

function buildCharacterRuleCorpus({ catalogVersion, entries = [], rulesMetadata = {} }) {
  const domains = Object.fromEntries(Object.entries(DOMAINS).map(([domainId, definition]) => [domainId, {
    label: definition.label,
    requirements: definition.requirements,
    editions: Object.fromEntries(RULESETS.map((ruleset) => [ruleset, {
      status: definition.status,
      sourceIds: sourceIds(ruleset, domainId),
      entryIds: certifiedEntryIds(entries, rulesMetadata, ruleset, domainId),
      dependencies: definition.dependencies,
      fixtures: definition.fixtures,
    }])),
  }]));
  const statusCounts = Object.fromEntries(RULESETS.map((ruleset) => [ruleset, Object.fromEntries([...STATUSES].map((status) => [status, Object.values(domains).filter((domain) => domain.editions[ruleset].status === status).length]))]));
  return validateCharacterRuleCorpus({ version: 1, catalogVersion, rulesets: RULESETS, sources: SOURCES, domains, coverage: { domains: Object.keys(domains).length, statusCounts, unresolvedPointers: 0 } });
}

module.exports = { buildCharacterRuleCorpus, validateCharacterRuleCorpus };

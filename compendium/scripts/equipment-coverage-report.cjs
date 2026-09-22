// Audits equipment metadata and records honest automation/fixture boundaries.
const STATUSES = new Set(["rules-ready", "partial", "manual"]);
const ITEM_TYPES = new Set(["Armor", "Item", "Magic Item", "Weapon", "Weapon Group", "Weapon Property"]);
const FIXTURES = Object.freeze([
  "char/tests/inventory-rules.test.js",
  "char/tests/builder-completion-model.test.js",
  "char/tests/v4-inventory.test.js",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function effectiveRules(entry, metadata) {
  return metadata?.rulesOverride && typeof metadata.rulesOverride === "object"
    ? metadata.rulesOverride
    : entry?.rules && typeof entry.rules === "object" ? entry.rules : {};
}

function gapsFor(entry, metadata, profile) {
  const gaps = list(metadata?.automation?.reasons).map((reason) => ({ code: reason, message: `Automation gap: ${String(reason).replaceAll("-", " ")}.` }));
  list(metadata?.dependencies).filter(({ status }) => status !== "resolved").forEach(({ originalId }) => gaps.push({ code: "unresolved-dependency", sourceId: originalId, message: `Compendium dependency ${originalId} is unresolved.` }));
  if (profile.weapon && !profile.weapon.damage) gaps.push({ code: "missing-weapon-damage", message: "Weapon damage is not declared." });
  if (profile.armor && !profile.armor.armorClass) gaps.push({ code: "missing-armor-class", message: "Armor Class is not declared." });
  if (profile.container && !profile.container.capacity) gaps.push({ code: "missing-container-capacity", message: "Container capacity is not declared." });
  if (["Armor", "Item", "Magic Item", "Weapon"].includes(entry.type) && !profile.weight) gaps.push({ code: "missing-weight", message: "Item weight is not declared." });
  return gaps;
}

function itemProfile(entry, rules) {
  const setters = entry.setters || {};
  const inventory = rules.inventory && typeof rules.inventory === "object" ? rules.inventory : {};
  const supports = [...new Set([...list(entry.facets?.supports), ...text(entry.supports).split(",")].map(text).filter(Boolean))];
  const weapon = entry.type === "Weapon" || setters.damage || inventory.weapon ? {
    damage: text(inventory.weapon?.damage || setters.damage),
    damageTypes: list(entry.facets?.damageTypes),
    versatile: text(inventory.weapon?.versatile || setters.versatile),
    range: text(inventory.weapon?.range || setters.range),
    proficiency: text(inventory.weapon?.proficiency || setters.proficiency),
    properties: supports,
    mastery: text(inventory.weapon?.mastery),
  } : null;
  const armor = entry.type === "Armor" || setters.armorClass || inventory.armor ? {
    type: text(inventory.armor?.type || setters.armor || setters.type),
    armorClass: text(inventory.armor?.armorClass ?? inventory.armor?.base ?? setters.armorClass),
    strength: text(setters.strength),
    stealth: text(setters.stealth),
  } : null;
  const container = inventory.container || setters.container || setters.stash ? {
    capacity: text(inventory.container?.capacityWeight || setters.container),
    contentsWeightMultiplier: inventory.container?.contentsWeightMultiplier ?? null,
  } : null;
  return {
    category: text(setters.category),
    subtype: text(setters.type),
    cost: text(inventory.cost?.gp ?? inventory.cost ?? setters.cost),
    weight: text(inventory.weight ?? setters.weight),
    slot: text(setters.slot),
    stackable: text(setters.stackable),
    attunement: text(entry.facets?.attunement || setters.attunement),
    charges: inventory.charges ?? (text(setters.charges) || null),
    weapon,
    armor,
    container,
    modifiers: { grants: list(rules.grants).length, selections: list(rules.selections).length, stats: list(rules.stats).length },
  };
}

function startingPackages(entries, rulesMetadata) {
  return entries.flatMap((entry) => {
    const metadata = rulesMetadata[entry.id] || {};
    const rules = effectiveRules(entry, metadata);
    return ["startingEquipment", "equipment", "startingGold"].flatMap((field) => {
      const value = rules[field];
      if (value === undefined || value === null || (Array.isArray(value) && !value.length)) return [];
      return [{ sourceId: entry.id, sourceName: text(entry.name) || entry.id, sourceCategory: entry.category, ruleset: metadata.ruleset, source: text(metadata.source || entry.publication) || "Unknown Source", publisher: text(metadata.publisher) || "Unknown Publisher", field, value }];
    });
  });
}

function validateEquipmentCoverageReport(report) {
  if (report?.version !== 1 || !/^sha256-[a-f0-9]{20}$/.test(report.catalogVersion || "")) throw new TypeError("Equipment coverage report needs a versioned Compendium catalog.");
  if (!report.items?.length) throw new TypeError("Equipment coverage report has no items.");
  report.items.forEach((entry) => {
    if (!entry.id || !entry.originalId || !entry.source || !entry.publisher || !ITEM_TYPES.has(entry.type) || !STATUSES.has(entry.status)) throw new TypeError(`Equipment ${entry.id || "(missing)"} lacks type, provenance, or status.`);
    if (entry.status !== "rules-ready" && !entry.gaps.length) throw new TypeError(`Equipment ${entry.id} hides incomplete automation.`);
  });
  for (const ruleset of ["5e", "5.5e"]) if (!report.editions?.[ruleset]?.fixtures?.length) throw new TypeError(`Equipment coverage lacks ${ruleset} fixtures.`);
  return report;
}

function buildEquipmentCoverageReport({ catalogVersion, entries = [], rulesMetadata = {} }) {
  const items = entries.filter(({ category }) => category === "items").map((entry) => {
    const metadata = rulesMetadata[entry.id] || {};
    const rules = effectiveRules(entry, metadata);
    const profile = itemProfile(entry, rules);
    return {
      id: entry.id,
      originalId: text(entry.originalId),
      name: text(entry.name) || entry.id,
      type: entry.type,
      ruleset: metadata.ruleset,
      source: text(metadata.source || entry.publication) || "Unknown Source",
      publisher: text(metadata.publisher) || "Unknown Publisher",
      status: STATUSES.has(metadata.automation?.status) ? metadata.automation.status : "manual",
      profile,
      dependencies: list(metadata.dependencies),
      gaps: gapsFor(entry, metadata, profile),
    };
  }).sort((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const packages = startingPackages(entries, rulesMetadata);
  return validateEquipmentCoverageReport({
    version: 1,
    catalogVersion,
    scope: "Every item is audited for cost, weight, containers, weapons, armor, attunement, charges, modifiers, provenance, and automation. Starting packages stay explicit when absent.",
    items,
    startingPackages: packages,
    editions: Object.fromEntries(["5e", "5.5e"].map((ruleset) => [ruleset, {
      itemIds: items.filter((item) => item.ruleset === ruleset || item.ruleset === "agnostic").map(({ id }) => id),
      startingPackageSourceIds: packages.filter((item) => item.ruleset === ruleset || item.ruleset === "agnostic").map(({ sourceId }) => sourceId),
      fixtures: FIXTURES,
      warnings: packages.some((item) => item.ruleset === ruleset || item.ruleset === "agnostic") ? [] : [{ code: "missing-starting-packages", message: `${ruleset} starting-equipment packages are not declared in current Compendium automation.` }],
    }])),
    summary: {
      items: items.length,
      types: Object.fromEntries([...ITEM_TYPES].map((type) => [type, items.filter((item) => item.type === type).length])),
      statuses: Object.fromEntries([...STATUSES].map((status) => [status, items.filter((item) => item.status === status).length])),
      weapons: items.filter(({ profile }) => profile.weapon).length,
      armor: items.filter(({ profile }) => profile.armor).length,
      containers: items.filter(({ profile }) => profile.container).length,
      chargedItems: items.filter(({ profile }) => profile.charges !== null).length,
      modifierItems: items.filter(({ profile }) => Object.values(profile.modifiers).some(Boolean)).length,
      startingPackages: packages.length,
      itemsWithGaps: items.filter(({ gaps }) => gaps.length).length,
      unresolvedDependencies: items.reduce((sum, item) => sum + item.dependencies.filter(({ status }) => status !== "resolved").length, 0),
    },
  });
}

module.exports = { buildEquipmentCoverageReport, validateEquipmentCoverageReport };

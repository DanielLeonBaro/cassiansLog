// Builds conservative V4 feature, extra, and detail models from stored sheet data.
const FEATURE_GROUPS = Object.freeze([
  Object.freeze({ id: "class", label: "Class" }),
  Object.freeze({ id: "subclass", label: "Subclass" }),
  Object.freeze({ id: "species", label: "Species / Race" }),
  Object.freeze({ id: "background", label: "Background" }),
  Object.freeze({ id: "feat", label: "Feats" }),
  Object.freeze({ id: "other", label: "Other" }),
]);

export const V4_EXTRA_TYPES = Object.freeze([
  Object.freeze({ id: "companion", label: "Companions" }),
  Object.freeze({ id: "familiar", label: "Familiars" }),
  Object.freeze({ id: "wild-shape", label: "Wild Shapes" }),
  Object.freeze({ id: "vehicle", label: "Vehicles" }),
  Object.freeze({ id: "custom", label: "Custom Extras" }),
]);

function text(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return text(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim();
}

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values);
  if (value && typeof value === "object") return Object.values(value).flatMap(values);
  return text(value) ? [text(value)] : [];
}

export function v4FeatureGroupId(feature = {}, character = {}) {
  const source = normalized([feature.sourceType, feature.type, feature.category, feature.source].filter(Boolean).join(" "));
  const subclass = normalized(character.subclass);
  const species = normalized(character.race || character.species);
  const background = normalized(character.background);
  if (source.includes("subclass") || (subclass && source.includes(subclass))) return "subclass";
  if (source.includes("racial") || source.includes("race") || source.includes("species") || (species && source.includes(species))) return "species";
  if (source.includes("background") || (background && source.includes(background))) return "background";
  if (source.includes("class")) return "class";
  if (source.includes("feat")) return "feat";
  return "other";
}

function selectedValues(feature, character) {
  const direct = values(feature.selections || feature.selected || feature.choices);
  const sourceIds = [feature.id, feature.sourceId].map(text).filter(Boolean);
  const build = character.build?.selections;
  if (!build || typeof build !== "object" || !sourceIds.length) return [...new Set(direct)];
  const linked = Object.entries(build)
    .filter(([key]) => sourceIds.some((id) => key === id || key.startsWith(`${id}:`) || key.includes(`:${id}:`)))
    .flatMap(([, value]) => values(value));
  return [...new Set([...direct, ...linked])];
}

function linkedResource(feature, character) {
  if (feature.uses) return { id: feature.id, name: feature.name, uses: feature.uses };
  const resources = Array.isArray(character.resources) ? character.resources : [];
  return resources.find((resource) => resource.id === feature.resourceId)
    || resources.find((resource) => normalized(resource.name) === normalized(feature.name)) || null;
}

export function v4FeatureGroups(character = {}) {
  const groups = new Map(FEATURE_GROUPS.map((group) => [group.id, { ...group, features: [] }]));
  (Array.isArray(character.features) ? character.features : []).forEach((feature, index) => {
    const id = text(feature.id) || `feature-${index + 1}`;
    const groupId = v4FeatureGroupId(feature, character);
    groups.get(groupId).features.push({
      ...feature,
      id,
      name: text(feature.name) || `Feature ${index + 1}`,
      description: text(feature.description),
      sourceLabel: text(feature.source || feature.category || feature.type),
      selections: selectedValues(feature, character),
      resource: linkedResource({ ...feature, id }, character),
    });
  });
  return [...groups.values()].filter((group) => group.features.length);
}

export function v4ExtraGroups(character = {}) {
  const groups = new Map(V4_EXTRA_TYPES.map((group) => [group.id, { ...group, extras: [] }]));
  (Array.isArray(character.extras) ? character.extras : []).forEach((extra, index) => {
    const requestedType = normalized(extra.type).replaceAll(" ", "-");
    const type = groups.has(requestedType) ? requestedType : "custom";
    const max = Math.max(0, Number(extra.hp?.max) || 0);
    groups.get(type).extras.push({
      ...extra,
      id: text(extra.id) || `extra-${index + 1}`,
      name: text(extra.name) || `Extra ${index + 1}`,
      type,
      sourceLabel: text(extra.source || extra.sourceId) || (type === "custom" ? "Manual" : "Compendium"),
      description: text(extra.description || extra.notes),
      hp: max ? { ...extra.hp, max, current: Math.max(0, Math.min(max, Number(extra.hp.current ?? max) || 0)), temp: Math.max(0, Number(extra.hp.temp) || 0) } : null,
    });
  });
  return [...groups.values()].filter((group) => group.extras.length);
}

export function v4BackgroundDetails(character = {}) {
  const description = character.build?.description && typeof character.build.description === "object"
    ? character.build.description : {};
  return {
    name: text(character.background) || "—",
    fields: [
      ["Personality", description.personalityTraits || character.personalityTraits],
      ["Ideals", description.ideals || character.ideals],
      ["Bonds", description.bonds || character.bonds],
      ["Flaws", description.flaws || character.flaws],
      ["Backstory", description.backstory || character.backstory],
      ["Allies", description.allies || character.allies],
      ["Organizations", description.organizations || character.organizations],
      ["Other notes", description.notes || character.descriptionNotes],
    ].flatMap(([label, value]) => text(value) ? [{ label, value: text(value) }] : []),
  };
}

export function v4DetailRecord(character = {}, kind, id) {
  const record = kind === "feature"
    ? v4FeatureGroups(character).flatMap((group) => group.features).find((item) => item.id === id)
    : kind === "extra"
      ? v4ExtraGroups(character).flatMap((group) => group.extras).find((item) => item.id === id)
      : null;
  if (!record) return null;
  return {
    kind,
    id: record.id,
    name: record.name,
    eyebrow: record.sourceLabel || (kind === "extra" ? "Extra" : "Feature"),
    description: record.description || "No description recorded.",
    selections: record.selections || [],
    stats: kind === "extra" ? [
      record.ac !== undefined ? ["AC", record.ac] : null,
      record.hp ? ["HP", `${record.hp.current}/${record.hp.max}${record.hp.temp ? ` +${record.hp.temp} temp` : ""}`] : null,
      record.speed ? ["Speed", record.speed] : null,
      record.uses ? ["Uses", `${record.uses.current}/${record.uses.max}`] : null,
    ].filter(Boolean) : [],
  };
}

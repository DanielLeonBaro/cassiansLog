// Defines the shared V3 tracker grid contract, normalization, ordering, and packing rules.
export const V3_SECTION_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "character-overview", label: "Character Info", elementIds: ["characterDescription"], defaultSpan: 1 }),
  Object.freeze({ id: "quick-stats", label: "Quick Stats", elementIds: ["quickStatsCard"], defaultSpan: 1 }),
  Object.freeze({ id: "skills-and-saves", label: "Skills & Saving Throws", elementIds: ["combatAccordion"], defaultSpan: 2 }),
  Object.freeze({ id: "hit-points", label: "HP Manager & Death Saves", elementIds: ["hpManager", "death-saves-section"], defaultSpan: 1 }),
  Object.freeze({ id: "combat", label: "Combat Resources", elementIds: ["combatResources"], defaultSpan: 1 }),
  Object.freeze({ id: "spellcasting", label: "Spellcasting & Prepared Spells", elementIds: ["spellcastingSection", "preparedSpellsSection"], defaultSpan: 1 }),
  Object.freeze({ id: "all-possibilities", label: "All Possibilities", elementIds: ["allPossibilities"], defaultSpan: 1 }),
  Object.freeze({ id: "inventory", label: "Inventory", elementIds: ["inventory-page"], defaultSpan: 1 }),
  Object.freeze({ id: "notes", label: "Notes", elementIds: ["notesSection"], defaultSpan: 1 }),
]);

const definitions = new Map(V3_SECTION_DEFINITIONS.map((definition) => [definition.id, definition]));

export const DEFAULT_V3_LAYOUT = Object.freeze({
  version: 1,
  columns: 2,
  sections: Object.freeze(V3_SECTION_DEFINITIONS.map(({ id, defaultSpan }) => Object.freeze({
    id,
    span: defaultSpan,
  }))),
});

function normalizedColumns(value) {
  return Number(value) === 3 ? 3 : 2;
}

function normalizedSpan(value, columns, fallback = 1) {
  const candidate = Number.isInteger(Number(value)) ? Number(value) : fallback;
  return Math.max(1, Math.min(columns, candidate));
}

export function normalizeV3Layout(value) {
  const columns = normalizedColumns(value?.columns);
  const source = Array.isArray(value?.sections) ? value.sections : [];
  const seen = new Set();
  const sections = [];
  source.forEach((section) => {
    const definition = definitions.get(section?.id);
    if (!definition || seen.has(definition.id)) return;
    seen.add(definition.id);
    sections.push({
      id: definition.id,
      span: normalizedSpan(section.span, columns, definition.defaultSpan),
    });
  });
  V3_SECTION_DEFINITIONS.forEach((definition) => {
    if (seen.has(definition.id)) return;
    sections.push({
      id: definition.id,
      span: normalizedSpan(definition.defaultSpan, columns),
    });
  });
  return { version: 1, columns, sections };
}

export function validV3Layout(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.version !== 1 || ![2, 3].includes(value.columns) || !Array.isArray(value.sections)) return false;
  if (value.sections.length !== V3_SECTION_DEFINITIONS.length) return false;
  const ids = new Set();
  return value.sections.every((section) => {
    if (!section || typeof section !== "object" || !definitions.has(section.id) || ids.has(section.id)) return false;
    ids.add(section.id);
    return Number.isInteger(section.span) && section.span >= 1 && section.span <= value.columns;
  });
}

export function moveV3SectionBefore(value, sectionId, targetId) {
  const layout = normalizeV3Layout(value);
  if (sectionId === targetId || !definitions.has(sectionId) || !definitions.has(targetId)) return layout;
  const moving = layout.sections.find((section) => section.id === sectionId);
  const remaining = layout.sections.filter((section) => section.id !== sectionId);
  remaining.splice(remaining.findIndex((section) => section.id === targetId), 0, moving);
  return { ...layout, sections: remaining };
}

export function moveV3SectionBy(value, sectionId, delta) {
  const layout = normalizeV3Layout(value);
  const fromIndex = layout.sections.findIndex((section) => section.id === sectionId);
  const toIndex = Math.max(0, Math.min(layout.sections.length - 1, fromIndex + Number(delta)));
  if (fromIndex < 0 || fromIndex === toIndex) return layout;
  const sections = [...layout.sections];
  const [moving] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, moving);
  return { ...layout, sections };
}

export function setV3Columns(value, columns) {
  return normalizeV3Layout({ ...normalizeV3Layout(value), columns });
}

export function setV3SectionSpan(value, sectionId, span) {
  const layout = normalizeV3Layout(value);
  if (!definitions.has(sectionId)) return layout;
  return {
    ...layout,
    sections: layout.sections.map((section) => section.id === sectionId
      ? { ...section, span: normalizedSpan(span, layout.columns, section.span) }
      : section),
  };
}

export function packV3Layout(value) {
  const layout = normalizeV3Layout(value);
  let row = 1;
  let used = 0;
  return layout.sections.map((section) => {
    if (used && used + section.span > layout.columns) {
      row += 1;
      used = 0;
    }
    const position = { ...section, row, column: used + 1 };
    used += section.span;
    if (used === layout.columns) {
      row += 1;
      used = 0;
    }
    return position;
  });
}


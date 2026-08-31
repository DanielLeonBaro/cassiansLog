// Defines and normalizes the persistent V1 tracker section order.
export const V1_SECTION_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "character-overview", label: "Character Overview", elementIds: ["characterDescription"] }),
  Object.freeze({ id: "character-stats", label: "Quick Stats & Skills", elementIds: ["quickStatsCard", "combatAccordion"] }),
  Object.freeze({ id: "hit-points", label: "HP Manager & Death Saves", elementIds: ["hpManager", "death-saves-section"] }),
  Object.freeze({ id: "combat", label: "Combat Resources", elementIds: ["combatResources"] }),
  Object.freeze({ id: "spellcasting", label: "Spellcasting", elementIds: ["spellcastingSection"] }),
  Object.freeze({ id: "prepared-spells", label: "Prepared Spells", elementIds: ["preparedSpellsSection"] }),
  Object.freeze({ id: "all-possibilities", label: "All Possibilities", elementIds: ["allPossibilities"] }),
  Object.freeze({ id: "inventory", label: "Inventory", elementIds: ["inventory-page"] }),
  Object.freeze({ id: "notes", label: "Notes", elementIds: ["notesSection"] }),
]);

export const DEFAULT_V1_SECTION_ORDER = Object.freeze(
  V1_SECTION_DEFINITIONS.map(({ id }) => id),
);

const validSectionIds = new Set(DEFAULT_V1_SECTION_ORDER);

export function normalizeV1SectionOrder(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  source.forEach((id) => {
    if (!validSectionIds.has(id) || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });
  DEFAULT_V1_SECTION_ORDER.forEach((id) => {
    if (!seen.has(id)) normalized.push(id);
  });
  return normalized;
}

export function moveV1SectionBefore(value, sectionId, targetId) {
  const order = normalizeV1SectionOrder(value);
  if (sectionId === targetId || !validSectionIds.has(sectionId) || !validSectionIds.has(targetId)) {
    return order;
  }
  const withoutSection = order.filter((id) => id !== sectionId);
  const targetIndex = withoutSection.indexOf(targetId);
  withoutSection.splice(targetIndex, 0, sectionId);
  return withoutSection;
}

export function moveV1SectionBy(value, sectionId, delta) {
  const order = normalizeV1SectionOrder(value);
  const fromIndex = order.indexOf(sectionId);
  const toIndex = Math.max(0, Math.min(order.length - 1, fromIndex + Number(delta)));
  if (fromIndex < 0 || fromIndex === toIndex) return order;
  const [section] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, section);
  return order;
}

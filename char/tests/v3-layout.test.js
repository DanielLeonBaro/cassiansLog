// Verifies V3 defaults, malformed-input recovery, movement, clamping, and packing.
import assert from "node:assert/strict";
import {
  DEFAULT_V3_LAYOUT,
  V3_SECTION_DEFINITIONS,
  moveV3SectionBefore,
  moveV3SectionBy,
  normalizeV3Layout,
  packV3Layout,
  setV3Columns,
  setV3SectionSpan,
  validV3Layout,
} from "../../shared/js/v3-layout.js";

const defaults = normalizeV3Layout();
assert.deepEqual(defaults, DEFAULT_V3_LAYOUT);
assert.equal(defaults.columns, 2);
assert.deepEqual(defaults.sections.map(({ id }) => id), V3_SECTION_DEFINITIONS.map(({ id }) => id));
assert.equal(defaults.sections.find(({ id }) => id === "skills-and-saves").span, 2);

const malformed = normalizeV3Layout({
  version: 99,
  columns: 3,
  sections: [
    { id: "notes", span: 99 },
    { id: "notes", span: 1 },
    { id: "unknown", span: 2 },
    { id: "inventory", span: "bad" },
  ],
});
assert.equal(malformed.version, 1);
assert.equal(malformed.columns, 3);
assert.equal(malformed.sections.length, 9);
assert.deepEqual(malformed.sections.slice(0, 2), [{ id: "notes", span: 3 }, { id: "inventory", span: 1 }]);
assert.equal(new Set(malformed.sections.map(({ id }) => id)).size, 9);
assert.equal(validV3Layout(malformed), true);
assert.equal(validV3Layout({ ...malformed, sections: malformed.sections.slice(1) }), false);
assert.equal(validV3Layout({ ...malformed, sections: malformed.sections.map((section) => ({ ...section, span: 4 })) }), false);

const moved = moveV3SectionBefore(defaults, "notes", "quick-stats");
assert.deepEqual(moved.sections.slice(0, 3).map(({ id }) => id), ["character-overview", "notes", "quick-stats"]);
assert.equal(moveV3SectionBy(moved, "notes", -1).sections[0].id, "notes");

let threeColumns = setV3Columns(defaults, 3);
threeColumns = setV3SectionSpan(threeColumns, "character-overview", 3);
assert.equal(threeColumns.sections[0].span, 3);
const twoColumns = setV3Columns(threeColumns, 2);
assert.equal(twoColumns.sections[0].span, 2, "Three-column spans must clamp when switching to two columns.");

const example = normalizeV3Layout({
  version: 1,
  columns: 3,
  sections: V3_SECTION_DEFINITIONS.map(({ id }) => ({
    id,
    span: id === "character-overview" ? 2 : id === "skills-and-saves" ? 3 : 1,
  })),
});
const packed = packV3Layout(example);
assert.deepEqual(packed.slice(0, 3).map(({ row, column, span }) => ({ row, column, span })), [
  { row: 1, column: 1, span: 2 },
  { row: 1, column: 3, span: 1 },
  { row: 2, column: 1, span: 3 },
]);
assert.deepEqual(packed.slice(3, 6).map(({ row, column }) => ({ row, column })), [
  { row: 3, column: 1 },
  { row: 3, column: 2 },
  { row: 3, column: 3 },
]);

console.log("V3 layout normalization, controls, and packing tests passed.");

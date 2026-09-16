# Character Builder and Tracker V4 Work

This is the durable specification and progress log for the D&D Beyond-style Character Builder and opt-in V4 tracker. Update this file whenever a task starts, changes scope, finishes, or fails verification.

## Working Rules

- Work one numbered task at a time. `In Progress` contains zero or one task.
- A task moves to `Done` only after its focused checks pass and evidence is added to `Verification Log`.
- Preserve V1, V2, V3, existing character data, URLs, exports, local storage, D1 behavior, import fallbacks, and authorization unless an acceptance criterion explicitly changes them.
- Do not hand-edit generated Compendium data. Change the generator, regenerate, and verify deterministic output.
- Do not deploy, apply a remote migration, seed remote D1, or mutate production data without separate explicit approval and a verified recovery point.
- Stop at the task boundary. Record newly discovered work here instead of silently expanding the active task.

## Status

- Current milestone: Final audit
- Completed through: Task 31
- Next task: Task 32 — final acceptance audit
- Initial vertical slice: Fighter, Wizard, Human, Sage, and Soldier, levels 1–5, in `5e` and `5.5e`
- Final core target: all twelve core classes, levels 1–20, with multiclassing

## Decisions

- Each character selects exactly one ruleset: `5e` or `5.5e`. Choices from different rulesets are never combined silently.
- Parity means equivalent behavior, workflow, information hierarchy, calculations, and responsive usability. Cassian's Log retains its own components, colors, type, language, and interaction styling.
- V4 is opt-in. V1–V3 remain available and retain their current behavior.
- The existing flat character document remains the compatibility projection. The versioned `build` block is the rules-mode source of truth.
- Rules automation is staged and evidence-based. Every Compendium entry receives `rules-ready`, `partial`, or `manual` coverage; only `rules-ready` entries may apply automatic effects without a warning.
- Browseability and automation are separate. Partial and manual entries remain selectable and readable.
- Automatic values expose source traces. A user may override a derived value only with an explicit reason and may reset it to automatic.
- The detailed guided builder is the primary rules-aware workflow. Quick Setup, blank creation, D&D Beyond URL import, and PDF import remain alternate workflows.
- Valid builder edits save locally first, synchronize to D1 immediately when available, expose pending/error state, and resume the last incomplete step.
- Character functionality ships before NPC functionality. NPC work later supports both rules-built NPCs and current freeform/stat-block NPCs.
- Rules delivery is staged: first single-class levels 1–5, then levels 6–20, then multiclass behavior. Final acceptance still requires levels 1–20 and multiclassing.
- Existing characters enter V4 in manual mode. Automatic conversion is opt-in and previewed; it never recalculates an existing character silently.
- D&D Beyond imports preserve imported totals as a snapshot. Rules automation begins only after a separate mapping review confidently matches rules-ready content.
- Cassian's existing dice UI performs character, attack, damage, healing, and spell rolls. Confirmed use may consume a slot or resource; target selection, automatic target damage, maps, and VTT behavior remain outside scope.
- Prepared spells, current HP, temporary HP, death saves, expended slots, resource uses, conditions, concentration, equipped state, and attunement are runtime state, not regenerated build choices.
- Ruleset changes after choices exist show a destructive preview and require confirmation before incompatible choices are cleared.
- No runtime feature depends on D&D Beyond's unsupported internal character API.
- D&D Beyond assets, CSS, branding, proprietary code, and marketplace/entitlement behavior are not copied.

## D&D Beyond Reference Baseline

Research date: **2026-09-13**. Re-audit before the final V4 visual acceptance because D&D Beyond changes independently.

Reference pages:

- [Current D&D Beyond character builder](https://www.dndbeyond.com/play/characters/build)
- [Public Gwendoline character sheet](https://www.dndbeyond.com/characters/14417185)
- [2024 character creation rules](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character)

### Builder behavior observed

- The current quick builder starts with Class, Species, Background, portrait, and name.
- Class browsing exposes ruleset, publisher, and complexity filters. Species and Background browsing expose ruleset, publisher, and search filters.
- The full builder's information architecture exposes Home, Class, Background, Species/Race, Ability Scores, Equipment, Description, Review/What's Next, Manage Spells, and Manage Inventory concerns.
- Choices expose level gates, required selection counts, unavailable states, prerequisites, and content sources where applicable.
- Character creation separates durable build choices from mutable play state.

### Public sheet characteristics observed

- Identity: portrait, name, pronouns/sex where supplied, species/race, background, classes/subclasses, individual class levels, total level, and XP.
- Core scores: six abilities and modifiers, proficiency bonus, inspiration, speed, initiative, AC, maximum/current/temporary HP, hit dice, and death saves.
- Checks: saving throws, all 18 skills, none/half/proficient/expertise states, passive Perception, passive Investigation, passive Insight, senses, languages, and proficiencies.
- State: defenses, resistances, immunities, vulnerabilities, conditions, exhaustion, concentration, and limited-use resources.
- Actions: All, Attack, Action, Bonus Action, Reaction, Other, and Limited Use filters; range, hit/save, damage/effect, notes, and use tracking.
- Spells: spellcasting ability/modifier, attack bonus, save DC, known/prepared/spellbook distinctions, level filters, cantrips, slots, casting, upcasting, ritual, concentration, components, range, duration, effect, and notes.
- Inventory: search and filters, active/equipped state, quantity, weight, cost, notes, currency, encumbrance, containers/capacity, attunement slots, charges, and item details.
- Features & Traits: class, subclass, species, background, and feat groups with selections, sources, and attached resources.
- Extras: companions, familiars, wild shapes, vehicles, creatures, and custom extras.
- Secondary information: description, appearance, personality, ideals, bonds, flaws, allies, organizations, backstory, notes, and campaign information.

### Gwendoline golden reference

The existing importer regression uses the exported PDF as truth. Known reference values are HP `45`, AC `16`, initiative `+4`, darkvision `60`, spell save DC `15`, spell attack `+7`, Bardic Inspiration `4 / short rest`, and Rapier `+9`, `1d8+6 Piercing`. The URL importer uses an unsupported D&D Beyond endpoint and must retain the PDF fallback.

## Current Repository Baseline

Baseline captured on **2026-09-13**, branch `main`, commit `0ad6eb1`.

### Existing seams to preserve and reuse

- `char/template/character.json`: flat compatibility document containing identity, abilities, skills, saves, combat totals, actions, spellcasting profiles/slots, spells, features, resources, inventory, and currency.
- `char/js/editor/`: current character editor, schema, model, Compendium extension seam, V1 order, and V3 personal layout editing.
- `char/js/archive/`: Quick Setup, blank creation, D&D Beyond URL/PDF import, local-first repository, cards, and campaign-aware routing.
- `char/js/tracker/`: tracker rendering, runtime state, rolls, hit points, death saves, spellcasting, filters, rests, notes, and V1–V3 layouts.
- `integrations/character-compendium/`: intentional public Character–Compendium mapping boundary. Cross-feature code stays here.
- `compendium/scripts/build.cjs`: owner of generated Compendium entries. Generated files under `compendium/data/` are not hand-edited.
- `cloudflare/routes/characters.js` and `cloudflare/routes/campaign-characters.js`: global and campaign character persistence/authorization boundaries.
- `cloudflare/migrations/0001_initial.sql` and `0012_campaigns.sql`: existing full-document and separate runtime tables.
- `shared/js/dice/`: reusable dice formula, rolling, and history behavior.
- `shared/js/settings.js`, `cloudflare/settings.js`, and Admin/editor controls: current V1–V3 style contracts that Task 17 must extend additively.

### Current data and behavior

- Full character JSON persists in `characters` or campaign-isolated `campaign_characters`.
- Runtime state persists separately in `character_runtime` or `campaign_character_runtime`.
- V3 layout is user/campaign/character scoped; V4 must not reuse or overwrite those records.
- The editor preserves unknown fields through its Additional fields boundary.
- Creation saves locally before navigation and attempts D1 without discarding local recovery when cloud save fails.
- Existing D&D Beyond import mapping calculates many snapshot values but is not a general rules engine.
- Current sheet-style enumerations accept only `v1`, `v2`, and `v3`.
- The audit-created untracked `.playwright-cli/` directory contained only generated page snapshots and console logs. Task 1 removed it after exact inspection; it is regenerable and was never tracked.

### Compendium inventory at baseline

Generated manifest: 15,191 entries from 1,951 input files. The presence of parsed `rules` is not proof that an entry is `rules-ready`; Task 3 introduces explicit coverage classification.

| Category | Entries | Entries with parsed `rules` | Existing `add` mapping |
|---|---:|---:|---:|
| Classes | 44 | 44 | 44 |
| Subclasses | 543 | 543 | 543 |
| Races & lineages | 340 | 338 | 340 |
| Backgrounds | 176 | 173 | 176 |
| Feats | 432 | 352 | 432 |
| Spells | 2,046 | 1 | 2,046 |
| Items | 3,139 | 603 | 3,139 |
| Features & traits | 7,112 | 2,915 | 7,112 |

## Character Format

### Versioned build source

Legacy fields remain present. A rules-aware character adds this source-of-truth block:

```js
{
  characterSchemaVersion: 2,
  build: {
    version: 1,
    mode: "rules" | "manual",
    status: "incomplete" | "complete",
    ruleset: "5e" | "5.5e",
    catalogVersion: "...",
    preferences: {
      progression: "xp" | "milestone",
      hitPoints: "fixed" | "manual",
      encumbrance: "none" | "standard" | "variant",
      coinWeight: true,
      prerequisites: true,
      enabledSources: [],
      contentFilters: {
        publisher: "",
        automation: "" | "rules-ready" | "partial" | "manual",
      },
    },
    levels: [
      { classId: "", subclassId: "", level: 1, hitPointRolls: [] },
    ],
    speciesId: "",
    backgroundId: "",
    abilityScores: {
      method: "standard" | "point-buy" | "manual" | "rolled",
      base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      rolls: [15, 14, 13, 12, 10, 8], // present for stored rolled scores
    },
    selections: {},
    spells: {
      knownIds: [],
      spellbookIds: [],
      assignments: {
        "stable-spell-id": { profileId: "wizard", repertoire: "spellbook" },
      },
    },
    inventory: [
      { instanceId: "", definitionId: "", quantity: 1, containerId: "" },
    ],
    equipmentMethod: "equipment" | "gold",
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    description: {},
    overrides: {
      "path.to.value": { value: 0, reason: "" },
    },
  },
}
```

Rules normalization must preserve unknown top-level fields, unknown `build` fields, and valid legacy values. A legacy character without `characterSchemaVersion` normalizes idempotently into manual mode without changing its projected totals.

Rule selections use a deterministic key: `<source stable ID>:selection:<zero-based rule index>`. Each value is a stable Compendium ID, original source ID, list-item ID, or an array of those values. Object form `{ selectedIds: [] }` is also accepted. Display names are never persistence keys. The evaluator retains invalid values for review while applying only resolved choices within the allowed count.

### Rules engine contract

```js
evaluateCharacter({ character, catalog, runtime }) => ({
  sheet,       // complete flat compatibility projection for existing consumers
  trace,       // path-keyed source contributions and applied override details
  warnings,    // stable warning codes plus paths, entry IDs, and user-facing context
});
```

The evaluator is pure: no DOM, storage, network, clock, or random access. Rolled ability results and rolled HP are inputs stored in the build document, not generated inside evaluation.

Task 4 introduces `evaluateCharacterBuild({ character, catalog })` as the pure non-numeric graph stage composed by the final engine. It returns resolved roots, active entries, grant statuses, choice states/options, and stable warnings. Only `rules-ready` sources expand rules. Partial/manual entries remain active for display but never apply nested effects. Numeric sheet projection and calculation traces begin in Task 5.

Task 5 composes that graph through `evaluateCharacter({ character, catalog, runtime })`. Manual mode returns the exact legacy projection with no recalculation. Rules mode materializes the progressively certified flat sheet fields without changing this contract.

Task 8 adds declarative `rules.spellcasting` profiles to rules-ready entries. Each profile identifies its stable ID, ability, spell list, class level context, repertoire (`known`, `prepared`, or `spellbook`), ritual access, preparation formula/table, cantrip scaling, and slot progression (`full`, `half-down`, `half-up`, `third-down`, `pact`, or `none`). Class identity is never inferred from a display name. Standard multiclass and Pact Magic slot tables are rules-engine constants; each profile supplies its rounding/progression rule. Ambiguous multiclass spells require a stored `build.spells.assignments` entry and remain blocked when one is absent.

Trace records are keyed by their flat sheet path. Each record is `{ value, sources }`; each source has a stable `kind`, `sourceId`, label, and contribution value. Rule sources also include original ID and rule index. Proficiency sources expose multiplier or half-proficiency rounding so the UI can distinguish none, half, proficient, and expertise without changing the legacy skill boolean.

Trace entries must distinguish base values, ability/proficiency contributions, rules grants, equipment, conditions, runtime effects, and overrides. Dependents consume the overridden value where the override's path owns the relevant input or total.

Warnings must cover unresolved references, partial/manual automation, invalid or incomplete selections, ruleset mismatch, unavailable source, unmet prerequisite, and unsupported rule expressions. Unknown rules are surfaced, never guessed.

### Runtime state

The existing runtime document remains the owner of mutable play state. It will be extended only as the relevant tasks require, retaining unknown fields and existing defaults:

- current/temporary HP and death saves;
- expended hit dice, spell slots, pact slots, charges, and limited-use resources;
- prepared-spell selection when preparation is allowed to change during play;
- conditions, exhaustion, concentration, inspiration, and other toggles;
- inventory equipped/active state, attunement, container placement where mutable, and quantities consumed during play;
- custom tracker state and notes.

### Compendium rule metadata

Task 3 will define generated metadata equivalent to:

```js
{
  id: "stable-cassian-id",
  originalId: "source-id",
  ruleset: "5e" | "5.5e" | "agnostic" | "unknown",
  publisher: "...",
  publication: "...",
  source: "...",
  dependencies: [{ originalId: "...", resolvedId: "...", status: "resolved" | "missing" }],
  automation: {
    status: "rules-ready" | "partial" | "manual",
    reasons: [],
  },
}
```

Stable IDs must not change when display names or summaries change. Original IDs require a deterministic lookup index. `rules-ready` requires all rule expressions used by the entry to be supported and all required dependencies to resolve.

### Builder draft persistence

Drafts are separate from final characters so incomplete work can resume without polluting the archive.

- Local draft key ownership will live in `char/js/storage-keys.js`.
- Additive D1 tables will isolate global drafts by user and campaign drafts by campaign plus user, with draft ID, normalized document JSON, current step, timestamps, and status/version metadata.
- Global API: `GET|PUT|DELETE /api/character-build-drafts/:draftId` and `POST /api/character-build-drafts/:draftId/finalize`.
- Campaign API: equivalent routes below `/api/campaigns/:slug/character-build-drafts/:draftId`.
- Finalize validates ownership and membership, normalizes the draft, inserts the final character without overwriting an occupied ID, assigns the creating player in a campaign, and marks/removes the draft in the same D1 batch.
- A collision returns `409`; it never overwrites an existing character.
- Local finalization preserves recovery if D1 is unavailable and exposes synchronization failure.

## Acceptance Criteria

### Guided builder

- **BLD-001 — Entry paths:** New Character offers Detailed Build while Quick Setup, blank creation, D&D Beyond URL import, and PDF import remain functional.
- **BLD-002 — Steps:** Home, Class, Background, Species/Race, Abilities, Equipment, Description, and Review exist and preserve valid work through Back, Next, and direct navigation.
- **BLD-003 — Progress state:** Every step reports complete, incomplete, warning, or blocked state; resume opens the last incomplete required step.
- **BLD-004 — Local-first drafts:** Every valid edit saves locally immediately, attempts D1 synchronization, and exposes saved, pending, and failure/retry states.
- **BLD-005 — Ruleset safety:** Each draft chooses `5e` or `5.5e`; changing it previews incompatible data and requires confirmation before clearing.
- **BLD-006 — Catalog filters:** Ruleset, publisher/source, publication, and automation-coverage filters are available and mutually consistent.
- **BLD-007 — Choice validation:** Prerequisites, level gates, required choice counts, duplicate restrictions, unavailable reasons, and unresolved references are visible and enforced.
- **BLD-008 — Abilities:** Standard array, 27-point buy, manual entry, and stored rolled scores are supported with method-specific validation.
- **BLD-009 — Character choices:** Class levels, subclasses, proficiencies, feature choices, feats/ASIs, species/background grants, and starting equipment/gold are supported.
- **BLD-010 — Spells and description:** Spell repertoire choices and complete description/background fields are supported.
- **BLD-011 — Review and finish:** Review lists unresolved required choices, partial/manual entries, warnings, and overrides; Finish blocks only missing required structure.
- **BLD-012 — Safe finalization:** Finalization is collision-safe, preserves local recovery on cloud failure, creates the final document, and assigns its creator when campaign-scoped.
- **BLD-013 — Accessibility:** Builder navigation, dialogs, choices, validation, focus movement/restoration, announcements, keyboard use, mobile layout, and themes are accessible.

### Rules and calculations

- **RUL-001 — Core abilities:** Ability scores/modifiers, proficiency bonus, saves, skills, expertise, half proficiency, passive scores, and initiative calculate by selected ruleset.
- **RUL-002 — Durability:** Maximum HP, hit dice, AC, movement, senses, languages, proficiencies, defenses, and vulnerabilities calculate from supported sources.
- **RUL-003 — Actions:** Weapon, unarmed, and spell attacks expose attack/save, damage/effect, properties/masteries, action type, range, and limited-use resources.
- **RUL-004 — Spellcasting:** Known, prepared, spellbook, always-prepared, granted, ritual, pact-magic, cantrip scaling, upcasting, and multiclass slot math are supported.
- **RUL-005 — Inventory:** Instances, quantity, cost, weight, currency, containers, encumbrance, equip state, attunement, charges, weapon attacks, and item modifiers are supported.
- **RUL-006 — Runtime and rests:** Short/long rests reset only eligible HP, hit dice, slots, resources, and conditions under the selected ruleset.
- **RUL-007 — Traces:** Every derived value exposes contributing sources in a stable trace shape suitable for UI display and golden tests.
- **RUL-008 — Overrides:** Overrides require a reason, remain marked, propagate to dependents at their defined ownership boundary, and reset to automatic.
- **RUL-009 — No guessing:** Partial/manual content and unsupported rule expressions do not apply inferred effects silently.
- **RUL-010 — Golden fixtures:** Both editions have certified fixtures, including first-slice characters and Gwendoline snapshot values from trusted sheet/PDF evidence.
- **RUL-011 — Edition isolation:** Catalog selection, evaluation, rest behavior, spell progression, and multiclass behavior never cross rulesets without an explicit conversion.

### V4 tracker

- **V4-001 — Opt-in style:** `v4` is additive to style contracts and does not change V1–V3 rendering, settings, or V3 personal layouts.
- **V4-002 — Functional hierarchy:** Responsive Cassian-themed UI follows the researched hierarchy without copying D&D Beyond assets, branding, CSS, text, or proprietary code.
- **V4-003 — Core summary:** Identity, level/XP, abilities, proficiency, speed, inspiration, HP/temp/death saves, saves, senses, proficiencies/languages, skills, initiative, AC, defenses, and conditions are present.
- **V4-004 — Tabs:** Actions, Spells, Inventory, Features & Traits, and Extras are primary tabs; Background and Notes remain accessible.
- **V4-005 — Actions:** Search and filters cover attack, action, bonus action, reaction, other, and limited use with usable details and resources.
- **V4-006 — Spells:** Search, level filters, preparation, known/spellbook distinctions, slots, upcasting, casting, ritual, concentration, details, and use confirmation work.
- **V4-007 — Inventory:** Search, filters, weight, currency, containers, equip, attune, quantities, charges, and item details work.
- **V4-008 — Features:** Class, subclass, species, background, and feats group correctly with selections and resources.
- **V4-009 — Extras:** Supported companions, familiars, wild shapes, vehicles, and custom extras can be added, inspected, and tracked.
- **V4-010 — Dice and consumption:** Existing dice UI handles character, attack, damage, healing, and spell rolls; confirmed use consumes the chosen slot/resource without applying target damage.
- **V4-011 — Accessibility:** All V4 controls support keyboard use, focus restoration, screen-reader labels/announcements, reduced ambiguity, light/dark themes, and mobile layouts.
- **V4-012 — Authority:** Read-only viewers cannot mutate; assigned players, DMs, and Admin retain current boundaries.

### Compatibility and conversion

- **CMP-001 — Legacy preservation:** V1–V3, V3 personal layouts, clean URLs, exports, unknown fields, localStorage, D1 documents, and failure recovery remain intact.
- **CMP-002 — Manual opening:** Old characters open in V4 manual mode with their totals unchanged and no automatic recalculation.
- **CMP-003 — Conversion preview:** Convert to automatic previews matched, unresolved, added, removed, and changed values; cancellation makes no mutation.
- **CMP-004 — Import snapshot:** URL/PDF imports preserve imported totals. Reviewed mapping enables automation only for confident rules-ready matches.
- **CMP-005 — Import fallback:** Runtime does not require D&D Beyond's unsupported internal API; PDF and manual paths remain usable.
- **CMP-006 — Storage migration:** All migrations are additive, idempotent, campaign-isolated, and preserve rollback data.
- **CMP-007 — Build and routes:** Source and built output preserve global/campaign clean routes, static fallback, and authenticated APIs.

### NPC follow-on

- **NPC-001 — Shared rules mode:** Character-built NPCs reuse the same schema, catalog, engine, and runtime primitives where the rules overlap.
- **NPC-002 — Freeform mode:** Existing freeform/stat-block NPCs can use V4 presentation without forced conversion.
- **NPC-003 — Privacy:** Campaign isolation, role authority, and server-side hidden-field redaction remain enforced in both modes.

## Task Queue

Each row is a complete stopping point. The `Verification` column is the minimum focused proof; add broader checks when the diff crosses more boundaries.

| # | Status | Scope and acceptance IDs | Verification and stop condition |
|---:|---|---|---|
| 1 | Done | Create this log; record decisions, research, formats, acceptance IDs, repository baseline, compatibility rules, and audit-artifact cleanup. | `git diff --check`; stop when the document is complete and only intended changes remain. |
| 2 | Done | Schema-v2 normalization and manual compatibility projection. `CMP-001`, `CMP-002`, `RUL-009` | Direct model tests for legacy, malformed, unknown fields, round-trip, and idempotence; `npm test -- @characters`; stop before rule evaluation. |
| 3 | Done | Compendium ruleset/publisher/source/stable-ID/dependency/coverage metadata and generated report. `BLD-006`, `RUL-009`, `RUL-011` | Generator determinism, manifest/count integrity, dependency failures, `npm test -- @compendium`; stop before evaluation. |
| 4 | Done | Grant, selection, prerequisite, level-gating, and unresolved-reference evaluator. `BLD-007`, `RUL-009` | Pure evaluator unit tests in both rulesets; `npm test -- @characters @compendium`; stop before numeric calculations. |
| 5 | Done | Abilities, proficiency, saves, skills, expertise, passives, and traces. `RUL-001`, `RUL-007`, `RUL-011` | Boundary/golden unit tests; `npm test -- @characters`; stop before combat durability. |
| 6 | Done | HP, hit dice, AC, initiative, movement, senses, defenses, and overrides. `RUL-002`, `RUL-007`, `RUL-008` | Formula, trace, override/reset, malformed-input tests; `npm test -- @characters`. |
| 7 | Done | Actions, resources, conditions, concentration, and ruleset-aware rests. `RUL-003`, `RUL-006`, `RUL-011` | Engine/runtime/rest tests; `npm test -- @characters`; stop before spell/inventory expansion. |
| 8 | Done | Spell repertoire, preparation, slots, pact magic, rituals, upcasting, and multiclass math. `RUL-004`, `RUL-011` | Per-level and multiclass tables, runtime consumption/rest tests; `npm test -- @characters`. |
| 9 | Done | Inventory instances, currency, weight, containers, equip/attune, weapons, and modifiers. `RUL-003`, `RUL-005` | Instance identity, nesting, encumbrance, attunement, attack tests; `npm test -- @characters`. |
| 10 | Done | Certify Fighter and Wizard levels 1–5 in both editions. `RUL-001`–`RUL-004`, `RUL-006`–`RUL-011` | Level-by-level golden fixtures and unresolved-rule report; stop when both classes are rules-ready for the slice. |
| 11 | Done | Certify Human, Sage, and Soldier in both editions; complete first-slice fixtures. `RUL-001`–`RUL-003`, `RUL-007`–`RUL-011` | Cross-product first-slice fixtures including Gwendoline snapshot regression. |
| 12 | Done | Draft local persistence, additive D1 migration, APIs, auth, finalization, and collision handling. `BLD-004`, `BLD-012`, `CMP-006`, `CMP-007` | Fresh/upgraded/idempotent migration; local/cloud success/failure; API method/auth/role/409 tests; `npm test -- @characters @campaigns`. |
| 13 | Done | Accessible builder shell, progress navigation, autosave status, resume, dirty/failure recovery. `BLD-001`–`BLD-004`, `BLD-013` | Model/UI/browser tests; `npm run build:site`; `npm run test:browser -- @characters`. |
| 14 | Done | Home preferences and ruleset/source/coverage filters. `BLD-005`, `BLD-006`, `BLD-013` | Filter/state/change-preview tests and browser flows in both rulesets. |
| 15 | Done | Class, Background, and Species/Race steps. `BLD-002`, `BLD-007`, `BLD-009`, `BLD-013` | First-slice choice, invalid choice, navigation, persistence, and accessibility flows. |
| 16 | Done | Abilities, Equipment, Description, and Review/Finish steps. `BLD-008`–`BLD-013` | All ability methods, equipment alternatives, review blockers/warnings, finalize/retry browser flows. |
| 17 | Done | Register opt-in V4 and build responsive core summary. `V4-001`–`V4-004`, `V4-011`, `V4-012`, `CMP-001` | Settings/role/layout tests, built output, desktop/mobile, both themes, V1–V3 regression. |
| 18 | Done | V4 Actions, conditions, rests, resources, and dice. `V4-005`, `V4-010`–`V4-012`, `RUL-006` | Roll/use/confirmation/cancel/read-only/rest browser tests. |
| 19 | Done | V4 Spells, preparation, and casting. `V4-006`, `V4-010`–`V4-012` | Known/prepared/spellbook/slot/upcast/concentration/read-only browser tests. |
| 20 | Done | V4 Inventory, currency, containers, equip, and attunement. `V4-007`, `V4-011`, `V4-012` | Inventory mutation, derived totals, limits, persistence, role, and mobile browser tests. |
| 21 | Done | V4 Features, Extras, proficiencies, Background, Notes, and detail sidebars. `V4-008`, `V4-009`, `V4-011`, `V4-012` | Group/detail/extras/notes/focus/read-only browser tests. |
| 22 | Done | Legacy and D&D Beyond conversion previews, cancellation, rollback copy, and unresolved mapping. `CMP-002`–`CMP-005`, `RUL-010` | No-mutation cancel, exact manual open, snapshot import, mapping, rollback, Gwendoline tests. |
| 23 | Done | Fighter/Wizard levels 6–20 and their multiclass combination. `RUL-001`–`RUL-011` | Per-level class fixtures, spell-slot multiclass boundaries, unresolved coverage zero for certified scope. |
| 24 | Done | Certify Cleric and Paladin. `RUL-001`–`RUL-011` | Both-edition level fixtures, preparation, channel resources, multiclass regression. |
| 25 | Done | Certify Druid and Ranger. `RUL-001`–`RUL-011`, `V4-009` | Both-edition fixtures, wild shape/extras, half-caster and multiclass regression. |
| 26 | Done | Certify Bard and Sorcerer. `RUL-001`–`RUL-011` | Both-edition fixtures, expertise/inspiration/metamagic and multiclass regression. |
| 27 | Done | Certify Warlock pact and invocation behavior. `RUL-001`–`RUL-011` | Pact slots, rests, invocations, prepared/known differences, multiclass regression. |
| 28 | Done | Certify Barbarian and Monk. `RUL-001`–`RUL-011` | Rage/focus resources, unarmored defense/movement, martial actions, multiclass regression. |
| 29 | Done | Certify Rogue and complete all-core cross-class/multiclass regression. `RUL-001`–`RUL-011` | Both-edition Rogue fixtures plus representative pairwise/caster-level regressions and full core coverage report. |
| 30 | Done | Character-built NPC mode using the shared engine. `NPC-001`, `NPC-003` | Campaign isolation, role, runtime, rules, and browser tests; no freeform presentation changes. |
| 31 | Done | V4 presentation for freeform NPCs with visibility/redaction preservation. `NPC-002`, `NPC-003` | Existing import/freeform regression, player projection/redaction, DM edit, mobile/theme browser tests. |
| 32 | In Progress | Final accessibility, responsive, theme, role, migration, rollback, built-output, and compatibility audit. All IDs | Full `npm test`, `npm run build:site`, full browser suite, `git diff --check`, fresh/upgraded migration proof, and dated D&D Beyond re-audit. |

## In Progress

Task 32 — run the final acceptance audit, fix only acceptance-blocking regressions, and record dated evidence.

## Done

### Task 1 — Durable plan and baseline

- Created this specification and progress log with stable acceptance IDs.
- Recorded product decisions, D&D Beyond research baseline, repository seams, character format, engine/draft interfaces, task boundaries, verification rules, rollback notes, and non-goals.
- Captured the generated Compendium counts and existing parsed-rule coverage without claiming that parsed data is automation-ready.
- Inspected and removed only the generated untracked `.playwright-cli/` audit snapshots/logs. They can be regenerated by a future browser audit.

### Task 2 — Schema-v2 normalization

- Added pure `char/js/model.js` ownership for schema-v2 normalization and exact manual sheet projection.
- Preserved unknown top-level and nested build fields while canonicalizing known build fields.
- Legacy documents normalize to complete manual mode without guessing class, subclass, species, background, or Compendium IDs.
- Manual projection preserves every legacy flat value exactly and rejects rules-mode projection so stale totals cannot masquerade as calculated output.
- New Quick Setup, blank, and imported Character documents persist as schema v2 in manual mode. Existing stored/bundled characters are not rewritten on list or load.
- Added legacy and schema-v2 fixtures plus malformed-input, no-mutation, ruleset, unknown-field, projection, and idempotence tests.
- Registered schema metadata as editor-owned fields so internal `build` data does not appear as generic Additional fields.
- Stopped before rule evaluation, automatic calculations, D1 schema changes, and V4 UI.

### Task 3 — Compendium rule metadata

- Added deterministic ruleset, publisher, publication-source, dependency, expression, and automation metadata generation.
- Added an explicit empty certification registry. No entry becomes `rules-ready` until later engine and content certification tasks opt it in.
- Added `original-ids.json` as the stable original-ID-to-Cassian-ID lookup. Future source builds reuse the prior mapping before name-based ID generation.
- Added `rules-metadata.json` as an additive sidecar and `coverage.json` as the generated coverage report. Existing category and index shapes remain valid.
- Added manifest pointers and a deterministic content fingerprint: `sha256-c79bb4f04416556454f6`.
- Updated browser repository loading to merge optional local metadata into local or D1 catalog/category rows. Older builds without the sidecar still load.
- Updated D1 seed generation to embed sidecar metadata into future index/detail JSON without changing D1 tables.
- Added a current-data metadata command because this checkout lacks `compendium/source`; full XML rebuilding remains available when source files are present.
- Added dependency failure, collision, ambiguity, ruleset, publisher, conservative certification, deterministic ordering, repository merging, and generated-artifact tests.
- Stopped before rule evaluation and content certification.

### Task 4 — Rule graph and choice validation

- Added pure `evaluateCharacterBuild()` graph evaluation with no DOM, storage, network, clock, or random access.
- Resolves build roots by stable or original ID, keeps rulesets isolated, respects enabled-source filters, and reports unresolved roots.
- Expands nested grants only from `rules-ready` sources; partial/manual entries remain visible but cannot apply nested effects.
- Evaluates numeric level gates plus a strict ID requirement grammar supporting negation, grouping, AND/comma, and OR. Unsupported expressions are blocked and surfaced instead of guessed.
- Supports simple total/class level prerequisites, named-feature prerequisites, structured prerequisites, and the existing prerequisites preference.
- Defines deterministic persisted choice keys, resolves explicit and support-tag options, enforces counts and duplicates, preserves invalid selections for review, and exposes unavailable reasons.
- Uses a bounded fixed-point pass for conditional grants/selections and reports unstable rule cycles.
- Added deterministic, no-mutation unit coverage for `5e`, `5.5e`, edition mismatch, grants, choices, prerequisites, level gates, missing references, stale selections, and conservative partial automation.
- Stopped before abilities, proficiency math, saves, skills, passives, numeric projection, and calculation traces.

### Task 5 — Core calculations and traces

- Added pure `evaluateCharacter()` composition. Manual mode returns the exact legacy projection; rules mode materializes calculated fields while preserving unrelated flat fields.
- Added canonical six-ability and 18-skill definitions owned by the rules engine.
- Calculates total level, level-based proficiency bonus, ability scores and modifiers, saving throws, skills, expertise, rounded-down and explicitly rounded-up half proficiency, and passive Perception/Investigation/Insight.
- Applies only supported stat expressions from active `rules-ready` entries, honors stat level/requirement gates, and reports unsupported conditions, targets, or values without guessing.
- Uses the strongest proficiency tier instead of stacking proficiency, expertise, or half proficiency incorrectly; ordinary supported fixed and ability-modifier bonuses remain additive.
- Added stable path-keyed `{ value, sources }` traces for every Task 5 numeric projection. Sources distinguish base, level, ability, proficiency, skill, and rules contributions and retain original IDs/rule indexes.
- Added deterministic/no-mutation fixtures for both rulesets, proficiency boundaries, multiclass total level, racial ability grants, save proficiency, skill proficiency/expertise/half proficiency, passive bonuses, unsupported rules, incomplete scores, and exact manual compatibility.
- Stopped before HP, hit dice, AC, initiative, movement, senses, defenses, overrides, actions, spells, inventory, and runtime effects.

### Task 6 — Durability, mobility, defenses, and overrides

- Added rules-mode maximum HP for fixed or stored manual rolls, first-level maximum hit die, Constitution per level, supported HP bonuses, multiclass hit-die pools, and current/temporary HP projection from runtime or preserved snapshots.
- Added unarmored AC, initiative, walk/fly/climb/swim/burrow speeds, darkvision/blindsight/tremorsense/truesight, languages, proficiencies, damage resistances/immunities/vulnerabilities, and condition immunities.
- Added stable traces for each Task 6 field. Numeric formulas identify base, ability, hit-die, runtime, rules, reference, and projection sources; named collections retain their grant sources.
- Added pure reason-required override/set/reset support. Ability score, ability modifier, proficiency, skill, passive, HP, AC, initiative, movement, sense, language, proficiency, and defense overrides apply at their ownership boundary and propagate to dependent calculations.
- Unsupported hit dice, HP rolls, stat expressions, equipment conditions, values, or future override paths remain explicit warnings and do not receive guessed automation.
- Preserved manual-mode projection exactly. Equipment-aware armor calculations remain Task 9 scope; actions, resources, conditions, concentration, and rests remain Task 7 scope.

### Task 7 — Actions, runtime resources, conditions, and rests

- Added rules-ready feature action projection with stable action/resource IDs, action type, range, attack, damage, description, supported usage formulas, reset cadence, overrides, and source traces.
- Added pure runtime normalization and immutable helpers for limited-use spending, conditions, and concentration. Unknown runtime fields and unmatched pools survive tracker load/save.
- Added persistent hit-die pools, conditions, concentration, and exhaustion to the existing local tracker state without changing legacy Character documents.
- Added rules-mode short/long rests through the existing confirmation/controller seam. Short rests preserve HP, temporary HP, death saves, and concentration; long rests restore eligible pools and clear only eligible state.
- Split hit-die recovery by edition: `5e` restores up to half the total, while `5.5e` restores all. Ambiguous `5e` multiclass recovery order emits a warning instead of hiding the assumption.
- Manual and legacy tracker rest behavior remains unchanged. Unsupported expressions warn and apply no guessed automation.
- Stopped before spell repertoire/slot math, inventory instances, action UI, and production Compendium certification.

### Task 8 — Spellcasting rules and runtime

- Added declarative rules-ready spellcasting profiles with stable IDs, class-specific ability, repertoire, ritual mode, preparation formula/table, cantrip scaling, and full/half/third/Pact progression.
- Added all 20 standard multiclass slot rows plus all 20 Pact Magic rows. Standard pools are shared across eligible profiles; Pact pools remain separate and restore on short or long rests.
- Added edition-explicit half-caster rounding through profile metadata: `half-down` for applicable `5e` classes and `half-up` for applicable `5.5e` classes. Display names never determine rules.
- Added spell projection for known, prepared, spellbook, granted, and always-prepared states. Ambiguous multiclass ownership requires a stable stored profile assignment.
- Added spell save DC, attack bonus, preparation-limit, caster-level, slot, spell, and cantrip-tier traces plus reasoned overrides for profile totals and slot maxima.
- Added pure preparation and casting transitions. Casting validates readiness, ritual eligibility, minimum slot level, remaining slots, Pact/standard pools, upcast level, and concentration without applying target effects.
- Partial/manual or wrong-edition spells remain visible with warnings but are not castable through automation. Unknown rules are not guessed.
- Preserved manual sheets and the existing V1–V3 spellcasting tracker behavior. Stopped before spell UI, inventory, equipment attacks, production certification, and D1 work.

### Task 9 — Inventory rules and runtime

- Added stable inventory-instance resolution against Compendium definition IDs. Duplicate/missing instance IDs, unresolved definitions, ruleset mismatches, partial/manual automation, invalid containers, and container cycles remain visible instead of being repaired silently.
- Added runtime-owned quantity, container placement, equip, attunement, currency, and charge state while preserving unmatched runtime fields and instances for forward/failure recovery.
- Added per-instance and total cost/weight, nested container contents/capacity, explicit contents-weight multipliers, five-denomination currency value, optional coin weight, and trace sources.
- Added size/Strength carrying capacity, push/drag/lift limits, 2014 variant encumbrance speed penalties, and standard 2024 over-capacity behavior. Selecting the unavailable 2014 variant under `5.5e` warns and uses standard rules.
- Enforced the three-item attunement maximum and duplicate-definition restriction. Equipment and item modifiers activate only for rules-ready definitions with valid equip/attune state.
- Added armor/shield AC composition, rules-ready equipment stat modifiers, weapon and versatile damage, proficiency, properties, mastery activation, and edition-aware Unarmed Strike actions with traceable attack/damage sources.
- Added pure runtime inventory mutation and charge-spending helpers plus eligible short/long-rest charge recovery.
- Preserved manual sheets and existing V1–V3 inventory UI/state behavior. Stopped before production item certification and V4 inventory UI.

### Task 10 — Fighter and Wizard levels 1–5

- Added reviewed declarative overlays for 2014/2024 Fighter and Wizard plus Champion and Evocation subclasses. Raw generated Aurora rules remain unchanged; only the metadata sidecar applies certified replacements.
- Certified class saving throws, proficiencies, skills, subclass timing, ASIs, features, Fighter actions/resources/styles/mastery counts/Extra Attack, Wizard spellcasting/preparation/cantrips/spellbook growth/slots, and Arcane Recovery.
- Added inline choice effects with source traces, level-aware selection counts, class/subclass feature projection, attacks-per-action and critical-threshold projection, style-aware weapon modifiers, partial resource recovery, and bounded Arcane Recovery slot restoration.
- Added 20 level-by-level golden cases across both editions. They prove HP, proficiency, saves, skills/expertise, features, resources/rests, attacks, spell DCs, preparation, cantrips, spellbook minimums, slots, required subclasses, and trace sources without warnings.
- Generated `character-certification-report.json`: eight scoped entries are `rules-ready`; unresolved certified rules are zero. Other qualifying feats stay explicit manual/partial branches and never receive guessed effects.
- Stopped before Human, Sage, Soldier, builder UI, V4 UI, D1 changes, seed application, deployment, and remote mutation.

### Task 11 — Human, Sage, Soldier, and first-slice fixtures

- Added reviewed declarative overlays for 2014/2024 Human, Sage, and Soldier. Both editions now project origin ability changes, skills, languages, tools, features, size, creature type, speed, and source traces through stable IDs.
- Added 2024 Human Resourceful long-rest inspiration, Skillful selection, size selection, standard origin languages, and certified Tough HP scaling. Other Origin Feats and 2014 Variant Human remain selectable manual branches with explicit warnings.
- Added 2024 Sage background ability choices and core grants. Magic Initiate (Wizard) stays visible with an explicit nonblocking manual-spell warning; no spells are guessed before their catalog certification.
- Added 2024 Soldier background ability choices, gaming-set proficiency, and Savage Attacker’s once-per-turn roll-twice weapon effect.
- Added 40 cross-product golden cases: two classes, two backgrounds, two editions, and levels 1–5. They verify edition isolation, HP/ability math, skills, tools, languages, features, rests, traces, and manual boundaries.
- Moved Gwendoline’s trusted import totals into a durable snapshot fixture and kept the existing API import regression tied to it.
- Generated certification report now contains 14 `rules-ready` entries with zero unresolved certified rules. No builder UI, D1 schema/API, seed application, deployment, or remote mutation was started.

### Task 12 — Builder draft persistence and safe finalization

- Added `dnd-character-build-drafts-v1` local-first persistence. Valid changes write to campaign-scoped localStorage before cloud synchronization and retain saved, pending, failed, retry, and pending-delete state.
- Added global and campaign per-user D1 draft tables through additive migration `0017_character_build_drafts.sql`. Draft ID, normalized schema-v2 document, current step, build status/version, and timestamps remain isolated by user and campaign.
- Added authenticated `GET|PUT|DELETE /api/character-build-drafts/:draftId` and `POST /api/character-build-drafts/:draftId/finalize`, plus equivalent campaign routes. Existing campaign URL rewriting now recognizes the draft resource.
- Finalization requires a complete schema-v2 document and valid Character ID, uses plain inserts instead of upserts, treats active or inactive IDs as occupied, returns `409` on collision, and removes the draft in the same D1 batch as Character creation.
- Campaign player finalization assigns the creator. DM/Admin finalization keeps existing manager authority without redundant editor rows. AOTR finalization mirrors the legacy Character table in the same batch.
- Cloud save/delete/finalize failures preserve local recovery. Local-host finalization checks the merged Character list before writing and never overwrites local recovery data.
- Added migration and repository/API fixtures proving local-before-cloud save, retry, cloud recovery, delete failure, global/campaign/user isolation, auth, role behavior, legacy mirroring, collision preservation, and transaction rollback. No remote migration, seed, deployment, or D1 mutation occurred.

### Task 13 — Accessible builder shell and recovery

- Added Detailed Build to the existing New Character dialog without replacing Quick Setup, blank creation, D&D Beyond URL import, or PDF import.
- Added the eight-step responsive shell with complete, incomplete, warning, and blocked progress states; Back, Next, and direct navigation preserve the active draft.
- Added deterministic step-state and resume models. A saved incomplete step reopens as the current step; a completed current step advances to the first incomplete required step.
- Reused Task 12 local-first persistence for every navigation edit. The UI announces local save before cloud synchronization and exposes saved, interrupted, failed, and explicit retry states.
- Added accessible current-step semantics, live save announcements, focus movement to each step heading, modal focus restoration, keyboard-safe controls, and a mobile one-column progress layout.
- Added model, UI-contract, and Firefox browser coverage for entry, all progress states, local save, direct navigation, focus, close/reopen resume, Quick Setup return, and 375 px layout without horizontal overflow.
- Stopped before Task 14 Home preferences and content filters. No migration, seed, deployment, commit, push, or remote mutation occurred.

### Task 14 — Home preferences and content safety

- Added autosaved Home controls for progression, hit-point method, encumbrance, coin weight, and prerequisite enforcement.
- Added edition-isolated Compendium filters derived from generated metadata: ruleset, publisher, publication/source, and `rules-ready`/`partial`/`manual` automation coverage. No publisher, publication, or count is hardcoded.
- Added mutually consistent faceting. Ruleset limits publishers; publisher limits coverage counts; publisher plus coverage limit publications; unavailable dependent filters clear explicitly.
- Added accessible multi-publication selection plus an Enable all shown sources control. Persisted `enabledSources` continues driving the existing rules evaluator.
- Added a no-mutation ruleset preview. Switching editions lists incompatible classes, subclasses, species, backgrounds, choices, spells, items, containers, sources, filters, and ruleset-specific preferences before confirmation; Cancel leaves the draft unchanged.
- Confirmed edition changes clear only proven-incompatible catalog references, preserve unknown/manual references and edition-neutral ability scores, mark the build incomplete, and save through the existing local-first draft path.
- Added a Character-owned optional catalog-provider seam and a Character–Compendium adapter using Compendium's public API. Character Builder core does not import private Compendium modules.
- Added model, normalization, provider, integration, UI-contract, architecture, and Firefox browser coverage. Stopped before Task 15 Class, Background, and Species/Race choices. No migration, seed, deployment, commit, push, or remote mutation occurred.

### Task 15 — Class and origin choices

- Added catalog-driven Class, Background, and Species/Race selectors that honor the Home ruleset, publisher, publication/source, and automation filters without hardcoded option lists.
- Added the certified levels 1–5 class slice, data-linked subclass gates, and edition-safe subclass filtering. Wrong-edition roots, wrong-class subclasses, out-of-slice levels, and unavailable rule options are rejected without mutating the draft.
- Rendered evaluator-owned proficiency, feature, feat/ASI, species, and background choices with required counts, level gates, duplicate prevention, prerequisite reasons, and visible incomplete/invalid states.
- Kept partial/manual roots and inline options selectable when allowed by Home filters. Each remains visibly marked; missing effects are never guessed.
- Root changes clear only dependent source selections, while level-gated choices remain recoverable and subclasses clear when the level falls below their gate.
- Progress now reflects missing evaluator choices, required subclasses, invalid blockers, non-blocking manual warnings, and complete root steps. Every accepted edit uses the existing local-first autosave and focus-restoration path.
- Added real first-slice model coverage for Fighter, Wizard, Champion/Evoker, Human, Sage, and Soldier in both editions, plus accessible UI contracts and a Firefox choose/save/close/resume/mobile flow. Stopped before Task 16. No migration, seed, deployment, commit, push, or remote mutation occurred.

### Task 16 — Completion steps and safe Finish

- Added Standard Array, 27-point buy, manual, and stored 4d6-drop-lowest ability methods. Method-specific bounds, standard-score uniqueness, point costs, overspend rejection, autosave, and progress states are enforced without engine-side randomness.
- Added starting-equipment and starting-gold modes, five-denomination build currency, Compendium-backed stable inventory instances, quantity/remove controls, edition/source/coverage filtering, and visible partial/manual no-guessed-effects labels. Switching methods preserves existing work.
- Added builder-time spell repertoire choices to eligible class steps. Cantrip, known-spell, and spellbook limits use engine profiles; preparation remains runtime state.
- Added required Character identity plus appearance, personality, story, allies, organizations, and notes fields. Clean IDs derive from names but remain editable and collision-checked.
- Added Review summary, blocking structural issues, non-blocking automation/manual notices, overrides, and materialized automatic legacy projection. Optional equipment/story data and manual notices do not block Finish.
- Finish now persists the complete materialized draft, uses Task 12 collision-safe finalization, redirects to the clean campaign Character URL, preserves the draft after failure, and exposes a focusable Retry Finish error path.
- Added model, accessible UI-contract, and Firefox coverage for all ability methods, equipment/gold preservation, Wizard repertoire, warnings/blockers, Fighter finalization, `409` collision recovery, retry, draft removal, materialized flat values, mobile layout, and existing Character regressions. Stopped before Task 17. No migration, seed, deployment, commit, push, or remote mutation occurred.

### Task 17 — Opt-in V4 and core summary

- Registered `v4` additively across global/campaign settings, Admin controls, per-character overrides, and the Character editor. Task 31 later extends the same contract to NPCs.
- Added a responsive Cassian-themed V4 hierarchy with identity, level/XP, six abilities, saves, skills, proficiency, initiative, AC, movement, HP/temp HP/death saves, senses, proficiencies/languages, defenses, conditions, Background, and Notes.
- Added accessible Actions, Spells, Inventory, Features & Traits, and Extras tabs with roving keyboard focus. V4 moves the existing live tracker sections; it does not clone stateful controls or alter V1–V3 layout ownership.
- Added pure summary-model, DOM-contract, settings, role, layout, build, Firefox desktop/mobile, both-theme, and V1–V3 regression coverage. No deployment, remote mutation, commit, or push occurred.

### Task 18 — Actions and runtime interactions

- Added V4 action-type filtering for attacks, actions, bonus actions, reactions, other timing, and limited-use entries while retaining the existing search/source/focus/category filters.
- Added an accessible confirmation dialog for at-will actions, linked resources, embedded use pools, and explicitly declared spell-slot use. Cancellation preserves state; confirmation consumes exactly one selected use; no target damage is applied.
- Added condition add/remove, concentration clear, exhaustion controls, ruleset-aware rest resets, live announcements, Escape/cancel behavior, and trigger-focus restoration.
- Kept V1–V3 action rendering unchanged. Read-only V4 disables mutation controls while leaving dice rolls available.
- Added pure action-use/filter tests, UI contracts, rest-focus tests, and Firefox coverage for filters, cancellation, consumption, conditions, short rests, dice, authority, themes, and mobile layout. No deployment, remote mutation, commit, or push occurred.

### Task 19 — Spells, preparation, and casting

- Added a V4 spell repertoire browser with search plus level, preparation, and known/spellbook/granted filters.
- Added spell cards with profile, level, school, known, spellbook, granted, prepared, always-prepared, ritual, concentration, cantrip-scaling, automation-warning, attack/damage dice, and detail indicators.
- Added preparation toggles using existing profile limits and persisted runtime state. Fixed preparation-aware castability so newly prepared automatic spells do not retain a stale unavailable state.
- Added an accessible casting dialog for cantrips, explicit uses, slots, upcasting, and ritual casting. Confirmation consumes only the selected slot/use, establishes concentration when required, announces the result, restores focus, and never applies target damage or healing.
- V4 read-only mode now preserves tabs, spell filters, and dice while disabling preparation, casting, conditions, rests, resources, and other mutations. V1–V3 read-only behavior remains unchanged.
- Added pure spell-filter/casting tests, UI contracts, tracker-view coverage, and Firefox flows for known/spellbook display, preparation, cancel/no-mutation, selected-slot upcasting, rituals, concentration, dice, focus, responsive themes, and read-only authority. No deployment, remote mutation, commit, or push occurred.

### Task 20 — Inventory and equipment runtime

- Added a V4 inventory browser with search, status, and container-location filters plus visible item, carried-weight, encumbrance, and attunement totals.
- Added rules-inventory quantity, container, equip, attune, and charge controls using the existing pure runtime validators. The three-item and duplicate-item attunement limits, container validity/cycles, and charge bounds remain engine-owned.
- Preserved legacy/manual inventory behavior and reused the existing Character editor for item and currency authoring. Partial entries show `Manual rules`; no missing weight or equipment effect is guessed.
- Added charge-use confirmation, cancel/no-mutation, Escape/focus restoration, immediate local plus best-effort D1 runtime persistence, and read-only mutation guards while keeping filters enabled.
- Added pure inventory model/totals/filter tests, rich runtime-state persistence coverage, UI contracts, and Firefox flows for filtering, currency, quantity-derived weight, containers, equipment, attunement limit, charges, refresh, mobile, and read-only authority. No deployment, remote mutation, commit, or push occurred.

### Task 21 — Features, Extras, and details

- Added conservative feature grouping for Class, Subclass, Species/Race, Background, Feats, and Other using stored source metadata. Current selections and linked/embedded resource trackers remain visible and mutable through existing runtime persistence.
- Added typed companion, familiar, wild-shape, vehicle, and custom Extra records with HP/use tracking. Existing Character editor collection controls now create and edit Extras; Compendium-sourced records retain their source IDs without guessed behavior.
- Expanded Background presentation with stored personality, ideals, bonds, flaws, backstory, allies, organizations, and notes while retaining the compact legacy background name. Proficiencies/languages and the existing Notes editor remain in the V4 hierarchy.
- Added one accessible feature/Extra detail drawer with close, backdrop, Escape, and trigger-focus restoration. Read-only viewers retain detail access while all feature, Extra, note, and editor mutations remain blocked by existing authority.
- Added pure grouping/detail tests, Extra editor/runtime persistence coverage, UI contracts, and Firefox flows for all groups, selections, resources, all Extra types, HP/uses, Background, proficiencies, Notes, drawer focus, refresh, mobile, and read-only authority. No deployment, remote mutation, commit, or push occurred.

### Task 22 — Reviewed conversion and rollback

- Added a pure manual-to-rules conversion preview that reports matched, unresolved, added, removed, and changed values without mutating the source Character. Only exact-name entries for the selected ruleset with `rules-ready` certification can map automatically.
- Class levels, subclass, species/race, background, and rules-ready inventory instances map conservatively. Flat multiclass totals, ability-score bases, spell repertoire roles, ambiguous entries, and partial/manual content remain explicit unresolved work; no effect is guessed.
- Conversion preserves the live flat sheet, creates an incomplete automatic build, and stores the exact pre-conversion document plus reviewed preview as rollback data. Restore replaces the converted document with that exact copy.
- D&D Beyond page and PDF imports now carry explicit manual snapshot metadata and cloned trusted totals. Gwendoline HP, AC, initiative, senses, skills, attack, resource, spellcasting, and personality regressions remain unchanged.
- Added an accessible V4 preview/restore dialog with ruleset selection, loading/failure status, cancellation and trigger-focus restoration. Local save occurs before best-effort D1 synchronization; a local failure restores the in-memory source. Read-only viewers and NPCs receive no conversion action.
- Added pure conversion, importer, repository, integration, UI-contract, and Firefox coverage. No unsupported D&D Beyond internal API dependency, migration, seed, deployment, remote mutation, commit, or push was added or performed.

### Task 23 — Fighter/Wizard levels 1–20 and multiclass

- Extended Fighter, Champion, Wizard, and Evocation/Evoker reviewed certification through level 20 in both rulesets.
- Added full level tables for attacks, critical range, class resources, Weapon Mastery, cantrips, prepared spells, spellbook minimums, and standard spell slots.
- Added level-gated ASI/Epic Boon and subclass Fighting Style choices plus all class/subclass feature milestones.
- Replaced the level 1–5 golden fixture with a level 1–20 fixture and proved all 80 single-class/edition cases plus Fighter 5/Wizard 5 multiclass calculations.

### Task 24 — Cleric/Paladin certification

- Certified Cleric, Life Domain, Paladin, and Oath of Devotion from levels 1–20 for 2014 and 2024 rules.
- Added data-driven spell preparation, cantrips, single-class half-caster slots, Channel Divinity, Lay On Hands, rests, attacks, features, ASI/Epic Boon, Divine Order, Blessed Strikes, Fighting Style, and Weapon Mastery rules.
- Added explicit 2014 Paladin metadata for half-up single-class slots and half-down multiclass contribution; the engine now reads both values without class-name hardcoding.
- Proved subclass actions spend their parent class Channel Divinity pool. Domain/oath spell lists remain visible nonblocking manual warnings until their spell entries are certified; no grants are guessed.
- Added 80 single-class/edition golden cases plus Cleric 5/Paladin 5 multiclass fixtures for both editions.

### Task 25 — Druid/Ranger certification

- Certified Druid, Circle of the Land, Ranger, and Hunter from levels 1–20 for both editions.
- Added Druid preparation/cantrips, Wild Shape resources/rests, Land choices, Ranger known/prepared limits, Favored Enemy, Expertise, Roving movement, Fighting Style, Weapon Mastery, and Hunter choices.
- Added generic rule-generated Extras so Wild Shape appears in the existing V4 Extras hierarchy without hardcoded class rendering.
- Reused explicit single-class/multiclass half-caster progression metadata for 2014 Ranger and proved Druid 5/Ranger 5 slot boundaries in both editions.
- Uncertified Circle spells, Hunter's Mark, and 2014 Favored Enemy languages remain visible nonblocking manual branches.

### Task 26 — Bard/Sorcerer certification

- Certified Bard, College of Lore, Sorcerer, and Draconic subclasses from levels 1–20 for both editions.
- Added Bard known/prepared tables, Jack of All Trades, Expertise, Bardic Inspiration uses/die/rest scaling, Lore skills, Cutting Words, and explicit cross-list spell warnings.
- Added Sorcerer known/prepared tables, Sorcery Points, Innate Sorcery, edition-specific Metamagic choices, Draconic HP/AC, ancestry/affinity choices, and explicit manual conversion/recovery/spell warnings.
- Extended declarative resources with ability-modifier minimums, level-based reset/die tables, and action die projection. Added class-level HP scaling and unarmored equipment conditions without class-name hardcoding.
- Added 80 single-class/edition golden cases plus Bard 5/Sorcerer 5 multiclass fixtures. Draconic HP uses Sorcerer level rather than total character level.

### Task 27 — Warlock certification

- Certified Warlock, The Fiend, and Fiend Patron from levels 1–20 for both editions.
- Added Pact Magic slot tables, short-rest recovery, 2014 known versus 2024 prepared repertoire, cantrips, patron timing, resource tracking, and Fiend features.
- Added declarative inline-choice level and pact prerequisites. Uncertified invocation effects, patron spells, Mystic Arcanum, and targeted/recovery mechanics remain clear manual branches; no effects are guessed.
- Added 40 single-class/edition golden cases plus Warlock 5/Wizard 5 separate-pool multiclass fixtures. Pact slots recover on short rest; standard spell slots do not.

### Task 28 — Barbarian/Monk certification

- Certified Barbarian, Path of the Berserker, Monk, and Open Hand from levels 1–20 for both editions.
- Added Rage/Ki/Focus resource and rest behavior, martial actions, Martial Arts dice, exact unarmed attack/damage, Unarmored Defense, Unarmored/Fast Movement, saves, Weapon Mastery, and subclass resources.
- Added generic equipment gates for no body armor, no armor or shield, and no heavy armor. Multiclass Unarmored Defense uses the first granted formula rather than stacking.
- Added 80 single-class/edition golden cases plus Barbarian 5/Monk 5 multiclass fixtures. Conditional Rage state, capped capstones, Monk-weapon substitution, multi-point Focus use, and target effects remain visible manual branches.

### Task 29 — Rogue and all-core certification

- Certified Rogue and Thief from levels 1–20 for both editions, including Sneak Attack, Expertise, Cunning Action, Weapon Mastery, Cunning/Devious Strike visibility, Slippery Mind, Stroke of Luck, Fast Hands, and 2024 Climb Speed.
- Kept Sneak Attack eligibility, Reliable Talent roll floors, damage mitigation, target effects, Thief magic-item exceptions, and extra initiative turns as explicit nonblocking manual branches.
- Added 40 single-class/edition golden cases plus Rogue 5/Warlock 5 Pact Magic regressions. Together with the five existing paired suites, every core class is exercised in cross-class combinations.
- Upgraded the generated certification report to list all twelve core classes by edition and expose `allCoreClassesCertified`; all 24 class entries and 12 representative subclasses are rules-ready.

### Task 30 — Character-built NPC mode

- Reused the Character builder, schema-v2 normalization, rules engine, and runtime projections for a new Detailed Build path in the existing NPC archive; Quick Setup and D&D Beyond import remain unchanged.
- Added campaign-scoped local NPC drafts with resume, immediate persistence, local-only status, and deletion only after successful finalization. No new D1 migration or remote draft API was introduced.
- Finalization requires a complete rules-mode build and DM/Admin authority, materializes the shared flat compatibility projection, creates the NPC hidden by default, and preserves a recoverable local NPC after non-collision cloud failures.
- Added create-only campaign NPC writes. ID collisions return `409` without overwriting an existing NPC or deleting the draft; player writes remain forbidden and player projections redact the build source.
- Added direct, API, UI-contract, and real-browser coverage for campaign isolation, roles, collisions, failure recovery, shared calculations/runtime, privacy, refresh, and 375px layout. Freeform/V4 NPC presentation remains Task 31.

### Task 31 — V4 freeform NPC presentation

- Enabled `v4` in NPC style resolution and the manager-only campaign NPC style route. NPC overrides remain separate from Character overrides, and unknown styles remain rejected.
- Reused the live V4 hierarchy for existing freeform/stat-block NPC documents without adding a `build` block, recalculating values, or forcing conversion. Rules-built NPCs continue using the same presentation.
- Added NPC-aware summary/tab accessibility labels and editor wording while preserving the existing Character labels and V1–V3 behavior.
- Preserved server/local player projection as the only source for read-only NPC rendering. Hidden fields and descriptions never enter the player V4 document; mutation controls remain disabled while safe filtering and detail inspection remain usable.
- Added model, UI-contract, settings, route, and Firefox coverage for DM style authority, player denial, freeform no-mutation, redaction, read-only controls, 375px layout, and actual light/dark theme palettes.

## Verification Log

- 2026-09-13 — Task 1 pre-edit repository state: branch `main`, commit `0ad6eb1`; only `.playwright-cli/` was untracked.
- 2026-09-13 — Task 1 audit cleanup: exact files inspected; `.playwright-cli/` removed; no tracked files were deleted.
- 2026-09-13 — Task 1 focused verification: `npm test -- @characters @compendium @character-layout` passed all 33 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-13 — Task 1 whitespace verification: `git diff --check` passed.
- 2026-09-13 — Task 2 direct checks: `node char/tests/character-model.test.js`, `node char/tests/repository.test.cjs`, and `node char/tests/editor-field-schema.test.js` passed.
- 2026-09-13 — Task 2 focused verification: `npm test -- @characters` passed all 24 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-13 — Task 2 whitespace verification: `git diff --check` passed.
- 2026-09-13 — Task 3 generation: `npm run build:compendium-metadata` built metadata for 15,191 entries. Two consecutive runs produced identical SHA-256 hashes for manifest, metadata, lookup, and coverage files.
- 2026-09-13 — Task 3 direct checks: metadata, generated-data, and repository tests passed; all changed JavaScript/CJS files passed `node --check`.
- 2026-09-13 — Task 3 focused verification: `npm test -- @compendium` passed all 8 selected suites.
- 2026-09-13 — Task 3 build verification: `npm run build:site` passed and copied the metadata sidecar byte-for-byte. Existing Browserslist age warning remained non-fatal.
- 2026-09-13 — Task 3 seed verification: `npm run d1:seed` generated 15,191 enriched Compendium rows locally. No D1 database was mutated.
- 2026-09-13 — Task 3 whitespace verification: `git diff --check` passed.
- 2026-09-13 — Task 3 source limitation: `compendium/source` is absent in this checkout, so the full XML command was not run. Syntax checks and current-data generation covered both generator integration points.
- 2026-09-13 — Task 4 direct checks: `node char/tests/rules-evaluator.test.js` passed; evaluator, requirement parser, and test files passed `node --check`.
- 2026-09-13 — Task 4 focused verification: `npm test -- @characters @compendium` passed all 32 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-13 — Task 4 whitespace verification: `git diff --check` passed.
- 2026-09-13 — Task 4 automation boundary: the certification registry remains empty, so generated coverage correctly remains at 0 `rules-ready`; Task 4 synthetic fixtures exercise certified behavior without prematurely certifying production content.
- 2026-09-13 — Task 5 direct checks: `node char/tests/rules-engine.test.js` passed; core definitions, calculations, engine composition, and tests passed `node --check`.
- 2026-09-13 — Task 5 focused verification: `npm test -- @characters` passed all 26 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-13 — Task 5 whitespace verification: `git diff --check` passed.
- 2026-09-13 — Task 5 automation boundary: calculations are proven with synthetic `rules-ready` fixtures in both editions, but production certification remains unchanged until the named content-certification tasks.
- 2026-09-14 — Task 6 direct checks: rules calculation, durability, override, engine, and fixture files passed `node --check`; `node char/tests/rules-engine.test.js` passed.
- 2026-09-14 — Task 6 fixture coverage: both rulesets, fixed/manual HP, invalid rolls, runtime HP, multiclass hit dice, AC, initiative, all movement and sense types, languages, proficiencies, all defense groups, source traces, dependency propagation, reason enforcement, reset, malformed and future overrides, unsupported conditions, determinism, and no mutation passed.
- 2026-09-14 — Task 6 focused verification: `npm test -- @characters` passed all 26 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 6 automation boundary: production certification remains at 0 `rules-ready`; synthetic fixtures prove engine behavior without enabling unreviewed Compendium rules. Equipment-dependent expressions remain warned until Task 9.
- 2026-09-14 — Task 7 direct checks: all changed rules/runtime/tracker modules passed `node --check`; runtime/rest, engine, rest-controller, tracker-state, and existing spellcasting tests passed directly.
- 2026-09-14 — Task 7 fixture coverage: stable action/resource IDs, supported and unsupported usage expressions, resource overrides/spending, runtime normalization, conditions, concentration, exhaustion, eligible/manual resets, zero-HP rejection, both-edition hit-die recovery, multiclass recovery warnings, determinism, no mutation, and unknown-state preservation passed.
- 2026-09-14 — Task 7 focused verification: `npm test -- @characters` passed all 27 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 7 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal; generated output stayed local.
- 2026-09-14 — Task 7 whitespace verification: `git diff --check` passed.
- 2026-09-14 — Task 7 automation boundary: production certification remains at 0 `rules-ready`; spell calculations and inventory-derived attacks remain Tasks 8–9.
- 2026-09-14 — Task 8 rules verification: current official 2014 and 2024 D&D Beyond rules reconfirmed shared multiclass slots, class-specific repertoire/preparation, higher-level slot casting, character-level cantrip scaling, and interoperable separate Pact Magic pools. Edition-specific half-caster rounding remains explicit profile data.
- 2026-09-14 — Task 8 direct checks: spell calculation, runtime, engine, evaluator, model, and existing tracker spellcasting tests passed; all changed JavaScript passed `node --check`.
- 2026-09-14 — Task 8 fixture coverage: all 20 standard slot rows, Pact boundaries, both-edition half-caster rounding, multiclass shared pools, per-class profiles/DC/attack/preparation, known/prepared/spellbook/granted/always-prepared states, ambiguous assignment, partial/manual and edition mismatch, ritual casting, concentration, cantrip tiers, upcasting, slot consumption, preparation limits, rests, determinism, and no mutation passed.
- 2026-09-14 — Task 8 focused verification: `npm test -- @characters` passed all 28 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 8 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal; generated output stayed local.
- 2026-09-14 — Task 8 whitespace verification: `git diff --check` passed.
- 2026-09-14 — Task 8 automation boundary: production certification remains at 0 `rules-ready`; Task 8 fixtures use declarative synthetic metadata, and no Compendium entry was silently promoted.
- 2026-09-14 — Task 9 rules verification: current official 2014 and 2024 D&D Beyond rules reconfirmed carrying capacity, 2014 variant thresholds, coin weight, equipment fields, weapon properties/masteries, and the three-item attunement maximum.
- 2026-09-14 — Task 9 direct checks: inventory calculation, runtime, engine, and focused fixture files passed `node --check`; inventory, core-engine, and runtime/rest tests passed directly.
- 2026-09-14 — Task 9 fixture coverage: stable/duplicate IDs, runtime quantity and currency, nested and invalid containers, capacity warnings, cost/weight/coin totals, both-edition encumbrance, speed propagation, armor/shields, item modifiers, weapon proficiency/damage/versatile/properties/mastery, Unarmed Strike, attunement limits, charges/rests, partial automation, determinism, and no mutation passed.
- 2026-09-14 — Task 9 focused verification: `npm test -- @characters` passed all 29 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 9 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal; generated output stayed local.
- 2026-09-14 — Task 9 whitespace verification: `git diff --check` passed.
- 2026-09-14 — Task 9 automation boundary: production certification remains at 0 `rules-ready`; inventory automation is proven with synthetic metadata only, and no Compendium entry was promoted.
- 2026-09-14 — Task 10 rules verification: official D&D Beyond 2014 and 2024 class tables were rechecked for Fighter/Wizard levels 1–5, subclass timing, Second Wind recovery, Weapon Mastery counts, spell preparation, and spell slots.
- 2026-09-14 — Task 10 direct checks: `node char/tests/class-certification.test.js` and `node char/tests/inventory-rules.test.js` passed. The golden suite covers 20 class-level cases plus subclass enforcement, Archery attack tracing, 2024 partial Second Wind recovery, and Arcane Recovery slot restoration.
- 2026-09-14 — Task 10 focused verification: `npm test -- @characters @compendium` passed all 37 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 10 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal; generated output stayed local.
- 2026-09-14 — Task 10 whitespace verification: `git diff --check` passed.
- 2026-09-14 — Task 10 automation boundary: only Fighter, Wizard, Champion, School of Evocation, and their 2024 counterparts are certified. Human/Sage/Soldier, unrelated classes/subclasses, other feats, D1 state, and remote systems were not changed.
- 2026-09-14 — Task 11 rules verification: official D&D Beyond 2014 and 2024 origin rules were rechecked for Human, Sage, Soldier, background ability choices, languages, skills, tools, Resourceful, Tough, Magic Initiate, and Savage Attacker.
- 2026-09-14 — Task 11 direct checks: the new first-slice suite passed 40 cross-product cases plus Savage Attacker, manual Variant Human, edition mismatch, metadata promotion, and Resourceful long-rest checks. The Gwendoline snapshot-backed D&D Beyond import suite and runtime/rest suite also passed.
- 2026-09-14 — Task 11 focused verification: `npm test -- @characters @compendium` passed all 38 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 11 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal; generated output stayed local.
- 2026-09-14 — Task 11 whitespace verification: `git diff --check` passed.
- 2026-09-14 — Task 11 automation boundary: open 2014 Variant Human and 2024 Origin Feat branches warn as manual; 2024 Sage’s Magic Initiate spell choices warn as manual until spell entries are certified. No effect is guessed.
- 2026-09-14 — Task 12 platform verification: current Cloudflare Workers guidance, D1 prepared/batch APIs, migrations guidance, and `@cloudflare/workers-types@5.20260914.1` signatures were checked before implementation. D1 access uses bound prepared statements; finalization uses an awaited batch.
- 2026-09-14 — Task 12 direct checks: migration, local repository, and API/finalization suites passed. Fixtures prove additive/idempotent migration, per-user/campaign isolation, pending/saved/failed states, retries, local/cloud recovery, auth, player assignment, DM authority, AOTR mirroring, occupied inactive IDs, `409`, and forced batch rollback.
- 2026-09-14 — Task 12 focused verification: `npm test -- @characters @campaigns` passed all 38 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 12 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal; generated output stayed local.
- 2026-09-14 — Task 12 whitespace verification: `git diff --check` passed after all Task 12 source and progress-log edits.
- 2026-09-14 — Task 12 remote boundary: migration `0017` exists locally but was not applied to local or remote Wrangler D1. No seed, deployment, commit, push, or external mutation occurred.
- 2026-09-14 — Task 13 direct checks: builder model, accessible UI contract, existing Quick Setup/editor UI, draft repository, and changed-module syntax checks passed.
- 2026-09-14 — Task 13 focused verification: `npm test -- @characters` passed all 36 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 13 build verification: `npm run build:site` passed and included the new builder modules and responsive/theme-aware Tailwind classes. Existing Browserslist age warning remained non-fatal.
- 2026-09-14 — Task 13 browser verification: `npm run test:browser -- @characters` passed in headless Firefox after the expected sandbox `listen EPERM` required the permitted localhost run. It proved entry-path preservation, all four progress states, saved navigation, heading focus, close/reopen resume, Quick Setup return, and 375 px no-overflow layout; the existing Character tracker and desktop/mobile Standard/Reversed audits also passed.
- 2026-09-14 — Task 13 whitespace verification: `git diff --check` passed before the final progress-log update; a final check followed the update.
- 2026-09-14 — Task 14 direct checks: schema normalization, Home filter/preference model, ruleset preview, accessible UI contracts, optional catalog provider, Character–Compendium adapter, class/origin certification regressions, changed-module syntax, and architecture boundaries passed.
- 2026-09-14 — Task 14 focused verification: `npm test -- @characters @compendium` passed all 46 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 14 build verification: `npm run build:site` passed and included the builder Home, catalog provider, integration adapter, and generated responsive/theme-aware CSS. Existing Browserslist age warning remained non-fatal.
- 2026-09-14 — Task 14 browser verification: `npm run test:browser -- @characters` passed in headless Firefox. It proved 2014 and 2024 flows, preference/source/filter persistence, mutually consistent facets, preview focus, no-mutation cancellation, confirmed incompatible-source cleanup, autosave, resume, mobile layout, and existing Character regressions.
- 2026-09-14 — Task 14 whitespace verification: `git diff --check` passed before the final progress-log update; a final check followed the update.
- 2026-09-14 — Task 15 direct checks: choice models for both editions, invalid selections, subclass links and gates, evaluator counts, progress states, accessible UI contracts, shell regression, rules evaluator, changed-module syntax, and architecture boundaries passed.
- 2026-09-14 — Task 15 focused verification: `npm test -- @characters @compendium` passed all 48 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 15 build verification: `npm run build:site` passed and included the choice-step modules and generated responsive/theme-aware CSS. Existing Browserslist age warning remained non-fatal.
- 2026-09-14 — Task 15 browser verification: `npm run test:browser -- @characters` passed in headless Firefox after the expected sandbox `listen EPERM` required the permitted localhost run. It proved 2024 Fighter/Champion, Soldier, Human, evaluator choices, autosave, complete progress, close/reopen resume to Abilities, mobile layout, and existing Character regressions; unit fixtures proved both editions.
- 2026-09-14 — Task 15 whitespace verification: `git diff --check` passed before the progress-log update; a final check follows Task 16.
- 2026-09-14 — Task 16 direct checks: all new builder completion/controller modules passed `node --check`; completion model, accessible UI, schema normalization, shell model, and inventory rules tests passed directly.
- 2026-09-14 — Task 16 fixture coverage: Standard Array assignment/swapping, point-buy budget and overspend, manual bounds, deterministic rolled bounds, equipment instances/quantities/gold/preservation, 2024 Fighter final materialization, 2014 Wizard cantrip/spellbook repertoire, manual warnings, blockers, overrides, and invalid identity passed.
- 2026-09-14 — Task 16 focused verification: `npm test -- @characters @compendium` passed all 50 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-14 — Task 16 build verification: `npm run build:site` passed after the final source edit and included all completion-step modules plus generated responsive/theme-aware CSS. Existing Browserslist age warning remained non-fatal.
- 2026-09-14 — Task 16 browser verification: `npm run test:browser -- @characters` passed in headless Firefox after the expected sandbox `listen EPERM` required the permitted localhost run. It proved all four ability methods, stored rolls, point-buy math, starting gold, description/ID generation, Review, an occupied-ID failure, focusable retry, successful finalization, materialized sheet values, draft removal, 375 px layout, and existing Character regressions.
- 2026-09-14 — Task 16 browser correction: the first run exposed that the finalize-error paragraph could not receive programmatic focus. Adding `tabindex="-1"` fixed focus restoration; the complete rerun passed.
- 2026-09-14 — Task 16 whitespace verification: `git diff --check` passed after source/test edits; the final progress-log check followed this entry.
- 2026-09-14 — Task 17 direct verification: V4 summary/model/UI tests, settings, layout, editor, architecture, and syntax checks passed.
- 2026-09-14 — Task 17 focused verification: all 97 suites selected by `npm test -- @characters @campaigns @character-layout @core` passed until the existing sandbox-only localhost `listen EPERM` in the static-route suite; all preceding Character, settings, Worker, migration, and compatibility suites passed.
- 2026-09-14 — Task 17 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-14 — Task 17 browser verification: `npm run test:browser -- @characters` passed in permitted headless Firefox after the expected sandbox `listen EPERM`. It proved five V4 tabs, keyboard switching, one live node per tracker section, core data/rolls, death-save visibility, 375 px layout, no overflow, V1/V2/V4 alignment, and Standard/Reversed themes.
- 2026-09-14 — Task 17 whitespace verification: `git diff --check` passed before moving Task 18 to In Progress.
- 2026-09-15 — Task 18 direct verification: filter, tracker-view, action-use, action/runtime UI, rest-controller, V4 summary, V4 layout, and syntax tests passed.
- 2026-09-15 — Task 18 focused verification: `npm test -- @characters` passed all 47 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 18 build verification: `npm run build:site` passed with generated V4 dialog/control CSS. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 18 browser verification: `npm run test:browser -- @characters` passed in permitted headless Firefox. It proved all six action filters, confirmation/cancel, exact resource consumption, condition persistence/removal, rest cancellation/reset, dice reuse, focus restoration, read-only blocking, desktop/mobile alignment, and Standard/Reversed themes.
- 2026-09-15 — Task 18 browser correction: one rerun exposed an asynchronous readiness race before six V4 abilities rendered. The wait now requires the completed ability grid; the full rerun passed.
- 2026-09-15 — Task 19 direct verification: V4 spell interaction, V4 spell UI, tracker-view, spellcasting-harness, and syntax tests passed.
- 2026-09-15 — Task 19 focused verification: `npm test -- @characters` passed all 49 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 19 build verification: `npm run build:site` passed with the generated spell-browser, preparation, and casting styles. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 19 browser verification: `npm run test:browser -- @characters` passed in permitted headless Firefox. It proved combined spell filters, known/spellbook distinctions, preparation persistence, cast cancellation, level-2 upcasting, exact slot consumption, ritual no-slot casting, concentration, spell damage dice, focus restoration, read-only filtering/dice, mutation blocking, desktop/mobile alignment, and Standard/Reversed themes.
- 2026-09-15 — Task 19 corrections: the focused test harness needed the new filter initializer, and one browser selector string needed quote correction. Both complete reruns passed.
- 2026-09-15 — Task 19 whitespace verification: `git diff --check` passed after source, test, build-output, and progress-log changes.
- 2026-09-15 — Task 20 focused verification: `npm test -- @characters` passed all 51 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 20 build verification: `npm run build:site` passed with generated inventory-browser and runtime-control styles. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 20 browser verification: `npm run test:browser -- @characters` passed in permitted headless Firefox after the expected sandbox `listen EPERM`. It proved combined inventory filters, currency display, quantity-derived weight, container moves, equip state, the three-item attunement limit, charge cancellation/consumption, focus restoration, refresh persistence, 375 px no-overflow, read-only mutation blocking, and enabled filters.
- 2026-09-15 — Task 20 whitespace verification: `git diff --check` passed before moving Task 21 to In Progress.
- 2026-09-15 — Task 21 focused verification: `npm test -- @characters` passed all 53 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 21 build verification: `npm run build:site` passed with generated feature, Extra, Background, and detail-drawer styles. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 21 browser verification: `npm run test:browser -- @characters` passed in permitted headless Firefox. It proved all five feature groups, selections, linked resources, all five Extra groups, Extra HP/uses, rich Background, proficiencies/languages, Notes, detail close/Escape/focus, runtime refresh, 375 px no-overflow, read-only detail access, mutation blocking, desktop/mobile alignment, and Standard/Reversed themes.
- 2026-09-15 — Task 21 browser corrections: the first run removed the letter `s` because an embedded regex needed escaped backslashes; the next reached a whitespace-insensitive detail assertion. Both test-only corrections were followed by a complete green rerun.
- 2026-09-15 — Task 21 whitespace verification: `git diff --check` passed before moving Task 22 to In Progress.
- 2026-09-15 — Task 22 direct verification: conversion, D&D Beyond import, repository, integration, UI-contract, and changed-module syntax tests passed. Fixtures prove no-mutation preview/cancel, ruleset separation, partial/manual rejection, multiclass ambiguity, preserved flat values/unknown fields, exact rollback cloning, Gwendoline totals, and local-before-cloud persistence.
- 2026-09-15 — Task 22 focused verification: `npm test -- @characters` passed all 55 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 22 build verification: `npm run build:site` passed with generated conversion-dialog styles. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 22 browser verification: `npm run test:browser -- @characters` passed in permitted headless Firefox after the expected sandbox `listen EPERM`. It proved all five preview groups, reviewed Fighter/Human/Soldier matching, explicit unresolved values, exact cancel, preserved live totals, incomplete automatic conversion, local rollback storage, exact restore, focus, read-only authority, and desktop/mobile Standard/Reversed alignment.
- 2026-09-15 — Task 22 browser correction: the first run correctly exposed existing runtime HP overriding the stored flat HP before conversion; the assertion now compares against the live pre-conversion snapshot. The complete rerun passed.
- 2026-09-15 — Task 22 whitespace verification: `git diff --check` passed before this progress-log update; a final check followed it.
- 2026-09-15 — Task 23 generation: `npm run build:compendium-metadata` built metadata for 15,191 entries with the extended reviewed certification ranges.
- 2026-09-15 — Task 23 direct verification: `node char/tests/class-certification.test.js` passed Fighter/Wizard levels 1–20 in both rulesets plus Fighter 5/Wizard 5 multiclass boundaries.
- 2026-09-15 — Task 23 focused verification: `npm test -- @characters @compendium` passed all 62 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 23 whitespace verification: `git diff --check` passed before moving Task 24 to In Progress.
- 2026-09-15 — Task 24 rules verification: current official 2014/2024 class tables were checked for preparation, slots, cantrips, Channel Divinity, Lay On Hands, subclass levels, and feature progression.
- 2026-09-15 — Task 24 generation: `npm run build:compendium-metadata` built metadata for 15,191 entries; the certification report contains 22 certified entries and zero unresolved rules.
- 2026-09-15 — Task 24 direct verification: spell-engine and Cleric/Paladin certification suites passed. Coverage includes 80 level/edition cases, 2014 single/multiclass half-caster rounding, parent-class Channel Divinity spending, recovery, and both-edition Cleric 5/Paladin 5 slots.
- 2026-09-15 — Task 24 focused verification: `npm test -- @characters @compendium` passed all 63 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 24 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 24 whitespace verification: `git diff --check` passed before this progress-log update; a final check followed it.
- 2026-09-15 — Task 25 generation: `npm run build:compendium-metadata` regenerated all 15,191 metadata entries with Druid/Ranger certification.
- 2026-09-15 — Task 25 direct verification: `node char/tests/nature-class-certification.test.js` passed 80 level/edition cases, Wild Shape Extras, resource recovery, Land's Aid resource linkage, and Druid 5/Ranger 5 multiclass boundaries.
- 2026-09-15 — Task 25 focused verification: `npm test -- @characters @compendium` passed all 64 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 25 whitespace verification: `git diff --check` passed before moving Task 26 to In Progress.
- 2026-09-15 — Task 26 rules verification: current official 2014/2024 class tables were checked for spell repertoire, cantrips, slots, Bardic Inspiration, Expertise, Metamagic, Sorcery Points, subclass timing, and feature progression.
- 2026-09-15 — Task 26 generation: `npm run build:compendium-metadata` regenerated all 15,191 entries at catalog version `sha256-f89ab373b63db0da42d1`; the report contains 38 certified entries and zero unresolved rules.
- 2026-09-15 — Task 26 direct verification: `node char/tests/arcane-class-certification.test.js` passed 80 level/edition cases, inspiration die/rest scaling, Jack of All Trades, Expertise, Metamagic, Draconic durability, and both Bard 5/Sorcerer 5 multiclass cases. The Task 25 nature-class suite also passed after shared expertise normalization.
- 2026-09-15 — Task 26 focused verification: `npm test -- @characters @compendium` passed all 65 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 26 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 26 whitespace verification: `git diff --check` passed before this progress-log update; a final check followed it.
- 2026-09-15 — Task 27 rules verification: current official 2014/2024 class tables were checked for Pact Magic, slots, repertoire, cantrips, Eldritch Invocation counts and prerequisites, patron timing, and Fiend progression.
- 2026-09-15 — Task 27 generation: `npm run build:compendium-metadata` regenerated all 15,191 entries at catalog version `sha256-58d4e3ed275531564106`; the report contains 42 certified entries and zero unresolved rules.
- 2026-09-15 — Task 27 direct verification: `node char/tests/warlock-class-certification.test.js` passed 40 level/edition cases, invocation prerequisite and level gates, Pact Magic rests, 2024 Magical Cunning resource recovery, and both Warlock 5/Wizard 5 multiclass cases.
- 2026-09-15 — Task 27 focused verification: `npm test -- @characters @compendium` passed all 66 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 27 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 27 whitespace verification: `git diff --check` passed after this progress-log update.
- 2026-09-15 — Task 28 rules verification: current official 2014/2024 class tables were checked for Rage, Rage damage and recovery, Martial Arts dice, Ki/Focus, movement, Unarmored Defense, save DCs, subclass timing, Berserker, and Open Hand progression.
- 2026-09-15 — Task 28 generation: `npm run build:compendium-metadata` regenerated all 15,191 entries at catalog version `sha256-25dbb8fd4f9da146a961`; the report contains 50 certified entries and zero unresolved rules.
- 2026-09-15 — Task 28 direct verification: the rules-engine, inventory, Fighter/Wizard, Warlock, Barbarian/Monk, and Compendium-metadata suites passed. The new suite covers 80 level/edition cases, martial dice/actions, resource recovery, all armor gates, first-formula Unarmored Defense, and both Barbarian 5/Monk 5 multiclass cases.
- 2026-09-15 — Task 28 focused verification: `npm test -- @characters @compendium` passed all 67 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-15 — Task 28 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-15 — Task 28 whitespace verification: `git diff --check` passed after this progress-log update.
- 2026-09-16 — Task 29 rules verification: current official 2014/2024 Rogue and Thief tables were checked for hit die, proficiencies, Expertise, Sneak Attack, subclass timing, Cunning Action/Strike, Reliable Talent, Slippery Mind, Stroke of Luck, and Thief progression.
- 2026-09-16 — Task 29 generation: `npm run build:compendium-metadata` regenerated all 15,191 entries at catalog version `sha256-27e0181ca9b2ff4af6ac`; the report contains 54 certified entries, all twelve core classes in both editions, and zero unresolved certified rules.
- 2026-09-16 — Task 29 direct verification: `node char/tests/rogue-class-certification.test.js` passed 40 level/edition cases, Sneak Attack/Expertise/save/resource boundaries, both Rogue 5/Warlock 5 multiclass cases, and the generated all-core report.
- 2026-09-16 — Task 29 focused verification: `npm test -- @characters @compendium` passed all 68 selected suites.
- 2026-09-16 — Task 29 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-16 — Task 29 whitespace verification: `git diff --check` passed before moving Task 30 to In Progress.
- 2026-09-16 — Task 30 direct verification: NPC draft/repository, NPC builder UI, Character builder UI, and campaign route tests passed. Coverage includes campaign-scoped drafts, shared Fighter calculations/runtime, manager enforcement, hidden defaults, local/cloud collision behavior, offline recovery, build redaction, and no-overwrite guarantees.
- 2026-09-16 — Task 30 focused verification: `npm test -- @characters @npcs @campaigns @compendium` passed all 75 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-16 — Task 30 browser verification: `npm run test:browser -- @npcs` passed all focused Firefox flows, including Detailed Build finalization, 375px no-overflow layout, hidden defaults, runtime projection, import, edit controls, and player redaction. The first sandboxed attempt hit expected localhost `listen EPERM`; the permitted rerun passed.
- 2026-09-16 — Task 30 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-16 — Task 30 whitespace verification: `git diff --check` passed before this progress-log update; a final check followed it.
- 2026-09-16 — Task 31 direct verification: syntax checks plus the freeform NPC model/UI, runtime settings, campaign route, Character editor, and V4 layout suites passed. Freeform input remained unchanged and unconverted; projected feature details contained no hidden description.
- 2026-09-16 — Task 31 focused verification: `npm test -- @characters @npcs @campaigns` passed all 70 selected suites. The intentional offline settings-fallback diagnostic appeared and its suite passed.
- 2026-09-16 — Task 31 browser verification: `npm run test:browser -- @npcs` passed all focused Firefox flows. The freeform NPC used V4 as DM and player, stayed conversion-free, preserved editor visibility controls, disabled mutations, allowed safe details, redacted hidden background/feature text, fit 375px, and rendered with real light/dark palettes.
- 2026-09-16 — Task 31 build verification: `npm run build:site` passed. Existing Browserslist age warning remained non-fatal.
- 2026-09-16 — Task 31 whitespace verification: `git diff --check` passed after the progress-log update.

For every later task, record the command, result, relevant fixture/browser scenario, and any known pre-existing warning. Do not replace older evidence.

## Coverage Report

### Current state

- Catalog version: `sha256-27e0181ca9b2ff4af6ac`.
- Total: 15,191 entries; 54 `rules-ready`, 6,054 `partial`, and 9,083 `manual`.
- Rulesets: 13,431 `5e`, 1,530 `5.5e`, and 230 shared/agnostic entries.
- Dependencies: 12,747 resolved and 4,252 missing references. Missing references remain visible and prevent certification.
- Stable IDs: 15,191 entries and original IDs; 0 missing IDs, collisions, or ambiguities.
- Certification is stored in reviewed overlays. Uncertified parsed expressions remain partial/manual and cannot apply automatically.
- The Task 4 evaluator can now validate strict rule graphs and choices, but production certification remains intentionally unchanged until the first-slice content tasks prove each entry.
- Tasks 5–9 cover the core engine surfaces; Tasks 10–11 and 23–29 promote 54 proven class, subclass, species, and background entries. The generated certification report confirms all twelve core classes in both editions and has zero unresolved rules inside this scope.
- All entries remain browseable through the existing Compendium.
- Generated detail lives in `compendium/data/coverage.json`, `rules-metadata.json`, `original-ids.json`, and `character-certification-report.json`.

### Required generated report after Task 3

For each category and ruleset, report:

- total entries;
- `rules-ready`, `partial`, and `manual` counts;
- resolved and unresolved dependency counts;
- unsupported rule-expression counts grouped by expression type;
- stable-ID collisions or original-ID ambiguities;
- certified classes/species/backgrounds and supported level ranges;
- catalog version and generator input fingerprint.

Certification is explicit. Completing engine code does not automatically certify content.

## Rollback Notes

- Task 1 rollback is deletion of this new Markdown file. The removed `.playwright-cli/` audit files were untracked generated artifacts and can be recreated by rerunning the audit.
- Schema-v2 character changes remain embedded additively in JSON. Old code continues consuming the flat projection and ignores `characterSchemaVersion`/`build`.
- Legacy normalization must be idempotent and preserve the original document. Conversion creates a preview and rollback copy before committing.
- Draft D1 migration will add tables only. It must not alter or drop existing character/runtime tables.
- V4 style support is additive. Rolling application code back must leave V1–V3 settings usable; unknown `v4` settings normalize safely in old code or require a documented pre-rollout compatibility step.
- Generated Compendium changes originate in the generator and can be reverted by reverting generator/output together. Existing IDs remain stable.
- Task 3 sidecars and manifest pointers are additive. Old repository code ignores them; new repository code treats a missing sidecar as empty metadata. Reverting requires removing the three sidecars and manifest pointers together.
- Task 4 is isolated to new pure modules plus test registration and this log. Reverting removes `char/js/rules/`, `char/tests/rules-evaluator.test.js`, and its test-runner entry; stored Character documents remain unchanged.
- Task 5 adds pure core-definition/calculation/engine modules and a focused test file. Reverting those files and their test-runner entry restores the Task 4 boundary; no stored Character, runtime, localStorage, D1, or generated Compendium data changes are required.
- Task 6 adds pure durability and override modules and extends the existing rules engine/test fixture. Reverting those additions and the Task 6 portions of core/engine restores the Task 5 boundary; no stored data, runtime state, generated Compendium, migration, or remote rollback is required.
- Task 7 adds pure action/runtime modules and routes only rules-mode rests through them. Reverting those modules plus the Task 7 engine, tracker state/rest, tests, and generated CSS changes restores the Task 6 boundary; legacy Character documents need no data rollback.
- Task 8 adds the pure spell calculation module, spell runtime transitions, assignment normalization, grant metadata, engine composition, tests, and generated CSS changes. Reverting those Task 8 portions restores the Task 7 boundary; no Character document, runtime record, Compendium certification, D1 data, or remote system needs migration rollback.
- Task 9 adds the pure inventory calculation module, additive engine inputs/projection, runtime inventory transitions, tests, and generated CSS changes. Reverting those Task 9 portions restores the Task 8 boundary; schema-v2 inventory data remains valid but inactive, and no stored Character, D1 data, Compendium certification, or remote system needs migration rollback.
- Task 10 certification is reversible by removing the reviewed overlay registry, inline-choice/class projection additions, golden fixtures/report, and regenerating the metadata sidecars. No Character document, runtime record, D1 table, or remote data needs rollback.
- Task 11 certification is reversible by removing the six origin overlays, origin projection/runtime additions, first-slice and Gwendoline fixtures, test registration, and regenerating metadata sidecars. Runtime inspiration remains additive; no stored Character, D1 table, or remote data needs rollback.
- Task 12 rollback removes draft route/repository code and migration `0017`. If `0017` was applied later, export recovery first, then drop only `campaign_character_build_drafts` and `character_build_drafts`; final Character tables and existing V1–V3 data need no rewrite.
- Task 22 is additive application code and import metadata. Converted Characters retain an embedded exact rollback document; use **Restore manual snapshot** before reverting if automatic conversion has been used. Reverting the conversion module/UI/import marker leaves unconverted legacy and D&D Beyond flat sheets unchanged.
- Task 30 rollback removes the NPC builder draft repository, shared-builder NPC options, NPC Detailed Build wiring, and create-only route branch. Existing freeform NPCs and normal upsert writes remain unchanged; locally finalized rules-built NPCs retain valid flat compatibility fields and can continue opening in the legacy tracker.
- Task 31 rollback removes NPC `v4` style acceptance/resolution, NPC-aware V4 labels/read-only exceptions, and focused tests. Stored freeform NPC documents need no rewrite because Task 31 never converts or changes their shape; remove any persisted NPC `v4` overrides or let older code normalize them to V1 before rolling application code back.
- Before any remote D1 migration or deployment: obtain explicit approval, export/verify a recovery point, verify migration order, and record the exact rollback procedure here.
- No remote operation has been performed for this project plan.

## Non-Goals

- Pixel-for-pixel copying of D&D Beyond.
- Copying D&D Beyond branding, assets, art, CSS, proprietary UI code, or protected text.
- Marketplace purchases, ownership/entitlements, subscription tiers, or content sharing.
- Homebrew publishing/community distribution. Manual and existing homebrew data remain supported.
- Real-time multi-user collaboration or live-tab synchronization.
- A virtual tabletop, maps, tokens, battlefield positioning, target selection, or automatic target damage.
- Replacing the existing editor, Quick Setup, imports, V1–V3 trackers, V3 personal layouts, exports, or static/local fallback.
- Requiring an active D&D Beyond account or API at runtime.
- Character-to-NPC work before the character engine and V4 tracker reach their stated task boundaries.

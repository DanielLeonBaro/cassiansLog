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

- Current milestone: Foundation
- Completed through: Task 5
- Next task: Task 6 — durability, movement, senses, defenses, and overrides
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
    },
    levels: [
      { classId: "", subclassId: "", level: 1, hitPointRolls: [] },
    ],
    speciesId: "",
    backgroundId: "",
    abilityScores: {
      method: "standard" | "point-buy" | "manual" | "rolled",
      base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
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
| 12 | To Do | Draft local persistence, additive D1 migration, APIs, auth, finalization, and collision handling. `BLD-004`, `BLD-012`, `CMP-006`, `CMP-007` | Fresh/upgraded/idempotent migration; local/cloud success/failure; API method/auth/role/409 tests; `npm test -- @characters @campaigns`. |
| 13 | To Do | Accessible builder shell, progress navigation, autosave status, resume, dirty/failure recovery. `BLD-001`–`BLD-004`, `BLD-013` | Model/UI/browser tests; `npm run build:site`; `npm run test:browser -- @characters`. |
| 14 | To Do | Home preferences and ruleset/source/coverage filters. `BLD-005`, `BLD-006`, `BLD-013` | Filter/state/change-preview tests and browser flows in both rulesets. |
| 15 | To Do | Class, Background, and Species/Race steps. `BLD-002`, `BLD-007`, `BLD-009`, `BLD-013` | First-slice choice, invalid choice, navigation, persistence, and accessibility flows. |
| 16 | To Do | Abilities, Equipment, Description, and Review/Finish steps. `BLD-008`–`BLD-013` | All ability methods, equipment alternatives, review blockers/warnings, finalize/retry browser flows. |
| 17 | To Do | Register opt-in V4 and build responsive core summary. `V4-001`–`V4-004`, `V4-011`, `V4-012`, `CMP-001` | Settings/role/layout tests, built output, desktop/mobile, both themes, V1–V3 regression. |
| 18 | To Do | V4 Actions, conditions, rests, resources, and dice. `V4-005`, `V4-010`–`V4-012`, `RUL-006` | Roll/use/confirmation/cancel/read-only/rest browser tests. |
| 19 | To Do | V4 Spells, preparation, and casting. `V4-006`, `V4-010`–`V4-012` | Known/prepared/spellbook/slot/upcast/concentration/read-only browser tests. |
| 20 | To Do | V4 Inventory, currency, containers, equip, and attunement. `V4-007`, `V4-011`, `V4-012` | Inventory mutation, derived totals, limits, persistence, role, and mobile browser tests. |
| 21 | To Do | V4 Features, Extras, proficiencies, Background, Notes, and detail sidebars. `V4-008`, `V4-009`, `V4-011`, `V4-012` | Group/detail/extras/notes/focus/read-only browser tests. |
| 22 | To Do | Legacy and D&D Beyond conversion previews, cancellation, rollback copy, and unresolved mapping. `CMP-002`–`CMP-005`, `RUL-010` | No-mutation cancel, exact manual open, snapshot import, mapping, rollback, Gwendoline tests. |
| 23 | To Do | Fighter/Wizard levels 6–20 and their multiclass combination. `RUL-001`–`RUL-011` | Per-level class fixtures, spell-slot multiclass boundaries, unresolved coverage zero for certified scope. |
| 24 | To Do | Certify Cleric and Paladin. `RUL-001`–`RUL-011` | Both-edition level fixtures, preparation, channel resources, multiclass regression. |
| 25 | To Do | Certify Druid and Ranger. `RUL-001`–`RUL-011`, `V4-009` | Both-edition fixtures, wild shape/extras, half-caster and multiclass regression. |
| 26 | To Do | Certify Bard and Sorcerer. `RUL-001`–`RUL-011` | Both-edition fixtures, expertise/inspiration/metamagic and multiclass regression. |
| 27 | To Do | Certify Warlock pact and invocation behavior. `RUL-001`–`RUL-011` | Pact slots, rests, invocations, prepared/known differences, multiclass regression. |
| 28 | To Do | Certify Barbarian and Monk. `RUL-001`–`RUL-011` | Rage/focus resources, unarmored defense/movement, martial actions, multiclass regression. |
| 29 | To Do | Certify Rogue and complete all-core cross-class/multiclass regression. `RUL-001`–`RUL-011` | Both-edition Rogue fixtures plus representative pairwise/caster-level regressions and full core coverage report. |
| 30 | To Do | Character-built NPC mode using the shared engine. `NPC-001`, `NPC-003` | Campaign isolation, role, runtime, rules, and browser tests; no freeform presentation changes. |
| 31 | To Do | V4 presentation for freeform NPCs with visibility/redaction preservation. `NPC-002`, `NPC-003` | Existing import/freeform regression, player projection/redaction, DM edit, mobile/theme browser tests. |
| 32 | To Do | Final accessibility, responsive, theme, role, migration, rollback, built-output, and compatibility audit. All IDs | Full `npm test`, `npm run build:site`, full browser suite, `git diff --check`, fresh/upgraded migration proof, and dated D&D Beyond re-audit. |

## In Progress

None. Task 12 is next: add local builder drafts, additive D1 storage/APIs, authorization, atomic finalization, and collision handling.

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

For every later task, record the command, result, relevant fixture/browser scenario, and any known pre-existing warning. Do not replace older evidence.

## Coverage Report

### Current state

- Catalog version: `sha256-66622fa7953f5b2e5953`.
- Total: 15,191 entries; 14 `rules-ready`, 6,094 `partial`, and 9,083 `manual`.
- Rulesets: 13,431 `5e`, 1,530 `5.5e`, and 230 shared/agnostic entries.
- Dependencies: 13,071 resolved and 4,314 missing references. Missing references remain visible and prevent certification.
- Stable IDs: 15,191 entries and original IDs; 0 missing IDs, collisions, or ambiguities.
- Certification is stored in reviewed overlays. Uncertified parsed expressions remain partial/manual and cannot apply automatically.
- The Task 4 evaluator can now validate strict rule graphs and choices, but production certification remains intentionally unchanged until the first-slice content tasks prove each entry.
- Tasks 5–9 cover the core engine surfaces; Tasks 10–11 promote 14 proven class, subclass, species, and background entries. The generated first-slice report has zero unresolved rules inside this certified scope.
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

# Character Builder V4 Completion and Content Expansion

This file is the durable specification and progress log for making the V4 builder comfortable, permissive, source-aware, and capable of building a character through level 20 in the 2014 (`5e`) and 2024 (`5.5e`) rulesets.

## Working Rules

- Work one numbered task at a time. Only one task may be `In Progress`.
- A task is `Done` only after its focused tests pass and evidence is recorded.
- Search the local Compendium first. Use external sources only for missing or unclear data.
- Never guess a rule. Unproven content stays `partial` or `manual` and produces a visible warning.
- Keep `5e` and `5.5e` content separate. Cross-edition compatibility must be explicit.
- Preserve V1–V3, existing V4 characters, URLs, imports, exports, localStorage, D1 documents, permissions, and offline recovery.
- Do not deploy, apply remote migrations, seed remote D1, or publish retrieved content without separate approval.
- Public accessibility does not prove redistribution rights. Preserve attribution and license state for every retrieved page.

## Current State

- Research and repository audit: **2026-09-21**.
- Completed through: **Task 25**.
- In progress: **None. This completion queue is done.**

## Product Decisions

1. **Finish with gaps is allowed.** A user may create a character with unfinished sections. Only an invalid/occupied character ID, an invalid document, or missing permission may stop persistence.
2. **Warnings explain impact.** Finish confirmation lists each pending choice and examples of affected output, such as missing AC, attacks, class features, spell slots, prepared spells, languages, or proficiencies.
3. **Incomplete remains resumable.** A partially built character keeps `build.status: "incomplete"`, opens in V4 with uncertainty markers, and can resume the builder later.
4. **No silent automation.** Known rules-ready data calculates. Partial/manual data remains visible and selectable but never invents modifiers.
5. **Comfort before density.** Detailed Build uses a larger responsive dialog, compact dropdown/add controls, removable selection chips, contextual details, and a live sheet preview.
6. **One reusable selection pattern.** Spells, feature choices, feats, languages, proficiencies, equipment, and other large lists share search, filter, add, inspect, remove, source, and coverage behavior.
7. **Source-first corpus.** Every entry stores canonical URL, retrieved time, ruleset, content type, stated publication, page title, author/site when available, license state, parser version, raw hash, and automation coverage.
8. **Wikidot is an input, not authority.** Page metadata and stated publication are preserved. Official Compendium/SRD facts win when sources conflict. Conflicts are reported, never silently merged.
9. **User-run retrieval tool.** The crawler lives in a standalone folder, has no Cassian runtime dependency, rate-limits requests, caches pages, resumes safely, and exports separate Cassian and Aurora formats.

## Acceptance IDs

### Completion

- `FIN-001` Finish remains available when builder sections are incomplete.
- `FIN-002` Confirmation names every pending section and its likely calculation/display impact.
- `FIN-003` Cancel returns to Review without mutation; confirm creates the character without discarding the draft source.
- `FIN-004` Incomplete characters retain uncertainty warnings and a Resume Builder action.
- `FIN-005` Completing missing choices later recalculates only rules-ready values and clears resolved warnings.

### Builder UX

- `UX-001` Detailed Build expands the creation dialog to a comfortable desktop width and height while retaining mobile fit.
- `UX-002` Desktop layout has progress navigation, main editor, and live character preview. Narrow layouts stack them.
- `UX-003` Large option sets use searchable single-choice dropdowns or add-to-list comboboxes, not clustered radio/checkbox grids or native multi-select controls.
- `UX-004` Added choices render as removable chips/cards. Keyboard users can inspect and remove them.
- `UX-005` Hover/focus shows a short safe summary. Detail action opens the Cassian Compendium entry; external search is a separate clearly labeled action.
- `UX-006` Selection controls show ruleset, publication, automation status, prerequisites, level, and unavailable reason.
- `UX-007` Live preview updates identity, levels, abilities, HP, AC, attacks, saves, skills, spells, resources, proficiencies, inventory, and warnings without saving first.
- `UX-008` Focus restoration, screen-reader labels, error summaries, light/dark themes, and 320px layouts pass.

### Rules and content

- `DAT-001` Builder supports character levels 1–20; current UI level cap of 5 is removed only with matching rules coverage warnings.
- `DAT-002` Both rulesets support every core class and all available Compendium subclasses as rules-ready, partial, or manual.
- `DAT-003` Classes, subclasses, species/races, backgrounds, feats, spells, equipment, features, companions, languages, and proficiencies retain publication/source metadata.
- `DAT-004` Rule dependencies and choice grants use stable IDs; names are display text only.
- `DAT-005` Multiclass prerequisites, class level order, hit points, spell slots, Pact Magic, proficiency, and feature stacking are edition-aware.
- `DAT-006` Level-gated ASIs/feats, subclass choices, spell choices, invocations, masteries, fighting styles, expertise, and similar repeated choices are represented explicitly.
- `DAT-007` Manual/partial content gives actionable missing-automation warnings.
- `DAT-008` Golden fixtures cover levels 1, 3, 5, 11, 17, and 20 plus representative multiclass boundaries in each edition.

### Retrieval tool

- `SRC-001` Standalone Node CLI crawls `dnd5e.wikidot.com` and `dnd2024.wikidot.com` without importing Cassian code.
- `SRC-002` Discovery supports sitemap/index pages and explicit URLs; crawl obeys configured rate, retry, cache, and robots policy.
- `SRC-003` Parser extracts type, name, ruleset, stated publication, source URL, headings, tables, links, prerequisites, and content blocks without inventing fields.
- `SRC-004` Output is grouped by stated publication under filesystem-safe source folders; unknown source goes to `_unknown-source` and fails strict export.
- `SRC-005` Cassian export matches the Compendium import contract and retains provenance/coverage metadata.
- `SRC-006` Aurora export produces valid Aurora XML structure with deterministic IDs and preserved source references.
- `SRC-007` Dry-run, resume, validation report, conflict report, deterministic output, fixtures, and parser tests work offline.
- `SRC-008` Raw snapshots and normalized output stay separate. Export never alters raw evidence.

## Information Required to Complete a Level-20 Character

The corpus is complete only when every selected option can supply these fields or explicitly declare them unsupported.

### Identity and advancement

- Name, portrait, pronouns, alignment, deity, campaign, status, notes, appearance, personality, ideals, bonds, flaws, organizations, and backstory.
- Ruleset, total level, ordered class levels, subclasses, XP/milestone mode, level-up history, and hit-point choice/roll per level.
- Multiclass prerequisites and first-class versus later-class proficiencies.

### Origin

- `5e`: race/subrace or lineage, racial ability changes, age/size/speed, senses, languages, proficiencies, traits, innate spells, and background feature/equipment/customization.
- `5.5e`: species, size/speed/senses/traits, background ability options, Origin feat, two skills, tool, languages when granted, and starting equipment/currency.
- Source-specific variants, replacement traits, custom origin/background rules, and incompatibilities.

### Abilities and proficiencies

- Standard array, 27-point buy, rolled, and manual base scores.
- Ability increases from origin, feats/ASIs, class features, items, boons, and overrides; edition limits and maximum changes.
- Saving throws, skills, expertise, half proficiency, tools, weapons, armor, shields, languages, initiative, passives, and trace sources.

### Class progression

- Hit die, starting HP, later-level HP, primary abilities, saves, proficiencies, starting equipment/gold, multiclass grants, and spellcasting model.
- Feature table for every class level 1–20, including use counts, recharge/rest timing, scaling dice/values, actions, choices, replacements, prerequisites, and dependent features.
- Subclass selection level and every subclass feature level. 2014 timing varies by class; 2024 core subclasses normally begin at level 3.
- ASI/feat levels, Epic Boons, Extra Attack stacking, unarmored-defense conflicts, resource scaling, and capstones.

### Feats and choices

- Category, ruleset, prerequisite expression, repeatability, level gate, ability increase, granted proficiency/language/spell/action/resource, replacement, and choice counts.
- Fighting styles, weapon masteries, invocations, metamagic, maneuvers, infusions, magical secrets, expertise, favored options, and equivalent class-specific catalogs.

### Spellcasting

- Casting ability, focus, spell list, cantrips, known/prepared/spellbook counts, always-prepared/granted spells, rituals, replacements, and preparation rules.
- Full-caster, half-caster, third-caster, Pact Magic, multiclass slot math, class-specific recovery, upcasting, concentration, components, range, duration, attack/save, damage/healing, and scaling.
- Every spell needs level, school, lists, casting time, ritual flag, range, components/material, duration/concentration, effect, higher-level text/rules, source, and edition.

### Equipment and derived sheet

- Starting packages and alternatives, currency, items, quantities, containers, cost, weight, capacity, equip state, attunement, charges, recharge, prerequisites, and modifiers.
- Armor/shield AC formulas, weapons, properties, masteries, attack ability, proficiency, reach/range, attacks, damage, versatile/two-handed/offhand behavior, ammunition, and unarmed strikes.
- HP, temp HP, hit dice, AC, initiative, movement modes, senses, defenses, conditions, exhaustion, death saves, attacks, spell DC/attack, passive scores, carrying capacity, and encumbrance.
- Short/long rest behavior, limited resources, concentration, preparation, slots, charges, and runtime state must remain separate from build choices.

## Edition Boundary Ledger

| Domain | `5e` / 2014 | `5.5e` / 2024 |
|---|---|---|
| Origin | Race/subrace and background; ability changes usually come from race/lineage | Species and background; background supplies ability options and Origin feat |
| Subclass | Selection level varies by class | Core class subclass selection standardized at level 3 |
| Feats | Optional feat/ASI model with source-specific prerequisites | Origin, General, Fighting Style, and Epic Boon categories with explicit level/prerequisite use |
| Weapons | Properties and attacks | Properties plus Weapon Mastery choices/effects |
| Inspiration | Inspiration | Heroic Inspiration terminology/behavior |
| Exhaustion | Legacy exhaustion model | 2024 exhaustion model |
| Spell lists | 2014 spell versions and class lists | 2024 spell versions/lists; legacy content must be labeled when enabled |
| Multiclass | 2014 prerequisites/grants/slot table | 2024 class tables, prerequisites, grants, and spell preparation behavior |

Exact per-entry rules belong in versioned Compendium metadata and reviewed fixtures, not hardcoded UI branches.

## Source Policy and Research Baseline

Order of use:

1. Existing generated Compendium entry and reviewed automation overlay.
2. Official Creative Commons SRD or official free rules for the matching edition.
3. Requested Wikidot page for discovery, structured extraction, and its stated publication/source.
4. Other public web references only when the first three do not resolve a field; record conflict and confidence.

Baseline references:

- [Cassian target: D&D Beyond 2024 character classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes)
- [SRD 5.2.1 Creative Commons PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)
- [SRD 5.1 Creative Commons legal/rules PDF](https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf)
- [D&D 5e Wikidot](https://dnd5e.wikidot.com/)
- [D&D 2024 Wikidot](http://dnd2024.wikidot.com/)
- [Far Traveler example](https://dnd5e.wikidot.com/background:far-traveler), which states `Sword Coast Adventurer's Guide` as its source.

Copyright/licensing rule: the tool may archive user-requested public pages with provenance for personal review, but Cassian/Aurora export must carry `licenseStatus`. Only content with verified permission or user-approved private-use handling may be redistributed. “Public page” is not treated as “public domain.”

## Standalone Retrieval Tool Contract

Planned portable folder: `tools/wikidot-compendium-importer/`.

```text
wikidot-compendium-importer/
  package.json
  README.md
  LICENSE
  src/
    cli.js
    discover.js
    fetch.js
    parse.js
    normalize.js
    source-name.js
    validate.js
    exporters/cassians-log.js
    exporters/aurora.js
  schemas/
  test/fixtures/
  output/
    raw/<site>/
    normalized/<ruleset>/<publication>/
    cassians-log/<publication>/
    aurora/<publication>/
    reports/
```

Planned commands:

```bash
npm run crawl -- --site 5e --type background --resume
npm run crawl -- --site 5.5e --url http://dnd2024.wikidot.com/class:wizard
npm run validate
npm run export:cassians-log
npm run export:aurora
```

Output records include:

```json
{
  "schemaVersion": 1,
  "id": "stable-deterministic-id",
  "name": "Far Traveler",
  "type": "background",
  "ruleset": "5e",
  "publication": "Sword Coast Adventurer's Guide",
  "sourcePageUrl": "https://dnd5e.wikidot.com/background:far-traveler",
  "retrievedAt": "...",
  "rawSha256": "...",
  "parserVersion": "...",
  "licenseStatus": "unknown",
  "automationStatus": "manual",
  "content": {},
  "warnings": []
}
```

## Repository Audit — Task 1

### Existing data

- Compendium: 15,191 entries across 86 publications.
- Builder-relevant inventory: 44 classes, 543 subclasses, 340 races/lineages, 176 backgrounds, 432 feats, 2,046 spells, 3,139 items, 7,112 features, 598 companions, 92 languages, and 242 proficiencies.
- Rules coverage: 54 `rules-ready`, 6,054 `partial`, 9,083 `manual`; 4,252 dependency references remain unresolved.
- Current certification covers all twelve core classes at levels 1–20 in both editions, but only one representative subclass per class plus Human, Sage, and Soldier.

### Existing UX and behavior gaps

- Builder class dropdown is still hard-capped by `BUILDER_CERTIFIED_LEVELS` to levels 1–5 despite later engine certification through level 20.
- Review blocks Finish for missing required steps and spell repertoire. This conflicts with requested permissive completion.
- Spells use native `multiple size="8"` selects and require Ctrl/Command/Shift.
- Rule selections render radio/checkbox card grids; high-choice sections become dense.
- Creation dialog is `max-w-2xl`; Detailed Build uses only progress + content columns and has no live sheet preview.
- Details, source links, Compendium links, external search, removable chips, and a shared searchable add-control are not yet unified.

### Task 1 result

- Requirements, acceptance IDs, source priority, licensing boundary, portable tool contract, level-20 data checklist, and small implementation stops are now recorded.
- No remote content, D1 data, or deployment was changed.

## Task Queue

| # | Status | Task | Stop condition |
|---:|---|---|---|
| 1 | Done | Audit builder/Compendium; define completion, UX, rules corpus, source policy, tool contract, and acceptance IDs. | This document exists; audit values are reproducible; `git diff --check` passes. |
| 2 | Done | Allow Finish with incomplete sections and exact impact confirmation. `FIN-001`–`FIN-005` | Model/UI/API tests prove confirm, cancel, resume, collision, and no silent calculations. |
| 3 | Done | Enlarge Detailed Build dialog and add responsive three-region shell. `UX-001`, `UX-002`, `UX-008` | Desktop/mobile browser tests pass; Quick Setup size remains unchanged. |
| 4 | Done | Build live character preview from current draft evaluation. `UX-002`, `UX-007` | Preview updates all available derived groups and exposes uncertainty. |
| 5 | Done | Build reusable searchable add/select/chip/details control. `UX-003`–`UX-006` | Keyboard, focus, removal, tooltip/detail, source, Compendium, and search tests pass. |
| 6 | Done | Replace spell multi-selects with shared control. | Cantrip/known/spellbook limits, add/remove, details, filters, and warnings pass. |
| 7 | Done | Replace dense class-feature, feat, proficiency, language, and mastery choice grids. | Every high-cardinality rule choice uses shared control; small binary choices remain compact. |
| 8 | Done | Apply shared control to equipment and remaining builder lists. | Quantity/container behavior and source/coverage detail pass. |
| 9 | Done | Lift builder level cap from 5 to 20 with incomplete-coverage warnings. `DAT-001`, `DAT-007` | Level 20 can finish for every class; unsupported effects are named, never guessed. |
| 10 | Done | Create machine-readable character-rule corpus manifest for both editions. | Every required domain above maps to source IDs, status, dependencies, and fixtures. |
| 11 | Done | Audit and certify class progression gaps for `5e`. | Levels 1–20 for all supported classes have reviewed feature/choice/resource coverage reports. |
| 12 | Done | Audit and certify class progression gaps for `5.5e`. | Same proof for 2024 rules, including masteries and Epic Boons. |
| 13 | Done | Audit all Compendium subclasses and edition/class links. | Every subclass is selectable as rules-ready, partial, or manual with correct gate/source. |
| 14 | Done | Audit species/races, backgrounds, languages, and origin grants. | Both editions produce complete origin warning/automation reports. |
| 15 | Done | Audit feats and class-specific choice catalogs. | Prerequisites, repeatability, gates, grants, and missing effects are explicit. |
| 16 | Done | Audit spell metadata and spell-list membership. | Level 0–9 lists, repertoire rules, granted spells, and source conflicts report cleanly. |
| 17 | Done | Audit equipment, attacks, armor, containers, currency, and item modifiers. | Starting packages and derived combat/weight behavior have edition fixtures. |
| 18 | Done | Scaffold standalone Wikidot retrieval CLI with cache/resume/rate/robots controls. `SRC-001`, `SRC-002`, `SRC-007` | Folder runs independently; offline fixtures pass. |
| 19 | Done | Implement `dnd5e.wikidot.com` discovery and parsers. `SRC-003`, `SRC-004` | Representative class, subclass, background, species, feat, spell, and item fixtures parse. |
| 20 | Done | Implement `dnd2024.wikidot.com` discovery and parsers. | Same categories parse with `5.5e`; UA/homebrew stay separately labeled. |
| 21 | Done | Add provenance, publication grouping, license state, conflict detection, and validation reports. | Far Traveler lands under Sword Coast Adventurer's Guide; unknown/conflicts fail strict mode. |
| 22 | Done | Implement Cassian Compendium exporter. `SRC-005` | Generated import fixture passes Cassian schema, IDs, metadata, and deterministic rebuild tests. |
| 23 | Done | Implement Aurora exporter. `SRC-006` | XML fixtures validate and keep source attribution/stable IDs. |
| 24 | Done | Add reviewed import preview/deduplication workflow to Cassian tooling. | No generated Compendium data changes before explicit preview acceptance. |
| 25 | Done | Run final corpus, accessibility, responsive, theme, role, migration, rollback, and compatibility audit. | Full tests/build/browser/diff pass; coverage report and remaining manual gaps are dated. |

## In Progress

None. Tasks 1–25 are complete.

## Verification Log

- 2026-09-21 — Task 1 inspected builder models/views, Compendium manifest, coverage sidecar, certification report, and current dialog shell.
- 2026-09-21 — Task 1 confirmed current Wikidot indexes and Far Traveler's stated `Sword Coast Adventurer's Guide` source; official SRD/free-rule references were recorded.
- 2026-09-21 — Task 2 permits incomplete Finish only after an explicit impact confirmation; cancel preserves the exact draft and restores focus.
- 2026-09-21 — Task 2 retains owner-bound incomplete drafts, safely updates only their provisional Character/NPC, preserves collision protection, and removes the draft after later completion.
- 2026-09-21 — Task 2 adds persistent V4 uncertainty warnings plus Character/NPC Resume Builder routes. Focused `@characters @campaigns` unit tests (65 suites), site build, focused Firefox browser smoke, direct NPC builder contract test, and `git diff --check` passed.
- 2026-09-21 — Task 3 keeps Quick Setup at `max-w-2xl`, expands Detailed Build to `max-w-[96rem]`, and adds responsive progress/content/preview regions to Character and NPC builders.
- 2026-09-21 — Task 3 focused `@characters @npcs` unit tests (66 suites), site build, desktop/mobile Firefox browser smoke, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 4 adds an evaluated live preview for identity, level, abilities, HP, AC, initiative, proficiency, saves, skills, actions/attacks, spells/slots, resources, proficiencies/languages, inventory, and uncertainty warnings. Character and NPC drafts update preview before persistence completes.
- 2026-09-21 — Task 4 focused `@characters @npcs` unit tests (68 suites), site build, desktop/mobile Firefox browser smoke, direct preview model/UI tests, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 5 adds a reusable searchable combobox/listbox with keyboard navigation, limits, unavailable reasons, removable chips, hover/focus summaries, details, Compendium links, Google search, source/ruleset/coverage/prerequisite/level metadata, and focus restoration. Home publication filters now use it.
- 2026-09-21 — Task 5 focused `@characters @npcs` unit tests (70 suites), site build, desktop/mobile Firefox browser smoke, direct selector model/UI tests, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 6 replaces cantrip and levelled-spell multi-selects with searchable add/remove chips, spell metadata/details/links, enforced cantrip and known-spell caps, spellbook minimum warnings, and preserved runtime preparation boundaries.
- 2026-09-21 — Task 6 focused `@characters @npcs` unit tests (70 suites), site build, Character Firefox browser smoke with Wizard add/remove/focus flow, direct spell model/UI tests, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 7 routes high-cardinality class-feature, feat, proficiency, language, mastery, and equivalent rule choices through the shared searchable selector; compact choices with four or fewer options retain radio/checkbox controls.
- 2026-09-21 — Task 7 preserves evaluator restrictions, choice limits, source/ruleset/coverage/prerequisite details, unavailable reasons, removal, autosave, and focus restoration. Focused `@characters @npcs` unit tests (70 suites), site build, full Character/NPC Firefox browser smoke, direct choice UI/model checks, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 8 replaces the equipment definition dropdown with the shared searchable picker and extends it to large class, background, species/race, and subclass catalogs. Selected inventory retains independent quantity and container controls.
- 2026-09-21 — Task 8 rejects missing, non-container, self, descendant, and cyclic container assignments; removing a container safely detaches direct contents. Source/ruleset/automation details remain available in picker results and detail dialogs.
- 2026-09-21 — Task 8 focused `@characters @npcs` unit tests (70 suites), site build, full Character/NPC Firefox browser smoke, direct equipment/choice model and UI checks, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 9 exposes levels 1–20 in the builder and preserves the 1–20 schema boundary. All 44 currently selectable Compendium classes (32 `5e`, 12 `5.5e`) can reach and finalize level 20 after required warning confirmation.
- 2026-09-21 — Task 9 promotes partial/manual automation notices into incomplete-finish confirmation and names known gaps such as missing automation data, unresolved Compendium dependencies, unsupported rule expressions, and unreviewed rule effects. No missing effect is applied automatically.
- 2026-09-21 — Task 9 focused `@characters @npcs` unit tests (70 suites), site build, full Character/NPC Firefox browser smoke including a persisted level-20 selection, direct evaluator/builder/review tests, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 10 adds generated `character-rule-corpus.json`: 11 required Character domains, explicit `5e`/`5.5e` status, stable source IDs, domain dependencies, fixture paths, and certified Compendium entry IDs. Coverage reports two rules-ready, eight partial, and one manual domain per edition with zero broken pointers.
- 2026-09-21 — Task 10 integrates deterministic corpus generation into both Compendium build paths, retains certification/corpus artifacts during full rebuild cleanup, exposes the corpus filename through `manifest.json`, and validates source, dependency, fixture, edition, status, and catalog-version integrity.
- 2026-09-21 — Task 10 focused `@compendium @characters` unit tests (73 suites), direct generator/artifact tests, Compendium metadata rebuild, site build with copied corpus artifact, syntax checks, and `git diff --check` passed.
- 2026-09-21 — Task 11 adds generated `class-progression-5e-report.json` for all 32 selectable `5e` classes. Each class has exactly 20 level records plus feature, grant, choice, resource, action, dependency, provenance, certification, fixture, and explicit gap coverage.
- 2026-09-21 — Task 11 confirms 12 core classes as rules-ready with reviewed level 1–20 fixtures. The remaining 20 classes stay partial; missing certification, golden fixtures, unsupported expressions, manual branches, and all 48 unresolved dependency IDs are named instead of inferred or automated.
- 2026-09-21 — Task 11 focused `@compendium @characters` unit tests (74 suites), direct report/corpus/artifact tests, Compendium metadata rebuild, site build with copied report, syntax checks, and `git diff --check` passed.
- 2026-09-22 — Task 12 adds generated `class-progression-5-5e-report.json` for all 12 selectable `5.5e` core classes. Each class has exactly 20 level records and the same provenance, certification, feature, grant, choice, resource, action, dependency, fixture, and explicit-gap fields as the `5e` report.
- 2026-09-22 — Task 12 confirms all 12 classes rules-ready and level 1–20 certified with zero unresolved dependencies. Weapon Mastery choices are explicitly reported for Barbarian, Fighter, Paladin, Ranger, and Rogue; every class records its level-19 Epic Boon choice. Seven classes retain reviewed manual-branch warnings without guessed effects.
- 2026-09-22 — Task 12 focused `@compendium @characters` unit tests (74 suites), direct dual-edition report/corpus/artifact tests, Compendium metadata rebuild, site build with copied report, syntax checks, and `git diff --check` passed.
- 2026-09-22 — Task 13 adds `subclass-coverage-report.json` for all 543 Compendium subclasses: 543 selectable, 24 rules-ready, 519 partial, 495 `5e`, 48 `5.5e`, and zero unresolved parent classes. Every record carries ruleset, source, publisher, automation status, dependencies, explicit gaps, parent class IDs, and a level gate derived from declared Compendium support evidence.
- 2026-09-22 — Task 13 exposes generated parent IDs and subclass levels through runtime rules metadata, so previously hidden partial/manual subclasses and custom-class gates work in the builder without guessed effects. Focused `@compendium @characters` unit tests (75 suites), metadata/site builds, copied-artifact check, syntax checks, and `git diff --check` passed.
- 2026-09-22 — Task 14 adds `origin-coverage-report.json` for all 608 Compendium origin records: 340 races/species, 176 backgrounds, and 92 languages. It records both-edition compatibility, provenance, grant/selection/stat declarations, dependencies, automation status, and entry-level warning codes; coverage is 6 rules-ready, 506 partial, and 96 manual.
- 2026-09-22 — Task 14 focused `@compendium @characters` unit tests (76 suites), direct origin/corpus/artifact tests, metadata/site builds, copied-artifact check, syntax checks, and `git diff --check` passed.
- 2026-09-22 — Task 15 adds `feat-choice-coverage-report.json` for all 432 feats and 1,443 class/subclass choice declarations from 504 sources. Every feat records prerequisite text/expression, minimum level, repeatability evidence, grants, selections, stats, provenance, dependencies, automation, and missing effects; every choice records level/count gates, requirements, supported/inline options, and gaps.
- 2026-09-22 — Task 15 explicitly reports 35 unresolved choice option IDs and 628 inline options without declared effects instead of guessing them. Focused `@compendium @characters` unit tests (77 suites), direct feat-choice/corpus/artifact tests, metadata/site builds, copied-artifact check, syntax checks, and `git diff --check` passed.
- 2026-09-22 — Task 16 adds `spell-coverage-report.json` for all 2,046 Compendium spells across levels 0–9: 1,655 `5e`, 391 `5.5e`, 16 certified repertoire declarations, 2,349 granted-spell declarations, 33 unresolved grants, and 241 spells without a proven class-list membership.
- 2026-09-22 — Task 16 preserves 77 duplicate/source groups and flags 36 as level, school, or class-list conflicts rather than merging them silently. Focused `@compendium @characters` unit tests (78 suites), direct spell/corpus/artifact tests, metadata/site builds, copied-artifact check, syntax checks, and `git diff --check` passed.
- 2026-09-22 — Task 17 adds `equipment-coverage-report.json` for 3,139 items: 137 weapon profiles, 27 armor profiles, 22 containers, 148 charged items, and 603 modifier-bearing items. All remain partial/manual; zero are silently promoted. Both editions retain engine/browser fixtures and explicit missing-starting-package warnings; 1,025 unresolved dependencies remain named.
- 2026-09-22 — Task 17 focused `@compendium @characters` unit tests (79 suites), direct equipment/corpus/artifact tests, metadata/site builds, copied-artifact check, syntax checks, and `git diff --check` passed.
- 2026-09-22 — Task 18 adds portable `tools/wikidot-compendium-importer/` with Node 20 CLI, robots enforcement, per-host rate limiting, bounded retry, SHA-256 cache/resume, atomic raw snapshots, dry-run, provenance metadata, raw validation, and no Cassian runtime dependency.
- 2026-09-22 — Task 18 offline tests pass in place and after copying the folder to an independent temporary directory. No website was crawled and no retrieved content was imported.
- 2026-09-22 — Task 19 adds `dnd5e.wikidot.com` detail/index discovery plus dependency-free parsing for class, subclass, background, species/lineage, feat, spell, and item pages. Records preserve headings, paragraphs, tables, links, prerequisites, type-specific fields, stated publication, source URL, retrieval/hash metadata, manual coverage, and unknown-license status.
- 2026-09-22 — Task 19 live shape-checks covered the front page, Far Traveler, Fireball, Bag of Holding, Wizard, Evocation, Human, and Alert without bulk crawling or importing. Current front-page discovery found 597 direct supported details and 29 linked spell/item indexes. Seven offline parser/discovery cases and deterministic publication-folder tests pass both in place and from an independently copied folder; syntax and `git diff --check` pass.
- 2026-09-22 — Task 20 adds `dnd2024.wikidot.com` front-page/category discovery and dependency-free parsing for class, subclass, background, species, feat, spell, and magic-item pages. Records use `5.5e` and explicitly separate official, Unearthed Arcana, and homebrew content families.
- 2026-09-22 — Task 20 live shape-checks covered the 2024 front page, category indexes, Wizard, Evoker, Acolyte, Human, Alert, Fireball, Bag of Holding, and UA Ego Whip without bulk crawling/importing. Offline tests, copied-folder portability tests, syntax checks, and `git diff --check` pass.
- 2026-09-22 — Task 21 adds explicit reviewed license states, publication-path validation, deterministic coverage/validation/conflict reports, and strict failures for unknown publications, unknown license state, and colliding record identities. Far Traveler remains grouped under `sword-coast-adventurer-s-guide`.
- 2026-09-22 — Task 21 standalone tests (13 cases), copied-folder portability tests, syntax checks, and `git diff --check` pass.
- 2026-09-22 — Task 22 adds a strict Cassian export package with deterministic manifest, index, category documents, stable source-derived IDs, builder add payloads, and retained ruleset/source/hash/parser/license/classification/manual-automation metadata. Export remains isolated under the tool output folder.
- 2026-09-22 — Task 22 standalone tests (16 cases), copied-folder portability tests, syntax checks, schema validation, deterministic rebuild proof, and `git diff --check` pass.
- 2026-09-22 — Task 23 adds strict Aurora `<elements>` XML export grouped by ruleset and stated publication, stable IDs, recognized spell setters, XML escaping/structural validation, and custom provenance/license/classification/automation setters. No executable rules are inferred.
- 2026-09-22 — Task 23 standalone tests (19 cases), copied-folder portability tests, syntax checks, deterministic rebuild proof, and `git diff --check` pass.
- 2026-09-22 — Task 24 adds deterministic Cassian import preview with stable-ID/original-ID/semantic deduplication, explicit add/update/duplicate/conflict decisions, a review hash, stale-review rejection, conflict blocking, and accepted staging to a separate folder only.
- 2026-09-22 — Task 24 standalone and copied-folder tests, source-catalog immutability proof, syntax checks, and `git diff --check` pass.
- 2026-09-22 — Task 25 full `npm test` passed all 128 suites, including all-core level-20/multiclass certification, draft/API/migration/rollback compatibility, roles, Compendium artifacts, V1–V4, NPCs, and static-route boundaries. `npm run build:site` produced `.cloudflare/public`; the existing Browserslist age notice remained non-fatal.
- 2026-09-22 — Task 25 full Firefox browser smoke passed every route and interaction plus the all-route desktop/mobile, Standard/Reversed theme alignment audit. The audit exposed test-state leakage and an early V3 readiness predicate; campaign settings/layout are now seeded explicitly and readiness waits for async spell rendering. Focused `@character-layout` and the final full rerun pass.
- 2026-09-22 — Task 25 standalone tool tests pass in place and from an independently copied folder. Final syntax checks and whole-tree `git diff --check` pass; no tool cache/output, Playwright artifact, remote mutation, or imported Wikidot content was added.

## Final Coverage Snapshot — 2026-09-22

- Catalog remains 15,191 entries: 54 `rules-ready`, 6,054 `partial`, and 9,083 `manual`; stable catalog version is `sha256-27e0181ca9b2ff4af6ac`.
- Character corpus has 11 domains per ruleset with zero unresolved corpus pointers. Each edition currently has 2 rules-ready, 8 partial, and 1 manual domain.
- All twelve core classes are certified levels 1–20 in both editions. The broader catalog still contains 20 partial legacy/non-core class records and 48 unresolved class dependencies.
- All 543 subclasses are selectable; 24 are rules-ready and 519 partial. Parent links are resolved; 60 dependencies remain unresolved.
- Origins: 6 rules-ready, 506 partial, 96 manual across 608 race/background/language entries; 678 dependencies remain unresolved.
- Feats: 432 total, 394 partial and 38 manual; 1,407 choice records still have gaps, including 35 unresolved options and 628 manual inline options.
- Spells: 2,046 total, 48 partial and 1,998 manual; 33 granted-spell references, 241 missing class lists, and 36 rules conflicts remain review work.
- Equipment: 3,139 total, 606 partial and 2,533 manual; starting packages remain absent and 1,025 dependencies remain unresolved.
- These remaining gaps stay selectable/readable but warn and never gain guessed automation. They are future content-certification work, not hidden completion claims.

## Rollback

- Task 1 rollback deletes this Markdown file only.
- Task 2 rollback removes incomplete finalization confirmation/materialization, provisional owner markers, retained-draft updates, V4 warning banner, Resume Builder routing, and their focused tests; no D1 schema rollback is required.
- Task 3 rollback removes detailed-layout width toggling and preview-aside markup/tests from Character and NPC builder shells; Quick Setup markup remains unchanged.
- Task 4 rollback removes `preview-model.js`, `preview.js`, builder preview rendering hooks, and focused preview tests; Task 3's static preview region remains available.
- Task 5 rollback restores Home's publication multi-select, removes `searchable-selection.js` and focused selector tests, and leaves saved `enabledSources` arrays unchanged.
- Task 6 rollback restores spell multi-select rendering and removes known-spell minimum/cap validation plus searchable Wizard browser coverage; saved spell IDs/assignments remain compatible.
- Task 7 rollback removes the high-cardinality choice threshold and searchable-choice mounting from `choice-step.js`, restores card rendering for all evaluator choices, and removes focused browser assertions; saved selection IDs remain compatible.
- Task 8 rollback restores the equipment definition dropdown/add button and native root/subclass selectors, removes builder-time container assignment helpers/controls, and removes their focused tests; existing inventory instances, quantities, and `containerId` values remain schema-compatible.
- Task 9 rollback restores the five-level builder list and previous non-blocking automation notice placement, then removes level-20 builder/browser fixtures. Existing schema-v2 characters remain valid because normalization already supports levels through 20.
- Task 10 rollback removes `character-rule-corpus.cjs`, its generated JSON/test/manifest pointer, and build retention wiring; existing Compendium metadata, coverage, certification reports, and runtime consumers remain unchanged.
- Task 11 rollback removes the progression report generator, `class-progression-5e-report.json`, its corpus source/manifest pointers, build retention wiring, and focused tests; no Compendium entry or certification overlay is changed.
- Task 12 rollback removes `class-progression-5-5e-report.json`, its corpus source/manifest pointers, build retention wiring, and 2024 mastery/Epic Boon assertions; the shared `5e` report generator and all certification overlays remain unchanged.
- Task 13 rollback removes the subclass coverage generator/report/test/manifest and corpus pointers, generated parent/gate metadata, and builder fallback consumption; raw Compendium entries and certified subclass behavior remain unchanged.
- Task 14 rollback removes the origin coverage generator/report/test/manifest and corpus pointers; no origin entry or runtime calculation is changed.
- Task 15 rollback removes the feat/choice coverage generator/report/test/manifest and corpus pointers; no feat or saved builder selection is changed.
- Task 16 rollback removes the spell coverage generator/report/test/manifest and corpus pointers; no spell entry, repertoire, or saved spell selection is changed.
- Task 17 rollback removes the equipment coverage generator/report/test/manifest and corpus pointers; no Compendium item or inventory runtime state is changed.
- Task 18 rollback deletes `tools/wikidot-compendium-importer/`; it has no runtime, D1, build, or deployment coupling.
- Task 19 rollback removes `discover.js`, `parse.js`, `normalize.js`, `source-name.js`, their CLI wiring, 5e fixtures/tests, and related README text; Task 18 retrieval/cache safety remains usable for explicit URLs.
- Task 20 rollback removes 2024 discovery/parser paths and fixtures while retaining the 5e parser. No retrieved output was added to the repository.
- Task 21 rollback removes strict normalized validation, license enums, and generated report writing; raw retrieval remains intact.
- Task 22 rollback removes `export-cassian.js`, its CLI route/tests/docs, and any user-generated `output/exports/cassians-log` folder; live Compendium data is untouched.
- Task 23 rollback removes `export-aurora.js`, its CLI route/tests/docs, and any user-generated Aurora export folder.
- Task 24 rollback removes `review-cassian.js`, preview/stage CLI routes/tests/docs, and any user-generated review/staging folder. Source catalogs were never mutated.
- Task 25 rollback removes only the V3 browser-test state/readiness hardening and final audit records; product behavior and stored data are unchanged.
- Later UI/model changes remain additive until their task-specific rollback is recorded.
- Retrieval output must never be mixed with hand-maintained Compendium inputs before reviewed import approval.
- No remote operation has occurred.

## Non-Goals

- Copying D&D Beyond branding, assets, CSS, marketplace, or proprietary UI code.
- Claiming public web text is public domain or redistributable.
- Silently treating Wikidot, UA, partnered content, or homebrew as official core rules.
- Replacing existing Quick Setup, imports, V1–V3, manual mode, exports, or offline recovery.
- Automatic target damage, VTT features, marketplace entitlements, or real-time collaboration.

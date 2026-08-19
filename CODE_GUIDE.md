# Cassian's Log Engineering Guide

This document records the architecture, code conventions, compatibility rules, and preservation-first refactor plan for Cassian's Log. It describes the standards the project already follows and the direction future work should take.

The application is working. Refactoring must improve ownership, clarity, testability, or duplication without changing product behavior unless a separate feature request explicitly authorizes that change.

## 1. Core principles

### Preserve behavior before improving structure

“Preserve everything” is the default refactor boundary. Unless a task explicitly says otherwise, preserve:

- public URLs, clean character and Wiki routes, query parameters, hashes, and `<base>` behavior;
- rendered order, responsive layout, colors, spacing, visible labels, controls, keyboard behavior, focus handling, and accessibility attributes;
- character, tracker, Combat & Loot, Music, Wiki, settings, and Compendium data shapes;
- generated Compendium and Wiki data;
- all existing `localStorage` and `sessionStorage` keys and their stored value shapes;
- D1 tables, migration history, API routes, HTTP methods, status codes, authentication boundaries, and fallback behavior;
- save timing, cloud/local precedence, offline recovery, and refresh-versus-real-time behavior;
- optional integration hooks, especially the Character–Compendium boundary.

A refactor is complete only when the same proof passes before and after it.

### Prefer independent feature ownership

Each product area owns its page, data, runtime code, scripts, and tests:

```text
char/                 Character archive, sheets, editor, tracker, and data
combat-loot/          Initiative, combat, loot, and custom trackers
compendium/           Search, generated data, builder, and UI
music/                Library, tags, playback, settings, and persistence
public-initiative/    Minimal read-only initiative view
wiki/                 Pages, routing, Markdown, import, and editing
admin/                Unlinked runtime-configuration UI
integrations/         Optional cross-feature adapters
cloudflare/           Worker API, D1 schema, migrations, and seed generation
shared/               Feature-neutral browser code, configuration, styles, and build code
```

Feature code may import its own modules and neutral modules from `shared/`. A feature must not import another feature's private files. Cross-feature behavior belongs in `integrations/` and must depend only on deliberately public feature entry points such as `char/js/editor/extensions.js` and `compendium/js/api.js`.

Infrastructure may call a feature's pure, public model when server and browser behavior must be identical. That exception must remain dependency-free and explicit; it is not permission for feature-to-feature coupling.

### Keep the stack simple

- Use native browser ES modules and vanilla JavaScript.
- Use Tailwind through the existing shared build.
- Do not add a framework, runtime dependency, build layer, or state library merely to reorganize code.
- Add a dependency only when it provides a correctness or maintenance benefit that cannot be achieved clearly with the platform or existing tooling.
- Keep the app usable through the static/local fallback as well as the Cloudflare deployment.

### Optimize for understanding, not character count

Compact code removes repeated decisions and ceremony. It does not compress multiple responsibilities into dense expressions.

- Prefer early returns, small pure functions, named intermediate values, and data-driven maps.
- Keep a short repeated entry point readable; do not create an abstraction merely to replace three obvious initialization calls.
- Long Tailwind class strings may remain next to the markup they style. Extract them only when they represent a reused semantic component.
- Split files by ownership or change reason, not by an arbitrary line limit.
- A large parser, model, or deterministic generator can remain cohesive. A large page coordinator that mixes rendering, persistence, dialogs, and domain rules should be separated.

## 2. Standard module roles

Use these names consistently when a feature needs the corresponding role:

| File | Responsibility | Must avoid |
|---|---|---|
| `entry.js` | Mount shared chrome and start the feature | Domain rules and substantial rendering |
| `model.js` | Pure normalization, validation, calculation, and immutable transformations | DOM, storage, and network access |
| `repository.js` | Local persistence, cloud calls, fallback precedence, and serialization | Rendering and page event handling |
| `view.js` | Markup or DOM construction from already-prepared data | Persistence and domain mutation |
| `page.js` | Page state, event wiring, and orchestration | Becoming the permanent home for every concern |
| `controller.js` | A cohesive stateful workflow such as an editor, filters, dialogs, or synchronization | Unrelated page behavior |
| `api.js` | Small, intentional public surface for integrations | Re-exporting private implementation indiscriminately |
| `scripts/*.cjs` | Deterministic build/import tooling | Browser behavior and hand-edited generated output |

Not every feature needs every file. Introduce a role only when there is a real boundary to own.

### Module rules

- Use explicit relative imports with file extensions.
- Prefer named exports. Default exports are reserved for platform-required shapes such as the Worker handler.
- Put side effects in entry points or clearly named initialization functions.
- Keep module-level state immutable or intentionally cache-like. Request, page, or character state belongs inside a controller or initialization scope.
- Pass dependencies into pure or stateful modules where it improves tests; do not create global service registries.
- Preserve public exports while extracting internals. Remove or rename an export only after all consumers and integration contracts are proven migrated.
- Browser-neutral model code should accept values as arguments rather than reading `window`, `document`, `location`, or storage.

## 3. JavaScript style

- Use `const` by default and `let` only for values that are reassigned.
- Use semicolons and trailing commas in multiline literals and calls.
- Use two-space indentation.
- Prefer descriptive nouns for data and verbs for actions: `settings`, `loadSettings`, `normalizeSettings`, `renderSettings`.
- Name normalization and validation separately. Normalization returns a safe canonical value; validation rejects invalid input.
- Use `async`/`await` for multi-step workflows. Every Promise must be awaited, returned, intentionally queued, or handled with an explicit `.catch()`.
- Catch errors only where the code can add recovery, fallback, user feedback, or meaningful context.
- Use `Error` subclasses or status-bearing errors at boundaries where callers need structured decisions.
- Avoid boolean parameters whose meaning is unclear at the call site. Prefer an options object.
- Keep constants near their owner. Compatibility constants such as storage keys, route patterns, schema versions, and supported styles should have one canonical definition per layer.
- Comments should explain a compatibility constraint, non-obvious decision, or failure mode—not restate the code.

### Cloning and mutation

Project data is JSON-compatible, but cloning semantics are part of behavior.

- Clone at persistence, editor-draft, integration, and public API boundaries when mutation must not leak.
- Use `cloneJSON()` from `shared/js/text.js` for persisted documents. It intentionally omits `undefined`, converts dates to ISO strings, and returns independent nested data.
- Do not silently swap JSON cloning and `structuredClone()` without tests proving identical behavior for the relevant documents.
- Prefer model functions that return a new document for complex domain changes.
- When controlled in-place mutation is simpler, keep it inside one controller and save through the owning repository.

## 4. DOM, HTML, and accessibility

- Prefer `textContent`, `replaceChildren()`, and DOM properties for user-controlled text and attributes.
- Template strings are acceptable for substantial static markup, but every interpolated value must use the correct shared escaping function or a validated safe token.
- HTML text escaping and identifier sanitization are different operations. Name them differently; do not use one helper as the other.
- Use `escapeHTML()` and `escapeAttribute()` from `shared/js/text.js`; feature modules should not define equivalent local copies.
- Never interpolate an error message directly into `innerHTML`. Create the shell and assign the message with `textContent`.
- Use `data-*` actions and scoped event delegation for repeated or dynamic controls.
- Use direct listeners for one-off stable controls when that is clearer.
- Keep all DOM queries inside page, view, or controller modules.
- Preserve focus trapping, Escape/backdrop behavior, focus restoration, validation focus, and dirty-draft confirmation in dialogs.
- Preserve semantic elements, labels, `aria-*` state, keyboard navigation, focus-visible styling, and reduced ambiguity in icon-only controls.
- Render externally sourced content safely. The Wiki Markdown renderer and Compendium rich-text builder remain explicit sanitization boundaries.
- Avoid creating parallel desktop and mobile behavior. Different layouts should operate on the same controls and state.

### Shared visual rules

- Mount the site header through `mountSiteHeader()`.
- Keep Characters in the Pages menu and keep the Character Tracker's Jump-to navigation separate.
- Respect Admin-controlled section visibility through `data-section-link` and the shared section configuration.
- Keep the Admin route unlinked from public navigation.
- Preserve explicit product ordering such as Music's Now Playing, fade settings, Library, then track form.
- Verify rendered size and responsive behavior; source inspection alone cannot prove visual correctness.

## 5. Routing and URL rules

- Root continues to redirect to `/char/`.
- Character cards and saves use canonical `/char/<id>/` routes.
- Wiki pages use canonical `/wiki/<id>` routes while retaining legacy hash compatibility.
- Feature pages keep their current `<base>` values so relative assets and `api/*` requests resolve correctly.
- Route IDs must remain URL-safe and collision-safe.
- Do not restore legacy `template/?character=` links.
- The Worker and localhost service worker must preserve clean-route fallback to the shared Character template shell.
- Use `isLocalRuntimeHost()` from `shared/js/runtime-host.js` for localhost checks. Detection code must not import the settings module merely to identify the host.
- Direct access to a route must remain possible even when navigation visibility hides its link.

## 6. Data and persistence contracts

### Authority and recovery

D1 is authoritative for shared state when it is available. Browser storage is the immediate local recovery path and the static deployment's persistence layer. “Updated instantly” means the relevant save request is made immediately; it does not mean open tabs receive real-time synchronization.

On page entry or refresh:

1. load the authoritative D1 record when the feature has one;
2. update the local cache from D1;
3. use browser or bundled data when D1 is absent or unavailable;
4. never discard a locally created character merely because its first cloud write failed.

The current save contracts must remain explicit:

| Area | Local behavior | Cloud behavior |
|---|---|---|
| Character creation/document | Save locally before navigation | Attempt D1 immediately; retain local recovery on failure |
| Character tracker state | Save local state synchronously | Start a best-effort D1 update and report failure to the console |
| Character notes | Save locally before re-render | Start a best-effort D1 update |
| Combat & Loot | Keep presets and a recoverable draft locally | Synchronize matching presets/draft to D1 |
| Music | Cache tracks and settings locally | Queue immediate D1 library writes; D1 wins on re-entry |
| Wiki | Save normalized pages locally | Await the D1 document update and surface failure |
| Runtime settings | Use browser settings on localhost | Use protected D1 settings in the deployed app |

Do not claim live-tab synchronization unless a real-time transport is deliberately added and tested.

### Compatibility rules

- Never rename or repurpose an existing storage key in a refactor.
- Character storage keys are owned by `char/js/storage-keys.js`; import its constants and key builders instead of repeating literals inside the Character feature.
- When a stored shape changes, add versioning and a tested, idempotent migration while retaining a rollback path.
- Preserve unknown character fields. The editor's Additional fields area is a compatibility boundary for homebrew and future data.
- Technical IDs and metadata remain stable and read-only in normal editing flows.
- Preserve collision-safe generated IDs and the legacy `dnd-new-character` recovery path.
- D1 migrations are append-only after use. Apply migrations before deploying code that requires them.
- Seeds may insert or update owned generated records according to their documented rules, but must not delete or overwrite unrelated user data.

## 7. Cloudflare Worker rules

- Use bindings (`env.DB`, `env.ASSETS`) rather than calling Cloudflare's REST API from the Worker.
- Keep secrets out of source, build output, and `wrangler.jsonc`.
- Keep ordinary write access (`WRITE_TOKEN`/`OPEN_WRITES`) separate from Admin access (`ADMIN_TOKEN`, falling back to `WRITE_TOKEN`). Public writes must never bypass Admin authentication.
- Validate route IDs, methods, payload shape, payload size, and trusted enumerations at the Worker boundary.
- Bind SQL values. Dynamic SQL identifiers are allowed only from closed, code-owned sets.
- Keep request-scoped state out of module globals.
- Await or return all request work. Use background execution only when losing the work after a response is acceptable and the execution context owns it.
- Large or unbounded bodies should stream. The current JSON body path is acceptable only while its tested byte cap remains enforced before processing.
- Return stable JSON error shapes without leaking stack traces, SQL, secrets, or internal data.
- Keep compatibility dates current through deliberate, tested updates. Do not add compatibility flags without a runtime need.
- Keep observability enabled and prefer structured, useful error context without logging request secrets or documents.
- If the Worker is split, retain one routing entry point and move one route family at a time into `cloudflare/routes/` plus neutral server helpers. Route behavior and tests must remain unchanged after every move.

Current platform reference: [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

## 8. Generated data and build rules

- Do not hand-edit files under `compendium/data/` or the generated D1 seed.
- Change the owning generator, regenerate output, and run the matching validation tests.
- Keep generators deterministic for the same inputs.
- A new public feature directory must be added to all of the following:

  - the static-site allowlist in `shared/build/site.cjs`;
  - Tailwind content globs;
  - architecture and route coverage;
  - the package test command;
  - navigation/settings configuration when applicable.

- Test built output, not only source routes. A source page that is absent from `.cloudflare/public` is still a deployment failure.
- Build scripts may clear only their explicit generated output directory. Never point recursive removal at a repository root or unresolved path.

## 9. Testing and verification

### Required refactor loop

1. Define the exact behavior boundary and affected owners.
2. Run `npm test` before editing and record any pre-existing warning or failure.
3. Add behavioral coverage before moving unprotected logic.
4. Move one ownership boundary.
5. Run the focused tests.
6. Run `npm test` again.
7. Run `npm run build:site` for public-file, build, routing, or Tailwind changes.
8. Perform HTTP smoke checks for affected routes.
9. Run `npm run test:browser` for interaction, focus, local fallback, storage, and refresh behavior when those are affected.
10. Inspect the diff for accidental generated-data, schema, route, key, or class changes.

Passing source-text tests alone is not enough to prove browser behavior. Keep source-contract tests for architecture and markup invariants, but prefer direct module tests for pure behavior. As modules are extracted, replace tests that strip imports or match implementation strings with dynamic imports and public behavior assertions where practical.

### Minimum proof by change type

| Change | Minimum proof |
|---|---|
| Pure model | Direct unit tests, malformed input, boundary values |
| Repository | Local success/failure, cloud success/failure, precedence, serialization |
| DOM/view | Structure contract plus browser interaction and accessibility smoke test |
| Route/API | Methods, auth, validation, status, response shape, D1 query behavior |
| Migration | Fresh database, upgraded database, rollback/recovery plan |
| Generator | Deterministic output, manifest/count integrity, stale-file handling |
| Shared helper | Existing consumers plus edge cases from every adopting feature |
| Refactor only | Same focused and full proof before and after |

## 10. Removing code safely

Code is unnecessary only when evidence shows it has no contract or consumer. Before deletion:

- search imports, dynamic imports, HTML scripts, Worker routes, event/data attributes, storage keys, tests, build allowlists, and generator references;
- check optional integrations and legacy/static paths;
- confirm it is not a fallback used only when D1, browser APIs, or network access fails;
- add or retain a regression test that proves the supported replacement path;
- delete one concern at a time and rerun the complete proof.

Do not remove code only because it appears old, duplicated, or unused by the primary deployed path. Compatibility and recovery code should be removed only through an explicit migration task.

## 11. Current audit snapshot

Audit date: 2026-08-19.

The repository currently has strong foundations:

- feature boundaries and neutral `shared/` ownership are enforced by architecture tests;
- page shells use native module entry points and the shared header;
- routes, colocated character data, generated Compendium data, settings, D1 APIs, and local fallbacks have automated coverage;
- model/repository separation is already good in Combat & Loot, Music, Wiki, Compendium, and several Character subsystems;
- `npm test` passes, including the Tailwind rebuild.

The main standardization opportunities are:

- several page coordinators mix too many responsibilities;
- some tests are coupled to source text or execute transformed source instead of importing public modules;
- the Worker contains several independent route families in one file;
- browser interaction coverage remains less complete than model, route, and source-contract coverage.

Implementation status as of 2026-08-19:

- Phase 0 is complete: compatibility contracts, direct pure-module tests, browser smoke automation, and explicit ESM package configuration are in place.
- Phase 1 is complete: shared escaping, JSON cloning, localhost detection, Character storage-key ownership, identifier naming, and text-safe Character loader errors are standardized.

No production code is safe to delete solely from this audit. Deletion should follow the proof in section 10.

## 12. Refactor plan

The phases are ordered by safety and leverage. Do not combine them into one large rewrite.

### Phase 0: strengthen the safety net

1. Add a repeatable browser smoke checklist or lightweight automation for the Character archive/editor/tracker, Combat & Loot, Music, Wiki, Compendium, Public Initiative, and Admin localhost mode.
2. Catalog the compatibility contracts in tests: URLs, `<base>` paths, storage keys, API shapes, save timing, extension entry points, and generated-data rules.
3. Convert pure-module tests from source transformation to direct imports, one suite at a time.
4. In a standalone configuration commit, evaluate adding `"type": "module"` to `package.json`. All Node build/import scripts already use `.cjs`, but the full test, build, Wrangler, and local-route proof must pass before keeping the change.

Stop condition: tests fail for a deliberate break of each protected boundary, and the current application still passes.

### Phase 1: low-risk consistency patches

1. Reuse `shared/js/text.js` HTML escaping in Admin and Music. Let Character tracker rendering re-export the shared text escape temporarily so its public imports do not change.
2. Rename the Character tracker's identifier sanitizer so it cannot be confused with HTML attribute escaping. Preserve its exact output and cover it with tests.
3. Centralize Character storage-key constants within the Character feature and replace repeated literals without changing the strings.
4. Extract a side-effect-free local-host predicate so settings and localhost route support share the same host rules without importing settings initialization.
5. Replace interpolated error messages in Character loaders with `textContent`-based rendering.
6. Standardize JSON cloning only after tests lock down omission of `undefined`, date handling, and nested document behavior. If semantics differ, retain clearly named local helpers.

Stop condition: exact duplication is reduced, names describe behavior, and no feature ownership boundary changes.

### Phase 2: split the highest-value browser coordinators

Move one region at a time while keeping each current initialization/export contract stable.

| Current file | First extraction targets | Preserve |
|---|---|---|
| `char/js/tracker/index.js` | filter controller; combat/resource/spell views; rest controller | `character`, `initializeTracker()`, `refreshUI()`, DOM IDs, data actions, save timing |
| `combat-loot/js/page.js` | cloud synchronization; preset dialogs; action dispatcher | model/repository/view APIs, draft timing, confirmations, dirty state |
| `char/js/editor/index.js` | field schema/rendering; collection controller; editor session | extension hooks, Additional fields, draft protection, focused-section opening |
| `wiki/js/page.js` | editor controller; route/view rendering; import/export; hover/image UI | clean and legacy URLs, ID normalization, Markdown behavior, D1/local ordering |
| `music/js/page.js` | tag-entry controller and library view if further growth occurs | queued writes, form reuse, section order, playback behavior |

Add direct tests for each extracted pure module before moving the next region. Do not redesign the UI during these moves.

Stop condition: each page entry reads as orchestration, extracted modules have one reason to change, and all behavior proof remains green.

### Phase 3: split Worker route ownership

1. Extract neutral response, body, ID, stored-JSON, and authentication helpers with Worker tests unchanged.
2. Move `characters`, `combat-loot`, `music`, `wiki`, and `admin/settings` route families one at a time.
3. Keep `handleRequest()` as the visible router and static-asset fallback owner.
4. Validate `wrangler.jsonc` against the installed schema and current Cloudflare documentation during the change.
5. Add focused tests per route module before considering further D1/schema cleanup.

Stop condition: routing remains obvious, route modules own their validation and D1 statements, and no request-scoped mutable global exists.

### Phase 4: reassess, then stop

After phases 0–3:

- rerun size, duplication, dependency, and test-coupling audits;
- remove only helpers or compatibility branches proven obsolete;
- leave cohesive parsers, generators, and models alone unless a concrete maintenance problem remains;
- update this guide when a new durable rule or compatibility contract is established.

Refactoring stops when ownership is clear and remaining duplication is cheaper and safer than another abstraction.

## 13. Change checklist

Before merging a change, confirm:

- [ ] The task states whether it is a feature, bug fix, migration, or behavior-preserving refactor.
- [ ] Public URLs, UI, data shapes, storage keys, APIs, and fallback behavior are unchanged unless explicitly authorized.
- [ ] The change belongs to one feature, `shared/`, `integrations/`, or infrastructure with a clear reason.
- [ ] Pure logic is outside DOM and persistence code where practical.
- [ ] User-controlled HTML and attributes use the correct safety boundary.
- [ ] Local and D1 authority, save timing, failure recovery, and refresh behavior are explicit.
- [ ] A new public directory is in the static build, Tailwind scan, navigation/settings, and tests.
- [ ] Schema work uses an additive migration and has an upgrade/recovery proof.
- [ ] Focused tests and `npm test` pass.
- [ ] Public/build changes pass `npm run build:site` and route smoke tests.
- [ ] Interaction or layout changes have browser verification.
- [ ] The diff contains no accidental generated output, secrets, unrelated cleanup, or compatibility drift.

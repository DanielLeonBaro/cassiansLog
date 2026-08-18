# Cassian's Log

Cassian's Log is a D&D 5e toolkit with editable character sheets, combat and loot trackers, a dice roller, a campaign Wiki, and a searchable Compendium.

The app leaves ability scores, armor class, spell save DCs, prepared-spell limits, and other character-building decisions under the player's control. The Cloudflare deployment stores shared characters, runtime state, notes, Combat & Loot presets and drafts, Wiki pages, and Compendium data in D1. Browser storage and bundled JSON remain available as offline and rollback fallbacks.

## Run locally

Requirements: Node.js 20 or newer, npm, and a local HTTP server.

```bash
npm install
npm run build:css
python -m http.server 8000
```

Open `http://localhost:8000`. The root redirects to the Character archive at `/char/`. Do not open pages through a `file://` URL because feature data is loaded with `fetch()`.

If PowerShell blocks `npm.ps1`, use `npm.cmd`.

## Commands

| Command | Purpose |
|---|---|
| `npm run build:css` | Build the shared Tailwind stylesheet |
| `npm run build:site` | Build the static assets used by Cloudflare Workers |
| `npm run build:compendium` | Convert Compendium XML sources into feature-local JSON |
| `npm run d1:seed` | Generate the ignored, deterministic D1 seed SQL |
| `npm run d1:migrate:local` | Apply schema migrations to local D1 |
| `npm run d1:seed:local` | Import Compendium and bundled characters into local D1 |
| `npm run d1:migrate:remote` | Apply pending migrations to production D1 |
| `npm run d1:seed:remote` | Refresh production Compendium and bundled characters |
| `npm run import:wiki` | Refresh the bundled Wiki JSON seed |
| `npm test` | Run feature, integration, architecture, route, and CSS tests |
| `npm audit` | Check dependencies for known vulnerabilities |

## Independent feature layout

```text
cassiansLog/
|-- char/                      # Character pages, data, runtime, and tests
|   |-- <character>/           # Route, character.json, and portrait
|   `-- js/
|-- combat-loot/               # Initiative, combat, loot, and custom trackers
|-- compendium/                # Page, generated data, runtime, builder, and tests
|-- wiki/                      # Page, seed data, runtime, importer, and tests
|-- integrations/
|   `-- character-compendium/ # Optional picker adapter
|-- cloudflare/                # Worker API, D1 migrations, seed builder, and tests
|-- shared/                    # Neutral UI, storage, dice, assets, styles, and config
`-- index.html                 # Redirect to /char/
```

Character, Combat & Loot, Compendium, and Wiki code may import neutral code from `shared/`, but they never import one another. Cross-feature behavior belongs in `integrations/`. The Character–Compendium picker is enabled by a separate module script on Character routes; removing that script removes the picker without affecting the Character editor.

Bundled character data and portraits live beside their routes under `char/<id>/`. The Wiki seed lives at `wiki/data/pages.json`. Generated Compendium files live in `compendium/data/`; edit the builder rather than generated JSON by hand.

## Navigation toggles

Edit `shared/config/sections.json` to choose which destinations and Character Tracker Jump-to controls appear. Only the literal JSON value `false` hides a control; omitted settings remain visible.

These settings hide navigation only. They do not remove or protect the corresponding pages.

## Updating data

Put Compendium XML sources in the ignored `compendium/source/` directory, then run:

```bash
npm run build:compendium
npm test
```

To refresh the Wiki seed from the configured published campaign source, run `npm run import:wiki` and then `npm test`.

## D1 data and deployment

Cloudflare Workers serves the static site and handles `/api/*`. D1 uses the `DB` binding and database `cassianslog-data`. Writes are temporarily public while `OPEN_WRITES` is `"true"` in `wrangler.jsonc`. Remove that variable or set it to `"false"` to restore `WRITE_TOKEN` protection; never put the token itself in Git, `wrangler.jsonc`, or a build variable. When protection is enabled, the browser keeps the entered token in `sessionStorage`, so closing the tab ends that editing session.

The Compendium, bundled characters, and Wiki are generated from the same checked-in JSON used by the static fallback. `npm run d1:seed` writes `.cloudflare/d1-seed.sql`; the file is ignored because it is generated and about 59 MiB. Applying the seed inserts or updates Compendium entries by ID, inserts missing bundled characters, inserts the character template as unavailable by default, and inserts the initial Wiki. It does not remove unrelated Compendium rows, overwrite edited or inactive character or Wiki records, or delete custom characters, runtime state, notes, presets, or drafts.

Existing `localStorage` keys remain stable. This preserves older browser data and lets the `localstorage-version` Git branch run locally or on GitHub Pages without D1. The D1-enabled `main` branch tries cloud reads first where shared data exists and falls back to local or static data when the API is unavailable.

The unlinked `/admin/` route manages D1-backed runtime configuration: public write protection, navigation and character-sheet section visibility, and character-list availability. It always requires `ADMIN_TOKEN`, falling back to `WRITE_TOKEN` when a separate admin secret is not configured; public-write mode never bypasses admin authentication. Apply D1 migration `0003_app_settings.sql` before deploying this route. To use a separate password, run `npx wrangler secret put ADMIN_TOKEN`.

Combat & Loot keeps its named presets under `dnd-combat-loot-presets-v1` and its recoverable draft under `dnd-combat-loot-draft-v1` as local fallbacks while synchronizing the same records to D1. Removed presets use `active: false`; records remain recoverable. Downloads still export the visible document without changing saved state.

Cloudflare Workers Builds deploys `main`. To publish the static fallback, open GitHub Actions, run **Deploy static content to Pages** manually, and select `localstorage-version`; automatic GitHub Pages runs still follow `main`. Before pushing generated-data changes, run the relevant generator, local D1 seed verification, and `npm test`.

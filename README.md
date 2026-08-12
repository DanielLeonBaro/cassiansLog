# Cassian's Log

Cassian's Log is a static D&D 5e toolkit with editable character sheets, combat and loot trackers, a dice roller, a campaign Wiki, and a searchable Compendium.

The app leaves ability scores, armor class, spell save DCs, prepared-spell limits, and other character-building decisions under the player's control. Browser-created characters and edits are stored locally in the current browser.

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
| `npm run build:compendium` | Convert Compendium XML sources into feature-local JSON |
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

## Saved data and deployment

Characters, notes, combat state, Combat & Loot presets, Wiki edits, and settings use browser storage. There is no account or server-side database. Existing storage keys remain stable across the feature-folder migration.

Combat & Loot lives at `/combat-loot/`. It keeps named presets under `dnd-combat-loot-presets-v1` and a recoverable working draft under `dnd-combat-loot-draft-v1`. These are `localStorage` records in the current browser profile, not files in the repository. Removed presets remain in the named collection with `active: false`; they are hidden from the picker rather than erased. Preset downloads include the same versioned tracker document, including current unsaved edits, and do not mark the working draft as saved. Uploading one of those JSON files opens it as an unsaved draft so it can be reviewed before saving locally.

Because GitHub Pages is a static host, the browser cannot write JSON into a Git-tracked `combat-loot/data/` directory. Sharing a preset currently means downloading the JSON and sending it to another user, who can upload it. Team-wide automatic saves require an authenticated storage service; a Git-tracked preset library would instead require adding downloaded files to the repository and committing and deploying them.

GitHub Actions deploys `main` to GitHub Pages. Before pushing generated-data changes, run the relevant generator followed by `npm test` and inspect `git status`.

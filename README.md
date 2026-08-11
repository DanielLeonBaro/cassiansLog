# Cassian's Log

Cassian's Log is a static D&D 5e character tracker. It has editable character sheets, combat tracking, a dice roller, a campaign wiki, and a searchable compendium.

The app does not build characters for you. Ability scores, armor class, spell save DCs, prepared-spell limits, and similar values stay under your control.

## What it does

Character sheets keep hit points, resources, spell slots, inventory, notes, and custom trackers in one place. You can edit bundled characters, make new ones from the blank template, and upload portraits. Changes are saved in the current browser.

The spell tracker supports more than one spellcasting profile. Spells and slots can belong to a profile, and prepared-spell limits are set by hand. Cantrips and always-prepared spells remain available.

The campaign wiki contains the bundled Breugaire lore. Local pages can be created, edited, linked with `[[Page Name]]`, exported, and imported.

The compendium contains 16,153 records built from 1,951 XML files:

| Category | Entries |
|---|---:|
| Classes | 44 |
| Subclasses | 552 |
| Races and lineages | 341 |
| Backgrounds | 177 |
| Feats | 601 |
| Spells | 2,052 |
| Items | 3,142 |
| Features and traits | 7,865 |
| Companions | 617 |
| Languages | 92 |
| Deities | 305 |
| Proficiencies | 242 |
| Rules and options | 123 |

Compendium records can be copied into a character and edited afterward. The copy does not automatically bring in related features, proficiencies, spells, or stat changes.

## Run it locally

Requirements:

- Node.js 20 or newer
- npm
- A local HTTP server

Install dependencies and build the CSS:

```bash
npm install
npm run build:css
```

Start a local server:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. Do not open `index.html` through a `file://` URL; layouts and data files are loaded with `fetch()`.

If PowerShell blocks `npm.ps1`, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd test
```

## Commands

| Command | Purpose |
|---|---|
| `npm run build:css` | Build and minify the Tailwind CSS |
| `npm run build:compendium` | Convert the XML library to compendium JSON |
| `npm run import:wiki` | Refresh the bundled wiki seed |
| `npm test` | Run tests and rebuild the CSS |
| `npm audit` | Check dependencies for known vulnerabilities |

## Updating the compendium

Put the XML library in `stuffToParse/`, then run:

```bash
npm run build:compendium
npm test
```

The generated files are written to `data/compendium/`. The XML input folder is ignored by Git, so commit the generated JSON when it changes.

## Project layout

```text
cassiansLog/
├── char/                     # Character routes and tracker layout
├── compendium/               # Compendium page
├── data/
│   ├── characters/           # Bundled character data
│   ├── compendium/           # Generated compendium JSON
│   └── portraits/            # Character portraits
├── js/
│   ├── entries/              # Browser entrypoints
│   ├── features/             # Character, tracker, dice, compendium, and wiki code
│   └── shared/               # Navigation, theme, storage, and text helpers
├── scripts/                  # Data import and build scripts
├── src/                      # Tailwind source CSS
├── dist/                     # Built CSS
├── tests/                    # Tests
└── index.html                # Character list
```

HTML files contain page markup and load one entrypoint from `js/entries/`. Feature code may import shared code, but shared code does not import features.

The navbar is in `js/shared/site-header.js`. Compendium loading is in `js/features/compendium/repository.js`, which is used by both the compendium page and character editor. Files in `data/compendium/` are generated; edit the builder instead of editing those files by hand.

## Saved data

Characters, notes, combat state, wiki edits, and settings are stored in browser storage. There is no account or server-side database. Clearing browser storage removes local changes.

## Deployment

GitHub Actions deploys `main` to GitHub Pages. Before pushing a compendium update, run:

```bash
npm install
npm run build:compendium
npm test
git status
```

## Common problems

If the character list or compendium does not load, make sure the site is running through HTTP rather than `file://`.

If compendium data is missing, check that `stuffToParse/` contains the XML files and run `npm run build:compendium`.

Character edits only exist in the browser where they were made. They may disappear after clearing storage, using private browsing, or switching browser profiles.

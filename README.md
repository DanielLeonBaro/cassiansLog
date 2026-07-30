<div align="center">

# 🧛 Cassian's Log

### A blood-red D&D 5e character tracker and searchable compendium

🩸 Build and edit manual character sheets  
🦇 Search thousands of races, classes, spells, items, and features  
🌙 Track combat resources, spell slots, inventory, and notes

![Static Site](https://img.shields.io/badge/site-static-18181b?style=for-the-badge&logo=githubpages&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-b83b35?style=for-the-badge&logo=javascript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-922c28?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Compendium](https://img.shields.io/badge/compendium-16%2C153_entries-d6aa5b?style=for-the-badge)

</div>

---

## 🕯️ What is Cassian's Log?

Cassian's Log is a browser-based D&D 5e character tracker designed for players who want a quick, attractive sheet without surrendering control to an automatic character builder.

All character values remain manually editable. The compendium saves time by letting players search existing material and copy summarized records directly into their sheets.

The application is a static site:

- No backend or database is required.
- No account is required.
- Character changes are saved in the current browser.
- It can be deployed directly to GitHub Pages.

> [!IMPORTANT]
> The compendium does **not** automatically calculate ability scores, armor class, spell save DCs, prepared-spell limits, class features, or other character-building rules. Players remain responsible for choosing and entering the correct values.

## 🩸 Features

### Character archive

- View all bundled and browser-created characters.
- Create a character from the complete template.
- Edit bundled or custom characters.
- Remove characters from the current browser.
- Upload custom character portraits.
- Use light and dark themes.

### Manual character editor

- Edit every field included in the character data.
- Add, modify, and remove:
  - Actions and attacks
  - Spells
  - Features and traits
  - Resources
  - Inventory
  - Trackers
  - Skills
  - Spellcasting profiles
  - Spell slots
- Add entries manually or choose them from the compendium.
- Continue editing every value copied from the compendium.

### Combat tracker

- Track current, temporary, and maximum hit points.
- Apply damage and healing.
- Track custom toggles such as concentration or class states.
- Track limited-use actions and resources.
- Recover applicable resources on short or long rests.
- Track spell slots by level and spellcasting profile.
- Filter combat options by name, source, category, action type, spell level, and purpose.

### Spell preparation

- Create multiple spellcasting profiles.
- Connect spells and spell slots to a profile.
- Mark spells as prepared or unprepared.
- Keep cantrips and always-prepared spells available.
- Enforce manually configured prepared-spell limits.

### All Possibilities

- Browse every action, spell, feature, and resource added to the character.
- Filter and search all available character options.
- Open a Google search from any card header.
- Searches use the format:

```text
Friends D&D 5e
```

### Inventory and notes

- Track item quantities and descriptions.
- Track copper, silver, electrum, gold, and platinum.
- Create, edit, and delete character notes.
- Store notes separately for each character.

## 🦇 Searchable compendium

The standalone compendium includes **16,153 deduplicated entries** generated from **1,951 XML files**.

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

The main compendium page supports:

- Full-library text search
- Category filters
- Publication filters
- Summary cards
- Full descriptions
- Requirements and supported-option information
- Item, spell, class, and race details
- Original XML rule metadata
- Related entries
- Stable compendium IDs
- Direct Google searches
- Shareable entry hashes
- Lazy loading of full category files

### Adding compendium entries to a character

Open a character and select **Edit sheet**, then:

1. Choose **Browse compendium** to search everything.
2. Use a field-specific picker such as **Choose subclass from compendium**.
3. Use **Add from compendium** beside spells, features, or inventory.
4. Search and filter the available entries.
5. Select **Add to character**.
6. Edit the copied fields normally.
7. Save the character.

Entries are intentionally mapped without automatic character-building logic:

| Compendium content | Character-sheet destination |
|---|---|
| Class | Replaces the class name |
| Subclass | Replaces the subclass name |
| Race, subrace, or lineage | Replaces the race name |
| Background | Replaces the background name |
| Spell | Adds an editable summarized spell |
| Item, weapon, armor, or magic item | Adds an inventory entry |
| Feat or feature | Adds an editable feature |
| Language, deity, proficiency, companion, or rule reference | Adds an editable reference feature |

Selected entries are marked **Added** and are not inserted twice. Inventory quantities can be adjusted manually after an item is added.

## ⚰️ Compendium IDs

Generated IDs combine:

1. Publication abbreviation
2. Entry type
3. Entry name

Examples:

```text
dmgSubclassOathbreaker
phbSpellFriends
phbClassWizard
phbRaceElf
phbWeaponLongsword
phb24SpellFriends
```

If two entries would receive the same generated ID, the converter adds stable context from the original XML ID and, when necessary, a short hash.

## 🌙 Getting started

### Requirements

- [Node.js](https://nodejs.org/) 20 or newer recommended
- npm
- A local HTTP server for development
- Python is optional but convenient for serving the static files

### Install dependencies

```bash
npm install
```

### Build the CSS

```bash
npm run build:css
```

### Start a local server

Using Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Another static server can be used instead:

```bash
npx serve .
```

> [!NOTE]
> Opening `index.html` directly through a `file://` URL is not recommended. The application uses `fetch()` for character layouts and compendium JSON, which browsers normally expect to load over HTTP.

## 🧪 Commands

| Command | Purpose |
|---|---|
| `npm install` | Install project dependencies |
| `npm run build:css` | Compile and minify Tailwind CSS |
| `npm run build:compendium` | Parse `stuffToParse/` and regenerate all compendium JSON |
| `npm test` | Run spellcasting tests, compendium tests, and the CSS build |
| `npm audit` | Check npm dependencies for known vulnerabilities |
| `python -m http.server 8000` | Serve the project locally with Python |
| `npx serve .` | Serve the project with the npm `serve` package |

On Windows PowerShell, use `npm.cmd` if the local execution policy blocks `npm.ps1`:

```powershell
npm.cmd install
npm.cmd run build:compendium
npm.cmd test
```

## 📜 Updating the compendium

The original XML library belongs in:

```text
stuffToParse/
```

That directory is intentionally ignored by Git. The static application serves only the generated JSON.

To rebuild:

```bash
npm run build:compendium
npm test
```

The converter:

1. Recursively discovers every `.xml` file.
2. Parses descriptions, sheet summaries, setters, requirements, references, and rules.
3. Determines publication names and abbreviations.
4. Removes mirrored records using original XML IDs.
5. Excludes internal-only source and grant records.
6. Generates stable publication-aware IDs.
7. Sanitizes supported rich-description markup.
8. Creates compact editor summaries.
9. Creates manual character-sheet payloads.
10. Writes the search index, manifest, and category JSON files.

Generated files are written to:

```text
data/compendium/
```

Important outputs:

| File | Purpose |
|---|---|
| `manifest.json` | Counts, categories, publications, and generation metadata |
| `index.json` | Lightweight global search index and editor add payloads |
| `classes.json` | Full class records |
| `subclasses.json` | Full subclass records |
| `races.json` | Full race, subrace, lineage, and variant records |
| `backgrounds.json` | Full background records |
| `feats.json` | Full feat records |
| `spells.json` | Full spell records |
| `items.json` | Full item, armor, weapon, and magic-item records |
| `features.json` | Full class, subclass, race, background, and feat features |
| `companions.json` | Full companions, traits, actions, and reactions |
| `languages.json` | Full language records |
| `deities.json` | Full deity records |
| `proficiencies.json` | Full proficiency records |
| `rules.json` | Full conditions, alignments, options, and rule references |

> [!WARNING]
> Rebuilding the compendium changes generated files. Commit the updated JSON if those changes should be deployed.

## 🏰 Project structure

```text
cassiansLog/
├── .github/workflows/static.yml    # GitHub Pages deployment
├── bootstrap/                      # Local Bootstrap icons and assets
├── char/
│   ├── tracker.html                # Shared character-sheet layout
│   ├── template/                   # Route for browser-created characters
│   └── <character>/                # Bundled character routes
├── compendium/
│   └── index.html                  # Standalone compendium page
├── data/
│   ├── characters.json             # Bundled character cards
│   ├── characters/                 # Character data objects
│   ├── compendium/                 # Generated compendium JSON
│   └── portraits/                  # Bundled portraits
├── dist/
│   └── tailwind.css                # Generated production stylesheet
├── js/
│   ├── character-editor.js         # Manual editor and compendium picker
│   ├── character-page.js           # Character route loader
│   ├── compendium.js               # Compendium search and full-entry UI
│   ├── script.js                   # Character tracker behavior
│   └── ...
├── scripts/
│   └── build-compendium.cjs        # XML-to-JSON converter
├── src/
│   └── tailwind.css                # Tailwind source stylesheet
├── stuffToParse/                   # Local XML input; ignored by Git
├── tests/
│   ├── compendium.test.cjs         # Compendium output tests
│   └── spellcasting.test.cjs       # Tracker and Google-link tests
├── index.html                      # Character archive
├── package.json
└── tailwind.config.js
```

## 🧛 Character data

Bundled characters are declared as JavaScript objects in:

```text
data/characters/
```

The full blank structure is available in:

```text
data/characters/template.js
```

A character can contain:

- Identity and biography fields
- Hit points and armor class
- Ability scores, modifiers, saves, and skills
- Movement and senses
- Trackers
- Actions
- Spellcasting profiles
- Spell slots
- Spells
- Features
- Resources
- Currency
- Inventory

Browser-created and edited characters are stored in `localStorage`.

## 🔐 Browser storage

The application uses these browser-storage keys:

| Key | Purpose |
|---|---|
| `dnd-characters` | Browser-created characters and edits |
| `dnd-deleted-characters` | Bundled characters hidden in this browser |
| `dnd-new-character` | Temporary data during character creation |
| `dnd-theme` | Light or dark theme |
| `dnd-<character-id>-state` | Hit points, resources, trackers, slots, and prepared states |
| `dnd-<character-id>-notes` | Character notes |

Clearing browser storage removes local edits, custom characters, notes, and tracker state.

There is currently no cross-device synchronization or account recovery.

## 🧬 Adding a bundled character

To add a character directly to the repository:

1. Copy `data/characters/template.js` to `data/characters/<id>.js`.
2. Fill in the character data.
3. Add its card metadata to `data/characters.json`.
4. Copy `char/template/index.html` to `char/<id>/index.html`.
5. Change its `data-character` value to the new character ID.
6. Add the portrait to `data/portraits/` if needed.
7. Run the tests.

Browser-created characters do not require repository files.

## 🚀 Deployment

The repository includes a GitHub Pages workflow:

```text
.github/workflows/static.yml
```

Pushing to `main` deploys the static repository contents to GitHub Pages.

Before pushing compendium changes:

```bash
npm install
npm run build:compendium
npm test
git status
```

The deployment workflow does not have access to the ignored `stuffToParse/` folder. Generated files in `data/compendium/` must therefore be committed.

## 🧯 Troubleshooting

<details>
<summary><strong>The character list or compendium does not load</strong></summary>

Serve the project over HTTP instead of opening the HTML files directly:

```bash
python -m http.server 8000
```

Also confirm that `data/compendium/manifest.json` and `data/compendium/index.json` exist.

</details>

<details>
<summary><strong>The compendium says its data is unavailable</strong></summary>

Place the XML library in `stuffToParse/`, then run:

```bash
npm run build:compendium
```

</details>

<details>
<summary><strong>A recently added XML entry does not appear</strong></summary>

Rebuild the compendium and refresh the page:

```bash
npm run build:compendium
```

If the XML shares an original ID with another file, the converter selects one canonical record. Inspect `data/compendium/index.json` to confirm which entry was retained.

</details>

<details>
<summary><strong>Character changes disappeared</strong></summary>

Character edits are local to the browser and device where they were created. Check whether:

- Browser storage was cleared.
- Private browsing was used.
- A different browser or browser profile is open.
- The character ID was changed.

</details>

<details>
<summary><strong>PowerShell refuses to run npm</strong></summary>

Use the Windows command shim:

```powershell
npm.cmd install
npm.cmd test
```

</details>

## 🗝️ Design principles

- **Manual first:** the sheet never silently decides character-building choices.
- **Fast reference:** the compendium removes repetitive typing.
- **Transparent data:** copied entries remain ordinary editable character fields.
- **Static and portable:** no backend is required.
- **Publication-aware:** compendium IDs preserve their source context.
- **Safe rendering:** XML description markup is converted through a controlled HTML whitelist.
- **Tested output:** expected IDs, mappings, full records, Google links, and spellcasting behavior are checked automatically.

---

<div align="center">

### 🩸 Keep the sheet close. Keep the compendium closer. 🩸

🦇 Built for adventurers who prefer their notes organized, their themes dark, and their choices entirely their own. 🦇

</div>

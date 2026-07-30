<div align="center">

# 🧛 Cassian's Log

### A blood-red D&D 5e character tracker and searchable compendium

🩸 Create and edit manual character sheets<br>
🦇 Search thousands of races, classes, spells, items, and features<br>
🌙 Track combat resources, spell slots, inventory, and notes

![Static Site](https://img.shields.io/badge/site-static-18181b?style=for-the-badge&logo=githubpages&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-b83b35?style=for-the-badge&logo=javascript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-922c28?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Compendium](https://img.shields.io/badge/compendium-16%2C153_entries-d6aa5b?style=for-the-badge)

</div>

---

## 🕯️ About

Cassian's Log is a browser-based D&D 5e character tracker for players who want an attractive, practical sheet while keeping full control over their character.

The application includes a searchable compendium that can copy summarized spells, items, features, classes, races, and other records directly into a character sheet.

Everything remains manually editable. The application does not automatically calculate ability scores, armor class, spell save DCs, prepared-spell limits, or character-building choices.

## 🩸 Features

### Character sheets

- Create characters from a complete template.
- Edit bundled or browser-created characters.
- Upload custom portraits.
- Use light and dark themes.
- Edit every field manually.
- Add or remove actions, spells, features, resources, inventory, skills, trackers, and spell slots.
- Save changes in the current browser.

### Combat tracking

- Track current, temporary, and maximum hit points.
- Apply damage and healing.
- Track limited-use actions and resources.
- Track concentration and other custom states.
- Recover resources during short and long rests.
- Track spell slots by spellcasting profile.

### Spells

- Create multiple spellcasting profiles.
- Connect spells and spell slots to a profile.
- Mark spells as prepared or unprepared.
- Set prepared-spell limits manually.
- Keep cantrips and always-prepared spells available.

### All Possibilities

- Browse every action, spell, feature, and resource on the character.
- Search and filter by name, category, action type, source, and spell level.
- Open a Google search from any card.

Google searches use the entry name followed by `D&D 5e`, for example:

```text
Friends D&D 5e
```

### Inventory and notes

- Track item quantities and descriptions.
- Track copper, silver, electrum, gold, and platinum.
- Create, edit, and delete character notes.

## 🦇 Compendium

The compendium currently contains **16,153 entries** generated from **1,951 XML files**.

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

You can search the compendium by:

- Name
- Category
- Publication
- Description
- Supported class or option

Open an entry to see its full description, requirements, details, related entries, and source publication.

### Adding entries to a character

1. Open a character.
2. Select **Edit sheet**.
3. Choose **Browse compendium**, or use one of the compendium buttons beside a field.
4. Search for the entry.
5. Select **Add to character**.
6. Edit the copied information if needed.
7. Save the character.

Compendium entries are added as follows:

| Entry | What is added |
|---|---|
| Class | Class name |
| Subclass | Subclass name |
| Race or lineage | Race name |
| Background | Background name |
| Spell | Editable summarized spell |
| Item, weapon, armor, or magic item | Inventory entry |
| Feat or feature | Editable feature |
| Other references | Editable reference feature |

The compendium does not automatically add related features, spells, proficiencies, or stat changes.

## 🌙 Getting started

### Requirements

- Node.js 20 or newer recommended
- npm
- A local HTTP server

### Install dependencies

```bash
npm install
```

### Build the CSS

```bash
npm run build:css
```

### Start the site locally

Using Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

You can also use another static server:

```bash
npx serve .
```

> [!NOTE]
> Do not open `index.html` directly through a `file://` URL. The application loads layouts and compendium data using `fetch()`, so it should be served over HTTP.

## 🧪 Commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run build:css` | Compile and minify Tailwind CSS |
| `npm run build:compendium` | Convert the XML library into compendium JSON |
| `npm test` | Run the tests and build the CSS |
| `npm audit` | Check dependencies for known vulnerabilities |
| `python -m http.server 8000` | Start a simple local server |
| `npx serve .` | Start an npm-based static server |

If PowerShell blocks `npm.ps1`, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run build:compendium
npm.cmd test
```

## 📜 Updating the compendium

Place the XML library inside:

```text
stuffToParse/
```

Then run:

```bash
npm run build:compendium
npm test
```

Generated compendium files are written to:

```text
data/compendium/
```

The XML input folder is ignored by Git. Commit the updated files in `data/compendium/` when the new compendium should be deployed.

## 🏰 Project structure

```text
cassiansLog/
├── char/                     # Character pages and shared tracker
├── compendium/               # Standalone compendium page
├── data/
│   ├── characters/           # Character data
│   ├── compendium/           # Generated compendium JSON
│   └── portraits/            # Character portraits
├── js/                       # Application behavior
├── scripts/                  # Compendium conversion script
├── src/                      # Tailwind source CSS
├── dist/                     # Built CSS
├── stuffToParse/             # Local XML input
├── tests/                    # Automated tests
├── index.html                # Character archive
└── package.json
```

## 🔐 Saving and privacy

- Characters, notes, combat state, and settings are stored in the browser.
- There is no account or backend database.
- Data does not automatically synchronize between devices or browsers.
- Clearing browser storage removes local characters and edits.

## 🚀 Deployment

The included GitHub Actions workflow deploys the static site to GitHub Pages whenever changes are pushed to `main`.

Before deploying:

```bash
npm install
npm run build:compendium
npm test
git status
```

Because `stuffToParse/` is ignored, the generated files in `data/compendium/` must be committed.

## 🧯 Troubleshooting

<details>
<summary><strong>The character list or compendium does not load</strong></summary>

Make sure the project is running through a local HTTP server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

</details>

<details>
<summary><strong>The compendium data is unavailable</strong></summary>

Confirm that `stuffToParse/` contains the XML files, then run:

```bash
npm run build:compendium
```

</details>

<details>
<summary><strong>A new XML entry does not appear</strong></summary>

Rebuild the compendium and refresh the browser:

```bash
npm run build:compendium
```

</details>

<details>
<summary><strong>My character changes disappeared</strong></summary>

Character changes are stored in the current browser. Check whether:

- Browser storage was cleared.
- Private browsing was used.
- A different browser or browser profile is open.

</details>

<details>
<summary><strong>PowerShell refuses to run npm</strong></summary>

Use the Windows command shim:

```powershell
npm.cmd install
npm.cmd test
```

</details>

---

<div align="center">

### 🩸 Keep the sheet close. Keep the compendium closer. 🩸

🦇 Built for adventurers who prefer their notes organized and their themes dark. 🦇

</div>

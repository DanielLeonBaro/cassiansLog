# Wikidot Compendium Importer

Standalone Node.js 20+ tool for retrieving user-requested pages from `dnd5e.wikidot.com` and `dnd2024.wikidot.com`, preserving raw evidence, normalizing reviewed records, and later exporting Cassian's Log or Aurora formats.

Public access does not imply redistribution permission. Every record retains its URL, retrieval time, content hash, stated publication, and `licenseStatus`. Review licensing before publishing output.

## Commands

```bash
npm test
npm run crawl -- --site 5e --url https://dnd5e.wikidot.com/background:far-traveler --resume
npm run crawl -- --site 5e --type background --resume --limit 10
npm run crawl -- --site 5.5e --type class --resume
npm run validate
npm run validate -- --strict
npm run export:cassians-log
npm run export:aurora
node src/cli.js preview-import --format cassians-log --catalog-dir /path/to/compendium/data
node src/cli.js stage-import --format cassians-log --catalog-dir /path/to/compendium/data --accept-preview HASH
```

Useful crawl flags: `--rate-ms 1000`, `--retries 2`, `--cache-dir PATH`, `--output-dir PATH`, `--dry-run`, `--no-robots`, repeated `--url URL`, and reviewed `--license-status STATUS`. Allowed license states are `unknown`, `private-use-only`, `permission-granted`, `open-license`, and `redistribution-restricted`. Default is `unknown`; the tool never infers permission from public access. Robots checks are enabled by default. `--no-robots` requires deliberate user use.

Without `--url`, either site crawler reads the front page plus linked category indexes, classifies supported detail URLs, applies `--type`, and optionally caps work with `--limit`. The 2024 parser labels records `official`, `unearthed-arcana`, or `homebrew`; it never silently merges those families. Raw HTML and fetch metadata live under `output/raw/`. Parsed records live under `output/normalized/<ruleset>/<stated-publication>/<type>/`; missing publication uses `_unknown-source`. Cache state is separate under `.cache/`. `--resume` reuses matching responses.

`validate` writes deterministic `output/reports/validation.json` and `conflicts.json`. Normal mode reports unknown publications, unknown license states, and identity conflicts as warnings. `--strict` fails them. A strict crawl also rejects a missing publication or `unknown` license immediately; supply a license state only after human review.

`export:cassians-log` reads only normalized records, runs strict validation, and writes a deterministic preview package under `output/exports/cassians-log/`. It never modifies Cassian's live/generated Compendium. The package mirrors Cassian category documents and retains source URL/hash, parser, ruleset, classification, license, and manual-automation metadata.

`export:aurora` runs the same strict gate, then writes Aurora `<elements>` XML grouped under `output/exports/aurora/<ruleset>/<publication>.xml`. IDs are stable across content updates. Recognized spell setters are emitted; all executable rules remain manual. Custom provenance setters retain URL/hash/parser/ruleset/license/classification/automation status.

`preview-import` compares a Cassian export with an existing catalog by stable ID, original ID, then semantic identity. It writes deterministic add/update/duplicate/conflict decisions and a review hash. `stage-import` requires that exact hash, recalculates it to reject stale review, blocks conflicts, and writes a merged catalog only to `output/staged/cassians-log/` (or explicit `--staging-dir`). Neither command changes the source catalog.

No Cassian runtime imports or workspace paths are used. Copy this folder anywhere and run it independently.

# Wiki content difference scripts

Checks the published Wiki against `wiki/data/pages.json`. It does not replace the current Wiki data.

Run the full check from the repository root:

```bash
npm run diff:wiki
```

Generated files go into `output/`:

- `latest-pages.json`: newly fetched snapshot.
- `wiki-diff.md`: short readable summary.
- `wiki-diff.json`: exact new, changed, and missing content, including before/after pages.

To compare two existing snapshots without downloading anything:

```bash
node wiki/scripts/content-diff/compare.cjs CURRENT.json LATEST.json OPTIONAL_OUTPUT_DIRECTORY
```

Review the reports before importing or editing Wiki data. A page listed as missing is not deleted automatically.

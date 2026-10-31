# PDF.js runtime

Vendored from `pdfjs-dist` 6.4.299 for client-side reading of D&D Beyond PDF form fields.

- `pdf.mjs`: legacy browser build
- `pdf.worker.min.mjs`: matching worker build
- `LICENSE`: Apache License 2.0

Update both runtime files together from the same PDF.js release.

Source: `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz`.
Package integrity: `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==`.
Use `npm pack pdfjs-dist@6.4.299 --ignore-scripts` to verify/download the package, then copy `legacy/build/pdf.mjs`, `legacy/build/pdf.worker.min.mjs`, and `LICENSE`.

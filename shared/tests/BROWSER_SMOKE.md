# Browser smoke tests

Run the dependency-free browser smoke suite after changes to page initialization, DOM rendering, dialogs, routes, storage restoration, or shared navigation:

```bash
npm run test:browser
```

For code changes, run only affected component tags. Multiple tags combine cases:

```bash
npm test -- @campaigns @characters
npm run test:browser -- @campaigns @characters
```

Available tags:

- `@admin`
- `@auth`
- `@campaigns`
- `@character-layout`
- `@characters`
- `@combat`
- `@compendium`
- `@core` (all components; use for cross-cutting infrastructure)
- `@initiative`
- `@music`
- `@npcs`
- `@screens`
- `@themes`
- `@gc` — shared components, density/preferences, V5, sidebar/drawer, and exact viewport/palette matrix
- `@wiki`

Both automated runners accept the same tags. List them with `npm test -- --list-tags` or `npm run test:browser -- --list-tags`. No tags keeps full-suite behavior. Unknown tags fail immediately instead of silently skipping coverage. Choose every component touched by a change; cross-component changes should pass all matching tags.

The runner starts a temporary local static server and a fresh headless Firefox session through GeckoDriver. It does not use the deployed Worker or production D1 database. API requests intentionally return `404`, exercising the browser/local fallback paths.

For focused V6 Combat Desk verification with Chrome or Edge, run `npm run test:combat-desk`. Set `CHROMIUM` to the browser executable when it is not installed at a standard Windows location. This dependency-free check covers V6 combat interactions, personal state, phone and desktop navigation, and modal focus; it does not replace the broader Firefox suite. It uses a temporary profile and local server, and writes preview screenshots under the system temporary directory.

Requirements:

- Firefox
- GeckoDriver available on `PATH`, or `GECKODRIVER` set to its executable path
- permission to bind temporary localhost ports and launch Firefox

The full suite covers:

- Character archive rendering and opening/closing Quick Setup
- routed Character tracker rendering and opening/closing the editor
- Combat & Loot workspace rendering
- Music local fallback and tag entry
- Wiki local fallback, banner editor, and cursor-aware formatting toolbar
- Compendium local fallback and search
- Public Initiative read-only failure state without D1
- Admin localhost mode without a password or D1

The browser uses a temporary profile, so smoke interactions do not alter the developer's normal browser storage. The test does not submit forms, save documents, or write remote data.

If browser automation cannot run in the current environment, manually serve the repository and perform the same checks above. Record that browser verification remains incomplete; passing `npm test` and HTTP route tests is not a substitute.

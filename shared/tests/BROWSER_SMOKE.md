# Browser smoke tests

Run the dependency-free browser smoke suite after changes to page initialization, DOM rendering, dialogs, routes, storage restoration, or shared navigation:

```bash
npm run test:browser
```

The runner starts a temporary local static server and a fresh headless Firefox session through GeckoDriver. It does not use the deployed Worker or production D1 database. API requests intentionally return `404`, exercising the browser/local fallback paths.

Requirements:

- Firefox
- GeckoDriver available on `PATH`, or `GECKODRIVER` set to its executable path
- permission to bind temporary localhost ports and launch Firefox

The suite covers:

- Character archive rendering and opening/closing Quick Setup
- routed Character tracker rendering and opening/closing the editor
- Combat & Loot workspace rendering
- Music local fallback and tag entry
- Wiki local fallback and opening/closing its editor
- Compendium local fallback and search
- Public Initiative read-only failure state without D1
- Admin localhost mode without a password or D1

The browser uses a temporary profile, so smoke interactions do not alter the developer's normal browser storage. The test does not submit forms, save documents, or write remote data.

If browser automation cannot run in the current environment, manually serve the repository and perform the same checks above. Record that browser verification remains incomplete; passing `npm test` and HTTP route tests is not a substitute.

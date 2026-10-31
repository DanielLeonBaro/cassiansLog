# Tracker 2.1 / 2.2 design review

Run `npm run preview:trackers`, then open <http://127.0.0.1:4173/char/tests/previews/>.
Choose Base or Character Sheet, fighter/spellcaster/NPC, screen size, light/dark theme,
density, and editable/player access. Use **Open full screen** to try the current device.

This is the visual-review stage required by the replacement plan. The shared screen
components live in `char/js/tracker/screen*`; fixture adapters are here. Previews never
load real character documents, call APIs, or write browser storage. Reload or switch
fixture/view to reset. The static-site builder excludes this entire `tests` directory.

Interactive paths include navigation, details, pinning, HP, dice, filters, resource
confirmations, slots/upcasting, concentration, charges, counter corrections, rests,
preparation, death saves, hit dice, flags, trackers, notes, and the on-demand Turn sheet.
Action/spell spending, HP changes, dice, and turn marks reuse existing pure helpers.
Other fixture edits and recovery are demonstrations; they do not persist or implement
the full live rules runtime.

Checks:

```sh
npm test -- @character-layout @characters @npcs @gc @themes
npm run test:tracker-previews
```

The browser check requires Chrome or Edge (or `CHROMIUM` pointing to its executable).
It covers both views, three fixtures, 320/390/768/1024/1280px, both themes/densities,
three complete Base action rows at 390x844, keyboard/focus, themed panels, 44px
controls, overflow, read-only access, and representative interactions. It simulates
a reduced viewport for the software keyboard; a real mobile keyboard still needs
device review. Screenshots go to `.cloudflare/previews/tracker-2x/`.

## Live integration

The live tracker now offers `v2.1`/`v2.2` as additional choices. It uses the shared
screen components with `screen-adapter.js`, existing spending/rest/notes/inventory
handlers, editor hooks, and permissions. Existing pin and checklist keys are reused.
V1–V6 and all existing defaults remain available, as requested after visual review.
No legacy layout records or frontend layouts have been removed or normalized away.

Run `npm run test:tracker-screens` for live persistence, permissions, and compatibility
checks. Deployment and selection instructions are in `docs/tracker-layouts.md`.

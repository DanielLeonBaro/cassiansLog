# Graphic components

`shared/gc` owns feature-neutral presentation. Features retain domain models, permissions, data access, positioning, and specialized layouts. The stack remains vanilla ES modules, Tailwind, and the existing icon font.

## Use

Load `shared/gc/styles.css` after the generated Tailwind stylesheet and load `shared/gc/entry.js` as a module. Give the body a stable `data-gc-page` from `catalog.js`. Existing `shared/js/site-header.js` remains a compatibility entry point for `mountSiteHeader`.

Import named exports from `api.js`, or use an individual module to avoid unrelated initialization. `components.js` and `classes.js` provide presentation without initializing account preferences. Rendering helpers escape caller-supplied labels. Pass already-authorized content to controls; GC never decides who can change feature data.

| Interface | Usage |
| --- | --- |
| `.gc-button` | `data-variant="primary\|secondary\|ghost\|danger"`; native disabled state |
| `.gc-field` | Native input/select/textarea; `aria-invalid="true"` for validation |
| `.gc-panel` | Surface; optional `data-padded` for density-aware padding |
| `.gc-badge` | `data-tone="neutral\|success\|warning\|danger"` |
| `.gc-table`, `.gc-tabs`, `.gc-toolbar` | Semantic table, tab list, or action layout |
| `.gc-overlay`, `.gc-drawer` | Accessible dialog markup with shared lifecycle controller |
| `renderButton`, `renderBadge`, `renderState` | Escaped strings from option objects |
| `createDialogController`, `createDrawerController` | Existing focus trap, close hooks, and focus restoration |
| `createMenuController` | Trigger/popup lifecycle; dispose with `destroy()` |
| `updateUiPreferences(changes)` | Update density, page overrides, sidebar, or tracker choices |

Visual tokens are CSS custom properties in `styles.css`. Theme/background catalogs are owned here, with compatibility exports under `shared/js`. `classes.js` provides shared class strings. Use Tailwind for feature layout, not for redefining a shared control. `enhanceComponents` is a compatibility adapter for dynamic legacy markup; new markup should declare its semantic GC classes directly.

## Preview

Serve the repository locally and open `/shared/gc/gallery/`. The gallery uses real shared components and supports both densities, the Appearance picker, dialog/drawer focus behavior, menus, and keyboard tabs. It is intentionally excluded from `.cloudflare/public`.

## Preferences and layout

Account preference API: authenticated `GET` and `PUT /api/auth/ui-preferences`. PUT accepts `{ version: 1, density, pageDensity, sidebarCollapsed, trackerStyles: { character, npc } }`. Density values are `comfortable` and `compact`; removing an override restores inheritance. Tracker choices are V1–V5 or `campaign`.

The browser cache is scoped by user ID. D1 is authoritative unless a local write is pending. Pending writes survive reload and retry on reconnect or explicit retry. Localhost/static users retain browser-only settings. Tracker choices apply when opening the tracker, so changing Appearance cannot destroy an active editor draft. V5 is the personal default; `campaign` follows the existing global/per-entity Admin style configuration. V3 saved arrangements are untouched.

## Rollout and rollback

Apply `0018_user_ui_preferences.sql` before deploying the redesigned application. This is an additive table; it does not migrate character documents, legacy layouts, or theme selections. Ordinary builds do not apply it. If the table is unavailable, the UI reports failed sync and preserves its local pending selection. Roll back by restoring the previous application release and leaving the new table intact. Do not run seed commands for this UI change.

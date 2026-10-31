# Cassian's Log

Cassian's Log is a D&D 5e toolkit with editable character sheets, combat and loot trackers, a dice roller, a campaign Wiki, and a searchable Compendium.

The app leaves ability scores, armor class, spell save DCs, prepared-spell limits, and other character-building decisions under the player's control. The Cloudflare deployment stores shared characters, runtime state, notes, Combat & Loot presets and drafts, Wiki pages, and Compendium data in D1. Browser storage and bundled JSON remain available as offline and rollback fallbacks.

## Run locally

Requirements: Node.js 24.22.1 LTS (see `.node-version`) and npm. Patched Node.js 22.23.4+ and 26.12.1+ are also supported within their respective major versions; older releases are excluded by `engines`.

```bash
npm ci
npm run build:site
npm run d1:migrate:local
npx wrangler dev
```

Open the URL printed by Wrangler. Unauthenticated requests redirect to `/login/`; successful sign-in redirects to the Character archive at `/char/`. A plain static server remains useful for the legacy local-storage fallback, but it cannot exercise secure sessions or OAuth.

Requests served from `localhost`, `127.0.0.1`, or IPv6 loopback bypass login and receive local administrator visibility. The **Me** panel explains that real email, password, and provider changes are disabled during this bypass.

If PowerShell blocks `npm.ps1`, use `npm.cmd`.

Tracker 2.1 Base and 2.2 Character Sheet are optional alongside V1–V6. Choose them
in Appearance and reopen the character or NPC tracker. See the
[tracker deployment and rollback guide](docs/tracker-layouts.md).

## Commands

| Command | Purpose |
|---|---|
| `npm run build:css` | Build the shared Tailwind stylesheet |
| `npm run build:site` | Build the static assets used by Cloudflare Workers |
| `npm run build:compendium` | Convert Compendium XML sources into feature-local JSON |
| `npm run d1:seed` | Generate the ignored, deterministic D1 seed SQL |
| `npm run d1:migrate:local` | Apply schema migrations to local D1 |
| `npm run d1:seed:local` | Import Compendium and bundled characters into local D1 |
| `npm run d1:migrate:remote` | Apply pending migrations to production D1 |
| `npm run d1:seed:remote` | Refresh production Compendium and bundled characters |
| `npm run import:wiki` | Refresh the bundled Wiki JSON seed |
| `npm test` | Run all feature, integration, architecture, route, and CSS tests; append component tags for focused cases |
| `npm run test:browser` | Run all local fallback smoke tests in headless Firefox; append component tags for focused cases |
| `npm audit` | Check dependencies for known vulnerabilities |

Dependency updates use the committed lockfile and weekly Dependabot checks for npm and GitHub Actions. Tailwind remains on 3.4.19 to preserve the existing theme and browser support; `overrides` selects patched `postcss-selector-parser` 7.1.7+ for CVE-2026-104844. Miniflare's Undici is overridden to 7.30.1+ to fix its outstanding HTTP client advisories. Recheck these overrides when updating their parent packages, and verify the CSS build and Wrangler dry run. PDF.js is vendored separately; see `shared/vendor/pdfjs/README.md` for its version and verified update source.

## Independent feature layout

```text
cassiansLog/
|-- char/                      # Character pages, data, runtime, and tests
|   |-- <character>/           # Route, character.json, and portrait
|   `-- js/
|-- combat-loot/               # Initiative, combat, loot, and custom trackers
|-- compendium/                # Page, generated data, runtime, builder, and tests
|-- wiki/                      # Page, seed data, runtime, importer, and tests
|-- integrations/
|   `-- character-compendium/ # Optional picker adapter
|-- cloudflare/                # Worker API, D1 migrations, seed builder, and tests
|-- shared/                    # Neutral UI, storage, dice, assets, styles, and config
`-- index.html                 # Redirect to /char/
```

Character, Combat & Loot, Compendium, and Wiki code may import neutral code from `shared/`, but they never import one another. Cross-feature behavior belongs in `integrations/`. The Character–Compendium picker is enabled by a separate module script on Character routes; removing that script removes the picker without affecting the Character editor.

Automated tests accept component tags. For a campaign-aware Character change, run `npm test -- @campaigns @characters` and `npm run test:browser -- @campaigns @characters`. See `shared/tests/BROWSER_SMOKE.md` for the tag list. No tags runs everything.

Bundled character data and portraits live beside their routes under `char/<id>/`. The Wiki seed lives at `wiki/data/pages.json`. Generated Compendium files live in `compendium/data/`; edit the builder rather than generated JSON by hand.

## Navigation toggles

Edit `shared/config/sections.json` to choose which destinations and Character Tracker Jump-to controls appear. Only the literal JSON value `false` hides a control; omitted settings remain visible.

These global settings control shared feature visibility. Account roles in Admin additionally protect the corresponding page and API routes for individual users.

## Updating data

Put Compendium XML sources in the ignored `compendium/source/` directory, then run:

```bash
npm run build:compendium
npm test
```

To refresh the Wiki seed from the configured published campaign source, run `npm run import:wiki` and then `npm test`.

## D1 data and deployment

Cloudflare Workers serves the static site, protects every application route, and handles `/api/*`. D1 uses the `DB` binding and database `cassianslog-data`. `OPEN_WRITES: "true"` lets signed-in members edit; setting it to `"false"` limits protected writes to the primary administrator or the legacy `WRITE_TOKEN` flow. Anonymous API requests are rejected either way.

Migration `0006_user_authentication.sql` adds users, provider links, sessions, and short-lived OAuth states. Before the first production sign-in, set a policy-compliant `PRIMARY_ADMIN_PASSWORD` Worker secret to bootstrap the primary administrator as `dleonbaro@gmail.com`. Bootstrap fails closed when the secret is missing or invalid; there is no shared default password. Existing accounts are preserved and do not require the bootstrap secret. If an earlier deployment used the old shared default, change that account's password through **Me** or Admin to revoke its sessions. Passwords are stored as salted PBKDF2-SHA-256 hashes; sessions use hashed, random tokens in secure HTTP-only cookies.

Google sign-in requires a provider application with this exact callback URL:

```text
https://<your-domain>/api/auth/oauth/google/callback
```

Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets or environment bindings. A first-time Google account must set a policy-compliant password before its session is created, allowing later direct email/password sign-in.

The Compendium, bundled characters, and Wiki are generated from the same checked-in JSON used by the static fallback. `npm run d1:seed` writes `.cloudflare/d1-seed.sql`; the file is ignored because it is generated and about 59 MiB. Applying the seed inserts or updates Compendium entries by ID, inserts missing bundled characters, inserts the character template as unavailable by default, and inserts the initial Wiki. It does not remove unrelated Compendium rows, overwrite edited or inactive character or Wiki records, or delete custom characters, runtime state, notes, presets, or drafts.

Existing `localStorage` keys remain stable. This preserves older browser data and lets the `localstorage-version` Git branch run locally or on GitHub Pages without D1. The D1-enabled `main` branch tries cloud reads first where shared data exists and falls back to local or static data when the API is unavailable.

The navbar exposes Wiki according to the user's Wiki role and Admin only for the primary administrator. `/admin/` manages D1-backed runtime configuration, page roles per account, character availability, and password resets. A reset revokes every existing session for that user. Legacy admin-token access is disabled unless `LEGACY_ADMIN_TOKEN_ENABLED` is explicitly set to `"true"`.

The **Me** button beside **Sign out** lets a signed-in user change their password, change their email, and connect or unlink Google. The fixed primary administrator email cannot be changed because it identifies the only account allowed into Admin.

## Production deployment checklist

Before pushing to the branch connected to Cloudflare:

1. Run `npm ci` and `npm audit` on a supported, patched Node.js release. Before the first production sign-in, set `PRIMARY_ADMIN_PASSWORD` with `npx wrangler secret put PRIMARY_ADMIN_PASSWORD`.
2. Confirm Wrangler authentication with `npx wrangler whoami` or set `CLOUDFLARE_API_TOKEN` in CI.
3. In the Google provider console, configure the production callback URL shown above.
4. Add the two required OAuth values in **Cloudflare → Workers & Pages → cassianslog → Settings → Variables and Secrets**. Store them as secrets. Wrangler declares these names as required and will reject a deployment when one is absent.
5. Run `npm test` and `npm run build:site`.
6. Run `npm run d1:migrate:local` and `npx wrangler deploy --dry-run`.
7. Back up D1 if desired, then run `npm run d1:migrate:remote` before pushing. The authentication Worker needs migrations `0006` and `0007` as soon as the new code is live.
8. Review `git diff --check` and `git status`, commit the intended files, and push the deployment branch.

After pushing:

1. Wait for the Cloudflare Workers Build to report success and review its migration/deployment logs.
2. Open `/api/health`; it should return `{ "ok": true }`.
3. In a private browser window, open `/char/` and confirm it redirects to `/login/`.
4. Sign in as the primary administrator and confirm Character Selection opens.
5. Open **Me**, reset the password if this is the first production launch, and connect Google.
6. Verify direct Google sign-in, then verify direct email/password sign-in still works.
7. Open Admin and check Wiki visibility and each user's roles. Use a non-admin account to confirm disallowed pages return to Character Selection and their APIs return `403`.
8. Review Worker errors and D1 metrics in Cloudflare. If the Worker must be rolled back, use the previous Worker deployment; migrations `0006` and `0007` are additive and can remain in place.

Combat & Loot keeps its named presets under `dnd-combat-loot-presets-v1` and its recoverable draft under `dnd-combat-loot-draft-v1` as local fallbacks while synchronizing the same records to D1. Removed presets use `active: false`; records remain recoverable. Downloads still export the visible document without changing saved state.

Cloudflare Workers Builds deploys `main`. To publish the static fallback, open GitHub Actions, run **Deploy static content to Pages** manually, and select `localstorage-version`; automatic GitHub Pages runs still follow `main`. Before pushing generated-data changes, run the relevant generator, local D1 seed verification, and `npm test`.

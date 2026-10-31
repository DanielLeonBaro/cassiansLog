# Deploy the optional Tracker 2.1 and 2.2 views

This release adds **2.1 · Base** and **2.2 · Character Sheet** for characters and NPCs.
V1–V6 remain available. Existing defaults, saved layout choices, character documents,
runtime state, notes, URLs, exports, and personal pin/turn storage keys are retained.
This release introduces no new migration files, endpoint, seed update, or data purge.
Account layout sync requires the existing `0018_user_ui_preferences.sql` prerequisite.

## Validate locally

From the repository root in PowerShell:

```powershell
npm.cmd ci
npm.cmd test -- '@character-layout' '@characters' '@npcs' '@gc' '@themes' '@campaigns'
npm.cmd run test:tracker-previews
npm.cmd run test:tracker-screens
npm.cmd run build:site
```

Run `npm.cmd ci` on the deployment machine so Wrangler and workerd receive native
packages matching its operating system. The Windows installation and Wrangler dry
run succeeded for this deployment. Run the dry run again before future publishing.

The two tracker browser commands use Chrome or Edge. Set `CHROMIUM` to the browser
executable if it is installed elsewhere. The normal `test:browser` command is also
available when the repository's Firefox/GeckoDriver prerequisites are installed.

For isolated sample data, run `npm.cmd run preview:trackers`, then open
<http://127.0.0.1:4173/char/tests/previews/>. Fixtures and preview routes are excluded
from the production build. To exercise real local tracker persistence, use the
normal app/local server described in the main README and select a new view in Appearance.
Choosing a layout applies it automatically to the open tracker. Views 2.1 and 2.2
switch in place; changes involving an older layout save the choice and reload the tracker.

## Deploy to the existing Cloudflare Worker

The repository's Worker is `cassianslog`; its static asset directory is
`.cloudflare/public`. Deploy the Worker and the rebuilt assets together, since both
client and server must accept the new style values.

1. Review the intended changes and commit them on your deployment branch.
2. If using the existing Workers Builds connection, push to its configured production
   branch (`main`, according to this repository's deployment notes). Confirm its build
   runs `npm run build:site`, and wait for the deployment to succeed.
3. Alternatively, deploy manually after building:

   ```powershell
   npx.cmd wrangler whoami
   npx.cmd wrangler deploy --dry-run
   npx.cmd wrangler deploy
   ```

   Run `npx.cmd wrangler login` first if `whoami` shows no account. Keep the existing
   D1 binding and OAuth secrets configured. When local npm command shims are missing,
   the equivalent CLI entry point is `node ./node_modules/wrangler/bin/wrangler.js`.

If `0018_user_ui_preferences.sql` is already applied, this tracker release needs no
additional D1 migration. Production was missing its `user_ui_preferences` table, so
this deployment applied only that existing additive migration. No seed command ran;
character documents and runtime data were retained. A fresh installation still
requires the normal repository setup.

References: [Wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/),
[Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[Worker static assets](https://developers.cloudflare.com/workers/static-assets/).

## Select and verify a view

1. Open **Appearance → Workspace**. Set **Character tracker** or **NPC tracker** to
   **2.1 · Base** or **2.2 · Character Sheet**. The choice applies automatically:
   open 2.x views switch in place; changes involving an older layout save and reload.
   Finish any editor draft before selecting a layout that reloads. In the new views,
   Appearance is under the header's overflow menu. Character and NPC choices are saved
   separately for your account and apply across campaigns.
   The compact **2.1 ↔ 2.2** header button also switches instantly and saves the
   same personal preference. Play/Actions and Checks/Sheet keep their current context;
   shared pages retain unsaved note text. Both combat pages include portrait, combat
   stats, extra movement, senses, and expandable character information.
2. **Edit sheet → Advanced → My layout** shows your active layout. Saving an explicitly
   changed layout updates the same personal preference as Appearance and reloads the
   tracker. It leaves shared campaign/entity settings unchanged; cancelling or saving
   ordinary character edits leaves your layout preference unchanged. Your sheet choice
   wins over later admin/DM layout changes. Campaign managers still set shared defaults
   and entity overrides in campaign/entity administration; select **Follow campaign
   setting** in Appearance when you want to inherit those settings.
3. Confirm `/api/health` returns `{ "ok": true }`. On a character you can edit, check
   HP, a roll, a resource confirmation, cancellation, a spell slot, a pin, and notes.
   Refresh and verify persistence. Confirm a player sees only the NPC fields shared
   with them and cannot edit runtime values or mark turns.
4. Switch back to an existing layout and verify the same character state and notes
   remain available.

If you prefer an existing layout, select V1–V6 again in Appearance. There
is no migration to undo. For a release rollback, restore the prior Worker deployment
with its matching static assets; retain the existing database and browser storage.
An older client may display its fallback layout for a saved `v2.1`/`v2.2` choice until
you choose an older style again.

Automated Chromium checks cover 320, 390, 768, 1024, and 1280px. Preview checks cover
both themes/densities and fighter, spellcaster, and NPC fixtures. Reduced viewport
checks approximate a software keyboard; a physical phone/tablet keyboard review
remains useful after deployment.

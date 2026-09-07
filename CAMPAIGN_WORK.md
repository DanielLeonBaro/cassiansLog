# Campaign Organization Work

This file is the durable implementation log for campaign support. Update it whenever work changes stage. A task moves to Done only after its focused verification passes.

## Decisions

- Campaign URLs use `/c/<slug>/...`; slugs contain 2-48 lowercase `a-z` characters.
- Any signed-in user may create a campaign and becomes its first DM.
- Campaign names are public to signed-in users. Content requires membership or primary Admin access.
- Join passwords contain 6-128 characters, are hashed, and may be rotated without removing existing members.
- Campaign DMs and the primary Admin manage members, DM roles, passwords, campaign settings, and character assignments.
- Players may create characters and edit characters assigned to them. Several players may share one character.
- All members may read character sheets and runtime state. Character notes are limited to assigned players, DMs, and the primary Admin.
- Wiki, Music, Combat, initiative, characters, notes, and Screens are campaign-scoped. Compendium and personal themes remain global.
- New campaigns start with default settings and explicit empty content. The static character creation template remains available.
- Existing data migrates to Apotheosis of the Rings (`aotr`), with `breugaire` retained as a permanent redirect alias. Existing users join it; old `dm-screen` users become campaign DMs.
- Apotheosis of the Rings joining remains disabled until the primary Admin sets a password.
- Campaign cards contain an optional uploaded banner, name, short description, Enter/Join action, and DM/Admin edit shortcut.
- Existing tables remain intact. No destructive contraction is part of this delivery.

## To Do

- [ ] Obtain explicit approval before any remote D1 migration or deployment.
- [ ] Export/verify the remote D1 recovery point before rollout.

## In Progress

- None.

## Done

- [x] Product decisions and non-goals locked.
- [x] Existing uncommitted Wiki/content-diff changes recorded for preservation.
- [x] Baseline established and campaign data readers/writers mapped.
- [x] Added additive campaign schema and idempotent Apotheosis of the Rings data migration.
- [x] Added central campaign resolution, membership, DM/Admin, password, throttle, slug-history, and final-DM protections.
- [x] Added campaign-scoped Character, Wiki, Music, Combat, initiative, settings, and private Screen APIs.
- [x] Added Apotheosis legacy API aliases and dual writes without changing or removing legacy tables.
- [x] Added campaign/user browser-cache isolation; only AOTR imports legacy browser keys.
- [x] Added campaign discovery/create/join hub and DM/Admin management UI.
- [x] Added `/c/<slug>/...` Worker routing, canonical alias redirects, root-safe assets, global/contextual Compendium, and campaign-aware navigation.
- [x] Added player read-only Wiki/Music/Combat/character rendering and assigned-character edit boundaries.
- [x] Added focused migration, discovery, password throttle/rotation, membership, isolation, notes, assignment, Screen preservation, slug, redirect, and static-route tests.
- [x] Added character-style campaign cards with optional banner uploads, descriptions, Enter/Join actions, and DM/Admin edit shortcuts.
- [x] Ran final full verification gates and inspected the complete diff.
- [x] Diagnosed the deployed blank/loading pages: Worker legacy-route redirects intercepted feature JavaScript and authenticated JSON assets.
- [x] Routed feature assets before legacy page redirects, fixed the campaign character tracker-shell URL, and retained membership protection for legacy AOTR JSON.
- [x] Added browser-only localhost campaign discovery, creation, management, settings, Wiki isolation, and character isolation without requiring D1.
- [x] Proved the primary site Admin receives campaign `admin` authority and every DM management/read-write endpoint.
- [x] Deployed the Worker/assets-only repair to Cloudflare as version `51799509-63c8-4134-a2e4-772c91dbe38e`.
- [x] Fixed direct localhost AOTR character routes so bundled character shells resolve correctly without campaign D1.
- [x] Made AOTR archive and campaign management use the same complete Character list.
- [x] Added one localhost Admin plus 20 selectable test-player identities, persistent local login, membership controls, and character assignments.
- [x] Replaced the separate campaign creation section with a Screen-style dashed placeholder card and creation dialog.
- [x] Made localhost Screens, settings, Character state/notes, Wiki, Music, Combat, and initiative caches campaign-scoped; empty campaigns no longer inherit AOTR Screen references.
- [x] Added browser coverage for AOTR Cassian, 21 local identities, character assignment, empty campaign characters, campaign navigation, and AOTR/Sita Screen isolation.
- [x] Fixed Cloudflare HTML asset canonicalization so campaign Character tracker and management shells keep their campaign URL context.
- [x] Added accent-colored campaign slug, membership-role, and free-text status badges; campaign create/manage now persist status.
- [x] Added character status to bundled documents, Quick Setup, editor, selection cards, tracker header, campaign APIs, and legacy/local normalization.
- [x] Added additive `campaign_statuses` storage and idempotent character JSON status migration without altering legacy tables.

## Verification Log

- Baseline `npm test`: passed.
- Baseline `npm run build:site`: passed.
- Baseline `npm run test:browser`: passed after rerunning with localhost binding permission; sandbox run failed with `listen EPERM`.
- Focused campaign migration test: passed; verifies preservation, role mapping, isolation, idempotency, and no `DROP`/`ALTER`.
- Focused campaign API/route test: passed; includes public discovery, join throttling, password rotation, membership removal/rejoin, private Screen preservation, notes, assignments, final-DM guard, slug redirects, legacy redirects, and global Compendium.
- Final `npm test`: passed.
- Final `npm run build:site`: passed with campaign assets present in `.cloudflare/public`.
- Final `npm run test:browser`: passed, including campaign discovery cards and a campaign Character deep link through the localhost fallback.
- Final `git diff --check`: passed.
- 2026-09-06 regression `npm test`: passed after asset routing, localhost fallback, and Admin access repairs.
- 2026-09-06 regression `npm run build:site`: passed; 195 static files built.
- 2026-09-06 regression `npm run test:browser`: passed all campaign Wiki, management, character tracker, Screen, and Admin scenarios.
- Remote D1 inspection was read-only: AOTR campaign Wiki, six character documents, settings, memberships, and DM roles remain present; no migration or data write is required for this repair.
- Live smoke: health returned 200; Wiki, Character, Music, Screen, campaign-management, and campaign-context modules returned 200 and matched the built files byte-for-byte.
- Live access smoke: unauthenticated legacy Wiki JSON redirects to login instead of exposing AOTR content.
- 2026-09-07 refinement focused tests: passed for campaign context, Character repository, Screens, Public Initiative, Worker routing, and architecture boundaries.
- 2026-09-07 refinement `npm test`: passed.
- 2026-09-07 refinement `npm run build:site`: passed.
- 2026-09-07 refinement `npm run test:browser`: passed all 17 scenarios, including 21 local identities, AOTR Cassian, assignments, empty Sita characters, and AOTR/Sita Screen isolation.
- 2026-09-07 refinement `git diff --check`: passed.
- 2026-09-07 Cloudflare shell regression: reproduced `/char/tracker.html` and `/c/aotr/manage/` redirects locally, then verified both canonical shells return 200 without redirects.
- 2026-09-07 Cloudflare shell repair: `npm test`, `npm run build:site`, `npm run test:browser`, and `git diff --check` passed.
- 2026-09-07 status badges: `npm test`, `npm run build:site`, and `npm run test:browser` passed; browser coverage verifies campaign role/slug/status badges and character card/tracker status.
- Pre-existing user changes: `.gitignore`, `package.json`, `shared/tests/run.cjs`, `wiki/scripts/import.cjs`, `wiki/scripts/content-diff/`, and `wiki/tests/content-diff.test.cjs`.

## Rollback Notes

- Migration uses new `campaign_*` tables and does not drop or rewrite legacy tables.
- AOTR writes must mirror legacy tables during the compatibility window.
- Before any remote migration, export D1 or verify a Time Travel recovery point and obtain explicit user approval.
- Rolling back application code restores the old Worker/assets; legacy AOTR data remains available through mirrored tables. New campaign rows remain preserved in campaign tables.
- This production regression repair changes only Worker/assets. It does not mutate D1.
- Status rollout requires additive migration `0014_entity_statuses.sql` before deploying its Worker/assets; rollback preserves the sidecar rows and harmless extra character JSON field.

## Non-Goals

- Campaign deletion or archiving.
- Invite links or email invitations.
- Multiple site Admins.
- Real-time synchronization.
- Per-campaign D1 databases.
- Audit logs.
- DM access to another user's private Screen.

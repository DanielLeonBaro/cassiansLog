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

- Nothing. Local implementation and verification are complete; remote rollout awaits approval.

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
- Pre-existing user changes: `.gitignore`, `package.json`, `shared/tests/run.cjs`, `wiki/scripts/import.cjs`, `wiki/scripts/content-diff/`, and `wiki/tests/content-diff.test.cjs`.

## Rollback Notes

- Migration uses new `campaign_*` tables and does not drop or rewrite legacy tables.
- AOTR writes must mirror legacy tables during the compatibility window.
- Before any remote migration, export D1 or verify a Time Travel recovery point and obtain explicit user approval.
- Rolling back application code restores the old Worker/assets; legacy AOTR data remains available through mirrored tables. New campaign rows remain preserved in campaign tables.

## Non-Goals

- Campaign deletion or archiving.
- Invite links or email invitations.
- Multiple site Admins.
- Real-time synchronization.
- Per-campaign D1 databases.
- Audit logs.
- DM access to another user's private Screen.

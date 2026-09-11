# Accounts version — architecture decisions

Standing decisions for the accounts fork of the workout tracker. Newest first.

## 2026-09-10 — account profile structure (Justin's call)

- Account settings begin with a data structure: `display_name` (user-editable
  in Settings → Account) and `account_type` (seeds `'free'`) live in Supabase
  `user_metadata`, so they ride along with the session and need no schema
  changes. Everything stays free; the type field exists so paid/comped tiers
  can be added later without migrating.

## 2026-09-10 — union merge for collection keys (Justin's call: "merger is great")

- Sign-in / sync conflict policy, issue #36: when a collection key (completed,
  templates, tags, exerciseTagPresets, archivedPrograms, customExercises,
  favorites) holds different items on each side, sync UNIONS by id instead of
  last-write-wins — neither device's entries are silently lost.
- Membership merges; per-item content and all scalar keys (activeProgram,
  progressionSetup, periods, appearance, …) stay last-write-wins by
  updated_at. Empty-state guards unchanged. A toast notes when a merge happened.
- Known limit: deletes don't propagate through a union (tombstones = future work).

## 2026-09-10 — rebased onto v0.49 app build (Justin's call)

- App code is now the v0.49 production tree; accounts v1 re-applied on top via
  3-way merge (index.html, app-bootstrap.js) + hand-merge (persistence.js).
- `favorites` sync is Set-aware (v0.49 stores it as a Set; JSON boundary converts
  to/from array). `topExercisesMode` joins the synced keys; `showBlindspots`
  stays local-only (now unused — blindspots are always visible).
- Delete-all-data: clears `state.favorites` in memory too, then the accounts
  dirty-flag + remote wipe before reload.

## 2026-09-10 — accounts build v1 (magic link + local-first sync)

- New module `assets/js/sync.js` (vanilla, no build step): Supabase client
  lazy-loaded from `esm.sh` via dynamic import in try/catch — an unreachable
  CDN degrades silently to local-only behavior.
- Auth UI: Settings → Account section. Email input + "Email me a sign-in link"
  (`signInWithOtp`, redirect back to the app), signed-in email + Sign out +
  "Sync now" + last-sync status. Inline status text, no alerts.
- Sync engine: 11 keys mirrored to `user_data` (completed, templates, tags,
  exerciseTagPresets, activeProgram, archivedPrograms, customExercises,
  favorites, progressionSetup, dashboardPeriod, statsPeriod). The live draft is
  NEVER synced. Per-key `updatedAt` + dirty snapshots in `workout-sync:v1`;
  debounced push hooked into `persistNow()`; pull on sign-in, app start,
  `online` events, and manual Sync now. Last-write-wins per key, with guards so
  empty state never clobbers real data; first sign-in migrates local data.
  "Delete all data" also wipes the user's remote rows (best-effort).
- Known v1 limits: offline delete on one device vs. stale data on another device
  can resurrect (no tombstones); client-clock skew affects last-write-wins
  ordering.
- Justin still needs to add the site URL under Authentication → URL
  Configuration → Redirect URLs, or magic links won't return to the app.

## 2026-09-10 — initial direction (from research + Justin)

- **Backend: Supabase** (hosted Postgres + Auth). Free tier covers 10–50 users at $0/mo.
  Runner-up was Firebase (better offline, but NoSQL + lock-in); PocketBase is the
  escape hatch ($5/mo VPS, own ops); D1 rejected (no auth, would need a custom backend).
- **Auth: passwordless email magic link** (Supabase `signInWithOtp`). Justin's pick —
  no passwords to manage. Open detail: magic link vs password was the one question;
  magic link won.
- **Local-first sync.** localStorage stays the read path (the app keeps working offline
  exactly as today); an outbox queue pushes/pulls in the background when online.
- **Data model stays compatible** with the localStorage version so migration is an
  import, not a rewrite. Migration path: existing local data uploads on first sign-in.
- **This repo is a separate product line.** The localStorage version
  (`cruciferousgreens/workout-app`) keeps shipping. Bug fixes get cherry-picked back
  to it; new accounts features do NOT merge back.
- **Caveat:** Supabase free projects pause after 7 days idle — mitigate with a free
  scheduled ping until usage is steady.

## Open questions

- Supabase project: Justin creates it (or grants access) and supplies the project URL
  + anon key; the app needs both at runtime.
- Domain for the accounts version: undecided — no CNAME in this repo until chosen.
- Multi-device conflict resolution: last-write-wins per record is the starting point;
  revisit if real conflicts appear.
- Sharing/coaching features (friends, PT clients): out of scope for v1 of accounts.

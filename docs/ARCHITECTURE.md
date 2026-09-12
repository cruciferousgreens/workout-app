# Workout App — Architecture

One-page overview of the codebase. The app is vanilla JS (no framework, no build
step) in classic `<script>` files loaded in dependency order by `index.html`.
All modules live in `assets/js/` and follow one convention:

```js
/* ===== module: <name>.js ===== */
```

plus a responsibility doc comment and a `/* Module map (v1.006) — Key: …
Depends on: … */` block. Globals are the module API — no ES modules, no
namespaces (except `Sync = window.Sync` for the account stack). `data/exercises-db.js`
loads before everything and sets `window.FREE_EXERCISE_DB`.

## Layers (load order within each, top → bottom)

**State** — in-memory model + shared helpers
`utilities.js` · `state.js` · `catalog.js` · `exercise-data.js`
- `utilities.js`: `$`, `escapeHtml`, id factories (`uid`, `newSetId`, `newExerciseUid`,
  `newWorkoutId`, …), `localIsoDate`, weight display/conversion (`displayWeight`,
  `storageWeight`, `weightUnit`), `setVolume`, `detectExercisePRs`, set/exercise
  cloning (`cloneSetFields`, `cloneExerciseSets`).
- `state.js`: the two global stores — `state` (UI state) and `workoutState`
  (training data). Every field either store owns is declared in the `fresh*()`
  factories; `progressionSetup` (global progression defaults) lives here too.
- `catalog.js`: normalizes `window.FREE_EXERCISE_DB` into the app's `exercises`
  model. `exercise-data.js`: fallback `coreExercises` + the exercise-image map.

**Persistence** — `persistence.js`
- `PERSIST_KEY = 'workout-app:v1'` in localStorage. `schedulePersist()` debounces
  writes (250 ms); `restorePersisted()` hydrates on boot (quarantines corrupt
  blobs, runs migrations). `exportWorkoutData()` = one-tap JSON backup.

**Sync** — Supabase-backed cross-device sync
`sync-adapter.js` · `sync-engine.js` · `sync-auth.js` · `sync-account-ui.js`
- `sync-adapter.js`: lazy Supabase client (dynamic CDN import; offline ⇒ silent
  local-only). `sync-auth.js`: magic-link + OTP sign-in; on sign-in the login
  transition is **adopt-vs-upload** (never a merge) — remote has data ⇒ adopt
  the cloud wholesale; remote empty ⇒ upload local.
- `sync-engine.js`: per-key merge with per-item revisions. Collection keys
  (`completed`, `templates`, `tags`, `exerciseTagPresets`, `archivedPrograms`,
  `customExercises`, `favorites`) merge by id: membership unions, **content is
  per-item last-write-wins** via `updatedAt` stamps (`stampChangedItems` stamps
  only items whose JSON changed since the last snapshot), deletes are
  **tombstones**. Scalar keys (`progressionSetup`, UI prefs) take the newer side.

**Features** — domain logic + screens
`workout-editor.js` · `progression.js` · `workout-builder.js` · `supersets.js` ·
`set-tags.js` · `saved-workouts.js` · `programs.js` · `program-templates.js` ·
`workout-history.js` · `share-codec.js` · `share.js` · `csv-import.js` ·
`custom-exercises.js`
- `workout-editor.js`: the live workout — draft model (`newSet`, `newExerciseItem`),
  set editing/completion, the add-exercise picker contract.
- `progression.js`: suggestion engine (see below).
- `saved-workouts.js` / `programs.js` / `program-templates.js`: saved-workout
  templates + builder, active programs + program sessions, built-in program
  templates (incl. StrongLifts 5×5).
- `workout-history.js`: `finishWorkout()` finalizes the draft into completed
  history; renders the set-by-set completed-workout view.
- `share-codec.js` / `share.js`: share links (see below). `csv-import.js`:
  CSV/Hevy/MacroFactor import. `custom-exercises.js`: user-created exercises.
  `supersets.js` / `set-tags.js`: superset + tag dialogs.

**UI** — routing + top-level views
`navigation.js` · `dashboard-stats.js` · `exercise-library.js` ·
`exercise-detail.js` · `app-updates.js` · `app-bootstrap.js`
- `navigation.js`: 5-tab routing + scroll restoration. `dashboard-stats.js`:
  dashboard + stats (week strip, muscle heatmaps, charts). `exercise-library.js` /
  `exercise-detail.js`: library browsing and per-exercise history/PRs/trends.
- `app-updates.js`: service-worker update checks. `app-bootstrap.js`: loads last;
  wires static controls to the feature modules and performs the initial render.

## Data model

`workoutState` (persisted under `PERSIST_KEY`):
- `draft` — the in-progress workout (exercises → sets with `{w, r, seconds, rpe,
  tags, done}`); `completed` — finished workouts (immutable-ish records with
  PRs, summaries); `templates` — saved-workout templates; `tags`,
  `exerciseTagPresets` — user tag lists; `activeProgram` / `archivedPrograms` —
  program model; `customExercises`, `favorites`.
- `state` (UI-only, partly persisted): filters, active view, scroll positions,
  settings (`progressionSetup`, appearance/theme, units).
- Identity: everything addressable carries an id from the `new*Id()` factories
  (workout `id`, exercise `uid`, set `uid`, template/program ids). Exercise
  references point at catalog `exerciseId`s (stable across imports).

## Progression engine (`progression.js`)

`progressionForExercise(exerciseId, profile, config)` reads the exercise's **real
completed history only** (top set per session) and returns a next-session target.
Three schemes (per program / per exercise):
- `rpe` — double progression: top-set RPE ≤ threshold (default 8) ⇒ reps first
  within the rep range, then weight, reset to range bottom. Reps-only mode skips
  the weight step; time-based exercises progress seconds the same way.
- `linear` — adds the fixed increment every session, no RPE gate.
- `onerm` — prescribes load as a percentage of the training max.
- The engine never auto-deloads; on a stall it suggests scheduling a deload week
  (deloads are their own mesocycle; deload load clamps to 40–80%, default 60%).
- Suggestion cards are **hints, not values**: `applyProgressionSuggestion` writes
  only to `suggestedTarget` (ghosted placeholders) and never touches user-entered
  values or completed-set attestations.

## Share links (`share-codec.js` / `share.js`)

No backend. v2 links: payload is slimmed (empty fields, uids, false flags,
default-valued progression fields dropped) then `deflate`-compressed via native
`CompressionStream` before base64url — a 3-exercise workout fits in ~179–255
chars so chat apps don't mangle it. v1 (plain base64url JSON) links still
decode. `validSharePayload` is the security boundary for hand-edited links.
Landing: full-screen, signed-out ⇒ "Start workout" (saves to library + starts),
signed-in ⇒ "Add to library" primary + Start secondary; programs ⇒ Add only.

## Tests & deploy pipeline

- `node tests/run.js` — unit suite (7 files, 119 assertions): workout math,
  progression, sync merge, share codec, CSV import, utilities.
  `bash tests/gate.sh` — QA gates: unit suite green (G1), no load-time
  exceptions (G2), smoke checklist complete for the version (G3, parent-run),
  SW/version freshness (G4), privacy scrub (G5), Pages-build SHA match (G6).
- `make-sw.py` regenerates `sw.js` + `assets/js/build-info.js` (`APP_VERSION`,
  written to `assets/js/build-info.js`, rendered in Settings → About).
- Branches: `dev` = work in progress → merge to `main` for QA on
  `cruciferousgreens.github.io/workout-app-accounts` → production
  (`cruciferousgreens/workout-app`, `app.cruciferousgreens.com`) only on explicit
  approval. Version scheme: 0.6–0.99 = public beta, 1.0 = launch; QA builds use
  letter suffixes, never `v1`.
- Hard rules: prod pushes only on explicit approval; never use the owner's name
  in anything pushed to GitHub; never close a GitHub issue without phone QA on
  the QA build.

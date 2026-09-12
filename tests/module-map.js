'use strict';
/* ROLE -> app source files. THE ONLY file that changes when the tree
   restructures: test files must never import app sources by path — only
   via this map (loaded through tests/harness.js). Paths are repo-rooted.
   Post-v1.000 current paths (sync-engine.js / csv-import.js / share-codec.js
   are the B15/B1/B16 splits). */
const SHARE_FACTORY_STUBS=`
/* Test-only stubs for the share-codec role. newSet/newExerciseItem live in
   workout-editor.js (DOM-heavy, not loaded here); these mirror the shapes
   cloneExerciseItemFromShare relies on (uid + exercise/set fields). */
globalThis.__testUidCounter=0;
function newSet(){return {uid:'set-test-'+(++globalThis.__testUidCounter),w:'',r:'',seconds:'',rpe:'',targetRpe:'',tags:[],complete:false};}
function newExerciseItem(opts){opts=opts||{};return {uid:'ex-test-'+(++globalThis.__testUidCounter),exerciseId:opts.exerciseId||'',tracking:opts.tracking||'reps',note:opts.note||'',noteOpen:false,exerciseTags:opts.exerciseTags||[],supersetId:opts.supersetId||null,progression:opts.progression||null,sets:opts.sets||[]};}
`;
module.exports={
  /* Save-as-template (#240, user 2026-09-12): saveCompletedAsTemplate stamps
     the log id on the template and swaps the completed view's button to
     Start. Needs state (workoutState) + utilities (ids, cloning, dates). */
  'saved-workout-template':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/saved-workouts.js',
  ]},
  /* Progression engine: needs state (workoutState/progressionSetup),
     utilities (units, rounding deps), exercise-detail (estimate1RM),
     exercise-library (real getExerciseLogs over workoutState.completed),
     programs (programPctForWeek/isDeloadWeek), then progression itself. */
  'progression-logic':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/exercise-detail.js',
    'assets/js/exercise-library.js',
    'assets/js/programs.js',
    'assets/js/progression.js',
  ]},
  /* Share-link codec: state (state.customExercises) + utilities (uid,
     defaultExerciseProgression, cloneExerciseItemFromShare, cleanTargetRpe)
     + the codec. Factories stubbed (see above). */
  'share-codec':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/share-codec.js',
  ],inject:SHARE_FACTORY_STUBS},
  /* Sync merge core: the engine is self-contained behind the Sync namespace
     (mergeCollectionKey, MERGE_KEYS, isEmptySyncValue, snapshotOf, tombstone
     helpers). Needs the localStorage stub only. */
  'sync-merge':{files:[
    'assets/js/sync-engine.js',
  ]},
  /* CSV/XLSX import parse layer: obCsvFuzzy reads the global `exercises`
     catalog — tests inject the fixture catalog as a global. The global
     EXERCISE_ALIASES from data/exercise-aliases.js rides along so alias
     assertions exercise the real bundled alias table. */
  'csv-import':{files:[
    'data/exercise-aliases.js',
    'assets/js/csv-import.js',
  ]},
  /* Shared helpers: state (progressionSetup) + exercise-detail (estimate1RM,
     needed by detectExercisePRs) + utilities. */
  'utilities':{files:[
    'assets/js/state.js',
    'assets/js/exercise-detail.js',
    'assets/js/utilities.js',
  ]},
  /* Exercise math: estimate1RM + chart helpers. chartXLabels calls
     escapeHtml, so utilities (and its state.js dependency) ride along. */
  'exercise-math':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/exercise-detail.js',
  ]},
  /* Stats math: state (workoutState) + utilities (localIsoDate, setVolume,
     SECONDARY_MUSCLE_WEIGHT, weightUnit, displayVolume) + dashboard-stats.
     Tests inject the fixture catalog as global `exercises`. */
  'stats-math':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/dashboard-stats.js',
  ]},
  /* Workout-history logic: invalidSetsIn/isEmptySet (finish-review rules),
     deleteCompletedWorkoutLanding (#188: delete from logs stays on logs),
     reviewDeleteEmptiesOutcome (#189: no second modal when the rest is
     value-valid). navigation.js rides along for ROUTES/returnRouteKey.
     Tests inject the fixture catalog as global `exercises`. */
  'workout-history-logic':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/navigation.js',
    'assets/js/workout-history.js',
  ]},
  /* Exercise-picker scroll anchor (#192, user 2026-09-12): the pure
     close-scroll rule lives in workout-builder.js next to the picker
     session state. workout-builder.js loads clean under the stub DOM. */
  'picker-scroll':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/workout-builder.js',
  ]},
  /* Workout-screen pane selection (#187, user 2026-09-12): workoutPaneSelection
     (workout-editor.js) — the logs list opens over a live draft — plus the
     #196 no-program home layout decision (workoutHomeLayout).
     workout-editor.js loads clean under the stub DOM. */
  'workout-screen-logic':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/workout-editor.js',
  ]},
  /* Server short links (#177, user 2026-09-12): slug generation/validation,
     prod short-URL building, /s/<slug> path parsing, Supabase insert with
     collision retry and long-link fallback, /s/ resolution through the v2
     decoder, and the 404.html handoff helpers. share-codec rides along for
     resolveShortShareLink's decode path. */
  'share-shortlinks':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/share-codec.js',
    'assets/js/share-shortlinks.js',
  ],inject:SHARE_FACTORY_STUBS},
  /* Sign-in gate on share creation (#207, user 2026-09-12): deliverShareLink
     is the single creation funnel (shareTemplate / shareTemplateLike /
     shareActiveProgram all flow through it). Signed-out taps open the
     sign-in prompt and mint nothing; signed-in keeps the short-then-long
     behavior. */
  'share-signin-gate':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/share-codec.js',
    'assets/js/share.js',
  ]},
  /* Self-contained sign-in-to-share modal flow (#215, user 2026-09-12):
     intro → inline sign-in → share info, all inside #shareSignInDialog,
     reusing the Settings card's auth actions with modal-scoped inputs. */
  'share-signin-flow':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
    'assets/js/share-codec.js',
    'assets/js/share.js',
  ]},
  /* Set tags in saved workout templates (#210, user 2026-09-12): the
     template clone chain must carry set tags (builder persist +
     template start), and the builder UI must route the shared tag dialog
     to the builder's sets. */
  'template-set-tags':{files:[
    'assets/js/state.js',
    'assets/js/utilities.js',
  ],inject:SHARE_FACTORY_STUBS},
};

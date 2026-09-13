/* ===== module: state.js ===== */
/** Holds in-memory UI and training state. App data is persisted to localStorage by persistence.js.
    #99 B9: every field the app reads or writes on `state` / `workoutState` is
    declared in the per-domain factories below — they are the authoritative
    shape of app state. Fields that start life "absent" (first assigned later
    by their owning module) are declared with an explicit `undefined`: the
    shape is complete, while the persisted JSON is unchanged (JSON.stringify
    omits undefined values) and every boot-time read keeps its old falsy value.
    Factories return fresh objects (fresh Sets/arrays) so a reset can never
    share mutable state with a previous incarnation. */
    /* Module map (v1.006) — Key: state, workoutState, customDraft, progressionSetup, DEFAULT_PROGRESSION_SETUP, the fresh*() factories. Depends on: none (pure shape factories). */
const DEFAULT_SET_TAGS=['Warmup','Dropset','Full ROM','Slow and controlled','Cheat set','Paused','Assisted','To failure'];
const DEFAULT_EXERCISE_TAG_PRESETS=['Main lift','Accessory','Unilateral','Straight sets','Tempo','Technique','Rehab','To failure'];
/* Library tab UI: filters, selection, user-created exercises. */
function freshLibraryState(){return {query:'',muscles:new Set(),equipment:'',favorites:new Set(),onlyFavorites:false,onlyCustom:false,selected:null,customExercises:[]};}
/* Navigation + routing-adjacent UI state (navigation.js, workout-history.js,
   app-bootstrap.js own these). */
function freshNavState(){return {activeView:'dashboard',workoutDetailReturn:'workout',workoutHistoryOpen:false,workoutEditorOpen:false,exerciseDetailReturn:null,workoutDetailExerciseId:undefined,workoutDetailExerciseReturn:undefined,dashboardPeriod:'week',statsPeriod:'week',logPeriod:'all',topExercisesMode:'volume',muscleVolumeMode:'volume',muscleMapMode:'volume',selectedDashboardDate:null,calendarWeekOffset:0,workoutSubScreen:null,programWorkoutUid:null,returnTo:undefined,settingsPushed:undefined,settingsReturn:undefined,builderReturn:null,sharePreview:null,scroll:{dashboard:0,library:0,'workout:start':0,'workout:editor':0,'workout:complete':0,'workout:history':0,program:0,stats:0,settings:0,detail:0}};}
/* Saved-workout builder draft state (programs.js owns these). */
function freshBuilderState(){return {builderOpen:undefined,savedBuilder:undefined,savedWorkoutId:undefined,savedFilter:undefined};}
const state=Object.assign(freshLibraryState(),freshNavState(),freshBuilderState());
const customDraft = { primary:new Set(), secondary:new Set(), equipment:'', force:'', mechanic:'', tracking:'reps' };
/* Training data + editor targets (workout-*.js, programs.js own these). */
function freshWorkoutData(){return {
  draft:null,
  completed:[],
  templates:[], /* P0 hotfix 2026-09-11 (v0.99e): was cloneWorkoutTemplates() at
    load — but the factories it needs (workout-editor.js) load AFTER state.js,
    so that threw ReferenceError and killed the app. Built-ins are populated in
    app-bootstrap.js init instead, after every script has loaded. */
  tags:[...DEFAULT_SET_TAGS],
  exerciseTagPresets:[...DEFAULT_EXERCISE_TAG_PRESETS],
  tagTarget:null,
  exerciseTagTarget:null,
  supersetTarget:null,
  pickerMode:'draft',
  programWorkoutTarget:null,
  activeProgram:null,
  archivedPrograms:[],
  templateEditTarget:undefined
};}
const workoutState=freshWorkoutData();
/* Canonical progression defaults (efficiency pass 2026-09-12): one
   deep-copyable source. The live object is const (never reassigned), so
   resets copy fresh values INTO it — every reset path shares this. */
const DEFAULT_PROGRESSION_SETUP={threshold:8,incrementType:'lb',incrementValue:5,timeStep:5,treatment:'suggestions',scheme:'rpe',percentOf1RM:75,deloadEvery:0,deloadPct:60,pctWave:false,weeklyPcts:[],weeklyDeloads:[],defaultRange:{preset:'hypertrophy',min:6,max:12,openTop:false,amrap:false},undulating:false,weeklyRanges:[],units:'imperial',statsDefaultMetric:'volume'};
function freshProgressionSetup(){return JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));}
function resetProgressionSetup(){
  const fresh=freshProgressionSetup();
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,fresh);
}
const progressionSetup = freshProgressionSetup();

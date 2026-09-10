/* ===== module: state.js ===== */
/** Holds in-memory UI and training state. App data is persisted to localStorage by persistence.js. */
const state = { query:'', muscles:new Set(), equipment:'', selected:null, customExercises:[], activeView:'dashboard', workoutDetailReturn:'workout', exerciseDetailReturn:null, dashboardPeriod:'week', statsPeriod:'week', selectedDashboardDate:null, calendarWeekOffset:0, scroll:{dashboard:0, library:0, workout:0, program:0, stats:0, settings:0, detail:0} };
const customDraft = { primary:new Set(), secondary:new Set(), equipment:'', force:'', mechanic:'', tracking:'reps' };
const DEFAULT_SET_TAGS=['Warmup','Dropset','Full ROM','Slow and controlled','Cheat set','Paused','Assisted','To failure'];
const DEFAULT_EXERCISE_TAG_PRESETS=['Main lift','Accessory','Unilateral','Straight sets','Tempo','Technique','Rehab','To failure'];
const workoutState = {
  draft: null,
  completed: [],
  templates: cloneWorkoutTemplates(),
  tags: [...DEFAULT_SET_TAGS],
  exerciseTagPresets: [...DEFAULT_EXERCISE_TAG_PRESETS],
  tagTarget: null,
  exerciseTagTarget: null,
  supersetTarget: null,
  pickerMode: 'draft',
  programWorkoutTarget: null,
  activeProgram: null,
  archivedPrograms: []
};
const progressionSetup = { threshold:8, incrementType:'lb', incrementValue:5, timeStep:5, treatment:'suggestions', stallDetection:true, defaultRange:{preset:'hypertrophy',min:6,max:12,openTop:false,amrap:false}, undulating:false, weeklyRanges:[], units:'imperial' };

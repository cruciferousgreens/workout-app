/* ===== module: persistence.js ===== */
/** Durable localStorage persistence for app data: workouts, drafts, templates, programs, settings. */
const PERSIST_KEY='workout-app:v1';
let persistTimer=null;
function collectPersistable(){
  return {
    version:1,
    savedAt:Date.now(),
    completed:workoutState.completed,
    templates:workoutState.templates,
    tags:workoutState.tags,
    exerciseTagPresets:workoutState.exerciseTagPresets,
    activeProgram:workoutState.activeProgram,
    archivedPrograms:workoutState.archivedPrograms,
    draft:workoutState.draft,
    customExercises:state.customExercises,
    favorites:[...state.favorites],
    progressionSetup:progressionSetup,
    dashboardPeriod:state.dashboardPeriod,
    statsPeriod:state.statsPeriod,
    topExercisesMode:state.topExercisesMode,
    showBlindspots:state.showBlindspots
  };
}
function persistNow(){
  try{localStorage.setItem(PERSIST_KEY,JSON.stringify(collectPersistable()));}catch(_){}
  /* Accounts sync hook: flag changed keys for the debounced background push (sync.js).
     Guarded so the local-only path never breaks if sync.js is absent. */
  if(typeof markSyncDirty==='function'){try{markSyncDirty();}catch(_){}}
}
function schedulePersist(){
  clearTimeout(persistTimer);
  persistTimer=setTimeout(persistNow,250);
}
function mergeCustomExercises(){
  if(!Array.isArray(state.customExercises)||!state.customExercises.length)return;
  const ids=new Set(state.customExercises.map(ex=>ex.id));
  exercises=exercises.filter(ex=>!ids.has(ex.id));
  exercises=[...state.customExercises,...exercises];
}
/** Merge saved tag strings onto defaults: defaults first, then saved customs, deduped case-insensitively. */
function mergeTagLists(defaults,saved){
  const seen=new Set(defaults.map(tag=>String(tag).toLowerCase()));
  const merged=[...defaults];
  (Array.isArray(saved)?saved:[]).forEach(tag=>{
    if(typeof tag!=='string'||!tag.trim()||seen.has(tag.toLowerCase()))return;
    seen.add(tag.toLowerCase());merged.push(tag);
  });
  return merged;
}
function restorePersisted(){
  let raw=null;
  try{raw=localStorage.getItem(PERSIST_KEY);}catch(_){return;}
  if(!raw)return;
  let data=null;
  try{data=JSON.parse(raw);}catch(_){return;}
  if(!data||data.version!==1||typeof data!=='object')return;
  SYNCABLE_KEYS.forEach(key=>{if(key in data)setSyncableValue(key,data[key]);});
  if(data.draft&&typeof data.draft==='object'&&data.draft!==null)workoutState.draft=data.draft;
  if(typeof data.showBlindspots==='boolean')state.showBlindspots=data.showBlindspots;
  mergeCustomExercises();
}
/* ===== accounts sync support ===== */
/** Keys mirrored to the Supabase user_data table. The live draft is deliberately
    excluded: it is ephemeral, device-local, in-progress state (see sync.js).
    showBlindspots stays local-only (now unused — blindspots are always visible).
    Appearance (theme) travels as one key so it follows the account; the
    standalone workout-theme* localStorage keys remain the local read path. */
const SYNCABLE_KEYS=['completed','templates','tags','exerciseTagPresets','activeProgram','archivedPrograms','customExercises','favorites','progressionSetup','dashboardPeriod','statsPeriod','topExercisesMode','appearance'];
/** Read one syncable key from live in-memory state. */
function getSyncableValue(key){
  switch(key){
    case 'completed':return workoutState.completed;
    case 'templates':return workoutState.templates;
    case 'tags':return workoutState.tags;
    case 'exerciseTagPresets':return workoutState.exerciseTagPresets;
    case 'activeProgram':return workoutState.activeProgram;
    case 'archivedPrograms':return workoutState.archivedPrograms;
    case 'customExercises':return state.customExercises;
    case 'favorites':return state.favorites instanceof Set?[...state.favorites]:[];
    case 'progressionSetup':return progressionSetup;
    case 'dashboardPeriod':return state.dashboardPeriod;
    case 'statsPeriod':return state.statsPeriod;
    case 'topExercisesMode':return state.topExercisesMode;
    case 'appearance':return (typeof getAppearanceState==='function')?getAppearanceState():undefined;
    default:return undefined;
  }
}
/** Apply one syncable key to live in-memory state, using the same merge guards
    as restorePersisted. Callers re-run mergeCustomExercises() afterwards when
    the customExercises key was applied. */
function setSyncableValue(key,value){
  switch(key){
    case 'completed':if(Array.isArray(value))workoutState.completed=value;break;
    case 'templates':
      /* Templates: built-ins are always present; only the user's own saved
         templates merge in. */
      if(Array.isArray(value)){
        const savedUser=value.filter(t=>t&&!t.builtIn);
        const ids=new Set(savedUser.map(t=>t.id));
        workoutState.templates=[...savedUser,...cloneWorkoutTemplates().filter(t=>!ids.has(t.id))];
      }
      break;
    case 'tags':if(Array.isArray(value))workoutState.tags=mergeTagLists(DEFAULT_SET_TAGS,value);break;
    case 'exerciseTagPresets':if(Array.isArray(value))workoutState.exerciseTagPresets=mergeTagLists(DEFAULT_EXERCISE_TAG_PRESETS,value);break;
    case 'activeProgram':if(value&&typeof value==='object')workoutState.activeProgram=value;break;
    case 'archivedPrograms':if(Array.isArray(value))workoutState.archivedPrograms=value;break;
    case 'customExercises':if(Array.isArray(value))state.customExercises=value;break;
    case 'favorites':if(Array.isArray(value))state.favorites=new Set(value.filter(x=>typeof x==='string'));break;
    case 'progressionSetup':
      if(value&&typeof value==='object'){
        const incoming=value;
        Object.assign(progressionSetup,incoming);
        if(incoming.defaultRange&&typeof incoming.defaultRange==='object')progressionSetup.defaultRange={...progressionSetup.defaultRange,...incoming.defaultRange};
        if(Array.isArray(incoming.weeklyRanges))progressionSetup.weeklyRanges=incoming.weeklyRanges;
      }
      break;
    case 'dashboardPeriod':if(typeof value==='string')state.dashboardPeriod=value;break;
    case 'statsPeriod':if(typeof value==='string')state.statsPeriod=value;break;
    case 'topExercisesMode':if(value==='volume'||value==='sets')state.topExercisesMode=value;break;
    case 'appearance':if(value&&typeof value==='object'&&typeof setAppearanceState==='function')setAppearanceState(value);break;
  }
}
function exportWorkoutData(){
  return JSON.stringify(collectPersistable(),null,2);
}
function downloadWorkoutBackup(){
  const blob=new Blob([exportWorkoutData()],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  const stamp=new Date().toISOString().slice(0,10);
  link.href=url;link.download=`workout-app-backup-${stamp}.json`;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
/* Safety net: flush to localStorage every 5s and on page hide. Explicit schedulePersist()/persistNow() hooks remain the primary path. */
setInterval(persistNow,5000);
window.addEventListener('pagehide',persistNow);

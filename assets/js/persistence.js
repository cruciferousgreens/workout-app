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
    progressionSetup:progressionSetup,
    dashboardPeriod:state.dashboardPeriod,
    statsPeriod:state.statsPeriod
  };
}
function persistNow(){
  try{localStorage.setItem(PERSIST_KEY,JSON.stringify(collectPersistable()));}catch(_){}
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
  if(Array.isArray(data.completed))workoutState.completed=data.completed;
  /* Templates: built-ins are always present; restore only merges in the user's own saved templates. */
  if(Array.isArray(data.templates)){
    const savedUser=data.templates.filter(t=>t&&!t.builtIn);
    const ids=new Set(savedUser.map(t=>t.id));
    workoutState.templates=[...savedUser,...cloneWorkoutTemplates().filter(t=>!ids.has(t.id))];
  }
  /* Tags: merge saved customs onto the defaults (defaults first, deduped) — never a wholesale replace. */
  if(Array.isArray(data.tags))workoutState.tags=mergeTagLists(DEFAULT_SET_TAGS,data.tags);
  if(Array.isArray(data.exerciseTagPresets))workoutState.exerciseTagPresets=mergeTagLists(DEFAULT_EXERCISE_TAG_PRESETS,data.exerciseTagPresets);
  if(data.activeProgram&&typeof data.activeProgram==='object')workoutState.activeProgram=data.activeProgram;
  if(Array.isArray(data.archivedPrograms))workoutState.archivedPrograms=data.archivedPrograms;
  if(data.draft&&typeof data.draft==='object'&&data.draft!==null)workoutState.draft=data.draft;
  if(Array.isArray(data.customExercises))state.customExercises=data.customExercises;
  if(data.progressionSetup&&typeof data.progressionSetup==='object'){
    const incoming=data.progressionSetup;
    Object.assign(progressionSetup,incoming);
    if(incoming.defaultRange&&typeof incoming.defaultRange==='object')progressionSetup.defaultRange={...progressionSetup.defaultRange,...incoming.defaultRange};
    if(Array.isArray(incoming.weeklyRanges))progressionSetup.weeklyRanges=incoming.weeklyRanges;
  }
  if(typeof data.dashboardPeriod==='string')state.dashboardPeriod=data.dashboardPeriod;
  if(typeof data.statsPeriod==='string')state.statsPeriod=data.statsPeriod;
  mergeCustomExercises();
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

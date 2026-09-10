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
function restorePersisted(){
  let raw=null;
  try{raw=localStorage.getItem(PERSIST_KEY);}catch(_){return;}
  if(!raw)return;
  let data=null;
  try{data=JSON.parse(raw);}catch(_){return;}
  if(!data||data.version!==1||typeof data!=='object')return;
  if(Array.isArray(data.completed))workoutState.completed=data.completed;
  if(Array.isArray(data.templates))workoutState.templates=data.templates;
  if(Array.isArray(data.tags)&&data.tags.length)workoutState.tags=data.tags;
  if(Array.isArray(data.exerciseTagPresets)&&data.exerciseTagPresets.length)workoutState.exerciseTagPresets=data.exerciseTagPresets;
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

/* ===== module: persistence.js ===== */
/** Durable localStorage persistence for app data: workouts, drafts, templates, programs, settings. */
/* Module map (v1.006) — Key: PERSIST_KEY, collectPersistable(), schedulePersist()/persistNow(), restorePersisted(), exportWorkoutData(), wipeLocalUserData(). Depends on: state.js field shapes; SYNCABLE_KEYS mirrors the sync engine's merge list. */
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
    /* Saved-workout builder draft (user 2026-09-11): autosaved like the live
       draft, local-only (not in SYNCABLE_KEYS). Backing out of the builder
       never loses work; the Discard button deletes it explicitly. */
    savedBuilder:state.savedBuilder,
    customExercises:state.customExercises,
    favorites:[...state.favorites],
    progressionSetup:progressionSetup,
    dashboardPeriod:state.dashboardPeriod,
    statsPeriod:state.statsPeriod,
    logPeriod:state.logPeriod,
    topExercisesMode:state.topExercisesMode,
    /* v0.99al: saved-workout list filter (muscle pills + "In a program").
       Local-only UI state, like the draft — not synced. */
    savedFilter:{muscles:[...((state.savedFilter&&state.savedFilter.muscles)||[])],inProgram:!!(state.savedFilter&&state.savedFilter.inProgram)}
  };
}
/* #99 A4: persist functions return success/failure — callers (and the user)
   can tell saved from unsaved. A failed local write never marks sync-dirty
   (there's nothing new to push) and surfaces a visible "couldn't save" state
   instead of a silently broken autosave. Storage-blocked contexts (private
   browsing, quota exhaustion) must never crash the app. */
let persistFailStreak=0;
/* #289 (user 2026-09-12): cross-tab reconciliation. Two tabs share the one
   PERSIST_KEY; without coordination a stale tab's debounced autosave (or the
   5s interval persist) can overwrite a newer write from another tab.
   lastSeenSavedAt tracks the newest blob this tab has incorporated (own
   writes, boot read, merges). persistNow() re-reads the blob first: when
   another tab persisted newer state, it is union-merged into live memory
   before this tab writes, so the stale tab adopts rather than clobbers.
   The storage listener stashes the same signal for the (rare) case where
   the re-read itself fails — the event's newValue still carries the blob. */
let lastSeenSavedAt=0;
let pendingExternalBlob=null;
function noteExternalBlob(blob){
  if(!blob||typeof blob!=='object')return;
  const at=Number(blob.savedAt)||0;
  if(at>lastSeenSavedAt&&blob.version===SCHEMA_VERSION)pendingExternalBlob=blob;
}
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
  window.addEventListener('storage',function(e){
    if(!e||e.key!==PERSIST_KEY||!e.newValue)return;
    try{noteExternalBlob(JSON.parse(e.newValue));}catch(_){}
  });
}
/* Union-merge another tab's newer blob into live memory. Record collections
   merge by id — the newer (external) version wins an id conflict, because a
   stale tab must not clobber fresher state. Tags/favorites union. Scalars
   adopt the newer values. The local-only draft, builder draft, and list
   filter stay this tab's (ephemeral per-tab state, unchanged behavior).
   Tombstone-aware (#336): registry keys (completed/templates/
   archivedPrograms) never resurrect a tombstoned id from the incoming blob —
   the delete lives in the sync tombstone registry, which is not part of the
   persist blob, so a plain union would bring back a record the user just
   deleted the moment a stale tab's autosave lands (and the resurrected copy
   would then earn a fresh updatedAt stamp, permanently defeating the sync
   tombstone too). The check reads the persisted registry fresh, so a tab
   that didn't record the delete still honors it. A record strictly newer
   than its tombstone survives (same last-write-wins as the sync merge);
   otherwise the delete stands on both sides. customExercises keeps in-array
   tombstone records: a local tombstone record beats an incoming live copy
   of the same id. */
function mergeExternalBlob(blob){
  if(!blob||typeof blob!=='object'||blob.version!==SCHEMA_VERSION)return false;
  const tombTs=(typeof tombstoneTsFresh==='function')?tombstoneTsFresh:null;
  const tombstoned=typeof isTombstoned==='function'?isTombstoned:function(){return false;};
  /* Numeric per-item revision, mirroring the sync engine's itemRevisionMs. */
  const revMs=function(r){
    if(!r||typeof r!=='object')return null;
    const u=r.updatedAt;
    if(typeof u==='number'&&isFinite(u))return u;
    if(typeof u==='string'){const t=Date.parse(u);return isNaN(t)?null:t;}
    return null;
  };
  /* True when the id's delete stands over this record: tombstoned and not
     strictly newer than the delete. */
  const deletedStands=function(key,r){
    if(!tombTs||!(r&&r.id!=null))return false;
    const ts=tombTs(key,r.id);
    if(!ts)return false;
    const rev=revMs(r);
    return !(rev!=null&&rev>ts);
  };
  const unionById=function(key,local,incoming){
    let base=Array.isArray(local)?local:[];
    /* Drop local records whose delete stands (a stale tab learning of a
       delete another tab recorded). */
    if(tombTs)base=base.filter(function(r){return !deletedStands(key,r);});
    if(!Array.isArray(incoming)||!incoming.length)return base;
    const localIds=new Set(base.map(function(r){return r&&r.id;}));
    const incomingById={};
    incoming.forEach(function(r){if(r&&r.id!=null)incomingById[r.id]=r;});
    const merged=base.map(function(r){
      if(!(r&&r.id!=null&&incomingById[r.id]))return r;
      const inc=incomingById[r.id];
      /* customExercises: a local tombstone record beats an incoming live
         copy; an incoming tombstone propagates over a local live copy. */
      if(key==='customExercises'){
        if(tombstoned(r)&&!tombstoned(inc))return r;
        return inc;
      }
      return inc;
    });
    incoming.forEach(function(r){
      if(!(r&&r.id!=null)||localIds.has(r.id))return;
      /* Never resurrect a tombstoned id from a stale tab's blob. */
      if(deletedStands(key,r))return;
      merged.push(r);
    });
    return merged;
  };
  workoutState.completed=unionById('completed',workoutState.completed,blob.completed);
  workoutState.templates=unionById('templates',workoutState.templates,blob.templates);
  workoutState.archivedPrograms=unionById('archivedPrograms',workoutState.archivedPrograms,blob.archivedPrograms);
  state.customExercises=unionById('customExercises',state.customExercises,blob.customExercises);
  if(blob.activeProgram&&typeof blob.activeProgram==='object')workoutState.activeProgram=blob.activeProgram;
  if(Array.isArray(blob.tags))workoutState.tags=mergeTagLists(workoutState.tags,blob.tags);
  if(Array.isArray(blob.exerciseTagPresets))workoutState.exerciseTagPresets=mergeTagLists(workoutState.exerciseTagPresets,blob.exerciseTagPresets);
  if(Array.isArray(blob.favorites)){
    const favs=state.favorites instanceof Set?state.favorites:new Set();
    blob.favorites.forEach(function(f){if(typeof f==='string')favs.add(f);});
    state.favorites=favs;
  }
  if(blob.progressionSetup&&typeof blob.progressionSetup==='object'){
    try{Object.assign(progressionSetup,blob.progressionSetup);}catch(_){}
    /* #321: migrate pre-toggle blobs (deloadEvery>0 meant "on"). */
    try{normalizeProgression(progressionSetup);}catch(_){}
  }
  /* #321: same migration for stored program progressions. */
  try{
    if(workoutState.activeProgram&&workoutState.activeProgram.progression)normalizeProgression(workoutState.activeProgram.progression);
    (workoutState.archivedPrograms||[]).forEach(function(ap){if(ap&&ap.progression)normalizeProgression(ap.progression);});
  }catch(_){}
  ['dashboardPeriod','statsPeriod','logPeriod','topExercisesMode'].forEach(function(k){
    if(blob[k]!==undefined)state[k]=blob[k];
  });
  try{if(typeof mergeCustomExercises==='function')mergeCustomExercises();}catch(_){}
  return true;
}
function persistNow(){
  /* #289: read-before-write — fold in any newer cross-tab state first. */
  let external=null;
  try{
    const raw=localStorage.getItem(PERSIST_KEY);
    if(raw){
      const current=JSON.parse(raw);
      if(current&&current.version===SCHEMA_VERSION&&(Number(current.savedAt)||0)>lastSeenSavedAt)external=current;
    }
  }catch(_){}
  if(!external&&pendingExternalBlob&&(Number(pendingExternalBlob.savedAt)||0)>lastSeenSavedAt)external=pendingExternalBlob;
  pendingExternalBlob=null;
  if(external){
    mergeExternalBlob(external);
    lastSeenSavedAt=Number(external.savedAt)||lastSeenSavedAt;
  }
  const payload=collectPersistable();
  let ok=false;
  try{localStorage.setItem(PERSIST_KEY,JSON.stringify(payload));ok=true;}catch(_){}
  if(ok){
    persistFailStreak=0;
    lastSeenSavedAt=Math.max(lastSeenSavedAt,Number(payload.savedAt)||0);
    /* Accounts sync hook: flag changed keys for the debounced background push (sync-engine.js).
       Guarded so the local-only path never breaks if the sync scripts are absent.
       Only after a SUCCESSFUL local write — a failed write has no new state to push. */
    if(typeof markSyncDirty==='function'){try{markSyncDirty();}catch(_){}}
  }else{
    persistFailStreak+=1;
    /* First failure toasts immediately; repeats are throttled (~1/min on the
       5s interval) so a broken-storage session isn't a toast firehose. */
    if(persistFailStreak===1||persistFailStreak%12===0){
      if(typeof showToast==='function'){
        try{showToast(persistFailStreak===1
          ?"Couldn't save — storage is unavailable. Your changes are not being saved."
          :"Couldn't save — your changes still aren't being saved.");}catch(_){}
      }
    }
  }
  return ok;
}
/* Debounced save: coalesces rapid writes (every keystroke) into one localStorage write
   250ms later. */
function schedulePersist(){
  clearTimeout(persistTimer);
  persistTimer=setTimeout(persistNow,250);
}
/* Shared local wipe (efficiency pass 2026-09-12): "Delete all data" and
   "Delete account" clear the same state — in-memory FIRST (so the 5s/pagehide
   persist can't resurrect anything), then localStorage (#99 C1). Each caller
   keeps its own remote-wipe / sign-out / reload sequencing. */
function wipeLocalUserData({removeSyncKeys=false}={}){
  workoutState.completed=[];workoutState.templates=[];workoutState.tags=[];workoutState.exerciseTagPresets=[];workoutState.draft=null;workoutState.activeProgram=null;workoutState.archivedPrograms=[];
  workoutState.tagTarget=null;workoutState.exerciseTagTarget=null;workoutState.supersetTarget=null;workoutState.pickerMode='draft';workoutState.programWorkoutTarget=null;workoutState.pickerSwapUid=null;
  /* The saved-workout builder draft is persisted too — leaving it would
     resurrect a builder session through a pre-reload pagehide persist. */
  state.savedBuilder=null;state.builderReturn=null;state.builderOpen=false;
  state.workoutEditorOpen=false;state.savedWorkoutId=null;state.workoutHistoryOpen=false;state.programWorkoutUid=null;
  state.customExercises=[];exercises=exercises.filter(ex=>!ex.custom);
  /* Favorites are user data too: clear them in memory so a pre-reload persist
     can't resurrect them. */
  if(state.favorites&&typeof state.favorites.clear==='function')state.favorites.clear();
  state.query='';state.muscles.clear();state.equipment='';state.onlyFavorites=false;state.onlyCustom=false;state.selected=null;
  resetProgressionSetup();
  try{localStorage.removeItem(PERSIST_KEY);}catch(_){}
  if(removeSyncKeys){
    try{localStorage.removeItem('workout-sync:v1');}catch(_){}
    if(typeof ADOPTED_UID_KEY!=='undefined'){try{localStorage.removeItem(ADOPTED_UID_KEY);}catch(_){}}
    /* #305 (user 2026-09-13): the Supabase session key must die with the rest
       of the account state. signOutAccount() already signs out with
       scope:'local', but if the client never loaded (sb===null) or the call
       threw, the sb-*-auth-token key would survive and silently re-adopt the
       cloud copy after the reload — making the wipe look like a no-op. */
    try{
      const dead=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        /* The session itself (sb-<ref>-auth-token) plus the PKCE code-verifier
           sibling — both are Supabase auth state and neither may survive. */
        if(k&&/^sb-[^-]+-auth-token/.test(k))dead.push(k);
      }
      dead.forEach(k=>{try{localStorage.removeItem(k);}catch(_){}});
    }catch(_){}
  }
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
/* #99 B29: central migration pipeline. The persisted blob carries `version`;
   every boot-time upgrade of that payload lives in MIGRATIONS as
   {id, from, migrate}, applied in order inside restorePersisted BEFORE any
   feature module hydrates. Read-time normalizations (uid backfill in the live
   editor, 'seconds'→'time' in exerciseTracking) deliberately stay at their
   read paths — they also cover share/sync payloads that never pass through
   this pipeline. */
const SCHEMA_VERSION=1;
const MIGRATIONS=[
  /* v0.99al: the saved-workout list filter shape was hardened after it
     shipped — normalize it on the payload, not in the hydrate path. */
  {id:'normalize-saved-filter',from:1,migrate(data){
    if(data.savedFilter&&typeof data.savedFilter==='object'){
      data.savedFilter={
        muscles:Array.isArray(data.savedFilter.muscles)?data.savedFilter.muscles.filter(x=>typeof x==='string'):[],
        inProgram:!!data.savedFilter.inProgram
      };
    }
  }},
  /* #315 (user 2026-09-13): shared workouts used to carry "(shared)" in the
     name; they now carry shared:true and render a SHARED chip. Strip the
     legacy suffix and set the flag. */
  {id:'shared-workout-chip',from:1,migrate(data){
    /* Pre-prod caution (user): "Leg Day (shared)" + "Leg Day (shared 2)" must
       not collapse to two "Leg Day"s — the loser takes neutral (2)/(3). */
    const templates=(data.templates||[]).filter(t=>t&&typeof t.name==='string');
    const taken=new Set(templates.map(t=>t.name));
    templates.forEach(t=>{
      const m=/^(.*) \(shared(?: (\d+))?\)$/.exec(t.name);
      if(!m)return;
      taken.delete(t.name);
      let name=m[1],n=2;
      while(taken.has(name))name=`${m[1]} (${n++})`;
      t.name=name;t.shared=true;taken.add(name);
    });
  }},
];
function runBlobMigrations(data){
  MIGRATIONS.forEach(m=>{try{m.migrate(data);}catch(_){}});
  return data;
}
/* Standalone localStorage keys (kept outside the blob for the pre-paint
   head script): migrated once per boot, before the features that read them. */
const LOCAL_KEY_MIGRATIONS=[
  /* Early builds stored the Catppuccin/Rosé Pine working names. */
  {id:'legacy-theme-names',migrate(){
    try{
      const n=localStorage.getItem('workout-theme-name');
      if(n==='latte')localStorage.setItem('workout-theme-name','rosepine');
      else if(n==='frappe')localStorage.setItem('workout-theme-name','macchiato');
    }catch(_){}
  }},
];
function runLocalKeyMigrations(){LOCAL_KEY_MIGRATIONS.forEach(m=>{try{m.migrate();}catch(_){}});}
/* #99 A5: a corrupt/unparseable blob is QUARANTINED under its own key —
   never silently dropped. Booting to defaults is safe because the 5s/pagehide
   autosave only ever writes PERSIST_KEY, so the quarantined copy survives
   until the user decides what to do with it. Nothing quarantined is ever
   auto-adopted back into state. */
let corruptQuarantineKey=null;
function quarantineCorruptBlob(raw){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  corruptQuarantineKey=PERSIST_KEY+':corrupt-'+stamp;
  try{localStorage.setItem(corruptQuarantineKey,raw);}catch(_){corruptQuarantineKey=null;}
  if(!corruptQuarantineKey)return; /* storage itself is broken — nothing more to do */
  /* Recovery prompt, matching the app's dialog patterns. Export keeps the
     quarantine (the user may export first, then decide); Discard removes the
     quarantined copy; closing the dialog keeps it set aside safely. */
  const dlg=typeof $==='function'?$('#corruptDataDialog'):null;
  if(dlg&&!dlg.open){try{dlg.showModal();}catch(_){}}
}
/* Boot: reads PERSIST_KEY, quarantines corrupt blobs for user download, runs
   migrations, then hydrates state + workoutState. */
function restorePersisted(){
  let raw=null;
  try{raw=localStorage.getItem(PERSIST_KEY);}catch(_){return;}
  if(!raw)return;
  let data=null;
  try{data=JSON.parse(raw);}catch(_){quarantineCorruptBlob(raw);return;}
  if(!data||data.version!==SCHEMA_VERSION||typeof data!=='object'){quarantineCorruptBlob(raw);return;}
  lastSeenSavedAt=Number(data.savedAt)||0; /* #289: boot read counts as seen */
  runBlobMigrations(data);
  SYNCABLE_KEYS.forEach(key=>{if(key in data)setSyncableValue(key,data[key]);});
  if(data.draft&&typeof data.draft==='object'&&data.draft!==null)workoutState.draft=data.draft;
  if(data.savedBuilder&&typeof data.savedBuilder==='object'&&data.savedBuilder!==null)state.savedBuilder=data.savedBuilder;
  /* v0.99al: the saved-workout list filter (local-only); shape normalized by
     the 'normalize-saved-filter' migration above. */
  if(data.savedFilter&&typeof data.savedFilter==='object'&&data.savedFilter!==null)state.savedFilter=data.savedFilter;
  mergeCustomExercises();
}
/* ===== accounts sync support ===== */
/** Keys mirrored to the Supabase user_data table. The live draft is deliberately
    excluded: it is ephemeral, device-local, in-progress state (see sync-engine.js).
    Appearance (theme) travels as one key so it follows the account; the
    standalone workout-theme* localStorage keys remain the local read path. */
const SYNCABLE_KEYS=['completed','templates','tags','exerciseTagPresets','activeProgram','archivedPrograms','customExercises','favorites','progressionSetup','dashboardPeriod','statsPeriod','logPeriod','topExercisesMode','appearance'];
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
    case 'logPeriod':return state.logPeriod;
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
      /* Templates: built-ins were removed 2026-09-13 — only the user's own
         saved templates merge in; any persisted built-ins are dropped. */
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
    case 'logPeriod':if(typeof value==='string')state.logPeriod=value;break;
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
/* #99 A5 recovery-prompt wiring (dialog markup lives in index.html, next to
   the other custom-dialogs). Export downloads the raw quarantined string and
   leaves the quarantine in place; Discard removes it. Closing via × keeps the
   copy set aside — it survives until the user decides. */
function corruptDataDownload(){
  if(!corruptQuarantineKey)return;
  let raw=null;
  try{raw=localStorage.getItem(corruptQuarantineKey);}catch(_){}
  const blob=new Blob([raw||''],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=`workout-app-corrupt-data-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
$('#corruptDataExport')?.addEventListener('click',()=>{
  corruptDataDownload();
  if(typeof showToast==='function'){try{showToast('Damaged copy exported.');}catch(_){}}
  /* Stay open so "Discard it" is still one tap away after exporting. */
});
$('#corruptDataDiscard')?.addEventListener('click',()=>{
  if(corruptQuarantineKey){try{localStorage.removeItem(corruptQuarantineKey);}catch(_){}}
  corruptQuarantineKey=null;
  $('#corruptDataDialog')?.close();
  if(typeof showToast==='function'){try{showToast('Damaged copy discarded.');}catch(_){}}
});
$('#closeCorruptData')?.addEventListener('click',()=>$('#corruptDataDialog')?.close());
/* Safety net: flush to localStorage every 5s and on page hide. Explicit schedulePersist()/persistNow() hooks remain the primary path. */
setInterval(persistNow,5000);
window.addEventListener('pagehide',persistNow);

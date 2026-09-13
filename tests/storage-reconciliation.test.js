'use strict';
/* #289 (user 2026-09-12): storage-event reconciliation — a stale tab must not
   overwrite newer localStorage state. persistNow() re-reads the blob and
   union-merges newer cross-tab state before writing. The persistence module
   runs in a vm sandbox; the captured storage-event handler simulates the
   other tab's write. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const KEY='workout-app:v1';

function loadTab(initialBlob){
  const src=fs.readFileSync(path.join(ROOT,'assets/js/persistence.js'),'utf8');
  const store=initialBlob?{[KEY]:JSON.stringify(initialBlob)}:{};
  const listeners={};
  const sandbox={
    window:{addEventListener(ev,fn){listeners[ev]=fn;}},
    localStorage:{
      getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
      setItem(k,v){store[k]=String(v);},
      removeItem(k){delete store[k];},
    },
    $(){return null;},
    setTimeout(){return 0;},
    clearTimeout(){},
    setInterval(){return 0;},
    clearInterval(){},
    /* state.js collaborators referenced by restorePersisted's merge path */
    cloneWorkoutTemplates(){return [];},
    DEFAULT_SET_TAGS:[],
    DEFAULT_EXERCISE_TAG_PRESETS:[],
    document:{},
    workoutState:{completed:[],templates:[],tags:[],exerciseTagPresets:[],draft:null,activeProgram:null,archivedPrograms:[]},
    state:{customExercises:[],favorites:new Set(),savedBuilder:null,dashboardPeriod:'week',statsPeriod:'week',logPeriod:'week',topExercisesMode:'x',savedFilter:{muscles:[],inProgram:false}},
    progressionSetup:{},
  };
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'persistence.js'});
  assert.ok(listeners.storage,'storage listener registered (#289)');
  const api={
    store,listeners,sandbox,
    restore(){vm.runInContext('restorePersisted()',sandbox);},
    persist(){return vm.runInContext('persistNow()',sandbox);},
    blob(){const raw=store[KEY];return raw?JSON.parse(raw):null;},
    /* Simulate another tab's write arriving via the storage event. */
    externalWrite(blob){
      const raw=JSON.stringify(blob);
      store[KEY]=raw;
      listeners.storage({key:KEY,newValue:raw});
    },
  };
  return api;
}

const W1={id:'workout-1',name:'W1',exercises:[]};
const W2={id:'workout-2',name:'W2',exercises:[]};

describe('#289 cross-tab reconciliation',()=>{
  it('a stale tab merges newer cross-tab records instead of overwriting them',()=>{
    const tab=loadTab({version:1,savedAt:100,completed:[W1],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.restore();
    /* The other tab finishes a workout (savedAt 200) while this tab idles. */
    tab.externalWrite({version:1,savedAt:200,completed:[W1,W2],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    /* This tab's 5s interval persist fires with stale in-memory state. */
    assert.equal(tab.persist(),true);
    const written=tab.blob();
    const ids=written.completed.map(w=>w.id).sort();
    assert.deepEqual(ids,['workout-1','workout-2'],'both records survive');
    assert.ok(written.savedAt>200,'the merged write is the newest');
  });
  it('without external writes the persist path is unchanged',()=>{
    const tab=loadTab({version:1,savedAt:100,completed:[W1],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.restore();
    tab.sandbox.workoutState.draft={name:'live draft'};
    assert.equal(tab.persist(),true);
    const written=tab.blob();
    assert.deepEqual(written.completed.map(w=>w.id),['workout-1']);
    assert.equal(written.draft.name,'live draft','local draft preserved');
  });
  it('an id conflict keeps the newer (external) record version',()=>{
    const tab=loadTab({version:1,savedAt:100,completed:[W1],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.restore();
    const renamed={id:'workout-1',name:'W1 renamed elsewhere',exercises:[]};
    tab.externalWrite({version:1,savedAt:200,completed:[renamed],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.persist();
    assert.equal(tab.blob().completed[0].name,'W1 renamed elsewhere');
  });
  it('does not re-merge the same external blob twice',()=>{
    const tab=loadTab({version:1,savedAt:100,completed:[W1],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.restore();
    tab.externalWrite({version:1,savedAt:200,completed:[W1,W2],templates:[],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.persist();
    const first=tab.blob().savedAt;
    tab.persist();
    const second=tab.blob().savedAt;
    assert.ok(second>=first,'second persist just re-writes merged state');
    assert.deepEqual(tab.blob().completed.map(w=>w.id).sort(),['workout-1','workout-2']);
  });
  it('templates and custom exercises union by id too',()=>{
    const tab=loadTab({version:1,savedAt:100,completed:[],templates:[{id:'template-1',name:'T1',exercises:[]}],archivedPrograms:[],customExercises:[],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.restore();
    tab.externalWrite({version:1,savedAt:200,completed:[],templates:[{id:'template-1',name:'T1',exercises:[]},{id:'template-2',name:'T2',exercises:[]}],archivedPrograms:[],customExercises:[{id:'custom-a',name:'A'}],tags:[],exerciseTagPresets:[],favorites:[]});
    tab.persist();
    const written=tab.blob();
    assert.deepEqual(written.templates.map(t=>t.id).sort(),['template-1','template-2']);
    assert.deepEqual(written.customExercises.map(e=>e.id),['custom-a']);
  });
});

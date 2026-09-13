'use strict';
/* Role: cross-tab delete-memory (#336).
   mergeExternalBlob (persistence.js read-before-write, #289) used to run a
   plain id-union with no tombstone awareness: a stale tab's autosave blob
   resurrected a just-deleted saved workout / log / program the moment it
   landed, and the resurrected copy then earned a fresh updatedAt stamp that
   permanently defeated the sync tombstone. These tests drive the real
   noteTombstone + tombstoneTsFresh + mergeExternalBlob. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const REPO_ROOT=path.join(__dirname,'..');

function loadBoth(){
  const store=new Map();
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k),
    clear:()=>store.clear(),
  };
  const sandbox={
    console:console,
    localStorage:localStorage,
    window:{addEventListener:function(){}},
    navigator:{onLine:true},
    // Minimal DOM helper stub: persistence.js wires a click handler at load.
    $:function(){return null;},
    setTimeout:setTimeout,clearTimeout:clearTimeout,
    // 5s autosave interval: stubbed to a no-op so tests don't hang.
    setInterval:function(){return 0;},clearInterval:function(){},
    Date:Date,JSON:JSON,Math:Math,Number:Number,String:String,Array:Array,
    Object:Object,Map:Map,Set:Set,Promise:Promise,isFinite:isFinite,isNaN:isNaN,
  };
  sandbox.globalThis=sandbox;
  // App globals the modules expect.
  sandbox.workoutState={completed:[],templates:[],tags:[],exerciseTagPresets:[],
    activeProgram:null,archivedPrograms:[],draft:null};
  sandbox.state={customExercises:[],favorites:new Set(),muscles:new Set(),
    savedBuilder:null,savedFilter:null,dashboardPeriod:'week',statsPeriod:'week',
    logPeriod:'week',topExercisesMode:'weight'};
  sandbox.exercises=[];
  sandbox.progressionSetup={};
  sandbox.SYNCABLE_KEYS=['completed','templates','archivedPrograms','customExercises'];
  vm.createContext(sandbox);
  for(const rel of ['assets/js/sync-engine.js','assets/js/persistence.js']){
    const code=fs.readFileSync(path.join(REPO_ROOT,rel),'utf8');
    vm.runInContext(code,sandbox,{filename:rel});
  }
  return {sandbox,store};
}

function tpl(id,name,updatedAt){
  const t={id:id,name:name,exercises:[]};
  if(updatedAt!==undefined)t.updatedAt=updatedAt;
  return t;
}

describe('mergeExternalBlob — tombstone-aware cross-tab merge (#336)',()=>{
  it('a stale tab blob does NOT resurrect a just-deleted saved workout',()=>{
    const {sandbox}=loadBoth();
    const D0=Date.now();
    // Tab A state after the user deletes t1.
    sandbox.workoutState.templates=[tpl('t2','Push Day')];
    sandbox.Sync.noteTombstone('templates','t1');
    assert.ok(Date.now()>=D0);
    // Stale Tab B's blob still carries t1 (plus a t2 edit).
    const staleBlob={version:1,savedAt:Date.now()+1000,
      completed:[],archivedPrograms:[],
      templates:[tpl('t1','Leg Day',D0-86400000),tpl('t2','Push Day v2',D0-86400000)]};
    const ok=vm.runInContext('mergeExternalBlob('+JSON.stringify(staleBlob).replace(/</g,'\\u003c')+')',sandbox);
    assert.equal(ok,true);
    const ids=sandbox.workoutState.templates.map(t=>t.id);
    assert.deepEqual(ids,['t2'],'t1 must stay deleted');
    assert.equal(sandbox.workoutState.templates[0].name,'Push Day v2','live edits still merge');
  });

  it('the stale tab itself drops the id when it merges the deleting tab blob',()=>{
    const {sandbox,store}=loadBoth();
    // Tab A deleted t1 and persisted the tombstone to the SHARED localStorage.
    sandbox.Sync.noteTombstone('templates','t1');
    const tombRaw=store.get('workout-sync:v1');
    assert.ok(tombRaw&&tombRaw.includes('t1'),'tombstone persisted');
    // Now simulate Tab B: empty in-memory registry, t1 still live locally.
    // (Fresh context sharing the same localStorage.)
    const b=loadBoth();
    // point B at A's localStorage content
    for(const [k,v] of store)b.store.set(k,v);
    b.sandbox.workoutState.templates=[tpl('t1','Leg Day',Date.now()-86400000),tpl('t2','Push Day')];
    // Tab A's newer blob (t1 gone) arrives.
    const aBlob={version:1,savedAt:Date.now()+1000,completed:[],archivedPrograms:[],
      templates:[tpl('t2','Push Day')]};
    vm.runInContext('mergeExternalBlob('+JSON.stringify(aBlob).replace(/</g,'\\u003c')+')',b.sandbox);
    assert.deepEqual(b.sandbox.workoutState.templates.map(t=>t.id),['t2'],
      'Tab B honors the fresh tombstone even though it never recorded the delete');
  });

  it('a record strictly newer than the tombstone survives (last-write-wins)',()=>{
    const {sandbox}=loadBoth();
    const D0=Date.now();
    sandbox.Sync.noteTombstone('templates','t1');
    // Incoming copy edited AFTER the delete: genuine newer edit wins.
    const blob={version:1,savedAt:Date.now()+1000,completed:[],archivedPrograms:[],
      templates:[tpl('t1','Leg Day v2',D0+5000)]};
    vm.runInContext('mergeExternalBlob('+JSON.stringify(blob).replace(/</g,'\\u003c')+')',sandbox);
    assert.deepEqual(sandbox.workoutState.templates.map(t=>t.id),['t1']);
    assert.equal(sandbox.workoutState.templates[0].name,'Leg Day v2');
  });

  it('same-or-older edits lose to the delete',()=>{
    const {sandbox}=loadBoth();
    const D0=Date.now();
    sandbox.Sync.noteTombstone('templates','t1');
    const blob={version:1,savedAt:Date.now()+1000,completed:[],archivedPrograms:[],
      templates:[tpl('t1','Leg Day',D0-1000)]};
    vm.runInContext('mergeExternalBlob('+JSON.stringify(blob).replace(/</g,'\\u003c')+')',sandbox);
    assert.deepEqual(sandbox.workoutState.templates.map(t=>t.id),[],
      'stale copy must not resurrect');
  });

  it('customExercises: local tombstone record beats an incoming live copy',()=>{
    const {sandbox}=loadBoth();
    const now=Date.now();
    sandbox.state.customExercises=[{id:'cx1',name:'My Move',deletedAt:now-5000}];
    const blob={version:1,savedAt:now+1000,completed:[],archivedPrograms:[],templates:[],
      customExercises:[{id:'cx1',name:'My Move',updatedAt:now-86400000}]};
    vm.runInContext('mergeExternalBlob('+JSON.stringify(blob).replace(/</g,'\\u003c')+')',sandbox);
    const rec=sandbox.state.customExercises.find(e=>e.id==='cx1');
    assert.ok(rec&&rec.deletedAt,'tombstone record kept, live copy rejected');
  });

  it('plain union still works with no tombstones',()=>{
    const {sandbox}=loadBoth();
    sandbox.workoutState.templates=[tpl('t1','A')];
    const blob={version:1,savedAt:Date.now()+1000,completed:[],archivedPrograms:[],
      templates:[tpl('t1','A'),tpl('t2','B')]};
    vm.runInContext('mergeExternalBlob('+JSON.stringify(blob).replace(/</g,'\\u003c')+')',sandbox);
    assert.deepEqual(sandbox.workoutState.templates.map(t=>t.id),['t1','t2']);
  });

  it('tombstoneTsFresh returns 0 for unknown ids and non-registry keys',()=>{
    const {sandbox}=loadBoth();
    assert.equal(sandbox.Sync.tombstoneTsFresh('templates','nope'),0);
    assert.equal(sandbox.Sync.tombstoneTsFresh('tags','x'),0);
    sandbox.Sync.noteTombstone('templates','t1');
    assert.ok(sandbox.Sync.tombstoneTsFresh('templates','t1')>0);
  });
});

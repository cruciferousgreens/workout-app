'use strict';
/* #315 (user 2026-09-13): shared workouts render a SHARED chip instead of a
   "(shared)" name suffix. The template carries shared:true; re-accept
   collisions dedupe with a neutral (2)/(3); a boot migration strips the
   legacy suffix from existing libraries and sets the flag. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const shareJs=fs.readFileSync(path.join(ROOT,'assets/js/share.js'),'utf8');
const savedJs=fs.readFileSync(path.join(ROOT,'assets/js/saved-workouts.js'),'utf8');

function loadUtilities(){
  const src=fs.readFileSync(path.join(ROOT,'assets/js/utilities.js'),'utf8');
  const sandbox={window:{},document:{},localStorage:{getItem:()=>null,setItem(){}}};
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'utilities.js'});
  return sandbox;
}
function loadPersistence(){
  const src=fs.readFileSync(path.join(ROOT,'assets/js/persistence.js'),'utf8');
  const store={};
  const sandbox={
    window:{addEventListener(){}},
    localStorage:{
      getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
      setItem(k,v){store[k]=String(v);},
      removeItem(k){delete store[k];},
      key(i){return Object.keys(store)[i]||null;},
      get length(){return Object.keys(store).length;},
    },
    $(){return null;},
    setTimeout(){return 0;},clearTimeout(){},
    setInterval(){return 0;},clearInterval(){},
    cloneWorkoutTemplates(){return [];},
    DEFAULT_SET_TAGS:[],DEFAULT_EXERCISE_TAG_PRESETS:[],
    document:{},
    'ADOPTED_UID_KEY':'adopted-uid',
    workoutState:{completed:[],templates:[],tags:[],exerciseTagPresets:[],draft:null,activeProgram:null,archivedPrograms:[]},
    state:{customExercises:[],favorites:new Set(),muscles:new Set(),savedBuilder:null},
    exercises:[],
    progressionSetup:{},
    resetProgressionSetup(){},
  };
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'persistence.js'});
  return sandbox;
}

describe('#315 uniqueSuffixedName numbered mode (shared templates)',()=>{
  it('keeps the base name when untaken',()=>{
    const u=loadUtilities();
    assert.equal(u.uniqueSuffixedName('Leg Day',['Push Day'],true),'Leg Day');
  });
  it('dedupes collisions with (2), (3) — no "(shared)" text',()=>{
    const u=loadUtilities();
    assert.equal(u.uniqueSuffixedName('Leg Day',['Leg Day'],true),'Leg Day (2)');
    assert.equal(u.uniqueSuffixedName('Leg Day',['Leg Day','Leg Day (2)'],true),'Leg Day (3)');
  });
  it('legacy mode (programs) still uses " (shared)"',()=>{
    const u=loadUtilities();
    assert.equal(u.uniqueSuffixedName('Leg Day',['Leg Day']),'Leg Day (shared)');
    assert.equal(u.uniqueSuffixedName('Leg Day',['Leg Day','Leg Day (shared)']),'Leg Day (shared 2)');
  });
});

describe('#315 addSharedTemplateToLibrary flags the template as shared',()=>{
  it('mints shared:true on the new template',()=>{
    const m=shareJs.match(/function addSharedTemplateToLibrary\(payload\)\{[\s\S]*?\n    \}/);
    assert.ok(m,'addSharedTemplateToLibrary body found');
    assert.ok(m[0].includes('shared:true'),'template carries the shared flag');
  });
  it('dedupes with the numbered suffix, not " (shared)"',()=>{
    const m=shareJs.match(/function addSharedTemplateToLibrary\(payload\)\{[\s\S]*?\n    \}/);
    assert.ok(/uniqueSuffixedName\([\s\S]*?,\s*true\)/.test(m[0]),
      'shared-template accept passes numbered=true');
    assert.ok(!m[0].includes('(shared)'),'no "(shared)" text in the accept path');
  });
});

describe('#315 migration strips legacy " (shared)" names',()=>{
  it('sets shared:true and strips the suffix',()=>{
    const sb=loadPersistence();
    sb.data={version:1,templates:[
      {id:'a',name:'Leg Day (shared)',exercises:[]},
      {id:'b',name:'Push (shared 2)',exercises:[]},
      {id:'c',name:'Pull Day',exercises:[]},
      {id:'d',name:'My (shared) story',exercises:[]},
    ]};
    vm.runInContext('runBlobMigrations(data)',sb);
    const t=sb.data.templates;
    assert.equal(t[0].name,'Leg Day');assert.equal(t[0].shared,true);
    assert.equal(t[1].name,'Push');assert.equal(t[1].shared,true);
    assert.equal(t[2].name,'Pull Day');assert.ok(!t[2].shared);
    assert.equal(t[3].name,'My (shared) story','mid-name parens are not a suffix');
    assert.ok(!t[3].shared);
  });
  it('is idempotent — a second run changes nothing',()=>{
    const sb=loadPersistence();
    sb.data={version:1,templates:[{id:'a',name:'Leg Day',shared:true,exercises:[]}]};
    vm.runInContext('runBlobMigrations(data)',sb);
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.equal(sb.data.templates[0].name,'Leg Day');
    assert.equal(sb.data.templates[0].shared,true);
  });
  it('never collapses names — collisions take neutral (2)/(3)',()=>{
    const sb=loadPersistence();
    sb.data={version:1,templates:[
      {id:'a',name:'Leg Day (shared)',exercises:[]},
      {id:'b',name:'Leg Day (shared 2)',exercises:[]},
      {id:'c',name:'Leg Day',exercises:[]},
    ]};
    vm.runInContext('runBlobMigrations(data)',sb);
    const names=sb.data.templates.map(t=>t.name).sort();
    assert.deepEqual(names,['Leg Day','Leg Day (2)','Leg Day (3)']);
    assert.ok(sb.data.templates[0].shared&&sb.data.templates[1].shared,'migrated pair carries the flag');
    assert.ok(!sb.data.templates[2].shared,'pre-existing plain name is untouched');
  });
});

describe('#315 SHARED chip renders in the library',()=>{
  it('saved-workout list cards carry the Shared chip',()=>{
    const i=savedJs.indexOf('item.shared');
    assert.ok(i!==-1,'list chip references item.shared');
    assert.ok(savedJs.slice(i,i+140).includes('>Shared</span>'),'list chip says Shared');
  });
  it('saved-workout detail header carries the Shared badge',()=>{
    const i=savedJs.indexOf('t.shared?');
    assert.ok(i!==-1,'detail badge references t.shared');
    assert.ok(savedJs.slice(i,i+140).includes('>Shared</span>'),'detail badge says Shared');
  });
});

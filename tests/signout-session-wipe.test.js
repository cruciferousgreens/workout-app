'use strict';
/* #305 (user 2026-09-13): sign-out must kill the Supabase session key even when
   the logout network call fails. signOutAccount() used sb.auth.signOut() with
   the default global scope — a failed /auth/v1/logout left sb-*-auth-token in
   place, and after the reload the live session silently re-adopted the whole
   cloud copy, so the wipe looked like a no-op. Two pins:
   (1) signOutAccount signs out with scope:'local' (no network call);
   (2) wipeLocalUserData({removeSyncKeys:true}) removes every sb-*-auth-token
   key (belt-and-braces for sb===null or a signOut throw). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const syncAuthJs=fs.readFileSync(path.join(ROOT,'assets/js/sync-auth.js'),'utf8');

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
    setTimeout(){return 0;},
    clearTimeout(){},
    setInterval(){return 0;},
    clearInterval(){},
    cloneWorkoutTemplates(){return [];},
    DEFAULT_SET_TAGS:[],
    DEFAULT_EXERCISE_TAG_PRESETS:[],
    document:{},
    ADOPTED_UID_KEY:'adopted-uid',
    workoutState:{completed:[],templates:[],tags:[],exerciseTagPresets:[],draft:null,activeProgram:null,archivedPrograms:[]},
    state:{customExercises:[],favorites:new Set(),muscles:new Set(),savedBuilder:null},
    exercises:[],
    progressionSetup:{},
    resetProgressionSetup(){},
  };
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'persistence.js'});
  return {
    store,
    wipe(opts){vm.runInContext(`wipeLocalUserData(${JSON.stringify(opts||{})})`,sandbox);},
  };
}

describe('#305: signOutAccount uses a local-scope sign-out (no network dependency)',()=>{
  it("calls sb.auth.signOut with scope:'local'",()=>{
    const m=syncAuthJs.match(/async function signOutAccount\(\)\{[\s\S]*?\n      \}/);
    assert.ok(m,'signOutAccount body found');
    assert.ok(m[0].includes("signOut({scope:'local'})"),
      'local-scope sign-out clears the session from storage without a network call');
  });
  it('does not use the default global signOut()',()=>{
    const m=syncAuthJs.match(/async function signOutAccount\(\)\{[\s\S]*?\n      \}/);
    assert.ok(!/await sb\.auth\.signOut\(\);/.test(m[0]),
      'no bare signOut() whose /auth/v1/logout failure would leave the session behind');
  });
});

describe('#305: wipeLocalUserData({removeSyncKeys:true}) removes Supabase session keys',()=>{
  it('removes sb-*-auth-token and the code-verifier sibling, keeps unrelated keys',()=>{
    const t=loadPersistence();
    t.store['workout-app:v1']='{}';
    t.store['workout-sync:v1']='{}';
    t.store['adopted-uid']='uid-1';
    t.store['sb-abcdef123456-auth-token']=JSON.stringify({session:'live'});
    t.store['sb-abcdef123456-auth-token-code-verifier']='verifier';
    t.store['unrelated']='keep-me';
    t.wipe({removeSyncKeys:true});
    const keys=Object.keys(t.store);
    assert.deepEqual(keys,['unrelated'],
      'session + sync keys gone, unrelated keys untouched');
  });
  it('without removeSyncKeys the session key is left alone (delete-all stays signed in)',()=>{
    const t=loadPersistence();
    t.store['sb-abcdef123456-auth-token']=JSON.stringify({session:'live'});
    t.wipe({});
    assert.ok(t.store['sb-abcdef123456-auth-token'],
      'plain wipeLocalUserData() does not sign the user out');
  });
});

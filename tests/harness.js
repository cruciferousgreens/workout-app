'use strict';
/* Test harness: loads app sources into this process's global scope — the same
   shared-global model as the app's classic <script> tags — with stubbed
   browser globals. Zero dependencies.

   Usage in a *.test.js file:
     const {loadRole}=require('./harness');
     const {topSetForSession, progressionForExercise, workoutState}=loadRole('progression-logic');
     // or with injected globals: loadRole('csv-import',{globals:{exercises:fixtureCatalog}})

   G2 (no load-time exceptions) is enforced here: a source file that throws
   at evaluation fails the load with a tagged error, which fails the test
   file's process. Each test file runs in its own process under
   `node --test`, so global state never leaks between files. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const REPO_ROOT=path.resolve(__dirname,'..');
const MODULE_MAP=require('./module-map');
const {makeStubs}=require('./stubs');

function loadRole(role,opts={}){
  const entry=MODULE_MAP[role];
  if(!entry)throw new Error(`unknown test role: ${role}`);
  // Browser stubs BEFORE sources evaluate. Assign defensively: the host may
  // already own a name (e.g. Node's global navigator is getter-only).
  for(const [k,v] of Object.entries(makeStubs())){
    try{globalThis[k]=v;}catch(_){/* host-owned global; leave it */}
  }
  for(const rel of entry.files){
    const code=fs.readFileSync(path.join(REPO_ROOT,rel),'utf8');
    try{
      vm.runInThisContext(code,{filename:rel});
    }catch(err){
      const e=new Error(`[G2] ${rel} threw at load: ${err&&err.message}`);
      e.cause=err;
      throw e;
    }
  }
  if(entry.inject)vm.runInThisContext(entry.inject,{filename:`<${role} inject>`});
  if(opts.globals)Object.assign(globalThis,opts.globals);
  /* Return a resolver, not globalThis: sources declare top-level const/let
     (workoutState, progressionSetup, …) which live in the global LEXICAL
     environment — visible as bare identifiers but NOT as globalThis
     properties. Indirect eval resolves them the way the app's later
     <script> tags do. */
  const indirectEval=eval;
  return new Proxy(Object.create(null),{
    get:(_,name)=>{
      if(typeof name!=='string')return undefined;
      return indirectEval(name);
    },
    has:(_,name)=>{try{indirectEval(`typeof ${String(name)}`);return true;}catch(_){return false;}},
  });
}

module.exports={loadRole,REPO_ROOT,MODULE_MAP};

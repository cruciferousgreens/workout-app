#!/usr/bin/env node
'use strict';
/* Orchestrator: runs every tests/*.test.js as a node:test child process
   (one process per file, so global state can't leak between roles), prints a
   one-line-per-file summary, and exits non-zero on any failure.

   G1 enforcement: a file fails the gate when its process exits non-zero OR
   when it contains a skipped test (.skip / test.skip / describe.skip / it.skip
   — skips are not allowed to ship green). */
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const SKIP_RE=/(^|[^\w$.])(test|describe|it)\.skip\s*\(|\.skip\s*\(\s*['"`]/;
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort();
if(!files.length){console.error('run.js: no *.test.js files found');process.exit(1);}

let failed=0, totalPass=0, totalFail=0;
for(const f of files){
  const full=path.join(__dirname,f);
  const src=fs.readFileSync(full,'utf8');
  if(SKIP_RE.test(src)){
    console.log(`FAIL ${f} — skipped tests are not allowed (G1)`);
    failed++;
    continue;
  }
  const r=spawnSync(process.execPath,['--test',full],{encoding:'utf8',timeout:120000});
  const out=(r.stdout||'')+(r.stderr||'');
  const pass=Number((out.match(/^ℹ pass (\d+)/m)||[])[1]||0);
  const fail=Number((out.match(/^ℹ fail (\d+)/m)||[])[1]||0);
  totalPass+=pass; totalFail+=fail;
  if(r.status===0&&fail===0){
    console.log(`PASS ${f} — ${pass} passing`);
  }else{
    failed++;
    console.log(`FAIL ${f} — ${pass} passing, ${fail} failing (exit ${r.status})`);
    const notOk=out.split('\n').filter(l=>l.startsWith('not ok')).slice(0,10);
    for(const l of notOk)console.log(`      ${l}`);
  }
}
console.log(`\n${files.length-failed}/${files.length} test files green — ${totalPass} assertions passing, ${totalFail} failing`);
process.exit(failed?1:0);

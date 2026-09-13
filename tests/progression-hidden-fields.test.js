'use strict';
/* #295 (user 2026-09-12): the program form's "% of 1RM" row showed even with
   RPE-based selected. Root cause was NOT the CSS ([hidden] guard has existed
   since the stylesheet was created) — programs.js targeted a stale id
   (#progressionPercent1RMField, which exists nowhere) instead of the real
   #progressionPctRow, so .hidden was never set. Also pins the notch-label
   ellipsis guard for long labels like "Deload every N weeks". */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const programsJs=fs.readFileSync(path.join(ROOT,'assets/js/programs.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

describe('#295 % of 1RM row hides under RPE-based',()=>{
  it('programs.js toggles the real #progressionPctRow id',()=>{
    assert.ok(programsJs.includes("$('#progressionPctRow')"),'targets #progressionPctRow');
    assert.ok(!programsJs.includes('progressionPercent1RMField'),'stale id is gone');
  });
  it('the #progressionPctRow element exists in index.html',()=>{
    assert.ok(html.includes('id="progressionPctRow"'),'#progressionPctRow exists');
  });
  it('the row hides unless the scheme is %1RM, help text follows',()=>{
    assert.ok(programsJs.includes("pctRow.hidden=scheme!=='onerm'"),'hidden unless onerm');
    assert.ok(programsJs.includes("classList.contains('field-help')"),'help sibling follows');
  });
  it('a global [hidden] guard exists so class display rules never win',()=>{
    assert.ok(css.includes('[hidden] { display: none !important; }'),'guard present');
  });
  it('notch labels cannot wrap/clip (long labels get ellipsis)',()=>{
    const m=css.match(/\.rule-field > span:first-child \{([^}]*)\}/);
    assert.ok(m,'notch rule present');
    assert.ok(m[1].includes('text-overflow: ellipsis'),'ellipsis guard');
    assert.ok(m[1].includes('white-space: nowrap'),'no wrap');
  });
  it('the row defaults to hidden in markup (first paint correct before any sync)',()=>{
    /* Browser QA 2026-09-12: the row was visible on initial render with
       RPE-based pressed. The markup default must match the default scheme
       (RPE-based), so a path that never re-syncs the form still paints
       correctly. */
    assert.ok(/id="progressionPctRow"[^>]*\bhidden\b/.test(html),'#progressionPctRow hidden by default');
    assert.ok(/<p class="field-help" hidden>Training loads are set from this percent/.test(html),'help text hidden by default');
  });
  it('the no-program path always re-syncs the form, not just on first seed',()=>{
    /* renderProgram's !program branch used to skip syncProgramForm when a
       draft already existed, leaving stale visibility on the row. */
    assert.ok(programsJs.includes('if(!programDraftProgression)seedProgramForm(null); else syncProgramForm();'),'always syncs');
  });
});

/* Behavioral pin for #295: syncPctRowForScheme drives the real DOM flags per
   scheme — hidden for RPE-based and Linear, visible only for %1RM. */
const {loadRole}=require('./harness');
function makePctRow(){
  const help={hidden:false,classList:{contains:c=>c==='field-help'}};
  const row={hidden:false,nextElementSibling:help,
    classList:{contains:()=>false}};
  return {row,help};
}
const pct=makePctRow();
let rowPresent=true;
const {syncPctRowForScheme}=loadRole('progression-logic',{globals:{
  document:{querySelector:sel=>sel==='#progressionPctRow'&&rowPresent?pct.row:null,
    querySelectorAll:()=>[]},
}});

describe('#295 % of 1RM row visibility per scheme (behavioral)',()=>{
  it('hidden for RPE-based (row and help text)',()=>{
    syncPctRowForScheme('rpe');
    assert.equal(pct.row.hidden,true,'row hidden for rpe');
    assert.equal(pct.help.hidden,true,'help hidden for rpe');
  });
  it('hidden for Linear',()=>{
    syncPctRowForScheme('linear');
    assert.equal(pct.row.hidden,true,'row hidden for linear');
    assert.equal(pct.help.hidden,true,'help hidden for linear');
  });
  it('visible for %1RM',()=>{
    syncPctRowForScheme('onerm');
    assert.equal(pct.row.hidden,false,'row visible for onerm');
    assert.equal(pct.help.hidden,false,'help visible for onerm');
  });
  it('missing row is a safe no-op',()=>{
    rowPresent=false;
    assert.doesNotThrow(()=>syncPctRowForScheme('rpe'),'no row, no throw');
    rowPresent=true;
  });
});

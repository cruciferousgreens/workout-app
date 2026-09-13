'use strict';
/* #206 (user 2026-09-12): the %1RM progression-default settings block rendered
   garbled — the notched-label rule (`.rule-field > span { position:absolute }`)
   caught every direct-child span, so the `.prog-onerm-input` wrapper and the
   `.field-help` spans were yanked up into the label's notch position, floating
   inputs over truncated labels ("LT", "TY DEFAULT", "0 = NO SCHEDULED
   DELOADS."). The rows now use the standard label-span + input + em.unit
   pattern (like "Increment value"), and the notch selector only targets the
   label span. Layout-only: ids, values, and wiring are untouched.
   #321 (user 2026-09-12): the deload defaults moved out of the %1RM-only rows
   into an Auto Deload toggle + panel at the bottom of the progression
   defaults (and the program form), visible for every scheme. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/app-bootstrap.js'),'utf8');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/programs.js'),'utf8');

/* Every .rule-field's inner markup: exactly one direct-child span (the label). */
function ruleFieldInners(){
  const out=[];
  const re=/(<(?:label|div)\b[^>]*class="rule-field"[^>]*>)/g;
  let m;
  while((m=re.exec(html))){
    const tag=m[1];
    const close=tag.startsWith('<label')?'</label>':'</div>';
    const end=html.indexOf(close,m.index+tag.length);
    out.push({tag,inner:html.slice(m.index+tag.length,end)});
  }
  return out;
}

describe('%1RM settings rows use the standard label + input + unit pattern',()=>{
  it('full label texts are present and readable',()=>{
    for(const label of ['% of 1RM default','Deload every N weeks','Deload intensity']){
      assert.ok(html.includes(`<span>${label}</span>`),`label "${label}" present`);
    }
  });
  it('no input-wrapper or help spans remain inside a .rule-field',()=>{
    for(const {tag,inner} of ruleFieldInners()){
      assert.ok(!inner.includes('prog-onerm-input'),`no input wrapper in ${tag.slice(0,60)}`);
      assert.ok(!inner.includes('field-help'),`no help span in ${tag.slice(0,60)}`);
    }
  });
  it('each .rule-field has exactly one span: the label',()=>{
    for(const {tag,inner} of ruleFieldInners()){
      const spans=(inner.match(/<span\b/g)||[]).length;
      assert.strictEqual(spans,1,`one label span in ${tag.slice(0,60)}`);
    }
  });
  it('settings inputs keep their ids, rows keep their ids',()=>{
    for(const id of ['settingsPercentOf1RM','settingsDeloadEvery','settingsDeloadPct',
                     'settingsPctRow','settingsAutoDeloadToggle','settingsAutoDeloadPanel']){
      assert.ok(html.includes(`id="${id}"`),`#${id} present`);
    }
  });
  it('settings wiring is intact: values painted and input listeners persist',()=>{
    for(const id of ['settingsPercentOf1RM','settingsDeloadEvery','settingsDeloadPct']){
      assert.ok(bootstrap.includes(`$('#${id}')`),`app-bootstrap references #${id}`);
    }
    assert.ok(bootstrap.includes("$('#settingsPctRow')"),'visibility toggle for #settingsPctRow intact');
    assert.ok(bootstrap.includes("$('#settingsAutoDeloadToggle')"),'Auto Deload toggle wiring intact');
  });
});

describe('notch selector only targets the label span (#206 root cause)',()=>{
  it('.rule-field > span:first-child carries the absolute notch',()=>{
    assert.match(css,/\.rule-field > span:first-child\s*\{[^}]*position:\s*absolute/,
      'notch rule scoped to the first (label) span');
  });
  it('no bare .rule-field > span absolute rule remains',()=>{
    const cssNoComments=css.replace(/\/\*[\s\S]*?\*\//g,'');
    const bare=(cssNoComments.match(/\.rule-field > span\s*\{/g)||[]).length;
    assert.strictEqual(bare,0,'bare .rule-field > span rule is gone');
  });
});

describe('program-builder %1RM rows share the same fix',()=>{
  it('full label texts are present',()=>{
    for(const label of ['% of 1RM','Deload every N weeks','Deload intensity']){
      assert.ok(html.includes(`<span>${label}</span>`),`label "${label}" present`);
    }
  });
  it('program inputs and rows keep their ids',()=>{
    for(const id of ['progressionPercentOf1RM','deloadEvery','deloadPct','progressionPctRow','autoDeloadToggle','autoDeloadPanel']){
      assert.ok(html.includes(`id="${id}"`),`#${id} present`);
    }
  });
  it('program wiring still references the inputs',()=>{
    assert.ok(bootstrap.includes("$('#progressionPercentOf1RM')"),'input listener intact');
    assert.ok(programs.includes("$('#deloadEvery')")||programs.includes('deloadEvery'),'deloadEvery read intact');
    assert.ok(programs.includes("$('#deloadPct')")||programs.includes('deloadPct'),'deloadPct read intact');
  });
});

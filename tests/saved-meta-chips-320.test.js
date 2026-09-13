'use strict';
/* #320 (user 2026-09-13): the saved-workout detail header shows the summary
   as chips ("3 exercises", "9 sets", "Focus: Legs") instead of the old
   "N exercises · M sets" text line. The chips reuse the existing .tag pill
   styling so the family matches the rest of the app. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const saved=fs.readFileSync(path.join(ROOT,'assets/js/saved-workouts.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

describe('#320 saved-workout detail summary renders as chips',()=>{
  it('uses a meta-chips container of .tag pills',()=>{
    assert.ok(saved.includes('class="meta-chips"'),'meta-chips container present');
    const m=saved.match(/class="meta-chips"[\s\S]{0,600}/);
    assert.ok(m&&(m[0].match(/class="tag"/g)||[]).length>=2,'at least two .tag chips');
  });
  it('shows separate exercise-count, set-count, and focus chips',()=>{
    const m=saved.match(/<div class="meta-chips"[\s\S]*?<\/div>/);
    assert.ok(m,'meta-chips markup found');
    assert.ok(/exercise/.test(m[0]),'exercise-count chip');
    assert.ok(/set/.test(m[0]),'set-count chip');
    assert.ok(/Focus:/.test(m[0]),'focus chip');
  });
  it('the old "N exercises · M sets" text line is gone',()=>{
    assert.ok(!saved.includes('· ${totalSets}'),
      'the dot-joined text line is replaced by chips');
  });
  it('.meta-chips lays the pills out in a wrapping row',()=>{
    const m=css.match(/\.meta-chips\s*\{([^}]*)\}/);
    assert.ok(m,'.meta-chips rule found');
    assert.match(m[1],/display\s*:\s*flex/,'flex row');
    assert.match(m[1],/flex-wrap\s*:\s*wrap/,'wraps on narrow screens');
  });
});

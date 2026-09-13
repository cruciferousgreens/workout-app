'use strict';
/* #329 (user 2026-09-13): the set-tag dialog (and exercise-tag dialog) must
   not full re-render the exercise list behind the open modal — every toggle
   was calling renderWorkoutExercises(), causing jumping/expanding/re-firing
   animations. Tag changes persist immediately; the re-render is deferred to a
   single catch-up on dialog close. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const tags=fs.readFileSync(path.join(ROOT,'assets/js/set-tags.js'),'utf8');

describe('#329 tag changes defer the exercise re-render until dialog close',()=>{
  it('afterTagChange() persists but does not render synchronously for live sets',()=>{
    const m=tags.match(/function afterTagChange\(\)\s*\{([\s\S]*?)\n    \}/);
    assert.ok(m,'afterTagChange found');
    const liveBranch=m[1].split('else')[1]||'';
    assert.ok(!liveBranch.includes('renderWorkoutExercises'),
      'no synchronous renderWorkoutExercises in the live branch');
    assert.ok(liveBranch.includes('markDraftSaved'),
      'persistence still happens immediately');
    assert.ok(liveBranch.includes('pendingLiveTagRender=true'),
      'the re-render is deferred via the pending flag');
  });
  it('the set-tag dialog close event performs the single catch-up render',()=>{
    assert.ok(tags.includes("$('#setTagsDialog')?.addEventListener('close'"),
      'close listener registered on #setTagsDialog');
    const m=tags.match(/#setTagsDialog'\)\?\.addEventListener\('close',\(\)=>\{([\s\S]*?)\}\);/);
    assert.ok(m&&m[1].includes('renderWorkoutExercises()'),
      'close handler re-renders the exercises');
  });
  it('the exercise-tag dialog defers the same way',()=>{
    assert.ok(tags.includes('pendingLiveExerciseTagRender=true'),
      'exercise-tag toggles defer instead of rendering');
    assert.ok(tags.includes("$('#exerciseTagsDialog')?.addEventListener('close'"),
      'close listener registered on #exerciseTagsDialog');
  });
  it('builder mode still re-renders immediately (separate screen, no modal jump)',()=>{
    const m=tags.match(/function afterTagChange\(\)\s*\{([\s\S]*?)\n    \}/);
    assert.ok(m[1].includes("renderSavedBuilder()"),'builder path untouched');
  });
});

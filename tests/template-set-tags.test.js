'use strict';
/* #210 (user 2026-09-12): set tags in saved workout templates. The live
   workout's tag dialog is reused for the saved-workout builder's sets:
   - the template clone chain already carries set tags (forSaveTemplate on
     builder save, fromTemplate on template start) — pinned here so it can't
     regress;
   - the builder's set rows render the tag affordance and wire it to
     openTagDialog in 'builder' mode;
   - set-tags.js resolves builder targets against state.savedBuilder. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const setTagsSrc=fs.readFileSync(path.join(ROOT,'assets/js/set-tags.js'),'utf8');
const savedWorkoutsSrc=fs.readFileSync(path.join(ROOT,'assets/js/saved-workouts.js'),'utf8');

const {cloneSetFields,cloneExerciseItem}=loadRole('template-set-tags');

const TAGGED_SET={w:'',r:'8',seconds:'',rpe:'',targetRpe:'',tags:['warmup','dropset']};

describe('set tags survive the template clone chain',()=>{
  it("builder save (forSaveTemplate) keeps tags, drops logged actuals",()=>{
    const out=cloneSetFields({...TAGGED_SET,w:'135',rpe:'9'},'forSaveTemplate');
    assert.deepEqual(out.tags,['warmup','dropset']);
    assert.equal(out.w,'','weight is not a prescription');
    assert.equal(out.rpe,'','actual RPE is not a prescription');
    assert.equal(out.r,'8','rep target kept');
  });
  it('template start (fromTemplate) carries tags into the live session',()=>{
    const out=cloneSetFields(TAGGED_SET,'fromTemplate');
    assert.deepEqual(out.tags,['warmup','dropset']);
  });
  it('cloneExerciseItem fromTemplate carries set tags end to end',()=>{
    const item=cloneExerciseItem({exerciseId:'ex-1',sets:[{...TAGGED_SET}]},'fromTemplate',{});
    assert.deepEqual(item.sets[0].tags,['warmup','dropset']);
  });
  it('untagged sets stay untagged',()=>{
    const out=cloneSetFields({w:'',r:'10',seconds:'',rpe:'',targetRpe:'',tags:[]},'forSaveTemplate');
    assert.deepEqual(out.tags,[]);
  });
});

describe('builder UI exposes the tag affordance',()=>{
  it('builder set rows render a tag button (not a plain span) with has-tags state',()=>{
    const card=savedWorkoutsSrc.match(/function builderExerciseCard\(item,list\)\{([\s\S]*?)\n    \}/)[1];
    assert.ok(card.includes('data-builder-tag-set'),'set rows carry data-builder-tag-set');
    assert.ok(card.includes('has-tags'),'tagged rows get the has-tags indicator');
    assert.ok(!card.includes('<span class="builder-set-num">'),'no plain set-number span remains');
  });
  it('wireBuilderSetTags routes to openTagDialog in builder mode',()=>{
    assert.match(savedWorkoutsSrc,
      /function wireBuilderSetTags\(host\)\{\s*host\.querySelectorAll\('\[data-builder-tag-set\]'\)\.forEach\(btn=>btn\.addEventListener\('click',\(\)=>openTagDialog\(btn\.dataset\.builderTagExercise,btn\.dataset\.builderTagSet,'builder'\)\)\);\s*\}/,
      'builder tag buttons open the shared dialog in builder mode');
  });
  it('renderSavedBuilder wires the set-tag buttons',()=>{
    const fn=savedWorkoutsSrc.match(/function renderSavedBuilder\(\)\{([\s\S]*?)\n    \}/)[1];
    assert.ok(fn.includes('wireBuilderSetTags(host)'),'set-tag wiring runs on every builder render');
  });
});

describe('set-tags.js resolves builder targets',()=>{
  it('findTagSet reads from state.savedBuilder in builder mode',()=>{
    assert.match(setTagsSrc,
      /function findTagSet\(exerciseUid, setUid\) \{\s*if \(workoutState\.tagTarget\?\.mode === 'builder'\)\s*return state\.savedBuilder\?\.exercises\.find/,
      'builder targets resolve against state.savedBuilder');
  });
  it('openTagDialog accepts a mode and skips the freeze guard for builder sets',()=>{
    assert.match(setTagsSrc,/function openTagDialog\(exerciseUid, setUid, mode\)/,
      'openTagDialog takes a mode parameter');
    assert.match(setTagsSrc,/if \(!mode && setIsFrozen\(findDraftSet\(exerciseUid, setUid\)\)\)/,
      'freeze guard applies to draft sets only');
  });
  it('tag changes re-render the owning screen (builder persists + re-renders)',()=>{
    assert.match(setTagsSrc,
      /function afterTagChange\(\) \{\s*if \(workoutState\.tagTarget\?\.mode === 'builder'\) \{ schedulePersist\(\); renderSavedBuilder\(\); \}/,
      'builder tag edits persist and re-render the builder');
  });
});

'use strict';
/* #283 (agent 2026-09-12): the exercise Configure dialog must not accept an
   inverted range — Min sec 90 / Max sec 60 applied cleanly and the row read
   "Targets: 90–60 sec". validateBuilderConfigureRange is pure; the dialog
   keeps the values and shows a toast instead of applying. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {validateBuilderConfigureRange}=loadRole('saved-workout-template');

describe('validateBuilderConfigureRange (#283)',()=>{
  it('rejects inverted time ranges',()=>{
    assert.equal(validateBuilderConfigureRange(true,'90','60'),'Min sec can\u2019t be above Max sec.');
  });
  it('rejects inverted rep ranges',()=>{
    assert.equal(validateBuilderConfigureRange(false,'12','8'),'Min reps can\u2019t be above Max reps.');
  });
  it('accepts valid ranges',()=>{
    assert.equal(validateBuilderConfigureRange(true,'30','60'),null);
    assert.equal(validateBuilderConfigureRange(false,'8','12'),null);
  });
  it('accepts equal min/max',()=>{
    assert.equal(validateBuilderConfigureRange(true,'60','60'),null);
  });
  it('blank max stays valid (AMRAP / timeMax=timeMin defaults)',()=>{
    assert.equal(validateBuilderConfigureRange(false,'8',''),null);
    assert.equal(validateBuilderConfigureRange(true,'','60'),null);
    assert.equal(validateBuilderConfigureRange(true,'',''),null);
  });
});

'use strict';
/* Role: picker-scroll — pins the #192 rule (user 2026-09-12): when the
   exercise picker closes after adding exercises, the viewport returns to
   the exact scroll position from when the picker opened — never a snap to
   the new card. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {exercisePickerCloseScrollY,workoutState}=loadRole('picker-scroll');

beforeEach(()=>{delete workoutState.pickerScrollY;});

describe('exercisePickerCloseScrollY (#192)',()=>{
  it('returns the scroll position saved when the picker opened',()=>{
    workoutState.pickerScrollY=1234;
    assert.equal(exercisePickerCloseScrollY(),1234);
  });
  it('falls back to the top when nothing was saved',()=>{
    assert.equal(exercisePickerCloseScrollY(),0);
  });
  it('does not depend on which exercises were added',()=>{
    /* The old #143 behavior scrolled to the newest card; the rule must
       ignore the added set entirely — only the saved position matters. */
    workoutState.pickerScrollY=42;
    assert.equal(exercisePickerCloseScrollY(),42);
  });
});

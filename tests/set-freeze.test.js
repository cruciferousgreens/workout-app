'use strict';
/* Role: utilities — pins the #161 set-freeze rule (user 2026-09-12): a set
   checked complete has its form inputs frozen until it is un-checked.
   setIsFrozen is the single source of truth shared by the live set-row
   renderer and the checkbox toggle in workout-editor.js. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {setIsFrozen}=loadRole('utilities');

describe('setIsFrozen (#161)',()=>{
  it('a completed set is frozen',()=>{
    assert.equal(setIsFrozen({complete:true,w:'100',r:'8'}),true);
  });
  it('an incomplete set is not frozen',()=>{
    assert.equal(setIsFrozen({complete:false,w:'100',r:'8'}),false);
  });
  it('a set without the complete flag is not frozen',()=>{
    assert.equal(setIsFrozen({w:'100',r:'8'}),false);
    assert.equal(setIsFrozen({complete:undefined}),false);
  });
  it('null/undefined sets are not frozen',()=>{
    assert.equal(setIsFrozen(null),false);
    assert.equal(setIsFrozen(undefined),false);
  });
  it('un-completing a set re-enables it (freeze follows the toggle)',()=>{
    const set={complete:false};
    assert.equal(setIsFrozen(set),false);
    set.complete=!set.complete; /* same flip as the checkbox handler */
    assert.equal(setIsFrozen(set),true);
    set.complete=!set.complete;
    assert.equal(setIsFrozen(set),false);
  });
});

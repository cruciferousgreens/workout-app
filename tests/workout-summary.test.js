'use strict';
/* #302 (user 2026-09-12): workoutSummary flags timed-only workouts and totals
   their time, so summaries render "total time" instead of "total volume:
   0 lb". */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {workoutSummary}=loadRole('workout-history-logic',{globals:{
  exercises:[{id:'plank',name:'Plank',primary:['core'],secondary:[]}],
}});

const repSet=()=>({w:'135',r:'8',seconds:'',rpe:'',tags:[],complete:true});
const timedSet=(sec)=>({w:'',r:'',seconds:String(sec),rpe:'',tags:[],complete:true});
const mkWorkout=(sets)=>({id:'w1',name:'W',date:'2026-09-12',
  exercises:[{exerciseId:'plank',sets}]});

describe('workoutSummary — #302 timed-only totals',()=>{
  it('timed-only workout is flagged with total seconds',()=>{
    const s=workoutSummary(mkWorkout([timedSet(60),timedSet(45)]));
    assert.equal(s.timedOnly,true);
    assert.equal(s.totalSeconds,105);
    assert.equal(s.volume,0);
  });
  it('weighted workout is not timed-only',()=>{
    const s=workoutSummary(mkWorkout([repSet(),repSet()]));
    assert.equal(s.timedOnly,false);
    assert.ok(s.volume>0);
  });
  it('mixed workout is not timed-only',()=>{
    const s=workoutSummary(mkWorkout([repSet(),timedSet(30)]));
    assert.equal(s.timedOnly,false);
  });
  it('empty workout is not timed-only',()=>{
    const s=workoutSummary(mkWorkout([]));
    assert.equal(s.timedOnly,false);
    assert.equal(s.totalSeconds,0);
  });
});

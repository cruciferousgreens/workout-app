'use strict';
/* Role: pr-label-logic — pins #282 (timed PR recognition): the live PR toast
   (livePRLabel) fires for a longest hold at the set's load, and the
   post-workout PR summary (workoutPRs) lists it — the same celebration path
   rep PRs already had. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=[
  {id:'plank',name:'Plank',equipment:'body only',tracking:'time',force:'static'},
  {id:'squat',name:'Barbell Squat',equipment:'barbell',tracking:'reps'},
];

const {livePRLabel,workoutState}=loadRole('pr-label-logic',{globals:{exercises:catalog}});

const timedSet=(seconds,w)=>({seconds,w:w??'',r:'',rpe:'',tags:[],complete:false});
const mkLog=(id,date,sets)=>({
  id,date,completedAt:`${date}T12:00:00.000Z`,name:'Workout',
  exercises:[{exerciseId:'plank',tracking:'time',sets:sets.map(s=>({...s,r:null}))}],
});
const mkItem=()=>({exerciseId:'plank',tracking:'time'});

beforeEach(()=>{workoutState.completed=[];});

describe('livePRLabel — #282 timed PR toast',()=>{
  it('longer hold than any prior → longest-hold PR label',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[{seconds:60,w:''}])];
    assert.equal(livePRLabel(mkItem(),timedSet(75)),'Plank · new longest hold PR');
  });
  it('shorter hold → no label',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[{seconds:60,w:''}])];
    assert.equal(livePRLabel(mkItem(),timedSet(45)),'');
  });
  it('no prior timed history → no label',()=>{
    assert.equal(livePRLabel(mkItem(),timedSet(75)),'');
  });
  it('longest hold is per-load: weighted hold PRs against the weighted best',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[{seconds:90,w:''},{seconds:40,w:'25'}])];
    assert.equal(livePRLabel(mkItem(),timedSet(50,'25')),'Plank · new longest hold PR');
    assert.equal(livePRLabel(mkItem(),timedSet(30,'25')),'');
  });
  it('rep PR path is unchanged (still requires load)',()=>{
    const item={exerciseId:'squat',tracking:'reps'};
    assert.equal(livePRLabel(item,{w:'',r:'10',seconds:'',rpe:'',tags:[]}),'');
  });
});

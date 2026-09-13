'use strict';
/* Role: exercise-detail-logic — pins the timed-set fixes (user 2026-09-12):
   #278 (timed-only history must not read "No completed sets yet"; stats,
   trend, and volume paths treat seconds-tracked sets as completed) and
   #281 (per-session head shows "Longest hold X sec" for timed sessions,
   never a misleading "Best estimate 0 lb"). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {statsFor,exerciseTrendData,sessionBestLabel,workoutState}=loadRole('exercise-detail-logic');

const timedSet=(seconds,w=null)=>({w,r:null,seconds,rpe:null,tags:[]});
const repSet=(w,r,rpe=null)=>({w,r,seconds:null,rpe,tags:[]});
const mkWorkout=(id,date,exerciseId,tracking,sets)=>({
  id,date,completedAt:`${date}T12:00:00.000Z`,name:'Workout',
  exercises:[{exerciseId,tracking,sets}],
});

beforeEach(()=>{workoutState.completed=[];});

describe('statsFor — #278 timed sets count as completed',()=>{
  it('timed-only history returns stats (not null) with longestHold',()=>{
    workoutState.completed=[
      mkWorkout('w1','2026-09-10','plank','time',[timedSet(45),timedSet(60)]),
      mkWorkout('w2','2026-09-11','plank','time',[timedSet(50)]),
    ];
    const st=statsFor('plank');
    assert.ok(st,'must not be null for timed-only history');
    assert.equal(st.sessions,2);
    assert.equal(st.sets,3);
    assert.equal(st.longestHold,60);
    assert.equal(st.bestRepSet,0);
    assert.equal(st.bestEst,null);
    assert.equal(st.projected,null);
  });
  it('rep history keeps the old shape',()=>{
    workoutState.completed=[
      mkWorkout('w1','2026-09-10','squat','reps',[repSet(135,8,9),repSet(135,6,10)]),
    ];
    const st=statsFor('squat');
    assert.ok(st);
    assert.equal(st.sets,2);
    assert.equal(st.bestRepSet,8);
    assert.ok(st.bestEst);
    assert.ok(st.projected>0);
    assert.equal(st.longestHold,0);
  });
  it('no history still returns null',()=>{
    assert.equal(statsFor('plank'),null);
  });
  it('mixed rep+timed history counts both',()=>{
    workoutState.completed=[
      mkWorkout('w1','2026-09-10','plank','time',[timedSet(60)]),
      mkWorkout('w2','2026-09-11','plank','reps',[repSet(null,20)]),
    ];
    const st=statsFor('plank');
    assert.ok(st);
    assert.equal(st.sets,2);
    assert.equal(st.longestHold,60);
    assert.equal(st.bestRepSet,20);
  });
});

describe('exerciseTrendData — #278 timed trend series',()=>{
  it('timed-only history yields hold + timeVolume series, no e1rm',()=>{
    workoutState.completed=[
      mkWorkout('w1','2026-09-10','plank','time',[timedSet(45),timedSet(60)]),
      mkWorkout('w2','2026-09-11','plank','time',[timedSet(50)]),
    ];
    const t=exerciseTrendData('plank');
    assert.equal(t.e1rm.length,0);
    assert.equal(t.volume.length,0);
    assert.equal(t.hold.length,2);
    assert.deepEqual(t.hold.map(p=>p.value),[60,50]); /* oldest session first */
    assert.deepEqual(t.timeVolume.map(p=>p.value),[105,50]);
  });
  it('rep history trend is unchanged',()=>{
    workoutState.completed=[
      mkWorkout('w1','2026-09-10','squat','reps',[repSet(135,8,9)]),
    ];
    const t=exerciseTrendData('squat');
    assert.equal(t.e1rm.length,1);
    assert.equal(t.hold.length,0);
    assert.equal(t.timeVolume.length,0);
    assert.equal(t.volume.length,1);
  });
});

describe('sessionBestLabel — #281 no "Best estimate 0 lb"',()=>{
  it('timed session shows the longest hold',()=>{
    const label=sessionBestLabel({tracking:'time',sets:[timedSet(45),timedSet(60)]});
    assert.equal(label,'Longest hold 60 sec');
  });
  it('weighted rep session keeps the estimate',()=>{
    const label=sessionBestLabel({tracking:'reps',sets:[repSet(135,8,9)]});
    assert.ok(label.startsWith('Best estimate '),label);
    assert.ok(!label.includes('0 lb'),label);
  });
  it('unweighted rep session hides the estimate instead of showing 0',()=>{
    const label=sessionBestLabel({tracking:'reps',sets:[repSet(null,20)]});
    assert.equal(label,'');
  });
  it('timed session with no seconds hides the label',()=>{
    const label=sessionBestLabel({tracking:'time',sets:[timedSet(0)]});
    assert.equal(label,'');
  });
});

describe('exerciseTrendData — #249 heaviest labels drop the day ordinal',()=>{
  it('two sessions same day: heaviest labels have no "(2)", e1rm keeps it',()=>{
    workoutState.completed=[
      mkWorkout('w1','2026-09-10','bench','reps',[repSet(135,8)]),
      mkWorkout('w2','2026-09-10','bench','reps',[repSet(140,8)]),
    ];
    const t=exerciseTrendData('bench');
    assert.equal(t.heaviest.length,2);
    assert.ok(t.heaviest.every(p=>!p.shortLabel.includes('(')),
      'heaviest labels: '+JSON.stringify(t.heaviest.map(p=>p.shortLabel)));
    assert.ok(t.heaviest.every(p=>!p.label.includes('(')),
      'heaviest full labels: '+JSON.stringify(t.heaviest.map(p=>p.label)));
    assert.ok(t.e1rm.some(p=>p.shortLabel.includes('(2)')),
      'e1rm keeps ordinal: '+JSON.stringify(t.e1rm.map(p=>p.shortLabel)));
  });
});

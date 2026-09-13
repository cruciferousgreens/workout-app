'use strict';
/* Role: progression-logic — the app's brain. Pins top-set selection,
   increment rounding, the RPE-gated double progression, linear mode,
   time mode, AMRAP/open-top, the #79 no-op suppression, freestyle
   follow-the-lifter, same-zone history selection, and the v1.001 %1RM +
   scheduled-deload additions. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  topSetForSession, roundedIncrement, snapPlateLoad,
  clampPct1RM, clampDeloadPct,
  programPctForWeek, isDeloadWeek,
  progressionForExercise, workoutState, progressionSetup,
}=loadRole('progression-logic');

const CFG=()=>({threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
const PROF=()=>({mode:'reps',min:6,max:12});

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
});

describe('topSetForSession',()=>{
  it('heaviest weight wins',()=>{
    const top=topSetForSession({tracking:'reps',sets:[{w:135,r:8},{w:140,r:5}]});
    assert.equal(top.weight,140);
    assert.equal(top.reps,5);
  });
  it('ties break by reps',()=>{
    const top=topSetForSession({tracking:'reps',sets:[{w:140,r:5},{w:140,r:8}]});
    assert.equal(top.reps,8);
    assert.equal(top.index,1);
  });
  it('detects time mode and picks most seconds',()=>{
    const top=topSetForSession({tracking:'time',sets:[{w:'',seconds:40},{w:'',seconds:45}]});
    assert.equal(top.mode,'time');
    assert.equal(top.seconds,45);
  });
  it('set tags never influence selection (documented invariant)',()=>{
    const top=topSetForSession({tracking:'reps',sets:[
      {w:140,r:5,tags:['To failure']},
      {w:140,r:8,tags:[]},
    ]});
    assert.equal(top.reps,8);
  });
  it('empty or missing sets → null',()=>{
    assert.equal(topSetForSession({tracking:'reps',sets:[]}),null);
    assert.equal(topSetForSession({tracking:'reps'}),null);
    assert.equal(topSetForSession(null),null);
  });
});

describe('roundedIncrement',()=>{
  it('percent compounds and rounds to 0.5',()=>{
    assert.equal(roundedIncrement(100,'percent',5),105);
    assert.equal(roundedIncrement(97.3,'percent',5),102); // 102.165 → 102
  });
  it('lb adds and rounds to 0.5',()=>{
    assert.equal(roundedIncrement(97.3,'lb',5),102.5);
    assert.equal(roundedIncrement(100,'lb',2.5),102.5);
  });
});

describe('progressionForExercise — double progression',()=>{
  it('RPE at/below threshold + reps below max → add a rep',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:7},{w:140,r:6,rpe:8}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,9);
    assert.equal(s.nextWeight,140);
  });
  it('rep ceiling reached → add load, reset to min',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:12,rpe:7}])])];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,145);
    assert.equal(s.nextReps,6);
  });
  it('RPE above threshold → null, not a no-op hold card (#79)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:9}])])];
    assert.equal(progressionForExercise('bench-press',PROF(),CFG()),null);
  });
  it('null RPE → null, not a no-op hold card (#79)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:null}])])];
    assert.equal(progressionForExercise('bench-press',PROF(),CFG()),null);
  });
  it('repsOnly at the ceiling → null, not a no-op hold card (#79)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:12,rpe:7}])])];
    assert.equal(
      progressionForExercise('bench-press',{...PROF(),repsOnly:true},CFG()),null);
  });
  it("linear scheme adds the increment every session even when reps were missed (user's 2026-09-11 call)",()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:6,rpe:10}])])];
    const s=progressionForExercise('bench-press',{...PROF(),scheme:'linear'},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,145);
    assert.equal(s.nextReps,6);
  });
  it('no history → null',()=>{
    assert.equal(progressionForExercise('bench-press',PROF(),CFG()),null);
  });
  it('time mode below ceiling → add seconds',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{seconds:40,rpe:7},{seconds:45,rpe:8}],{tracking:'time'})])];
    const s=progressionForExercise('bench-press',
      {mode:'time',timeMin:30,timeMax:60,timeStep:5},CFG());
    assert.equal(s.kind,'time');
    assert.equal(s.nextSeconds,50);
  });
  it('time ceiling reached → add load, reset seconds',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:100,seconds:60,rpe:7}],{tracking:'time'})])];
    const s=progressionForExercise('bench-press',
      {mode:'time',timeMin:30,timeMax:60,timeStep:5},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105);
    assert.equal(s.nextSeconds,30);
  });
  it('openTop → +1 rep, no ceiling load-jump',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:18,rpe:7}])])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:15,openTop:true},CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,19);
    assert.equal(s.nextWeight,140);
  });
  it('#79: a suggestion identical to the latest top set returns null (AMRAP collapses to a no-op)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:10,rpe:7}])])];
    assert.equal(
      progressionForExercise('bench-press',{...PROF(),amrap:true,min:1,max:null},CFG()),
      null);
  });
  it('#79: linear + repsOnly is a no-op → null, not a hold card',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:7}])])];
    assert.equal(
      progressionForExercise('bench-press',{...PROF(),scheme:'linear',repsOnly:true},CFG()),
      null);
  });
  it('suggests from the most recent SAME-ZONE log, not the newest log',()=>{
    workoutState.completed=[
      mkLog('w2','2026-09-10',[mkItem('bench-press',[{w:140,r:4,rpe:7}])]),
      mkLog('w1','2026-09-08',[mkItem('bench-press',[{w:130,r:8,rpe:7}])]),
    ];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    assert.equal(s.kind,'reps');
    assert.equal(s.nextWeight,130);
    assert.equal(s.nextReps,9);
  });
  it('freestyle freeform follows the lifter’s latest zone instead of rebasing into defaults',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:4,rpe:7}])])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:6,max:12},{...CFG(),freeform:true});
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,145);
    assert.equal(s.nextReps,4);
    assert.deepEqual(s.range,[4,4]);
  });
});

describe('progressionForExercise — %1RM prescription (v1.001)',()=>{
  it('entered training max needs no history (TM-first basis)',()=>{
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',trainingMax:200,percentOf1RM:80,min:6,max:12},CFG());
    assert.equal(s.kind,'onerm');
    assert.equal(s.pct,80);
    assert.equal(s.tmSource,'manual');
    assert.equal(s.nextWeight,160);
    assert.equal(s.nextReps,6);
    assert.match(s.reason,/training max/);
  });
  it('no training max → basis is the best same-zone top-set e1RM',()=>{
    workoutState.completed=[
      mkLog('w2','2026-09-10',[mkItem('bench-press',[{w:180,r:10,rpe:7}])]), // e1RM 258
      mkLog('w1','2026-09-08',[mkItem('bench-press',[{w:200,r:5,rpe:9}])]),  // e1RM 240
    ];
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',min:6,max:12},CFG());
    assert.equal(s.kind,'onerm');
    assert.equal(s.tmSource,'auto');
    assert.equal(s.pct,75); // program default
    assert.equal(s.nextWeight,195); // 258×0.75=193.5 → plate-snapped to 195
    assert.match(s.reason,/auto training max/);
  });
  it('percent is clamped to 1–100 (unset/invalid → 75)',()=>{
    assert.equal(clampPct1RM(150),100);
    assert.equal(clampPct1RM(0),75);
    assert.equal(clampPct1RM(-5),75);
    assert.equal(clampPct1RM(''),75);
    assert.equal(clampPct1RM(80),80);
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',trainingMax:200,percentOf1RM:150,min:6,max:12},CFG());
    assert.equal(s.pct,100);
    assert.equal(s.nextWeight,200);
  });
  it('metric loads snap to 2.5 kg plates (lb→kg before snap, back after)',()=>{
    progressionSetup.units='metric';
    assert.equal(snapPlateLoad(200),90/0.45359237);
    assert.equal(snapPlateLoad(160),72.5/0.45359237); // 160 lb → 72.5 kg → back
  });
  it('imperial loads snap to 5 lb plates',()=>{
    assert.equal(snapPlateLoad(193.5),195);
    assert.equal(snapPlateLoad(84),85);
  });
  it('onerm with no basis at all → null (no card)',()=>{
    assert.equal(
      progressionForExercise('bench-press',{scheme:'onerm',min:6,max:12},CFG()),
      null);
  });
});

describe('progressionForExercise — scheduled deloads (v1.001)',()=>{
  const DELOAD_LOGS=()=>[mkLog('w1','2026-09-10',[
    mkItem('bench-press',[{w:140,r:8,rpe:7}])])];
  it('deload week (every-N) → reduced load, kind deload',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',PROF(),
      {...CFG(),currentWeek:4,deloadEvery:4,deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,85); // 140×0.6=84 → snapped to 85
    assert.match(s.reason,/Week 4 is a scheduled deload/);
  });
  it('deloads are never inferred: a non-scheduled week follows the normal path',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',PROF(),
      {...CFG(),currentWeek:3,deloadEvery:4});
    assert.equal(s.kind,'reps');
  });
  it('weeklyDeloads flags mark scheduled weeks',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',PROF(),
      {...CFG(),currentWeek:2,weeklyDeloads:[false,true]});
    assert.equal(s.kind,'deload');
    assert.equal(isDeloadWeek({weeklyDeloads:[false,true]},1),false);
  });
  it('deload skips the linear increment (deload wins)',()=>{
    workoutState.completed=DELOAD_LOGS();
    const s=progressionForExercise('bench-press',{...PROF(),scheme:'linear'},
      {...CFG(),currentWeek:4,deloadEvery:4,deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,85); // reduced, NOT 145
  });
  it('onerm deload: the reduced load still targets the range minimum',()=>{
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',trainingMax:200,percentOf1RM:80,min:6,max:12},
      {...CFG(),currentWeek:4,deloadEvery:4,deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,95); // 160×0.6=96 → snapped to 95
    assert.equal(s.nextReps,6);
  });
  it('deload pct clamps to 40–80 (unset/invalid → 60)',()=>{
    assert.equal(clampDeloadPct(60),60);
    assert.equal(clampDeloadPct(10),40);
    assert.equal(clampDeloadPct(90),80);
    assert.equal(clampDeloadPct(0),60);
  });
});

describe('programPctForWeek / isDeloadWeek',()=>{
  it('weekly % wave: explicit entries beat the flat percent',()=>{
    assert.equal(programPctForWeek({pctWave:true,weeklyPcts:[70,75,80]},2),75);
  });
  it('the wave loops across the program length',()=>{
    assert.equal(programPctForWeek({pctWave:true,weeklyPcts:[70,75,80]},4),70);
  });
  it('disabled wave leaves stale weeklyPcts inert → null',()=>{
    assert.equal(programPctForWeek({pctWave:false,weeklyPcts:[70]},1),null);
    assert.equal(programPctForWeek({},1),null);
  });
  it('isDeloadWeek: every-N and flag panel, never inferred',()=>{
    assert.equal(isDeloadWeek({deloadEvery:4},4),true);
    assert.equal(isDeloadWeek({deloadEvery:4},3),false);
    assert.equal(isDeloadWeek({weeklyDeloads:[false,true]},2),true);
    assert.equal(isDeloadWeek({},2),false);
    assert.equal(isDeloadWeek({deloadEvery:4},0),false);
  });
});

describe('progressionForExercise — #250: rebased targets never regress below the top set',()=>{
  it('top set 245x1 @ RPE 9 rebased into 1–5 → no regressing card (224 lb would be a step back)',()=>{
    // The user's exact scenario: previous zone 6–12, new strength zone 1–5.
    // e1RM = 245×(1+(1+1)/30) ≈ 261 → raw rebase 261/(1+5/30) = 224 < 245.
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('barbell-deadlift',[
        {w:95,r:4,rpe:1},{w:145,r:4,rpe:6},{w:245,r:1,rpe:9},
      ],{progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('barbell-deadlift',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    // The floor holds the top set; #79 then suppresses the no-change card.
    assert.ok(!s||s.nextWeight>=245,
      '#250: the engine must never suggest below the 245 lb top set');
    assert.equal(s,null);
  });
  it('rebase that would dip below the top set even at RPE 7 → holds steady, no card',()=>{
    // 200x8 @ RPE 7, previous zone 6–8, new zone 6–12:
    // e1RM = 200×(1+(8+3)/30) ≈ 273 → raw rebase 273/(1+12/30) ≈ 195 < 200.
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:200,r:8,rpe:7}],
        {progression:{mode:'reps',min:6,max:8}})])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:6,max:12,custom:true},CFG());
    assert.ok(!s||s.nextWeight>=200,
      '#250: the engine must never suggest below the 200 lb top set');
    assert.equal(s,null);
  });
  it('rebase that lands above the top set still produces a range card (floor is not a ceiling)',()=>{
    // 200x8 @ RPE 5, previous zone 6–8, new zone 6–12:
    // e1RM = 200×(1+(8+5)/30) ≈ 287 → raw rebase 287/(1+12/30) ≈ 205 > 200.
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:200,r:8,rpe:5}],
        {progression:{mode:'reps',min:6,max:8}})])];
    const s=progressionForExercise('bench-press',
      {mode:'reps',min:6,max:12,custom:true},CFG());
    assert.equal(s.kind,'range');
    assert.ok(s.nextWeight>200);
    assert.equal(s.nextReps,6);
  });
});

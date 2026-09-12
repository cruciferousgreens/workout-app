'use strict';
/* Role: stats-math — period windowing, muscle attribution, heat levels, and
   compact stat numbers. Period tests build fixtures relative to the real
   today (the functions read `new Date()`), so boundaries stay deterministic
   whatever day the suite runs. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=require('./fixtures/catalog');
/* Nav/persist stubs for #195: openLogsForDashboardPeriod calls the real
   navigation/persist functions, which live in other script files in the
   app — here they just record their calls. */
const navCalls=[];
const {
  workoutsForPeriod, muscleCounts, muscleVolumes, muscleSetCounts, workedMuscles,
  muscleHeatmapMarkup, blindspotMuscles, openLogsForDashboardPeriod,
  heatLevel, compactStat, VOLUME_TIERS, SETS_TIERS,
  localIsoDate, workoutState, state,
}=loadRole('stats-math',{globals:{exercises:catalog,
  schedulePersist:()=>{navCalls.push('persist');},
  showWorkouts:(push)=>{navCalls.push('showWorkouts:'+push);},
  showWorkoutHistory:()=>{navCalls.push('showWorkoutHistory');},
}});

function W(id,date,items){
  return {id,date,isoDate:date,name:'W '+id,
    exercises:items.map(([exId,sets])=>({exerciseId:exId,sets}))};
}
function S(w,r){return {w,r,seconds:null,rpe:null,tags:[]};}

beforeEach(()=>{workoutState.completed=[];});

describe('workoutsForPeriod',()=>{
  function periodFixtures(){
    const today=new Date();
    const monday=new Date(today);
    monday.setDate(today.getDate()-((today.getDay()+6)%7)); // week starts Monday
    const sundayBefore=new Date(monday); sundayBefore.setDate(monday.getDate()-1);
    const firstOfMonth=new Date(today.getFullYear(),today.getMonth(),1);
    const lastMonthEnd=new Date(today.getFullYear(),today.getMonth(),0);
    workoutState.completed=[
      W('t',localIsoDate(today),[]),
      W('m',localIsoDate(monday),[]),
      W('s',localIsoDate(sundayBefore),[]),
      W('f',localIsoDate(firstOfMonth),[]),
      W('p',localIsoDate(lastMonthEnd),[]),
    ];
  }
  const ids=(ws)=>ws.map(w=>w.id).sort();
  it('week starts Monday: Monday in, prior Sunday out',()=>{
    periodFixtures();
    const got=ids(workoutsForPeriod('week'));
    assert.ok(got.includes('t'),'today in week');
    assert.ok(got.includes('m'),'Monday in week');
    assert.ok(!got.includes('s'),'prior Sunday out of week');
  });
  it('today: only today',()=>{
    periodFixtures();
    assert.deepEqual(ids(workoutsForPeriod('today')),['t']);
  });
  it('month: first-of-month in, last-month out',()=>{
    periodFixtures();
    const got=ids(workoutsForPeriod('month'));
    assert.ok(got.includes('f'),'first of month in');
    assert.ok(!got.includes('p'),'previous month out');
  });
  it('all: everything',()=>{
    periodFixtures();
    assert.deepEqual(ids(workoutsForPeriod('all')),['f','m','p','s','t']);
  });
});

describe('muscle attribution (fixture catalog)',()=>{
  function lifting(){
    return [W('w1','2026-09-10',[
      ['bench-press',[S(100,5),S(100,5)]],  // 2 sets, 1000 lb volume
      ['back-squat',[S(200,5)]],            // 1 set, 1000 lb volume
    ])];
  }
  it('muscleCounts: primary muscles get the full set count',()=>{
    const c=muscleCounts(lifting());
    assert.equal(c['chest'],2);
    assert.equal(c['quadriceps'],1);
    assert.equal(c['glutes'],1);
    assert.equal(c['front delts']||0,0); // secondary muscles are not counted
  });
  it('muscleVolumes: primary full, secondary at SECONDARY_MUSCLE_WEIGHT (0.45)',()=>{
    const v=muscleVolumes(lifting());
    assert.equal(v['chest'],1000);
    assert.equal(v['front delts'],450);
    assert.equal(v['triceps'],450);
    assert.equal(v['hamstrings'],450); // squat secondary: 1000×0.45
  });
  it('muscleSetCounts: sets are whole — secondary gets the FULL set count (pinned asymmetry)',()=>{
    const c=muscleSetCounts(lifting());
    assert.equal(c['chest'],2);
    assert.equal(c['front delts'],2); // NOT 2×0.45 — sets don't fractionalize
    assert.equal(c['triceps'],2);
  });
});

describe('heatLevel',()=>{
  it('zero value or zero max → 0',()=>{
    assert.equal(heatLevel(0,10),0);
    assert.equal(heatLevel(10,0),0);
  });
  it('sqrt ramp clamps to 1–5; the max value → 5',()=>{
    assert.equal(heatLevel(100,100),5);
    assert.equal(heatLevel(25,100),3);  // ceil(sqrt(.25)×5)
    assert.equal(heatLevel(1,100),1);
    assert.equal(heatLevel(10000,100),5);
  });
});

describe('compactStat',()=>{
  it('volume abbreviates only at ≥1M',()=>{
    assert.deepEqual(compactStat(2500000,VOLUME_TIERS),{short:'2M+',full:'2,500,000'});
    assert.deepEqual(compactStat(999999,VOLUME_TIERS),{short:'999,999',full:null});
  });
  it('sets abbreviate at ≥10K',()=>{
    assert.deepEqual(compactStat(15000,SETS_TIERS),{short:'15K+',full:'15,000'});
    assert.deepEqual(compactStat(9999,SETS_TIERS),{short:'9,999',full:null});
  });
});

describe('#170 workedMuscles: bodyweight sets light the map, volume math untouched',()=>{
  function bodyweightOnly(){
    return [W('bw','2026-09-11',[
      ['bench-press',[S(0,10),S(0,8)]],   // w=0: bodyweight-style sets
    ])];
  }
  it('workedMuscles includes primary AND secondary muscles of zero-weight sets',()=>{
    const w=workedMuscles(bodyweightOnly());
    assert.ok(w.has('chest'),'chest worked');
    assert.ok(w.has('front delts'),'secondary front delts worked');
    assert.ok(w.has('triceps'),'secondary triceps worked');
  });
  it('muscleVolumes stays zero for zero-weight sets (no volume math change)',()=>{
    const v=muscleVolumes(bodyweightOnly());
    assert.equal(v['chest'],0);
  });
  it('muscleHeatmapMarkup renders the map with worked muscles when volume is all zero',()=>{
    const html=muscleHeatmapMarkup({chest:0},workedMuscles(bodyweightOnly()),false);
    assert.ok(html.includes('data-worked="chest'),'worked muscles ride in data-worked');
    assert.ok(!html.includes('No weighted training volume'),'no empty-state when sets were done');
    assert.ok(html.includes('Bodyweight work only'),'bodyweight-only note shown');
  });
  it('muscleHeatmapMarkup keeps the empty-state when nothing was worked at all',()=>{
    const html=muscleHeatmapMarkup({},new Set(),false);
    assert.ok(html.includes('No weighted training volume'),'true empty-state preserved');
  });
  it('muscleHeatmapMarkup passes an empty worked set through for weighted work',()=>{
    const html=muscleHeatmapMarkup({chest:1000},new Set(),false);
    assert.ok(html.includes('data-worked=""'),'empty worked attr');
    assert.ok(html.includes('Chest'),'weighted row still listed');
    assert.ok(!html.includes('Bodyweight work only'),'no bodyweight note for weighted work');
  });
  it('#170 follow-up: bodyweight-only note also renders in compact (Home) mode',()=>{
    const html=muscleHeatmapMarkup({chest:0},workedMuscles(bodyweightOnly()),true);
    assert.ok(html.includes('data-worked="chest'),'worked muscles ride in data-worked (compact)');
    assert.ok(html.includes('Bodyweight work only'),'bodyweight-only note shown in compact mode');
    assert.ok(!html.includes('No weighted training volume'),'no empty-state when sets were done (compact)');
  });
});

describe('#194 blindspotMuscles: bodyweight work is not a blind spot',()=>{
  it('excludes bodyweight-worked muscles (zero volume but worked)',()=>{
    const missing=blindspotMuscles({chest:0},new Set(['chest','front delts','triceps']));
    assert.ok(!missing.includes('chest'),'chest not a blind spot');
    assert.ok(!missing.includes('front delts'),'secondary front delts not a blind spot');
    assert.ok(!missing.includes('triceps'),'secondary triceps not a blind spot');
  });
  it('excludes worked muscles even when volumes has no entry for them',()=>{
    const missing=blindspotMuscles({},new Set(['hamstrings']));
    assert.ok(!missing.includes('hamstrings'),'worked hamstrings not a blind spot');
    assert.ok(missing.includes('biceps'),'unworked biceps still a blind spot');
  });
  it('still lists muscles with no work at all',()=>{
    const missing=blindspotMuscles({chest:5000},new Set(['chest']));
    assert.ok(missing.includes('biceps'),'unworked biceps listed');
    assert.ok(!missing.includes('chest'),'worked chest not listed');
  });
  it('tolerates a missing worked set',()=>{
    const missing=blindspotMuscles({},null);
    assert.ok(missing.includes('chest'),'everything unworked is a blind spot');
  });
});

describe('#195 openLogsForDashboardPeriod: Workouts card opens logs for the selected period',()=>{
  beforeEach(()=>{navCalls.length=0;state.dashboardPeriod='week';state.logPeriod='all';});
  it('sets the logs period to the dashboard period and opens the logs',()=>{
    state.dashboardPeriod='month';
    openLogsForDashboardPeriod();
    assert.equal(state.logPeriod,'month','logs period follows the dashboard');
    assert.deepEqual(navCalls,['persist','showWorkouts:false','showWorkoutHistory']);
  });
  it('follows each dashboard period',()=>{
    for(const period of ['today','year','all']){
      state.dashboardPeriod=period;navCalls.length=0;
      openLogsForDashboardPeriod();
      assert.equal(state.logPeriod,period,`logs period = ${period}`);
    }
  });
  it('falls back to week when the dashboard period is unset',()=>{
    state.dashboardPeriod=null;
    openLogsForDashboardPeriod();
    assert.equal(state.logPeriod,'week');
  });
});

'use strict';
/* #301 (user 2026-09-12): Recent workouts showed "1 sets" — the summary must
   read "1 set" for a single set. #302: timed-only workouts show total time,
   not "0 lb", in the same summary line. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* workoutSummary lives in workout-history.js (not in this role); inject a
   faithful fake so recentWorkoutButton's own formatting is what's tested. */
const fakeSummary=(sets,volume,timedOnly=false,totalSeconds=0)=>({sets,volume,muscles:[],totalSeconds,timedOnly});
const {recentWorkoutButton}=loadRole('workout-screen-logic',{globals:{
  exercises:[],
  /* formatVolume lives in dashboard-stats.js (not in this role); stub the
     "0 lb" shape the bug produced. */
  formatVolume:(v)=>`${Math.round(v)} lb`,
  workoutSummary:(workout)=>{
    const sets=workout.exercises.flatMap(i=>i.sets);
    const timed=sets.length>0&&sets.every(s=>Number(s.seconds)>0);
    return fakeSummary(sets.length,0,timed,sets.reduce((n,s)=>n+(Number(s.seconds)||0),0));
  },
}});

const mkWorkout=(sets)=>({id:'w1',name:'Workout',date:'2026-09-12',
  exercises:[{exerciseId:'x',sets}]});
const repSet=()=>({w:'135',r:'8',seconds:'',rpe:'',tags:[],complete:true});
const timedSet=(sec)=>({w:'',r:'',seconds:String(sec),rpe:'',tags:[],complete:true});

describe('recentWorkoutButton summary — #301 singular "1 set"',()=>{
  it('one set reads "1 set", not "1 sets"',()=>{
    const html=recentWorkoutButton(mkWorkout([repSet()]),'data-workout-id',null);
    assert.ok(html.includes('1 set ·'),'one set: '+html);
    assert.ok(!html.includes('1 sets'),'no "1 sets": '+html);
  });
  it('multiple sets keep the plural',()=>{
    const html=recentWorkoutButton(mkWorkout([repSet(),repSet()]),'data-workout-id',null);
    assert.ok(html.includes('2 sets ·'),'two sets: '+html);
  });
  it('timed-only shows total time instead of "0 lb" (#302)',()=>{
    const html=recentWorkoutButton(mkWorkout([timedSet(60),timedSet(45)]),'data-workout-id',null);
    assert.ok(html.includes('105 sec'),'total time: '+html);
    assert.ok(!html.includes('0 lb'),'no "0 lb": '+html);
  });
});

/* Browser QA 2026-09-12: the completed-workout summary card had the same
   bug — "1 completed sets" / "1 exercises". Static pin on the template
   (renderCompletedWorkout is DOM-heavy; the expressions are what's pinned). */
const fs2=require('node:fs'),path2=require('node:path');
const historyJs=fs2.readFileSync(path2.join(__dirname,'..','assets/js/workout-history.js'),'utf8');
describe('completed summary card — #301 singular',()=>{
  it('exercises metric singularizes',()=>{
    assert.ok(historyJs.includes("<span>exercise${workout.exercises.length===1?'':'s'}</span>"),'exercise singular: '+historyJs.slice(historyJs.indexOf('workout-detail-metric'),historyJs.indexOf('workout-detail-metric')+200));
  });
  it('completed-sets metric singularizes',()=>{
    assert.ok(historyJs.includes("<span>completed set${summary.sets===1?'':'s'}</span>"),'completed set singular');
  });
});

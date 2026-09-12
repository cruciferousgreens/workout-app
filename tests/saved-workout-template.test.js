'use strict';
/* Role: saved-workout-template — pins #240 (user 2026-09-12): after "Save as
   template" on a completed workout, the completed view's button becomes
   "Start" (wired to start the new template), and the template remembers its
   source log so re-renders keep offering Start instead of a duplicate save. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* Fake document: the completed view's save button, plus createElement for
   the Start-button swap. */
function fakeTemplateDocument(){
  const created=[];
  const btn={
    id:'saveCompletedWorkoutTop',className:'start-inline-button',
    textContent:'Save as template',replacedBy:null,
    replaceWith(el){this.replacedBy=el;},
    addEventListener(){},
  };
  return {
    created,btn,
    getElementById:id=>id==='saveCompletedWorkoutTop'?btn:(id==='appToast'?null:null),
    createElement(tag){
      const el={tag,type:'',id:'',className:'',textContent:'',
        _listeners:{},
        addEventListener(t,f){this._listeners[t]=f;},
        click(){if(this._listeners.click)this._listeners.click();}};
      created.push(el);return el;
    },
  };
}
const fakeDoc=fakeTemplateDocument();

const role=loadRole('saved-workout-template',{globals:{
  document:fakeDoc,
  /* persistence.js is not in this role — the save is a no-op here. */
  schedulePersist(){},
  /* cloneExerciseItem needs the workout-editor factories (DOM-heavy, not
     loaded here) — mirror the shapes like SHARE_FACTORY_STUBS does. */
  newSet(){return {uid:'set-test-'+Math.random().toString(36).slice(2),w:'',r:'',seconds:'',rpe:'',targetRpe:'',tags:[],complete:false};},
  newExerciseItem(opts){opts=opts||{};return {uid:'ex-test-'+Math.random().toString(36).slice(2),exerciseId:opts.exerciseId||'',tracking:opts.tracking||'reps',note:opts.note||'',noteOpen:false,exerciseTags:opts.exerciseTags||[],supersetId:opts.supersetId||null,progression:opts.progression||null,sets:opts.sets||[]};}
}});
const {saveCompletedAsTemplate}=role;
const {workoutState}=role;

const mkWorkout=()=>({id:'log-1',name:'Push Day',exercises:[
  {uid:'ex1',exerciseId:'bench',sets:[{uid:'s1',w:'135',r:'8',seconds:'',rpe:'',tags:[],complete:true}]},
]});

beforeEach(()=>{
  workoutState.templates.length=0;
  fakeDoc.btn.replacedBy=null;
  fakeDoc.btn.textContent='Save as template';
  fakeDoc.created.length=0;
});

describe('saveCompletedAsTemplate (#240)',()=>{
  it('stamps the source log id on the new template',()=>{
    const workout=mkWorkout();
    saveCompletedAsTemplate(workout,null);
    assert.equal(workoutState.templates.length,1);
    assert.equal(workoutState.templates[0].sourceLogId,'log-1');
  });
  it('swaps the completed view button to Start',()=>{
    const workout=mkWorkout();
    saveCompletedAsTemplate(workout,null);
    const start=fakeDoc.btn.replacedBy;
    assert.ok(start,'the old button node is replaced');
    assert.equal(start.textContent,'Start');
    assert.equal(start.id,'saveCompletedWorkoutTop','keeps the id so re-saves find it');
    assert.equal(typeof start._listeners.click,'function','the Start action is wired');
  });
  it('the new template is findable by its source log (render-time Start derivation)',()=>{
    const workout=mkWorkout();
    saveCompletedAsTemplate(workout,null);
    const template=workoutState.templates[0];
    const found=workoutState.templates.find(t=>t.sourceLogId===workout.id);
    assert.equal(found,template,'renderCompletedWorkout can derive the Start button from sourceLogId');
  });
  it('does nothing when the workout has no exercises',()=>{
    saveCompletedAsTemplate({id:'log-2',name:'Empty',exercises:[]},null);
    assert.equal(workoutState.templates.length,0);
    assert.equal(fakeDoc.btn.replacedBy,null,'no button swap');
  });
});

'use strict';
/* Role: workout-history-logic — pins the v1.010 phone-QA fixes (user 2026-09-12):
   #188 delete-from-logs landing (deleteCompletedWorkoutLanding), and #189
   no-second-modal after delete-empties (reviewDeleteEmptiesOutcome), plus the
   invalidSetsIn/isEmptySet rules both decisions rest on. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* Fixture catalog: equipment drives the bodyweight weight-optional rule. */
const catalog=[
  {id:'squat',name:'Barbell Squat',equipment:'barbell',tracking:'reps'},
  {id:'pushup',name:'Push-Up',equipment:'body only',tracking:'reps'},
  {id:'plank',name:'Plank',equipment:'body only',tracking:'time',force:'static'},
  /* #279: machine cardio — timed tracking, non-bodyweight equipment. */
  {id:'rower',name:'Rowing, Stationary',equipment:'machine',tracking:'time'},
];

const {invalidSetsIn,isEmptySet,deleteCompletedWorkoutLanding,reviewDeleteEmptiesOutcome,reviewSetsActions,dropInvalidSets,reviewSetsCopy,showReviewSetsDialog,state,workoutPRs,workoutState}
  =loadRole('workout-history-logic',{globals:{exercises:catalog,document:fakeReviewDocument()}});

/* #199 (user 2026-09-12): a fake document for the review dialog so the tests
   can pin the visual hierarchy — exactly one primary button, the rest
   secondary, "Keep editing" as a text link. The six dialog elements record
   what showReviewSetsDialog did to them; resetReviewDialog() clears them
   between opens. */
function fakeReviewDocument(){
  const els={};
  for(const id of ['reviewSetsCopy','reviewSetsComplete','reviewSetsFinishAnyway','reviewSetsDeleteUnfinished','reviewSetsDelete','reviewSetsCancel','reviewSetsDialog']){
    els['#'+id]={hidden:false,textContent:'',className:'',opened:false,showModal(){this.opened=true;}};
  }
  return {els,querySelector:sel=>els[sel]||null};
}
const reviewDoc=globalThis.document;
function resetReviewDialog(){
  for(const el of Object.values(reviewDoc.els)){el.hidden=false;el.textContent='';el.className='';el.opened=false;}
}
function openReviewDialog(draft){
  resetReviewDialog();
  const bad=invalidSetsIn(draft);
  const unmarked=draft.exercises.flatMap(item=>item.sets.map(set=>({set,item}))).filter(row=>!row.set.complete);
  showReviewSetsDialog(draft,bad,unmarked);
  return reviewDoc.els;
}
const reviewPrimaryButtons=els=>Object.entries(els)
  .filter(([sel,el])=>sel!=='#reviewSetsCopy'&&sel!=='#reviewSetsDialog'&&!el.hidden&&el.className.split(' ').includes('primary-button'))
  .map(([sel])=>sel);

const mkSet=(o={})=>({w:'',r:'',seconds:'',rpe:'',tags:[],complete:false,...o});
const mkItem=(exerciseId,sets,tracking)=>({exerciseId,tracking:tracking||'reps',sets});
const mkDraft=(exercises)=>({exercises});

beforeEach(()=>{state.workoutDetailReturn='workout';});

describe('isEmptySet',()=>{
  it('a fully blank set is empty',()=>{
    assert.equal(isEmptySet(mkSet()),true);
  });
  it('null/undefined values count as blank (#178)',()=>{
    assert.equal(isEmptySet({w:null,r:null,seconds:null,rpe:null,tags:[]}),true);
  });
  it('any entered value disqualifies the set',()=>{
    assert.equal(isEmptySet(mkSet({w:'135'})),false);
    assert.equal(isEmptySet(mkSet({r:'8'})),false);
    assert.equal(isEmptySet(mkSet({rpe:'8'})),false);
  });
  it('tags disqualify the set',()=>{
    assert.equal(isEmptySet(mkSet({tags:['warmup']})),false);
  });
});

describe('invalidSetsIn',()=>{
  it('a valid weighted set is not invalid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('squat',[mkSet({w:'135',r:'8',complete:true})])]));
    assert.equal(bad.length,0);
  });
  it('a weighted set missing weight is invalid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('squat',[mkSet({r:'8'})])]));
    assert.equal(bad.length,1);
  });
  it('a weighted set missing reps is invalid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('squat',[mkSet({w:'135'})])]));
    assert.equal(bad.length,1);
  });
  it('a bodyweight set with reps but no weight is valid (weight optional)',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('pushup',[mkSet({r:'12'})])]));
    assert.equal(bad.length,0);
  });
  it('a bodyweight set missing reps is invalid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('pushup',[mkSet()])]));
    assert.equal(bad.length,1);
  });
  it('an exercise with no sets is invalid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('squat',[])]));
    assert.equal(bad.length,1);
    assert.equal(bad[0].set,null);
  });
  it('#279: a timed machine-cardio set needs no weight (seconds suffice)',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('rower',[mkSet({seconds:'60'})],'time')]));
    assert.equal(bad.length,0);
  });
  it('#279: a timed machine-cardio set missing seconds is still invalid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('rower',[mkSet({w:'0'})],'time')]));
    assert.equal(bad.length,1);
  });
  it('#268: null/undefined RPE is optional, not invalid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('squat',[mkSet({w:'135',r:'8',rpe:null,complete:true})])]));
    assert.equal(bad.length,0,'null RPE ok');
    const bad2=invalidSetsIn(mkDraft([mkItem('squat',[mkSet({w:'135',r:'8',rpe:undefined,complete:true})])]));
    assert.equal(bad2.length,0,'undefined RPE ok');
  });
  it('#279: a timed machine-cardio set with weight stays valid',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('rower',[mkSet({w:'10',seconds:'60'})],'time')]));
    assert.equal(bad.length,0);
  });
  it('#279: a rep-tracked machine set still requires weight',()=>{
    const bad=invalidSetsIn(mkDraft([mkItem('rower',[mkSet({r:'10'})],'reps')]));
    assert.equal(bad.length,1);
  });
});

describe('deleteCompletedWorkoutLanding (#188)',()=>{
  it("deleting from the logs list returns to 'history'",()=>{
    state.workoutDetailReturn='history';
    assert.equal(deleteCompletedWorkoutLanding(),'history');
  });
  it('accepts the route-object form too',()=>{
    state.workoutDetailReturn={view:'history'};
    assert.equal(deleteCompletedWorkoutLanding(),'history');
  });
  it("deleting from the dashboard keeps the workout home ('workout')",()=>{
    state.workoutDetailReturn='dashboard';
    assert.equal(deleteCompletedWorkoutLanding(),'workout');
  });
  it("deleting from a fresh finish keeps the workout home ('workout')",()=>{
    state.workoutDetailReturn='workout';
    assert.equal(deleteCompletedWorkoutLanding(),'workout');
  });
  it('an unset return target keeps the workout home',()=>{
    state.workoutDetailReturn=undefined;
    assert.equal(deleteCompletedWorkoutLanding(),'workout');
  });
  it("deleting from exercise detail keeps the workout home ('workout')",()=>{
    state.workoutDetailReturn='exercise-detail';
    assert.equal(deleteCompletedWorkoutLanding(),'workout');
  });
});

describe('reviewDeleteEmptiesOutcome (#189)',()=>{
  it("all remaining sets value-valid (just unmarked) -> 'finish' — no second modal",()=>{
    /* The exact #189 repro: 1 empty set + 1 valid-but-unmarked set. After the
       handler deletes the empty one, the rest must finish, not re-prompt. */
    const remaining=[mkSet({w:'135',r:'8'})];
    assert.deepEqual(remaining.filter(s=>!isEmptySet(s)).length,1);
    const draft=mkDraft([mkItem('squat',remaining)]);
    assert.equal(invalidSetsIn(draft).length,0); /* nothing for a dialog to say */
    assert.equal(reviewDeleteEmptiesOutcome(draft),'finish');
  });
  it("a remaining partial-invalid set -> 'refinish' — it needs the user's eyes",()=>{
    const draft=mkDraft([mkItem('squat',[mkSet({w:'135'})])]); /* reps missing */
    assert.equal(reviewDeleteEmptiesOutcome(draft),'refinish');
  });
  it("nothing finishable left -> 'blocked'",()=>{
    const draft=mkDraft([]);
    assert.equal(reviewDeleteEmptiesOutcome(draft),'blocked');
  });
  it("completed sets are valid too -> 'finish'",()=>{
    const draft=mkDraft([mkItem('squat',[mkSet({w:'135',r:'8',complete:true})])]);
    assert.equal(reviewDeleteEmptiesOutcome(draft),'finish');
  });
  it("bodyweight valid sets -> 'finish'",()=>{
    const draft=mkDraft([mkItem('pushup',[mkSet({r:'12'})])]);
    assert.equal(reviewDeleteEmptiesOutcome(draft),'finish');
  });
});

describe('reviewSetsActions (user 2026-09-12 phone QA: always three actions when sets need review)',()=>{
  const partial=()=>mkSet({w:'100'}); /* weight entered, reps missing */
  const valid=()=>mkSet({w:'100',r:'8',complete:false});
  it("the user's all-partial scenario: Finish-anyway + Delete-unfinished-sets + Keep editing",()=>{
    const draft=mkDraft([mkItem('squat',Array.from({length:8},partial))]);
    const a=reviewSetsActions(draft);
    assert.equal(a.showFinishAnyway,true,'primary Finish anyway is offered');
    assert.equal(a.showDeleteUnfinished,true,'middle Delete unfinished sets is offered');
    assert.equal(a.dropsIncomplete,true,'dropping the partials is flagged destructive');
    assert.equal(a.showComplete,false,'nothing is finishable as-is');
    assert.equal(a.showDeleteEmptyExercises,false,'no empty exercises to remove');
  });
  it('mixed empty + partial: the same three actions',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet(),mkSet(),partial(),valid()])]);
    const a=reviewSetsActions(draft);
    assert.equal(a.showFinishAnyway,true);
    assert.equal(a.showDeleteUnfinished,true);
    assert.equal(a.dropsIncomplete,true);
    assert.equal(a.badCount,3);
  });
  it('all-empty: the middle option is NOT hidden — three actions here too',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet(),mkSet()])]);
    const a=reviewSetsActions(draft);
    assert.equal(a.showFinishAnyway,true);
    assert.equal(a.showDeleteUnfinished,true,'middle button shows even when every unfinished set is empty');
    assert.equal(a.dropsIncomplete,false,'dropping only empties is not flagged destructive');
    assert.equal(a.badCount,2);
  });
  it('valid-but-unmarked only: Mark all complete, no delete options',()=>{
    const draft=mkDraft([mkItem('squat',[valid(),valid()])]);
    const a=reviewSetsActions(draft);
    assert.equal(a.showComplete,true);
    assert.equal(a.showFinishAnyway,false);
    assert.equal(a.showDeleteUnfinished,false);
    assert.equal(a.showDeleteEmptyExercises,false);
  });
  it('an exercise with no sets offers Remove-empty-exercises, no set actions',()=>{
    const draft=mkDraft([mkItem('squat',[]),mkItem('squat',[valid()])]);
    const a=reviewSetsActions(draft);
    assert.equal(a.showFinishAnyway,false);
    assert.equal(a.showDeleteUnfinished,false,'no unfinished sets to delete');
    assert.equal(a.showDeleteEmptyExercises,true);
    assert.equal(a.deleteEmptyExercisesCount,1);
  });
});

describe('dropInvalidSets (v1.025: "Delete unfinished sets" drops empties AND partials, never nulls)',()=>{
  it('drops invalid sets and keeps the valid ones, with counts for the toast',()=>{
    const keep=mkSet({w:'100',r:'8'});
    const draft=mkDraft([mkItem('squat',[mkSet(),mkSet({w:'100'}),keep])]);
    const d=dropInvalidSets(draft);
    assert.equal(d.droppedSets,2);
    assert.equal(d.droppedEmptySets,1);
    assert.equal(d.droppedExercises,0);
    assert.equal(draft.exercises[0].sets.length,1);
    assert.equal(draft.exercises[0].sets[0],keep,'the valid set survives');
    assert.equal(invalidSetsIn(draft).length,0,'nothing invalid remains — no re-prompt');
  });
  it('removes exercises left with no sets',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet()]),mkItem('squat',[mkSet({w:'100',r:'8'})])]);
    const d=dropInvalidSets(draft);
    assert.equal(d.droppedExercises,1);
    assert.equal(draft.exercises.length,1);
  });
});

describe('reviewSetsActions primaryAction (user 2026-09-12 phone QA: "Finish anyway" is primary)',()=>{
  const partial=()=>mkSet({w:'100'}); /* weight entered, reps missing */
  const valid=()=>mkSet({w:'100',r:'8',complete:false});
  it("the user's all-partial scenario: Finish anyway is primary, Delete unfinished sets never is",()=>{
    const draft=mkDraft([mkItem('squat',Array.from({length:8},partial))]);
    assert.equal(reviewSetsActions(draft).primaryAction,'finish');
  });
  it('mixed empty + partial: Finish anyway is primary',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet(),mkSet(),partial(),valid()])]);
    assert.equal(reviewSetsActions(draft).primaryAction,'finish');
  });
  it('all-empty: Finish anyway is primary',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet(),mkSet()])]);
    assert.equal(reviewSetsActions(draft).primaryAction,'finish');
  });
  it('valid-but-unmarked: Mark all complete is primary',()=>{
    const draft=mkDraft([mkItem('squat',[valid(),valid()])]);
    assert.equal(reviewSetsActions(draft).primaryAction,'complete');
  });
  it('empty exercises: the remove-exercises action is primary',()=>{
    /* The companion set is complete so the mark-all-complete path stays out
       of this scenario. */
    const done=()=>mkSet({w:'100',r:'8',complete:true});
    const draft=mkDraft([mkItem('squat',[]),mkItem('squat',[done()])]);
    assert.equal(reviewSetsActions(draft).primaryAction,'delete');
  });
});

describe('reviewSetsCopy (user 2026-09-12 phone QA: short, plain-language; the dropped sentence is gone)',()=>{
  const partial=()=>mkSet({w:'100'});
  const valid=()=>mkSet({w:'100',r:'8',complete:false});
  const copyFor=draft=>reviewSetsCopy(draft,reviewSetsActions(draft));
  const DROPPED_SENTENCE=/they'll be dropped, nothing is saved half-filled/;
  it("the user's all-partial scenario states what's missing — nothing more",()=>{
    const draft=mkDraft([mkItem('squat',Array.from({length:8},partial))]);
    const copy=copyFor(draft);
    assert.equal(copy,'8 sets are missing reps, seconds, or weight.');
    assert.ok(!DROPPED_SENTENCE.test(copy),'the dropped sentence is gone');
    assert.ok(!/keep editing/i.test(copy),'the actions speak for themselves');
  });
  it('all-empty is one short sentence',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet(),mkSet()])]);
    const copy=copyFor(draft);
    assert.equal(copy,'2 sets are completely empty.');
    assert.ok(!DROPPED_SENTENCE.test(copy));
  });
  it('mixed empty + partial distinguishes the two problems, plainly',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet(),partial(),valid()])]);
    const copy=copyFor(draft);
    assert.equal(copy,'Some sets are empty and others are missing reps, seconds, or weight.');
    assert.ok(!DROPPED_SENTENCE.test(copy));
  });
  it('valid-but-unmarked is one short sentence',()=>{
    const draft=mkDraft([mkItem('squat',[valid(),valid()])]);
    const copy=copyFor(draft);
    assert.equal(copy,"2 sets aren't marked complete yet.");
  });
  it('an exercise with no sets is explained',()=>{
    const done=()=>mkSet({w:'100',r:'8',complete:true});
    const draft=mkDraft([mkItem('squat',[]),mkItem('squat',[done()])]);
    const copy=copyFor(draft);
    assert.equal(copy,'1 exercise has no sets.');
  });
  it('bad sets plus an empty exercise names both',()=>{
    const draft=mkDraft([mkItem('squat',[]),mkItem('squat',[partial()])]);
    const copy=copyFor(draft);
    assert.equal(copy,'1 set is missing reps, seconds, or weight. 1 exercise has no sets.');
  });
});

describe('showReviewSetsDialog (user 2026-09-12 phone QA: always three actions)',()=>{
  const partial=()=>mkSet({w:'100'});
  const valid=()=>mkSet({w:'100',r:'8',complete:false});
  /* The three visible actions, in DOM order, for the bad-sets variants. */
  const threeActions=els=>{
    const order=['#reviewSetsComplete','#reviewSetsFinishAnyway','#reviewSetsDeleteUnfinished','#reviewSetsDelete','#reviewSetsCancel'];
    return order.filter(sel=>!els[sel].hidden);
  };
  it("the user's all-partial scenario: primary 'Finish anyway', middle 'Delete 8 unfinished sets', Keep editing last",()=>{
    const els=openReviewDialog(mkDraft([mkItem('squat',Array.from({length:8},partial))]));
    assert.deepEqual(threeActions(els),['#reviewSetsFinishAnyway','#reviewSetsDeleteUnfinished','#reviewSetsCancel']);
    assert.deepEqual(reviewPrimaryButtons(els),['#reviewSetsFinishAnyway'],'exactly one primary button');
    assert.equal(els['#reviewSetsFinishAnyway'].textContent,'Finish anyway','no appended clause');
    assert.ok(!els['#reviewSetsFinishAnyway'].textContent.includes('—'),'no em-dash clause');
    assert.equal(els['#reviewSetsDeleteUnfinished'].textContent,'Delete 8 unfinished sets');
    assert.equal(els['#reviewSetsDeleteUnfinished'].className,'secondary-button danger-button','middle is secondary, flagged destructive');
    assert.equal(els['#reviewSetsCancel'].className,'text-link','Keep editing is a quiet text button');
    assert.equal(els['#reviewSetsCopy'].textContent,'8 sets are missing reps, seconds, or weight.');
    assert.equal(els['#reviewSetsDialog'].opened,true,'the single dialog opens');
  });
  it('all-empty: the same three actions — the middle option is not hidden',()=>{
    const els=openReviewDialog(mkDraft([mkItem('squat',[mkSet(),mkSet()])]));
    assert.deepEqual(threeActions(els),['#reviewSetsFinishAnyway','#reviewSetsDeleteUnfinished','#reviewSetsCancel']);
    assert.deepEqual(reviewPrimaryButtons(els),['#reviewSetsFinishAnyway']);
    assert.equal(els['#reviewSetsFinishAnyway'].textContent,'Finish anyway');
    assert.equal(els['#reviewSetsDeleteUnfinished'].textContent,'Delete 2 unfinished sets');
    assert.equal(els['#reviewSetsDeleteUnfinished'].className,'secondary-button','dropping only empties is not flagged dangerous');
    assert.equal(els['#reviewSetsCancel'].className,'text-link');
    assert.equal(els['#reviewSetsCopy'].textContent,'2 sets are completely empty.');
  });
  it('valid-but-unmarked: Mark all complete is primary, delete actions hidden',()=>{
    const els=openReviewDialog(mkDraft([mkItem('squat',[valid(),valid()])]));
    assert.deepEqual(threeActions(els),['#reviewSetsComplete','#reviewSetsCancel']);
    assert.deepEqual(reviewPrimaryButtons(els),['#reviewSetsComplete']);
    assert.equal(els['#reviewSetsFinishAnyway'].hidden,true);
    assert.equal(els['#reviewSetsDeleteUnfinished'].hidden,true);
    assert.equal(els['#reviewSetsDelete'].hidden,true);
    assert.equal(els['#reviewSetsCancel'].className,'text-link');
    assert.equal(els['#reviewSetsCopy'].textContent,"2 sets aren't marked complete yet.");
  });
  it('mixed: primary Finish anyway, middle Delete 3 unfinished sets + destructive, Keep editing last',()=>{
    const els=openReviewDialog(mkDraft([mkItem('squat',[mkSet(),mkSet(),partial(),valid()])]));
    assert.deepEqual(threeActions(els),['#reviewSetsFinishAnyway','#reviewSetsDeleteUnfinished','#reviewSetsCancel']);
    assert.deepEqual(reviewPrimaryButtons(els),['#reviewSetsFinishAnyway']);
    assert.equal(els['#reviewSetsFinishAnyway'].textContent,'Finish anyway');
    assert.equal(els['#reviewSetsDeleteUnfinished'].textContent,'Delete 3 unfinished sets');
    assert.equal(els['#reviewSetsDeleteUnfinished'].className,'secondary-button danger-button');
    assert.equal(els['#reviewSetsCancel'].className,'text-link');
    assert.equal(els['#reviewSetsCopy'].textContent,'Some sets are empty and others are missing reps, seconds, or weight.');
  });
  it('empty exercise only: Remove-empty-exercises primary + Keep editing',()=>{
    const done=()=>mkSet({w:'100',r:'8',complete:true});
    const els=openReviewDialog(mkDraft([mkItem('squat',[]),mkItem('squat',[done()])]));
    assert.deepEqual(threeActions(els),['#reviewSetsDelete','#reviewSetsCancel']);
    assert.deepEqual(reviewPrimaryButtons(els),['#reviewSetsDelete']);
    assert.equal(els['#reviewSetsDelete'].textContent,'Remove 1 empty exercise');
    assert.equal(els['#reviewSetsCopy'].textContent,'1 exercise has no sets.');
  });
  it('reopening the dialog leaves no stale visibility or styling behind',()=>{
    /* Open for mixed (finish primary, middle visible + danger), then for
       valid-but-unmarked: finish/middle/delete must hide again and the
       primary must move — classes are set fresh on every open. */
    openReviewDialog(mkDraft([mkItem('squat',[mkSet(),partial(),valid()])]));
    const els=openReviewDialog(mkDraft([mkItem('squat',[valid(),valid()])]));
    assert.deepEqual(reviewPrimaryButtons(els),['#reviewSetsComplete']);
    assert.equal(els['#reviewSetsFinishAnyway'].hidden,true);
    assert.equal(els['#reviewSetsDeleteUnfinished'].hidden,true);
    assert.equal(els['#reviewSetsDelete'].hidden,true);
    assert.equal(els['#reviewSetsComplete'].className,'primary-button');
  });
});

describe('workoutPRs — #282 timed PRs in the post-workout summary',()=>{
  const timedLog=(id,date,sets)=>({id,date,completedAt:`${date}T12:00:00.000Z`,name:'W',
    exercises:[{exerciseId:'plank',tracking:'time',sets:sets.map(s=>({w:s.w??null,r:null,seconds:s.seconds,rpe:null,tags:[],complete:true}))}]});
  beforeEach(()=>{workoutState.completed=[];});
  it('a longer hold than prior sessions lists a longest-hold PR',()=>{
    const prior=timedLog('w1','2026-09-10',[{seconds:60}]);
    const cur=timedLog('w2','2026-09-11',[{seconds:75}]);
    workoutState.completed=[cur,prior];
    assert.deepEqual(workoutPRs(cur),['Plank · longest hold PR']);
  });
  it('no improvement → no PR entry',()=>{
    const prior=timedLog('w1','2026-09-10',[{seconds:60}]);
    const cur=timedLog('w2','2026-09-11',[{seconds:45}]);
    workoutState.completed=[cur,prior];
    assert.deepEqual(workoutPRs(cur),[]);
  });
  it('first timed session (no prior) → no PR entry',()=>{
    const cur=timedLog('w2','2026-09-11',[{seconds:75}]);
    workoutState.completed=[cur];
    assert.deepEqual(workoutPRs(cur),[]);
  });
});

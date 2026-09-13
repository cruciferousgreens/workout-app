'use strict';
/* Role: workout-screen-logic — pins the #187 rule (user 2026-09-12): the logs
   list opens over a live draft; the draft is untouched underneath and backing
   out returns to the editor because workoutEditorOpen is never cleared by the
   list. Plus the #196 no-program home layout decision (workoutHomeLayout). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const {workoutPaneSelection,workoutHomeLayout,setDeleteScrollTarget,liveSetRowHtml,newSet}=loadRole('workout-screen-logic',{globals:{exercises:[
  {id:'squat',name:'Barbell Squat',equipment:'barbell'},
  {id:'pushup',name:'Push-Up',equipment:'body only'},
  /* getExerciseLogs lives in exercise-library.js (not in this role); the row
     tests run with no history, so it returns none. */
],getExerciseLogs:()=>[]}});

const base={hasDraft:false,editorRequested:false,historyOpen:false,completeVisible:false,shareOpen:false,savedOpen:false,builderOpen:false};

describe('workoutPaneSelection (#187)',()=>{
  it('opens the logs list over a live draft; the editor pane yields',()=>{
    const p=workoutPaneSelection({...base,hasDraft:true,editorRequested:true,historyOpen:true});
    assert.equal(p.viewingHistory,true);
    assert.equal(p.editorOpen,false);
    assert.equal(p.showingStart,false);
  });
  it('keeps the editor when no list is requested',()=>{
    const p=workoutPaneSelection({...base,hasDraft:true,editorRequested:true});
    assert.equal(p.editorOpen,true);
    assert.equal(p.viewingHistory,false);
    assert.equal(p.showingStart,false);
  });
  it('a tab tap with a draft (#129) lands on the start screen, not the editor',()=>{
    /* Tab taps clear workoutHistoryOpen and workoutEditorOpen, so a draft
       lands on the start screen with the Continue card. */
    const p=workoutPaneSelection({...base,hasDraft:true,editorRequested:false});
    assert.equal(p.showingStart,true);
    assert.equal(p.editorOpen,false);
    assert.equal(p.viewingHistory,false);
  });
  it('opens the list with no draft exactly as before',()=>{
    const p=workoutPaneSelection({...base,historyOpen:true});
    assert.equal(p.viewingHistory,true);
    assert.equal(p.showingStart,false);
  });
  it('a completed review still wins over the list',()=>{
    const p=workoutPaneSelection({...base,historyOpen:true,completeVisible:true});
    assert.equal(p.viewingComplete,true);
    assert.equal(p.viewingHistory,false);
  });
  it('a completed review never shows over a draft',()=>{
    const p=workoutPaneSelection({...base,hasDraft:true,editorRequested:true,completeVisible:true});
    assert.equal(p.viewingComplete,false);
    assert.equal(p.editorOpen,true);
  });
  it('#214: the share preview opens over the live editor without killing the draft',()=>{
    const p=workoutPaneSelection({...base,hasDraft:true,editorRequested:true,shareOpen:true});
    assert.equal(p.editorOpen,false);
    assert.equal(p.viewingShare,true);
  });
  it('the saved-workout editor is reachable with no draft',()=>{
    const p=workoutPaneSelection({...base,savedOpen:true});
    assert.equal(p.viewingSaved,true);
    assert.equal(p.showingStart,false);
  });
});

describe('workoutHomeLayout (#196)',()=>{
  it('no program: no next-in-program card; blank is the hero; create-a-program shows',()=>{
    assert.deepEqual(workoutHomeLayout({hasProgram:false,hasLastWorkout:true}),{
      showNextInProgram:false,blankAsHero:true,showCreateProgram:true,showRepeatLast:true,
    });
  });
  it('fresh user: no repeat-last card',()=>{
    assert.equal(workoutHomeLayout({hasProgram:false,hasLastWorkout:false}).showRepeatLast,false);
    assert.equal(workoutHomeLayout({hasProgram:true,hasLastWorkout:false}).showRepeatLast,false);
  });
  it('with a program and history: unchanged layout',()=>{
    assert.deepEqual(workoutHomeLayout({hasProgram:true,hasLastWorkout:true}),{
      showNextInProgram:true,blankAsHero:false,showCreateProgram:false,showRepeatLast:true,
    });
  });
});

describe('setDeleteScrollTarget (#198: no scroll jump on set delete)',()=>{
  it('a row removed above the viewport shifts scroll up by the row height',()=>{
    assert.equal(setDeleteScrollTarget(100,60,400),340);
  });
  it('the compensation never scrolls below zero',()=>{
    assert.equal(setDeleteScrollTarget(10,60,40),0);
  });
  it('a row at or below the viewport top leaves scrollY untouched',()=>{
    assert.equal(setDeleteScrollTarget(400,60,400),null);
    assert.equal(setDeleteScrollTarget(500,60,400),null);
  });
});

describe('addWorkoutSet (#145: no scroll jump on + Add set)',()=>{
  /* Structural pin: "+ Add set" in a live workout rebuilt the whole
     exercise list via renderWorkoutExercises() — the same full-render
     mechanism as the old #198 delete path (innerHTML swap + scrollTo =
     scroll jump). Now the new row is appended in place; the full render
     survives only as the set-list-not-found fallback. */
  const src=fs.readFileSync(path.join(__dirname,'..','assets','js','workout-editor.js'),'utf8');
  const start=src.indexOf('    function addWorkoutSet(');
  const fn=src.slice(start,src.indexOf('\n    function ',start+10));
  it('appends the new row in place instead of rebuilding the exercise list',()=>{
    assert.ok(start>0,'addWorkoutSet exists');
    assert.ok(fn.includes("insertAdjacentHTML('beforeend',liveSetRowHtml(item,set,item.sets.length-1))"),'appends the new row');
    assert.ok(fn.includes('wireLiveSetTags(rowEl)'),'wires the new row');
    assert.ok(fn.includes('attachSwipeDelete(list)'),'wires swipe for the new row');
  });
  it('the only full re-render is the set-list-not-found fallback',()=>{
    assert.ok(fn.includes('if(!list){renderWorkoutExercises();markDraftSaved();return;}'),'fallback kept');
    const withoutFallback=fn.replace('if(!list){renderWorkoutExercises();markDraftSaved();return;}','');
    assert.ok(!withoutFallback.includes('renderWorkoutExercises()'),'no full re-render on the add path');
  });
  it('the + Add set click handler delegates to addWorkoutSet',()=>{
    const wstart=src.indexOf('    function wireLiveAddSet(){');
    const wfn=src.slice(wstart,src.indexOf('\n    function ',wstart+10));
    assert.ok(wfn.includes('addWorkoutSet(button.dataset.uid)'));
    assert.ok(!wfn.includes('renderWorkoutExercises()'));
  });
});

describe('liveSetRowHtml (#145: the appended row matches the rendered rows)',()=>{
  const item={uid:'ex1',exerciseId:'squat',sets:[],progression:null,suggestedTarget:null};
  it('renders the row the wire helpers expect',()=>{
    const set=newSet();
    const html=liveSetRowHtml(item,set,2); /* third set */
    assert.ok(html.includes(`data-set-swipe="${set.uid}"`),'row carries the set uid');
    assert.ok(html.includes('>3</button>'),'set number button shows index+1');
    assert.ok(html.includes(`data-tag-set-uid="${set.uid}"`),'tag popup hook');
    assert.ok(html.includes('data-field="w"'),'weight input hook');
    assert.ok(html.includes('class="complete-set"'),'complete checkbox hook');
    assert.ok(html.includes('delete-set-swipe')&&html.includes('delete-set-inline'),'both delete hooks');
    assert.ok(html.includes('swipe-item set-swipe'),'swipe wrapper');
    assert.ok(html.includes('aria-label="Delete set 3"'),'labels use the 1-based number');
  });
  it('a bodyweight exercise renders the same row the card would',()=>{
    const bw={uid:'ex2',exerciseId:'pushup',sets:[],progression:null,suggestedTarget:null};
    const set=newSet();
    const html=liveSetRowHtml(bw,set,0);
    assert.ok(html.includes('Optional'),'bodyweight weight placeholder');
    assert.ok(html.includes(`data-set-uid="${set.uid}"`));
  });
});

describe('deleteWorkoutSet (#198: no flash, scroll jump, or auto-expanding)',()=>{
  /* Structural pin: deleting a set must remove only the affected node in
     place. The old full renderWorkoutExercises() rebuild (innerHTML swap +
     listener rewiring + scrollTo) caused the flash, the scroll jump, and
     rebuilt <details> elements losing their expansion state. The full render
     survives only as the not-found fallback. */
  const src=fs.readFileSync(path.join(__dirname,'..','assets','js','workout-editor.js'),'utf8');
  const start=src.indexOf('    function deleteWorkoutSet(');
  const fn=src.slice(start,src.indexOf('\n    function ',start+10));
  it('removes the set node in place instead of rebuilding the exercise list',()=>{
    assert.ok(start>0,'deleteWorkoutSet exists');
    assert.ok(fn.includes('removedEl.remove()'),'the set row/card is removed in place');
    assert.ok(fn.includes('setDeleteScrollTarget'),'scroll is compensated for the removed height');
  });
  it('the only full re-render is the row-not-found fallback',()=>{
    const withoutFallback=fn.replace(/const fullRender=\(\)=>\{[^}]*\};/,'');
    assert.ok(!withoutFallback.includes('renderWorkoutExercises()'),'no full re-render on the delete path');
    assert.ok(fn.includes('if(!row||!card){'),'the fallback only runs when the row is missing from the DOM');
  });
});

describe('completed-set checkbox (#242 corrected: tappable to uncheck; other fields frozen)',()=>{
  const item={uid:'ex1',exerciseId:'squat',sets:[],progression:null,suggestedTarget:null};
  it('a completed set renders a tappable checkbox, frozen inputs, and an uncomplete number button',()=>{
    const set=newSet();set.complete=true;set.w='135';set.r='8';
    const html=liveSetRowHtml(item,set,0);
    assert.ok(html.includes('class="complete-set"'),'checkbox hook present');
    assert.ok(!/class="complete-set"[^>]*disabled/.test(html),'completed checkbox stays tappable (can uncheck)');
    assert.ok(html.includes('aria-label="Mark set incomplete"'),'checkbox labels the uncheck action');
    assert.ok(html.includes('data-uncomplete="1"'),'number button carries the uncomplete marker');
    assert.ok(html.includes('aria-label="Mark set 1 incomplete"'),'number button labels the unlock');
  });
  it('an incomplete set renders a live checkbox and the tag-opener number button',()=>{
    const set=newSet();
    const html=liveSetRowHtml(item,set,0);
    assert.ok(!/class="complete-set"[^>]*disabled/.test(html),'incomplete checkbox stays tappable');
    assert.ok(!html.includes('data-uncomplete="1"'),'no uncomplete marker');
    assert.ok(html.includes('aria-label="Choose tags for set 1"'),'number button opens tags');
  });
  it('wireLiveSetTags intercepts the uncomplete marker instead of opening tags',()=>{
    /* Structural pin: the number-button click handler must branch on
       data-uncomplete to uncompleteDraftSet — otherwise a completed set's
       number button would open the tag dialog and the unlock path would be
       dead. */
    const src=fs.readFileSync(path.join(__dirname,'..','assets','js','workout-editor.js'),'utf8');
    const start=src.indexOf('    function wireLiveSetTags(');
    const fn=src.slice(start,src.indexOf('\n    function ',start+10));
    assert.ok(start>0,'wireLiveSetTags exists');
    assert.ok(fn.includes('data-uncomplete'),'handler checks the uncomplete marker');
    assert.ok(fn.includes('uncompleteDraftSet'),'handler calls the deliberate uncomplete path');
    assert.ok(fn.includes('openTagDialog'),'non-frozen buttons still open tags');
  });
});

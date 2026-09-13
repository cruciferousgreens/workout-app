
/* ===== module: workout-history.js ===== */
    /** Finalizes editable workout records and renders detailed set-by-set history. */
    /* Module map (v1.006) — Key: finishWorkout(), renderCompletedWorkout(), workoutSummary(), editCompletedWorkout(), invalidSetsIn(). Depends on: workout-editor render + factories, state, persistence, utilities (detectExercisePRs, dates). */
    let pendingDeleteCompletedWorkoutId=null;
    /* #188 (user 2026-09-12): where to land after deleting a completed
       workout. Deleting from the logs list returns to the logs list;
       every other context keeps the #83 behavior (the Workout page).
       Pure so the rule is unit-testable. */
    function deleteCompletedWorkoutLanding(){
      return returnRouteKey(state.workoutDetailReturn)===ROUTES.DETAIL_RETURN.HISTORY?'history':'workout';
    }
    $('#cancelDeleteCompletedWorkout')?.addEventListener('click',()=>$('#deleteCompletedWorkoutDialog').close());
    $('#keepCompletedWorkout')?.addEventListener('click',()=>$('#deleteCompletedWorkoutDialog').close());
    $('#confirmDeleteCompletedWorkout')?.addEventListener('click',()=>{
      $('#deleteCompletedWorkoutDialog').close();
      if(pendingDeleteCompletedWorkoutId){
        /* A3 (#99): record a tombstone so the delete propagates through sync
           instead of being resurrected by another device's copy. */
        if(typeof noteTombstone==='function')noteTombstone('completed',pendingDeleteCompletedWorkoutId);
        workoutState.completed=workoutState.completed.filter(w=>w.id!==pendingDeleteCompletedWorkoutId);
        schedulePersist();
        $('#workoutComplete').hidden=true;
        /* #188: mirror the Back registry's HISTORY destination instead of
           unconditionally landing on the workout home (#83 keeps the rest). */
        if(deleteCompletedWorkoutLanding()==='history'){state.workoutHistoryOpen=true;renderWorkoutScreen();}
        else showWorkouts(false);
        renderDashboard();
      }
      pendingDeleteCompletedWorkoutId=null;
    });
    /** Sets missing required values (reps/seconds, weight for weighted
        exercises, or exercises with no sets at all). Powers the "Unfilled
        sets" dialog (user 2026-09-10). */
    function invalidSetsIn(draft){
      const rows=[];
      (draft?.exercises||[]).forEach(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        /* #279: weight is optional for timed tracking regardless of equipment (machine cardio logs seconds, not load). */
        const tracking=exerciseTracking(item,ex), weightOptional=ex?.equipment==='body only'||tracking==='time';
        if(!item.sets.length){rows.push({item,set:null});return;}
        item.sets.forEach(set=>{
          /* A10 (#99): Number('garbage') is NaN and NaN comparisons are
             false, so non-numeric input used to pass as valid. */
          const perf=tracking==='time'?set.seconds:set.r;
          const bad=(!weightOptional&&set.w==='')||perf===''||!Number.isFinite(Number(set.w||0))||Number(set.w||0)<0||!Number.isFinite(Number(perf))||Number(perf)<1||/* #268: legacy/imported sets may carry rpe:null — treat null/undefined like '' (RPE is optional). */(set.rpe!==''&&set.rpe!=null&&(!Number.isFinite(Number(set.rpe))||Number(set.rpe)<1||Number(set.rpe)>10));
          if(bad)rows.push({item,set});
        });
      });
      return rows;
    }
    /* #43: a set is only bulk-deletable when it holds no user-entered data at
       all — no values and no tags. Sets with partial values are never silently
       deleted (that path produced nulls); they must be marked complete or kept
       for editing. */
    function isEmptySet(set){
      /* #178: null/undefined count as blank too (legacy/imported sets may
         lack the '' initializer) — only genuinely user-entered data
         disqualifies a set from being "empty". */
      const blank=v=>v===''||v==null;
      return set&&blank(set.w)&&blank(set.r)&&blank(set.seconds)&&blank(set.rpe)&&!(set.tags?.length);
    }
    /* Finalizes the live draft into workoutState.completed (PR detection + review
       prompt), then resets the draft. */
    /* The single review prompt (#43): covers both problem kinds (unfilled
       values and unmarked sets) in one dialog. Extracted so the
       delete-empties action can re-show it directly (#189) instead of
       re-running finishWorkout and stacking a second modal. */
    /* #199 (user 2026-09-12): the review dialog's action contract — pure so
       tests pin which actions appear for every invalid-set shape.
       - "Mark all complete": only when every set is value-valid (just
         unmarked) — never-nulls (user 2026-09-11).
       - "Delete N empty sets" / "Remove N empty exercises": only fully-empty
         targets (#43 — never partial values, never silent).
       - "Finish anyway" (user 2026-09-13, #262): the primary whenever sets
         need review. Deletes every unfinished set (empty AND incomplete) and
         finishes in one tap — it never re-prompts or returns to editing.
         Partial values are dropped, never saved half-filled. The old middle
         "Delete N unfinished sets" button ran this same operation and is gone.
       - "Keep editing": a real secondary button next to "Finish anyway" when
         sets need review; a quiet text link in the other variants.
       Exactly one dialog is ever shown (#189). */
    function reviewSetsActions(draft){
      const invalid=invalidSetsIn(draft);
      const badSets=new Set(invalid.map(row=>row.set).filter(Boolean));
      const emptyCount=invalid.filter(row=>!row.set).length;
      const showComplete=badSets.size===0&&draft.exercises.some(item=>item.sets.some(set=>!set.complete));
      /* User 2026-09-13 (#262): whenever sets need review the dialog shows
         exactly two actions — primary "Finish anyway" and "Keep editing". The
         old middle "Delete N unfinished sets" button ran the identical
         operation under a vaguer label, so it is gone. */
      const showFinishAnyway=badSets.size>0;
      const showDeleteEmptyExercises=badSets.size===0&&emptyCount>0;
      return {
        badCount:badSets.size,
        showComplete,
        showFinishAnyway,
        showDeleteEmptyExercises,
        deleteEmptyExercisesCount:emptyCount,
        /* Exactly one primary button. "Finish anyway" is the primary whenever
           sets need review. */
        primaryAction:showComplete?'complete':showFinishAnyway?'finish':showDeleteEmptyExercises?'delete':null,
      };
    }
    /* #199: "Finish anyway" drops every invalid set (empty AND incomplete) —
       partial values are dropped, never serialized half-filled. Pure over
       the draft; returns what was dropped for the confirmation toast. */
    function dropInvalidSets(draft){
      const badSetObjs=new Set(invalidSetsIn(draft).map(row=>row.set).filter(Boolean));
      let droppedSets=0,droppedEmptySets=0;
      draft.exercises.forEach(item=>{
        item.sets=item.sets.filter(set=>{
          if(!badSetObjs.has(set))return true;
          droppedSets++;
          if(isEmptySet(set))droppedEmptySets++;
          return false;
        });
      });
      const beforeEx=draft.exercises.length;
      draft.exercises=draft.exercises.filter(item=>item.sets.length);
      return {droppedSets,droppedEmptySets,droppedExercises:beforeEx-draft.exercises.length};
    }
    /* User 2026-09-13 (#262): the user's copy. The count covers every
       unfinished set; "Finish anyway" deletes them and finishes — nothing is
       ever saved half-filled. Pure so tests pin the wording. */
    function reviewSetsCopy(draft,actions){
      const n=actions.badCount, exN=actions.deleteEmptyExercisesCount;
      if(actions.showComplete){
        const unmarked=draft.exercises.flatMap(item=>item.sets).filter(set=>!set.complete).length;
        return `${unmarked} set${unmarked===1?'':'s'} ${unmarked===1?"isn't":"aren't"} marked complete yet.`;
      }
      const parts=[];
      if(n>0)parts.push(`${n} set${n===1?' is':'s are'} missing… Clicking Finish will delete your sets.`);
      if(exN>0)parts.push(`${exN} exercise${exN===1?' has':'s have'} no sets.`);
      return parts.join(' ');
    }
    function showReviewSetsDialog(draft,bad,unmarked){
      const actions=reviewSetsActions(draft);
      $('#reviewSetsCopy').textContent=reviewSetsCopy(draft,actions);
      const primary=actions.primaryAction;
      /* User 2026-09-13 (#262): whenever sets need review the dialog shows
         exactly two actions — primary "Finish anyway" and "Keep editing" as a
         real secondary button. Classes are set fresh on every open so no
         stale visibility or styling survives between openings. */
      /* user 2026-09-11: never save null data. "Mark all complete" is only
         offered when every set has valid values (just unmarked) — if any set
         is missing values, the button hides so the user must fix or delete
         the bad sets instead of saving nulls. */
      const completeBtn=$('#reviewSetsComplete');
      completeBtn.hidden=!actions.showComplete;
      if(actions.showComplete)completeBtn.className=primary==='complete'?'primary-button':'secondary-button';
      /* User 2026-09-12 (phone QA): the primary finish button says exactly
         "Finish anyway" — no appended "— drop N incomplete" clause. */
      const finishBtn=$('#reviewSetsFinishAnyway');
      finishBtn.hidden=!actions.showFinishAnyway;
      if(actions.showFinishAnyway){
        finishBtn.textContent='Finish anyway';
        finishBtn.className=primary==='finish'?'primary-button':'secondary-button';
      }
      /* The delete action only survives for the empty-exercise case (no bad
         sets, just an exercise with no sets) — never sets with partial
         values, so no user-entered data is silently lost. It carries no
         danger styling. Hidden otherwise. */
      const deleteBtn=$('#reviewSetsDelete');
      const deleteVisible=actions.showDeleteEmptyExercises;
      deleteBtn.hidden=!deleteVisible;
      if(deleteVisible){
        deleteBtn.textContent=`Remove ${actions.deleteEmptyExercisesCount} empty exercise${actions.deleteEmptyExercisesCount===1?'':'s'}`;
        deleteBtn.className=primary==='delete'?'primary-button':'secondary-button';
      }
      /* User 2026-09-13 (#262): "Keep editing" is a real secondary button next
         to "Finish anyway" when sets need review; a quiet text link in the
         other variants. */
      $('#reviewSetsCancel').className=actions.showFinishAnyway?'secondary-button':'text-link';
      $('#reviewSetsDialog').showModal();
    }
    /* #189 (user 2026-09-12): after "Finish and delete empty sets", the
       finish must not re-prompt when everything left is value-valid.
       'refinish' — something still has invalid values and genuinely needs
       the user's eyes: re-show the ONE review dialog. 'finish' — all
       remaining sets are value-valid: mark them complete and finish.
       'blocked' — nothing finishable left (all exercises were empty). */
    function reviewDeleteEmptiesOutcome(draft){
      if(invalidSetsIn(draft).length)return 'refinish';
      if(!draft.exercises.length)return 'blocked';
      return 'finish';
    }
    function finishWorkout(skipReview,opts={}) {
      const draft = workoutState.draft;
      /* #178: an explicit finish-anyway may have dropped every empty set —
         the workout still finishes (the decision is recorded on the record),
         it just holds no logged sets. */
      const finishedAnyway=!!opts.finishedAnyway;
      if (!draft || (!draft.exercises.length && !finishedAnyway)) { showToast('Add at least one exercise before finishing.'); return; }
      /* One review prompt covers both problem kinds (unfilled values and
         unmarked sets) instead of two stacked dialogs (#43).
         Buttons: Mark all complete (only when all sets have valid values —
         never nulls, user 2026-09-11) / Finish and delete empty sets
         (only fully-empty sets, never partial ones) / Finish anyway (drops
         every invalid set, empty AND incomplete, with an explicit label —
         #199) / Keep editing.
         skipReview is an internal bypass used only by "Mark all complete":
         all sets already have valid values, so it just marks them complete
         without reopening the dialog. */
      const bad = invalidSetsIn(draft);
      const unmarked = draft.exercises.flatMap(item=>item.sets.map((set,index)=>({set,index,item}))).filter(row=>!row.set.complete);
      if (!skipReview && (bad.length || unmarked.length)) {
        showReviewSetsDialog(draft,bad,unmarked);
        return;
      }
      draft.name = $('#workoutName').value.trim() || 'Workout'; draft.date = $('#workoutDate').value || localIsoDate();
      /* #99 A13: stamp a completion timestamp — same-day sessions need a real
         chronology ("latest" must not be a coin flip). Edits keep the original
         completion time; only brand-new finishes stamp now. */
      const priorCompleted=draft.editingId?workoutState.completed.find(x=>x.id===draft.editingId):null;
      const completed = { id:draft.editingId || newWorkoutId(), name:draft.name, date:draft.date, completedAt:priorCompleted?.completedAt||new Date().toISOString(), programId:draft.programId||null, programWorkoutUid:draft.programWorkoutUid||null, finishedAnyway, exercises:draft.exercises.map(item => ({exerciseId:item.exerciseId, tracking:exerciseTracking(item,exercises.find(ex=>ex.id===item.exerciseId)), note:item.note||'', exerciseTags:[...(item.exerciseTags||[])], supersetId:item.supersetId||null, progression:item.progression?{...item.progression}:null, sets:item.sets.map(set => ({w:set.w===''?null:Number(set.w), r:set.r===''?null:Number(set.r), seconds:set.seconds===''?null:Number(set.seconds), rpe:set.rpe === '' ? null : Number(set.rpe), tags:[...set.tags], complete:true}))})) };
      if (draft.editingId) {
        /* A11 (#99): if the record being edited no longer exists (deleted on
           another device and synced away mid-edit), .map() would silently
           drop the whole workout. Save it as a new record instead. */
        if (workoutState.completed.some(x => x.id === draft.editingId)) {
          workoutState.completed = workoutState.completed.map(x => x.id === draft.editingId ? completed : x);
        } else {
          completed.id = newWorkoutId();
          workoutState.completed.unshift(completed);
          showToast('The workout you were editing was deleted elsewhere, so it was saved as a new workout.');
        }
      } else workoutState.completed.unshift(completed);
      const finishedProgram=workoutState.activeProgram&&completed.programId===workoutState.activeProgram.id?workoutState.activeProgram:null;
      workoutState.draft = null; /* #275: an edit-finish keeps the return recorded when the log was opened (e.g. the Logs list) instead of forcing the Workout page — only brand-new finishes reset to WORKOUT. */ if(!draft.editingId)state.workoutDetailReturn=ROUTES.DETAIL_RETURN.WORKOUT; persistNow(); renderCompletedWorkout(completed); renderProgram(); renderLibrary(); renderDashboard(); renderStats();
      /* #153: renderProgram() unconditionally calls updateTopBar('program'),
         which flashed "Program" over the just-finished log. The log's title
         is "Log" (workoutSubScreen is 'complete' now) — restore it last. */
      updateTopBar('workout');
      /* Land on the top of the completed workout, instantly (no smooth scroll — user 2026-09-10). */
      window.scrollTo({top:0, behavior:'auto'});
      /* User 2026-09-12: finishing a program workout lands on the completed
         log, like every other workout. The old showProgram() call covered the
         log with the Program page the instant it rendered. The notice is
         still set, so the program cover shows it whenever the user visits. */
      if(finishedProgram){finishedProgram.notice=`${completed.name} logged.`;}
      /* #286: finishing while signed out nudges toward sign-in (sync/backup),
         unless permanently dismissed. Fires after the completed log renders. */
      try{if(typeof Sync!=='undefined'&&Sync&&typeof Sync.maybeShowSigninNudge==='function')Sync.maybeShowSigninNudge();}catch(_){}
    }
    function editCompletedWorkout(id) {
      const workout=workoutState.completed.find(x=>x.id===id); if(!workout) return;
      /* Editing opens the log as a live workout (user 2026-09-12) — it must
         never silently replace a session already in progress. Re-editing the
         same log is harmless, so it skips the modal. */
      if(workoutState.draft&&workoutState.draft.editingId!==id){
        requestStartWithConflict(workout.name,()=>openCompletedForEdit(workout),'Editing');
        return;
      }
      openCompletedForEdit(workout);
    }
    function openCompletedForEdit(workout){
      /* #99 H5: opening a log for edit closes the logs list. (#187: the
         render path now lets the list open over a draft.) */
      state.workoutHistoryOpen=false;
      /* #99 B8: canonical clone — full-fidelity round trip (actual RPE kept);
         it is editing, not a new session. */
      workoutState.draft={name:workout.name,date:workout.date,programId:workout.programId||null,programWorkoutUid:workout.programWorkoutUid||null,editingId:workout.id,exercises:workout.exercises.map(item=>cloneExerciseItem(item,'forEdit',{noteOpen:!!item.note}))};
      /* User 2026-09-12: editing must actually OPEN the workout — the old
         code built the draft but left workoutEditorOpen false, stranding the
         user on the start screen with a Continue card. */
      state.workoutEditorOpen=true;
      $('#workoutComplete').hidden=true; schedulePersist(); renderWorkoutScreen();
    }
    function workoutSummary(workout) {
      const sets=workout.exercises.flatMap(item=>item.sets);
      const volume=sets.reduce((total,set)=>total+setVolume(set),0);
      const muscles=[...new Set(workout.exercises.flatMap(item=>{const ex=exercises.find(row=>row.id===item.exerciseId);return [...(ex?.primary||[]),...(ex?.secondary||[])];}))];
      /* #302 (user 2026-09-12): timed-only work has no meaningful volume —
         report total time instead of "0 lb". */
      const totalSeconds=sets.reduce((total,set)=>total+(Number(set.seconds)||0),0);
      const timedOnly=sets.length>0&&sets.every(set=>Number(set.seconds)>0);
      return {sets:sets.length,volume,muscles,totalSeconds,timedOnly};
    }
    function workoutPRs(workout) {
      const prs=[];
      workout.exercises.forEach(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        /* #282: timed PRs — longest hold at a given load joins the PR summary. */
        if((item.tracking||'reps')==='time'){
          if(!ex)return;
          const priorSets=priorSetsForPR(workout,item.exerciseId);
          if(detectTimedPRs(item.sets,priorSets))prs.push(`${ex.name} · longest hold PR`);
          return;
        }
        const currentWeighted=item.sets.filter(set=>Number(set.w)>0);
        if(!ex||!currentWeighted.length)return;
        /* #99 A15 + #158: compare against prior sessions — all other records
           except the current one, including earlier same-day sessions (never
           later ones). priorSetsForPR matches the live PR banner's definition. */
        const priorSets=priorSetsForPR(workout,item.exerciseId).filter(set=>Number(set.w)>0);
        if(!priorSets.length)return;
        const currentEst=Math.max(...currentWeighted.map(estimate1RM)),priorEst=Math.max(...priorSets.map(estimate1RM));
        const currentWeight=Math.max(...currentWeighted.map(set=>Number(set.w)||0)),priorWeight=Math.max(...priorSets.map(set=>Number(set.w)||0));
        if(currentEst>priorEst+.5)prs.push(`${ex.name} · estimated 1RM PR`);
        else if(currentWeight>priorWeight)prs.push(`${ex.name} · heaviest set PR`);
      });
      return prs;
    }
    /* #131 (user 2026-09-11): the set-by-set breakdown mirrors the live
       workout set-row grid (SET | WEIGHT | REPS | RPE) — compact read-only
       rows, not stacked stat boxes. No checkmarks (phone QA 2026-09-11:
       every row shown is completed by definition). Per-set est. 1RM lives on
       the exercise detail page; PRs hit are summarized above. */
    function completedExerciseMarkup(item, workoutId) {
      const ex=exercises.find(row=>row.id===item.exerciseId),isBodyweight=ex?.equipment==='body only',tracking=item.tracking||'reps';
      const volume=item.sets.reduce((total,set)=>total+setVolume(set),0);
      const weightLabel=isBodyweight?'ADDED':'WEIGHT', perfLabel=tracking==='time'?'SECONDS':'REPS';
      return `<section class="completed-exercise-detail"><div class="completed-exercise-detail-head"><button class="completed-exercise-link" type="button" data-id="${escapeHtml(item.exerciseId)}" data-return-workout="${escapeHtml(workoutId||'')}">${escapeHtml(ex?.name||'Exercise')}</button><span>${tracking==='time'?`${item.sets.reduce((n,set)=>n+(Number(set.seconds)||0),0)} sec total`:`${formatVolume(volume)}${isBodyweight&&!volume?' · bodyweight':''}`}</span></div>${item.exerciseTags?.length?`<div class="exercise-tag-row">${item.exerciseTags.map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}</div>`:''}<div class="done-labels" aria-hidden="true"><span>SET</span><span>${weightLabel}</span><span>${perfLabel}</span><span>RPE</span></div><div class="done-sets">${item.sets.map((set,index)=>{
        const load=tracking==='time'?'—':isBodyweight?(Number(set.w)>0?`+${displayWeight(set.w)} ${weightUnit()}`:'—'):(set.w==null||set.w===''?`—`:`${displayWeight(set.w)} ${weightUnit()}`);
        const perf=tracking==='time'?(set.seconds==null||set.seconds===''?`—`:`${set.seconds} sec`):(set.r==null||set.r===''?`—`:`${set.r}`);
        return `<div class="done-set"><span class="done-num">${index+1}</span><span class="done-val">${escapeHtml(load)}</span><span class="done-val">${escapeHtml(perf)}</span><span class="done-val">${set.rpe==null?'—':escapeHtml(String(set.rpe))}</span>${set.tags?.length?`<span class="done-set-tags">${set.tags.map(tag=>`<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</span>`:''}</div>`;}).join('')}</div>${item.note?`<p class="completed-note"><strong>Notes:</strong> ${escapeHtml(item.note)}</p>`:''}</section>`;
    }
    function renderCompletedWorkout(workout, opts = {}) {
      updateLiveWorkoutIndicator();
      if(!workout)return;
      const summary=workoutSummary(workout),prs=workoutPRs(workout);
      /* #240 (user 2026-09-12): once this log has been saved as a template,
         its button offers Start — the template exists, so the next tap trains
         it instead of duplicating the save. */
      const existingTemplate=workoutState.templates.find(t=>t.sourceLogId===workout.id);
      /* User 2026-09-12: opening a log row must navigate, not render the
         detail inline under the still-visible list. */
      $('#workoutEditor').hidden = true; $('#workoutStart').hidden = true; $('#workoutHistory').hidden = true; $('#workoutComplete').hidden = false;
      /* Systematic defect #1 (user 2026-09-12): the detail is one exclusive
         pane — hide every sibling, including the saved panes the old code
         forgot, so no stale sub-screen can render under it. */
      $('#savedWorkout').hidden = true; $('#savedBuilder').hidden = true;
      noteWorkoutSubScreen('complete');
      /* Logs are their own page (user 2026-09-12): no tab highlights while a
         log is open — the top bar still reads "Logs". */
      if(state.activeView==='workout')setActiveNav('workout', null);
      /* Coherent history (user 2026-09-12): drilling into a log pushes a page,
         so system back returns to the list instead of skipping it. */
      if (opts.push) history.pushState({view:'workout', sub:'complete', completedId: workout.id, returnTo: returnRouteKey(state.workoutDetailReturn)||ROUTES.DETAIL_RETURN.HISTORY}, '', '#log-' + workout.id);
      $('#workoutComplete').innerHTML = `<div class="completed-card"><div class="detail-title-row"><h2>${escapeHtml(workout.name)}</h2><button class="start-inline-button" id="saveCompletedWorkoutTop" type="button">${existingTemplate?'Start':'Save as template'}</button></div><p class="completed-meta">Completed ${escapeHtml(formatLogDate(workout.date))}</p>${workout.finishedAnyway?'<p class="section-note">Finished with unlogged sets.</p>':''}<div class="workout-detail-metrics"><div class="workout-detail-metric"><strong>${workout.exercises.length}</strong><span>exercise${workout.exercises.length===1?'':'s'}</span></div><div class="workout-detail-metric"><strong>${summary.sets}</strong><span>completed set${summary.sets===1?'':'s'}</span></div><div class="workout-detail-metric"><strong>${summary.timedOnly?`${summary.totalSeconds} sec`:formatVolume(summary.volume)}</strong><span>${summary.timedOnly?'total time':'total volume'}</span></div></div><div class="section-head"><h3>Muscles worked</h3><p class="section-note">Primary and secondary</p></div>${summary.muscles.length?workoutBodyMapMarkup(summary.muscles):''}<div class="workout-muscles">${summary.muscles.length?summary.muscles.map(muscle=>musclePill(muscle)).join(''):'<span class="section-note">No muscle data</span>'}</div>${prs.length?`<div class="section-head"><h3>PRs hit</h3></div><div class="workout-prs">${prs.map(pr=>`<span class="workout-pr">${escapeHtml(pr)}</span>`).join('')}</div>`:''}<div class="section-head"><h3>Set-by-set</h3><p class="section-note">Reps × weight @ RPE</p></div><div class="completed-exercise-details">${workout.exercises.map(item=>completedExerciseMarkup(item,workout.id)).join('')}</div><div class="detail-action-buttons"><button class="primary-button detail-action-primary" id="repeatCompletedWorkout" type="button">Repeat this workout</button><div class="detail-action-row"><button class="secondary-button" id="editCompletedWorkout" type="button">Edit workout</button><button class="secondary-button danger-button" id="deleteCompletedWorkout" type="button">Delete workout</button></div></div><p class="status-note" id="completedSaveStatus" role="status"></p></div>`;
      document.querySelectorAll('.completed-exercise-link').forEach(button => button.addEventListener('click', () => openExercise(button.dataset.id, true, button.dataset.returnWorkout ? {view:'completed-workout', workoutId:button.dataset.returnWorkout} : undefined)));
      $('#editCompletedWorkout').addEventListener('click',()=>editCompletedWorkout(workout.id));
      $('#repeatCompletedWorkout').addEventListener('click',()=>repeatWorkout(workout));
      /* #269 (user 2026-09-12): the completed view's Start must never silently
         replace a live draft — route through the same conflict guard the
         saved editor's Start uses. */
      $('#saveCompletedWorkoutTop').addEventListener('click',()=>existingTemplate?requestStartWithConflict(existingTemplate.name,()=>startWorkoutFromTemplate(existingTemplate.id)):saveCompletedAsTemplate(workout,$('#completedSaveStatus')));
      $('#deleteCompletedWorkout').addEventListener('click',()=>{
        pendingDeleteCompletedWorkoutId=workout.id;
        $('#deleteCompletedWorkoutDesc').textContent=`Delete "${workout.name}" from ${formatLogDate(workout.date)}? This cannot be undone.`;
        $('#deleteCompletedWorkoutDialog').showModal();
      });
      /* The top-bar chevron is the one and only back affordance
         (repeatable pattern, user 2026-09-11): the top-bar handler routes it
         through backFromWorkoutDetail() so the recorded return destination
         is honored (user 2026-09-12). */
      /* Phone QA 2026-09-12: the Muscles-worked body map hydrates async here. */
      hydrateBodyMaps();
    }

    
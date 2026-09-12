
/* ===== module: workout-history.js ===== */
    /** Finalizes editable workout records and renders detailed set-by-set history. */
    let pendingDeleteCompletedWorkoutId=null;
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
        /* user 2026-09-11 (#83): after deletion, land on the Workout page. */
        showWorkouts(false);renderDashboard();
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
        const weightOptional=ex?.equipment==='body only', tracking=exerciseTracking(item,ex);
        if(!item.sets.length){rows.push({item,set:null});return;}
        item.sets.forEach(set=>{
          /* A10 (#99): Number('garbage') is NaN and NaN comparisons are
             false, so non-numeric input used to pass as valid. */
          const perf=tracking==='time'?set.seconds:set.r;
          const bad=(!weightOptional&&set.w==='')||perf===''||!Number.isFinite(Number(set.w||0))||Number(set.w||0)<0||!Number.isFinite(Number(perf))||Number(perf)<1||(set.rpe!==''&&(!Number.isFinite(Number(set.rpe))||Number(set.rpe)<1||Number(set.rpe)>10));
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
      return set&&set.w===''&&set.r===''&&set.seconds===''&&set.rpe===''&&!(set.tags?.length);
    }
    function finishWorkout(skipReview) {
      const draft = workoutState.draft;
      if (!draft || !draft.exercises.length) { showToast('Add at least one exercise before finishing.'); return; }
      /* One review prompt covers both problem kinds (unfilled values and
         unmarked sets) instead of two stacked dialogs (#43).
         Buttons: Mark all complete (only when all sets have valid values —
         never nulls, user 2026-09-11) / Finish and delete empty sets
         (only fully-empty sets, never partial ones) / Keep editing.
         skipReview is an internal bypass used only by "Mark all complete":
         all sets already have valid values, so it just marks them complete
         without reopening the dialog. */
      const bad = invalidSetsIn(draft);
      const unmarked = draft.exercises.flatMap(item=>item.sets.map((set,index)=>({set,index,item}))).filter(row=>!row.set.complete);
      if (!skipReview && (bad.length || unmarked.length)) {
        const badSets=new Set(bad.map(r=>r.set).filter(Boolean));
        const emptyCount=bad.filter(r=>!r.set).length;
        const extraUnmarked=unmarked.filter(row=>!badSets.has(row.set)).length;
        const parts=[];
        if (badSets.size) parts.push(`${badSets.size} set${badSets.size===1?' is':'s are'} missing reps, seconds, or weight.`);
        if (emptyCount) parts.push(`${emptyCount} exercise${emptyCount===1?' has':'s have'} no sets.`);
        if (extraUnmarked) parts.push(`${extraUnmarked} set${extraUnmarked===1?' isn’t':'s aren’t'} marked complete.`);
        $('#reviewSetsCopy').textContent=parts.join(' ');
        /* user 2026-09-11: never save null data. "Mark all complete" is only
           offered when every set has valid values (just unmarked) — if any set
           is missing values, the button hides so the user must fix or delete
           the bad sets instead of saving nulls. */
        $('#reviewSetsComplete').hidden=!unmarked.length||badSets.size>0;
        /* #43: the delete action only removes fully-empty sets (plus exercises
           left with no sets) — never sets with partial values, so no
           user-entered data is silently lost. Hidden when nothing qualifies. */
        const emptySets=draft.exercises.flatMap(item=>item.sets).filter(isEmptySet).length;
        const deleteBtn=$('#reviewSetsDelete');
        if(emptySets>0){deleteBtn.hidden=false;deleteBtn.textContent=`Delete ${emptySets} empty set${emptySets===1?'':'s'}`;}
        else if(emptyCount>0){deleteBtn.hidden=false;deleteBtn.textContent=`Remove ${emptyCount} empty exercise${emptyCount===1?'':'s'}`;}
        else deleteBtn.hidden=true;
        $('#reviewSetsDialog').showModal();
        return;
      }
      draft.name = $('#workoutName').value.trim() || 'Workout'; draft.date = $('#workoutDate').value || localIsoDate();
      /* #99 A13: stamp a completion timestamp — same-day sessions need a real
         chronology ("latest" must not be a coin flip). Edits keep the original
         completion time; only brand-new finishes stamp now. */
      const priorCompleted=draft.editingId?workoutState.completed.find(x=>x.id===draft.editingId):null;
      const completed = { id:draft.editingId || newWorkoutId(), name:draft.name, date:draft.date, completedAt:priorCompleted?.completedAt||new Date().toISOString(), programId:draft.programId||null, programWorkoutUid:draft.programWorkoutUid||null, exercises:draft.exercises.map(item => ({exerciseId:item.exerciseId, tracking:exerciseTracking(item,exercises.find(ex=>ex.id===item.exerciseId)), note:item.note||'', exerciseTags:[...(item.exerciseTags||[])], supersetId:item.supersetId||null, progression:item.progression?{...item.progression}:null, sets:item.sets.map(set => ({w:set.w===''?null:Number(set.w), r:set.r===''?null:Number(set.r), seconds:set.seconds===''?null:Number(set.seconds), rpe:set.rpe === '' ? null : Number(set.rpe), tags:[...set.tags], complete:true}))})) };
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
      workoutState.draft = null; state.workoutDetailReturn=ROUTES.DETAIL_RETURN.WORKOUT; persistNow(); renderCompletedWorkout(completed); renderProgram(); renderLibrary(); renderDashboard(); renderStats();
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
      /* #99 H5: a live draft wins over the history sub-pane (was done in render). */
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
      return {sets:sets.length,volume,muscles};
    }
    function workoutPRs(workout) {
      const prs=[];
      workout.exercises.forEach(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
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
      /* User 2026-09-12: opening a log row must navigate, not render the
         detail inline under the still-visible list. */
      $('#workoutEditor').hidden = true; $('#workoutStart').hidden = true; $('#workoutHistory').hidden = true; $('#workoutComplete').hidden = false;
      /* Systematic defect #1 (user 2026-09-12): the detail is one exclusive
         pane — hide every sibling, including the saved panes the old code
         forgot, so no stale sub-screen can render under it. */
      $('#savedWorkout').hidden = true; $('#savedBuilder').hidden = true;
      noteWorkoutSubScreen('complete');
      /* Logs are their own page (user 2026-09-12): no tab highlights while a
         log is open — the top bar still reads "Log". */
      if(state.activeView==='workout')setActiveNav('workout', null);
      /* Coherent history (user 2026-09-12): drilling into a log pushes a page,
         so system back returns to the list instead of skipping it. */
      if (opts.push) history.pushState({view:'workout', sub:'complete', completedId: workout.id, returnTo: returnRouteKey(state.workoutDetailReturn)||ROUTES.DETAIL_RETURN.HISTORY}, '', '#log-' + workout.id);
      $('#workoutComplete').innerHTML = `<div class="completed-card"><div class="detail-title-row"><h2>${escapeHtml(workout.name)}</h2><button class="start-inline-button" id="saveCompletedWorkoutTop" type="button">Save as template</button></div><p class="completed-meta">Completed ${escapeHtml(formatLogDate(workout.date))}</p><div class="workout-detail-metrics"><div class="workout-detail-metric"><strong>${workout.exercises.length}</strong><span>exercises</span></div><div class="workout-detail-metric"><strong>${summary.sets}</strong><span>completed sets</span></div><div class="workout-detail-metric"><strong>${formatVolume(summary.volume)}</strong><span>total volume</span></div></div><div class="section-head"><h3>Muscles worked</h3><p class="section-note">Primary and secondary</p></div>${summary.muscles.length?workoutBodyMapMarkup(summary.muscles):''}<div class="workout-muscles">${summary.muscles.length?summary.muscles.map(muscle=>musclePill(muscle)).join(''):'<span class="section-note">No muscle data</span>'}</div>${prs.length?`<div class="section-head"><h3>PRs hit</h3></div><div class="workout-prs">${prs.map(pr=>`<span class="workout-pr">${escapeHtml(pr)}</span>`).join('')}</div>`:''}<div class="section-head"><h3>Set-by-set</h3><p class="section-note">Reps × weight @ RPE</p></div><div class="completed-exercise-details">${workout.exercises.map(item=>completedExerciseMarkup(item,workout.id)).join('')}</div><div class="detail-action-buttons"><button class="primary-button detail-action-primary" id="repeatCompletedWorkout" type="button">Repeat this workout</button><div class="detail-action-row"><button class="secondary-button" id="editCompletedWorkout" type="button">Edit workout</button><button class="secondary-button danger-button" id="deleteCompletedWorkout" type="button">Delete workout</button></div></div><p class="status-note" id="completedSaveStatus" role="status"></p></div>`;
      document.querySelectorAll('.completed-exercise-link').forEach(button => button.addEventListener('click', () => openExercise(button.dataset.id, true, button.dataset.returnWorkout ? {view:'completed-workout', workoutId:button.dataset.returnWorkout} : undefined)));
      $('#editCompletedWorkout').addEventListener('click',()=>editCompletedWorkout(workout.id));
      $('#repeatCompletedWorkout').addEventListener('click',()=>repeatWorkout(workout));
      $('#saveCompletedWorkoutTop').addEventListener('click',()=>saveCompletedAsTemplate(workout,$('#completedSaveStatus')));
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

    
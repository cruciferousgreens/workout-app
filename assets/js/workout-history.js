
/* ===== module: workout-history.js ===== */
    /** Finalizes editable workout records and renders detailed set-by-set history. */
    let pendingDeleteCompletedWorkoutId=null;
    $('#cancelDeleteCompletedWorkout')?.addEventListener('click',()=>$('#deleteCompletedWorkoutDialog').close());
    $('#keepCompletedWorkout')?.addEventListener('click',()=>$('#deleteCompletedWorkoutDialog').close());
    $('#confirmDeleteCompletedWorkout')?.addEventListener('click',()=>{
      $('#deleteCompletedWorkoutDialog').close();
      if(pendingDeleteCompletedWorkoutId){
        workoutState.completed=workoutState.completed.filter(w=>w.id!==pendingDeleteCompletedWorkoutId);
        schedulePersist();
        $('#workoutComplete').hidden=true;
        /* user 2026-09-11 (#83): after deletion, land on the Workout page. */
        showWorkouts(false);renderDashboard();
      }
      pendingDeleteCompletedWorkoutId=null;
    });
    function finishWorkout() {
      const draft = workoutState.draft;
      if (!draft || !draft.exercises.length) { showToast('Add at least one exercise before finishing.'); return; }
      /* user 2026-09-11: ✓ is the commit point. On finish, drop all
         incomplete sets (never committed, never null). Drop exercises left
         with no complete sets. If no complete sets remain, discard the
         workout entirely. */
      let droppedSets=0;
      draft.exercises.forEach(item=>{
        const before=item.sets.length;
        item.sets=item.sets.filter(set=>set.complete);
        droppedSets+=before-item.sets.length;
      });
      const beforeEx=draft.exercises.length;
      draft.exercises=draft.exercises.filter(item=>item.sets.length>0);
      const droppedEx=beforeEx-draft.exercises.length;
      if(!draft.exercises.length){
        workoutState.draft=null;
        persistNow(); renderWorkoutScreen();
        showToast('Workout discarded — no completed sets.');
        return;
      }
      if(droppedSets||droppedEx)showToast(`Finished and dropped ${droppedSets} incomplete set${droppedSets===1?'':'s'}${droppedEx?` and ${droppedEx} exercise${droppedEx===1?'':'s'}`:''}.`);
      draft.name = $('#workoutName').value.trim() || 'Workout'; draft.date = $('#workoutDate').value || localIsoDate();
      const completed = { id:draft.editingId || uid('workout'), name:draft.name, date:draft.date, programId:draft.programId||null, programWorkoutUid:draft.programWorkoutUid||null, exercises:draft.exercises.map(item => ({exerciseId:item.exerciseId, tracking:exerciseTracking(item,exercises.find(ex=>ex.id===item.exerciseId)), note:item.note||'', exerciseTags:[...(item.exerciseTags||[])], supersetId:item.supersetId||null, progression:item.progression?{...item.progression}:null, sets:item.sets.map(set => ({w:set.w===''?null:Number(set.w), r:set.r===''?null:Number(set.r), seconds:set.seconds===''?null:Number(set.seconds), rpe:set.rpe === '' ? null : Number(set.rpe), tags:[...set.tags], complete:true}))})) };
      if (draft.editingId) workoutState.completed = workoutState.completed.map(x => x.id === draft.editingId ? completed : x); else workoutState.completed.unshift(completed);
      const finishedProgram=workoutState.activeProgram&&completed.programId===workoutState.activeProgram.id?workoutState.activeProgram:null;
      workoutState.draft = null; state.workoutDetailReturn='workout'; persistNow(); renderCompletedWorkout(completed); renderProgram(); renderLibrary(); renderDashboard(); renderStats();
      /* Land on the top of the completed workout, instantly (no smooth scroll — user 2026-09-10). */
      window.scrollTo({top:0, behavior:'auto'});
      if(finishedProgram){finishedProgram.notice=`${completed.name} logged.`;showProgram();}
    }
    function editCompletedWorkout(id) {
      const workout=workoutState.completed.find(x=>x.id===id); if(!workout) return;
      workoutState.draft={name:workout.name,date:workout.date,programId:workout.programId||null,programWorkoutUid:workout.programWorkoutUid||null,editingId:workout.id,exercises:workout.exercises.map(item=>({uid:uid('exercise'),exerciseId:item.exerciseId,tracking:item.tracking||'reps',note:item.note||'',noteOpen:!!item.note,exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,progression:item.progression?{...item.progression}:null,sets:item.sets.map(set=>({uid:uid('set'),w:set.w==null?'':String(set.w),r:set.r==null?'':String(set.r),seconds:set.seconds==null?'':String(set.seconds),rpe:set.rpe==null?'':String(set.rpe),tags:[...(set.tags||[])],complete:true}))}))};
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
        const priorSets=realWorkouts().filter(row=>row.id!==workout.id&&row.date<workout.date).flatMap(row=>row.exercises.filter(entry=>entry.exerciseId===item.exerciseId).flatMap(entry=>entry.sets)).filter(set=>Number(set.w)>0);
        if(!priorSets.length)return;
        const currentEst=Math.max(...currentWeighted.map(estimate1RM)),priorEst=Math.max(...priorSets.map(estimate1RM));
        const currentWeight=Math.max(...currentWeighted.map(set=>Number(set.w)||0)),priorWeight=Math.max(...priorSets.map(set=>Number(set.w)||0));
        if(currentEst>priorEst+.5)prs.push(`${ex.name} · estimated 1RM PR`);
        else if(currentWeight>priorWeight)prs.push(`${ex.name} · heaviest set PR`);
      });
      return prs;
    }
    function completedExerciseMarkup(item, workoutId) {
      const ex=exercises.find(row=>row.id===item.exerciseId),isBodyweight=ex?.equipment==='body only',tracking=item.tracking||'reps';
      const volume=item.sets.reduce((total,set)=>total+setVolume(set),0);
      return `<section class="completed-exercise-detail"><div class="completed-exercise-detail-head"><button class="completed-exercise-link" type="button" data-id="${escapeHtml(item.exerciseId)}" data-return-workout="${escapeHtml(workoutId||'')}">${escapeHtml(ex?.name||'Exercise')}</button><span>${tracking==='time'?`${item.sets.reduce((n,set)=>n+(Number(set.seconds)||0),0)} sec total`:`${formatVolume(volume)}${isBodyweight&&!volume?' · bodyweight':''}`}</span></div>${item.exerciseTags?.length?`<div class="exercise-tag-row">${item.exerciseTags.map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}</div>`:''}<div class="completed-set-head"><span>SET</span><span>PERFORMANCE</span><span>RPE</span><span>EST. 1RM</span></div>${item.sets.map((set,index)=>{const estimate=tracking==='reps'&&Number(set.w)>0?Math.round(estimate1RM(set)):null;const loadSub=isBodyweight?(Number(set.w)>0?`+${displayWeight(set.w)} ${weightUnit()}`:'bodyweight'):(set.w==null||set.w===''?'—':`${displayWeight(set.w)} ${weightUnit()}`);const perfMain=tracking==='time'?(set.seconds==null||set.seconds===''?`—`:`${set.seconds} sec`):`${set.r??'—'} rep${Number(set.r)===1?'':'s'}`;return `<div class="completed-set-row"><span class="set-num">${index+1}</span><span class="completed-set-cell" data-label="Performance"><strong>${escapeHtml(perfMain)}</strong><span class="perf-sub">${escapeHtml(loadSub)}</span></span><span class="completed-set-cell completed-rpe" data-label="RPE">${set.rpe==null?'—':`<strong>${set.rpe}</strong>`}</span><span class="completed-set-cell completed-est" data-label="Est. 1RM">${tracking==='time'?'—':estimate?`${displayWeight(estimate)} ${weightUnit()}`:'—'}</span>${set.tags?.length?`<div class="completed-set-tags">${set.tags.map(tag=>`<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>`:''}</div>`}).join('')}${item.note?`<p class="completed-note"><strong>Notes:</strong> ${escapeHtml(item.note)}</p>`:''}</section>`;
    }
    function renderCompletedWorkout(workout) {
      updateLiveWorkoutIndicator();
      if(!workout)return;
      const summary=workoutSummary(workout),prs=workoutPRs(workout);
      $('#workoutEditor').hidden = true; $('#workoutStart').hidden = true; $('#workoutComplete').hidden = false;
      noteWorkoutSubScreen('complete');
      $('#workoutComplete').innerHTML = `<div class="completed-detail-top"><button class="back completed-detail-back" id="backFromWorkoutDetail" type="button" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>Back</button><div class="completed-detail-top-actions"><button class="start-new-workout-pill" id="saveCompletedTemplateTop" type="button">Save as template</button></div></div><div class="completed-card"><h2>${escapeHtml(workout.name)}${isSampleWorkout(workout)?'<span class="sample-label">Sample</span>':''}</h2><p class="completed-meta">Completed ${escapeHtml(formatLogDate(workout.date))}</p><div class="workout-detail-metrics"><div class="workout-detail-metric"><strong>${workout.exercises.length}</strong><span>exercises</span></div><div class="workout-detail-metric"><strong>${summary.sets}</strong><span>completed sets</span></div><div class="workout-detail-metric"><strong>${formatVolume(summary.volume)}</strong><span>total volume</span></div></div><div class="section-head"><h3>Muscles worked</h3><p class="section-note">Primary and secondary</p></div><div class="workout-muscles">${summary.muscles.length?summary.muscles.map(muscle=>`<span class="tag primary">${escapeHtml(muscle)}</span>`).join(''):'<span class="section-note">No muscle data</span>'}</div>${prs.length?`<div class="section-head"><h3>PRs hit</h3></div><div class="workout-prs">${prs.map(pr=>`<span class="workout-pr">${escapeHtml(pr)}</span>`).join('')}</div>`:''}<div class="section-head"><h3>Set-by-set</h3><p class="section-note">Reps × weight @ RPE</p></div><div class="completed-exercise-details">${workout.exercises.map(item=>completedExerciseMarkup(item,workout.id)).join('')}</div><div class="detail-action-buttons"><button class="primary-button detail-action-primary" id="repeatCompletedWorkout" type="button">Repeat this workout</button><div class="detail-action-row"><button class="secondary-button" id="editCompletedWorkout" type="button">Edit workout</button><button class="secondary-button danger-button" id="deleteCompletedWorkout" type="button">Delete workout</button></div></div><p class="status-note" id="completedSaveStatus" role="status"></p></div>`;
      document.querySelectorAll('.completed-exercise-link').forEach(button => button.addEventListener('click', () => openExercise(button.dataset.id, true, button.dataset.returnWorkout ? {view:'completed-workout', workoutId:button.dataset.returnWorkout} : undefined)));
      $('#editCompletedWorkout').addEventListener('click',()=>editCompletedWorkout(workout.id));
      /* Quiet tertiary repeat (user 2026-09-10): the big green button is gone,
         but the "repeat any session" flow stays reachable from here. */
      $('#repeatCompletedWorkout').addEventListener('click',()=>repeatWorkout(workout));
      $('#saveCompletedTemplateTop').addEventListener('click',()=>saveCompletedAsTemplate(workout,$('#completedSaveStatus')));
      $('#deleteCompletedWorkout').addEventListener('click',()=>{
        pendingDeleteCompletedWorkoutId=workout.id;
        $('#deleteCompletedWorkoutDesc').textContent=`Delete "${workout.name}" from ${formatLogDate(workout.date)}? This cannot be undone.`;
        $('#deleteCompletedWorkoutDialog').showModal();
      });
      $('#backFromWorkoutDetail').addEventListener('click',()=>{const target=state.workoutDetailReturn||'workout';if(target==='dashboard')showDashboard(false);else if(target==='program')showProgram(false);else if(target==='library')showLibrary(false);else if(target==='history'){state.workoutHistoryOpen=true;$('#workoutComplete').hidden=true;renderWorkoutScreen();}else if(target==='exercise-detail'&&state.workoutDetailExerciseId){openExercise(state.workoutDetailExerciseId,false,state.workoutDetailExerciseReturn||{view:'library'});}else{$('#workoutComplete').hidden=true;renderWorkoutScreen();}});
      /* Start-new pill next to Back (user 2026-09-10): lands on the Workout
         tab's start screen, exactly like tapping the Workout tab itself. */
    }

    
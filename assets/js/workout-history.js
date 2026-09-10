
    /** Finalizes editable workout records and renders detailed set-by-set history. */
    function finishWorkout() {
      const hadRealBefore = workoutState.completed.some(workout=>!workout.sample);
      const draft = workoutState.draft;
      if (!draft || !draft.exercises.length) { $('#workoutError').textContent = 'Add at least one exercise before finishing.'; return; }
      const invalid = draft.exercises.some(item => { const ex=exercises.find(row=>row.id===item.exerciseId); const weightOptional=ex?.equipment==='body only',tracking=exerciseTracking(item,ex); return !item.sets.length || item.sets.some(set => ((!weightOptional && set.w === '') || (tracking==='time'?set.seconds:set.r) === '' || Number(set.w||0) < 0 || Number(tracking==='time'?set.seconds:set.r) < 1 || (set.rpe !== '' && (Number(set.rpe) < 1 || Number(set.rpe) > 10)))); });
      if (invalid) { $('#workoutError').textContent = 'Complete reps or seconds for every set, plus weight for weighted exercises. RPE is optional.'; return; }
      if (draft.exercises.some(item => item.sets.some(set => !set.complete))) { $('#workoutError').textContent = 'Mark each set complete with its check button before finishing.'; return; }
      draft.name = $('#workoutName').value.trim() || 'Workout'; draft.date = $('#workoutDate').value || localIsoDate();
      const completed = { id:draft.editingId || uid('workout'), name:draft.name, date:draft.date, sample:!!draft.sample, programId:draft.programId||null, programWorkoutUid:draft.programWorkoutUid||null, exercises:draft.exercises.map(item => ({exerciseId:item.exerciseId, tracking:exerciseTracking(item,exercises.find(ex=>ex.id===item.exerciseId)), note:item.note||'', exerciseTags:[...(item.exerciseTags||[])], supersetId:item.supersetId||null, sets:item.sets.map(set => ({w:set.w===''?null:Number(set.w), r:set.r===''?null:Number(set.r), seconds:set.seconds===''?null:Number(set.seconds), rpe:set.rpe === '' ? null : Number(set.rpe), tags:[...set.tags], complete:true}))})) };
      if (draft.editingId) workoutState.completed = workoutState.completed.map(x => x.id === draft.editingId ? completed : x); else workoutState.completed.unshift(completed);
      const finishedProgram=workoutState.activeProgram&&completed.programId===workoutState.activeProgram.id?workoutState.activeProgram:null;
      workoutState.draft = null; renderCompletedWorkout(completed); renderProgram(); renderLibrary(); renderDashboard(); renderStats();
      if(finishedProgram){finishedProgram.notice=`${completed.name} logged.`;showProgram();}
      if(!completed.sample && !hadRealBefore && sampleWorkoutsPresent() && !state.samplePromptShown){state.samplePromptShown=true;$('#samplePromptDialog').showModal();}
    }
    function editCompletedWorkout(id) {
      const workout=workoutState.completed.find(x=>x.id===id); if(!workout) return;
      workoutState.draft={name:workout.name,date:workout.date,sample:!!workout.sample,programId:workout.programId||null,programWorkoutUid:workout.programWorkoutUid||null,editingId:workout.id,exercises:workout.exercises.map(item=>({uid:uid('exercise'),exerciseId:item.exerciseId,tracking:item.tracking||'reps',note:item.note||'',noteOpen:!!item.note,exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,sets:item.sets.map(set=>({uid:uid('set'),w:set.w==null?'':String(set.w),r:set.r==null?'':String(set.r),seconds:set.seconds==null?'':String(set.seconds),rpe:set.rpe==null?'':String(set.rpe),tags:[...(set.tags||[])],complete:true}))}))};
      $('#workoutComplete').hidden=true; renderWorkoutScreen();
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
        const priorSets=workoutState.completed.filter(row=>row.id!==workout.id&&row.date<workout.date&&!!row.sample===!!workout.sample).flatMap(row=>row.exercises.filter(entry=>entry.exerciseId===item.exerciseId).flatMap(entry=>entry.sets)).filter(set=>Number(set.w)>0);
        if(!priorSets.length)return;
        const currentEst=Math.max(...currentWeighted.map(estimate1RM)),priorEst=Math.max(...priorSets.map(estimate1RM));
        const currentWeight=Math.max(...currentWeighted.map(set=>Number(set.w)||0)),priorWeight=Math.max(...priorSets.map(set=>Number(set.w)||0));
        if(currentEst>priorEst+.5)prs.push(`${ex.name} · estimated 1RM PR`);
        else if(currentWeight>priorWeight)prs.push(`${ex.name} · heaviest set PR`);
      });
      return prs;
    }
    function completedExerciseMarkup(item) {
      const ex=exercises.find(row=>row.id===item.exerciseId),isBodyweight=ex?.equipment==='body only',tracking=item.tracking||'reps';
      const volume=item.sets.reduce((total,set)=>total+setVolume(set),0);
      return `<section class="completed-exercise-detail"><div class="completed-exercise-detail-head"><button class="completed-exercise-link" type="button" data-id="${escapeHtml(item.exerciseId)}">${escapeHtml(ex?.name||'Exercise')}</button><span>${tracking==='time'?`${item.sets.reduce((n,set)=>n+(Number(set.seconds)||0),0)} sec total`:`${formatVolume(volume)}${isBodyweight&&!volume?' · bodyweight':''}`}</span></div>${item.exerciseTags?.length?`<div class="exercise-tag-row">${item.exerciseTags.map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}</div>`:''}<div class="completed-set-head"><span>SET</span><span>LOAD</span><span>${tracking==='time'?'TIME':'REPS'}</span><span>RPE</span><span>${tracking==='time'?'TYPE':'EST. 1RM'}</span></div>${item.sets.map((set,index)=>{const estimate=tracking==='reps'&&Number(set.w)>0?Math.round(estimate1RM(set)):null;const load=isBodyweight?(Number(set.w)>0?`+${set.w} lb`:'Bodyweight'):`${set.w??'—'} lb`;return `<div class="completed-set-row"><span class="set-num">${index+1}</span><span><strong>${escapeHtml(load)}</strong></span><span><strong>${tracking==='time'?set.seconds:set.r}</strong> ${tracking==='time'?'sec':'reps'}</span><span class="completed-rpe">${set.rpe==null?'RPE —':`RPE <strong>${set.rpe}</strong>`}</span><span class="completed-est">${tracking==='time'?'Timed':estimate?`${estimate} lb`:'—'}</span>${set.tags?.length?`<div class="completed-set-tags">${set.tags.map(tag=>`<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>`:''}</div>`}).join('')}${item.note?`<p class="completed-note"><strong>Notes:</strong> ${escapeHtml(item.note)}</p>`:''}</section>`;
    }
    function renderCompletedWorkout(workout) {
      if(!workout)return;
      const summary=workoutSummary(workout),prs=workoutPRs(workout);
      $('#workoutEditor').hidden = true; $('#workoutStart').hidden = true; $('#workoutComplete').hidden = false;
      $('#workoutComplete').innerHTML = `<div class="completed-card"><div class="completed-mark">✓</div><h2>${escapeHtml(workout.name)} ${workout.sample?'<span class="sample-label">Sample</span>':''}</h2><p class="completed-meta">${workout.sample?'Sample workout':'Completed'} ${escapeHtml(formatLogDate(workout.date))}</p><div class="workout-detail-metrics"><div class="workout-detail-metric"><strong>${workout.exercises.length}</strong><span>exercises</span></div><div class="workout-detail-metric"><strong>${summary.sets}</strong><span>completed sets</span></div><div class="workout-detail-metric"><strong>${formatVolume(summary.volume)}</strong><span>total volume</span></div></div><div class="section-head"><h3>Muscles worked</h3><p class="section-note">Primary and secondary</p></div><div class="workout-muscles">${summary.muscles.length?summary.muscles.map(muscle=>`<span class="tag primary">${escapeHtml(muscle)}</span>`).join(''):'<span class="section-note">No muscle data</span>'}</div>${prs.length?`<div class="section-head"><h3>PRs hit</h3></div><div class="workout-prs">${prs.map(pr=>`<span class="workout-pr">${escapeHtml(pr)}</span>`).join('')}</div>`:''}<div class="section-head"><h3>Set-by-set</h3><p class="section-note">Weight × reps @ RPE</p></div><div class="completed-exercise-details">${workout.exercises.map(completedExerciseMarkup).join('')}</div><div class="start-actions"><button class="primary-button" id="editCompletedWorkout" type="button">Edit workout</button><button class="secondary-button" id="startAnotherWorkout" type="button">Start another</button><button class="secondary-button" id="backToDashboardFromComplete" type="button">Dashboard</button></div><p class="formula">You can reopen and edit this workout any time during this preview session.</p></div>`;
      document.querySelectorAll('.completed-exercise-link').forEach(button => button.addEventListener('click', () => openExercise(button.dataset.id)));
      $('#editCompletedWorkout').addEventListener('click',()=>editCompletedWorkout(workout.id));
      $('#startAnotherWorkout').addEventListener('click', () => { $('#workoutComplete').hidden = true; startBlankWorkout(); });
      $('#backToDashboardFromComplete').addEventListener('click', () => showDashboard());
    }

    
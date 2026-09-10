
    /** Manages the live workout draft, set completion, exercise notes, and mobile interactions. */
    function newSet() { return {uid:uid('set'), w:'', r:'', seconds:'', rpe:'', tags:[], complete:false}; }
    function exerciseTracking(item, ex) { return item?.tracking || item?.progression?.mode || ex?.tracking || (ex?.force === 'static' ? 'time' : 'reps'); }
    function lastUsedWeight(exerciseId) {
      const logs = getExerciseLogs(exerciseId).slice().sort((a,b) => b.isoDate.localeCompare(a.isoDate));
      for (const log of logs) {
        const weighted = log.sets.filter(set => Number(set.w) > 0);
        if (weighted.length) return String(weighted[weighted.length - 1].w);
      }
      return '';
    }
    function lastSessionSetSummary(exerciseId) {
      const logs=getExerciseLogs(exerciseId).sort((a,b)=>b.isoDate.localeCompare(a.isoDate));
      const latest=logs[0]; if(!latest?.sets?.length)return '';
      const set=latest.sets.slice().sort((a,b)=>estimate1RM(b)-estimate1RM(a))[0];
      const timed=latest.tracking==='time'||set.seconds!=null;
      const load=Number(set.w)>0?`${set.w} lb${timed?' · ':' × '}`:'';
      const performance=timed?`${set.seconds} sec`:`${set.r} reps`;
      return `Last: ${load}${performance}${set.rpe==null?'':` @ RPE ${set.rpe}`} · ${formatLogDate(latest.isoDate)}`;
    }

    function livePRLabel(item,set) {
      if(!item||!set||exerciseTracking(item,exercises.find(ex=>ex.id===item.exerciseId))!=='reps'||Number(set.w)<=0)return '';
      const prior=getExerciseLogs(item.exerciseId).flatMap(log=>log.sets).filter(row=>Number(row.w)>0);
      if(!prior.length)return '';
      const bestEstimate=Math.max(...prior.map(estimate1RM)),bestWeight=Math.max(...prior.map(row=>Number(row.w)||0));
      const ex=exercises.find(row=>row.id===item.exerciseId);
      if(estimate1RM(set)>bestEstimate+.5)return `${ex?.name||'Exercise'} · new estimated 1RM PR`;
      if(Number(set.w)>bestWeight)return `${ex?.name||'Exercise'} · new heaviest set PR`;
      return '';
    }

    let toastTimer;
    function showToast(message,kind='') {
      const toast=$('#appToast'); if(!toast)return;
      toast.textContent=message; toast.className=`app-toast ${kind}`.trim(); toast.hidden=false;
      clearTimeout(toastTimer); toastTimer=setTimeout(()=>{toast.hidden=true;},3600);
    }

    let saveStatusTimer;
    function markDraftSaved() {
      schedulePersist();
      const status = $('#draftStatus');
      if (!status) return;
      status.textContent = 'Saved just now';
      clearTimeout(saveStatusTimer);
      saveStatusTimer = setTimeout(() => { status.textContent = 'Changes are saved on this device'; }, 1800);
    }

    function startBlankWorkout(name = 'Workout', programId = null, programWorkoutUid = null) {
      workoutState.draft = {name, date:localIsoDate(), exercises:[], programId, programWorkoutUid, editingId:null};
      $('#workoutComplete').hidden = true;
      renderWorkoutScreen();
    }

    function renderWorkoutRecent() {
      const host=$('#workoutRecent'); if(!host)return;
      const recent=workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
      host.innerHTML=recent.length?recent.map(workout=>{const summary=workoutSummary(workout);return `<button class="recent-workout" type="button" data-training-workout="${escapeHtml(workout.id)}"><span><strong>${escapeHtml(workout.name)}${isSampleWorkout(workout)?'<span class="sample-label">Sample</span>':''}</strong><small>${escapeHtml(formatLogDate(workout.date))} · ${summary.sets} sets · ${formatVolume(summary.volume)}</small></span><span aria-hidden="true">›</span></button>`;}).join(''):'<p class="section-note">Your completed workouts will appear here.</p>';
      document.querySelectorAll('[data-training-workout]').forEach(button=>button.addEventListener('click',()=>{state.workoutDetailReturn='workout';renderCompletedWorkout(workoutState.completed.find(workout=>workout.id===button.dataset.trainingWorkout));}));
    }
    function renderWorkoutProgramSuggestion() {
      const host=$('#programStartSuggestion'),program=workoutState.activeProgram;
      if(!host)return;
      if(!program){
        host.innerHTML=`<div class="program-next-wrap"><button class="program-next-main" id="gotoProgramSetup" type="button"><span><span class="program-next-kicker">PROGRAM</span><strong>Next in program</strong><small>No active training block — set one up to train from it.</small></span><span class="program-next-arrow" aria-hidden="true">›</span></button></div>`;
        host.querySelector('#gotoProgramSetup').addEventListener('click',()=>showProgram());
        return;
      }
      const ready=(program.workouts||[]).filter(workout=>workout.template?.exercises?.length);
      const next=suggestedProgramWorkout(program),week=programWeek(program),range=programRangeForWeek(program,week);
      if(!next){host.innerHTML=`<div class="program-next-wrap"><div class="program-next-main"><span><span class="program-next-kicker">ACTIVE PROGRAM · ${escapeHtml(program.name)}</span><strong>Set up your first workout</strong><small>Week ${week} · ${escapeHtml(programRangeLabel(range))}</small></span><span class="program-next-arrow" aria-hidden="true">›</span></div></div>`;host.querySelector('.program-next-main').addEventListener('click',()=>showProgram());return;}
      host.innerHTML=`<div class="program-next-wrap"><button class="program-next-main" id="startSuggestedProgramWorkout" type="button"><span><span class="program-next-kicker">CONTINUE PROGRAM · ${escapeHtml(program.name)}</span><strong>Continue program · ${escapeHtml(next.name)}</strong><small>Week ${week} · ${next.template.exercises.length} exercise${next.template.exercises.length===1?'':'s'} · ${escapeHtml(programRangeLabel(range))}</small></span><span class="program-next-arrow" aria-hidden="true">›</span></button>${ready.length>1?`<details class="program-next-flexibility"><summary>Choose a different program workout</summary><div class="program-next-alternatives">${ready.filter(workout=>workout.uid!==next.uid).map(workout=>`<button type="button" data-start-program-alternative="${escapeHtml(workout.uid)}">${escapeHtml(workout.name)}</button>`).join('')}</div></details>`:'<p class="program-next-flexibility section-note">Suggested, not required. Blank and template starts remain available below.</p>'}</div>`;
      $('#startSuggestedProgramWorkout').addEventListener('click',()=>startProgramWorkout(program,next));
      document.querySelectorAll('[data-start-program-alternative]').forEach(button=>button.addEventListener('click',()=>{const workout=ready.find(row=>row.uid===button.dataset.startProgramAlternative);if(workout)startProgramWorkout(program,workout);}));
    }
    function renderWorkoutScreen() {
      const hasDraft = !!workoutState.draft;
      // Exactly one sub-pane is ever visible: a live draft wins over everything, a completed
      // workout under review wins over the start screen, otherwise the start screen shows.
      if (hasDraft) $('#workoutComplete').hidden = true;
      const viewingComplete = !hasDraft && !$('#workoutComplete').hidden;
      $('#workoutStart').hidden = hasDraft || viewingComplete;
      $('#workoutEditor').hidden = !hasDraft;
      const lede = $('#workoutLede');
      if (lede) lede.textContent = hasDraft ? 'Workout in progress — log your sets below.'
        : viewingComplete ? 'Reviewing a completed session.'
        : 'Start a session or revisit your recent work.';
      updateLiveWorkoutIndicator();
      renderWorkoutProgramSuggestion();
      renderWorkoutTemplateList();
      const latestReal=workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
      if($('#repeatLastWorkout')){$('#repeatLastWorkout').disabled=!latestReal;$('#repeatLastWorkoutMeta').textContent=latestReal?`${latestReal.name} · ${formatLogDate(latestReal.date)}`:'Complete a workout to enable this.';}
      renderWorkoutRecent();
      if (!hasDraft) return;
      $('#resumeDraftMeta').textContent=`${workoutState.draft.name || 'Workout'} · ${workoutState.draft.exercises.length} exercise${workoutState.draft.exercises.length===1?'':'s'} · ${formatLogDate(workoutState.draft.date)}`;
      $('#workoutName').value = workoutState.draft.name;
      $('#workoutDate').value = workoutState.draft.date;
      renderWorkoutDateDisplay();
      renderWorkoutExercises();
      renderWorkoutProgression();
    }

    function attachSwipeDelete(scope = document) {
      scope.querySelectorAll('.swipe-item').forEach(item => {
        const content = item.querySelector(':scope > .swipe-content');
        if (!content || content.dataset.swipeReady) return;
        content.dataset.swipeReady = 'true';
        let startX = 0, startY = 0, deltaX = 0, tracking = false, horizontal = false, startedOpen = false, pointerId = null, suppressClick = false, interactiveStart = false;
        content.addEventListener('pointerdown', event => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          event.stopPropagation();
          startX = event.clientX; startY = event.clientY; deltaX = 0; tracking = true; horizontal = false; suppressClick = false;
          startedOpen = item.classList.contains('is-open'); pointerId = event.pointerId;
          interactiveStart = !!event.target.closest('input, button, textarea, select, a, summary');
          if (!interactiveStart) content.setPointerCapture?.(event.pointerId);
        });
        content.addEventListener('pointermove', event => {
          if (!tracking || event.pointerId !== pointerId || interactiveStart) return;
          const dx = event.clientX - startX, dy = event.clientY - startY;
          if (!horizontal && Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
          if (!horizontal && Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
          horizontal = true;
          event.preventDefault();
          document.querySelectorAll('.swipe-item.is-open').forEach(open => { if (open !== item) open.classList.remove('is-open'); });
          const base = startedOpen ? -72 : 0;
          deltaX = Math.max(-72, Math.min(0, base + dx));
          content.style.transition = 'none';
          content.style.transform = `translateX(${deltaX}px)`;
        });
        const finish = event => {
          if (event.pointerId !== pointerId) return;
          if (horizontal) event.preventDefault();
          tracking = false;
          content.style.transition = '';
          content.style.transform = '';
          if (horizontal) { item.classList.toggle('is-open', deltaX < -36); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
          horizontal = false; pointerId = null;
        };
        content.addEventListener('pointerup', finish);
        content.addEventListener('pointercancel', finish);
        content.addEventListener('lostpointercapture', event => { if (pointerId !== null) finish(event); });
        content.addEventListener('click', event => {
          if (!suppressClick) return;
          event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false;
        }, true);
      });
    }

    function renderWorkoutExercises() {
      const draft = workoutState.draft;
      if (!draft) return;
      const meta=$('#resumeDraftMeta');
      if(meta)meta.textContent=`${draft.name || 'Workout'} · ${draft.exercises.length} exercise${draft.exercises.length===1?'':'s'} · ${formatLogDate(draft.date)}`;
      draft.exercises.forEach(item=>{if(!item.uid)item.uid=uid('exercise');item.sets=(item.sets||[]).map(set=>({...set,uid:set.uid||uid('set'),tags:[...(set.tags||[])]}));});
      $('#workoutExercises').innerHTML = draft.exercises.length ? draft.exercises.map((item,itemIndex) => {
        const ex = exercises.find(x => x.id === item.exerciseId); if (!ex) return '';
        const isBodyweight = ex.equipment === 'body only';
        const isDumbbell = ex.equipment === 'dumbbell';
        const tracking = exerciseTracking(item, ex);
        const lastWeight = lastUsedWeight(item.exerciseId);
        const target = item.suggestedTarget || {};
        const weightHint = target.w || lastWeight || '';
        const perfHint = tracking === 'time' ? (target.seconds || '') : (target.r || '');
        const lastSummary = lastSessionSetSummary(item.exerciseId);
        const grouped = item.supersetId && draft.exercises.filter(x => x.supersetId === item.supersetId).length > 1;
        const doneSets=item.sets.filter(set=>set.complete).length;
        const topWeight=Math.max(0,...item.sets.map(set=>Number(set.w)||0));
        const cardSummary=`${item.sets.length} set${item.sets.length===1?'':'s'}${topWeight?` · ${topWeight} lb`:''}${doneSets?` · ${doneSets}/${item.sets.length} complete`:''}`;
        return `<div class="swipe-item exercise-swipe" data-exercise-wrapper="${escapeHtml(item.uid)}">
          <button class="swipe-delete-action remove-workout-exercise" type="button" data-uid="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(ex.name)}">Delete</button>
          <details class="exercise-accordion workout-exercise swipe-content" data-workout-exercise="${escapeHtml(item.uid)}" ${item.cardOpen===false?'':'open'}>
            <summary class="exercise-accordion-head"><span class="exercise-accordion-title"><strong>${escapeHtml(ex.name)}</strong><small>${escapeHtml(cardSummary)}</small></span><span class="exercise-accordion-actions"><button class="exercise-info-button" type="button" data-exercise-info="${escapeHtml(item.exerciseId)}" aria-label="About ${escapeHtml(ex.name)}">i</button><span class="exercise-accordion-chevron" aria-hidden="true">›</span></span></summary>
            <div class="exercise-accordion-body">
            ${grouped ? `<div class="superset-band">Superset ${draft.exercises.filter((row, index) => row.supersetId && draft.exercises.findIndex(first => first.supersetId === row.supersetId) === index).findIndex(row => row.supersetId === item.supersetId) + 1}</div>` : ''}
            <div class="workout-exercise-head"><div class="exercise-title-copy"><h3>${escapeHtml(ex.name)}</h3><p>${escapeHtml((ex.primary||[]).map(titleCase).join(', ') || 'Unspecified muscle')} · ${escapeHtml(titleCase(ex.equipment || 'No equipment'))}</p><div class="exercise-meta-row"><span class="set-count-badge">${item.sets.length} set${item.sets.length===1?'':'s'}</span></div></div><button class="drag-handle" type="button" data-drag-uid="${escapeHtml(item.uid)}" aria-label="Drag to reorder ${escapeHtml(ex.name)}">⋮⋮</button></div>
            <details class="advanced-options" ${item.optionsOpen?'open':''}><summary>Exercise options</summary><div class="advanced-options-body"><div class="exercise-tools"><button class="tracking-toggle ${tracking === 'time' ? 'time' : ''}" type="button" data-tracking-uid="${escapeHtml(item.uid)}" aria-label="Switch to ${tracking === 'time' ? 'rep' : 'time'} tracking">Track ${tracking === 'time' ? 'seconds' : 'reps'}</button>${draft.exercises.length > 1 ? `<button class="superset-button ${grouped ? 'active' : ''}" type="button" data-superset-uid="${escapeHtml(item.uid)}">${grouped ? 'Edit superset' : 'Create superset'}</button>` : ''}</div><div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-draft-exercise-tags="${escapeHtml(item.uid)}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div></div></details>
            ${lastSummary?`<p class="last-session-line"><strong>${escapeHtml(lastSummary)}</strong></p>`:'<p class="last-session-line">No previous real session for this exercise yet.</p>'}
            <div class="log-labels"><span>SET</span><span>${isBodyweight ? 'ADDED LB' : 'WEIGHT (LB)'}</span><span>${tracking === 'time' ? 'SECONDS' : 'REPS'}</span><span>RPE (OPT)</span><span>ACTIONS</span></div>
            <div>${item.sets.map((set,index) => `<div class="set-swipe" data-set-wrapper="${escapeHtml(set.uid)}">
              <div class="log-set ${set.complete ? 'is-complete' : ''}" data-set-uid="${escapeHtml(set.uid)}">
                <button class="log-set-number ${set.tags.length ? 'has-tags' : ''}" type="button" data-tag-exercise-uid="${escapeHtml(item.uid)}" data-tag-set-uid="${escapeHtml(set.uid)}" aria-label="Choose tags for set ${index + 1}" aria-haspopup="dialog">${index + 1}</button>
                <label class="weight-entry"><input class="log-input weight-input" data-field="w" data-placeholder-weight="${escapeHtml(weightHint)}" type="number" min="0" step="0.5" inputmode="decimal" value="${escapeHtml(set.w)}" placeholder="${weightHint?escapeHtml(weightHint):(isBodyweight?'Optional':'Weight')}" aria-label="Set ${index + 1} ${isBodyweight ? 'optional added weight' : isDumbbell ? 'total dumbbell weight' : 'weight'} in pounds${weightHint ? (target.w ? `; suggested ${escapeHtml(weightHint)}` : `; last used ${escapeHtml(weightHint)}`) : ''}" />${isDumbbell ? '<small class="weight-total-hint">Total</small>' : ''}</label>
                <input class="log-input reps-input" data-field="${tracking === 'time' ? 'seconds' : 'r'}" data-placeholder-perf="${escapeHtml(perfHint)}" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(tracking === 'time' ? (set.seconds ?? '') : (set.r ?? ''))}" placeholder="${tracking === 'time' ? (perfHint || 'Seconds') : (perfHint || 'Reps')}" aria-label="Set ${index + 1} ${tracking === 'time' ? 'seconds' : 'reps'}${perfHint ? `; suggested ${escapeHtml(perfHint)}` : ''}" />
                <input class="log-input rpe-input" data-field="rpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(set.rpe)}" placeholder="RPE" aria-label="Set ${index + 1} optional RPE" />
                <div class="set-actions">
                  <button class="complete-set" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-pressed="${set.complete}" aria-label="${set.complete ? 'Mark set incomplete' : 'Mark set complete'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg></button>
                  <button class="delete-set delete-set-inline" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-label="Delete set ${index + 1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
                </div>
                <div class="selected-set-tags" aria-label="Selected tags">${set.tags.map(tag => `<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>
              </div></div>`).join('')}</div>
            <div class="set-utility-row"><button class="add-set" type="button" data-uid="${escapeHtml(item.uid)}">+ Add set</button><button class="copy-first-set" type="button" data-copy-first-set="${escapeHtml(item.uid)}" ${item.sets.length<2?'disabled':''}>Apply set 1 to all</button><span class="inline-feedback" data-copy-feedback="${escapeHtml(item.uid)}" aria-live="polite"></span></div>
            <div class="exercise-note">${item.noteOpen || item.note ? `<textarea id="note-${escapeHtml(item.uid)}" data-exercise-note="${escapeHtml(item.uid)}" aria-label="Exercise notes" placeholder="Cues, setup, pain, or anything to remember">${escapeHtml(item.note || '')}</textarea>` : `<button class="add-note-toggle" type="button" data-add-note="${escapeHtml(item.uid)}">+ Add notes</button>`}</div>
            </div>
          </details></div>`;
      }).join('') : '<div class="history-empty">No exercises yet. Add your first movement to begin logging.</div>';

      document.querySelectorAll('.remove-workout-exercise').forEach(button => button.addEventListener('click', () => { draft.exercises = draft.exercises.filter(item => item.uid !== button.dataset.uid); prepareDraftProgression(draft, workoutState.activeProgram?.id===draft.programId?workoutState.activeProgram.progression:{...progressionSetup,stallDetection:false}); renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved(); }));
      document.querySelectorAll('.add-set').forEach(button => button.addEventListener('click', () => { draft.exercises.find(item => item.uid === button.dataset.uid)?.sets.push(newSet()); renderWorkoutExercises(); markDraftSaved(); }));
      document.querySelectorAll('[data-copy-first-set]').forEach(button => button.addEventListener('click', () => {
        const item=draft.exercises.find(row=>row.uid===button.dataset.copyFirstSet); if(!item||item.sets.length<2)return;
        const first=item.sets[0], fallback=lastUsedWeight(item.exerciseId);
        item.sets.slice(1).forEach(set=>{set.w=first.w!==''?first.w:fallback;set.r=first.r;set.seconds=first.seconds;set.rpe=first.rpe;});
        renderWorkoutExercises(); markDraftSaved();
        requestAnimationFrame(()=>{const feedback=document.querySelector(`[data-copy-feedback="${CSS.escape(item.uid)}"]`);if(feedback)feedback.textContent='Applied';});
      }));
      document.querySelectorAll('.delete-set').forEach(button => button.addEventListener('click', () => { const item = draft.exercises.find(row => row.uid === button.dataset.exerciseUid); if (!item) return; item.sets = item.sets.filter(set => set.uid !== button.dataset.setUid); if (!item.sets.length) item.sets.push(newSet()); renderWorkoutExercises(); markDraftSaved(); }));
      document.querySelectorAll('.log-input').forEach(input => input.addEventListener('input', () => { const row=input.closest('.log-set'); const exerciseUid = input.closest('.workout-exercise').dataset.workoutExercise; const setUid = row.dataset.setUid; const set = draft.exercises.find(item => item.uid === exerciseUid)?.sets.find(itemSet => itemSet.uid === setUid); if (set) { set[input.dataset.field] = input.value; if (set.complete) { set.complete = false; row.classList.remove('is-complete'); const check=row.querySelector('.complete-set'); check?.setAttribute('aria-pressed','false'); check?.setAttribute('aria-label','Mark set complete'); } } $('#workoutError').textContent = ''; markDraftSaved(); }));
      document.querySelectorAll('.complete-set').forEach(button => button.addEventListener('click', () => {
        const set = findDraftSet(button.dataset.exerciseUid, button.dataset.setUid);
        const item=draft.exercises.find(row=>row.uid===button.dataset.exerciseUid);
        const ex=exercises.find(row=>row.id===item?.exerciseId);
        const tracking=exerciseTracking(item,ex), weightOptional=ex?.equipment==='body only';
        if (!set) return;
        const setRow=button.closest('.log-set');
        const weightInput=setRow.querySelector('.weight-input');
        const perfInput=setRow.querySelector('.reps-input');
        const perfField=tracking==='time'?'seconds':'r';
        if (!set.complete && set.w === '' && weightInput?.dataset.placeholderWeight) {
          set.w=weightInput.dataset.placeholderWeight;
          weightInput.value=set.w;
        }
        if (!set.complete && (set[perfField]==null||set[perfField]==='') && perfInput?.dataset.placeholderPerf) {
          set[perfField]=perfInput.dataset.placeholderPerf;
          perfInput.value=set[perfField];
        }
        const performanceValue=tracking==='time'?set.seconds:set.r;
        if (!set.complete && ((!weightOptional && set.w === '') || performanceValue === '' || Number(set.w||0) < 0 || Number(performanceValue) < 1 || (set.rpe !== '' && (Number(set.rpe) < 1 || Number(set.rpe) > 10)))) {
          $('#workoutError').textContent = weightOptional ? `Enter ${tracking==='time'?'seconds':'reps'} before marking this set complete. Added weight and RPE are optional.` : `Enter weight and ${tracking==='time'?'seconds':'reps'} before marking this set complete. RPE is optional.`;
          button.closest('.log-set').querySelector((!weightOptional&&set.w==='')?'.weight-input':'.reps-input')?.focus(); return;
        }
        const pr=!set.complete?livePRLabel(item,set):'';
        set.complete = !set.complete; button.setAttribute('aria-pressed', String(set.complete)); button.setAttribute('aria-label', set.complete ? 'Mark set incomplete' : 'Mark set complete'); button.closest('.log-set').classList.toggle('is-complete', set.complete); $('#workoutError').textContent = ''; if(pr)showToast(`PR · ${pr}`,'pr-toast'); markDraftSaved();
      }));
      document.querySelectorAll('.advanced-options').forEach(details => details.addEventListener('toggle', () => { const item=draft.exercises.find(row=>row.uid===details.closest('.workout-exercise')?.dataset.workoutExercise); if(item)item.optionsOpen=details.open; }));
      document.querySelectorAll(".exercise-accordion").forEach(card => card.addEventListener('toggle', () => { const item=draft.exercises.find(row=>row.uid===card.dataset.workoutExercise); if(item){item.cardOpen=card.open;markDraftSaved();} }));
      document.querySelectorAll('[data-tag-set-uid]').forEach(button => button.addEventListener('click', () => openTagDialog(button.dataset.tagExerciseUid, button.dataset.tagSetUid)));
      document.querySelectorAll('[data-draft-exercise-tags]').forEach(button => button.addEventListener('click', () => openExerciseTagDialog({mode:'draft',exerciseUid:button.dataset.draftExerciseTags})));
      document.querySelectorAll('[data-exercise-info]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openExercise(button.dataset.exerciseInfo); }));
      document.querySelectorAll('[data-add-note]').forEach(button => button.addEventListener('click', () => { const item = draft.exercises.find(x => x.uid === button.dataset.addNote); if (!item) return; item.noteOpen = true; renderWorkoutExercises(); requestAnimationFrame(() => document.querySelector(`[data-exercise-note="${CSS.escape(item.uid)}"]`)?.focus()); }));
      document.querySelectorAll('[data-exercise-note]').forEach(input => input.addEventListener('input', () => { const item = draft.exercises.find(x => x.uid === input.dataset.exerciseNote); if (item) item.note = input.value; markDraftSaved(); }));
      document.querySelectorAll('[data-tracking-uid]').forEach(button => button.addEventListener('click', () => {
        const item = draft.exercises.find(row => row.uid === button.dataset.trackingUid); if (!item) return;
        item.tracking = exerciseTracking(item, exercises.find(ex => ex.id === item.exerciseId)) === 'time' ? 'reps' : 'time';
        item.progression = {...progressionProfileForDraftItem(item), mode:item.tracking};
        item.sets.forEach(set => { set.complete = false; });
        renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved();
      }));
      document.querySelectorAll('[data-superset-uid]').forEach(button => button.addEventListener('click', () => openSupersetDialog(button.dataset.supersetUid)));
      attachReorderHandles();
      attachSwipeDelete($('#workoutExercises'));
    }

    
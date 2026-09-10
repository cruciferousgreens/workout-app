
    /** Manages the live workout draft, set completion, exercise notes, and mobile interactions. */
    function newSet() { return {uid:uid('set'), w:'', r:'', seconds:'', rpe:'', tags:[], complete:false}; }
    function exerciseTracking(item, ex) { return item?.tracking || item?.progression?.mode || ex?.tracking || (ex?.force === 'static' ? 'time' : 'reps'); }
    function lastUsedWeight(exerciseId) {
      const logs = getExerciseLogs(exerciseId, true).slice().sort((a,b) => b.isoDate.localeCompare(a.isoDate));
      for (const log of logs) {
        const weighted = log.sets.filter(set => Number(set.w) > 0);
        if (weighted.length) return String(weighted[weighted.length - 1].w);
      }
      return '';
    }

    let saveStatusTimer;
    function markDraftSaved() {
      const status = $('#draftStatus');
      if (!status) return;
      status.textContent = 'Saved just now · this session';
      clearTimeout(saveStatusTimer);
      saveStatusTimer = setTimeout(() => { status.textContent = 'Changes are kept automatically in this session'; }, 1800);
    }

    function startBlankWorkout(name = 'Workout', programId = null, programWorkoutUid = null) {
      workoutState.draft = {name, date:localIsoDate(), exercises:[], programId, programWorkoutUid, editingId:null, sample:false};
      $('#workoutComplete').hidden = true;
      renderWorkoutScreen();
    }

    function renderWorkoutScreen() {
      const hasDraft = !!workoutState.draft;
      $('#workoutStart').hidden = hasDraft || !$('#workoutComplete').hidden;
      $('#workoutEditor').hidden = !hasDraft;
      if (!hasDraft) return;
      $('#workoutName').value = workoutState.draft.name;
      $('#workoutDate').value = workoutState.draft.date;
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
          interactiveStart = !!event.target.closest('input, button, textarea, select, a');
          if (!interactiveStart) content.setPointerCapture?.(event.pointerId);
        });
        content.addEventListener('pointermove', event => {
          if (!tracking || event.pointerId !== pointerId) return;
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
      $('#workoutExercises').innerHTML = draft.exercises.length ? draft.exercises.map((item,itemIndex) => {
        const ex = exercises.find(x => x.id === item.exerciseId); if (!ex) return '';
        const isBodyweight = ex.equipment === 'body only';
        const isDumbbell = ex.equipment === 'dumbbell';
        const tracking = exerciseTracking(item, ex);
        const lastWeight = lastUsedWeight(item.exerciseId);
        const grouped = item.supersetId && draft.exercises.filter(x => x.supersetId === item.supersetId).length > 1;
        return `<div class="swipe-item exercise-swipe" data-exercise-wrapper="${escapeHtml(item.uid)}">
          <button class="swipe-delete-action remove-workout-exercise" type="button" data-uid="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(ex.name)}">Delete</button>
          <section class="workout-exercise swipe-content" data-workout-exercise="${escapeHtml(item.uid)}">
            ${grouped ? `<div class="superset-band">Superset ${draft.exercises.filter((row, index) => row.supersetId && draft.exercises.findIndex(first => first.supersetId === row.supersetId) === index).findIndex(row => row.supersetId === item.supersetId) + 1}</div>` : ''}
            <div class="workout-exercise-head"><div><h3>${escapeHtml(ex.name)}</h3><p>${escapeHtml(ex.primary.join(', ') || 'Unspecified muscle')} · ${escapeHtml(ex.equipment || 'No equipment')}</p><span class="set-count-badge">${item.sets.length} set${item.sets.length===1?'':'s'}</span><div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-draft-exercise-tags="${escapeHtml(item.uid)}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div></div><div class="exercise-tools"><button class="tracking-toggle ${tracking === 'time' ? 'time' : ''}" type="button" data-tracking-uid="${escapeHtml(item.uid)}" aria-label="Switch to ${tracking === 'time' ? 'rep' : 'time'} tracking">${tracking === 'time' ? 'Seconds' : 'Reps'}</button>${draft.exercises.length > 1 ? `<button class="superset-button ${grouped ? 'active' : ''}" type="button" data-superset-uid="${escapeHtml(item.uid)}">${grouped ? 'Edit superset' : 'Superset'}</button>` : ''}<button class="drag-handle" type="button" data-drag-uid="${escapeHtml(item.uid)}" aria-label="Drag to reorder ${escapeHtml(ex.name)}">⋮⋮</button></div></div>
            <div class="log-labels"><span>SET</span><span>${isBodyweight ? 'ADDED LB' : 'WEIGHT (LB)'}</span><span>${tracking === 'time' ? 'SECONDS' : 'REPS'}</span><span>RPE</span><span>ACTIONS</span></div>
            <div>${item.sets.map((set,index) => `<div class="swipe-item set-swipe" data-set-wrapper="${escapeHtml(set.uid)}">
              <button class="swipe-delete-action delete-set" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-label="Delete set ${index + 1}">Delete</button>
              <div class="log-set swipe-content ${set.complete ? 'is-complete' : ''}" data-set-uid="${escapeHtml(set.uid)}">
                <button class="log-set-number ${set.tags.length ? 'has-tags' : ''}" type="button" data-tag-exercise-uid="${escapeHtml(item.uid)}" data-tag-set-uid="${escapeHtml(set.uid)}" aria-label="Choose tags for set ${index + 1}" aria-haspopup="dialog">${index + 1}</button>
                <label class="weight-entry"><input class="log-input weight-input" data-field="w" data-placeholder-weight="${escapeHtml(lastWeight)}" type="number" min="0" step="0.5" inputmode="decimal" value="${escapeHtml(set.w)}" placeholder="${isBodyweight ? (lastWeight ? `Last +${escapeHtml(lastWeight)}` : 'Optional') : (lastWeight ? `Last ${escapeHtml(lastWeight)}` : 'Weight')}" aria-label="Set ${index + 1} ${isBodyweight ? 'optional added weight' : isDumbbell ? 'total dumbbell weight' : 'weight'} in pounds${lastWeight ? `; last used ${escapeHtml(lastWeight)}` : ''}" />${isDumbbell ? '<small class="weight-total-hint">Total</small>' : ''}</label>
                <input class="log-input reps-input" data-field="${tracking === 'time' ? 'seconds' : 'r'}" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(tracking === 'time' ? (set.seconds ?? '') : (set.r ?? ''))}" placeholder="${tracking === 'time' ? 'Seconds' : 'Reps'}" aria-label="Set ${index + 1} ${tracking === 'time' ? 'seconds' : 'reps'}" />
                <input class="log-input rpe-input" data-field="rpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(set.rpe)}" placeholder="RPE optional" aria-label="Set ${index + 1} optional RPE" />
                <div class="set-actions">
                  <button class="complete-set" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-pressed="${set.complete}" aria-label="${set.complete ? 'Mark set incomplete' : 'Mark set complete'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg></button>
                  <button class="delete-set delete-set-inline" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-label="Delete set ${index + 1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
                </div>
                <div class="selected-set-tags" aria-label="Selected tags">${set.tags.map(tag => `<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>
              </div></div>`).join('')}</div>
            <button class="add-set" type="button" data-uid="${escapeHtml(item.uid)}">+ Add set</button>
            <div class="exercise-note">${item.noteOpen || item.note ? `<textarea id="note-${escapeHtml(item.uid)}" data-exercise-note="${escapeHtml(item.uid)}" aria-label="Exercise notes" placeholder="Cues, setup, pain, or anything to remember">${escapeHtml(item.note || '')}</textarea>` : `<button class="add-note-toggle" type="button" data-add-note="${escapeHtml(item.uid)}">+ Add notes</button>`}</div>
          </section></div>`;
      }).join('') : '<div class="history-empty">No exercises yet. Add your first movement to begin logging.</div>';

      document.querySelectorAll('.remove-workout-exercise').forEach(button => button.addEventListener('click', () => { draft.exercises = draft.exercises.filter(item => item.uid !== button.dataset.uid); prepareDraftProgression(draft, workoutState.activeProgram?.id===draft.programId?workoutState.activeProgram.progression:{...progressionSetup,stallDetection:false}); renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved(); }));
      document.querySelectorAll('.add-set').forEach(button => button.addEventListener('click', () => { draft.exercises.find(item => item.uid === button.dataset.uid)?.sets.push(newSet()); renderWorkoutExercises(); markDraftSaved(); }));
      document.querySelectorAll('.delete-set').forEach(button => button.addEventListener('click', () => { const item = draft.exercises.find(row => row.uid === button.dataset.exerciseUid); if (!item) return; item.sets = item.sets.filter(set => set.uid !== button.dataset.setUid); if (!item.sets.length) item.sets.push(newSet()); renderWorkoutExercises(); markDraftSaved(); }));
      document.querySelectorAll('.log-input').forEach(input => input.addEventListener('input', () => { const row=input.closest('.log-set'); const exerciseUid = input.closest('.workout-exercise').dataset.workoutExercise; const setUid = row.dataset.setUid; const set = draft.exercises.find(item => item.uid === exerciseUid)?.sets.find(itemSet => itemSet.uid === setUid); if (set) { set[input.dataset.field] = input.value; if (set.complete) { set.complete = false; row.classList.remove('is-complete'); const check=row.querySelector('.complete-set'); check?.setAttribute('aria-pressed','false'); check?.setAttribute('aria-label','Mark set complete'); } } $('#workoutError').textContent = ''; markDraftSaved(); }));
      document.querySelectorAll('.complete-set').forEach(button => button.addEventListener('click', () => {
        const set = findDraftSet(button.dataset.exerciseUid, button.dataset.setUid);
        const item=draft.exercises.find(row=>row.uid===button.dataset.exerciseUid);
        const ex=exercises.find(row=>row.id===item?.exerciseId);
        const tracking=exerciseTracking(item,ex), weightOptional=ex?.equipment==='body only';
        if (!set) return;
        const weightInput=button.closest('.log-set').querySelector('.weight-input');
        if (!set.complete && set.w === '' && weightInput?.dataset.placeholderWeight) {
          set.w=weightInput.dataset.placeholderWeight;
          weightInput.value=set.w;
        }
        const performanceValue=tracking==='time'?set.seconds:set.r;
        if (!set.complete && ((!weightOptional && set.w === '') || performanceValue === '' || Number(set.w||0) < 0 || Number(performanceValue) < 1 || (set.rpe !== '' && (Number(set.rpe) < 1 || Number(set.rpe) > 10)))) {
          $('#workoutError').textContent = weightOptional ? `Enter ${tracking==='time'?'seconds':'reps'} before marking this set complete. Added weight and RPE are optional.` : `Enter weight and ${tracking==='time'?'seconds':'reps'} before marking this set complete. RPE is optional.`;
          button.closest('.log-set').querySelector((!weightOptional&&set.w==='')?'.weight-input':'.reps-input')?.focus(); return;
        }
        set.complete = !set.complete; button.setAttribute('aria-pressed', String(set.complete)); button.setAttribute('aria-label', set.complete ? 'Mark set incomplete' : 'Mark set complete'); button.closest('.log-set').classList.toggle('is-complete', set.complete); $('#workoutError').textContent = ''; markDraftSaved();
      }));
      document.querySelectorAll('[data-tag-set-uid]').forEach(button => button.addEventListener('click', () => openTagDialog(button.dataset.tagExerciseUid, button.dataset.tagSetUid)));
      document.querySelectorAll('[data-draft-exercise-tags]').forEach(button => button.addEventListener('click', () => openExerciseTagDialog({mode:'draft',exerciseUid:button.dataset.draftExerciseTags})));
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

    

/* ===== module: supersets.js ===== */
    /** Groups and reorders workout exercises without changing their logging data. */
    function normalizeSupersets() {
      const draft = workoutState.draft;
      if (!draft) return;
      const counts = draft.exercises.reduce((all, item) => {
        if (item.supersetId) all[item.supersetId] = (all[item.supersetId] || 0) + 1;
        return all;
      }, {});
      draft.exercises.forEach(item => { if (item.supersetId && counts[item.supersetId] < 2) item.supersetId = null; });
    }

    function openSupersetDialog(exerciseUid) {
      const draft = workoutState.draft;
      if (!draft || draft.exercises.length < 2) return;
      workoutState.supersetTarget = exerciseUid;
      renderSupersetDialog();
      $('#supersetDialog').showModal();
    }

    function renderSupersetDialog() {
      const draft = workoutState.draft;
      const target = draft?.exercises.find(item => item.uid === workoutState.supersetTarget);
      if (!draft || !target) return;
      const targetExercise = exercises.find(ex => ex.id === target.exerciseId);
      $('#supersetDescription').textContent = `Choose the exercise${draft.exercises.length > 2 ? 's' : ''} to group with ${targetExercise?.name || 'this movement'}.`;
      const partners = draft.exercises.filter(item => item.uid !== target.uid);
      $('#supersetOptions').innerHTML = partners.map(item => {
        const ex = exercises.find(row => row.id === item.exerciseId);
        const selected = !!target.supersetId && target.supersetId === item.supersetId;
        return `<button class="picker-item" type="button" data-superset-partner="${escapeHtml(item.uid)}" aria-pressed="${selected}"><span><strong>${escapeHtml(ex?.name || 'Exercise')}</strong><span>${selected ? 'In this superset' : 'Not grouped'}</span></span><span class="picker-state">${selected ? '✓' : '+'}</span></button>`;
      }).join('');
      document.querySelectorAll('[data-superset-partner]').forEach(button => button.addEventListener('click', () => {
        const partner = draft.exercises.find(item => item.uid === button.dataset.supersetPartner);
        if (!partner) return;
        const selected = !!target.supersetId && target.supersetId === partner.supersetId;
        if (selected) {
          partner.supersetId = null;
        } else {
          const groupId = target.supersetId || partner.supersetId || uid('superset');
          target.supersetId = groupId;
          partner.supersetId = groupId;
        }
        normalizeSupersets();
        renderSupersetDialog();
        renderWorkoutExercises();
        markDraftSaved();
      }));
    }

    function attachReorderHandles() {
      document.querySelectorAll('.drag-handle').forEach(handle => {
        let active=false;
        handle.addEventListener('pointerdown', e => { active=true; handle.setPointerCapture?.(e.pointerId); handle.closest('.exercise-swipe').style.opacity='.65'; });
        handle.addEventListener('pointermove', e => { if (!active) return; const over=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-exercise-wrapper]'); const fromUid=handle.dataset.dragUid; if (!over || over.dataset.exerciseWrapper===fromUid) return; const from=workoutState.draft.exercises.findIndex(x=>x.uid===fromUid); const to=workoutState.draft.exercises.findIndex(x=>x.uid===over.dataset.exerciseWrapper); if (from<0||to<0) return; const [moved]=workoutState.draft.exercises.splice(from,1); workoutState.draft.exercises.splice(to,0,moved); renderWorkoutExercises(); });
        const done=()=>{ active=false; const row=handle.closest('.exercise-swipe'); if(row) row.style.opacity=''; markDraftSaved(); };
        handle.addEventListener('pointerup',done); handle.addEventListener('pointercancel',done);
      });
    }

    

/* ===== module: supersets.js ===== */
    /** Groups and reorders workout exercises without changing their logging data.
     *  The superset + reorder dialogs work on whichever exercise list is open —
     *  the live draft or the saved-workout builder (user 2026-09-12) — through
     *  the small context helpers below instead of duplicated per-screen logic. */
     /* Module map (v1.006) — Key: openSupersetDialog(), normalizeSupersets(), exerciseListContext(), contextRerender(). Depends on: draft/exercise items (workout-editor), state (draft or builder). */
    function exerciseListContext() {
      /* The builder is an overlay on the workout tab; while it's open, its
         exercise list is the one the user is editing. */
      if (state.builderOpen && state.savedBuilder) return 'builder';
      return 'draft';
    }
    function contextExercises() {
      if (exerciseListContext() === 'builder') return state.savedBuilder.exercises;
      return workoutState.draft ? workoutState.draft.exercises : null;
    }
    function contextRerender() {
      if (exerciseListContext() === 'builder') { renderSavedBuilder(); return; }
      renderWorkoutExercises(); renderWorkoutProgression();
    }
    function contextSaved() {
      if (exerciseListContext() === 'builder') schedulePersist();
      else markDraftSaved();
    }
    function normalizeSupersets() {
      const list = contextExercises();
      if (!list) return;
      const counts = list.reduce((all, item) => {
        if (item.supersetId) all[item.supersetId] = (all[item.supersetId] || 0) + 1;
        return all;
      }, {});
      list.forEach(item => { if (item.supersetId && counts[item.supersetId] < 2) item.supersetId = null; });
    }

    function openSupersetDialog(exerciseUid) {
      const list = contextExercises();
      if (!list || list.length < 2) return;
      workoutState.supersetTarget = exerciseUid;
      renderSupersetDialog();
      $('#supersetDialog').showModal();
    }

    function renderSupersetDialog() {
      const list = contextExercises();
      const target = list?.find(item => item.uid === workoutState.supersetTarget);
      if (!list || !target) return;
      const targetExercise = exercises.find(ex => ex.id === target.exerciseId);
      $('#supersetDescription').textContent = `Choose the exercise${list.length > 2 ? 's' : ''} to group with ${targetExercise?.name || 'this movement'}.`;
      const partners = list.filter(item => item.uid !== target.uid);
      $('#supersetOptions').innerHTML = partners.map(item => {
        const ex = exercises.find(row => row.id === item.exerciseId);
        const selected = !!target.supersetId && target.supersetId === item.supersetId;
        return `<button class="picker-item" type="button" data-superset-partner="${escapeHtml(item.uid)}" aria-pressed="${selected}"><span><strong>${escapeHtml(ex?.name || 'Exercise')}</strong><span>${selected ? 'In this superset' : 'Not grouped'}</span></span><span class="picker-state">${selected ? '✓' : '+'}</span></button>`;
      }).join('');
      document.querySelectorAll('[data-superset-partner]').forEach(button => button.addEventListener('click', () => {
        const partner = list.find(item => item.uid === button.dataset.supersetPartner);
        if (!partner) return;
        const selected = !!target.supersetId && target.supersetId === partner.supersetId;
        if (selected) {
          partner.supersetId = null;
        } else {
          const groupId = target.supersetId || partner.supersetId || newSupersetGroupId();
          target.supersetId = groupId;
          partner.supersetId = groupId;
        }
        normalizeSupersets();
        renderSupersetDialog();
        contextRerender();
        contextSaved();
      }));
    }

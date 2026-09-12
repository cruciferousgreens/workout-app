
/* ===== module: set-tags.js ===== */
    /** Handles set annotations and exercise-level tags used by templates, live logging, and history. */
    function exerciseTagTargetItem() {
      const target=workoutState.exerciseTagTarget;
      if(!target)return null;
      if(target.mode==='template')return pickerTemplate()?.exercises.find(item=>item.exerciseId===target.exerciseId)||null;
      /* The saved-workout builder reuses this dialog (user 2026-09-12). */
      if(target.mode==='builder')return state.savedBuilder?.exercises.find(item=>item.uid===target.exerciseUid)||null;
      return workoutState.draft?.exercises.find(item=>item.uid===target.exerciseUid)||null;
    }
    function openExerciseTagDialog(target) {
      workoutState.exerciseTagTarget=target;
      $('#newExerciseTagInput').value='';
      renderExerciseTagDialog();
      $('#exerciseTagsDialog').showModal();
    }
    function renderExerciseTagDialog() {
      const item=exerciseTagTargetItem(); if(!item)return;
      item.exerciseTags=item.exerciseTags||[];
      const options=[...new Set([...workoutState.exerciseTagPresets,...item.exerciseTags])];
      $('#exerciseTagPickerOptions').innerHTML=options.map(tag=>`<button class="form-pill" type="button" data-exercise-tag="${escapeHtml(tag)}" aria-pressed="${item.exerciseTags.includes(tag)}">${escapeHtml(tag)}</button>`).join('');
      /* #99: scoped to the exercise-tag dialog (not document-wide). */
      document.querySelectorAll('#exerciseTagPickerOptions [data-exercise-tag]').forEach(button=>button.addEventListener('click',()=>{
        const tag=button.dataset.exerciseTag;
        item.exerciseTags=item.exerciseTags.includes(tag)?item.exerciseTags.filter(value=>value!==tag):[...item.exerciseTags,tag];
        renderExerciseTagDialog();
        /* The tag target lives on workoutState, so route the re-render to the
           screen that owns the item: template picker, saved builder,
           or the live draft. */
        if(workoutState.exerciseTagTarget?.mode==='template'){schedulePersist();renderPickerRules();}
        else if(workoutState.exerciseTagTarget?.mode==='builder'){schedulePersist();renderSavedBuilder();}
        else{renderWorkoutExercises();markDraftSaved();}
      }));
    }
    function addExerciseTag() {
      const tag=$('#newExerciseTagInput').value.trim(),item=exerciseTagTargetItem();
      if(!tag||!item)return;
      item.exerciseTags=item.exerciseTags||[];
      const existing=[...workoutState.exerciseTagPresets,...item.exerciseTags].find(value=>value.toLowerCase()===tag.toLowerCase());
      const selected=existing||tag;
      if(!item.exerciseTags.includes(selected))item.exerciseTags.push(selected);
      $('#newExerciseTagInput').value='';
      renderExerciseTagDialog();
      if(workoutState.exerciseTagTarget?.mode==='template'){schedulePersist();renderPickerRules();}
      else if(workoutState.exerciseTagTarget?.mode==='builder'){schedulePersist();renderSavedBuilder();}
      else{renderWorkoutExercises();markDraftSaved();}
    }

    function findDraftSet(exerciseUid, setUid) {
      return workoutState.draft?.exercises.find(item => item.uid === exerciseUid)?.sets.find(set => set.uid === setUid);
    }

    function openTagDialog(exerciseUid, setUid) {
      workoutState.tagTarget = {exerciseUid, setUid};
      $('#newTagInput').value = '';
      renderTagDialog();
      $('#setTagsDialog').showModal();
    }

    function renderTagDialog() {
      const target = workoutState.tagTarget;
      const set = target ? findDraftSet(target.exerciseUid, target.setUid) : null;
      if (!set) return;
      $('#tagPickerOptions').innerHTML = workoutState.tags.map(tag => `<button class="form-pill" type="button" data-tag="${escapeHtml(tag)}" aria-pressed="${set.tags.includes(tag)}">${escapeHtml(tag)}</button>`).join('');
      $('#editableTagList').innerHTML = workoutState.tags.map(tag => `<span class="tag-list-item">${escapeHtml(tag)}<button type="button" data-delete-tag="${escapeHtml(tag)}" aria-label="Remove ${escapeHtml(tag)} from tag list">×</button></span>`).join('');
      document.querySelectorAll('#tagPickerOptions .form-pill').forEach(button => button.addEventListener('click', () => {
        const tag = button.dataset.tag;
        set.tags = set.tags.includes(tag) ? set.tags.filter(item => item !== tag) : [...set.tags, tag];
        renderTagDialog();
        renderWorkoutExercises();
        markDraftSaved();
      }));
      /* #99: scoped to the tag dialog's editable list (not document-wide) so a
         future [data-delete-tag] elsewhere can never be hijacked. */
      document.querySelectorAll('#editableTagList [data-delete-tag]').forEach(button => button.addEventListener('click', () => {
        const tag = button.dataset.deleteTag;
        workoutState.tags = workoutState.tags.filter(item => item !== tag);
        workoutState.draft?.exercises.forEach(item => item.sets.forEach(row => { row.tags = row.tags.filter(value => value !== tag); }));
        renderTagDialog();
        renderWorkoutExercises();
        markDraftSaved();
      }));
    }

    function addTag() {
      const tag = $('#newTagInput').value.trim();
      if (!tag) return;
      const existing = workoutState.tags.find(item => item.toLowerCase() === tag.toLowerCase());
      if (!existing) workoutState.tags.push(tag);
      const target = workoutState.tagTarget;
      const set = target ? findDraftSet(target.exerciseUid, target.setUid) : null;
      const selected = existing || tag;
      if (set && !set.tags.includes(selected)) set.tags.push(selected);
      $('#newTagInput').value = '';
      renderTagDialog();
      renderWorkoutExercises();
      markDraftSaved();
    }

    

    /** Handles set annotations and exercise-level tags used by templates, live logging, and history. */
    function exerciseTagTargetItem() {
      const target=workoutState.exerciseTagTarget;
      if(!target)return null;
      if(target.mode==='program')return pickerProgramWorkout()?.template?.exercises.find(item=>item.exerciseId===target.exerciseId)||null;
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
      document.querySelectorAll('[data-exercise-tag]').forEach(button=>button.addEventListener('click',()=>{
        const tag=button.dataset.exerciseTag;
        item.exerciseTags=item.exerciseTags.includes(tag)?item.exerciseTags.filter(value=>value!==tag):[...item.exerciseTags,tag];
        renderExerciseTagDialog();
        if(workoutState.exerciseTagTarget?.mode==='program')renderExercisePicker();else{renderWorkoutExercises();markDraftSaved();}
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
      if(workoutState.exerciseTagTarget?.mode==='program')renderExercisePicker();else{renderWorkoutExercises();markDraftSaved();}
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
        set.complete = false;
        renderTagDialog();
        renderWorkoutExercises();
        markDraftSaved();
      }));
      document.querySelectorAll('[data-delete-tag]').forEach(button => button.addEventListener('click', () => {
        const tag = button.dataset.deleteTag;
        workoutState.tags = workoutState.tags.filter(item => item !== tag);
        workoutState.draft?.exercises.forEach(item => item.sets.forEach(row => { row.tags = row.tags.filter(value => value !== tag); row.complete = false; }));
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
      if (set && !set.tags.includes(selected)) { set.tags.push(selected); set.complete = false; }
      $('#newTagInput').value = '';
      renderTagDialog();
      renderWorkoutExercises();
      markDraftSaved();
    }

    
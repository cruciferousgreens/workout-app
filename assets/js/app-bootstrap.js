
    /** Connects static controls to feature modules and performs initial rendering. */
    $('#customExerciseForm').addEventListener('submit', event => {
      event.preventDefault();
      const name = $('#customName').value.trim();
      const primary = [...customDraft.primary];
      if (!name || !primary.length) {
        $('#customFormError').textContent = 'Add a name and select at least one primary muscle.';
        return;
      }
      const existingId = $('#customExerciseId').value;
      const id = existingId || `custom-${Date.now()}-${normalize(name) || 'exercise'}`;
      const customExercise = {
        id,
        name,
        force: customDraft.force || null,
        level: null,
        mechanic: customDraft.mechanic || null,
        equipment: customDraft.equipment || null,
        tracking: customDraft.tracking || 'reps',
        primary,
        secondary: [...customDraft.secondary],
        category: null,
        instructions: $('#customInstructions').value.split('\n').map(step => step.trim()).filter(Boolean),
        custom: true
      };
      if (existingId) {
        exercises = exercises.map(ex => ex.id === existingId ? customExercise : ex);
        state.customExercises = state.customExercises.map(ex => ex.id === existingId ? customExercise : ex);
      } else {
        exercises = [customExercise, ...exercises];
        state.customExercises.unshift(customExercise);
      }
      closeCustomDialog();
      refreshFilters();
      renderLibrary();
      openExercise(id);
    });

    $('#addExerciseButton').addEventListener('click', () => openCustomDialog());
    $('#closeCustomDialog').addEventListener('click', closeCustomDialog);
    $('#cancelCustomExercise').addEventListener('click', closeCustomDialog);

    $('#dashboardNav').addEventListener('click', () => showDashboard());
    $('#workoutsNav').addEventListener('click', () => showWorkouts());
    $('#programNav').addEventListener('click', () => showProgram());
    $('#statsNav').addEventListener('click', () => showStats());
    $('#progressionThreshold').addEventListener('input',e=>progressionSetup.threshold=Number(e.target.value)||8);
    $('#progressionIncrementType').addEventListener('change',e=>{progressionSetup.incrementType=e.target.value;});
    $('#progressionIncrementValue').addEventListener('input',e=>{progressionSetup.incrementValue=Number(e.target.value)||5;});
    $('#programTimeStep').addEventListener('input',e=>{progressionSetup.timeStep=Math.max(1,Number(e.target.value)||5);});
    $('#programRepMin').addEventListener('input',e=>{progressionSetup.defaultRange.min=Math.max(1,Number(e.target.value)||1);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));});
    $('#programRepMax').addEventListener('input',e=>{progressionSetup.defaultRange.max=Math.max(progressionSetup.defaultRange.min,Number(e.target.value)||progressionSetup.defaultRange.min);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));});
    document.querySelectorAll('[data-rep-preset]').forEach(button=>button.addEventListener('click',()=>applyRepPreset(button.dataset.repPreset)));
    $('#undulatingToggle').addEventListener('click',()=>{progressionSetup.undulating=!progressionSetup.undulating;$('#undulatingToggle').setAttribute('aria-pressed',String(progressionSetup.undulating));$('#undulatingToggle').setAttribute('aria-label',`Vary rep ranges by week ${progressionSetup.undulating?'on':'off'}`);renderWeekRanges();});
    $('#programLength').addEventListener('input',renderWeekRanges);
    $('#manageProgramOverrides').addEventListener('click',()=>{if(workoutState.activeProgram){$('#programSetup').hidden=true;document.querySelector('#programWorkouts')?.scrollIntoView({behavior:'smooth'});}else{$('#programError').textContent='Create the program first, then edit overrides inside each workout.';}});
    document.querySelectorAll('[data-treatment]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.treatment=button.dataset.treatment;document.querySelectorAll('[data-treatment]').forEach(row=>row.setAttribute('aria-pressed',String(row===button)));}));
    $('#stallDetectorToggle').addEventListener('click',()=>{progressionSetup.stallDetection=!progressionSetup.stallDetection;$('#stallDetectorToggle').setAttribute('aria-pressed',String(progressionSetup.stallDetection));$('#stallDetectorToggle').setAttribute('aria-label',`Stall detector ${progressionSetup.stallDetection?'on':'off'}`);});
    $('#createProgram').addEventListener('click', createProgram);
    $('#startBlankWorkout').addEventListener('click', () => startBlankWorkout());
    $('#startSavedWorkout').addEventListener('click', () => { renderSavedWorkouts(); $('#savedWorkoutDialog').showModal(); });
    $('#repeatLastWorkout').addEventListener('click',()=>repeatWorkout(workoutState.completed.find(workout=>!workout.sample)));
    $('#closeSavedWorkout').addEventListener('click', () => $('#savedWorkoutDialog').close());
    $('#savedStartBlank').addEventListener('click', () => { $('#savedWorkoutDialog').close(); startBlankWorkout(); });
    $('#addWorkoutExercise').addEventListener('click', () => {
      workoutState.pickerMode='draft';workoutState.programWorkoutTarget=null;
      $('#exercisePickerTitle').textContent='Add exercise';
      $('#exercisePickerTitle').nextElementSibling.textContent='Choose one or more movements for this workout.';
      $('#exercisePickerSearch').value = '';
      renderExercisePicker();
      $('#exercisePickerDialog').showModal();
      requestAnimationFrame(() => $('#exercisePickerSearch').focus());
    });
    $('#closeExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();if(workoutState.pickerMode==='program')renderProgram();});
    $('#doneExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();if(workoutState.pickerMode==='program')renderProgram();});
    $('#exercisePickerSearch').addEventListener('input', renderExercisePicker);
    $('#workoutName').addEventListener('input', event => { if (workoutState.draft) { workoutState.draft.name = event.target.value; markDraftSaved(); } });
    $('#workoutDate').addEventListener('input', event => { if (workoutState.draft) { workoutState.draft.date = event.target.value; markDraftSaved(); } });
    $('#closeSetTags').addEventListener('click', () => $('#setTagsDialog').close());
    $('#doneSetTags').addEventListener('click', () => $('#setTagsDialog').close());
    $('#closeExerciseTags').addEventListener('click', () => $('#exerciseTagsDialog').close());
    $('#doneExerciseTags').addEventListener('click', () => $('#exerciseTagsDialog').close());
    $('#addExerciseTagButton').addEventListener('click', addExerciseTag);
    $('#newExerciseTagInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addExerciseTag(); } });
    $('#closeSuperset').addEventListener('click', () => $('#supersetDialog').close());
    $('#doneSuperset').addEventListener('click', () => $('#supersetDialog').close());
    $('#addTagButton').addEventListener('click', addTag);
    $('#newTagInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } });
    $('#saveWorkoutTemplate').addEventListener('click', saveCurrentTemplate);
    $('#addWorkoutToProgram').addEventListener('click', addCurrentWorkoutToProgram);
    $('#cancelWorkout').addEventListener('click', () => {
      workoutState.draft = null;
      $('#workoutComplete').hidden = true;
      $('#workoutError').textContent = '';
      renderWorkoutScreen();
    });
    $('#finishWorkout').addEventListener('click', finishWorkout);
    document.querySelectorAll('.clear-sample-data').forEach(button=>button.addEventListener('click',clearSampleData));
    $('#clearSampleFromPrompt').addEventListener('click',clearSampleData);
    $('#keepSampleData').addEventListener('click',()=>$('#samplePromptDialog').close());

    $('#searchInput').addEventListener('input', e => {
      state.query = e.target.value;
      $('#clearSearch').classList.toggle('visible', !!state.query);
      renderLibrary();
    });
    $('#clearSearch').addEventListener('click', () => {
      state.query = ''; $('#searchInput').value = ''; $('#clearSearch').classList.remove('visible'); renderLibrary(); $('#searchInput').focus();
    });
    $('#filterToggle').addEventListener('click', () => {
      const open = !$('#filterPanel').classList.contains('open');
      $('#filterPanel').classList.toggle('open', open);
      $('#filterToggle').setAttribute('aria-expanded', open);
    });
    $('#clearMuscles').addEventListener('click', () => { state.muscles.clear(); renderMuscleSelection(); renderLibrary(); });
    $('#equipmentFilter').addEventListener('change', e => { state.equipment = e.target.value; renderLibrary(); });
    $('#backButton').addEventListener('click', () => showLibrary());
    $('#libraryNav').addEventListener('click', () => showLibrary());
    window.addEventListener('popstate', e => {
      const hash = decodeURIComponent(location.hash.slice(1)); const id = e.state?.exercise || hash;
      if (hash === 'dashboard' || e.state?.view === 'dashboard' || !hash) showDashboard(false);
      else if (hash === 'library' || e.state?.view === 'library') showLibrary(false);
      else if (hash === 'workout' || e.state?.view === 'workout') showWorkouts(false);
      else if (hash === 'program' || e.state?.view === 'program') showProgram(false);
      else if (hash === 'stats' || e.state?.view === 'stats') showStats(false);
      else if (id && exercises.some(x => x.id === id)) openExercise(id, false); else showDashboard(false);
    });

    populateFilters(); renderLibrary(); renderDashboard(); renderStats();
    const initialId = decodeURIComponent(location.hash.slice(1));
    if (initialId === 'library') showLibrary(false); else if (initialId === 'workout') showWorkouts(false); else if (initialId === 'program') showProgram(false); else if (initialId === 'stats') showStats(false); else if (initialId && exercises.some(x => x.id === initialId)) openExercise(initialId, false); else showDashboard(false);
  
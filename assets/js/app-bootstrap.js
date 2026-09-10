
    /** Connects static controls to feature modules and performs initial rendering. */
    let deleteArmed=false;
    function renderSettings(){
      const dark=document.documentElement.dataset.theme==='dark';
      const darkToggle=$('#darkModeToggle');
      if(darkToggle){darkToggle.setAttribute('aria-pressed',String(dark));darkToggle.setAttribute('aria-label',`Dark mode ${dark?'on':'off'}`);}
      $('#settingsRpeThreshold').value=progressionSetup.threshold;
      $('#settingsIncrementType').value=progressionSetup.incrementType;
      $('#settingsIncrementValue').value=progressionSetup.incrementValue;
      $('#settingsRepMin').value=progressionSetup.defaultRange.min;
      $('#settingsRepMax').value=progressionSetup.defaultRange.max;
      $('#settingsTimeStep').value=progressionSetup.timeStep;
      const stall=$('#settingsStallToggle');
      stall.setAttribute('aria-pressed',String(!!progressionSetup.stallDetection));
      stall.setAttribute('aria-label',`Stall detector ${progressionSetup.stallDetection?'on':'off'}`);
      const del=$('#deleteAllDataButton');
      del.classList.remove('armed');del.textContent='Delete all data';deleteArmed=false;
    }
    window.addEventListener('load', () => {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
    });

    function applyTheme(theme) {
      const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';
      const toggle=$('#darkModeToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(dark));toggle.setAttribute('aria-label',`Dark mode ${dark?'on':'off'}`);}
      const color=getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();document.querySelector('meta[name="theme-color"]').setAttribute('content',color);document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content',dark?'black-translucent':'default');
      try{localStorage.setItem('workout-theme',dark?'dark':'light');}catch(_){}
    }
    function renderPlateCalculator(){
      const target=Number($('#plateTargetWeight').value),bar=Number($('#plateBarWeight').value),host=$('#plateResult');
      if(!Number.isFinite(target)||!Number.isFinite(bar)||target<bar||bar<0){host.innerHTML='<strong>Check the weights.</strong><p class="section-note">Total weight must be at least the bar weight.</p>';return;}
      let side=(target-bar)/2;const plates=[];[45,35,25,10,5,2.5].forEach(size=>{while(side+0.001>=size){plates.push(size);side-=size;}});
      host.innerHTML=side>.01?`<strong>${target} lb cannot be loaded exactly with the listed plates.</strong><p class="section-note">Nearest lower setup leaves ${side.toFixed(1)} lb per side.</p>`:`<strong>${plates.length?`${plates.join(' + ')} lb per side`:'Empty bar'}</strong><div class="plate-stack">${plates.map(value=>`<span class="plate-chip">${value}</span>`).join('')}</div><p class="section-note">${bar} lb bar · ${target} lb total</p>`;
    }

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
      schedulePersist();
      openExercise(id);
    });

    $('#addExerciseButton').addEventListener('click', () => openCustomDialog());
    $('#closeCustomDialog').addEventListener('click', closeCustomDialog);
    $('#cancelCustomExercise').addEventListener('click', closeCustomDialog);

    $('#darkModeToggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    $('#settingsRpeThreshold').addEventListener('input',e=>{progressionSetup.threshold=Math.min(10,Math.max(1,Number(e.target.value)||8));schedulePersist();});
    $('#settingsIncrementType').addEventListener('change',e=>{progressionSetup.incrementType=e.target.value;schedulePersist();});
    $('#settingsIncrementValue').addEventListener('input',e=>{progressionSetup.incrementValue=Math.max(0,Number(e.target.value)||0);schedulePersist();});
    $('#settingsRepMin').addEventListener('input',e=>{progressionSetup.defaultRange.min=Math.max(1,Number(e.target.value)||1);progressionSetup.defaultRange.preset='custom';schedulePersist();});
    $('#settingsRepMax').addEventListener('input',e=>{progressionSetup.defaultRange.max=Math.max(progressionSetup.defaultRange.min,Number(e.target.value)||progressionSetup.defaultRange.min);progressionSetup.defaultRange.preset='custom';schedulePersist();});
    $('#settingsTimeStep').addEventListener('input',e=>{progressionSetup.timeStep=Math.max(1,Number(e.target.value)||5);schedulePersist();});
    $('#settingsStallToggle').addEventListener('click',()=>{progressionSetup.stallDetection=!progressionSetup.stallDetection;const toggle=$('#settingsStallToggle');toggle.setAttribute('aria-pressed',String(progressionSetup.stallDetection));toggle.setAttribute('aria-label',`Stall detector ${progressionSetup.stallDetection?'on':'off'}`);schedulePersist();});
    $('#exportDataButton').addEventListener('click',()=>{downloadWorkoutBackup();showToast('Backup downloaded.');});
    $('#deleteAllDataButton').addEventListener('click',()=>{
      const button=$('#deleteAllDataButton');
      if(!deleteArmed){deleteArmed=true;button.classList.add('armed');button.textContent='Tap again to confirm — erases everything';return;}
      try{localStorage.removeItem(PERSIST_KEY);}catch(_){}
      workoutState.completed=[];workoutState.templates=[];workoutState.tags=[];workoutState.exerciseTagPresets=[];workoutState.draft=null;workoutState.activeProgram=null;workoutState.archivedPrograms=[];
      state.customExercises=[];exercises=exercises.filter(ex=>!ex.custom);
      location.reload();
    });
    applyTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
    $('#openPlateCalculator').addEventListener('click',()=>{renderPlateCalculator();$('#plateCalculatorDialog').showModal();});
    $('#closePlateCalculator').addEventListener('click',()=>$('#plateCalculatorDialog').close());
    $('#plateTargetWeight').addEventListener('input',renderPlateCalculator);$('#plateBarWeight').addEventListener('input',renderPlateCalculator);
    $('#discardDraftBanner').addEventListener('click',()=>{workoutState.draft=null;$('#workoutError').textContent='';renderWorkoutScreen();showToast('Workout draft discarded.');});
    $('#closeReplaceDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#keepCurrentDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#confirmReplaceDraft').addEventListener('click',()=>{const workout=pendingRepeatWorkout;pendingRepeatWorkout=null;$('#replaceDraftDialog').close();if(workout)repeatWorkout(workout,true);});
    $('#dashboardNav').addEventListener('click', () => showDashboard());
    $('#workoutsNav').addEventListener('click', () => showWorkouts());
    $('#programNav').addEventListener('click', () => showProgram());
    $('#statsNav').addEventListener('click', () => showStats());
    $('#settingsNav').addEventListener('click', () => showSettings());
    $('#progressionThreshold').addEventListener('input',e=>{progressionSetup.threshold=Number(e.target.value)||8;schedulePersist();});
    $('#progressionIncrementType').addEventListener('change',e=>{progressionSetup.incrementType=e.target.value;schedulePersist();});
    $('#progressionIncrementValue').addEventListener('input',e=>{progressionSetup.incrementValue=Number(e.target.value)||5;schedulePersist();});
    $('#programTimeStep').addEventListener('input',e=>{progressionSetup.timeStep=Math.max(1,Number(e.target.value)||5);schedulePersist();});
    $('#programRepMin').addEventListener('input',e=>{progressionSetup.defaultRange.min=Math.max(1,Number(e.target.value)||1);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    $('#programRepMax').addEventListener('input',e=>{progressionSetup.defaultRange.max=Math.max(progressionSetup.defaultRange.min,Number(e.target.value)||progressionSetup.defaultRange.min);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    document.querySelectorAll('[data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset);schedulePersist();}));
    $('#undulatingToggle').addEventListener('click',()=>{progressionSetup.undulating=!progressionSetup.undulating;$('#undulatingToggle').setAttribute('aria-pressed',String(progressionSetup.undulating));$('#undulatingToggle').setAttribute('aria-label',`Vary rep ranges by week ${progressionSetup.undulating?'on':'off'}`);renderWeekRanges();schedulePersist();});
    $('#programLength').addEventListener('input',renderWeekRanges);
    $('#manageProgramOverrides').addEventListener('click',()=>{if(workoutState.activeProgram){$('#programSetup').hidden=true;document.querySelector('#programWorkouts')?.scrollIntoView({behavior:'smooth'});}else{$('#programError').textContent='Create the program first, then edit overrides inside each workout.';}});
    document.querySelectorAll('[data-treatment]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.treatment=button.dataset.treatment;document.querySelectorAll('[data-treatment]').forEach(row=>row.setAttribute('aria-pressed',String(row===button)));schedulePersist();}));
    $('#stallDetectorToggle').addEventListener('click',()=>{progressionSetup.stallDetection=!progressionSetup.stallDetection;$('#stallDetectorToggle').setAttribute('aria-pressed',String(progressionSetup.stallDetection));$('#stallDetectorToggle').setAttribute('aria-label',`Stall detector ${progressionSetup.stallDetection?'on':'off'}`);schedulePersist();});
    $('#createProgram').addEventListener('click', createProgram);
    $('#startBlankWorkout').addEventListener('click', () => startBlankWorkout());
    $('#repeatLastWorkout').addEventListener('click',()=>repeatWorkout(workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]));
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
      persistNow();
      renderWorkoutScreen();
    });
    $('#finishWorkout').addEventListener('click', finishWorkout);

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
      else if (hash === 'settings' || e.state?.view === 'settings') showSettings(false);
      else if (id && exercises.some(x => x.id === id)) openExercise(id, false); else showDashboard(false);
    });

    restorePersisted();
    populateFilters(); renderLibrary(); renderDashboard(); renderStats();
    const initialId = decodeURIComponent(location.hash.slice(1));
    if (initialId === 'library') showLibrary(false); else if (initialId === 'workout') showWorkouts(false); else if (initialId === 'program') showProgram(false); else if (initialId === 'stats') showStats(false); else if (initialId === 'settings') showSettings(false); else if (initialId && exercises.some(x => x.id === initialId)) openExercise(initialId, false); else showDashboard(false);
  
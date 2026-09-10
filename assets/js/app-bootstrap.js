
/* ===== module: app-bootstrap.js ===== */
    /** Connects static controls to feature modules and performs initial rendering. */
    let deleteArmed=false;
    /** Theme state (Justin 2026-09-10): four themes in two visual columns.
        The dark toggle moves between the matching pills: Cruciferous <->
        Asterid, Rosé <-> Matcha — the newly active theme's pill is always
        the one shown selected. Tapping the Cruciferous pill always lands on
        Cruciferous light; tapping an already-active non-default pill also
        resets to Cruciferous light. Persisted as workout-theme (dark/light)
        + workout-theme-name (+ legacy workout-theme-light, kept for stored
        prefs). */
    let themeName='cruciferous', darkMode=false, ctpDark='mocha', lightTheme='cruciferous';
    const ROSEPINE='rosepine', DARK_FLAVORS=['macchiato','mocha'], LIGHT_THEMES=['cruciferous','rosepine'];
    function applyTheme(){
      const eff=themeName==='cruciferous'?(darkMode?'macchiato':'light'):themeName;
      document.documentElement.dataset.theme=eff;
      const toggle=$('#darkModeToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(darkMode));toggle.setAttribute('aria-label',`Dark mode ${darkMode?'on':'off'}`);}
      document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeName===themeName)));
      const color=getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();document.querySelector('meta[name="theme-color"]').setAttribute('content',color);document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content',darkMode?'black-translucent':'default');
      try{localStorage.setItem('workout-theme',darkMode?'dark':'light');localStorage.setItem('workout-theme-name',themeName);localStorage.setItem('workout-theme-light',lightTheme);}catch(_){}
    }
    function setThemeName(name){
      themeName=name;
      if(name===ROSEPINE){darkMode=false;lightTheme=ROSEPINE;}
      /* Cruciferous always means Cruciferous light — tapping the pill must show
         the default theme, never linger in a dark palette (Justin 2026-09-10).
         The Cruciferous<->Asterid dark relationship lives in the dark toggle. */
      else if(name==='cruciferous'){darkMode=false;lightTheme='cruciferous';}
      else{ /* dark Catppuccin flavor */ darkMode=true;ctpDark=name;}
      applyTheme();
    }
    /** Highlights the active workout-focus pill from the draft's explicit choice (Justin 2026-09-10). */
    function syncWorkoutFocusPills(){
      const key=workoutState.draft?.focusPreset||null;
      document.querySelectorAll('[data-workout-focus]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workoutFocus===key)));
    }
    /** Light unit suffix inside the increment value field; follows the type (Justin 2026-09-10). */
    function syncSettingsIncrementUnit(){
      const unit=$('#settingsIncrementUnit');
      if(unit) unit.textContent = progressionSetup.incrementType==='percent' ? '%' : weightUnit();
      const typeOpt=$('#settingsIncrementType option[value="lb"]');
      if(typeOpt) typeOpt.textContent = isMetric() ? 'Kilograms (kg)' : 'Pounds (lb)';
    }
    function syncUnitPills(){
      document.querySelectorAll('#settingsUnitPills [data-units]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.units===(progressionSetup.units||'imperial'))));
    }
    function renderSettings(){
      const darkToggle=$('#darkModeToggle');
      if(darkToggle){darkToggle.setAttribute('aria-pressed',String(darkMode));darkToggle.setAttribute('aria-label',`Dark mode ${darkMode?'on':'off'}`);}
      document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeName===themeName)));
      $('#settingsRpeThreshold').value=progressionSetup.threshold;
      $('#settingsIncrementType').value=progressionSetup.incrementType;
      $('#settingsIncrementValue').value=progressionSetup.incrementValue;
      syncSettingsIncrementUnit();
      $('#settingsRepMin').value=progressionSetup.defaultRange.min;
      $('#settingsRepMax').value=progressionSetup.defaultRange.max;
      const activePreset=progressionSetup.defaultRange.preset||'hypertrophy';
      document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===activePreset)));
      syncUnitPills();
      syncTimeStepPills($('#settingsTimeStepPills'),progressionSetup.timeStep);
      const stall=$('#settingsStallToggle');
      stall.setAttribute('aria-pressed',String(!!progressionSetup.stallDetection));
      stall.setAttribute('aria-label',`Stall detector ${progressionSetup.stallDetection?'on':'off'}`);
      const del=$('#deleteAllDataButton');
      del.classList.remove('armed');del.textContent='Delete all data';deleteArmed=false;
      const hasSamples=hasSampleData();
      const addBtn=$('#addSampleDataButton'),clearBtn=$('#clearSampleDataButton');
      if(addBtn){addBtn.disabled=hasSamples;addBtn.textContent=hasSamples?'Sample data added':'Add sample data';addBtn.title=hasSamples?'Sample workouts are already in your history':'Add 8 labeled sample workouts across the last ~3 weeks';}
      if(clearBtn){clearBtn.disabled=!hasSamples;clearBtn.title=hasSamples?'Remove all sample workouts (your real workouts stay)':'No sample data to clear';}
    }
    window.addEventListener('load', () => {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
    });

    /** Refreshes the pretty date button from the hidden native date input. */
    function renderWorkoutDateDisplay() {
      const input=$('#workoutDate'),display=$('#workoutDateDisplay');
      if(!input||!display)return;
      display.textContent=formatPrettyDate(input.value||localIsoDate());
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

    /* "By weighted volume" <-> "By number of sets" toggle on the stats page (Justin 2026-09-10). */
    $('#topExercisesMode').addEventListener('click',()=>{
      state.topExercisesMode=state.topExercisesMode==='sets'?'volume':'sets';
      schedulePersist();renderStats();
    });

    $('#darkModeToggle').addEventListener('click',()=>{
      darkMode=!darkMode;
      /* The toggle walks to the matching theme pill (Justin 2026-09-10):
         Cruciferous <-> Asterid, Rosé <-> Matcha. */
      if(darkMode){ if(themeName==='cruciferous')themeName='macchiato'; else if(themeName===ROSEPINE)themeName='mocha'; }
      else{ if(themeName==='macchiato')themeName='cruciferous'; else if(themeName==='mocha')themeName=ROSEPINE; }
      applyTheme();
    });
    document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.addEventListener('click',()=>{
      const name=button.dataset.themeName;
      /* Tapping the active pill resets to Cruciferous light. Tapping
         "Cruciferous" always shows Cruciferous light (Justin 2026-09-10) —
         the dark side of that column is reached via the dark toggle. */
      if(name===themeName){ themeName='cruciferous';darkMode=false;lightTheme='cruciferous';applyTheme(); return; }
      setThemeName(name);
    }));
    document.querySelectorAll('#settingsUnitPills [data-units]').forEach(button=>button.addEventListener('click',()=>{
      progressionSetup.units=button.dataset.units; syncUnitPills(); syncSettingsIncrementUnit(); schedulePersist();
      renderDashboard(); renderStats(); renderWorkoutScreen(); renderWorkoutProgression();
    }));
    $('#settingsRpeThreshold').addEventListener('input',e=>{progressionSetup.threshold=Math.min(10,Math.max(1,Number(e.target.value)||8));schedulePersist();});
    $('#settingsIncrementType').addEventListener('change',e=>{progressionSetup.incrementType=e.target.value;syncSettingsIncrementUnit();schedulePersist();});
    $('#settingsIncrementValue').addEventListener('input',e=>{progressionSetup.incrementValue=Math.max(0,Number(e.target.value)||0);schedulePersist();});
    $('#settingsRepMin').addEventListener('input',e=>{progressionSetup.defaultRange.min=Math.max(1,Number(e.target.value)||1);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    $('#settingsRepMax').addEventListener('input',e=>{const v=e.target.value.trim();progressionSetup.defaultRange.max=v===''?null:Math.max(progressionSetup.defaultRange.min,Number(v)||progressionSetup.defaultRange.min);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    const syncAllTimeStepPills=()=>{syncTimeStepPills($('#settingsTimeStepPills'),progressionSetup.timeStep);syncTimeStepPills($('#programTimeStepPills'),programFormProgression().timeStep);};
    wireTimeStepPills($('#settingsTimeStepPills'),()=>progressionSetup.timeStep,v=>{progressionSetup.timeStep=v;syncAllTimeStepPills();schedulePersist();});
    wireTimeStepPills($('#programTimeStepPills'),()=>programFormProgression().timeStep,v=>{programFormProgression().timeStep=v;syncAllTimeStepPills();schedulePersist();});
    $('#settingsStallToggle').addEventListener('click',()=>{progressionSetup.stallDetection=!progressionSetup.stallDetection;const toggle=$('#settingsStallToggle');toggle.setAttribute('aria-pressed',String(progressionSetup.stallDetection));toggle.setAttribute('aria-label',`Stall detector ${progressionSetup.stallDetection?'on':'off'}`);schedulePersist();});
    $('#progressionInfoButton').addEventListener('click',()=>$('#progressionInfoDialog').showModal());
    $('#closeProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#doneProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#exportDataButton').addEventListener('click',()=>{downloadWorkoutBackup();showToast('Backup downloaded.');});
    $('#addSampleDataButton').addEventListener('click',()=>{addSampleData();});
    $('#clearSampleDataButton').addEventListener('click',()=>{clearSampleData();});
    $('#deleteAllDataButton').addEventListener('click',()=>{
      const button=$('#deleteAllDataButton');
      if(!deleteArmed){deleteArmed=true;button.classList.add('armed');button.textContent='Tap again to confirm — erases everything';return;}
      try{localStorage.removeItem(PERSIST_KEY);}catch(_){}
      workoutState.completed=[];workoutState.templates=[];workoutState.tags=[];workoutState.exerciseTagPresets=[];workoutState.draft=null;workoutState.activeProgram=null;workoutState.archivedPrograms=[];
      state.customExercises=[];exercises=exercises.filter(ex=>!ex.custom);
      /* Favorites are user data too: clear them in memory so the pagehide
       * persist-on-reload below can't resurrect them. */
      state.favorites.clear();
      location.reload();
    });
    try{
      darkMode=(localStorage.getItem('workout-theme')||'light')==='dark';
      themeName=localStorage.getItem('workout-theme-name')||'cruciferous';
      if(themeName==='latte')themeName='rosepine';else if(themeName==='frappe')themeName='macchiato';
      if(!['cruciferous','rosepine','macchiato','mocha'].includes(themeName))themeName='cruciferous';
      if(DARK_FLAVORS.includes(themeName))ctpDark=themeName;
      try{const savedLight=localStorage.getItem('workout-theme-light');if(LIGHT_THEMES.includes(savedLight))lightTheme=savedLight;}catch(_){}
    }catch(_){}
    applyTheme();
    $('#closeReplaceDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#keepCurrentDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#confirmReplaceDraft').addEventListener('click',()=>{const workout=pendingRepeatWorkout;pendingRepeatWorkout=null;$('#replaceDraftDialog').close();if(workout)repeatWorkout(workout,true);});
    /* Unfinished sets on finish (Justin 2026-09-10): complete them all, delete
       them (dropping exercises left with no sets), or keep editing. */
    $('#closeUnfinishedSets').addEventListener('click',()=>$('#unfinishedSetsDialog').close());
    $('#unfinishedSetsCancel').addEventListener('click',()=>$('#unfinishedSetsDialog').close());
    $('#unfinishedSetsComplete').addEventListener('click',()=>{$('#unfinishedSetsDialog').close();const draft=workoutState.draft;if(draft){draft.exercises.forEach(item=>item.sets.forEach(set=>{set.complete=true;}));renderWorkoutExercises();markDraftSaved();}finishWorkout();});
    $('#unfinishedSetsDelete').addEventListener('click',()=>{$('#unfinishedSetsDialog').close();const draft=workoutState.draft;if(draft){let removed=0;draft.exercises.forEach(item=>{const before=item.sets.length;item.sets=item.sets.filter(set=>set.complete);removed+=before-item.sets.length;});draft.exercises=draft.exercises.filter(item=>item.sets.length);renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();if(removed)showToast(`Deleted ${removed} unfinished set${removed===1?'':'s'}.`);}finishWorkout();});
    /* Unfilled-sets dialog (Justin 2026-09-10): finish anyway, delete the
       unfilled sets, or back out. */
    $('#closeInvalidSets').addEventListener('click',()=>$('#invalidSetsDialog').close());
    $('#invalidSetsCancel').addEventListener('click',()=>$('#invalidSetsDialog').close());
    $('#invalidSetsFinish').addEventListener('click',()=>{$('#invalidSetsDialog').close();finishWorkout(true);});
    $('#invalidSetsDelete').addEventListener('click',()=>{$('#invalidSetsDialog').close();const draft=workoutState.draft;if(draft){let removed=0;draft.exercises.forEach(item=>{const before=item.sets.length;item.sets=item.sets.filter(set=>!isInvalidSet(item,set));removed+=before-item.sets.length;});draft.exercises=draft.exercises.filter(item=>item.sets.length);renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();if(removed)showToast(`Deleted ${removed} unfilled set${removed===1?'':'s'}.`);}finishWorkout();});
    $('#dashboardNav').addEventListener('click', () => goTab(showDashboard, 'dashboard'));
    $('#workoutsNav').addEventListener('click', () => {
      // Re-tapping the active Workout tab pops a completed-workout review back to the
      // start screen; otherwise it just scrolls to top. A live draft is never disturbed.
      if (state.activeView === 'workout' && !workoutState.draft && !$('#workoutComplete').hidden) {
        $('#workoutComplete').hidden = true; renderWorkoutScreen(); window.scrollTo({top:0}); return;
      }
      if (state.activeView === 'workout') { state.scroll.workout = 0; window.scrollTo({top:0}); return; }
      goTab(showWorkouts, 'workout');
    });
    $('#programNav').addEventListener('click', () => goTab(showProgram, 'program'));
    $('#statsNav').addEventListener('click', () => goTab(showStats, 'stats'));
    $('#topBarSettings').addEventListener('click', () => goTab(showSettings, 'settings'));
    $('#detailFavToggle')?.addEventListener('click', () => toggleFavorite(state.selected));
    $('#topBarBack').addEventListener('click', () => {
      if (state.activeView === 'detail') backFromExerciseDetail();
      else if (state.activeView === 'settings') backFromSettings();
      else history.back();
    });
    /* Program setup form controls edit the form draft, never the global
       defaults (Justin 2026-09-10). */
    $('#progressionThreshold').addEventListener('input',e=>{programFormProgression().threshold=Number(e.target.value)||8;schedulePersist();});
    $('#progressionIncrementType').addEventListener('change',e=>{programFormProgression().incrementType=e.target.value;schedulePersist();});
    $('#progressionIncrementValue').addEventListener('input',e=>{programFormProgression().incrementValue=Number(e.target.value)||5;schedulePersist();});
    $('#programRepMin').addEventListener('input',e=>{const d=programFormProgression();d.defaultRange.min=Math.max(1,Number(e.target.value)||1);d.defaultRange.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    $('#programRepMax').addEventListener('input',e=>{const d=programFormProgression(),v=e.target.value.trim();d.defaultRange.max=v===''?null:Math.max(d.defaultRange.min,Number(v)||d.defaultRange.min);d.defaultRange.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset);schedulePersist();}));
    document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset,programFormProgression());schedulePersist();}));
    $('#undulatingToggle').addEventListener('click',()=>{const d=programFormProgression();d.undulating=!d.undulating;$('#undulatingToggle').setAttribute('aria-pressed',String(d.undulating));$('#undulatingToggle').setAttribute('aria-label',`Vary rep ranges by week ${d.undulating?'on':'off'}`);renderWeekRanges(d);schedulePersist();});
    $('#programLength').addEventListener('input',()=>renderWeekRanges());
    $('#manageProgramOverrides').addEventListener('click',()=>{if(workoutState.activeProgram){$('#programSetup').hidden=true;document.querySelector('#programWorkouts')?.scrollIntoView({behavior:'smooth'});}else{$('#programError').textContent='Create the program first, then edit overrides inside each workout.';}});
    document.querySelectorAll('[data-treatment]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.treatment=button.dataset.treatment;document.querySelectorAll('[data-treatment]').forEach(row=>row.setAttribute('aria-pressed',String(row===button)));schedulePersist();}));
    $('#stallDetectorToggle').addEventListener('click',()=>{const d=programFormProgression();d.stallDetection=!d.stallDetection;$('#stallDetectorToggle').setAttribute('aria-pressed',String(d.stallDetection));$('#stallDetectorToggle').setAttribute('aria-label',`Stall detector ${d.stallDetection?'on':'off'}`);schedulePersist();});
    $('#createProgram').addEventListener('click', createProgram);
    $('#startBlankWorkout').addEventListener('click', () => startBlankWorkout());
    $('#repeatLastWorkout').addEventListener('click',()=>repeatWorkout(workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]));
    $('#addWorkoutExercise').addEventListener('click', () => {
      workoutState.pickerMode='draft';workoutState.programWorkoutTarget=null;
      $('#exercisePickerTitle').textContent='Add exercise';
      $('#exercisePickerTitle').nextElementSibling.textContent='Choose one or more movements for this workout.';
      $('#exercisePickerSearch').value = '';
      preparePickerFilters();
      renderExercisePicker();
      $('#exercisePickerDialog').showModal();
      requestAnimationFrame(() => $('#exercisePickerSearch').focus());
    });
    $('#closeExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();if(workoutState.pickerMode==='program')renderProgram();});
    $('#doneExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();if(workoutState.pickerMode==='program')renderProgram();});
    /* Workout focus (2026-09-10): one tap applies a rep-range preset to every
       reps-tracked exercise in the draft. Explicit choice, so profiles become
       custom (the engine follows the chosen zone instead of last session's). */
    document.querySelectorAll('[data-workout-focus]').forEach(button=>button.addEventListener('click',()=>{
      if(!workoutState.draft)return;
      const key=button.dataset.workoutFocus;
      /* "No focus" clears the workout-level selection (Justin 2026-09-10);
         per-exercise ranges already applied stay as the exercises' own settings. */
      if(!key){workoutState.draft.focusPreset=null;syncWorkoutFocusPills();markDraftSaved();return;}
      const preset=REP_PRESETS[key]; if(!preset)return;
      workoutState.draft.focusPreset=key;
      workoutState.draft.exercises.forEach(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        if(exerciseTracking(item,ex)==='time')return;
        item.progression={...(item.progression||{}),preset:button.dataset.workoutFocus,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap,custom:true};
      });
      prepareDraftProgression(workoutState.draft,freeformProgressionConfig());
      renderWorkoutExercises(); renderWorkoutProgression(); syncWorkoutFocusPills(); markDraftSaved();
    }));
    $('#exercisePickerSearch').addEventListener('input', renderPickerList);
    /* Picker filter panel: the Exercises tab's selector interface inside the
       add-exercise dialog (Justin 2026-09-10). */
    $('#pickerFilterToggle').addEventListener('click',()=>{
      const panel=$('#pickerFilterPanel'),open=panel.classList.toggle('open');
      $('#pickerFilterToggle').setAttribute('aria-expanded',String(open));
    });
    $('#pickerMuscleOptions').addEventListener('click',event=>{
      const b=event.target.closest('[data-picker-muscle]');if(!b)return;
      const m=b.dataset.pickerMuscle;
      if(pickerFilters.muscles.has(m))pickerFilters.muscles.delete(m);else pickerFilters.muscles.add(m);
      renderPickerFilterState();renderPickerList();
    });
    $('#pickerFavoritesToggle').addEventListener('click',()=>{pickerFilters.onlyFavorites=!pickerFilters.onlyFavorites;renderPickerFilterState();renderPickerList();});
    $('#pickerCustomToggle').addEventListener('click',()=>{pickerFilters.onlyCustom=!pickerFilters.onlyCustom;renderPickerFilterState();renderPickerList();});
    $('#pickerEquipmentFilter').addEventListener('change',event=>{pickerFilters.equipment=event.target.value;renderPickerList();});
    $('#pickerClearMuscles').addEventListener('click',()=>{pickerFilters.muscles.clear();renderPickerFilterState();renderPickerList();});
    $('#workoutName').addEventListener('input', event => { if (workoutState.draft) { workoutState.draft.name = event.target.value; markDraftSaved(); } });
    /* The native date input sits invisibly over the pretty date display, so
       tapping it opens the OS date picker directly (showPicker on a hidden
       input was unreliable on iOS). Both input and change are wired because
       some browsers only fire change for picker selections. */
    const workoutDateChanged=event=>{if(workoutState.draft&&event.target.value){workoutState.draft.date=event.target.value;markDraftSaved();}renderWorkoutDateDisplay();};
    $('#workoutDate').addEventListener('input',workoutDateChanged);
    $('#workoutDate').addEventListener('change',workoutDateChanged);
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
    $('#cancelWorkout').addEventListener('click', () => { $('#discardDraftDialog').showModal(); });
    const doDiscardDraft=() => {
      workoutState.draft = null;
      $('#workoutComplete').hidden = true;
      $('#workoutError').textContent = '';
      persistNow();
      renderWorkoutScreen();
    };
    $('#closeDiscardDraft').addEventListener('click', () => $('#discardDraftDialog').close());
    $('#keepDraftButton').addEventListener('click', () => $('#discardDraftDialog').close());
    $('#confirmDiscardDraft').addEventListener('click', () => { $('#discardDraftDialog').close(); doDiscardDraft(); });
    /* The click event must not leak into finishWorkout(skipInvalid) (Justin
       2026-09-10: the event object is truthy and was skipping the check). */
    $('#finishWorkout').addEventListener('click', () => finishWorkout());

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
    $('#libraryNav').addEventListener('click', () => goTab(showLibrary, 'library'));
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
    updateLiveWorkoutIndicator();
    populateFilters(); renderLibrary(); renderDashboard(); renderStats();
    const initialId = decodeURIComponent(location.hash.slice(1));
    if (initialId === 'library') showLibrary(false); else if (initialId === 'workout') showWorkouts(false); else if (initialId === 'program') showProgram(false); else if (initialId === 'stats') showStats(false); else if (initialId === 'settings') showSettings(false); else if (initialId && exercises.some(x => x.id === initialId)) openExercise(initialId, false); else showDashboard(false);
  
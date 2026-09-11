
/* ===== module: app-bootstrap.js ===== */
    /** Connects static controls to feature modules and performs initial rendering. */
    /* Native-app feel (2026-09-11): on touch devices (phones/tablets — NOT
       desktop), lock the viewport scale and hide scrollbars so the app
       feels native in both the home-screen app and mobile browser tabs.
       pointer:coarse is the touch-vs-desktop line; done in JS (not the
       static meta/CSS) so desktop is completely unaffected. */
    (function(){
      var touch=false;
      try{touch=!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches);}catch(_){}
      if(!touch)return;
      document.documentElement.classList.add('is-touch');
      /* iOS Home Screen apps cache the system status-bar tint at launch —
         flag standalone so the theme section can note the relaunch caveat. */
      var standalone=false;
      try{standalone=(window.navigator&&window.navigator.standalone===true)||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);}catch(_){}
      if(standalone)document.documentElement.classList.add('is-standalone');
      var vp=document.querySelector('meta[name="viewport"]');
      if(vp)vp.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      /* Catches older iOS versions that still fire gesture events; the
         touch-action CSS above carries modern mobile browsers (iOS Safari
         ignores user-scalable=no, but honors touch-action). */
      document.addEventListener('gesturestart',function(e){e.preventDefault();},{passive:false});
    })();
    /** Theme state (user 2026-09-10): four themes in two visual columns.
        The dark toggle moves between the matching pills: Cruciferous <->
        Asterid, Rosé <-> Matcha — the newly active theme's pill is always
        the one shown selected. Tapping the Cruciferous pill always lands on
        Cruciferous light; tapping an already-active non-default pill also
        resets to Cruciferous light. Persisted as workout-theme (dark/light)
        + workout-theme-name (+ legacy workout-theme-light, kept for stored
        prefs). */
    let themeName='cruciferous', darkMode=false, ctpDark='mocha', lightTheme='cruciferous', swipeToDeleteSets=true;
    const ROSEPINE='rosepine', DARK_FLAVORS=['macchiato','mocha'], LIGHT_THEMES=['cruciferous','rosepine'];
    function applyTheme(){
      const eff=themeName==='cruciferous'?(darkMode?'macchiato':'light'):themeName;
      document.documentElement.dataset.theme=eff;
      const toggle=$('#darkModeToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(darkMode));toggle.setAttribute('aria-label',`Dark mode ${darkMode?'on':'off'}`);}
      document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeName===themeName)));
      const color=getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();document.querySelector('meta[name="theme-color"]').setAttribute('content',color);document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content',darkMode?'black-translucent':'default');
      try{localStorage.setItem('workout-theme',darkMode?'dark':'light');localStorage.setItem('workout-theme-name',themeName);localStorage.setItem('workout-theme-light',lightTheme);}catch(_){}
      /* Theme changes are account settings too: flag the appearance sync key. */
      if(typeof schedulePersist==='function')schedulePersist();
    }
    /** Accounts sync: appearance travels as one key so the theme follows the
        account across devices. Validated on the way in; garbage never applies. */
    function getAppearanceState(){return {themeName:themeName,darkMode:darkMode,ctpDark:ctpDark,lightTheme:lightTheme,swipeToDeleteSets:swipeToDeleteSets};}
    function setAppearanceState(v){
      if(!v||typeof v!=='object')return;
      if(!['cruciferous','rosepine','macchiato','mocha'].includes(v.themeName))return;
      if(typeof v.darkMode!=='boolean')return;
      if(!DARK_FLAVORS.includes(v.ctpDark)||!LIGHT_THEMES.includes(v.lightTheme))return;
      themeName=v.themeName;darkMode=v.darkMode;ctpDark=v.ctpDark;lightTheme=v.lightTheme;
      if(typeof v.swipeToDeleteSets==='boolean')swipeToDeleteSets=v.swipeToDeleteSets;
      applyTheme();applySwipeSets();
    }
    /** Swipe-to-delete for set rows (user 2026-09-11): a Settings toggle that
        travels with the appearance sync key. The gesture itself only engages on
        touch devices — desktop keeps the × button regardless. */
    function applySwipeSets(){
      document.documentElement.classList.toggle('swipe-sets',swipeToDeleteSets);
      const toggle=$('#swipeDeleteSetsToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(swipeToDeleteSets));toggle.setAttribute('aria-label',`Swipe to delete sets ${swipeToDeleteSets?'on':'off'}`);}
    }
    function swipeDeleteSetsEnabled(){return swipeToDeleteSets&&document.documentElement.classList.contains('is-touch');}
    function setThemeName(name){
      themeName=name;
      if(name===ROSEPINE){darkMode=false;lightTheme=ROSEPINE;}
      /* Cruciferous always means Cruciferous light — tapping the pill must show
         the default theme, never linger in a dark palette (user 2026-09-10).
         The Cruciferous<->Asterid dark relationship lives in the dark toggle. */
      else if(name==='cruciferous'){darkMode=false;lightTheme='cruciferous';}
      else{ /* dark Catppuccin flavor */ darkMode=true;ctpDark=name;}
      applyTheme();
    }
    /** Highlights the active workout-focus pill from the draft's explicit choice (user 2026-09-10). */
    function syncWorkoutFocusPills(){
      const key=workoutState.draft?.focusPreset||null;
      document.querySelectorAll('[data-workout-focus]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workoutFocus===key)));
    }
    /** Light unit suffix inside the program increment value field; follows the program form's type. */
    function syncProgramIncrementUnit(){
      const unit=$('#programIncrementUnit');
      if(unit) unit.textContent = programFormProgression().incrementType==='percent' ? '%' : weightUnit();
    }
    /** Light unit suffix inside the increment value field; follows the type (user 2026-09-10). */
    function syncSettingsIncrementUnit(){
      const unit=$('#settingsIncrementUnit');
      if(unit) unit.textContent = progressionSetup.incrementType==='percent' ? '%' : weightUnit();
      const typeOpt=$('#settingsIncrementType option[value="lb"]');
      if(typeOpt) typeOpt.textContent = isMetric() ? 'Kilograms (kg)' : 'Pounds (lb)';
    }
    function syncUnitPills(){
      document.querySelectorAll('#settingsUnitPills [data-units]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.units===(progressionSetup.units||'imperial'))));
    }
    /* Stats default metric pills (user 2026-09-11): saved under Units,
       persisted in progressionSetup (synced with the account). */
    function syncStatsDefaultPills(){
      const def=progressionSetup.statsDefaultMetric==='sets'?'sets':'volume';
      document.querySelectorAll('#settingsStatsDefaultPills [data-stats-default]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.statsDefault===def)));
    }
    /** Mirrors the program form: the RPE trigger only applies to RPE-based mode. */
    function syncSettingsScheme(){
      const scheme=progressionSetup.scheme||'rpe';
      document.querySelectorAll('#settingsSchemePills [data-scheme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scheme===scheme)));
      const thresholdField=$('#settingsRpeThreshold');
      if(thresholdField)thresholdField.closest('.rule-field').hidden=scheme==='linear'||scheme==='onerm';
      const incrementField=$('#settingsIncrementType');
      if(incrementField)incrementField.closest('.settings-pair').hidden=scheme==='onerm';
    }
    function renderSettings(){
      const darkToggle=$('#darkModeToggle');
      if(darkToggle){darkToggle.setAttribute('aria-pressed',String(darkMode));darkToggle.setAttribute('aria-label',`Dark mode ${darkMode?'on':'off'}`);}
      const swipeToggle=$('#swipeDeleteSetsToggle');
      if(swipeToggle){swipeToggle.setAttribute('aria-pressed',String(swipeToDeleteSets));swipeToggle.setAttribute('aria-label',`Swipe to delete sets ${swipeToDeleteSets?'on':'off'}`);}
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
      syncStatsDefaultPills();
      syncTimeStepPills($('#settingsTimeStepPills'),progressionSetup.timeStep);
      const stall=$('#settingsStallToggle');
      stall.setAttribute('aria-pressed',String(!!progressionSetup.stallDetection));
      stall.setAttribute('aria-label',`Stall detector ${progressionSetup.stallDetection?'on':'off'}`);
      syncSettingsScheme();
      const und=$('#settingsUndulatingToggle');
      und.setAttribute('aria-pressed',String(!!progressionSetup.undulating));
      und.setAttribute('aria-label',`Vary rep ranges by week ${progressionSetup.undulating?'on':'off'}`);
      const del=$('#deleteAllDataButton');
      const hasSamples=hasSampleData();
      const addBtn=$('#addSampleDataButton'),clearBtn=$('#clearSampleDataButton');
      if(addBtn){addBtn.disabled=hasSamples;addBtn.textContent=hasSamples?'Sample data added':'Add sample data';addBtn.title=hasSamples?'Sample workouts are already in your history':'Add 8 labeled sample workouts across the last ~3 weeks';}
      if(clearBtn){clearBtn.disabled=!hasSamples;clearBtn.title=hasSamples?'Remove all sample workouts (your real workouts stay)':'No sample data to clear';}
    }
    window.addEventListener('load', () => {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        /* updateViaCache:'none' (user 2026-09-11): the browser must never
           serve a cached sw.js when checking for updates — GitHub Pages sends
           max-age=600 and its headers aren't configurable. */
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
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

    /* #14: the top-exercises metric is now a two-button segmented control;
       its wiring lives in renderMuscleAnalysis (dashboard-stats.js). */

    $('#darkModeToggle').addEventListener('click',()=>{
      darkMode=!darkMode;
      /* The toggle walks to the matching theme pill (user 2026-09-10):
         Cruciferous <-> Asterid, Rosé <-> Matcha. */
      if(darkMode){ if(themeName==='cruciferous')themeName='macchiato'; else if(themeName===ROSEPINE)themeName='mocha'; }
      else{ if(themeName==='macchiato')themeName='cruciferous'; else if(themeName==='mocha')themeName=ROSEPINE; }
      applyTheme();
    });
    $('#swipeDeleteSetsToggle').addEventListener('click',()=>{
      swipeToDeleteSets=!swipeToDeleteSets;
      applySwipeSets();
      /* Flipping the toggle changes the appearance sync key — persist + sync it. */
      if(typeof schedulePersist==='function')schedulePersist();
    });
    document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.addEventListener('click',()=>{
      const name=button.dataset.themeName;
      /* Tapping the active pill resets to Cruciferous light. Tapping
         "Cruciferous" always shows Cruciferous light (user 2026-09-10) —
         the dark side of that column is reached via the dark toggle. */
      if(name===themeName){ themeName='cruciferous';darkMode=false;lightTheme='cruciferous';applyTheme(); return; }
      setThemeName(name);
    }));
    document.querySelectorAll('#settingsUnitPills [data-units]').forEach(button=>button.addEventListener('click',()=>{
      progressionSetup.units=button.dataset.units; syncUnitPills(); syncSettingsIncrementUnit(); syncProgramIncrementUnit(); schedulePersist();
      renderDashboard(); renderStats(); renderWorkoutScreen(); renderWorkoutProgression();
    }));
    document.querySelectorAll('#settingsStatsDefaultPills [data-stats-default]').forEach(button=>button.addEventListener('click',()=>{
      const def=button.dataset.statsDefault; if(progressionSetup.statsDefaultMetric===def)return;
      progressionSetup.statsDefaultMetric=def; syncStatsDefaultPills(); schedulePersist();
      /* Apply immediately: both Stats toggles follow the new default. */
      state.topExercisesMode=def; state.muscleVolumeMode=def; renderStats();
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
    document.querySelectorAll('#settingsSchemePills [data-scheme]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.scheme=button.dataset.scheme;syncSettingsScheme();schedulePersist();}));
    $('#settingsUndulatingToggle').addEventListener('click',()=>{progressionSetup.undulating=!progressionSetup.undulating;const toggle=$('#settingsUndulatingToggle');toggle.setAttribute('aria-pressed',String(!!progressionSetup.undulating));toggle.setAttribute('aria-label',`Vary rep ranges by week ${progressionSetup.undulating?'on':'off'}`);schedulePersist();});
    $('#progressionInfoButton').addEventListener('click',()=>$('#progressionInfoDialog').showModal());
    $('#programProgressionInfoButton').addEventListener('click',()=>$('#progressionInfoDialog').showModal());
    $('#closeProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#doneProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#exportDataButton').addEventListener('click',()=>{downloadWorkoutBackup();showToast('Backup downloaded.');});
    $('#addSampleDataButton').addEventListener('click',()=>{addSampleData();});
    $('#clearSampleDataButton').addEventListener('click',()=>{clearSampleData();});
    $('#deleteAllDataButton').addEventListener('click',()=>{$('#deleteAllDialog').showModal();});
    $('#cancelDeleteAll').addEventListener('click',()=>$('#deleteAllDialog').close());
    $('#keepDeleteAll').addEventListener('click',()=>$('#deleteAllDialog').close());
    $('#confirmDeleteAll').addEventListener('click',()=>{
      $('#deleteAllDialog').close();
      try{localStorage.removeItem(PERSIST_KEY);}catch(_){}
      workoutState.completed=[];workoutState.templates=[];workoutState.tags=[];workoutState.exerciseTagPresets=[];workoutState.draft=null;workoutState.activeProgram=null;workoutState.archivedPrograms=[];
      state.customExercises=[];exercises=exercises.filter(ex=>!ex.custom);
      /* Favorites are user data too: clear them in memory so the pagehide
       * persist-on-reload below can't resurrect them. */
      if(state.favorites&&typeof state.favorites.clear==='function')state.favorites.clear();
      /* Accounts: the emptied state must win over remote data — flag it dirty
         now (so a later pull can't resurrect it) and best-effort wipe the
         remote rows before reloading. Signed-out behavior is unchanged. */
      if(typeof markSyncDirty==='function'){try{markSyncDirty();}catch(_){}}
      const doReloadAfterDelete=()=>location.reload();
      if(typeof wipeRemoteData==='function'){
        let settled=false;
        const finish=()=>{if(!settled){settled=true;doReloadAfterDelete();}};
        setTimeout(finish,3000);
        try{wipeRemoteData().then(finish,finish);}catch(_){finish();}
      }else doReloadAfterDelete();
    });
    try{
      darkMode=(localStorage.getItem('workout-theme')||'light')==='dark';
      themeName=localStorage.getItem('workout-theme-name')||'cruciferous';
      if(themeName==='latte')themeName='rosepine';else if(themeName==='frappe')themeName='macchiato';
      if(!['cruciferous','rosepine','macchiato','mocha'].includes(themeName))themeName='cruciferous';
      if(DARK_FLAVORS.includes(themeName))ctpDark=themeName;
      try{const savedLight=localStorage.getItem('workout-theme-light');if(LIGHT_THEMES.includes(savedLight))lightTheme=savedLight;}catch(_){}
    }catch(_){}
    applyTheme();applySwipeSets();
    $('#closeReplaceDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#keepCurrentDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#confirmReplaceDraft').addEventListener('click',()=>{const workout=pendingRepeatWorkout;pendingRepeatWorkout=null;$('#replaceDraftDialog').close();if(workout)repeatWorkout(workout,true);});
    /* Review dialog retired 2026-09-11 (user): finish now drops incomplete
       sets automatically — no dialog needed. */
    $('#dashboardNav').addEventListener('click', () => goTab(showDashboard, 'dashboard'));
    $('#workoutsNav').addEventListener('click', () => {
      // Re-tapping the active Workout tab pops a completed-workout review back to the
      // start screen; otherwise it just scrolls to top. A live draft is never disturbed.
      if (state.activeView === 'workout' && !workoutState.draft && !$('#workoutComplete').hidden) {
        $('#workoutComplete').hidden = true; renderWorkoutScreen(); window.scrollTo({top:0}); return;
      }
      if (state.activeView === 'workout') { state.scroll[scrollKeyFor('workout')] = 0; window.scrollTo({top:0}); return; }
      goTab(showWorkouts, 'workout');
    });
    $('#programNav').addEventListener('click', () => goTab(showProgram, 'program'));
    $('#statsNav').addEventListener('click', () => goTab(showStats, 'stats'));
    /* The gear stays visible (active) on Settings — re-tapping it must not push
       a duplicate history entry, or the first Back tap just re-shows Settings
       (#27). Like the bottom tabs, re-tap scrolls to top instead. */
    $('#topBarSettings').addEventListener('click', () => {
      if (state.activeView === 'settings') { window.scrollTo({top:0, behavior:'auto'}); return; }
      goTab(showSettings, 'settings');
    });
    $('#detailFavToggle')?.addEventListener('click', () => toggleFavorite(state.selected));
    $('#topBarBack').addEventListener('click', () => {
      if (state.activeView === 'detail') backFromExerciseDetail();
      else if (state.activeView === 'settings') backFromSettings();
      else history.back();
    });
    /* Program setup form controls edit the form draft, never the global
       defaults (user 2026-09-10). */
    $('#progressionThreshold').addEventListener('input',e=>{programFormProgression().threshold=Number(e.target.value)||8;schedulePersist();});
    $('#progressionIncrementType').addEventListener('change',e=>{programFormProgression().incrementType=e.target.value;syncProgramIncrementUnit();schedulePersist();});
    $('#progressionIncrementValue').addEventListener('input',e=>{programFormProgression().incrementValue=Number(e.target.value)||5;schedulePersist();});
    $('#programRepMin').addEventListener('input',e=>{const d=programFormProgression();d.defaultRange.min=Math.max(1,Number(e.target.value)||1);d.defaultRange.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    $('#programRepMax').addEventListener('input',e=>{const d=programFormProgression(),v=e.target.value.trim();d.defaultRange.max=v===''?null:Math.max(d.defaultRange.min,Number(v)||d.defaultRange.min);d.defaultRange.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset);schedulePersist();}));
    document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset,programFormProgression());schedulePersist();}));
    document.querySelectorAll('#programSchemePills [data-scheme]').forEach(button=>button.addEventListener('click',()=>{programFormProgression().scheme=button.dataset.scheme;syncProgramForm();schedulePersist();}));
    $('#undulatingToggle').addEventListener('click',()=>{const d=programFormProgression();d.undulating=!d.undulating;$('#undulatingToggle').setAttribute('aria-pressed',String(d.undulating));$('#undulatingToggle').setAttribute('aria-label',`Vary rep ranges by week ${d.undulating?'on':'off'}`);renderWeekRanges(d);schedulePersist();});
    $('#programLength').addEventListener('input',()=>renderWeekRanges());
    /* Per-exercise progression overrides are edited inside each program
       workout directly — no separate management screen (#45). */
    document.querySelectorAll('[data-treatment]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.treatment=button.dataset.treatment;document.querySelectorAll('[data-treatment]').forEach(row=>row.setAttribute('aria-pressed',String(row===button)));schedulePersist();}));
    $('#stallDetectorToggle').addEventListener('click',()=>{const d=programFormProgression();d.stallDetection=!d.stallDetection;$('#stallDetectorToggle').setAttribute('aria-pressed',String(d.stallDetection));$('#stallDetectorToggle').setAttribute('aria-label',`Stall detector ${d.stallDetection?'on':'off'}`);schedulePersist();});
    $('#createProgram').addEventListener('click', createProgram);
    $('#startBlankWorkout').addEventListener('click', () => startBlankWorkout());
    $('#startNewTemplate')?.addEventListener('click', () => { if (typeof openNewTemplateDialog === 'function') openNewTemplateDialog(); });
    $('#repeatLastWorkout').addEventListener('click',()=>repeatWorkout(workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]));
    $('#addWorkoutExercise').addEventListener('click', () => {
      workoutState.pickerMode='draft';workoutState.programWorkoutTarget=null;
      $('#exercisePickerTitle').textContent='Add exercise';
      $('#exercisePickerTitle').nextElementSibling.textContent='Choose one or more movements for this workout.';
      $('#exercisePickerSearch').value = '';
      preparePickerFilters();
      resetPickerSession();
      renderExercisePicker();
      $('#exercisePickerDialog').showModal();
      requestAnimationFrame(() => $('#exercisePickerSearch').focus());
    });
    $('#closeExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();if(workoutState.pickerMode==='program')renderProgram();else if(workoutState.pickerMode==='template'){schedulePersist();renderWorkoutTemplateList();}});
    $('#doneExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();if(workoutState.pickerMode==='program')renderProgram();else if(workoutState.pickerMode==='template'){schedulePersist();renderWorkoutTemplateList();}});
    /* Workout focus (2026-09-10): one tap applies a rep-range preset to every
       reps-tracked exercise in the draft. Explicit choice, so profiles become
       custom (the engine follows the chosen zone instead of last session's).
       #53: when the tap would wipe per-exercise ranges the user set themselves,
       confirm first — a silent one-tap clobber of a careful setup was the bug.
       Taps that change nothing already in place apply without a prompt. */
    function focusPresetName(preset){
      return (preset.amrap||preset.openTop) ? preset.label : `${preset.label} · ${preset.min}–${preset.max}`;
    }
    function focusPresetClobbers(preset){
      return (workoutState.draft?.exercises||[]).filter(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        if(exerciseTracking(item,ex)==='time')return false;
        const p=item.progression||{};
        return p.custom&&(p.min!==preset.min||p.max!==preset.max||!!p.openTop!==!!preset.openTop||!!p.amrap!==!!preset.amrap);
      });
    }
    function applyWorkoutFocus(key){
      const preset=REP_PRESETS[key]; if(!preset||!workoutState.draft)return;
      workoutState.draft.focusPreset=key;
      workoutState.draft.exercises.forEach(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        if(exerciseTracking(item,ex)==='time')return;
        item.progression={...(item.progression||{}),preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap,custom:true};
      });
      prepareDraftProgression(workoutState.draft,freeformProgressionConfig());
      renderWorkoutExercises(); renderWorkoutProgression(); syncWorkoutFocusPills(); markDraftSaved();
    }
    let pendingFocusKey=null;
    document.querySelectorAll('[data-workout-focus]').forEach(button=>button.addEventListener('click',()=>{
      if(!workoutState.draft)return;
      const key=button.dataset.workoutFocus;
      /* "No focus" clears the workout-level selection (user 2026-09-10);
         per-exercise ranges already applied stay as the exercises' own settings. */
      if(!key){workoutState.draft.focusPreset=null;syncWorkoutFocusPills();markDraftSaved();return;}
      const preset=REP_PRESETS[key]; if(!preset)return;
      const clobbered=focusPresetClobbers(preset);
      if(!clobbered.length){applyWorkoutFocus(key);return;}
      pendingFocusKey=key;
      $('#focusConfirmCopy').textContent=`This replaces the rep ranges you set on ${clobbered.length} exercise${clobbered.length===1?'':'s'} with ${focusPresetName(preset)}. Timed exercises are untouched.`;
      $('#focusConfirmDialog').showModal();
    }));
    $('#closeFocusConfirm').addEventListener('click',()=>$('#focusConfirmDialog').close());
    $('#focusConfirmCancel').addEventListener('click',()=>$('#focusConfirmDialog').close());
    $('#focusConfirmApply').addEventListener('click',()=>{$('#focusConfirmDialog').close();if(pendingFocusKey){applyWorkoutFocus(pendingFocusKey);pendingFocusKey=null;}});
    $('#exercisePickerSearch').addEventListener('input', renderPickerList);
    /* Picker filter panel: the Exercises tab's selector interface inside the
       add-exercise dialog (user 2026-09-10). */
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

    /* Build stamp (user 2026-09-11): version + last-updated in Settings → About. */
    try{
      const info=window.BUILD_INFO;
      if(info){
        $('#appVersionLine').textContent=`Cruciferous Greens Workout · v${info.appVersion}`;
        const built=new Date(info.builtAt);
        $('#buildUpdatedLine').textContent='Last updated: '+(isNaN(built)?info.build:built.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}));
      }
    }catch(_){}
    restorePersisted();
    /* Stats metric default (user 2026-09-11): the Volume|Sets toggles on the
       Stats page initialize to the saved Units → Stats default on every load. */
    state.topExercisesMode=state.muscleVolumeMode=(progressionSetup.statsDefaultMetric==='sets'?'sets':'volume');
    /* Boot guarantee (user 2026-09-11 marathon): the swipe-sets class must
       reflect the restored setting even if the appearance-key restore above
       was skipped — otherwise the inline × stays visible on touch. */
    applySwipeSets();
    updateLiveWorkoutIndicator();
    populateFilters(); renderLibrary(); renderDashboard(); renderStats();
    const initialId = decodeURIComponent(location.hash.slice(1));
    if (initialId === 'library') showLibrary(false); else if (initialId === 'workout') showWorkouts(false); else if (initialId === 'program') showProgram(false); else if (initialId === 'stats') showStats(false); else if (initialId === 'settings') showSettings(false); else if (initialId && exercises.some(x => x.id === initialId)) openExercise(initialId, false); else showDashboard(false);
  
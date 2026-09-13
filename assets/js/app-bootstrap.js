
/* ===== module: app-bootstrap.js ===== */
    /** Connects static controls to feature modules and performs initial rendering. */
    /* Module map (v1.006) — Key: touch-viewport IIFE, the static-control wiring block, renderSettings(), applyTheme(), setThemeName(), renderSettingsWeekRanges(). Depends on: every feature module (loads last — it wires the static DOM controls to all feature modules and performs the initial render). */
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
        Macchiato, Rosé Pine <-> Mocha — the newly active theme's pill is
        always the one shown selected. Tapping the Cruciferous pill always
        lands on Cruciferous light; tapping an already-active non-default
        pill also resets to Cruciferous light. Persisted as workout-theme
        (dark/light) + workout-theme-name (+ legacy workout-theme-light,
        kept for stored prefs). */
    let swipeToDeleteSets=true;
    /* #99 B20: ONE theme value object instead of four overlapping variables
       (themeName/darkMode/ctpDark/lightTheme). `name` is the active pill:
       cruciferous|rosepine are the light families, macchiato|mocha the dark
       flavors; `dark` is the dark-mode toggle; `darkFlavor`/`lightName`
       remember which flavor the toggle walks to in each column. */
    const themeState={name:'cruciferous',dark:false,darkFlavor:'mocha',lightName:'cruciferous'};
    const ROSEPINE='rosepine', DARK_FLAVORS=['macchiato','mocha'], LIGHT_THEMES=['cruciferous','rosepine'];
    /* #99 B20: ONE apply path. The effective theme is one of
       light|macchiato|rosepine|mocha — the same vocabulary the inline head
       script writes pre-paint, so the value never changes during boot. */
    function applyTheme(){
      const t=themeState, eff=t.name==='cruciferous'?(t.dark?'macchiato':'light'):t.name;
      document.documentElement.dataset.theme=eff;
      const toggle=$('#darkModeToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(t.dark));toggle.setAttribute('aria-label',`Dark mode ${t.dark?'on':'off'}`);}
      document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeName===t.name)));
      const color=getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();document.querySelector('meta[name="theme-color"]').setAttribute('content',color);document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content',t.dark?'black-translucent':'default');
      try{localStorage.setItem('workout-theme',t.dark?'dark':'light');localStorage.setItem('workout-theme-name',t.name);localStorage.setItem('workout-theme-light',t.lightName);}catch(_){}
      /* Theme changes are account settings too: flag the appearance sync key. */
      if(typeof schedulePersist==='function')schedulePersist();
    }
    /** Accounts sync: appearance travels as one key so the theme follows the
        account across devices. Validated on the way in; garbage never applies.
        The sync payload shape ({themeName,darkMode,ctpDark,lightTheme}) is
        kept byte-compatible across app versions — only the in-memory model
        moved into themeState. */
    function getAppearanceState(){return {themeName:themeState.name,darkMode:themeState.dark,ctpDark:themeState.darkFlavor,lightTheme:themeState.lightName,swipeToDeleteSets:swipeToDeleteSets};}
    function setAppearanceState(v){
      if(!v||typeof v!=='object')return;
      if(!['cruciferous','rosepine','macchiato','mocha'].includes(v.themeName))return;
      if(typeof v.darkMode!=='boolean')return;
      if(!DARK_FLAVORS.includes(v.ctpDark)||!LIGHT_THEMES.includes(v.lightTheme))return;
      themeState.name=v.themeName;themeState.dark=v.darkMode;themeState.darkFlavor=v.ctpDark;themeState.lightName=v.lightTheme;
      if(typeof v.swipeToDeleteSets==='boolean')swipeToDeleteSets=v.swipeToDeleteSets;
      applyTheme();applySwipeSets();
    }
    /** Swipe-to-delete for set rows (user 2026-09-11): a Settings toggle that
        travels with the appearance sync key. The gesture itself only engages on
        touch devices — desktop keeps the × button regardless. */
    function applySwipeSets(){
      document.documentElement.classList.toggle('swipe-sets',swipeToDeleteSets);
      const toggle=$('#swipeDeleteSetsToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(swipeToDeleteSets));toggle.setAttribute('aria-label',`Swipe to delete ${swipeToDeleteSets?'on':'off'}`);}
    }
    function swipeDeleteSetsEnabled(){return swipeToDeleteSets&&document.documentElement.classList.contains('is-touch');}
    function setThemeName(name){
      const t=themeState;t.name=name;
      if(name===ROSEPINE){t.dark=false;t.lightName=ROSEPINE;}
      /* Cruciferous always means Cruciferous light — tapping the pill must show
         the default theme, never linger in a dark palette (user 2026-09-10).
         The Cruciferous<->Macchiato dark relationship lives in the dark toggle. */
      else if(name==='cruciferous'){t.dark=false;t.lightName='cruciferous';}
      else{ /* dark Catppuccin flavor */ t.dark=true;t.darkFlavor=name;}
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
      /* #205: show only the selected mode's description under the pills. The
         container keeps a fixed min-height (styles.css) so swapping copy never
         moves the scroll position. */
      const schemeDesc=$('#settingsSchemeDesc');
      if(schemeDesc)schemeDesc.textContent=schemeDescription(scheme);
      const thresholdPills=$('#settingsRpePills');
      if(thresholdPills)thresholdPills.closest('.rule-field').hidden=scheme==='linear'||scheme==='onerm';
      /* %1RM defaults (#54, v1.001): fixed increments don't apply; show the
         % / deload defaults instead. */
      const incPair=$('#settingsIncrementValue')?.closest('.settings-pair');
      if(incPair)incPair.hidden=scheme==='onerm';
      const pctRow=$('#settingsPctRow'); if(pctRow)pctRow.hidden=scheme!=='onerm';
    }
    function renderSettings(){
      const darkToggle=$('#darkModeToggle');
      if(darkToggle){darkToggle.setAttribute('aria-pressed',String(themeState.dark));darkToggle.setAttribute('aria-label',`Dark mode ${themeState.dark?'on':'off'}`);}
      const swipeToggle=$('#swipeDeleteSetsToggle');
      if(swipeToggle){swipeToggle.setAttribute('aria-pressed',String(swipeToDeleteSets));swipeToggle.setAttribute('aria-label',`Swipe to delete ${swipeToDeleteSets?'on':'off'}`);}
      document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeName===themeState.name)));
      document.querySelectorAll('#settingsRpePills [data-rpe-threshold]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.rpeThreshold)===progressionSetup.threshold)));
      /* #99 H6: null-guard every direct DOM write — Settings renders before
         some controls exist on first paint. */
      const incType=$('#settingsIncrementType'); if(incType)incType.value=progressionSetup.incrementType;
      const incVal=$('#settingsIncrementValue'); if(incVal)incVal.value=progressionSetup.incrementValue;
      syncSettingsIncrementUnit();
      const repMin=$('#settingsRepMin'); if(repMin)repMin.value=progressionSetup.defaultRange.min;
      const repMax=$('#settingsRepMax'); if(repMax)repMax.value=progressionSetup.defaultRange.max;
      const activePreset=progressionSetup.defaultRange.preset||'hypertrophy';
      document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===activePreset)));
      syncUnitPills();
      syncStatsDefaultPills();
      syncTimeStepPills($('#settingsTimeStepPills'),progressionSetup.timeStep);
      const pctDef=$('#settingsPercentOf1RM'); if(pctDef)pctDef.value=progressionSetup.percentOf1RM??75;
      /* #321: Auto Deload toggle + panel (defaults for new programs). */
      const settingsAdToggle=$('#settingsAutoDeloadToggle');
      if(settingsAdToggle){const on=!!progressionSetup.autoDeload;settingsAdToggle.setAttribute('aria-pressed',String(on));settingsAdToggle.setAttribute('aria-label',`Auto Deload ${on?'on':'off'}`);}
      const settingsAdPanel=$('#settingsAutoDeloadPanel'); if(settingsAdPanel)settingsAdPanel.hidden=!progressionSetup.autoDeload;
      const deloadEveryDef=$('#settingsDeloadEvery'); if(deloadEveryDef)deloadEveryDef.value=progressionSetup.deloadEvery??4;
      const deloadPctDef=$('#settingsDeloadPct'); if(deloadPctDef)deloadPctDef.value=progressionSetup.deloadPct??60;
      syncSettingsScheme();
      const und=$('#settingsUndulatingToggle');
      if(und){und.setAttribute('aria-pressed',String(!!progressionSetup.undulating));und.setAttribute('aria-label',`Vary rep ranges by week ${progressionSetup.undulating?'on':'off'}`);}
      syncSettingsPeriodization();
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
      const id = existingId || newCustomExerciseId(name);
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
        /* A8 (#99): editing a soft-deleted exercise keeps its tombstone —
           the save must not resurrect it into the library. */
        const prev = state.customExercises.find(ex => ex.id === existingId);
        if (prev?.deletedAt) customExercise.deletedAt = prev.deletedAt;
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
    wireCustomDeleteDialog(); /* A8 (#99): custom-exercise soft-delete confirm. */

    /* #14: the top-exercises metric is now a two-button segmented control;
       its wiring lives in renderMuscleAnalysis (dashboard-stats.js). */

    $('#darkModeToggle').addEventListener('click',()=>{
      const t=themeState;t.dark=!t.dark;
      /* The toggle walks to the matching theme pill (user 2026-09-10):
         Cruciferous <-> Macchiato, Rosé Pine <-> Mocha. */
      if(t.dark){ if(t.name==='cruciferous')t.name='macchiato'; else if(t.name===ROSEPINE)t.name='mocha'; }
      else{ if(t.name==='macchiato')t.name='cruciferous'; else if(t.name==='mocha')t.name=ROSEPINE; }
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
      if(name===themeState.name){ themeState.name='cruciferous';themeState.dark=false;themeState.lightName='cruciferous';applyTheme(); return; }
      setThemeName(name);
    }));
    document.querySelectorAll('#settingsUnitPills [data-units]').forEach(button=>button.addEventListener('click',()=>{
      progressionSetup.units=button.dataset.units; syncUnitPills(); syncSettingsIncrementUnit(); syncProgramIncrementUnit(); schedulePersist();
      renderDashboard(); renderStats(); renderWorkoutScreen(); renderWorkoutProgression();
    }));
    document.querySelectorAll('#settingsStatsDefaultPills [data-stats-default]').forEach(button=>button.addEventListener('click',()=>{
      const def=button.dataset.statsDefault; if(progressionSetup.statsDefaultMetric===def)return;
      progressionSetup.statsDefaultMetric=def; syncStatsDefaultPills(); schedulePersist();
      /* Apply immediately: all Stats toggles follow the new default. */
      state.topExercisesMode=def; state.muscleVolumeMode=def; state.muscleMapMode=def; renderStats();
    }));
    document.querySelectorAll('#settingsRpePills [data-rpe-threshold]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.threshold=Number(button.dataset.rpeThreshold);document.querySelectorAll('#settingsRpePills [data-rpe-threshold]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));schedulePersist();}));
    $('#settingsIncrementType').addEventListener('change',e=>{progressionSetup.incrementType=e.target.value;syncSettingsIncrementUnit();schedulePersist();});
    $('#settingsIncrementValue').addEventListener('input',e=>{progressionSetup.incrementValue=Math.max(0,Number(e.target.value)||0);schedulePersist();});
    $('#settingsRepMin').addEventListener('input',e=>{progressionSetup.defaultRange.min=Math.max(1,Number(e.target.value)||1);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    $('#settingsRepMax').addEventListener('input',e=>{const v=e.target.value.trim();progressionSetup.defaultRange.max=v===''?null:Math.max(progressionSetup.defaultRange.min,Number(v)||progressionSetup.defaultRange.min);progressionSetup.defaultRange.preset='custom';document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    const syncAllTimeStepPills=()=>{syncTimeStepPills($('#settingsTimeStepPills'),progressionSetup.timeStep);syncTimeStepPills($('#programTimeStepPills'),programFormProgression().timeStep);};
    wireTimeStepPills($('#settingsTimeStepPills'),()=>progressionSetup.timeStep,v=>{progressionSetup.timeStep=v;syncAllTimeStepPills();schedulePersist();});
    wireTimeStepPills($('#programTimeStepPills'),()=>programFormProgression().timeStep,v=>{programFormProgression().timeStep=v;syncAllTimeStepPills();schedulePersist();});
    document.querySelectorAll('#settingsSchemePills [data-scheme]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.scheme=button.dataset.scheme;syncSettingsScheme();schedulePersist();}));
    $('#settingsPercentOf1RM')?.addEventListener('input',e=>{progressionSetup.percentOf1RM=clampPct1RM(Number(e.target.value)||75);schedulePersist();});
    /* #321: Auto Deload toggle (default for new programs). Enabling with no
       valid N-weeks value seeds the conventional 4. */
    $('#settingsAutoDeloadToggle')?.addEventListener('click',()=>{progressionSetup.autoDeload=!progressionSetup.autoDeload;if(progressionSetup.autoDeload&&!(Number(progressionSetup.deloadEvery)>0))progressionSetup.deloadEvery=4;const toggle=$('#settingsAutoDeloadToggle');toggle.setAttribute('aria-pressed',String(!!progressionSetup.autoDeload));toggle.setAttribute('aria-label',`Auto Deload ${progressionSetup.autoDeload?'on':'off'}`);const panel=$('#settingsAutoDeloadPanel');if(panel)panel.hidden=!progressionSetup.autoDeload;const every=$('#settingsDeloadEvery');if(every)every.value=progressionSetup.deloadEvery;schedulePersist();});
    $('#settingsDeloadEvery')?.addEventListener('input',e=>{progressionSetup.deloadEvery=Math.max(1,Math.floor(Number(e.target.value)||4));schedulePersist();});
    $('#settingsDeloadPct')?.addEventListener('input',e=>{progressionSetup.deloadPct=clampDeloadPct(Number(e.target.value)||60);schedulePersist();});
    /* Settings → default periodization editor (user 2026-09-11). Mirrors the
       program week-range editor: 8-week cycle, edits progressionSetup.weeklyRanges
       (the default new programs inherit via cloneProgression). */
    /* #99 H5: normalize weeklyRanges OUTSIDE render — render functions must not
       mutate state. Call this before any render that reads weeklyRanges. */
    function ensureWeeklyRanges(target,length){
      if(!Array.isArray(target.weeklyRanges))target.weeklyRanges=[];
      while(target.weeklyRanges.length<length)target.weeklyRanges.push(target.weeklyRanges.length%3===0?'strength':target.weeklyRanges.length%3===1?'hypertrophy':'endurance');
      target.weeklyRanges=target.weeklyRanges.slice(0,length);
    }
    /* #99: single canonical week-range pill renderer — replaces the duplicated
       markup in renderSettingsWeekRanges and renderWeekRanges. */
    function weekRangePills(preset, pillAttr, index) {
      return Object.entries(REP_PRESETS).map(([key,value])=>{
        const short=value.amrap?'AMRAP':value.openTop?'15+':`${value.min}–${value.max}`;
        return `<button type="button" class="rep-preset" ${pillAttr}="${index}" data-preset="${key}" aria-pressed="${key===preset}">${short}</button>`;
      }).join('');
    }
    function weekRangeRow(preset, index, pillAttr) {
      return `<div class="week-range-row"><strong>Week ${index+1}</strong><div class="week-range-pills" role="group" aria-label="Week ${index+1} rep range">${weekRangePills(preset,pillAttr,index)}</div></div>`;
    }
    function renderSettingsWeekRanges(){
      const list=$('#settingsWeekRangeList');if(!list)return;
      ensureWeeklyRanges(progressionSetup,8);
      list.innerHTML=progressionSetup.weeklyRanges.map((preset,index)=>weekRangeRow(preset,index,'data-settings-week-pill')).join('');
      list.querySelectorAll('[data-settings-week-pill]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.settingsWeekPill);progressionSetup.weeklyRanges[index]=button.dataset.preset;list.querySelectorAll(`[data-settings-week-pill="${index}"]`).forEach(other=>other.setAttribute('aria-pressed',String(other===button)));schedulePersist();}));
    }
    function syncSettingsPeriodization(){
      const wrap=$('#settingsPeriodizationWrap');if(!wrap)return;
      wrap.hidden=!progressionSetup.undulating;
      if(progressionSetup.undulating)renderSettingsWeekRanges();
      else{const panel=$('#settingsUndulatingPanel');if(panel)panel.hidden=true;}
    }
    $('#editDefaultPeriodization')?.addEventListener('click',()=>{const panel=$('#settingsUndulatingPanel');if(!panel)return;panel.hidden=!panel.hidden;if(!panel.hidden)renderSettingsWeekRanges();});
    $('#settingsUndulatingToggle').addEventListener('click',()=>{progressionSetup.undulating=!progressionSetup.undulating;const toggle=$('#settingsUndulatingToggle');toggle.setAttribute('aria-pressed',String(!!progressionSetup.undulating));toggle.setAttribute('aria-label',`Vary rep ranges by week ${progressionSetup.undulating?'on':'off'}`);syncSettingsPeriodization();schedulePersist();});
    $('#progressionInfoButton').addEventListener('click',()=>$('#progressionInfoDialog').showModal());
    $('#programProgressionInfoButton').addEventListener('click',()=>$('#progressionInfoDialog').showModal());
    $('#closeProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#doneProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#exportDataButton').addEventListener('click',()=>{downloadWorkoutBackup();showToast('Backup downloaded.');});
    $('#importCsvButton').addEventListener('click',()=>{if(typeof openCsvImport==='function')openCsvImport();});
    $('#deleteAllDataButton').addEventListener('click',()=>{$('#deleteAllDialog').showModal();});
    $('#cancelDeleteAll').addEventListener('click',()=>$('#deleteAllDialog').close());
    $('#keepDeleteAll').addEventListener('click',()=>$('#deleteAllDialog').close());
    $('#confirmDeleteAll').addEventListener('click',()=>{
      $('#deleteAllDialog').close();
      /* Shared wipe (efficiency pass 2026-09-12): in-memory first so the
         pagehide persist can't resurrect anything, then localStorage. */
      /* A3 (#99): tombstone every collection record BEFORE the wipe empties
         the arrays — the tombstones propagate on push, so an offline device
         pulls deletes instead of resurrecting the wiped data. */
      if(typeof tombstoneAllForSync==='function'){try{tombstoneAllForSync();}catch(_){}}
      wipeLocalUserData();
      /* Accounts: the emptied state must win over remote data — flag it dirty
         now (so a later pull can't resurrect it) and best-effort push the
         tombstone state before reloading. Signed-out behavior is unchanged. */
      if(typeof markSyncDirty==='function'){try{markSyncDirty();}catch(_){}}
      const doReloadAfterDelete=()=>location.reload();
      /* pushDeleteAllRemote pushes the tombstone-bearing state (not a raw row
         delete) so the delete propagates to every device. */
      const pushFn=typeof pushDeleteAllRemote==='function'?pushDeleteAllRemote:(typeof wipeRemoteData==='function'?wipeRemoteData:null);
      if(pushFn){
        let settled=false;
        const finish=()=>{if(!settled){settled=true;doReloadAfterDelete();}};
        setTimeout(finish,3000);
        try{pushFn().then(finish,finish);}catch(_){finish();}
      }else doReloadAfterDelete();
    });
    /* #99 B29: standalone-key migrations run before anything reads them. */
    if(typeof runLocalKeyMigrations==='function'){try{runLocalKeyMigrations();}catch(_){}}
    try{
      themeState.dark=(localStorage.getItem('workout-theme')||'light')==='dark';
      themeState.name=localStorage.getItem('workout-theme-name')||'cruciferous';
      if(!['cruciferous','rosepine','macchiato','mocha'].includes(themeState.name))themeState.name='cruciferous';
      if(DARK_FLAVORS.includes(themeState.name))themeState.darkFlavor=themeState.name;
      try{const savedLight=localStorage.getItem('workout-theme-light');if(LIGHT_THEMES.includes(savedLight))themeState.lightName=savedLight;}catch(_){}
    }catch(_){}
    applyTheme();applySwipeSets();
    $('#closeReplaceDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#keepCurrentDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#confirmReplaceDraft').addEventListener('click',()=>{const workout=pendingRepeatWorkout;pendingRepeatWorkout=null;$('#replaceDraftDialog').close();if(workout)repeatWorkout(workout,true);});
    /* Review dialog retired 2026-09-11 (user): finish now drops incomplete
       sets automatically — no dialog needed. */
    $('#dashboardNav').addEventListener('click', () => goTab(showDashboard));
    $('#workoutsNav').addEventListener('click', () => {
      // Re-tapping the active Workout tab collapses to the start screen
      // (#129 — the draft is autosaved, never disturbed). Otherwise switches tabs.
      if (state.activeView === 'workout') { collapseWorkoutToStart(); return; }
      goTab(showWorkouts);
    });
    /* Program tab (user 2026-09-12): always lands on the program home
       (cover), never the last sub-page seen. */
    $('#programNav').addEventListener('click', showProgramHome);
    $('#statsNav').addEventListener('click', () => goTab(showStats));
    /* The gear stays visible (active) on Settings — re-tapping it must not push
       a duplicate history entry, or the first Back tap just re-shows Settings
       (#27). Like the bottom tabs, re-tap scrolls to top instead. */
    $('#topBarSettings').addEventListener('click', () => {
      if (state.activeView === 'settings') { window.scrollTo({top:0, behavior:'auto'}); return; }
      goTab(showSettings);
    });
    $('#detailFavToggle')?.addEventListener('click', () => toggleFavorite(state.selected));
    /* #129 rework: starting a saved workout while a session is live asks first. */
    $('#closeStartSavedConflict')?.addEventListener('click',()=>{pendingConflictStart=null;$('#startSavedConflictDialog').close();});
    $('#backToLiveWorkout')?.addEventListener('click',()=>{pendingConflictStart=null;$('#startSavedConflictDialog').close();state.workoutEditorOpen=true;renderWorkoutScreen();window.scrollTo({top:0});});
    $('#switchToSavedWorkout')?.addEventListener('click',()=>{const fn=pendingConflictStart;pendingConflictStart=null;$('#startSavedConflictDialog').close();if(fn)fn();});
    $('#liveWorkoutChip')?.addEventListener('click', () => {
      if (!workoutState.draft) return;
      /* The pill disappears and its dot "pleasantly moves" next to the Workout
         header (user 2026-09-12): fly a dot clone from the chip to the title
         dot's resting spot, then fade the real title dot in. */
      const chip = $('#liveWorkoutChip');
      const startRect = chip?.querySelector('.live-dot')?.getBoundingClientRect();
      showWorkouts();
      state.workoutEditorOpen = true;
      renderWorkoutScreen(); window.scrollTo({top:0});
      const titleDot = $('#liveTitleDot');
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (startRect && titleDot && !titleDot.hidden && !reduceMotion) {
        const endRect = titleDot.getBoundingClientRect();
        const fly = document.createElement('span');
        fly.className = 'live-dot live-dot-fly';
        fly.style.left = startRect.left + 'px';
        fly.style.top = startRect.top + 'px';
        fly.style.width = startRect.width + 'px';
        fly.style.height = startRect.height + 'px';
        document.body.appendChild(fly);
        const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
        const dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);
        /* #184: the title dot's live-pulse CSS animation overrides inline
           opacity (animations beat inline styles in the cascade), so
           opacity='0' alone never hid it — two dots showed during the
           flight. Kill the animation too, restore both when the fly lands. */
        titleDot.style.animation='none';
        titleDot.style.opacity = '0';
        fly.animate([
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px)`, opacity: 1 }
        ], { duration: 420, easing: 'cubic-bezier(.25,.8,.3,1)' }).onfinish = () => {
          fly.remove();
          titleDot.style.animation='';
          titleDot.style.opacity = '';
        };
      }
    });
    /* Title-bar back is the repeatable pattern (user 2026-09-11): it backs
       out of every workout sub-screen. Backing out of the builder autosaves —
       the draft survives on the continue card; only Discard deletes it.
       Backing out of a program-workout edit returns to the program page. */
    $('#topBarBack').addEventListener('click', () => {
      if (state.activeView === 'detail') backFromExerciseDetail();
      else if (state.activeView === 'settings') backFromSettings();
      else if (state.activeView === 'program' && state.programWorkoutUid) { state.programWorkoutUid = null; renderProgram(); window.scrollTo({top:0}); }
      else if (state.activeView === 'program' && $('#createProgram')?.dataset.editing === 'true') requestCancelProgramEdit();
      /* Completed-workout detail (user 2026-09-12): the chevron is the one
         and only back affordance — route it through backFromWorkoutDetail()
         so it returns to the recorded destination (dashboard / program /
         history / …), not just the workout start screen. */
      /* Completed-log detail (user 2026-09-12): the detail is a pushed page,
         so the chevron pops exactly like system back — the two never disagree.
         Unpushed (the post-finish flash) keeps the in-app return. */
      else if (state.activeView === 'workout' && !$('#workoutComplete').hidden) {
        if (history.state?.sub === 'complete') history.back();
        else backFromWorkoutDetail();
      }
      /* Log list (user 2026-09-12): also a pushed page — chevron and swipe-back
         agree. Rare in-app arrivals with no list entry collapse in place. */
      else if (state.activeView === 'workout' && state.workoutHistoryOpen) {
        if (history.state?.sub === 'history') history.back();
        else hideWorkoutHistory();
      }
      else if (state.activeView === 'workout') { if (!collapseWorkoutSubScreen()) history.back(); }
      else history.back();
    });
    /* "+ Add saved workout" with a draft open: keep the draft, or delete it
       and start fresh (user 2026-09-11). */
    $('#closeBuilderDraftExists')?.addEventListener('click',()=>$('#builderDraftExistsDialog').close());
    $('#keepBuilderDraft')?.addEventListener('click',()=>$('#builderDraftExistsDialog').close());
    $('#deleteBuilderDraft')?.addEventListener('click',()=>{ const src=pendingBuilderSource; $('#builderDraftExistsDialog').close(); clearBuilderDraft(); openSavedBuilder(src); });
    /* Program setup form controls edit the form draft, never the global
       defaults (user 2026-09-10). */
    $('#progressionThreshold').addEventListener('input',e=>{programFormProgression().threshold=Number(e.target.value)||8;schedulePersist();});
    $('#progressionIncrementType').addEventListener('change',e=>{programFormProgression().incrementType=e.target.value;syncProgramIncrementUnit();schedulePersist();});
    $('#progressionIncrementValue').addEventListener('input',e=>{programFormProgression().incrementValue=Number(e.target.value)||5;schedulePersist();});
    /* %1RM + scheduled deloads (#54, v1.001). #321: the deload fields live in
       the Auto Deload panel now; enabling with no valid N-weeks seeds 4. */
    $('#progressionPercentOf1RM').addEventListener('input',e=>{programFormProgression().percentOf1RM=clampPct1RM(Number(e.target.value)||75);schedulePersist();});
    $('#autoDeloadToggle').addEventListener('click',()=>{const d=programFormProgression();d.autoDeload=!d.autoDeload;if(d.autoDeload&&!(Number(d.deloadEvery)>0))d.deloadEvery=4;syncProgramForm();schedulePersist();});
    $('#deloadEvery').addEventListener('input',e=>{const d=programFormProgression();d.deloadEvery=Math.max(1,Math.floor(Number(e.target.value)||4));schedulePersist();});
    $('#deloadPct').addEventListener('input',e=>{programFormProgression().deloadPct=clampDeloadPct(Number(e.target.value)||60);schedulePersist();});
    $('#programRepMin').addEventListener('input',e=>{const d=programFormProgression();d.defaultRange.min=Math.max(1,Number(e.target.value)||1);d.defaultRange.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    $('#programRepMax').addEventListener('input',e=>{const d=programFormProgression(),v=e.target.value.trim();d.defaultRange.max=v===''?null:Math.max(d.defaultRange.min,Number(v)||d.defaultRange.min);d.defaultRange.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset);schedulePersist();}));
    document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset,programFormProgression());schedulePersist();}));
    document.querySelectorAll('#programSchemePills [data-scheme]').forEach(button=>button.addEventListener('click',()=>{programFormProgression().scheme=button.dataset.scheme;syncProgramForm();schedulePersist();}));
    $('#undulatingToggle').addEventListener('click',()=>{const d=programFormProgression();d.undulating=!d.undulating;$('#undulatingToggle').setAttribute('aria-pressed',String(d.undulating));$('#undulatingToggle').setAttribute('aria-label',`Vary rep ranges by week ${d.undulating?'on':'off'}`);renderWeekRanges(d);schedulePersist();});
    $('#pctWaveToggle').addEventListener('click',()=>{const d=programFormProgression();d.pctWave=!d.pctWave;ensureWeeklyPcts(d,Number($('#programLength')?.value)||8);$('#pctWaveToggle').setAttribute('aria-pressed',String(d.pctWave));$('#pctWaveToggle').setAttribute('aria-label',`Vary percent of 1RM by week ${d.pctWave?'on':'off'}`);$('#pctWavePanel').hidden=!d.pctWave;renderWeekPcts(d);schedulePersist();});
    $('#programLength').addEventListener('input',()=>{renderWeekRanges();renderWeekPcts();});
    /* Per-exercise progression overrides are edited inside each program
       workout directly — no separate management screen (#45). */
    document.querySelectorAll('[data-treatment]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.treatment=button.dataset.treatment;document.querySelectorAll('[data-treatment]').forEach(row=>row.setAttribute('aria-pressed',String(row===button)));schedulePersist();}));
    $('#createProgram').addEventListener('click', createProgram);
    $('#startBlankWorkout').addEventListener('click', () => startBlankWorkout());
    $('#repeatLastWorkout').addEventListener('click',()=>repeatWorkout(workoutState.completed.slice().sort(sortByRecencyDesc)[0])); /* #99 A13: latest by completion */
    $('#addWorkoutExercise').addEventListener('click', () => {
      workoutState.pickerMode='draft';workoutState.programWorkoutTarget=null;
      $('#exercisePickerTitle').textContent='Add exercise';
      $('#exercisePickerTitle').nextElementSibling.textContent='Choose one or more movements for this workout.';
      $('#exercisePickerSearch').value = '';
      preparePickerFilters();
      resetPickerSession();
      /* #192: remember where the user was — closing the picker restores this
         position instead of snapping to the new card. */
      workoutState.pickerScrollY=window.scrollY;
      renderExercisePicker();
      $('#exercisePickerDialog').showModal();
      requestAnimationFrame(() => $('#exercisePickerSearch').focus());
    });
    // Bottom "Add exercise" button (#112) — same action as the top + button.
    $('#addWorkoutExerciseBottom')?.addEventListener('click', () => $('#addWorkoutExercise').click());
    /* #192 (user 2026-09-12): adding exercises must not move the viewport.
       The old #143 behavior scrolled to the newest card on close — the snap
       felt wrong. The new cards render expanded behind the dialog on every
       tap already, so on close we just restore the exact scroll position
       from when the picker opened (exercisePickerCloseScrollY). Runs in a
       frame so it wins over the dialog's focus-restore scroll. */
    const afterExercisePicker=()=>{if(workoutState.pickerMode==='template'){schedulePersist();if(typeof refreshTemplateViews==='function')refreshTemplateViews();}if(state.savedBuilder&&state.builderOpen&&typeof renderSavedBuilder==='function')renderSavedBuilder();
      if(workoutState.pickerMode!=='template'&&workoutState.draft&&typeof pickerSessionAdded!=='undefined'&&pickerSessionAdded.size){
        requestAnimationFrame(()=>{window.scrollTo({top:exercisePickerCloseScrollY(),behavior:'auto'});});
      }};
    $('#closeExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();afterExercisePicker();});
    $('#doneExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();afterExercisePicker();});
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
      /* #92 (user 2026-09-11): don't full re-render the exercise list here —
         the innerHTML teardown/rebuild flashes unpleasantly. Update the
         rep-range placeholders in place instead; the data is already correct
         and the next natural re-render picks up everything else. */
      updateFocusPlaceholders();
      renderWorkoutProgression(); syncWorkoutFocusPills(); markDraftSaved();
    }
    /* #92: surgically refresh the reps-input placeholders after a focus-pill
       change, without rebuilding the exercise cards. */
    function updateFocusPlaceholders(){
      const draft=workoutState.draft; if(!draft)return;
      draft.exercises.forEach(item=>{
        const card=document.querySelector(`[data-workout-exercise="${CSS.escape(item.uid)}"]`);
        if(!card)return;
        const p=item.progression||{};
        // Time-based exercises use seconds, never rep ranges (#110).
        if(p.mode==='time')return;
        /* #99 H4: reuse the canonical range text — no duplicated if/else chain. */
        const text=rangePlaceholder(p,false).text;
        if(!text)return;
        card.querySelectorAll('.reps-input').forEach(input=>{input.placeholder=text;});
      });
    }
    let pendingFocusKey=null;
    document.querySelectorAll('[data-workout-focus]').forEach(button=>button.addEventListener('click',()=>{
      if(!workoutState.draft)return;
      const key=button.dataset.workoutFocus;
      /* Tapping the selected pill clears the focus (user 2026-09-12) — the
         old "No focus" pill is gone; per-exercise ranges already applied stay
         as the exercises' own settings. */
      if(key===(workoutState.draft.focusPreset||'')){workoutState.draft.focusPreset=null;syncWorkoutFocusPills();markDraftSaved();return;}
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
    $('#closeDiscardDraft').addEventListener('click', () => {discardingBuilder=false;$('#discardDraftDialog').close();});
    $('#keepDraftButton').addEventListener('click', () => {discardingBuilder=false;$('#discardDraftDialog').close();});
    $('#confirmDiscardDraft').addEventListener('click', () => { $('#discardDraftDialog').close(); if(discardingBuilder){discardingBuilder=false;closeBuilderToReturn(true);} else doDiscardDraft(); });
    $('#finishWorkout').addEventListener('click', () => finishWorkout());
    /* Single review prompt on finish (2026-09-10, #43): unfilled values and
       unmarked sets are reviewed together — mark all complete, finish anyway
       (deleting the unfinished sets), or keep editing (#262). */
    $('#closeReviewSets').addEventListener('click',()=>$('#reviewSetsDialog').close());
    $('#reviewSetsCancel').addEventListener('click',()=>$('#reviewSetsDialog').close());
    $('#reviewSetsComplete').addEventListener('click',()=>{$('#reviewSetsDialog').close();const draft=workoutState.draft;if(draft){draft.exercises.forEach(item=>item.sets.forEach(set=>{set.complete=true;}));renderWorkoutExercises();markDraftSaved();}finishWorkout(true);});
    $('#reviewSetsDelete').addEventListener('click',()=>{
      $('#reviewSetsDialog').close();
      const draft=workoutState.draft;
      if(draft){
        /* #43: bulk delete removes only fully-empty sets (isEmptySet) and prunes exercises left with no sets — never sets with partial values. */
        let removed=0,removedEx=0;
        draft.exercises.forEach(item=>{const before=item.sets.length;item.sets=item.sets.filter(set=>!isEmptySet(set));removed+=before-item.sets.length;});
        const beforeEx=draft.exercises.length;draft.exercises=draft.exercises.filter(item=>item.sets.length);removedEx=beforeEx-draft.exercises.length;
        renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        if(removed||removedEx)showToast(`Deleted ${removed} empty set${removed===1?'':'s'}${removedEx?` and ${removedEx} empty exercise${removedEx===1?'':'s'}`:''}.`);
        /* #189: one modal, not two. If anything still has invalid values it
           genuinely needs the user's eyes — re-show the ONE review dialog.
           Otherwise everything left is value-valid: mark the sets complete
           and finish without a second prompt. */
        const outcome=reviewDeleteEmptiesOutcome(draft);
        if(outcome==='refinish'){finishWorkout();return;}
        if(outcome==='finish'){draft.exercises.forEach(item=>item.sets.forEach(set=>{set.complete=true;}));renderWorkoutExercises();markDraftSaved();}
      }
      finishWorkout(true);
    });
    /* #262 (user 2026-09-13): "Finish anyway" drops every unfinished set
       (empty AND incomplete) and finishes in one tap — the user's deliberate
       decision, recorded on the workout. Partial values are dropped, never
       saved half-filled (never-nulls, user 2026-09-11). The old middle
       "Delete unfinished sets" button ran this identical operation and is
       gone; two buttons only. One dialog only (#189): after the drop
       everything left is value-valid, so it finishes directly without
       re-prompting. */
    function reviewFinishAfterDrop(){
      $('#reviewSetsDialog').close();
      const draft=workoutState.draft;
      if(draft){
        const dropped=dropInvalidSets(draft);
        renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        const bits=[];
        if(dropped.droppedSets)bits.push(`${dropped.droppedSets} unfinished set${dropped.droppedSets===1?'':'s'}`);
        if(dropped.droppedExercises)bits.push(`${dropped.droppedExercises} empty exercise${dropped.droppedExercises===1?'':'s'}`);
        if(!draft.exercises.length)showToast('Finished — no sets were logged.');
        else if(bits.length)showToast(`Deleted ${bits.join(' and ')}.`);
      }
      finishWorkout(true,{finishedAnyway:true});
    }
    $('#reviewSetsFinishAnyway').addEventListener('click',reviewFinishAfterDrop);

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
    $('#libraryNav').addEventListener('click', () => goTab(showLibrary));
    window.addEventListener('popstate', e => {
      /* #265: backing out of a share preview clears the preview state first —
         otherwise the destination renders with a stale preview cached. */
      backOutOfSharePreview();
      const hash = decodeURIComponent(location.hash.slice(1)); const id = e.state?.exercise || hash;
      if (hash === 'dashboard' || e.state?.view === 'dashboard' || !hash) showDashboard(false);
      else if (hash === 'library' || e.state?.view === 'library') showLibrary(false);
      /* Coherent log history (user 2026-09-12): the log list and completed
         details are pushed pages — system back restores them instead of
         skipping to whatever came before the list. */
      else if (e.state?.view === 'workout' && e.state?.sub === 'history') {
        showWorkouts(false);
        state.workoutHistoryOpen = true;
        renderWorkoutScreen();
        setActiveNav('workout', null);
        window.scrollTo({top:0, behavior:'auto'});
      }
      else if (e.state?.view === 'workout' && e.state?.sub === 'complete' && e.state?.completedId) {
        const w = workoutState.completed.find(x => x.id === e.state.completedId);
        if (w) { state.workoutDetailReturn = returnRouteKey(e.state.returnTo)||ROUTES.DETAIL_RETURN.HISTORY; renderCompletedWorkout(w); }
        else showWorkouts(false);
      }
      else if (hash === 'workout' || e.state?.view === 'workout') showWorkouts(false);
      else if (hash === 'program' || e.state?.view === 'program') showProgram(false);
      else if (hash === 'stats' || e.state?.view === 'stats') showStats(false);
      else if (hash === 'settings' || e.state?.view === 'settings') showSettings(false);
      else if (id && exercises.some(x => x.id === id)) openExercise(id, false, e.state?.exReturn ?? undefined); else showDashboard(false);
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
    /* P0 hotfix 2026-09-11 (v0.99e): seed the built-in templates here, not in
       state.js — the factories (newExerciseItem etc.) only exist after every
       script has loaded, which is true by the time this init block runs. */
    workoutState.templates=cloneWorkoutTemplates();
    restorePersisted();
    /* #99 B15 regression (2026-09-12): the sync.js split dropped sync.js's
       trailing initSync() call, leaving every account control unwired and
       sync never starting. Boot must kick it. */
    if(window.Sync&&typeof Sync.initSync==='function'){try{Sync.initSync();}catch(_){}}
    /* Stats metric default (user 2026-09-11): the Volume|Sets toggles on the
       Stats page initialize to the saved Units → Stats default on every load. */
    state.topExercisesMode=state.muscleVolumeMode=(progressionSetup.statsDefaultMetric==='sets'?'sets':'volume');
/* Boot guarantee (user 2026-09-11 marathon): the swipe-sets class must
   reflect the restored setting even if the appearance-key restore above
   was skipped — otherwise the inline × stays visible on touch. */
applySwipeSets();
updateLiveWorkoutIndicator();
populateFilters(); renderLibrary(); renderDashboard();
/* User 2026-09-12 (perf): renderStats() ran at boot too, but showStats()
   re-renders every time the tab opens — the boot pass was pure waste
   (period aggregations + body-map hydration over all history). Deferred
   until first Stats visit. renderLibrary stays: showLibrary doesn't
   re-render, so the Exercises tab needs it pre-rendered. */
/* #296 (user 2026-09-12): detect a share route synchronously, BEFORE the
   initial tab render — a cold-opened share link must land directly on the
   share landing (loading state), never flash the home tab first while the
   payload decodes (hash links) or resolves over the network (short links). */
const bootShareAttempt=(()=>{
  try{
    if(/^#share=/.test(location.hash||''))return {type:'hash'};
    let slug=null;
    try{slug=typeof shortLinkAttemptFromPath==='function'?shortLinkAttemptFromPath(location.pathname):null;}catch(_){slug=null;}
    if(!slug){try{slug=typeof takeSpaRedirectSlug==='function'?takeSpaRedirectSlug():null;}catch(_){slug=null;}}
    if(slug)return {type:'short',slug};
  }catch(_){}
  return null;
})();
if(bootShareAttempt&&typeof openSharePreviewLoading==='function')openSharePreviewLoading();
/* #32: a share link (#share=...) renders the shared workout/program
   full-screen after boot, with Start / Add actions over it. Decode is
   async (v2 links are deflated); #296 renders the landing in a loading
   state first so the home tab never flashes underneath. */
parseShareHash().then(sharePayload=>{
  if(sharePayload)openSharePreview(sharePayload);
  /* P8/E1: a share-looking hash that doesn't decode gets a visible
     message instead of silently landing on Home. */
  else if(bootShareAttempt&&bootShareAttempt.type==='hash'){dismissSharePreview();showToast('That share link didn\u2019t open \u2014 it may be broken or from an older version of the app.');showDashboard(false);}
  else if(/^#share=/.test(location.hash||''))showToast('That share link didn\u2019t open \u2014 it may be broken or from an older version of the app.');
});
/* #177: server short links (/s/<slug>). Logged-in-only creation, public
   read; the payload is the same v2 string long links carry, so it decodes
   through shareDecodeAny and lands on the same share preview. Reached
   either directly (hosts serving index.html for the path) or via the
   404.html sessionStorage handoff on static hosts. Unknown slugs reuse the
   long-link invalid feedback. #177 follow-up: ANY /s/<segment> route --
   malformed, unknown, corrupt, or unavailable -- takes the invalid-link
   feedback path instead of silently opening Home. Best-effort: any failure
   boots normally. */
(function(){
  try{
    if(typeof shortLinkAttemptFromPath!=='function'||typeof resolveShortShareLink!=='function')return;
    const INVALID_LINK_MSG='That share link didn\u2019t open \u2014 it may be broken or from an older version of the app.';
    /* #296: the boot detection above already consumed the slug (the 404
       handoff is take-once), so reuse it instead of re-taking. */
    let attempt=bootShareAttempt&&bootShareAttempt.type==='short'?bootShareAttempt.slug:null;
    if(!attempt){
      try{attempt=shortLinkAttemptFromPath(location.pathname);}catch(_){attempt=null;}
      if(!attempt&&typeof takeSpaRedirectSlug==='function')attempt=takeSpaRedirectSlug();
    }
    if(!attempt)return; /* not a short-link route at all -- boot normally */
    /* #296: a failed cold-open share falls back to the home tab instead of
       stranding the user on the loading landing. */
    const shareFailed=()=>{if(bootShareAttempt&&bootShareAttempt.type==='short'){dismissSharePreview();showDashboard(false);}};
    if(typeof isValidShareSlug!=='function'||!isValidShareSlug(attempt)){shareFailed();showToast(INVALID_LINK_MSG);return;}
    resolveShortShareLink(attempt).then(payload=>{
      if(payload){openSharePreview(payload);/* #303: keep the /s/<slug> deep link in the address bar. */try{if(typeof restoreShortSharePath==='function')restoreShortSharePath(attempt);}catch(_){}}
      else{shareFailed();showToast(INVALID_LINK_MSG);}
    }).catch(()=>{shareFailed();showToast(INVALID_LINK_MSG);});
  }catch(_){/* short links are best-effort; boot continues */}
})();

/* Share links tapped while the app is already open (#214, user 2026-09-12):
   the landing is always the full page — the old modal variant is gone. A
   live draft stays intact underneath; dismissing the landing returns to it. */
window.addEventListener('hashchange',()=>{
  if(!/^#share=/.test(location.hash||''))return;
  parseShareHash().then(payload=>{
    /* #265: the hash navigation already pushed a history entry — opening the
       preview must not push a second one or Back takes two presses. */
    if(payload)openSharePreview(payload,{push:false});
    else showToast('That share link didn\u2019t open \u2014 it may be broken or from an older version of the app.');
  });
});
const initialId = decodeURIComponent(location.hash.slice(1));
/* #296: a cold-opened share link already rendered its loading landing above —
   don't paint a tab underneath it. */
if (bootShareAttempt) { /* share landing owns the boot */ }
else if (initialId === 'library') showLibrary(false); else if (initialId === 'workout') showWorkouts(false); else if (initialId === 'program') showProgram(false); else if (initialId === 'stats') showStats(false); else if (initialId === 'settings') showSettings(false); else if (initialId && exercises.some(x => x.id === initialId)) openExercise(initialId, false); else showDashboard(false);
  
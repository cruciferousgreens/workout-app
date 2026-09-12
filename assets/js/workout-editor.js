
/* ===== module: workout-editor.js ===== */
    /* Shared lookup (efficiency pass 2026-09-12): the live draft's exercise
       row by uid — one place instead of a dozen inline find() calls. */
    function findDraftExercise(uid){
      return workoutState.draft?.exercises.find(item=>item.uid===uid);
    }
    /** Manages the live workout draft, set completion, exercise notes, and mobile interactions. */
    let pendingRemoveExerciseUid=null;
    function doRemoveExercise(){
      const draft=workoutState.draft; if(!draft||!pendingRemoveExerciseUid)return;
      draft.exercises=draft.exercises.filter(item=>item.uid!==pendingRemoveExerciseUid);
      prepareDraftProgression(draft, workoutState.activeProgram?.id===draft.programId?workoutState.activeProgram.progression:freeformProgressionConfig());
      renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved();
      pendingRemoveExerciseUid=null;
    }
    $('#cancelRemoveExercise')?.addEventListener('click',()=>$('#removeExerciseDialog').close());
    $('#keepExercise')?.addEventListener('click',()=>$('#removeExerciseDialog').close());
    $('#confirmRemoveExercise')?.addEventListener('click',()=>{ $('#removeExerciseDialog').close(); doRemoveExercise(); });
    function openReorderDialog(){
      /* Reuses the shared exercise-list context (user 2026-09-12): the saved-
         workout builder gets reordering through this same dialog. */
      const list=contextExercises(); if(!list||list.length<2)return;
      renderReorderList();
      $('#reorderExercisesDialog').showModal();
    }
    function renderReorderList(){
      const list=contextExercises(); if(!list)return;
      const listEl=$('#reorderExercisesList'); if(!listEl)return;
      listEl.innerHTML=list.map((item,idx)=>{
        const ex=exercises.find(x=>x.id===item.exerciseId);
        const name=ex?ex.name:'Exercise';
        const grouped=item.supersetId&&list.filter(x=>x.supersetId===item.supersetId).length>1;
        const groupNum=grouped?supersetGroupNumber(list,item.supersetId):0;
        return `<div class="reorder-row" data-reorder-uid="${escapeHtml(item.uid)}">
          <span class="reorder-name">${escapeHtml(name)}${grouped?`<span class="reorder-superset-tag">Superset ${groupNum}</span>`:''}</span>
          <span class="reorder-arrows">
            <button class="reorder-arrow" type="button" data-move="up" data-uid="${escapeHtml(item.uid)}" ${idx===0?'disabled':''} aria-label="Move ${escapeHtml(name)} up"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg></button>
            <button class="reorder-arrow" type="button" data-move="down" data-uid="${escapeHtml(item.uid)}" ${idx===list.length-1?'disabled':''} aria-label="Move ${escapeHtml(name)} down"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          </span>
        </div>`;
      }).join('');
      listEl.querySelectorAll('.reorder-arrow').forEach(btn=>btn.addEventListener('click',()=>{
        const list2=contextExercises(); if(!list2)return;
        const i=list2.findIndex(x=>x.uid===btn.dataset.uid); if(i<0)return;
        const j=btn.dataset.move==='up'?i-1:i+1;
        if(j<0||j>=list2.length)return;
        const [moved]=list2.splice(i,1);
        list2.splice(j,0,moved);
        contextSaved();
        renderReorderList();
      }));
    }
    $('#reorderWorkoutExercises')?.addEventListener('click',openReorderDialog);
    $('#cancelReorderExercises')?.addEventListener('click',()=>$('#reorderExercisesDialog').close());
    $('#doneReorderExercises')?.addEventListener('click',()=>{ $('#reorderExercisesDialog').close(); contextRerender(); });
    /* #18: workout history view wiring. */
    $('#historySearch')?.addEventListener('input',()=>renderWorkoutHistoryList());
    function newSet() { return {uid:newSetId(), w:'', r:'', seconds:'', rpe:'', targetRpe:'', tags:[], complete:false}; }
    /* #99 H3: ONE factory owns the exercise-item shape. Every construction site
       (picker, templates, programs, history-edit) must build items through here
       so uids and fields never drift again. `sets` are passed in; use newSet()
       (or Object.assign(newSet(), overrides)) for those. */
    function newExerciseItem(opts={}) {
      return {
        uid: newExerciseUid(),
        exerciseId: opts.exerciseId,
        tracking: opts.tracking || 'reps',
        note: opts.note || '',
        noteOpen: !!opts.noteOpen,
        exerciseTags: [...(opts.exerciseTags || [])],
        supersetId: opts.supersetId || null,
        progression: opts.progression ? {...opts.progression} : null,
        sets: opts.sets || []
      };
    }
    function lastUsedWeight(exerciseId) {
      const logs = getExerciseLogs(exerciseId).slice().sort(sortByRecencyDesc); /* #99 A13: completedAt first, isoDate fallback */
      for (const log of logs) {
        const weighted = log.sets.filter(set => Number(set.w) > 0);
        if (weighted.length) return String(weighted[weighted.length - 1].w);
      }
      return '';
    }
    function lastSessionSetSummary(exerciseId) {
      const logs=getExerciseLogs(exerciseId).sort(sortByRecencyDesc); /* #99 A13: completedAt first, isoDate fallback */
      const latest=logs[0]; if(!latest?.sets?.length)return '';
      const set=latest.sets.slice().sort((a,b)=>estimate1RM(b)-estimate1RM(a))[0];
      const timed=latest.tracking==='time'||set.seconds!=null;
      const load=Number(set.w)>0?`${displayWeight(set.w)} ${weightUnit()}${timed?' · ':' × '}`:'';
      const performance=timed?(set.seconds!=null?`${set.seconds} sec`:''):(set.r!=null?`${set.r} reps`:'');
      return `Last: ${load}${performance||'—'}${set.rpe==null?'':` @ RPE ${set.rpe}`} · ${formatLogDate(latest.isoDate)}`;
    }
    /* v0.99al: latest top set's performance, for hold-case ghost defaults. When
       the progression engine holds (completed history exists but no suggestion
       fired), set rows ghost the latest top set (e.g. 6 reps) instead of the
       range minimum (1) — so 100 lb × 6 doesn't read as 100 × 1. Returns ''
       when there is no history, the top set logged no performance, or the
       exercise is AMRAP (reps stay explicit: completing an untouched AMRAP set
       must not auto-save a value). */
    function latestTopSetPerf(exerciseId, tracking, isAmrap) {
      if (isAmrap) return '';
      const logs = getExerciseLogs(exerciseId).slice().sort(sortByRecencyDesc); /* #99 A13: completedAt first, isoDate fallback */
      const latest = logs[0];
      if (!latest?.sets?.length) return '';
      const top = latest.sets.slice().sort((a,b) => estimate1RM(b) - estimate1RM(a))[0];
      const v = tracking === 'time' ? top.seconds : top.r;
      return v == null || v === '' ? '' : String(v);
    }
    function livePRLabel(item,set) {
      if(!item||!set||exerciseTracking(item,exercises.find(ex=>ex.id===item.exerciseId))!=='reps'||Number(set.w)<=0)return '';
      const prior=getExerciseLogs(item.exerciseId).flatMap(log=>log.sets).filter(row=>Number(row.w)>0);
      if(!prior.length)return '';
      const ex=exercises.find(row=>row.id===item.exerciseId);
      const kind=detectExercisePRs([set],prior);
      if(kind==='e1rm')return `${ex?.name||'Exercise'} · new estimated 1RM PR`;
      if(kind==='heaviest')return `${ex?.name||'Exercise'} · new heaviest set PR`;
      return '';
    }

    /* #99 B12: showToast lives in utilities.js now (one shared toast service).
       Toasts pop up and fade away (user 2026-09-10) — never a static banner. */

    /* markDraftSaved = persist only (user 2026-09-12): the visible autosave
       note was deleted, so there's no status element to update anymore. */
    function markDraftSaved() {
      schedulePersist();
    }

    function startBlankWorkout(name = '', programId = null, programWorkoutUid = null) {
      /* #95 (user 2026-09-11): new workouts default to the Settings Default
         Focus, so the matching pill renders highlighted from the start. */
      const defaultFocus = progressionSetup.defaultRange?.preset || null;
      /* #99 H5: a live draft wins over the history sub-pane (was done in render). */
      state.workoutHistoryOpen=false;
      workoutState.draft = {name, date:localIsoDate(), exercises:[], programId, programWorkoutUid, editingId:null, focusPreset:defaultFocus};
      $('#workoutComplete').hidden = true;
      state.workoutEditorOpen = true; /* #129: fresh session opens the editor directly. */
      renderWorkoutScreen();
    }

    /* Program-name chip (user 2026-09-12): a completed workout that belonged
       to a program shows the program name next to the workout name, like the
       Built-in chip. Looks in the active program first, then archived ones. */
    /* Shared lookup (efficiency pass 2026-09-12): a program by id, active
       first then archived — one place instead of inline copies. */
    function findProgramById(id){
      if(!id)return null;
      return (workoutState.activeProgram?.id===id?workoutState.activeProgram:null)
        ||(workoutState.archivedPrograms||[]).find(p=>p.id===id)
        ||null;
    }
    function programNameChip(workout){
      if(!workout?.programId)return '';
      const program=findProgramById(workout.programId);
      return program?` <span class="built-in-label">${escapeHtml(program.name)}</span>`:'';
    }
    /* #99: single canonical recent-workout row — replaces three duplicated
       button markups (dashboard recent, workout-tab recent, history list). */
    function recentWorkoutButton(workout, dataAttr, smallText) {
      const summary = smallText || (()=>{const s=workoutSummary(workout);return `${formatLogDate(workout.date)} · ${s.sets} sets · ${formatVolume(s.volume)}`;})();
      return `<button class="recent-workout" type="button" ${dataAttr}="${escapeHtml(workout.id)}"><span><strong>${escapeHtml(workout.name)}${programNameChip(workout)}</strong><small>${escapeHtml(summary)}</small></span><span aria-hidden="true">›</span></button>`;
    }
    function renderWorkoutRecent() {
      const host=$('#workoutRecent'); if(!host)return;
      const sorted=workoutState.completed.slice().sort(sortByRecencyDesc); /* #99 A13: latest by completion */
      const recent=sorted.slice(0,6);
      host.innerHTML=recent.length?recent.map(workout=>recentWorkoutButton(workout,'data-training-workout')).join('')+(sorted.length>6?`<button class="view-all-history" type="button" id="viewAllWorkouts">View all ${sorted.length} workouts ›</button>`:''):'<p class="section-note">Your completed workouts will appear here.</p>';
      document.querySelectorAll('[data-training-workout]').forEach(button=>button.addEventListener('click',()=>{state.workoutDetailReturn=ROUTES.DETAIL_RETURN.WORKOUT;renderCompletedWorkout(workoutState.completed.find(workout=>workout.id===button.dataset.trainingWorkout),{push:true});}));
      $('#viewAllWorkouts')?.addEventListener('click',showWorkoutHistory);
    }
    /* #18: full workout history with search + month grouping. */
    function showWorkoutHistory(){
      state.workoutHistoryOpen=true;
      const s=$('#historySearch'); if(s)s.value='';
      renderWorkoutScreen();
      /* Logs are their own page (user 2026-09-12): no tab highlight on the
         list. Coherent history: the list is a pushed page, so system back
         returns here instead of skipping to the pre-list screen. */
      setActiveNav('workout', null);
      window.scrollTo({top:0,behavior:'auto'});
      history.pushState({view:'workout', sub:'history'}, '', '#workout');
    }
    function hideWorkoutHistory(){
      state.workoutHistoryOpen=false;
      renderWorkoutScreen();
      window.scrollTo({top:0,behavior:'auto'});
    }
    /* #128 (user 2026-09-12): workout logs get the same period pills as
       Home/Stats (Today / Week / Month / Year / All time) and the same flat
       card layout as Home's Recent workouts — no month grouping. Search
       covers workout names and exercise names. */
    function exerciseNamesForSearch(workout){
      return (workout.exercises||[]).map(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        return ex?ex.name:'';
      });
    }
    function renderWorkoutHistoryList(){
      const host=$('#workoutHistoryList'); if(!host)return;
      /* Period pills (shared periodTabs helper, same look as Home/Stats). */
      const tabsHost=$('#logPeriodTabs');
      if(tabsHost){
        tabsHost.innerHTML=periodTabs('data-log-period',state.logPeriod||'all');
        tabsHost.querySelectorAll('[data-log-period]').forEach(button=>button.addEventListener('click',()=>{
          if(state.logPeriod===button.dataset.logPeriod)return;
          state.logPeriod=button.dataset.logPeriod;schedulePersist();
          /* The list height changes with the period — pin the scroll so the
             page doesn't jump, same pattern as the dashboard period tabs. */
          const scrollY=window.scrollY;
          renderWorkoutHistoryList();
          requestAnimationFrame(()=>{if(window.scrollY!==scrollY)window.scrollTo(0,scrollY);});
        }));
      }
      const searchEl=$('#historySearch');
      const query=(searchEl&&searchEl.value||'').trim().toLowerCase();
      let list=workoutsForPeriod(state.logPeriod||'all').slice().sort(sortByRecencyDesc); /* #99 A13: latest by completion */
      if(query) list=list.filter(w=>(w.name||'').toLowerCase().includes(query)||exerciseNamesForSearch(w).some(name=>name.toLowerCase().includes(query)));
      const countNote=$('#historyCountNote');
      if(countNote)countNote.textContent=list.length===workoutState.completed.length
        ? `${list.length} completed session${list.length===1?'':'s'}`
        : `${list.length} of ${workoutState.completed.length} sessions`;
      if(!list.length){
        host.innerHTML=`<p class="section-note">${query?'No workouts match your search.':'No completed workouts in this period.'}</p>`;
        return;
      }
      /* Flat Home-style card: one card, hairline-divided rows, no groups. */
      host.innerHTML=`<div class="dashboard-card history-card"><div class="recent-workouts">${list.map(workout=>recentWorkoutButton(workout,'data-history-workout')).join('')}</div></div>`;
      host.querySelectorAll('[data-history-workout]').forEach(button=>button.addEventListener('click',()=>{state.workoutHistoryOpen=false;state.workoutDetailReturn=ROUTES.DETAIL_RETURN.HISTORY;renderCompletedWorkout(workoutState.completed.find(workout=>workout.id===button.dataset.historyWorkout),{push:true});}));
    }
    function renderWorkoutProgramSuggestion() {
      const host=$('#programStartSuggestion'),program=workoutState.activeProgram;
      if(!host)return;
      if(!program){
        host.innerHTML=`<div class="program-next-wrap"><button class="program-next-main" id="gotoProgramSetup" type="button"><span><span class="program-next-kicker">PROGRAM</span><strong>Next in program</strong><small>No active training block — set one up to train from it.</small></span><span class="program-next-arrow" aria-hidden="true">›</span></button></div>`;
        host.querySelector('#gotoProgramSetup').addEventListener('click',()=>showProgram());
        return;
      }
      const ready=(program.workouts||[]).filter(workout=>workout.template?.exercises?.length);
      const next=suggestedProgramWorkout(program),week=programWeek(program),range=programRangeForWeek(program,week);
      if(!next){host.innerHTML=`<div class="program-next-wrap"><div class="program-next-main"><span><span class="program-next-kicker">ACTIVE PROGRAM · ${escapeHtml(program.name)}</span><strong>Set up your first workout</strong><small>Week ${week} · ${escapeHtml(programRangeLabel(range))}</small></span><span class="program-next-arrow" aria-hidden="true">›</span></div></div>`;host.querySelector('.program-next-main').addEventListener('click',()=>showProgram());return;}
      host.innerHTML=`<div class="program-next-wrap"><button class="program-next-main" id="startSuggestedProgramWorkout" type="button"><span><span class="program-next-kicker">CONTINUE PROGRAM · ${escapeHtml(program.name)}</span><strong>Continue program · ${escapeHtml(next.name)}</strong><small>Week ${week} · ${next.template.exercises.length} exercise${next.template.exercises.length===1?'':'s'} · ${escapeHtml(programWorkoutRangeLabel(program,next,week))}</small></span><span class="program-next-arrow" aria-hidden="true">›</span></button>${ready.length>1?`<details class="program-next-flexibility"><summary>Choose a different program workout</summary><div class="program-next-alternatives">${ready.filter(workout=>workout.uid!==next.uid).map(workout=>`<button type="button" data-start-program-alternative="${escapeHtml(workout.uid)}">${escapeHtml(workout.name)}</button>`).join('')}</div></details>`:''}</div>`;
      $('#startSuggestedProgramWorkout').addEventListener('click',()=>startProgramWorkout(program,next));
      document.querySelectorAll('[data-start-program-alternative]').forEach(button=>button.addEventListener('click',()=>{const workout=ready.find(row=>row.uid===button.dataset.startProgramAlternative);if(workout)startProgramWorkout(program,workout);}));
    }
    /* #66: records a workout sub-screen transition. A new sub-screen is a
       genuinely new screen: its remembered scroll resets and the viewport
       moves to the top synchronously, before the browser can paint partway
       down. Re-renders within the same sub-screen return false and never
       touch the scroll. */
    function noteWorkoutSubScreen(sub) {
      if (state.workoutSubScreen === sub) return false;
      state.workoutSubScreen = sub;
      state.scroll['workout:' + sub] = 0;
      window.scrollTo({top: 0, behavior: 'auto'});
      return true;
    }
    function renderWorkoutScreen() {
      const hasDraft = !!workoutState.draft;
      /* #129: the live editor is a destination, not the default. A draft puts a
         Continue card on the start screen; the editor opens only when the user
         taps Continue or starts a fresh session (state.workoutEditorOpen). */
      const editorOpen = hasDraft && state.workoutEditorOpen;
      // Exactly one sub-pane is ever visible: the editor wins over everything, a
      // completed workout under review wins over the start screen, otherwise the
      // start screen shows.
      // #99 H5: no state mutation here — draft creators clear workoutHistoryOpen.
      if (hasDraft) { $('#workoutComplete').hidden = true; }
      const viewingComplete = !hasDraft && !$('#workoutComplete').hidden;
      const viewingHistory = !hasDraft && !viewingComplete && state.workoutHistoryOpen;
      /* Share preview (user 2026-09-12): a shared workout/program renders as
         its own full-screen page. The live editor still wins when open. */
      const viewingShare = !editorOpen && !!state.sharePreview;
      /* Saved-workout editor page (user 2026-09-12): a saved workout opens its
         own editor, never a live session. The live editor still wins when open. */
      const viewingSaved = !editorOpen && !viewingShare && !!state.savedWorkoutId;
      /* Saved-workout builder (user 2026-09-11): its own page, like the saved
         editor. The live editor still wins when open. */
      const viewingBuilder = !editorOpen && !!state.savedBuilder && state.builderOpen;
      const showingStart = !editorOpen && !viewingComplete && !viewingHistory && !viewingSaved && !viewingBuilder && !viewingShare;
      noteWorkoutSubScreen(editorOpen ? 'editor' : (viewingShare ? 'share' : (viewingBuilder ? 'builder' : (viewingComplete ? 'complete' : (viewingHistory ? 'history' : (viewingSaved ? 'saved' : 'start'))))));
      /* Title-bar back follows the sub-screen (user 2026-09-11): keep the
         top bar in sync whenever the workout sub-screen changes. */
      if (state.activeView === 'workout') updateTopBar('workout');
      $('#workoutStart').hidden = !showingStart;
      $('#workoutEditor').hidden = !editorOpen;
      $('#workoutHistory').hidden = !viewingHistory;
      $('#savedWorkout').hidden = !viewingSaved;
      $('#savedBuilder').hidden = !viewingBuilder;
      $('#sharePreview').hidden = !viewingShare;
      const lede = $('#workoutLede');
      if (lede) lede.textContent = editorOpen ? 'Workout in progress — log your sets below.'
        : viewingComplete ? 'Reviewing a completed session.'
        : viewingHistory ? 'Browse all completed sessions.'
        : viewingShare ? 'Someone shared this with you — start it or save it.'
        : viewingSaved ? 'View or edit this saved workout.'
        : viewingBuilder ? 'Build a reusable saved workout.'
        : hasDraft ? 'A session is in progress — tap Continue to jump back in.'
        : 'Start a session or revisit your recent work.';
      updateLiveWorkoutIndicator();
      if (showingStart) {
        renderContinueWorkout();
        renderBuilderContinue();
        /* Phone QA 2026-09-12, revised user 2026-09-11: with a live session the
           start screen shows the Continue card AND the saved list (hidden hero
           only). The draft is discarded from inside the editor, never here. */
        $('#workoutStart')?.classList.toggle('draft-live', hasDraft);
        if (!hasDraft) {
          renderWorkoutProgramSuggestion();
          const latestReal=workoutState.completed.slice().sort(sortByRecencyDesc)[0]; /* #99 A13: latest by completion */
          if($('#repeatLastWorkout')){$('#repeatLastWorkout').disabled=!latestReal;$('#repeatLastWorkoutMeta').textContent=latestReal?`${latestReal.name} · ${formatLogDate(latestReal.date)}`:'Complete a workout to enable this.';}
        }
        renderWorkoutTemplateList();
      }
      if (viewingHistory) renderWorkoutHistoryList();
      if (viewingShare) renderSharePreview();
      if (viewingSaved) renderSavedWorkoutEditor();
      if (viewingBuilder) renderSavedBuilder();
      if (!editorOpen) return;
      $('#workoutName').value = workoutState.draft.name || '';
      $('#workoutDate').value = workoutState.draft.date;
      renderWorkoutDateDisplay();
      renderWorkoutExercises();
      renderWorkoutProgression();
      syncWorkoutFocusPills();
    }
    /* #129: Continue card — the autosaved in-progress workout ("draft" is
       internal-only language, never user-facing) leads the start screen with
       program + workout info. Tapping it opens the live editor. */
    function renderContinueWorkout() {
      const wrap = $('#continueWorkoutWrap');
      if (!wrap) return;
      const draft = workoutState.draft;
      if (!draft) { wrap.hidden = true; wrap.innerHTML = ''; return; }
      wrap.hidden = false;
      let programLine = '';
      if (draft.programId) {
        const program=findProgramById(draft.programId);
        const pw = program?.workouts?.find(w => w.uid === draft.programWorkoutUid);
        if (program) programLine = `<small class="continue-program">${escapeHtml(program.name)}${pw ? ` · ${escapeHtml(pw.name)}` : ''}</small>`;
      }
      const exCount = (draft.exercises || []).length;
      const totalSets = (draft.exercises || []).reduce((n, x) => n + (x.sets || []).length, 0);
      const doneSets = (draft.exercises || []).reduce((n, x) => n + (x.sets || []).filter(s => s.complete).length, 0);
      wrap.innerHTML = `<button class="continue-workout-card" id="continueWorkoutCard" type="button" aria-label="Continue ${escapeHtml(draft.name || 'workout')}"><span><span class="continue-kicker">Workout in progress</span><strong>${escapeHtml(draft.name || 'Workout')}</strong>${programLine}<small>${exCount} exercise${exCount === 1 ? '' : 's'} · ${doneSets}/${totalSets} sets done</small></span><span class="continue-arrow" aria-hidden="true">›</span></button>`;
      $('#continueWorkoutCard').addEventListener('click', () => { state.workoutEditorOpen = true; renderWorkoutScreen(); });
    }

    /* Swipe-to-delete helpers (user 2026-09-11): iOS-Mail style — swipe left
       reveals a 72px red rail at the row's trailing end, tap the icon to
       delete; tapping anywhere else closes an open row. */
    let swipeOutsideCloserInstalled = false;
    function setSwipeOpen(item, open) {
      /* #85 (user 2026-09-11): the old single-open constraint is gone. Rail
         dismissal is owned by the document-level outside closer below
         (capture-phase pointerdown): touching or swiping another row closes
         the active rail, MacroFactor-style. This block used to force-close
         others here too, but it was redundant — the closer always runs before
         any swipe's finish() can open a rail. */
      item.classList.toggle('is-open', open);
      item.classList.remove('is-swiping'); /* #107: is-open owns the red now */
      const action = item.querySelector(':scope > .swipe-delete-action');
      if (action) action.tabIndex = open ? 0 : -1;
      /* #93 (user 2026-09-11): closing must also clear any leaked inline
         translateX from a pointermove whose finish() never ran (iOS can
         swallow pointerup or deliver it with a mismatched pointerId). The
         class toggle alone can't repair that — the rail would stay visibly
         open with no is-open class for the #86 close to find. */
      if (!open) {
        const content = item.querySelector(':scope > .swipe-content');
        if (content) { content.style.transition = ''; content.style.transform = ''; }
      }
    }
    function installSwipeOutsideCloser() {
      if (swipeOutsideCloserInstalled) return;
      swipeOutsideCloserInstalled = true;
      /* Without this, a revealed delete rail gets "stuck" open — tapping
         elsewhere must dismiss it, like iOS Mail. Capture phase so it runs
         before any row's own pointerdown handler. */
      document.addEventListener('pointerdown', event => {
        const inside = event.target && event.target.closest ? event.target.closest('.swipe-item.is-open') : null;
        document.querySelectorAll('.swipe-item.is-open').forEach(open => { if (open !== inside) setSwipeOpen(open, false); });
      }, true);
    }

    function attachSwipeDelete(scope = document) {
      installSwipeOutsideCloser();
      scope.querySelectorAll('.swipe-item').forEach(item => {
        const content = item.querySelector(':scope > .swipe-content');
        if (!content || content.dataset.swipeReady) return;
        content.dataset.swipeReady = 'true';
        /* Per-item scope: both the pointerdown and pointermove listeners below
           need this. (v0.90 fix: it used to be declared inside the pointerdown
           closure only, so the pointermove blur line threw a ReferenceError
           on every swipe start — every swipe since v0.86 died right there.) */
        const isSetSwipe = item.classList.contains('set-swipe');
        let startX = 0, startY = 0, deltaX = 0, tracking = false, horizontal = false, startedOpen = false, pointerId = null, suppressClick = false, interactiveStart = false, startedOnCheckbox = false;
        content.addEventListener('pointerdown', event => {
          suppressClick = false;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          /* Set-row swipe is touch-only and toggle-gated (user 2026-09-11):
             desktop keeps the × button, and the gesture never engages when the
             Settings toggle is off. */
          if (isSetSwipe && (typeof swipeDeleteSetsEnabled!=='function' || !swipeDeleteSetsEnabled())) return;
          /* user 2026-09-11: checked rows aren't swipeable (stopgap; #101
             tracks revisiting). Don't even start tracking the gesture. */
          if (isSetSwipe && content.classList.contains('is-complete')) return;
          /* No stopPropagation here: the document-level outside closer must see
             this tap, or open rows can never be dismissed by tapping away. */
          startX = event.clientX; startY = event.clientY; deltaX = 0; tracking = true; horizontal = false;
          /* user 2026-09-11: a gesture starting on the complete-set checkbox is
             always a tap, never a swipe. */
          startedOnCheckbox = isSetSwipe && !!event.target.closest('.complete-set');
          startedOpen = item.classList.contains('is-open'); pointerId = event.pointerId;
          /* Set rows are mostly text fields: the swipe may start anywhere on
             the row except the checkbox (see above). Tap vs swipe is decided
             at release by how far the finger actually traveled (see finish). */
          /* Program rows (user 2026-09-12): the row-open button covers the
             whole row, so every swipe started "on a button" and died here —
             the × was the only visible delete path. The open button IS the row
             body, so swipes may start on it (tap-vs-swipe is still decided at
             release); the × keeps the interactive exemption. */
          const rowBodyStart = !isSetSwipe && !!event.target.closest('.program-workout-open');
          interactiveStart = isSetSwipe
            ? false
            : (!rowBodyStart && !!event.target.closest('input, button, textarea, select, a, summary'));
          /* Deliberately NEVER calling setPointerCapture: iOS gives every touch
             implicit capture to its touch target, and these listeners sit on an
             ancestor so the events arrive regardless. An explicit
             setPointerCapture mid-gesture makes WebKit yank capture back ~1ms
             later and fire lostpointercapture, which cancels the drag. */
        });
        content.addEventListener('pointermove', event => {
          if (!tracking || event.pointerId !== pointerId || interactiveStart) return;
          /* #93 (user 2026-09-11): checked rows never visually slide — the
             rail can't even flash red during the drag. Gated only on
             is-complete (stable mid-gesture; toggled on click after the gesture
             ends), never on where the gesture started, so normal swiping from
             the checkbox still works. */
          if (isSetSwipe && content.classList.contains('is-complete')) return;
          const dx = event.clientX - startX, dy = event.clientY - startY;
          if (!horizontal && Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
          /* Vertical wins: hand the gesture back untouched so page scroll
             stays native and never fights the row. Not decided until the
             finger has moved ~12px — real swipes often arc a few px downward
             in their first samples and must not be killed for it. */
          if (!horizontal && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= 12) { tracking = false; return; }
          /* Swipe starting in a text field: dismiss the keyboard as the
             horizontal intent locks, so the row slides instead of fighting
             the focused input. */
          if (!horizontal && isSetSwipe && document.activeElement && document.activeElement.blur) document.activeElement.blur();
          horizontal = true;
          event.preventDefault();
          const base = startedOpen ? -72 : 0;
          deltaX = Math.max(-72, Math.min(0, base + dx));
          content.style.transition = 'none';
          content.style.transform = `translateX(${deltaX}px)`;
          /* #107: paint rail red only when genuinely swiped left (deltaX<0),
             added synchronously with transform so no first-frame flash. */
          item.classList.toggle('is-swiping', deltaX < 0);
        });
        const finish = event => {
          if (event.pointerId !== pointerId) return;
          tracking = false;
          /* Reset any live-drag transform when the rail isn't opening. A tap
             with finger drift applies translateX via pointermove; if we return
             without clearing it, the rail stays visibly open with no is-open
             class, and nothing (not the #86 close, not the bubble closer) can
             dismiss it. (user 2026-09-11, #93) */
          const resetDrag = () => { content.style.transition = ''; content.style.transform = ''; horizontal = false; pointerId = null; item.classList.remove('is-swiping'); };
          /* user 2026-09-11: two hard rules. (1) A gesture starting on the
             checkbox is always a tap — never open the rail. (2) A completed
             set can't be swiped open. */
          if (startedOnCheckbox) { resetDrag(); return; }
          if (isSetSwipe && content.classList.contains('is-complete')) { resetDrag(); return; }
          /* Tap vs swipe is decided here, not at the 7px lock: only a
             deliberate drag (>= 24px of travel) counts as a swipe; anything
             smaller is a tap, so the click goes through untouched. */
          if (horizontal && Math.abs(deltaX - (startedOpen ? -72 : 0)) >= 24) {
            event.preventDefault();
            setSwipeOpen(item, deltaX < -36);
            item.classList.remove('is-swiping'); /* #107: is-open now owns the red */
            suppressClick = true;
          } else {
            resetDrag();
          }
          horizontal = false; pointerId = null;
        };
        content.addEventListener('pointerup', finish);
        content.addEventListener('pointercancel', finish);
        /* No lostpointercapture listener: with no explicit capture there is
           nothing to lose mid-gesture (implicit touch capture releases after
           pointerup, when pointerId is already null). Binding finish() to it
           was the bug — WebKit fires it ~1ms after an explicit
           setPointerCapture and it canceled every swipe mid-gesture. */
        content.addEventListener('click', event => {
          if (!suppressClick) return;
          event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false;
        }, true);
        /* Tapping an open row itself (not the delete action, which is a
           sibling) dismisses the rail — iOS-Mail behavior. Runs at bubble so
           the tapped control (checkbox, field) still does its job first; the
           capture-phase suppressor above already swallowed post-swipe taps. */
        content.addEventListener('click', () => {
          if (!suppressClick && item.classList.contains('is-open')) setSwipeOpen(item, false);
        });
      });
    }


    /* #99 B5: renderWorkoutExercises decomposed by pure code motion. HTML
       building moved verbatim into liveExerciseCardHtml; the draft-uid
       backfill into backfillDraftUids; each listener group verbatim into a
       wireLive* helper; deleteWorkoutSet hoisted to module scope (it was a
       nested declaration used once). renderWorkoutExercises only
       orchestrates the same steps in the same order. */
    function backfillDraftUids(draft){
      /* #99 H3: all constructors go through newExerciseItem()/newSet(), so fresh
         items always carry uids. This one-time migration backfills uids for
         drafts persisted before the factory existed (pre-v0.99d); it is a
         no-op for everything already built by the factory. */
      draft.exercises.forEach(item=>{
        if(!item.uid)item.uid=newExerciseUid();
        (item.sets||[]).forEach(set=>{if(!set.uid)set.uid=newSetId();});
      });
    }
    function liveExerciseCardHtml(item,draft){
        const ex = exercises.find(x => x.id === item.exerciseId); if (!ex) return '';
        const isBodyweight = ex.equipment === 'body only';
        const isDumbbell = ex.equipment === 'dumbbell';
        const tracking = exerciseTracking(item, ex);
        const lastWeight = lastUsedWeight(item.exerciseId);
        const target = item.suggestedTarget || {};
        const weightHint = target.w || lastWeight || '';
        const rp = rangePlaceholder(item.progression,tracking==='time');
        /* v0.99al: hold case — history exists but no suggestion fired, so ghost
           the latest top set instead of the range minimum (100×6, not 100×1).
           An explicit suggestion always wins; the range placeholder (and its
           minimum as the untouched-completion fallback) applies only when
           there is no completed history. AMRAP keeps explicit reps. The ghost
           placeholder and the untouched-completion fallback below stay in sync
           because both derive from these two values. */
        const holdPerf = (!target.r && !target.seconds) ? latestTopSetPerf(item.exerciseId, tracking, !!item.progression?.amrap) : '';
        const perfHint = tracking === 'time' ? (target.seconds || holdPerf || rp.text) : (target.r || holdPerf || rp.text);
        const perfFallback = tracking === 'time' ? (target.seconds || holdPerf || rp.value) : (target.r || holdPerf || rp.value);
        const lastSummary = lastSessionSetSummary(item.exerciseId);
        const grouped = item.supersetId && draft.exercises.filter(x => x.supersetId === item.supersetId).length > 1;
        const topWeight=Math.max(0,...item.sets.map(set=>Number(set.w)||0));
        /* #103 (user 2026-09-11): the N/M complete counter doesn't give the
           user anything — the checkboxes already show progress. Keep just
           the weight summary. */
        const cardSummary=`${topWeight?`${displayWeight(topWeight)} ${weightUnit()}`:''}`;
        return `<details class="exercise-accordion workout-exercise" data-workout-exercise="${escapeHtml(item.uid)}" ${item.cardOpen===false?'':'open'}>
            <!-- #12 corner-icon rule (user 2026-09-11): the info button lives in the card's top-right corner, matching the library star. -->
            <button class="exercise-info-button corner-icon" type="button" data-exercise-info="${escapeHtml(item.exerciseId)}" aria-label="About ${escapeHtml(ex.name)}">i</button>
            <summary class="exercise-accordion-head"><span class="exercise-accordion-chevron" aria-hidden="true">›</span><span class="exercise-accordion-title"><strong>${escapeHtml(ex.name)}</strong>${cardSummary?`<small>${escapeHtml(cardSummary)}</small>`:''}</span></summary>
            <div class="exercise-accordion-body">
            ${grouped ? `<div class="superset-band">Superset ${supersetGroupNumber(draft.exercises,item.supersetId)}</div>` : ''}
            ${lastSummary?`<p class="last-session-line"><strong>${escapeHtml(lastSummary)}</strong></p>`:''}
            <div class="log-labels"><span>SET</span><span>${isBodyweight ? 'ADDED' : 'WEIGHT'}</span><span>${tracking === 'time' ? 'SECONDS' : 'REPS'}</span><span>RPE</span><span></span></div>
            <div class="log-sets">${item.sets.map((set,index) => `
              <div class="swipe-item set-swipe" data-set-swipe="${escapeHtml(set.uid)}">
                <button class="swipe-delete-action delete-set-swipe" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-label="Delete set ${index + 1}" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg></button>
              <div class="log-set swipe-content ${set.complete ? 'is-complete' : ''}" data-set-uid="${escapeHtml(set.uid)}">
                <button class="log-set-number ${set.tags.length ? 'has-tags' : ''}" type="button" data-tag-exercise-uid="${escapeHtml(item.uid)}" data-tag-set-uid="${escapeHtml(set.uid)}" aria-label="Choose tags for set ${index + 1}" aria-haspopup="dialog">${index + 1}</button>
                <label class="weight-entry"><input class="log-input weight-input" data-field="w" data-placeholder-weight="${escapeHtml(weightHint)}" type="number" min="0" step="${isMetric()?'0.1':'0.5'}" inputmode="decimal" value="${escapeHtml(displayWeight(set.w))}" placeholder="${weightHint?escapeHtml(displayWeight(weightHint)):(isBodyweight?'Optional':'Weight')}" aria-label="Set ${index + 1} ${isBodyweight ? 'optional added weight' : isDumbbell ? 'total dumbbell weight' : 'weight'} in ${isMetric()?'kilograms':'pounds'}${weightHint ? (target.w ? `; suggested ${escapeHtml(displayWeight(weightHint))}` : `; last used ${escapeHtml(displayWeight(weightHint))}`) : ''}" /></label>
                <input class="log-input reps-input" data-field="${tracking === 'time' ? 'seconds' : 'r'}" data-placeholder-perf="${escapeHtml(perfFallback)}" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(tracking === 'time' ? (set.seconds ?? '') : (set.r ?? ''))}" placeholder="${tracking === 'time' ? (perfHint || 'Seconds') : (perfHint || 'Reps')}" aria-label="Set ${index + 1} ${tracking === 'time' ? 'seconds' : 'reps'}${perfHint ? `; target ${escapeHtml(perfHint)}` : ''}" />
                <input class="log-input rpe-input" data-field="rpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(set.rpe)}" placeholder="${set.targetRpe!==''&&set.targetRpe!=null?('Target '+escapeHtml(String(set.targetRpe))):'RPE'}" aria-label="Set ${index + 1} optional RPE${set.targetRpe!==''&&set.targetRpe!=null?`; target RPE ${escapeHtml(String(set.targetRpe))}`:''}" />
                <div class="set-actions">
                  <button class="complete-set" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-pressed="${set.complete}" aria-label="${set.complete ? 'Mark set incomplete' : 'Mark set complete'}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect class="box" x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5"/><path class="tick" d="m8 12.4 2.6 2.6 5.6-6.2"/></svg></button>
                  <button class="delete-set delete-set-inline" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-label="Delete set ${index + 1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
                </div>
                <div class="selected-set-tags" aria-label="Selected tags">${set.tags.map(tag => `<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>
              </div>
              </div>`).join('')}</div>
            <div class="set-utility-row"><button class="add-set" type="button" data-uid="${escapeHtml(item.uid)}">+ Add set</button>${draft.exercises.length > 1 ? `<button class="superset-button ${grouped ? 'active' : ''}" type="button" data-superset-uid="${escapeHtml(item.uid)}">${grouped ? 'Edit superset' : 'Create superset'}</button>` : ''}</div>
            <div class="exercise-note">${item.noteOpen || item.note ? `<textarea id="note-${escapeHtml(item.uid)}" data-exercise-note="${escapeHtml(item.uid)}" aria-label="Exercise notes" placeholder="Cues, setup, pain, or anything to remember">${escapeHtml(item.note || '')}</textarea>` : `<button class="add-note-toggle" type="button" data-add-note="${escapeHtml(item.uid)}">Add notes</button>`}</div>
            <details class="advanced-options" ${item.optionsOpen?'open':''}><summary>Exercise options</summary><div class="advanced-options-body"><div class="exercise-tools"><div class="tracking-segment" role="group" aria-label="Track reps or seconds"><button type="button" data-tracking-mode="reps" data-tracking-uid="${escapeHtml(item.uid)}" aria-pressed="${tracking==='time'?'false':'true'}">Reps</button><button type="button" data-tracking-mode="seconds" data-tracking-uid="${escapeHtml(item.uid)}" aria-pressed="${tracking==='time'?'true':'false'}">Seconds</button></div></div>${progressionSummaryForOptions(item)}<div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-draft-exercise-tags="${escapeHtml(item.uid)}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div><div class="options-apply-row"><button class="copy-first-set" type="button" data-copy-first-set="${escapeHtml(item.uid)}" ${item.sets.length<2?'disabled':''}>Apply set 1 to all</button><span class="inline-feedback" data-copy-feedback="${escapeHtml(item.uid)}" aria-live="polite"></span></div><div class="remove-exercise-separator"></div><button class="remove-workout-exercise text-danger-button" type="button" data-uid="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(ex.name)} from this workout">Remove exercise</button></div></details>
            </div>
          </details>`;
    }
    function deleteWorkoutSet(exerciseUid,setUid){
      const draft=workoutState.draft;if(!draft)return;
      const item=findDraftExercise(exerciseUid);if(!item)return;
      item.sets=item.sets.filter(set=>set.uid!==setUid);
      if(!item.sets.length){ /* Deleting the last set removes the exercise (user 2026-09-11). */ draft.exercises=draft.exercises.filter(row=>row.uid!==item.uid); }
      renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
    }
    function wireLiveRemoveExercise(){

      document.querySelectorAll('.remove-workout-exercise').forEach(button => button.addEventListener('click', () => {
        const draft=workoutState.draft;
        const item = draft?.exercises.find(row => row.uid === button.dataset.uid);
        const ex = item ? exercises.find(x => x.id === item.exerciseId) : null;
        pendingRemoveExerciseUid = button.dataset.uid;
        $('#removeExerciseDesc').textContent = ex ? `Remove "${ex.name}" from this workout? This cannot be undone.` : 'Remove this exercise from the workout? This cannot be undone.';
        $('#removeExerciseDialog').showModal();
      }));
    }
    function wireLiveAddSet(){
      document.querySelectorAll('.add-set').forEach(button => button.addEventListener('click', () => { findDraftExercise(button.dataset.uid)?.sets.push(newSet()); renderWorkoutExercises(); markDraftSaved(); }));
    }
    function wireLiveCopyFirstSet(){
      document.querySelectorAll('[data-copy-first-set]').forEach(button => button.addEventListener('click', () => {
        const item=findDraftExercise(button.dataset.copyFirstSet); if(!item||item.sets.length<2)return;
        const first=item.sets[0], fallback=lastUsedWeight(item.exerciseId);
        item.sets.slice(1).forEach(set=>{set.w=first.w!==''?first.w:fallback;set.r=first.r;set.seconds=first.seconds;set.rpe=first.rpe;set.targetRpe=first.targetRpe;});
        renderWorkoutExercises(); markDraftSaved();
        requestAnimationFrame(()=>{const feedback=document.querySelector(`[data-copy-feedback="${CSS.escape(item.uid)}"]`);if(feedback)feedback.textContent='Applied';});
      }));
    }
    function wireLiveDeleteSet(){
      document.querySelectorAll('.delete-set,.delete-set-swipe').forEach(button => button.addEventListener('click', () => deleteWorkoutSet(button.dataset.exerciseUid,button.dataset.setUid)));
    }
    function wireLiveSetInputs(){
      document.querySelectorAll('.log-input').forEach(input => input.addEventListener('input', () => { const row=input.closest('.log-set'); const exerciseUid = input.closest('.workout-exercise').dataset.workoutExercise; const setUid = row.dataset.setUid; const set = findDraftExercise(exerciseUid)?.sets.find(itemSet => itemSet.uid === setUid); if (set) { set[input.dataset.field] = input.dataset.field==='w' ? storageWeight(input.value) : input.value; } /* #161: editing a value no longer silently un-completes the set — the old flip shrank completed-set counts on every keystroke. The checkbox stays the one explicit complete/incomplete control. */ $('#workoutError').textContent = ''; markDraftSaved(); }));
    }
    function wireLiveCompleteSet(){
      document.querySelectorAll('.complete-set').forEach(button => button.addEventListener('click', () => {
        /* #93 (user 2026-09-11): a checkbox click means the user's intent was
           to toggle the set, not to swipe — so unconditionally clear any swipe
           state. The click is the most reliable event in iOS touch handling
           (it fires even when pointerup is swallowed), and setSwipeOpen(false)
           clears leaked inline transforms that the is-open class never tracked. */
        const swipeItem = button.closest('.swipe-item');
        if (swipeItem) setSwipeOpen(swipeItem, false);
        const set = findDraftSet(button.dataset.exerciseUid, button.dataset.setUid);
        const item=findDraftExercise(button.dataset.exerciseUid);
        const ex=exercises.find(row=>row.id===item?.exerciseId);
        const tracking=exerciseTracking(item,ex), weightOptional=ex?.equipment==='body only';
        if (!set) return;
        const setRow=button.closest('.log-set');
        const weightInput=setRow.querySelector('.weight-input');
        const perfInput=setRow.querySelector('.reps-input');
        const perfField=tracking==='time'?'seconds':'r';
        if (!set.complete && set.w === '' && weightInput?.dataset.placeholderWeight) {
          set.w=weightInput.dataset.placeholderWeight;
          /* A6/#156: the field renders in the user's display unit — show the
             converted value, not the canonical-lb value, or metric users see
             (and then edit) lbs. Input converts back via storageWeight(). */
          weightInput.value=displayWeight(set.w);
        }
        if (!set.complete && (set[perfField]==null||set[perfField]==='') && perfInput?.dataset.placeholderPerf) {
          set[perfField]=perfInput.dataset.placeholderPerf;
          perfInput.value=set[perfField];
        }
        const performanceValue=tracking==='time'?set.seconds:set.r;
        /* A10 (#99): NaN comparisons are false, so non-numeric input used to
           pass this gate as valid — require finite numbers explicitly. */
        if (!set.complete && ((!weightOptional && set.w === '') || performanceValue === '' || !Number.isFinite(Number(set.w||0)) || Number(set.w||0) < 0 || !Number.isFinite(Number(performanceValue)) || Number(performanceValue) < 1 || (set.rpe !== '' && (!Number.isFinite(Number(set.rpe)) || Number(set.rpe) < 1 || Number(set.rpe) > 10)))) {
          const perfWord = tracking==='time'?'seconds':'reps';
          showToast(weightOptional ? `Enter ${perfWord} to complete this set. Weight and RPE are optional.` : `Enter weight and ${perfWord} to complete this set. RPE is optional.`);
          setRow.querySelector((!weightOptional&&set.w==='')?'.weight-input':'.reps-input')?.focus(); return;
        }
        const pr=!set.complete?livePRLabel(item,set):'';
        set.complete = !set.complete; button.setAttribute('aria-pressed', String(set.complete)); button.setAttribute('aria-label', set.complete ? 'Mark set incomplete' : 'Mark set complete'); button.closest('.log-set').classList.toggle('is-complete', set.complete); $('#workoutError').textContent = ''; if(pr)showToast(`PR · ${pr}`,'pr-toast'); markDraftSaved();
      }));
    }
    function wireLiveAdvancedToggles(){
      document.querySelectorAll('.advanced-options').forEach(details => details.addEventListener('toggle', () => { const item=findDraftExercise(details.closest('.workout-exercise')?.dataset.workoutExercise); if(item)item.optionsOpen=details.open; }));
    }
    function wireLiveCardToggles(){
      document.querySelectorAll(".exercise-accordion").forEach(card => card.addEventListener('toggle', () => { const item=findDraftExercise(card.dataset.workoutExercise); if(item){item.cardOpen=card.open;markDraftSaved();} }));
    }
    function wireLiveCardExpandAnimation(){
      /* #88 (user 2026-09-11): tiny pleasant expand animation. When a card
         opens, the body grows from 0 to full height with a soft fade (220ms).
         Close stays native/instant — animating it would require intercepting
         the summary click and risk the toggle state. */
      document.querySelectorAll(".exercise-accordion").forEach(card => card.addEventListener('toggle', () => {
        if (!card.open) return;
        const body = card.querySelector(':scope > .exercise-accordion-body');
        if (!body || !body.animate) return;
        const height = body.scrollHeight;
        body.style.overflow = 'hidden';
        const anim = body.animate(
          [{ height: '0px', opacity: '0' }, { height: height + 'px', opacity: '1' }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
        );
        anim.onfinish = () => { body.style.height = ''; body.style.opacity = ''; body.style.overflow = ''; };
        anim.oncancel = () => { body.style.height = ''; body.style.opacity = ''; body.style.overflow = ''; };
      }));
    }
    function wireLiveSetTags(){
      document.querySelectorAll('[data-tag-set-uid]').forEach(button => button.addEventListener('click', () => openTagDialog(button.dataset.tagExerciseUid, button.dataset.tagSetUid)));
    }
    function wireLiveExerciseTags(){
      document.querySelectorAll('[data-draft-exercise-tags]').forEach(button => button.addEventListener('click', () => openExerciseTagDialog({mode:'draft',exerciseUid:button.dataset.draftExerciseTags})));
    }
    function wireLiveExerciseInfo(){
      document.querySelectorAll('[data-exercise-info]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openExercise(button.dataset.exerciseInfo); }));
    }
    function wireLiveAddNote(){
      document.querySelectorAll('[data-add-note]').forEach(button => button.addEventListener('click', () => { const item = findDraftExercise(button.dataset.addNote); if (!item) return; item.noteOpen = true; /* Surgical swap: replace the button with the textarea in place. A full renderWorkoutExercises() here destroys all DOM and causes scroll jumps; the in-place swap keeps layout stable. */ const ta = document.createElement('textarea'); ta.id = `note-${item.uid}`; ta.dataset.exerciseNote = item.uid; ta.setAttribute('aria-label', 'Exercise notes'); ta.placeholder = 'Cues, setup, pain, or anything to remember'; ta.value = item.note || ''; ta.addEventListener('input', () => { item.note = ta.value; markDraftSaved(); }); button.replaceWith(ta); ta.focus({preventScroll:true}); }));
    }
    function wireLiveNoteInputs(){
      document.querySelectorAll('[data-exercise-note]').forEach(input => input.addEventListener('input', () => { const item = findDraftExercise(input.dataset.exerciseNote); if (item) item.note = input.value; markDraftSaved(); }));
    }
    function wireLiveTracking(){
      document.querySelectorAll('[data-tracking-uid]').forEach(button => button.addEventListener('click', () => {
        const item = findDraftExercise(button.dataset.trackingUid); if (!item) return;
        /* One canonical switch (efficiency pass 2026-09-12): maps "seconds"
           to 'time', no-ops when already set (no scroll jump), keeps the
           progression mode in sync, never mutates entered values. */
        if(!setExerciseTracking(item, button.dataset.trackingMode||'reps', {resetCompletion:true}))return;
        renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved();
      }));
    }
    function wireLiveSuperset(){
      document.querySelectorAll('[data-superset-uid]').forEach(button => button.addEventListener('click', () => openSupersetDialog(button.dataset.supersetUid)));
    }
    function renderWorkoutExercises() {
      const draft = workoutState.draft;
      if (!draft) return;
      /* Reorder button only makes sense with 2+ exercises to reorder. */
      const reorderBtn = $('#reorderWorkoutExercises');
      if (reorderBtn) reorderBtn.style.display = draft.exercises.length >= 2 ? '' : 'none';
      /* Preserve scroll across re-renders (prevents tap-induced jumps). */
      const _scrollY=window.scrollY;
      backfillDraftUids(draft);
      $('#workoutExercises').innerHTML = draft.exercises.length ? draft.exercises.map(item => liveExerciseCardHtml(item, draft)).join('') : '<div class="history-empty">No exercises yet. Add your first movement to begin logging.</div>';
      wireLiveRemoveExercise();
      wireLiveAddSet();
      wireLiveCopyFirstSet();
      wireLiveDeleteSet();
      wireLiveSetInputs();
      wireLiveCompleteSet();
      wireLiveAdvancedToggles();
      wireLiveCardToggles();
      wireLiveCardExpandAnimation();
      wireLiveSetTags();
      wireLiveExerciseTags();
      wireLiveExerciseInfo();
      wireLiveAddNote();
      wireLiveNoteInputs();
      wireLiveTracking();
      wireLiveSuperset();
      attachSwipeDelete($('#workoutExercises'));
      window.scrollTo(0,_scrollY);
    }

    

/* ===== module: workout-editor.js ===== */
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
    /* #1: reorder exercises via modal popup (up/down arrows, no drag). */
    function openReorderDialog(){
      const draft=workoutState.draft; if(!draft||draft.exercises.length<2)return;
      renderReorderList();
      $('#reorderExercisesDialog').showModal();
    }
    /* #81: number superset groups (Superset 1, Superset 2, …) so multiple
       groups are visually distinct. Numbering follows order of first appearance. */
    function supersetGroupNumber(exercises,supersetId){
      const seen=[];
      for(const row of exercises){
        if(row.supersetId&&!seen.includes(row.supersetId))seen.push(row.supersetId);
      }
      return seen.indexOf(supersetId)+1;
    }
    function renderReorderList(){
      const draft=workoutState.draft; if(!draft)return;
      const list=$('#reorderExercisesList'); if(!list)return;
      list.innerHTML=draft.exercises.map((item,idx)=>{
        const ex=exercises.find(x=>x.id===item.exerciseId);
        const name=ex?ex.name:'Exercise';
        const grouped=item.supersetId&&draft.exercises.filter(x=>x.supersetId===item.supersetId).length>1;
        const groupNum=grouped?supersetGroupNumber(draft.exercises,item.supersetId):0;
        return `<div class="reorder-row" data-reorder-uid="${escapeHtml(item.uid)}">
          <span class="reorder-name">${escapeHtml(name)}${grouped?`<span class="reorder-superset-tag">Superset ${groupNum}</span>`:''}</span>
          <span class="reorder-arrows">
            <button class="reorder-arrow" type="button" data-move="up" data-uid="${escapeHtml(item.uid)}" ${idx===0?'disabled':''} aria-label="Move ${escapeHtml(name)} up"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg></button>
            <button class="reorder-arrow" type="button" data-move="down" data-uid="${escapeHtml(item.uid)}" ${idx===draft.exercises.length-1?'disabled':''} aria-label="Move ${escapeHtml(name)} down"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          </span>
        </div>`;
      }).join('');
      list.querySelectorAll('.reorder-arrow').forEach(btn=>btn.addEventListener('click',()=>{
        const draft2=workoutState.draft; if(!draft2)return;
        const i=draft2.exercises.findIndex(x=>x.uid===btn.dataset.uid); if(i<0)return;
        const j=btn.dataset.move==='up'?i-1:i+1;
        if(j<0||j>=draft2.exercises.length)return;
        const [moved]=draft2.exercises.splice(i,1);
        draft2.exercises.splice(j,0,moved);
        markDraftSaved();
        renderReorderList();
      }));
    }
    $('#reorderWorkoutExercises')?.addEventListener('click',openReorderDialog);
    $('#cancelReorderExercises')?.addEventListener('click',()=>$('#reorderExercisesDialog').close());
    $('#doneReorderExercises')?.addEventListener('click',()=>{ $('#reorderExercisesDialog').close(); renderWorkoutExercises(); renderWorkoutProgression(); });
    /* #18: workout history view wiring. */
    $('#backFromWorkoutHistory')?.addEventListener('click',hideWorkoutHistory);
    $('#historySearch')?.addEventListener('input',()=>renderWorkoutHistoryList());
    function newSet() { return {uid:uid('set'), w:'', r:'', seconds:'', rpe:'', tags:[], complete:false}; }
    function exerciseTracking(item, ex) { return item?.tracking || item?.progression?.mode || ex?.tracking || (ex?.force === 'static' ? 'time' : 'reps'); }
    function lastUsedWeight(exerciseId) {
      const logs = getExerciseLogs(exerciseId).slice().sort((a,b) => b.isoDate.localeCompare(a.isoDate));
      for (const log of logs) {
        const weighted = log.sets.filter(set => Number(set.w) > 0);
        if (weighted.length) return String(weighted[weighted.length - 1].w);
      }
      return '';
    }
    function lastSessionSetSummary(exerciseId) {
      const logs=getExerciseLogs(exerciseId).sort((a,b)=>b.isoDate.localeCompare(a.isoDate));
      const latest=logs[0]; if(!latest?.sets?.length)return '';
      const set=latest.sets.slice().sort((a,b)=>estimate1RM(b)-estimate1RM(a))[0];
      const timed=latest.tracking==='time'||set.seconds!=null;
      const load=Number(set.w)>0?`${displayWeight(set.w)} ${weightUnit()}${timed?' · ':' × '}`:'';
      const performance=timed?(set.seconds!=null?`${set.seconds} sec`:''):(set.r!=null?`${set.r} reps`:'');
      return `Last: ${load}${performance||'—'}${set.rpe==null?'':` @ RPE ${set.rpe}`} · ${formatLogDate(latest.isoDate)}`;
    }
    /* Rep/time-range placeholder for set inputs (2026-09-10): the placeholder
       shows the target range ("6–12", "6+", "AMRAP", "30–60 sec") while the
       value auto-saved when completing an untouched set is the range minimum —
       the conservative, honest default. AMRAP has no auto value: reps must be
       entered. A progression suggestion (target) takes precedence over both. */
    function rangePlaceholder(profile,time){
      profile=profile||{};
      if(time){
        const min=profile.timeMin,max=profile.timeMax;
        if(min&&max&&min!==max)return {text:`${min}–${max} sec`,value:String(min)};
        if(min)return {text:`${min} sec`,value:String(min)};
        return {text:'',value:''};
      }
      if(profile.amrap)return {text:profile.min>1?`AMRAP from ${profile.min}`:'AMRAP',value:''};
      const min=profile.min,max=profile.max;
      if(profile.openTop&&min)return {text:`${min}+`,value:String(min)};
      if(min&&max)return min===max?{text:String(min),value:String(min)}:{text:`${min}–${max}`,value:String(min)};
      if(min)return {text:String(min),value:String(min)};
      return {text:'',value:''};
    }

    function livePRLabel(item,set) {
      if(!item||!set||exerciseTracking(item,exercises.find(ex=>ex.id===item.exerciseId))!=='reps'||Number(set.w)<=0)return '';
      const prior=getExerciseLogs(item.exerciseId).flatMap(log=>log.sets).filter(row=>Number(row.w)>0);
      if(!prior.length)return '';
      const bestEstimate=Math.max(...prior.map(estimate1RM)),bestWeight=Math.max(...prior.map(row=>Number(row.w)||0));
      const ex=exercises.find(row=>row.id===item.exerciseId);
      if(estimate1RM(set)>bestEstimate+.5)return `${ex?.name||'Exercise'} · new estimated 1RM PR`;
      if(Number(set.w)>bestWeight)return `${ex?.name||'Exercise'} · new heaviest set PR`;
      return '';
    }

    let toastTimer, toastFadeTimer;
    /* Toasts pop up and fade away (user 2026-09-10) — never a static banner. */
    function showToast(message,kind='',durationMs=3600) {
      const toast=$('#appToast'); if(!toast)return;
      toast.textContent=message; toast.className=`app-toast ${kind}`.trim(); toast.hidden=false;
      clearTimeout(toastTimer); clearTimeout(toastFadeTimer);
      requestAnimationFrame(()=>requestAnimationFrame(()=>toast.classList.add('show')));
      toastTimer=setTimeout(()=>{
        toast.classList.remove('show');
        toastFadeTimer=setTimeout(()=>{ if(!toast.classList.contains('show'))toast.hidden=true; },300);
      },durationMs);
    }

    let saveStatusTimer;
    function markDraftSaved() {
      schedulePersist();
      const status = $('#draftStatus');
      if (!status) return;
      status.textContent = 'Saved just now';
      clearTimeout(saveStatusTimer);
      saveStatusTimer = setTimeout(() => { status.textContent = 'Changes are saved on this device'; }, 1800);
    }

    function startBlankWorkout(name = '', programId = null, programWorkoutUid = null) {
      workoutState.draft = {name, date:localIsoDate(), exercises:[], programId, programWorkoutUid, editingId:null};
      $('#workoutComplete').hidden = true;
      renderWorkoutScreen();
    }

    function renderWorkoutRecent() {
      const host=$('#workoutRecent'); if(!host)return;
      const sorted=workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date));
      const recent=sorted.slice(0,6);
      host.innerHTML=recent.length?recent.map(workout=>{const summary=workoutSummary(workout);return `<button class="recent-workout" type="button" data-training-workout="${escapeHtml(workout.id)}"><span><strong>${escapeHtml(workout.name)}${isSampleWorkout(workout)?'<span class="sample-label">Sample</span>':''}</strong><small>${escapeHtml(formatLogDate(workout.date))} · ${summary.sets} sets · ${formatVolume(summary.volume)}</small></span><span aria-hidden="true">›</span></button>`;}).join('')+(sorted.length>6?`<button class="view-all-history" type="button" id="viewAllWorkouts">View all ${sorted.length} workouts ›</button>`:''):'<p class="section-note">Your completed workouts will appear here.</p>';
      document.querySelectorAll('[data-training-workout]').forEach(button=>button.addEventListener('click',()=>{state.workoutDetailReturn='workout';renderCompletedWorkout(workoutState.completed.find(workout=>workout.id===button.dataset.trainingWorkout));}));
      $('#viewAllWorkouts')?.addEventListener('click',showWorkoutHistory);
    }
    /* #18: full workout history with search + month grouping. */
    function showWorkoutHistory(){
      state.workoutHistoryOpen=true;
      const s=$('#historySearch'); if(s)s.value='';
      renderWorkoutScreen();
      window.scrollTo({top:0,behavior:'auto'});
    }
    function hideWorkoutHistory(){
      state.workoutHistoryOpen=false;
      renderWorkoutScreen();
      window.scrollTo({top:0,behavior:'auto'});
    }
    function monthKey(dateStr){ return dateStr.slice(0,7); }
    function monthLabel(key){
      const parts=key.split('-'); const y=Number(parts[0]), m=Number(parts[1]);
      return new Date(y,m-1,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
    }
    function renderWorkoutHistoryList(){
      const host=$('#workoutHistoryList'); if(!host)return;
      const searchEl=$('#historySearch');
      const query=(searchEl&&searchEl.value||'').trim().toLowerCase();
      let list=workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date));
      if(query) list=list.filter(w=>(w.name||'').toLowerCase().includes(query));
      const countNote=$('#historyCountNote');
      if(countNote)countNote.textContent=list.length===workoutState.completed.length
        ? `${list.length} completed session${list.length===1?'':'s'}`
        : `${list.length} of ${workoutState.completed.length} sessions`;
      if(!list.length){
        host.innerHTML=`<p class="section-note">${query?'No workouts match your search.':'No completed workouts yet.'}</p>`;
        return;
      }
      const groups=new Map();
      list.forEach(w=>{const k=monthKey(w.date); if(!groups.has(k))groups.set(k,[]); groups.get(k).push(w);});
      let html='';
      groups.forEach((workouts,key)=>{
        html+=`<div class="history-month-group"><h3 class="history-month">${escapeHtml(monthLabel(key))}</h3>`;
        workouts.forEach(workout=>{const summary=workoutSummary(workout);
          html+=`<button class="recent-workout" type="button" data-history-workout="${escapeHtml(workout.id)}"><span><strong>${escapeHtml(workout.name)}${isSampleWorkout(workout)?'<span class="sample-label">Sample</span>':''}</strong><small>${escapeHtml(formatLogDate(workout.date))} · ${summary.sets} sets · ${formatVolume(summary.volume)}</small></span><span aria-hidden="true">›</span></button>`;});
        html+=`</div>`;
      });
      host.innerHTML=html;
      host.querySelectorAll('[data-history-workout]').forEach(button=>button.addEventListener('click',()=>{state.workoutDetailReturn='history';renderCompletedWorkout(workoutState.completed.find(workout=>workout.id===button.dataset.historyWorkout));}));
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
      // Exactly one sub-pane is ever visible: a live draft wins over everything, a completed
      // workout under review wins over the start screen, otherwise the start screen shows.
      if (hasDraft) { $('#workoutComplete').hidden = true; state.workoutHistoryOpen=false; }
      const viewingComplete = !hasDraft && !$('#workoutComplete').hidden;
      const viewingHistory = !hasDraft && !viewingComplete && state.workoutHistoryOpen;
      noteWorkoutSubScreen(hasDraft ? 'editor' : (viewingComplete ? 'complete' : (viewingHistory ? 'history' : 'start')));
      $('#workoutStart').hidden = hasDraft || viewingComplete || viewingHistory;
      $('#workoutEditor').hidden = !hasDraft;
      $('#workoutHistory').hidden = !viewingHistory;
      const lede = $('#workoutLede');
      if (lede) lede.textContent = hasDraft ? 'Workout in progress — log your sets below.'
        : viewingComplete ? 'Reviewing a completed session.'
        : viewingHistory ? 'Browse all completed sessions.'
        : 'Start a session or revisit your recent work.';
      updateLiveWorkoutIndicator();
      renderWorkoutProgramSuggestion();
      renderWorkoutTemplateList();
      const latestReal=workoutState.completed.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
      if($('#repeatLastWorkout')){$('#repeatLastWorkout').disabled=!latestReal;$('#repeatLastWorkoutMeta').textContent=latestReal?`${latestReal.name} · ${formatLogDate(latestReal.date)}`:'Complete a workout to enable this.';}
      renderWorkoutRecent();
      if (viewingHistory) renderWorkoutHistoryList();
      if (!hasDraft) return;
      $('#workoutName').value = workoutState.draft.name || '';
      $('#workoutDate').value = workoutState.draft.date;
      renderWorkoutDateDisplay();
      renderWorkoutExercises();
      renderWorkoutProgression();
      syncWorkoutFocusPills();
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
      const action = item.querySelector(':scope > .swipe-delete-action');
      if (action) action.tabIndex = open ? 0 : -1;
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
        let startX = 0, startY = 0, deltaX = 0, tracking = false, horizontal = false, startedOpen = false, pointerId = null, suppressClick = false, interactiveStart = false;
        content.addEventListener('pointerdown', event => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          /* Set-row swipe is touch-only and toggle-gated (user 2026-09-11):
             desktop keeps the × button, and the gesture never engages when the
             Settings toggle is off. */
          if (isSetSwipe && (typeof swipeDeleteSetsEnabled!=='function' || !swipeDeleteSetsEnabled())) return;
          /* No stopPropagation here: the document-level outside closer must see
             this tap, or open rows can never be dismissed by tapping away. */
          startX = event.clientX; startY = event.clientY; deltaX = 0; tracking = true; horizontal = false; suppressClick = false;
          startedOpen = item.classList.contains('is-open'); pointerId = event.pointerId;
          /* Set rows are mostly text fields: the swipe may start anywhere on
             the row, including the checkbox and set-number (v0.91: the
             v0.89 exclusion that made those two tap-only turned out to be
             the blocker — the row is densely packed with no bare background,
             so those are the two most natural places to grab, and a
             deliberate swipe starting on either visibly did nothing.
             user 2026-09-11 explicitly asked for swipe-from-checkbox).
             Tap vs swipe is decided at release by how far the finger actually
             traveled (see finish): a tap without movement still clicks
             through, so the checkbox just checks, the set-number still opens
             its tag dialog, and a field just focuses. */
          interactiveStart = isSetSwipe
            ? false
            : !!event.target.closest('input, button, textarea, select, a, summary');
          /* Deliberately NEVER calling setPointerCapture: iOS gives every touch
             implicit capture to its touch target, and these listeners sit on an
             ancestor so the events arrive regardless. An explicit
             setPointerCapture mid-gesture makes WebKit yank capture back ~1ms
             later and fire lostpointercapture, which cancels the drag one event
             after the horizontal lock — every swipe died and taps randomly
             opened the rail (user 2026-09-11). No version of explicit
             capture survives that on a scrollable page. */
        });
        content.addEventListener('pointermove', event => {
          if (!tracking || event.pointerId !== pointerId || interactiveStart) return;
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
        });
        const finish = event => {
          if (event.pointerId !== pointerId) return;
          tracking = false;
          content.style.transition = '';
          content.style.transform = '';
          /* Tap vs swipe is decided here, not at the 7px lock: a tap with
             finger jitter can cross the lock threshold, and treating it as a
             swipe both pops the rail open by accident and gets an open rail
             stuck (the dismissing tap re-locks as a micro-swipe and its click
             gets swallowed — user 2026-09-11). Only a deliberate drag
             (>= 24px of travel) counts as a swipe; anything smaller is a tap,
             so the click goes through untouched — the checkbox just checks,
             a field just focuses, and a tap on an open row dismisses it via
             the bubble closer below. */
          if (horizontal && Math.abs(deltaX - (startedOpen ? -72 : 0)) >= 24) {
            event.preventDefault();
            setSwipeOpen(item, deltaX < -36);
            suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
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

    function progressionSummaryForOptions(item) {
      // user 2026-09-11: show the exercise's progression setup under Exercise
      // options so the suggestion basis is visible during the workout.
      const prof = item.progression || {};
      const scheme = prof.scheme || 'rpe';
      const schemeLabel = scheme === 'onerm' ? '%1RM' : scheme === 'linear' ? 'Linear' : 'RPE-based';
      let target;
      if (prof.mode === 'time' || item.tracking === 'seconds') {
        target = `${prof.timeMin || 30}–${prof.timeMax || 60} sec`;
      } else if (prof.amrap) {
        target = `AMRAP from ${prof.min || 1} reps`;
      } else if (prof.openTop) {
        target = `${prof.min || 5}+ reps`;
      } else {
        target = `${prof.min || 5}–${prof.max || 8} reps`;
      }
      let detail = '';
      if (scheme === 'onerm') {
        const pct = Number(prof.percentOf1RM) || 75;
        const manual = Number(prof.manual1RM) || 0;
        detail = `${pct}% of ${manual > 0 ? `manual 1RM (${manual} ${weightUnit()})` : 'estimated 1RM'}`;
      } else {
        const incType = prof.incrementType || 'lb';
        const incVal = prof.incrementValue ?? 5;
        detail = prof.repsOnly ? 'reps only, no load progression' : `+${incVal} ${incType === 'percent' ? '%' : weightUnit()} per jump`;
      }
      // Include the live suggestion reason if one exists for this exercise
      const sugg = (workoutState.draft?.progressionSuggestions || []).find(x => x.exerciseId === item.exerciseId);
      const basis = sugg?.reason ? `<span class="prog-basis">${escapeHtml(sugg.reason)}</span>` : '';
      return `<div class="prog-summary"><span class="prog-scheme">${escapeHtml(schemeLabel)}</span><span class="prog-target">${escapeHtml(target)}</span><span class="prog-detail">${escapeHtml(detail)}</span>${basis}</div>`;
    }

    function renderWorkoutExercises() {
      const draft = workoutState.draft;
      if (!draft) return;
      /* Reorder button only makes sense with 2+ exercises to reorder. */
      const reorderBtn = $('#reorderWorkoutExercises');
      if (reorderBtn) reorderBtn.style.display = draft.exercises.length >= 2 ? '' : 'none';
      /* Preserve scroll across re-renders (prevents tap-induced jumps). */
      const _scrollY=window.scrollY;
      draft.exercises.forEach(item=>{if(!item.uid)item.uid=uid('exercise');item.sets=(item.sets||[]).map(set=>({...set,uid:set.uid||uid('set'),tags:[...(set.tags||[])]}));});
      $('#workoutExercises').innerHTML = draft.exercises.length ? draft.exercises.map((item,itemIndex) => {
        const ex = exercises.find(x => x.id === item.exerciseId); if (!ex) return '';
        const isBodyweight = ex.equipment === 'body only';
        const isDumbbell = ex.equipment === 'dumbbell';
        const tracking = exerciseTracking(item, ex);
        const lastWeight = lastUsedWeight(item.exerciseId);
        const target = item.suggestedTarget || {};
        const weightHint = target.w || lastWeight || '';
        const rp = rangePlaceholder(item.progression,tracking==='time');
        const perfHint = tracking === 'time' ? (target.seconds || rp.text) : (target.r || rp.text);
        const perfFallback = tracking === 'time' ? (target.seconds || rp.value) : (target.r || rp.value);
        const lastSummary = lastSessionSetSummary(item.exerciseId);
        const grouped = item.supersetId && draft.exercises.filter(x => x.supersetId === item.supersetId).length > 1;
        const doneSets=item.sets.filter(set=>set.complete).length;
        const topWeight=Math.max(0,...item.sets.map(set=>Number(set.w)||0));
        const cardSummary=`${topWeight?`${displayWeight(topWeight)} ${weightUnit()}`:''}${doneSets?`${topWeight?' · ':''}${doneSets}/${item.sets.length} complete`:''}`;
        return `<details class="exercise-accordion workout-exercise" data-workout-exercise="${escapeHtml(item.uid)}" ${item.cardOpen===false?'':'open'}>
            <!-- #12 corner-icon rule (user 2026-09-11): the info button lives in the card's top-right corner, matching the library star. REVERT: delete this button and restore it inside .exercise-accordion-actions above. -->
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
                <input class="log-input rpe-input" data-field="rpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(set.rpe)}" placeholder="RPE" aria-label="Set ${index + 1} optional RPE" />
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
      }).join('') : '<div class="history-empty">No exercises yet. Add your first movement to begin logging.</div>';

      document.querySelectorAll('.remove-workout-exercise').forEach(button => button.addEventListener('click', () => {
        const draft=workoutState.draft;
        const item = draft?.exercises.find(row => row.uid === button.dataset.uid);
        const ex = item ? exercises.find(x => x.id === item.exerciseId) : null;
        pendingRemoveExerciseUid = button.dataset.uid;
        $('#removeExerciseDesc').textContent = ex ? `Remove "${ex.name}" from this workout? This cannot be undone.` : 'Remove this exercise from the workout? This cannot be undone.';
        $('#removeExerciseDialog').showModal();
      }));
      document.querySelectorAll('.add-set').forEach(button => button.addEventListener('click', () => { draft.exercises.find(item => item.uid === button.dataset.uid)?.sets.push(newSet()); renderWorkoutExercises(); markDraftSaved(); }));
      document.querySelectorAll('[data-copy-first-set]').forEach(button => button.addEventListener('click', () => {
        const item=draft.exercises.find(row=>row.uid===button.dataset.copyFirstSet); if(!item||item.sets.length<2)return;
        const first=item.sets[0], fallback=lastUsedWeight(item.exerciseId);
        item.sets.slice(1).forEach(set=>{set.w=first.w!==''?first.w:fallback;set.r=first.r;set.seconds=first.seconds;set.rpe=first.rpe;});
        renderWorkoutExercises(); markDraftSaved();
        requestAnimationFrame(()=>{const feedback=document.querySelector(`[data-copy-feedback="${CSS.escape(item.uid)}"]`);if(feedback)feedback.textContent='Applied';});
      }));
      function deleteWorkoutSet(exerciseUid,setUid){
        const draft=workoutState.draft;if(!draft)return;
        const item=draft.exercises.find(row=>row.uid===exerciseUid);if(!item)return;
        item.sets=item.sets.filter(set=>set.uid!==setUid);
        if(!item.sets.length){ /* Deleting the last set removes the exercise (user 2026-09-11). */ draft.exercises=draft.exercises.filter(row=>row.uid!==item.uid); }
        renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
      }
      document.querySelectorAll('.delete-set,.delete-set-swipe').forEach(button => button.addEventListener('click', () => deleteWorkoutSet(button.dataset.exerciseUid,button.dataset.setUid)));
      document.querySelectorAll('.log-input').forEach(input => input.addEventListener('input', () => { const row=input.closest('.log-set'); const exerciseUid = input.closest('.workout-exercise').dataset.workoutExercise; const setUid = row.dataset.setUid; const set = draft.exercises.find(item => item.uid === exerciseUid)?.sets.find(itemSet => itemSet.uid === setUid); if (set) { set[input.dataset.field] = input.dataset.field==='w' ? storageWeight(input.value) : input.value; if (set.complete) { set.complete = false; row.classList.remove('is-complete'); const check=row.querySelector('.complete-set'); check?.setAttribute('aria-pressed','false'); check?.setAttribute('aria-label','Mark set complete'); } } $('#workoutError').textContent = ''; markDraftSaved(); }));
      document.querySelectorAll('.complete-set').forEach(button => button.addEventListener('click', () => {
        /* #86 (user 2026-09-11): completing a set must dismiss its open
           swipe rail — the rail must not linger behind the green checkmark. */
        const swipeItem = button.closest('.swipe-item');
        if (swipeItem && swipeItem.classList.contains('is-open')) setSwipeOpen(swipeItem, false);
        const set = findDraftSet(button.dataset.exerciseUid, button.dataset.setUid);
        const item=draft.exercises.find(row=>row.uid===button.dataset.exerciseUid);
        const ex=exercises.find(row=>row.id===item?.exerciseId);
        const tracking=exerciseTracking(item,ex), weightOptional=ex?.equipment==='body only';
        if (!set) return;
        const setRow=button.closest('.log-set');
        const weightInput=setRow.querySelector('.weight-input');
        const perfInput=setRow.querySelector('.reps-input');
        const perfField=tracking==='time'?'seconds':'r';
        if (!set.complete && set.w === '' && weightInput?.dataset.placeholderWeight) {
          set.w=weightInput.dataset.placeholderWeight;
          weightInput.value=set.w;
        }
        if (!set.complete && (set[perfField]==null||set[perfField]==='') && perfInput?.dataset.placeholderPerf) {
          set[perfField]=perfInput.dataset.placeholderPerf;
          perfInput.value=set[perfField];
        }
        const performanceValue=tracking==='time'?set.seconds:set.r;
        if (!set.complete && ((!weightOptional && set.w === '') || performanceValue === '' || Number(set.w||0) < 0 || Number(performanceValue) < 1 || (set.rpe !== '' && (Number(set.rpe) < 1 || Number(set.rpe) > 10)))) {
          const perfWord = tracking==='time'?'seconds':'reps';
          showToast(weightOptional ? `Enter ${perfWord} to complete this set. Weight and RPE are optional.` : `Enter weight and ${perfWord} to complete this set. RPE is optional.`);
          setRow.querySelector((!weightOptional&&set.w==='')?'.weight-input':'.reps-input')?.focus(); return;
        }
        const pr=!set.complete?livePRLabel(item,set):'';
        set.complete = !set.complete; button.setAttribute('aria-pressed', String(set.complete)); button.setAttribute('aria-label', set.complete ? 'Mark set incomplete' : 'Mark set complete'); button.closest('.log-set').classList.toggle('is-complete', set.complete); $('#workoutError').textContent = ''; if(pr)showToast(`PR · ${pr}`,'pr-toast'); markDraftSaved();
      }));
      document.querySelectorAll('.advanced-options').forEach(details => details.addEventListener('toggle', () => { const item=draft.exercises.find(row=>row.uid===details.closest('.workout-exercise')?.dataset.workoutExercise); if(item)item.optionsOpen=details.open; }));
      document.querySelectorAll(".exercise-accordion").forEach(card => card.addEventListener('toggle', () => { const item=draft.exercises.find(row=>row.uid===card.dataset.workoutExercise); if(item){item.cardOpen=card.open;markDraftSaved();} }));
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
      document.querySelectorAll('[data-tag-set-uid]').forEach(button => button.addEventListener('click', () => openTagDialog(button.dataset.tagExerciseUid, button.dataset.tagSetUid)));
      document.querySelectorAll('[data-draft-exercise-tags]').forEach(button => button.addEventListener('click', () => openExerciseTagDialog({mode:'draft',exerciseUid:button.dataset.draftExerciseTags})));
      document.querySelectorAll('[data-exercise-info]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openExercise(button.dataset.exerciseInfo); }));
      document.querySelectorAll('[data-add-note]').forEach(button => button.addEventListener('click', () => { const item = draft.exercises.find(x => x.uid === button.dataset.addNote); if (!item) return; item.noteOpen = true; renderWorkoutExercises(); requestAnimationFrame(() => { window.scrollTo(0,window.scrollY); document.querySelector(`[data-exercise-note="${CSS.escape(item.uid)}"]`)?.focus({preventScroll:true}); }); }));
      document.querySelectorAll('[data-exercise-note]').forEach(input => input.addEventListener('input', () => { const item = draft.exercises.find(x => x.uid === input.dataset.exerciseNote); if (item) item.note = input.value; markDraftSaved(); }));
      document.querySelectorAll('[data-tracking-uid]').forEach(button => button.addEventListener('click', () => {
        const item = draft.exercises.find(row => row.uid === button.dataset.trackingUid); if (!item) return;
        const next = button.dataset.trackingMode || 'reps';
        if (exerciseTracking(item, exercises.find(ex => ex.id === item.exerciseId)) === (next === 'seconds' ? 'time' : 'reps')) return;
        item.tracking = next === 'seconds' ? 'time' : 'reps';
        item.progression = {...progressionProfileForDraftItem(item), mode:item.tracking};
        item.sets.forEach(set => { set.complete = false; });
        renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved();
      }));
      document.querySelectorAll('[data-superset-uid]').forEach(button => button.addEventListener('click', () => openSupersetDialog(button.dataset.supersetUid)));
      attachReorderHandles();
      attachSwipeDelete($('#workoutExercises'));
      window.scrollTo(0,_scrollY);
    }

    
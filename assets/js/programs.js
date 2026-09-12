
/* ===== module: programs.js ===== */
    /** Active programs: model helpers, create/edit form, program home,
        program-workout pages, and archived history (split #99 B3 —
        saved-workout templates, the builder, and template launch live in
        saved-workouts.js, which loads just before this file). */
        /* Module map (v1.006) — Key: renderProgram(), openProgramWorkoutPage(), startProgramWorkout(), programWeekAtDate(), seedProgramForm(). Depends on: workout-editor factories, saved-workouts.js (loads just before), state programs. */
    /* iOS Safari quirk (user 2026-09-12): opening a top-layer <dialog> with
       showModal() can yank the page scroll — focus scrolls the dialog's
       in-flow position (end of <body>) into view, so the page behind jumps.
       Pin the scroll position across showModal so the page never moves. */
    function showModalPinned(dialog){
      const x=window.scrollX,y=window.scrollY;
      dialog.showModal();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(window.scrollX!==x||window.scrollY!==y)window.scrollTo(x,y);
      }));
    }
    function applyRepPreset(key,target=progressionSetup){
      const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;
      target.defaultRange={preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};
      /* Settings pills edit the global defaults; program pills edit the form
         draft only (user 2026-09-10: the program form must never change
         the defaults — defaults flow INTO the form instead). */
      const isGlobal=target===progressionSetup;
      const minInput=$(isGlobal?'#settingsRepMin':'#programRepMin'), maxInput=$(isGlobal?'#settingsRepMax':'#programRepMax');
      if(minInput)minInput.value=preset.min??'';
      if(maxInput)maxInput.value=preset.max??'';
      document.querySelectorAll(`${isGlobal?'#settingsRepPresets':'#programRepPresets'} [data-rep-preset]`).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===key)));
    }
    /* Program setup form scratch state (user 2026-09-10): every control in
       the program form reads/writes this draft, never the global
       progressionSetup. Seeding flows the defaults INTO the form (or a
       program's own progression when editing); creating the program
       snapshots the draft. */
    let programDraftProgression=null;
    let pendingDeleteProgramWorkoutUid=null;
    /* #71: confirmation dialog for deleting a program workout. */
    $('#cancelDeleteProgramWorkout')?.addEventListener('click',()=>$('#deleteProgramWorkoutDialog').close());
    $('#keepProgramWorkout')?.addEventListener('click',()=>$('#deleteProgramWorkoutDialog').close());
    $('#confirmDeleteProgramWorkout')?.addEventListener('click',()=>{
      /* Deleting from the program list must not jump to the top of the page
         (user 2026-09-12): capture scroll before the dialog closes and the
         list re-renders, then restore it. Deleting from a workout's own page
         returns to the program cover, where the top is the right landing. */
      const wasOnWorkoutPage=!!state.programWorkoutUid&&state.programWorkoutUid===pendingDeleteProgramWorkoutUid;
      const sx=window.scrollX,sy=window.scrollY;
      $('#deleteProgramWorkoutDialog').close();
      const program=workoutState.activeProgram;
      if(program&&pendingDeleteProgramWorkoutUid){
        program.workouts=program.workouts.filter(workout=>workout.uid!==pendingDeleteProgramWorkoutUid);
        if(state.programWorkoutUid===pendingDeleteProgramWorkoutUid)state.programWorkoutUid=null;
        schedulePersist();renderProgram();
        if(!wasOnWorkoutPage)window.scrollTo(sx,sy);
      }
      pendingDeleteProgramWorkoutUid=null;
    });
    /* Discard-changes modal for the program setup form (user 2026-09-12). */
    let programEditSnapshot=null;
    $('#keepProgramChanges')?.addEventListener('click',()=>$('#discardProgramChangesDialog').close());
    $('#keepProgramChangesBtn')?.addEventListener('click',()=>$('#discardProgramChangesDialog').close());
    $('#confirmDiscardProgramChanges')?.addEventListener('click',()=>{$('#discardProgramChangesDialog').close();cancelProgramEdit();});
    $('#closeAddSavedToProgram')?.addEventListener('click',()=>$('#addSavedToProgramDialog').close());
    function cloneProgression(src){const base=src||{};return {...base,defaultRange:{...(base.defaultRange||{})},weeklyRanges:[...(base.weeklyRanges||[])],weeklyPcts:[...(base.weeklyPcts||[])],weeklyDeloads:[...(base.weeklyDeloads||[])] };}
    function programFormProgression(){if(!programDraftProgression)programDraftProgression=cloneProgression(progressionSetup);return programDraftProgression;}
    function syncProgramForm(){
      const p=programFormProgression(), range=p.defaultRange||{};
      /* #99 H6: null-guard every direct DOM write. */
      const threshold=$('#progressionThreshold'); if(threshold)threshold.value=p.threshold??8;
      const scheme=p.scheme||'rpe';
      document.querySelectorAll('#programSchemePills [data-scheme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scheme===scheme)));
      // The RPE trigger only applies to RPE-based mode — hide it entirely
      // under linear and %1RM progression (user 2026-09-11, #54).
      if(threshold&&threshold.closest('.rule-field'))threshold.closest('.rule-field').hidden=scheme==='linear'||scheme==='onerm';
      const incType=$('#progressionIncrementType'); if(incType)incType.value=p.incrementType||'lb';
      // %1RM prescribes load as a percentage of 1RM, so fixed increments don't apply.
      const incPair=incType&&incType.closest('.settings-pair'); if(incPair)incPair.hidden=scheme==='onerm';
      const pctField=$('#progressionPercent1RMField'); if(pctField)pctField.hidden=scheme!=='onerm';
      const pctInput=$('#progressionPercent1RM'); if(pctInput)pctInput.value=clampPct1RM(Number(p.percentOf1RM)||75);
      const deloadEvery=$('#deloadEvery'); if(deloadEvery)deloadEvery.value=String(Math.max(0,Math.min(12,Number(p.deloadEvery)||0)));
      const deloadPct=$('#deloadPct'); if(deloadPct)deloadPct.value=clampDeloadPct(Number(p.deloadPct)||60);
      const waveToggle=$('#pctWaveToggle');
      if(waveToggle){waveToggle.setAttribute('aria-pressed',String(!!p.pctWave));waveToggle.setAttribute('aria-label',`Vary percent of 1RM by week ${p.pctWave?'on':'off'}`);}
      const incVal=$('#progressionIncrementValue'); if(incVal)incVal.value=p.incrementValue??5;
      const repMin=$('#programRepMin'); if(repMin)repMin.value=range.min??'';
      const repMax=$('#programRepMax'); if(repMax)repMax.value=range.max??'';
      document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===(range.preset||'hypertrophy'))));
      syncTimeStepPills($('#programTimeStepPills'),p.timeStep??5);
      const und=$('#undulatingToggle');
      if(und){und.setAttribute('aria-pressed',String(!!p.undulating));und.setAttribute('aria-label',`Vary rep ranges by week ${p.undulating?'on':'off'}`);}
      /* %1RM wave panel (#54, v1.001). */
      const pwp=$('#pctWavePanel');
      if(pwp)pwp.hidden=!p.pctWave;
      syncProgramIncrementUnit();
      renderWeekRanges(p);
      renderWeekPcts(p);
    }
    function seedProgramForm(fromProgram){
      programDraftProgression=cloneProgression(fromProgram?.progression||progressionSetup);
      syncProgramForm();
    }
    function renderWeekRanges(target){
      target=target||programFormProgression();
      const panel=$('#undulatingPanel'),list=$('#weekRangeList'),length=Math.max(1,Math.min(52,Number($('#programLength').value)||8));
      const startWeekInput=$('#programStartWeek');if(startWeekInput){startWeekInput.max=String(length);startWeekInput.value=String(Math.max(1,Math.min(length,Number(startWeekInput.value)||1)));}
      panel.hidden=!target.undulating;if(panel.hidden)return;
      /* #99 H5: normalize state via the shared helper — no mutation inside render. */
      ensureWeeklyRanges(target,length);
      list.innerHTML=target.weeklyRanges.map((preset,index)=>weekRangeRow(preset,index,'data-week-pill')).join('');
      document.querySelectorAll('[data-week-pill]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.weekPill);target.weeklyRanges[index]=button.dataset.preset;document.querySelectorAll(`[data-week-pill="${index}"]`).forEach(other=>other.setAttribute('aria-pressed',String(other===button)));schedulePersist();}));
    }
    /* #99 H5: normalize % wave state OUTSIDE render — render functions must
       not mutate state. New weeks inherit the flat %; deload flags default off. */
    function ensureWeeklyPcts(target,length){
      const flat=clampPct1RM(Number(target.percentOf1RM)||75);
      if(!Array.isArray(target.weeklyPcts))target.weeklyPcts=[];
      while(target.weeklyPcts.length<length)target.weeklyPcts.push(flat);
      target.weeklyPcts=target.weeklyPcts.slice(0,length);
      if(!Array.isArray(target.weeklyDeloads))target.weeklyDeloads=[];
      while(target.weeklyDeloads.length<length)target.weeklyDeloads.push(false);
      target.weeklyDeloads=target.weeklyDeloads.slice(0,length);
    }
    /* Weekly % wave panel (#54, v1.001): mirrors the undulating rep-range
       panel. Each row shows the week's rep-range context (so a deload week
       reads e.g. "Week 4 · Endurance · 60% · deload"), a % number input, and
       a per-week deload flag. */
    function weekPctRow(pct,deload,index,rangeLabel){
      return `<div class="week-pct-row"><strong>Week ${index+1}</strong><span class="week-pct-range">${escapeHtml(rangeLabel)}</span><label class="week-pct-input"><input type="number" inputmode="numeric" min="1" max="100" step="1" value="${pct}" data-week-pct="${index}" aria-label="Week ${index+1} percent of 1RM"><em>%</em></label><button type="button" class="rep-preset" data-week-deload="${index}" aria-pressed="${deload?'true':'false'}">Deload</button></div>`;
    }
    function renderWeekPcts(target){
      target=target||programFormProgression();
      const panel=$('#pctWavePanel'),list=$('#weekPctList');
      if(!panel||!list)return;
      const length=Math.max(1,Math.min(52,Number($('#programLength').value)||8));
      panel.hidden=!target.pctWave;if(panel.hidden)return;
      ensureWeeklyPcts(target,length);
      list.innerHTML=target.weeklyPcts.map((pct,index)=>{
        const rangeLabel=programRangeLabel(programRangeForWeek({progression:target},index+1));
        return weekPctRow(clampPct1RM(Number(pct)||target.percentOf1RM||75),!!target.weeklyDeloads[index],index,rangeLabel);
      }).join('');
      list.querySelectorAll('[data-week-pct]').forEach(input=>input.addEventListener('change',()=>{
        const index=Number(input.dataset.weekPct);
        target.weeklyPcts[index]=clampPct1RM(Number(input.value)||target.percentOf1RM||75);
        input.value=target.weeklyPcts[index];
        schedulePersist();
      }));
      list.querySelectorAll('[data-week-deload]').forEach(button=>button.addEventListener('click',()=>{
        const index=Number(button.dataset.weekDeload);
        target.weeklyDeloads[index]=!target.weeklyDeloads[index];
        button.setAttribute('aria-pressed',String(target.weeklyDeloads[index]));
        schedulePersist();
      }));
    }
    function programRangeForWeek(program,week){const progression=program?.progression||progressionSetup;if(!progression.undulating)return progression.defaultRange||progressionSetup.defaultRange;const key=progression.weeklyRanges?.[Math.max(0,week-1)]||progression.defaultRange?.preset||'hypertrophy';const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;return {preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};}
    /* %1RM per-week % wave (#54, v1.001): mirrors programRangeForWeek, but for
       load percent instead of rep range. Explicit weekly entries beat the flat
       percentOf1RM default; #118 loop semantics — the wave cycles across the
       program length. Accepts a program or a bare progression/config object. */
    function programPctForWeek(programOrConfig,week){
      const progression=programOrConfig?.progression||programOrConfig||progressionSetup;
      /* The wave only applies when the toggle is on; a disabled wave leaves
         stale weeklyPcts inert so the flat percent rules. */
      if(!progression.pctWave)return null;
      const arr=progression.weeklyPcts;
      if(!Array.isArray(arr)||!arr.length)return null;
      const w=Math.max(1,Number(week)||1);
      const v=Number(arr[(w-1)%arr.length]);
      return Number.isFinite(v)&&v>0?v:null;
    }
    /* A week is a deload week only when the user scheduled it: every-N-weeks,
       or flagged in the % wave panel. Deloads are never inferred — the
       "engine never auto-deloads" rule stands. */
    function isDeloadWeek(programOrConfig,week){
      const progression=programOrConfig?.progression||programOrConfig||progressionSetup;
      const w=Math.max(1,Number(week)||0);
      if(!(w>0))return false;
      const every=Number(progression.deloadEvery)||0;
      if(every>0&&w%every===0)return true;
      const flags=progression.weeklyDeloads;
      return Array.isArray(flags)&&flags.length>0&&!!flags[(w-1)%flags.length];
    }
    function programMuscles(program){const counts={};(program.workouts||[]).forEach(workout=>(workout.template?.exercises||[]).forEach(item=>{const ex=exercises.find(row=>row.id===item.exerciseId);[...(ex?.primary||[]),...(ex?.secondary||[])].forEach(m=>counts[m]=(counts[m]||0)+1);}));return Object.entries(counts).sort((a,b)=>b[1]-a[1]);}
    function programWeekAtDate(program,date=new Date()) {
      /* #99 A14: compare LOCAL CALENDAR-DAY ordinals — no noon-ms math, so
         the week can't flip mid-day or drift across a DST transition. */
      const dayNum=iso=>{
        const parts=String(iso).split('-');
        return Math.floor(Date.UTC(Number(parts[0]),Number(parts[1])-1,Number(parts[2]))/86400000);
      };
      const startDay=dayNum(program.startedAt||localIsoDate());
      const pointDay=typeof date==='string'?dayNum(date):dayNum(localIsoDate(date));
      const elapsed=Math.max(0,Math.floor((pointDay-startDay)/7));
      return Math.max(1,Math.min(program.length,Math.max(1,Number(program.startWeek)||1)+elapsed));
    }
    function programWeek(program) { return programWeekAtDate(program,new Date()); }
    function programRangeLabel(range) {
      if(range?.amrap)return `AMRAP from ${range.min||1} reps`;
      if(range?.openTop||range?.max==null)return `${range.min||15}+ reps`;
      if(range?.min&&range.min===range.max)return `${range.min} reps`;
      return `${range?.min||1}–${range?.max||range?.min||1} reps`;
    }
    /* #49: the Workout tab's continue-program card must read as the workout's
       own prescription, not the program default. Exercises without their own
       range inherit the program default for the week, so those label as the
       default; mixed prescriptions label honestly as mixed. */
    function programWorkoutRangeLabel(program,workout,week){
      const fallback=programRangeForWeek(program,week);
      const labels=[...new Set((workout?.template?.exercises||[]).map(x=>{
        const p=x.progression||{}, time=(x.tracking||p.mode)==='time';
        if(time){
          if(p.timeMin==null&&p.timeMax==null)return programRangeLabel(fallback);
          const min=p.timeMin,max=p.timeMax;
          return min&&max&&min!==max?`${min}–${max} sec`:`${min||max} sec`;
        }
        const hasOwn=p.min!=null||p.max!=null||p.openTop||p.amrap;
        return programRangeLabel(hasOwn?p:fallback);
      }).filter(Boolean))];
      if(!labels.length)return programRangeLabel(fallback);
      return labels.length===1?labels[0]:'Mixed ranges';
    }
    function suggestedProgramWorkout(program) {
      const ready=(program?.workouts||[]).filter(workout=>workout.template?.exercises?.length);
      if(!ready.length)return null;
      return ready.map((workout,index)=>{
        const logs=workoutState.completed.filter(row=>row.programId===program.id&&row.programWorkoutUid===workout.uid);
        const last=logs.reduce((latest,row)=>row.date>(latest||'')?row.date:latest,'');
        return {workout,index,last};
      }).sort((a,b)=>(a.last||'').localeCompare(b.last||'')||a.index-b.index)[0].workout;
    }
    function renderArchivedPrograms() {
      const archived=workoutState.archivedPrograms;$('#archivedPrograms').hidden=!archived.length;
      $('#archivedProgramList').innerHTML=archived.map(program=>{
        const logs=workoutState.completed.filter(workout=>workout.programId===program.id).sort(sortByRecencyDesc); /* #99 A13: latest by completion */
        /* #132 (user 2026-09-11): flat row (no nested card), date kept on one
           line, Restore is a quiet tertiary action. */
        return `<div class="archive-row-wrap"><div class="archive-row"><div><strong>${escapeHtml(program.name)}</strong><br><span class="archive-meta">${program.length} weeks · ${logs.length} logged workout${logs.length===1?'':'s'} · <span class="nowrap">archived ${escapeHtml(formatLogDate(program.archivedAt))}</span></span></div><button class="archive-restore restore-program" type="button" data-program-id="${escapeHtml(program.id)}">Restore</button></div><details class="archive-history"><summary>View program history${logs.length?` · ${logs.length} sessions`:''}</summary><div class="archive-history-list">${logs.length?logs.map(workout=>`<button class="archive-workout" type="button" data-archived-workout="${escapeHtml(workout.id)}"><strong>${escapeHtml(workout.name)}</strong><span>${escapeHtml(formatLogDate(workout.date))} · ${workout.exercises.reduce((sum,item)=>sum+item.sets.length,0)} sets</span></button>`).join(''):'<p class="section-note">No completed workouts are linked to this program.</p>'}</div></details></div>`;
      }).join('');
      document.querySelectorAll('.restore-program').forEach(button=>button.addEventListener('click',()=>{const index=workoutState.archivedPrograms.findIndex(p=>p.id===button.dataset.programId);if(index<0)return;const restored=workoutState.archivedPrograms.splice(index,1)[0];if(workoutState.activeProgram&&workoutState.activeProgram.id!==restored.id){workoutState.activeProgram.archivedAt=localIsoDate();workoutState.archivedPrograms.unshift(workoutState.activeProgram);}workoutState.activeProgram=restored;delete workoutState.activeProgram.archivedAt;schedulePersist();renderProgram();renderDashboard();}));
      document.querySelectorAll('[data-archived-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=workoutState.completed.find(row=>row.id===button.dataset.archivedWorkout);if(!workout)return;state.workoutDetailReturn=ROUTES.DETAIL_RETURN.PROGRAM;showWorkouts(false);renderCompletedWorkout(workout,{push:true});}));
    }
    function startProgramWorkout(program, workout) {
      requestStartWithConflict(workout.name,()=>doStartProgramWorkout(program,workout));
    }
    function doStartProgramWorkout(program, workout) {
      const inheritedRange=programRangeForWeek(program,programWeek(program));
      showWorkouts();
      state.workoutHistoryOpen=false;
      workoutState.draft={name:workout.name,date:localIsoDate(),programId:program.id,programWorkoutUid:workout.uid,editingId:null,exercises:workout.template.exercises.map(x=>{
        const base=x.progression||{};
        const hasExerciseRange=base.min!=null||base.max!=null||base.openTop!=null||base.amrap!=null;
        /* #99 M21: spread base FIRST, then computed fallbacks. Previously the
           fallbacks came before ...base, so an explicit `{min: undefined}` in
           base would silently clobber the inherited range. */
        const progression={
          ...base,
          mode:base.mode||x.tracking||'reps',
          min:base.min??inheritedRange.min,
          max:base.max??inheritedRange.max,
          openTop:base.openTop??(hasExerciseRange?false:!!inheritedRange.openTop),
          amrap:base.amrap??(hasExerciseRange?false:!!inheritedRange.amrap),
          scheme:program.progression?.scheme||'rpe'
        };
        return cloneExerciseItem(x,'fromProgram',{tracking:x.tracking||progression.mode||'reps',noteOpen:!!x.note,progression,emptyDefault:true});
      })};
      const progressionContext={...program.progression,currentWeek:programWeek(program)};
      prepareDraftProgression(workoutState.draft,progressionContext);
      workoutState.draft.progressionSuggestions.forEach(suggestion=>applyProgressionSuggestion(workoutState.draft,suggestion,false));
      /* v0.99al: no range-minimum stamping. The live editor ghosts the right
         default per exercise — explicit suggestion first, then the latest top
         set when the engine holds (history but no suggestion), then the range
         placeholder when there is no history. Stamping the minimum here made
         holds read as e.g. 100×1 instead of 100×6, and prefilled values hid
         the ghost. Entered values are never altered. */
      schedulePersist();
      workoutState.draft.autoAppliedProgression=workoutState.draft.progressionSuggestions.length>0;
      state.workoutEditorOpen = true; /* #129: program session starts immediately. */
      renderWorkoutScreen();
    }
    function renderProgram() {
      const program = workoutState.activeProgram;
      const editing=$('#createProgram').dataset.editing==='true'&&!!program;
      $('#programSetup').hidden = !!program && !editing;
      $('#programCover').hidden = !program || editing;
      renderArchivedPrograms();
      if (!program) { state.programWorkoutUid=null; if(!programDraftProgression)seedProgramForm(null); updateTopBar('program'); return; }
      /* Program-workout page (user 2026-09-12): a workout's own view/edit/start
         page, mirroring the saved-workout editor page. */
      if(state.programWorkoutUid){
        const pw=program.workouts.find(w=>w.uid===state.programWorkoutUid);
        if(pw){renderProgramWorkoutPage(program,pw);return;}
        state.programWorkoutUid=null;
      }
      const week=programWeek(program), completedThisWeek=workoutState.completed.filter(w=>w.programId===program.id&&programWeekAtDate(program,w.date)===week).length;
      const muscleRows=programMuscles(program),muscleMax=Math.max(1,...muscleRows.map(([,count])=>count));
      $('#programCover').innerHTML = `<div class="program-cover-head"><div class="program-cover-kicker">ACTIVE PROGRAM · WEEK ${week} OF ${program.length}</div><h2>${escapeHtml(program.name)}</h2>${program.schedule?`<p class="program-cover-meta">${escapeHtml(program.schedule)} · ${program.workouts.length} session${program.workouts.length===1?'':'s'} per week</p>`:''}</div><div class="program-body">${program.notice?`<p class="program-notice">${escapeHtml(program.notice)}</p>`:''}<div class="program-progress"><span>${program.workouts.length} workout${program.workouts.length === 1 ? '' : 's'} in rotation</span><span>${completedThisWeek} completed this week</span></div><div class="week-progress" style="--program-weeks:${program.length}" aria-label="Week ${week} of ${program.length}">${Array.from({length:program.length},(_,i)=>`<span class="week-segment ${i+1<week?'past':i+1===week?'current':''}${isDeloadWeek(program,i+1)?' deload':''}"></span>`).join('')}</div><div class="program-cover-actions"><button class="secondary-button" id="editProgram" type="button">Edit program</button></div><section class="program-muscles"><h3>Muscles in this program</h3>${muscleRows.length?`<div class="program-muscle-bars">${muscleRows.slice(0,8).map(([muscle,count])=>`<div class="program-muscle-bar"><span>${escapeHtml(titleCase(muscle))}</span><i style="--fill:${Math.max(8,count/muscleMax*100)}%"></i></div>`).join('')}</div>`:'<p class="section-note">Add exercises to a program workout to see its muscle coverage.</p>'}</section><div class="program-progression-summary"><h3>Progression engine</h3><div class="program-progression-meta">${program.progression?.scheme==='linear'?'<span class="tag primary">Linear progression</span>':program.progression?.scheme==='onerm'?'<span class="tag primary">%1RM-based</span>':`<span class="tag primary">Top set ≤ RPE ${program.progression?.threshold??8}</span>`}${program.progression?.scheme==='onerm'?'':`<span class="tag">${program.progression?.incrementType==='percent'?(program.progression.incrementValue+'%'):(program.progression?.incrementValue??5)+' '+weightUnit()} ${program.progression?.scheme==='linear'?'every session':'default jump'}</span>`}${Number(program.progression?.deloadEvery)>0?`<span class="tag">Deloads every ${program.progression.deloadEvery} wks</span>`:''}<span class="tag">Auto-applied on start</span><span class="tag">${escapeHtml(titleCase(program.progression?.defaultRange?.preset||'hypertrophy'))} · ${programRangeLabel(program.progression?.defaultRange)}</span>${program.progression?.undulating?'<span class="tag primary">Varies by week</span>':''}${program.progression?.pctWave&&program.progression?.weeklyPcts?.length?'<span class="tag primary">% varies by week</span>':''}</div></div><div class="workout-toolbar"><h2>Workouts</h2><button class="exercise-info-button plain-glyph" id="addProgramWorkoutBtn" type="button" aria-label="Add workout"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div><div class="program-workouts" id="programWorkouts">${program.workouts.length ? program.workouts.map((workout) => {const exerciseCount=workout.template?.exercises?.length||0;
        /* #159: exactly one remove affordance per row — the swipe rail when swipe-to-delete is on, the visible x-button when it is off. */
        const swipeOn=typeof swipeDeleteSetsEnabled==='function'?swipeDeleteSetsEnabled():true;
        return `<div class="swipe-item program-swipe">${swipeOn?`<button class="swipe-delete-action delete-program-workout" type="button" data-uid="${escapeHtml(workout.uid)}" aria-label="Remove ${escapeHtml(workout.name)}" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg></button>`:''}<div class="picker-item saved-workout-card swipe-content program-workout-row"><button class="program-workout-open" type="button" data-program-workout="${escapeHtml(workout.uid)}" aria-label="Open ${escapeHtml(workout.name)}"><span><strong>${escapeHtml(workout.name)}</strong><span>${exerciseCount?`${exerciseCount} exercise${exerciseCount===1?'':'s'}`:'Empty shell · tap to add exercises'}</span></span><span class="picker-state" aria-hidden="true">›</span></button>${swipeOn?'':`<button class="program-workout-del" type="button" data-del-program-workout="${escapeHtml(workout.uid)}" aria-label="Delete ${escapeHtml(workout.name)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}</div></div>`;}).join('') : '<div class="history-empty">No workouts yet. Tap + to add the first one.</div>'}</div><button class="new-template-button" id="addSavedToProgramBtn" type="button">+ Add saved workout</button><div class="program-actions"><button class="secondary-button" id="endProgram" type="button">Archive program</button></div><p class="session-note">Weeks advance with calendar time; workout order is flexible.</p></div>`;
      $('#editProgram')?.addEventListener('click',editActiveProgram);
      /* #256 (user 2026-09-12): program sharing is out of the build until it
         mints short links — the cover's Share button is removed, and
         shareActiveProgram() stays only as the restoration point. */
      /* User 2026-09-12: program workouts need a visible delete button, not
         just swipe-to-delete — the × on each card opens the same confirm. */
      function confirmDeleteProgramWorkout(uid){
        const workout=program.workouts.find(w=>w.uid===uid);
        pendingDeleteProgramWorkoutUid=uid;
        $('#deleteProgramWorkoutDesc').textContent=workout?`Delete "${workout.name}" from your program? This cannot be undone.`:'Delete this workout from your program? This cannot be undone.';
        showModalPinned($('#deleteProgramWorkoutDialog'));
      }
      document.querySelectorAll('.delete-program-workout').forEach(button => button.addEventListener('click', () => confirmDeleteProgramWorkout(button.dataset.uid)));
      document.querySelectorAll('[data-del-program-workout]').forEach(button => button.addEventListener('click', () => confirmDeleteProgramWorkout(button.dataset.delProgramWorkout)));
      document.querySelectorAll('[data-program-workout]').forEach(b=>b.addEventListener('click',()=>openProgramWorkoutPage(b.dataset.programWorkout)));
      $('#addProgramWorkoutBtn').addEventListener('click', addProgramWorkout);
      $('#addSavedToProgramBtn')?.addEventListener('click', openAddSavedToProgram);
      $('#endProgram').addEventListener('click', () => {program.archivedAt=localIsoDate();workoutState.archivedPrograms.unshift(program);workoutState.activeProgram=null;programDraftProgression=null;$('#programName').value='';$('#programStartWeek').value='1';$('#programFocus').value='';schedulePersist();renderProgram();renderDashboard();});
      /* User 2026-09-12: card swipe respects the Settings swipe-to-delete
         choice — when it's off, the × button is the delete path. */
      if(typeof swipeDeleteSetsEnabled==='function'?swipeDeleteSetsEnabled():true)attachSwipeDelete($('#programWorkouts'));
      updateTopBar('program');
    }

    /* + under Program → Workouts (user 2026-09-12): opens the workout
       editor (the shared builder in edit mode) directly for the new shell —
       the dashed "Part of <program>" chip at the top shows it belongs to the
       program. The shell itself is created lazily in openSavedBuilder so a
       kept draft leaves no orphan "Workout N" behind. Backing out of the
       builder returns to the program page. */
    function addProgramWorkout() {
      if (!workoutState.activeProgram) return;
      startSavedBuilder({newProgramWorkout:true});
    }

    /* Program-workout page (user 2026-09-12): mirrors the saved-workout editor
       page — kicker, stats, Start inline with the name at top-right, muscle
       map, exercise list, Edit (the builder in edit mode), delete. Reuses
       savedExerciseSummary, workoutBodyMapMarkup, and hydrateBodyMaps. */
    function openProgramWorkoutPage(uid){
      const program=workoutState.activeProgram;
      if(!program?.workouts.some(w=>w.uid===uid))return;
      state.programWorkoutUid=uid;
      /* The card can be tapped from the Workout tab's "From <program>"
         section too (user 2026-09-12) — switch to the Program screen first,
         otherwise the top bar says Program while the Workout tab stays
         rendered. */
      showProgram(false);
      window.scrollTo({top:0});
    }
    function renderProgramWorkoutPage(program,workout){
      const cover=$('#programCover');if(!cover)return;
      $('#programSetup').hidden=true;cover.hidden=false;
      const rows=workout.template?.exercises||[];
      const muscles=[...new Set(rows.flatMap(item=>{const ex=exercises.find(e=>e.id===item.exerciseId);return [...(ex?.primary||[]),...(ex?.secondary||[])];}))];
      const totalSets=rows.reduce((n,item)=>n+(item.sets||[]).length,0);
      const listRows=rows.map(item=>{const s=savedExerciseSummary(item);return `<button class="picker-item saved-editor-row" type="button" data-program-exercise="${escapeHtml(item.exerciseId)}" aria-label="Open ${escapeHtml(s.name)} details"><span><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.meta)}</span></span><span class="picker-state" aria-hidden="true">\u203a</span></button>`;}).join('');
      cover.innerHTML=`<div class="completed-card"><span class="continue-kicker">Program workout</span><div class="detail-title-row"><h2>${escapeHtml(workout.name)}</h2><span class="title-actions"><button class="icon-button" id="shareProgramWorkoutBtn" type="button" aria-label="Share ${escapeHtml(workout.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.6 7.4L12 3l4.4 4.4"/><path d="M6 11.5V19a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 19v-7.5"/></svg></button>${rows.length?`<button class="start-inline-button" id="startProgramWorkoutBtn" type="button">Start</button>`:''}</span></div><p class="completed-meta">${rows.length} exercise${rows.length===1?'':'s'} · ${totalSets} set${totalSets===1?'':'s'}</p>
      ${muscles.length?`<div class="section-head"><h3>Muscles worked</h3></div>${workoutBodyMapMarkup(muscles)}<div class="workout-muscles">${muscles.map(m=>musclePill(m)).join('')}</div>`:''}
      <div class="section-head"><h3>Exercises</h3></div>${listRows||'<p class="section-note">No exercises yet — tap Edit to build this workout.</p>'}
      <div class="detail-action-buttons"><div class="detail-action-row"><button class="secondary-button" id="editProgramWorkoutBtn" type="button">Edit</button></div>
      <button class="template-delete-text" id="deleteProgramWorkoutBtn" type="button">delete workout</button></div></div>`;
      hydrateBodyMaps();
      $('#startProgramWorkoutBtn')?.addEventListener('click',()=>startProgramWorkout(program,workout));
      /* #181: exercise rows open the exercise detail — state.programWorkoutUid
         is untouched, so Back lands on this program workout page. */
      document.querySelectorAll('[data-program-exercise]').forEach(b=>b.addEventListener('click',()=>openExercise(b.dataset.programExercise,true,makeReturnRoute(ROUTES.VIEW.PROGRAM))));
      /* Program workouts share as saved workouts (user 2026-09-12) — the
         workout already stores a template-shaped object. */
      $('#shareProgramWorkoutBtn')?.addEventListener('click',()=>shareTemplateLike(workout.name,workout.template?.exercises||[]));
      $('#editProgramWorkoutBtn')?.addEventListener('click',()=>{startSavedBuilder({programUid:workout.uid});});
      $('#deleteProgramWorkoutBtn')?.addEventListener('click',()=>{
        pendingDeleteProgramWorkoutUid=workout.uid;
        $('#deleteProgramWorkoutDesc').textContent=`Delete "${workout.name}" from your program? This cannot be undone.`;
        showModalPinned($('#deleteProgramWorkoutDialog'));
      });
      updateTopBar('program');
    }
    /* Dashed "+ Add saved workout" under the program's workouts (user
       2026-09-12): pulls an existing saved workout into the program as a new
       workout, copying its exercises. */
    /* #64: the add-to-program dialog sources from saved workouts AND past
       sessions — a past session becomes its own program-workout copy
       (exercises + set counts + ranges + progression rules; actuals become
       targets via the same conversion as "save as template"). */
    let addToProgramTab='saved';
    function openAddSavedToProgram(){
      const program=workoutState.activeProgram;if(!program)return;
      addToProgramTab='saved';
      const addShellToProgram=shell=>{
        program.workouts.push(shell);
        schedulePersist();
        /* Stay on the program page (user 2026-09-12): don't jump into the
           workout that was just added. Preserve the scroll position so the
           list doesn't jump either. */
        const sx=window.scrollX,sy=window.scrollY;
        $('#addSavedToProgramDialog').close();
        state.programWorkoutUid=null;
        renderProgram();
        window.scrollTo(sx,sy);
        showToast(`Added "${shell.name}" to the program.`);
      };
      const renderList=()=>{
        const host=$('#addSavedToProgramList');if(!host)return;
        $('#addToProgramTabSaved')?.setAttribute('aria-pressed',String(addToProgramTab==='saved'));
        $('#addToProgramTabPast')?.setAttribute('aria-pressed',String(addToProgramTab==='past'));
        if(addToProgramTab==='past'){
          const past=(workoutState.completed||[]).slice().sort(sortByRecencyDesc);
          host.innerHTML=past.length?past.map(w=>{const n=(w.exercises||[]).length;return `<button class="picker-item" type="button" data-add-past="${escapeHtml(w.id)}"><span><strong>${escapeHtml(w.name||'Workout')}</strong><span>${escapeHtml(formatLogDate(w.date))} · ${n} exercise${n===1?'':'s'}</span></span><span class="picker-state">+</span></button>`;}).join(''):'<div class="dialog-empty">No past workouts yet.</div>';
          host.querySelectorAll('[data-add-past]').forEach(b=>b.addEventListener('click',()=>{
            const w=workoutState.completed.find(x=>x.id===b.dataset.addPast);if(!w)return;
            addShellToProgram({uid:newProgramWorkoutUid(),name:w.name||'Workout',sourceWorkoutId:w.id,template:{name:w.name||'Workout',exercises:templateExercisesFromCompleted(w.exercises||[])}});
          }));
          return;
        }
        const live=(workoutState.templates||[]).filter(t=>!t.archivedAt);
        host.innerHTML=live.length?live.map(t=>`<button class="picker-item" type="button" data-add-saved="${escapeHtml(t.id)}"><span><strong>${escapeHtml(t.name)} ${t.builtIn?'<span class="built-in-label">Built-in</span>':''}</strong><span>${t.exercises.length} exercise${t.exercises.length===1?'':'s'}</span></span><span class="picker-state">+</span></button>`).join(''):'<div class="dialog-empty">No saved workouts yet.</div>';
        host.querySelectorAll('[data-add-saved]').forEach(b=>b.addEventListener('click',()=>{
          const t=workoutState.templates.find(x=>x.id===b.dataset.addSaved);if(!t)return;
          /* sourceTemplateId (user 2026-09-12): the shell is a copy, but it
             remembers which template it came from so the saved list can show
             "in program" chips — and a template may live in many programs. */
          addShellToProgram({uid:newProgramWorkoutUid(),name:t.name,sourceTemplateId:t.id,template:{name:t.name,exercises:cloneTemplateExercises(t.exercises||[])}});
        }));
      };
      $('#addToProgramTabSaved').onclick=()=>{addToProgramTab='saved';renderList();};
      $('#addToProgramTabPast').onclick=()=>{addToProgramTab='past';renderList();};
      renderList();
      $('#addSavedToProgramDialog').showModal();
    }

    function createProgram() {
      const name = $('#programName').value.trim();
      const length = Number($('#programLength').value);
      const startWeek = Number($('#programStartWeek').value);
      if (!name || !Number.isInteger(length) || length < 1 || length > 52 || !Number.isInteger(startWeek) || startWeek < 1 || startWeek > length) {
        $('#programError').textContent = 'Add a program name, a length from 1 to 52 weeks, and a start week within that range.';
        return;
      }
      const progression=cloneProgression(programFormProgression());
      if($('#createProgram').dataset.editing==='true'&&workoutState.activeProgram){Object.assign(workoutState.activeProgram,{name,length,startWeek,focus:$('#programFocus').value.trim(),progression});delete $('#createProgram').dataset.editing;$('#createProgram').textContent='Create active program';$('#programSetupTitle').textContent='Create your active program.';}
      else workoutState.activeProgram = {id:newProgramId(), name, length, startWeek, focus:$('#programFocus').value.trim(), workouts:[], startedAt:localIsoDate(), progression};
      programDraftProgression=null;programEditSnapshot=null;
      $('#programError').textContent = '';
      schedulePersist(); renderProgram();renderDashboard();
    }
    function editActiveProgram(){
      const program=workoutState.activeProgram;if(!program)return;
      state.programWorkoutUid=null;
      $('#programName').value=program.name;$('#programLength').value=program.length;$('#programStartWeek').max=String(program.length);$('#programStartWeek').value=String(Math.max(1,Math.min(program.length,Number(program.startWeek)||1)));$('#programFocus').value=program.focus||'';
      seedProgramForm(program);
      $('#createProgram').dataset.editing='true';$('#createProgram').textContent='Save program changes';$('#programSetupTitle').textContent='Edit your active program.';$('#programSetup').hidden=false;$('#programCover').hidden=true;$('#programSetup').scrollIntoView({behavior:'smooth',block:'start'});
      /* Snapshot for the discard-changes modal (user 2026-09-12): taken after
         seeding so the form and the draft agree. */
      programEditSnapshot=JSON.stringify({name:program.name,length:program.length,startWeek:program.startWeek,focus:program.focus||'',progression:programFormProgression()});
      updateTopBar('program');
    }
    /* The setup form is dirty when any field differs from the edit snapshot. */
    function programFormDirty(){
      if($('#createProgram')?.dataset.editing!=='true'||!programEditSnapshot)return false;
      const cur={name:$('#programName').value,length:Number($('#programLength').value),startWeek:Number($('#programStartWeek').value),focus:$('#programFocus').value,progression:programFormProgression()};
      return JSON.stringify(cur)!==programEditSnapshot;
    }
    function cancelProgramEdit(){
      programEditSnapshot=null;
      delete $('#createProgram').dataset.editing;$('#createProgram').textContent='Create active program';$('#programSetupTitle').textContent='Create your active program.';
      renderProgram();
    }
    function requestCancelProgramEdit(){
      if(programFormDirty())$('#discardProgramChangesDialog').showModal();
      else cancelProgramEdit();
    }

    

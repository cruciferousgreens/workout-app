
    /** Manages reusable workouts, active programs, built-in templates, and archived program history. */
    const REP_PRESETS={strength:{label:'Strength',min:1,max:5},hypertrophy:{label:'Hypertrophy',min:6,max:12},endurance:{label:'Endurance',min:12,max:20},open:{label:'15+',min:15,max:20,openTop:true},amrap:{label:'AMRAP',min:1,max:1,amrap:true}};
    function applyRepPreset(key,target=progressionSetup){const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;target.defaultRange={preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};if(target===progressionSetup){$('#programRepMin').value=preset.min;$('#programRepMax').value=preset.max;document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===key)));}}
    function renderWeekRanges(){
      const panel=$('#undulatingPanel'),list=$('#weekRangeList'),length=Math.max(1,Math.min(52,Number($('#programLength').value)||8));
      const startWeekInput=$('#programStartWeek');if(startWeekInput){startWeekInput.max=String(length);startWeekInput.value=String(Math.max(1,Math.min(length,Number(startWeekInput.value)||1)));}
      panel.hidden=!progressionSetup.undulating;if(panel.hidden)return;
      while(progressionSetup.weeklyRanges.length<length)progressionSetup.weeklyRanges.push(progressionSetup.weeklyRanges.length%3===0?'strength':progressionSetup.weeklyRanges.length%3===1?'hypertrophy':'endurance');
      progressionSetup.weeklyRanges=progressionSetup.weeklyRanges.slice(0,length);
      list.innerHTML=progressionSetup.weeklyRanges.map((preset,index)=>`<label class="week-range-row"><strong>Week ${index+1}</strong><select data-week-range="${index}">${Object.entries(REP_PRESETS).map(([key,value])=>`<option value="${key}" ${key===preset?'selected':''}>${value.label} · ${value.amrap?'AMRAP':value.openTop?'15+':`${value.min}–${value.max}`}</option>`).join('')}</select></label>`).join('');
      document.querySelectorAll('[data-week-range]').forEach(select=>select.addEventListener('change',()=>{progressionSetup.weeklyRanges[Number(select.dataset.weekRange)]=select.value;}));
    }
    function programRangeForWeek(program,week){const progression=program?.progression||progressionSetup;if(!progression.undulating)return progression.defaultRange||progressionSetup.defaultRange;const key=progression.weeklyRanges?.[Math.max(0,week-1)]||progression.defaultRange?.preset||'hypertrophy';const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;return {preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};}
    function programMuscles(program){const counts={};(program.workouts||[]).forEach(workout=>(workout.template?.exercises||[]).forEach(item=>{const ex=exercises.find(row=>row.id===item.exerciseId);[...(ex?.primary||[]),...(ex?.secondary||[])].forEach(m=>counts[m]=(counts[m]||0)+1);}));return Object.entries(counts).sort((a,b)=>b[1]-a[1]);}
    let pendingRepeatWorkout=null;
    function repeatWorkout(workout,confirmed=false){if(!workout)return;if(workoutState.draft&&!confirmed){pendingRepeatWorkout=workout;$('#replaceDraftDialog').showModal();return;}showWorkouts();workoutState.draft={name:workout.name,date:localIsoDate(),programId:null,programWorkoutUid:null,editingId:null,exercises:workout.exercises.map(item=>({uid:uid('exercise'),exerciseId:item.exerciseId,tracking:item.tracking||'reps',note:item.note||'',noteOpen:false,exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,progression:item.progression||null,sets:item.sets.map(set=>({uid:uid('set'),w:'',r:set.r==null?'':String(set.r),seconds:set.seconds==null?'':String(set.seconds),rpe:'',tags:[...(set.tags||[])],complete:false}))}))};prepareDraftProgression(workoutState.draft,{...progressionSetup,stallDetection:false});schedulePersist();renderWorkoutScreen();}
    function templateExercisesFromCompleted(workout) {
      return workout.exercises.map(item=>({exerciseId:item.exerciseId,tracking:item.tracking||'reps',note:item.note||'',exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,progression:item.progression?{...item.progression}:null,sets:item.sets.map(set=>({w:set.w==null?'':String(set.w),r:set.r==null?'':String(set.r),seconds:set.seconds==null?'':String(set.seconds),rpe:set.rpe==null?'':String(set.rpe),tags:[...(set.tags||[])],complete:false}))}));
    }
    function saveCompletedAsTemplate(workout,statusEl) {
      if(!workout?.exercises?.length)return;
      const template={id:uid('template'),name:workout.name||'Workout template',exercises:templateExercisesFromCompleted(workout)};
      workoutState.templates.unshift(template); schedulePersist();
      const message=`Saved “${template.name}” as a template.`;
      if(statusEl)statusEl.textContent=message; showToast(message);
    }
    function addCompletedWorkoutToProgram(workout,statusEl) {
      if(!workout?.exercises?.length)return;
      if(!workoutState.activeProgram){if(statusEl)statusEl.textContent='Create an active program first.';return;}
      workoutState.activeProgram.workouts.push({uid:uid('program-workout'),name:workout.name,template:{name:workout.name,exercises:templateExercisesFromCompleted(workout)}});
      schedulePersist(); renderProgram(); renderDashboard();
      const message=`Added “${workout.name}” to ${workoutState.activeProgram.name}.`;
      if(statusEl)statusEl.textContent=message; showToast(message);
    }
    function startWorkoutFromTemplate(id) {
      const t=workoutState.templates.find(x=>x.id===id);if(!t)return;
      workoutState.draft={name:t.name,date:localIsoDate(),programId:null,programWorkoutUid:null,editingId:null,exercises:t.exercises.map(x=>({uid:uid('exercise'),exerciseId:x.exerciseId,tracking:x.tracking||x.progression?.mode||'reps',note:x.note||'',noteOpen:!!x.note,exerciseTags:[...(x.exerciseTags||[])],supersetId:x.supersetId||null,progression:x.progression?{...x.progression}:null,sets:x.sets.map(set=>({uid:uid('set'),w:'',r:set.r??'',seconds:set.seconds??'',rpe:set.rpe??'',tags:[...(set.tags||[])],complete:false}))}))};
      prepareDraftProgression(workoutState.draft,{...progressionSetup,stallDetection:false});schedulePersist();renderWorkoutScreen();
    }
    function renderWorkoutTemplateList() {
      const host=$('#workoutTemplateList');if(!host)return;
      host.innerHTML=workoutState.templates.length?`<div class="picker-list">${workoutState.templates.map(t=>`<button class="picker-item start-template" type="button" data-template-id="${escapeHtml(t.id)}"><span><strong>${escapeHtml(t.name)} ${t.builtIn?'<span class="built-in-label">Built-in</span>':''}</strong><span>${t.exercises.length} exercise${t.exercises.length===1?'':'s'}</span></span><span class="picker-state">›</span></button>`).join('')}</div>`:'<div class="dialog-empty"><strong>No templates yet.</strong><br>Build a workout, then choose Save as template.</div>';
      host.querySelectorAll('.start-template').forEach(b=>b.addEventListener('click',()=>startWorkoutFromTemplate(b.dataset.templateId)));
    }
    function activateBuiltInProgram(id) {
      if(workoutState.activeProgram)return;
      const source=builtInPrograms.find(program=>program.id===id); if(!source)return;
      workoutState.activeProgram={
        id:uid('program'),name:source.name,length:source.length,startWeek:1,focus:source.focus,schedule:source.schedule,startedAt:localIsoDate(),builtInSource:source.id,
        progression:{...source.progression,defaultRange:{...(source.progression.defaultRange||progressionSetup.defaultRange)},weeklyRanges:[...(source.progression.weeklyRanges||[])]},
        workouts:source.workouts.map(workout=>({uid:uid('program-workout'),name:workout.name,template:{name:workout.name,exercises:cloneTemplateExercises(workout.template.exercises)}}))
      };
      schedulePersist(); renderProgram();renderDashboard();
    }

    function programWeekAtDate(program,date=new Date()) {
      const start=new Date(`${program.startedAt||localIsoDate()}T12:00:00`), point=typeof date==='string'?new Date(`${date}T12:00:00`):date;
      const elapsed=Math.max(0,Math.floor((point-start)/604800000));
      return Math.max(1,Math.min(program.length,Math.max(1,Number(program.startWeek)||1)+elapsed));
    }
    function programWeek(program) { return programWeekAtDate(program,new Date()); }
    function programRangeLabel(range) {
      if(range?.amrap)return `AMRAP from ${range.min||1} reps`;
      if(range?.openTop)return `${range.min||15}+ reps`;
      return `${range?.min||1}–${range?.max||range?.min||1} reps`;
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
        const logs=workoutState.completed.filter(workout=>workout.programId===program.id).sort((a,b)=>b.date.localeCompare(a.date));
        return `<div class="archive-row-wrap"><div class="archive-row"><div><strong>${escapeHtml(program.name)}</strong><br><span>${program.length} weeks · ${logs.length} logged workout${logs.length===1?'':'s'} · archived ${escapeHtml(formatLogDate(program.archivedAt))}</span></div><button class="small-button restore-program" type="button" data-program-id="${escapeHtml(program.id)}">Restore</button></div><details class="archive-history"><summary>View program history${logs.length?` · ${logs.length} sessions`:''}</summary><div class="archive-history-list">${logs.length?logs.map(workout=>`<button class="archive-workout" type="button" data-archived-workout="${escapeHtml(workout.id)}"><strong>${escapeHtml(workout.name)}</strong><span>${escapeHtml(formatLogDate(workout.date))} · ${workout.exercises.reduce((sum,item)=>sum+item.sets.length,0)} sets</span></button>`).join(''):'<p class="section-note">No completed workouts are linked to this program.</p>'}</div></details></div>`;
      }).join('');
      document.querySelectorAll('.restore-program').forEach(button=>button.addEventListener('click',()=>{const index=workoutState.archivedPrograms.findIndex(p=>p.id===button.dataset.programId);if(index<0)return;const restored=workoutState.archivedPrograms.splice(index,1)[0];if(workoutState.activeProgram&&workoutState.activeProgram.id!==restored.id){workoutState.activeProgram.archivedAt=localIsoDate();workoutState.archivedPrograms.unshift(workoutState.activeProgram);}workoutState.activeProgram=restored;delete workoutState.activeProgram.archivedAt;schedulePersist();renderProgram();renderDashboard();}));
      document.querySelectorAll('[data-archived-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=workoutState.completed.find(row=>row.id===button.dataset.archivedWorkout);if(!workout)return;state.workoutDetailReturn='program';showWorkouts();renderCompletedWorkout(workout);}));
    }
    function startProgramWorkout(program, workout) {
      if(!workout.template?.exercises?.length){openProgramWorkoutBuilder(program,workout);return;}
      const inheritedRange=programRangeForWeek(program,programWeek(program));
      showWorkouts();
      workoutState.draft={name:workout.name,date:localIsoDate(),programId:program.id,programWorkoutUid:workout.uid,editingId:null,exercises:workout.template.exercises.map(x=>{
        const base=x.progression||{};
        const hasExerciseRange=base.min!=null||base.max!=null||base.openTop!=null||base.amrap!=null;
        const progression={
          mode:base.mode||x.tracking||'reps',
          min:base.min??inheritedRange.min,
          max:base.max??inheritedRange.max,
          openTop:base.openTop??(hasExerciseRange?false:!!inheritedRange.openTop),
          amrap:base.amrap??(hasExerciseRange?false:!!inheritedRange.amrap),
          ...base
        };
        return{uid:uid('exercise'),exerciseId:x.exerciseId,tracking:x.tracking||progression.mode||'reps',note:x.note||'',noteOpen:!!x.note,exerciseTags:[...(x.exerciseTags||[])],supersetId:x.supersetId||null,progression,sets:(x.sets?.length?x.sets:[{w:'',r:'',seconds:'',rpe:'',tags:[]}]).map(set=>({uid:uid('set'),w:'',r:(x.tracking||progression.mode||'reps')==='time'?'':String(progression.min||''),seconds:set.seconds??'',rpe:set.rpe??'',tags:[...(set.tags||[])],complete:false}))};
      })};
      const progressionContext={...program.progression,currentWeek:programWeek(program)};
      prepareDraftProgression(workoutState.draft,progressionContext);
      workoutState.draft.progressionSuggestions.forEach(suggestion=>applyProgressionSuggestion(workoutState.draft,suggestion,false));
      // Exercises with no completed history get the program rep/time range as a ghosted
      // hint rather than a prefilled value.
      workoutState.draft.exercises.forEach(item=>{
        if(item.suggestedTarget)return;
        const profile=item.progression||{}, isTime=item.tracking==='time';
        const hint=isTime?String(profile.timeMin??''):String(profile.min??'');
        if(!hint)return;
        item.suggestedTarget={w:'',r:isTime?'':hint,seconds:isTime?hint:''};
        item.sets.forEach(set=>{set.r='';set.seconds='';});
      });
      schedulePersist();
      workoutState.draft.autoAppliedProgression=workoutState.draft.progressionSuggestions.length>0;
      renderWorkoutScreen();
    }
    function renderProgram() {
      const program = workoutState.activeProgram;
      $('#programSetup').hidden = !!program;
      $('#programCover').hidden = !program;
      renderArchivedPrograms();
      if (!program) return;
      const week=programWeek(program), completedThisWeek=workoutState.completed.filter(w=>w.programId===program.id&&programWeekAtDate(program,w.date)===week).length;
      const muscleRows=programMuscles(program),muscleMax=Math.max(1,...muscleRows.map(([,count])=>count));
      $('#programCover').innerHTML = `<div class="program-cover-head"><div class="program-cover-kicker">ACTIVE PROGRAM · WEEK ${week} OF ${program.length}</div><h2>${escapeHtml(program.name)}</h2><p class="program-cover-meta">${escapeHtml(program.focus || 'No focus note added.')}${program.schedule?`<br>${escapeHtml(program.schedule)} · three sessions per week`:''}</p><button class="program-cover-edit" id="editProgramTop" type="button">Edit program</button></div><div class="program-body">${program.notice?`<p class="program-notice">${escapeHtml(program.notice)}</p>`:''}<div class="program-progress"><span>${program.workouts.length} workout${program.workouts.length === 1 ? '' : 's'} in rotation</span><span>${completedThisWeek} completed this week</span></div><div class="week-progress" style="--program-weeks:${program.length}" aria-label="Week ${week} of ${program.length}">${Array.from({length:program.length},(_,i)=>`<span class="week-segment ${i+1<week?'past':i+1===week?'current':''}"></span>`).join('')}</div><div class="program-cover-actions"><button class="secondary-button" id="editProgram" type="button">Edit program</button></div><section class="program-muscles"><h3>Muscles in this program</h3>${muscleRows.length?`<div class="program-muscle-bars">${muscleRows.slice(0,8).map(([muscle,count])=>`<div class="program-muscle-bar"><span>${escapeHtml(titleCase(muscle))}</span><i style="--fill:${Math.max(8,count/muscleMax*100)}%"></i></div>`).join('')}</div>`:'<p class="section-note">Add exercises to a program workout to see its muscle coverage.</p>'}</section><div class="program-progression-summary"><h3>Progression engine</h3><div class="program-progression-meta"><span class="tag primary">Top set ≤ RPE ${program.progression?.threshold??8}</span><span class="tag">${program.progression?.incrementType==='percent'?(program.progression.incrementValue+'%'):(program.progression?.incrementValue??5)+' lb'} default jump</span><span class="tag">Auto-applied on start</span><span class="tag">Stall detector ${program.progression?.stallDetection===false?'off':'on'}</span><span class="tag">${escapeHtml(titleCase(program.progression?.defaultRange?.preset||'hypertrophy'))} · ${program.progression?.defaultRange?.amrap?'AMRAP':program.progression?.defaultRange?.openTop?'15+':`${program.progression?.defaultRange?.min||6}–${program.progression?.defaultRange?.max||12}`}</span>${program.progression?.undulating?'<span class="tag primary">Varies by week</span>':''}</div></div><div class="section-head"><h2>Workouts</h2><p class="section-note">Choose any workout, in any order</p></div><div class="program-workouts" id="programWorkouts">${program.workouts.length ? program.workouts.map((workout,index) => {const count=workoutState.completed.filter(w=>w.programId===program.id&&w.programWorkoutUid===workout.uid).length,exerciseCount=workout.template?.exercises?.length||0;return `<div class="swipe-item program-swipe"><button class="swipe-delete-action delete-program-workout" type="button" data-uid="${escapeHtml(workout.uid)}" aria-label="Remove ${escapeHtml(workout.name)}">Delete</button><div class="program-workout swipe-content"><span class="program-workout-index">${index + 1}</span><div><strong>${escapeHtml(workout.name)}</strong><span>${exerciseCount?`${exerciseCount} exercise${exerciseCount===1?'':'s'}${count?` · ${count} completed`:''}`:'Empty shell · add exercises to start'}</span></div><div class="program-row-actions"><button class="setup-program-row" type="button" data-build-program-workout="${escapeHtml(workout.uid)}">${exerciseCount?'Edit':'Add exercises'}</button>${exerciseCount?`<button class="start-program-row" type="button" data-start-program-workout="${escapeHtml(workout.uid)}">Start</button>`:''}</div></div></div>`;}).join('') : '<div class="history-empty">No workouts yet. Add the first one below.</div>'}</div><div class="program-add"><label class="sr-only" for="newProgramWorkout">Workout name</label><input id="newProgramWorkout" type="text" autocomplete="off" placeholder="Add a workout name"><button class="secondary-button" id="addProgramWorkout" type="button">Add workout</button></div><div class="program-actions"><button class="secondary-button" id="endProgram" type="button">Archive program</button></div><p class="session-note">Workout order is flexible. Week progress begins at your chosen start week, then advances with calendar time.</p></div>`;
      $('#editProgram')?.addEventListener('click',editActiveProgram);
      $('#editProgramTop')?.addEventListener('click',editActiveProgram);
      document.querySelectorAll('.delete-program-workout').forEach(button => button.addEventListener('click', () => {program.workouts=program.workouts.filter(workout=>workout.uid!==button.dataset.uid);schedulePersist();renderProgram();}));
      document.querySelectorAll('[data-start-program-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=program.workouts.find(w=>w.uid===button.dataset.startProgramWorkout);if(workout)startProgramWorkout(program,workout);}));
      document.querySelectorAll('[data-build-program-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=program.workouts.find(w=>w.uid===button.dataset.buildProgramWorkout);if(workout)openProgramWorkoutBuilder(program,workout);}));
      $('#addProgramWorkout').addEventListener('click', addProgramWorkout);
      $('#newProgramWorkout').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addProgramWorkout(); } });
      $('#endProgram').addEventListener('click', () => {program.archivedAt=localIsoDate();workoutState.archivedPrograms.unshift(program);workoutState.activeProgram=null;$('#programName').value='';$('#programStartWeek').value='1';$('#programFocus').value='';schedulePersist();renderProgram();renderDashboard();});
      attachSwipeDelete($('#programWorkouts'));
    }

    function addProgramWorkout() {
      const input = $('#newProgramWorkout');
      const name = input.value.trim();
      if (!name || !workoutState.activeProgram) return;
      const shell={uid:uid('program-workout'), name};
      workoutState.activeProgram.workouts.push(shell);
      schedulePersist(); renderProgram();
      requestAnimationFrame(() => openProgramWorkoutBuilder(workoutState.activeProgram,shell));
    }

    function createProgram() {
      const name = $('#programName').value.trim();
      const length = Number($('#programLength').value);
      const startWeek = Number($('#programStartWeek').value);
      if (!name || !Number.isInteger(length) || length < 1 || length > 52 || !Number.isInteger(startWeek) || startWeek < 1 || startWeek > length) {
        $('#programError').textContent = 'Add a program name, a length from 1 to 52 weeks, and a start week within that range.';
        return;
      }
      const progression={...progressionSetup,defaultRange:{...progressionSetup.defaultRange},weeklyRanges:[...progressionSetup.weeklyRanges]};
      if($('#createProgram').dataset.editing==='true'&&workoutState.activeProgram){Object.assign(workoutState.activeProgram,{name,length,startWeek,focus:$('#programFocus').value.trim(),progression});delete $('#createProgram').dataset.editing;$('#createProgram').textContent='Create active program';}
      else workoutState.activeProgram = {id:uid('program'), name, length, startWeek, focus:$('#programFocus').value.trim(), workouts:[], startedAt:localIsoDate(), progression};
      $('#programError').textContent = '';
      schedulePersist(); renderProgram();renderDashboard();
    }
    function editActiveProgram(){
      const program=workoutState.activeProgram;if(!program)return;
      Object.assign(progressionSetup,{...program.progression,defaultRange:{...(program.progression?.defaultRange||progressionSetup.defaultRange)},weeklyRanges:[...(program.progression?.weeklyRanges||[])]});
      $('#programName').value=program.name;$('#programLength').value=program.length;$('#programStartWeek').max=String(program.length);$('#programStartWeek').value=String(Math.max(1,Math.min(program.length,Number(program.startWeek)||1)));$('#programFocus').value=program.focus||'';$('#progressionThreshold').value=program.progression?.threshold??8;$('#progressionIncrementType').value=program.progression?.incrementType||'lb';$('#progressionIncrementValue').value=program.progression?.incrementValue??5;$('#programTimeStep').value=program.progression?.timeStep??5;
      applyRepPreset(progressionSetup.defaultRange.preset||'hypertrophy',progressionSetup);$('#programRepMin').value=progressionSetup.defaultRange.min;$('#programRepMax').value=progressionSetup.defaultRange.max;
      $('#undulatingToggle').setAttribute('aria-pressed',String(!!progressionSetup.undulating));renderWeekRanges();$('#stallDetectorToggle').setAttribute('aria-pressed',String(progressionSetup.stallDetection!==false));
      $('#programSetup').hidden=false;$('#createProgram').dataset.editing='true';$('#createProgram').textContent='Save program changes';$('#programSetup').scrollIntoView({behavior:'smooth',block:'start'});
    }

    
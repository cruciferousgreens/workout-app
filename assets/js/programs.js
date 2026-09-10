
    /** Manages reusable workouts, active programs, built-in templates, and archived program history. */
    const REP_PRESETS={strength:{label:'Strength',min:1,max:5},hypertrophy:{label:'Hypertrophy',min:6,max:12},endurance:{label:'Endurance',min:12,max:20},open:{label:'15+',min:15,max:20,openTop:true},amrap:{label:'AMRAP',min:1,max:1,amrap:true}};
    function applyRepPreset(key,target=progressionSetup){const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;target.defaultRange={preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};if(target===progressionSetup){$('#programRepMin').value=preset.min;$('#programRepMax').value=preset.max;document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===key)));}}
    function renderWeekRanges(){
      const panel=$('#undulatingPanel'),list=$('#weekRangeList'),length=Math.max(1,Math.min(52,Number($('#programLength').value)||8));panel.hidden=!progressionSetup.undulating;if(panel.hidden)return;
      while(progressionSetup.weeklyRanges.length<length)progressionSetup.weeklyRanges.push(progressionSetup.weeklyRanges.length%3===0?'strength':progressionSetup.weeklyRanges.length%3===1?'hypertrophy':'endurance');
      progressionSetup.weeklyRanges=progressionSetup.weeklyRanges.slice(0,length);
      list.innerHTML=progressionSetup.weeklyRanges.map((preset,index)=>`<label class="week-range-row"><strong>Week ${index+1}</strong><select data-week-range="${index}">${Object.entries(REP_PRESETS).map(([key,value])=>`<option value="${key}" ${key===preset?'selected':''}>${value.label} · ${value.amrap?'AMRAP':value.openTop?'15+':`${value.min}–${value.max}`}</option>`).join('')}</select></label>`).join('');
      document.querySelectorAll('[data-week-range]').forEach(select=>select.addEventListener('change',()=>{progressionSetup.weeklyRanges[Number(select.dataset.weekRange)]=select.value;}));
    }
    function programRangeForWeek(program,week){const progression=program?.progression||progressionSetup;if(!progression.undulating)return progression.defaultRange||progressionSetup.defaultRange;const key=progression.weeklyRanges?.[Math.max(0,week-1)]||progression.defaultRange?.preset||'hypertrophy';const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;return {preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};}
    function programMuscles(program){const counts={};(program.workouts||[]).forEach(workout=>(workout.template?.exercises||[]).forEach(item=>{const ex=exercises.find(row=>row.id===item.exerciseId);[...(ex?.primary||[]),...(ex?.secondary||[])].forEach(m=>counts[m]=(counts[m]||0)+1);}));return Object.entries(counts).sort((a,b)=>b[1]-a[1]);}
    function repeatWorkout(workout){if(!workout)return;showWorkouts();workoutState.draft={name:workout.name,date:localIsoDate(),programId:null,programWorkoutUid:null,editingId:null,sample:false,exercises:workout.exercises.map(item=>({uid:uid('exercise'),exerciseId:item.exerciseId,tracking:item.tracking||'reps',note:item.note||'',noteOpen:false,exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,progression:item.progression||sampleProgressionProfiles[item.exerciseId]||null,sets:item.sets.map(set=>({uid:uid('set'),w:'',r:set.r==null?'':String(set.r),seconds:set.seconds==null?'':String(set.seconds),rpe:'',tags:[...(set.tags||[])],complete:false}))}))};prepareDraftProgression(workoutState.draft,{...progressionSetup,stallDetection:false});renderWorkoutScreen();}
    function saveCurrentTemplate() {
      const d=workoutState.draft; if(!d||!d.exercises.length){$('#workoutSaveStatus').textContent='Add at least one exercise first.';return;}
      const template={id:uid('template'),name:($('#workoutName').value.trim()||'Workout template'),exercises:d.exercises.map(x=>({exerciseId:x.exerciseId,tracking:exerciseTracking(x,exercises.find(ex=>ex.id===x.exerciseId)),note:x.note||'',exerciseTags:[...(x.exerciseTags||[])],supersetId:x.supersetId||null,progression:x.progression||sampleProgressionProfiles[x.exerciseId]||null,sets:x.sets.map(set=>({w:set.w,r:set.r,seconds:set.seconds,rpe:set.rpe,tags:[...(set.tags||[])],complete:false}))}))}; workoutState.templates.unshift(template); $('#workoutSaveStatus').textContent=`Saved “${template.name}” as a template.`;
    }
    function renderSavedWorkouts() {
      $('#savedWorkoutList').innerHTML=workoutState.templates.length?`<div class="picker-list">${workoutState.templates.map(t=>`<button class="picker-item start-template" type="button" data-template-id="${escapeHtml(t.id)}"><span><strong>${escapeHtml(t.name)} ${t.builtIn?'<span class="sample-label">Built-in</span>':''}</strong><span>${t.exercises.length} exercises</span></span><span class="picker-state">›</span></button>`).join('')}</div>`:'<div class="dialog-empty"><strong>No templates yet.</strong><br>Build a workout, then choose Save as template.</div>';
      document.querySelectorAll('.start-template').forEach(b=>b.addEventListener('click',()=>{const t=workoutState.templates.find(x=>x.id===b.dataset.templateId);if(!t)return; workoutState.draft={name:t.name,date:localIsoDate(),programId:null,programWorkoutUid:null,editingId:null,exercises:t.exercises.map(x=>({uid:uid('exercise'),exerciseId:x.exerciseId,tracking:x.tracking||x.progression?.mode||'reps',note:x.note||'',noteOpen:!!x.note,exerciseTags:[...(x.exerciseTags||[])],supersetId:x.supersetId||null,progression:x.progression||null,sets:x.sets.map(set=>({uid:uid('set'),w:'',r:set.r??'',seconds:set.seconds??'',rpe:set.rpe??'',tags:[...(set.tags||[])],complete:false}))}))};prepareDraftProgression(workoutState.draft,{...progressionSetup,stallDetection:false});$('#savedWorkoutDialog').close();renderWorkoutScreen();}));
    }
    function addCurrentWorkoutToProgram() {
      const d=workoutState.draft;if(!d||!d.exercises.length){$('#workoutSaveStatus').textContent='Add at least one exercise first.';return;} if(!workoutState.activeProgram){$('#workoutSaveStatus').textContent='Create an active program first.';return;} const name=$('#workoutName').value.trim()||'Workout'; workoutState.activeProgram.workouts.push({uid:uid('program-workout'),name,template:{name,exercises:d.exercises.map(x=>({exerciseId:x.exerciseId,tracking:exerciseTracking(x,exercises.find(ex=>ex.id===x.exerciseId)),note:x.note||'',exerciseTags:[...(x.exerciseTags||[])],supersetId:x.supersetId||null,progression:x.progression||sampleProgressionProfiles[x.exerciseId]||null,sets:x.sets.map(set=>({w:set.w,r:set.r,seconds:set.seconds,rpe:set.rpe,tags:[...(set.tags||[])],complete:false}))}))}}); $('#workoutSaveStatus').textContent=`Added “${name}” to ${workoutState.activeProgram.name}.`; renderProgram();renderDashboard();
    }

    function renderBuiltInPrograms() {
      const active=!!workoutState.activeProgram;
      $('#builtInProgramList').innerHTML=builtInPrograms.map(program=>`<article class="program-template-card"><div><h3>${escapeHtml(program.name)}</h3><p>${escapeHtml(program.focus)} ${escapeHtml(program.schedule)}. Three sessions per week, straight sets, and a +5 lb load step after a successful 5×5 target.</p><div class="program-template-meta"><span class="tag primary">${program.length} weeks</span><span class="tag">3 days / week</span><span class="tag">+5 lb linear progression</span></div><div class="program-template-workouts">${program.workouts.map(workout=>`<div class="program-template-workout"><strong>${escapeHtml(workout.name)}</strong> · ${workout.template.exercises.map(item=>{const ex=exercises.find(row=>row.id===item.exerciseId);return `${escapeHtml(ex?.name||item.exerciseId)} ${item.sets.length}×${item.progression?.max||5}`;}).join(' · ')}</div>`).join('')}</div></div><button class="primary-button use-built-in-program" type="button" data-built-in-program="${escapeHtml(program.id)}" ${active?'disabled':''}>${active?'Archive active program first':'Use template'}</button></article>`).join('');
      document.querySelectorAll('[data-built-in-program]').forEach(button=>button.addEventListener('click',()=>activateBuiltInProgram(button.dataset.builtInProgram)));
    }
    function activateBuiltInProgram(id) {
      if(workoutState.activeProgram)return;
      const source=builtInPrograms.find(program=>program.id===id); if(!source)return;
      workoutState.activeProgram={
        id:uid('program'),name:source.name,length:source.length,focus:source.focus,schedule:source.schedule,startedAt:localIsoDate(),builtInSource:source.id,
        progression:{...source.progression,defaultRange:{...(source.progression.defaultRange||progressionSetup.defaultRange)},weeklyRanges:[...(source.progression.weeklyRanges||[])]},
        workouts:source.workouts.map(workout=>({uid:uid('program-workout'),name:workout.name,template:{name:workout.name,exercises:cloneTemplateExercises(workout.template.exercises)}}))
      };
      renderProgram();renderDashboard();
    }

    function programWeek(program) {
      const start=new Date(`${program.startedAt||localIsoDate()}T12:00:00`), now=new Date();
      return Math.max(1,Math.min(program.length,Math.floor((now-start)/604800000)+1));
    }
    function renderArchivedPrograms() {
      const archived=workoutState.archivedPrograms;$('#archivedPrograms').hidden=!archived.length;
      $('#archivedProgramList').innerHTML=archived.map(program=>{
        const logs=workoutState.completed.filter(workout=>workout.programId===program.id).sort((a,b)=>b.date.localeCompare(a.date));
        return `<div class="archive-row-wrap"><div class="archive-row"><div><strong>${escapeHtml(program.name)} ${program.sample?'<span class="sample-label">Sample data</span>':''}</strong><br><span>${program.length} weeks · ${logs.length} logged workout${logs.length===1?'':'s'} · archived ${escapeHtml(formatLogDate(program.archivedAt))}</span></div>${program.sample?'':`<button class="small-button restore-program" type="button" data-program-id="${escapeHtml(program.id)}" ${workoutState.activeProgram?'disabled':''}>Restore</button>`}</div><details class="archive-history"><summary>View program history${logs.length?` · ${logs.length} sessions`:''}</summary><div class="archive-history-list">${logs.length?logs.map(workout=>`<button class="archive-workout" type="button" data-archived-workout="${escapeHtml(workout.id)}"><strong>${escapeHtml(workout.name)}</strong><span>${escapeHtml(formatLogDate(workout.date))} · ${workout.exercises.reduce((sum,item)=>sum+item.sets.length,0)} sets</span></button>`).join(''):'<p class="section-note">No completed workouts are linked to this program.</p>'}</div></details></div>`;
      }).join('');
      document.querySelectorAll('.restore-program').forEach(button=>button.addEventListener('click',()=>{if(workoutState.activeProgram)return;const index=workoutState.archivedPrograms.findIndex(p=>p.id===button.dataset.programId);if(index<0)return;workoutState.activeProgram=workoutState.archivedPrograms.splice(index,1)[0];delete workoutState.activeProgram.archivedAt;renderProgram();renderDashboard();}));
      document.querySelectorAll('[data-archived-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=workoutState.completed.find(row=>row.id===button.dataset.archivedWorkout);if(!workout)return;showWorkouts();renderCompletedWorkout(workout);}));
    }
    function startProgramWorkout(program, workout) {
      if(!workout.template?.exercises?.length){openProgramWorkoutBuilder(program,workout);return;}
      const inheritedRange=programRangeForWeek(program,programWeek(program));
      showWorkouts();
      workoutState.draft={name:workout.name,date:localIsoDate(),programId:program.id,programWorkoutUid:workout.uid,editingId:null,exercises:workout.template.exercises.map(x=>{const base=x.progression||sampleProgressionProfiles[x.exerciseId]||{};const progression={...base,min:inheritedRange.min,max:inheritedRange.max,openTop:!!inheritedRange.openTop,amrap:!!inheritedRange.amrap};return{uid:uid('exercise'),exerciseId:x.exerciseId,tracking:x.tracking||progression.mode||'reps',note:x.note||'',noteOpen:!!x.note,exerciseTags:[...(x.exerciseTags||[])],supersetId:x.supersetId||null,progression,sets:(x.sets?.length?x.sets:[{w:'',r:'',seconds:'',rpe:'',tags:[]}]).map(set=>({uid:uid('set'),w:'',r:set.r??(progression.mode==='time'?'':String(progression.min||'')),seconds:set.seconds??'',rpe:set.rpe??'',tags:[...(set.tags||[])],complete:false}))};})};
      prepareDraftProgression(workoutState.draft,program.progression);renderWorkoutScreen();
    }
    function renderProgram() {
      const program = workoutState.activeProgram;
      renderBuiltInPrograms();
      $('#programSetup').hidden = !!program;
      $('#programCover').hidden = !program;
      renderArchivedPrograms();
      if (!program) return;
      const week=programWeek(program), completedThisWeek=workoutState.completed.filter(w=>w.programId===program.id&&Math.max(1,Math.floor((new Date(`${w.date}T12:00:00`)-new Date(`${program.startedAt}T12:00:00`))/604800000)+1)===week).length;
      const muscleRows=programMuscles(program),muscleMax=Math.max(1,...muscleRows.map(([,count])=>count));
      $('#programCover').innerHTML = `<div class="program-cover-head"><div class="program-cover-kicker">ACTIVE PROGRAM · WEEK ${week} OF ${program.length}</div><h2>${escapeHtml(program.name)}</h2><p class="program-cover-meta">${escapeHtml(program.focus || 'No focus note added.')}${program.schedule?`<br>${escapeHtml(program.schedule)} · three sessions per week`:''}</p></div><div class="program-body">${program.notice?`<p class="program-notice">${escapeHtml(program.notice)}</p>`:''}<div class="program-progress"><span>${program.workouts.length} workout${program.workouts.length === 1 ? '' : 's'} in rotation</span><span>${completedThisWeek} completed this week</span></div><div class="week-progress" style="--program-weeks:${program.length}" aria-label="Week ${week} of ${program.length}">${Array.from({length:program.length},(_,i)=>`<span class="week-segment ${i+1<week?'past':i+1===week?'current':''}"></span>`).join('')}</div><div class="program-cover-actions"><button class="secondary-button" id="editProgram" type="button">Edit program</button></div>${muscleRows.length?`<section class="program-muscles"><h3>Muscles in this program</h3><div class="program-muscle-bars">${muscleRows.slice(0,8).map(([muscle,count])=>`<div class="program-muscle-bar"><span>${escapeHtml(titleCase(muscle))}</span><i style="--fill:${Math.max(8,count/muscleMax*100)}%"></i></div>`).join('')}</div></section>`:''}<div class="program-progression-summary"><h3>Progression engine</h3><div class="program-progression-meta"><span class="tag primary">Top set ≤ RPE ${program.progression?.threshold??8}</span><span class="tag">${program.progression?.incrementType==='percent'?(program.progression.incrementValue+'%'):(program.progression?.incrementValue??5)+' lb'} default jump</span><span class="tag">Clickable suggestions</span><span class="tag">Stall detector ${program.progression?.stallDetection===false?'off':'on'}</span><span class="tag">${escapeHtml(titleCase(program.progression?.defaultRange?.preset||'hypertrophy'))} · ${program.progression?.defaultRange?.amrap?'AMRAP':program.progression?.defaultRange?.openTop?'15+':`${program.progression?.defaultRange?.min||6}–${program.progression?.defaultRange?.max||12}`}</span>${program.progression?.undulating?'<span class="tag primary">Varies by week</span>':''}</div></div><div class="section-head"><h2>Workouts</h2><p class="section-note">Choose any workout, in any order</p></div><div class="program-workouts" id="programWorkouts">${program.workouts.length ? program.workouts.map((workout,index) => {const count=workoutState.completed.filter(w=>w.programId===program.id&&w.programWorkoutUid===workout.uid).length,exerciseCount=workout.template?.exercises?.length||0;return `<div class="swipe-item program-swipe"><button class="swipe-delete-action delete-program-workout" type="button" data-uid="${escapeHtml(workout.uid)}" aria-label="Remove ${escapeHtml(workout.name)}">Delete</button><div class="program-workout swipe-content"><span class="program-workout-index">${index + 1}</span><div><strong>${escapeHtml(workout.name)}</strong><span>${exerciseCount?`${exerciseCount} exercise${exerciseCount===1?'':'s'}${count?` · ${count} completed`:''}`:'Empty shell · add exercises to start'}</span></div><div class="program-row-actions"><button class="setup-program-row" type="button" data-build-program-workout="${escapeHtml(workout.uid)}">${exerciseCount?'Edit':'Add exercises'}</button>${exerciseCount?`<button class="start-program-row" type="button" data-start-program-workout="${escapeHtml(workout.uid)}">Start</button>`:''}</div></div></div>`;}).join('') : '<div class="history-empty">No workouts yet. Add the first one below.</div>'}</div><div class="program-add"><label class="sr-only" for="newProgramWorkout">Workout name</label><input id="newProgramWorkout" type="text" autocomplete="off" placeholder="Add a workout name"><button class="secondary-button" id="addProgramWorkout" type="button">Add workout</button></div><div class="program-actions"><button class="secondary-button" id="endProgram" type="button">Archive program</button></div><p class="session-note">Workout order is flexible. Week progress follows the program start date, not skipped sessions.</p></div>`;
      $('#editProgram')?.addEventListener('click',editActiveProgram);
      document.querySelectorAll('.delete-program-workout').forEach(button => button.addEventListener('click', () => {program.workouts=program.workouts.filter(workout=>workout.uid!==button.dataset.uid);renderProgram();}));
      document.querySelectorAll('[data-start-program-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=program.workouts.find(w=>w.uid===button.dataset.startProgramWorkout);if(workout)startProgramWorkout(program,workout);}));
      document.querySelectorAll('[data-build-program-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=program.workouts.find(w=>w.uid===button.dataset.buildProgramWorkout);if(workout)openProgramWorkoutBuilder(program,workout);}));
      $('#addProgramWorkout').addEventListener('click', addProgramWorkout);
      $('#newProgramWorkout').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addProgramWorkout(); } });
      $('#endProgram').addEventListener('click', () => {program.archivedAt=localIsoDate();workoutState.archivedPrograms.unshift(program);workoutState.activeProgram=null;$('#programName').value='';$('#programFocus').value='';renderProgram();renderDashboard();});
      attachSwipeDelete($('#programWorkouts'));
    }

    function addProgramWorkout() {
      const input = $('#newProgramWorkout');
      const name = input.value.trim();
      if (!name || !workoutState.activeProgram) return;
      const shell={uid:uid('program-workout'), name};
      workoutState.activeProgram.workouts.push(shell);
      renderProgram();
      requestAnimationFrame(() => openProgramWorkoutBuilder(workoutState.activeProgram,shell));
    }

    function createProgram() {
      const name = $('#programName').value.trim();
      const length = Number($('#programLength').value);
      if (!name || !Number.isInteger(length) || length < 1 || length > 52) {
        $('#programError').textContent = 'Add a program name and a length from 1 to 52 weeks.';
        return;
      }
      const progression={...progressionSetup,defaultRange:{...progressionSetup.defaultRange},weeklyRanges:[...progressionSetup.weeklyRanges]};
      if($('#createProgram').dataset.editing==='true'&&workoutState.activeProgram){Object.assign(workoutState.activeProgram,{name,length,focus:$('#programFocus').value.trim(),progression});delete $('#createProgram').dataset.editing;$('#createProgram').textContent='Create active program';}
      else workoutState.activeProgram = {id:uid('program'), name, length, focus:$('#programFocus').value.trim(), workouts:[], startedAt:localIsoDate(), progression};
      $('#programError').textContent = '';
      renderProgram();renderDashboard();
    }
    function editActiveProgram(){
      const program=workoutState.activeProgram;if(!program)return;
      Object.assign(progressionSetup,{...program.progression,defaultRange:{...(program.progression?.defaultRange||progressionSetup.defaultRange)},weeklyRanges:[...(program.progression?.weeklyRanges||[])]});
      $('#programName').value=program.name;$('#programLength').value=program.length;$('#programFocus').value=program.focus||'';$('#progressionThreshold').value=program.progression?.threshold??8;$('#progressionIncrementType').value=program.progression?.incrementType||'lb';$('#progressionIncrementValue').value=program.progression?.incrementValue??5;$('#programTimeStep').value=program.progression?.timeStep??5;
      applyRepPreset(progressionSetup.defaultRange.preset||'hypertrophy',progressionSetup);$('#programRepMin').value=progressionSetup.defaultRange.min;$('#programRepMax').value=progressionSetup.defaultRange.max;
      $('#undulatingToggle').setAttribute('aria-pressed',String(!!progressionSetup.undulating));renderWeekRanges();$('#stallDetectorToggle').setAttribute('aria-pressed',String(progressionSetup.stallDetection!==false));
      $('#programSetup').hidden=false;$('#createProgram').dataset.editing='true';$('#createProgram').textContent='Save program changes';$('#programSetup').scrollIntoView({behavior:'smooth',block:'start'});
    }

    
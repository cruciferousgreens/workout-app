
    /** Builds reusable workouts from the library and keeps exercise-level configuration intact. */
    function cloneTemplateExercises(rows){return (rows||[]).map(item=>({exerciseId:item.exerciseId,tracking:item.tracking||item.progression?.mode||null,note:item.note||'',exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,progression:item.progression||sampleProgressionProfiles[item.exerciseId]||null,sets:(item.sets?.length?item.sets:[{w:'',r:'',seconds:'',rpe:'',tags:[]}]).map(set=>({w:'',r:set.r??'',seconds:set.seconds??'',rpe:set.rpe??'',tags:[...(set.tags||[])],complete:false}))}));}
    function pickerProgramWorkout(){return workoutState.activeProgram?.workouts.find(row=>row.uid===workoutState.programWorkoutTarget)||null;}
    function openProgramWorkoutBuilder(program,workout){
      workoutState.pickerMode='program';workoutState.programWorkoutTarget=workout.uid;
      $('#exercisePickerTitle').textContent=`Build ${workout.name}`;
      $('#exercisePickerTitle').nextElementSibling.textContent='Add exercises from the library, or start from one of your saved templates.';
      $('#exercisePickerSearch').value='';renderExercisePicker();$('#exercisePickerDialog').showModal();
      requestAnimationFrame(()=>$('#exercisePickerSearch').focus());
    }
    function renderExercisePicker() {
      const q = normalize($('#exercisePickerSearch').value),programMode=workoutState.pickerMode==='program',programWorkout=pickerProgramWorkout();
      const collection=programMode?(programWorkout?.template?.exercises||[]):(workoutState.draft?.exercises||[]);
      const chosen = new Set(collection.map(item => item.exerciseId));
      const templateBox=$('#pickerTemplateOptions');
      templateBox.hidden=!programMode;
      const templateButtons=workoutState.templates.length?`<strong>START FROM A TEMPLATE</strong><div class="picker-template-buttons">${workoutState.templates.map(template=>`<button class="picker-template-button" type="button" data-use-program-template="${escapeHtml(template.id)}">${escapeHtml(template.name)}</button>`).join('')}</div>`:'';
      const ruleRows=programMode&&collection.length?`<details class="exercise-rules" open><summary>Sets, targets & progression</summary>${collection.map(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        const profile=item.progression||sampleProgressionProfiles[item.exerciseId]||{mode:item.tracking||ex?.tracking||'reps',min:5,max:8,timeMin:30,timeMax:60,timeStep:5,incrementType:progressionSetup.incrementType,incrementValue:progressionSetup.incrementValue,repsOnly:false};
        const time=profile.mode==='time', setCount=Math.max(1,item.sets?.length||1), incrementType=profile.incrementType||progressionSetup.incrementType||'lb';
        return `<div class="exercise-rule-row" data-program-rule-id="${escapeHtml(item.exerciseId)}">
          <div class="exercise-rule-head"><strong>${escapeHtml(ex?.name||'Exercise')}</strong><label class="rule-field set-count-field"><span>Sets</span><input type="number" inputmode="numeric" min="1" max="20" step="1" value="${setCount}" data-program-rule="setCount" aria-label="Number of sets for ${escapeHtml(ex?.name||'exercise')}"></label></div>
          <div class="exercise-rule-controls">
            <label class="rule-field"><span>Track</span><select data-program-rule="mode"><option value="reps" ${time?'':'selected'}>Reps</option><option value="time" ${time?'selected':''}>Seconds</option></select></label>
            <label class="rule-field"><span>${time?'Min sec':'Min reps'}</span><input type="number" min="1" value="${time?profile.timeMin:profile.min}" data-program-rule="${time?'timeMin':'min'}"></label>
            <label class="rule-field"><span>${time?'Max sec':'Max reps'}</span><input type="number" min="1" value="${time?profile.timeMax:profile.max}" data-program-rule="${time?'timeMax':'max'}"></label>
            <div class="load-progression ${profile.repsOnly?'is-disabled':''}"><span class="load-control-title">Load progression</span><div class="load-progression-row"><select data-program-rule="incrementType" aria-label="Load increment type"><option value="lb" ${incrementType==='lb'?'selected':''}>Pounds</option><option value="percent" ${incrementType==='percent'?'selected':''}>Percent</option></select><input type="number" min="0.5" step="0.5" value="${profile.incrementValue??progressionSetup.incrementValue}" data-program-rule="incrementValue" aria-label="Load increment value"><button class="reps-only-toggle" type="button" data-program-reps-only aria-pressed="${!!profile.repsOnly}">Increase reps only</button></div></div>
          </div>
          <div class="exercise-tags-builder"><div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-program-exercise-tags="${escapeHtml(item.exerciseId)}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div></div>
        </div>`;
      }).join('')}</details>`:'<span class="field-help">Choose exercises below, then set the number of sets, rep or time range, and load progression.</span>';
      templateBox.innerHTML=templateButtons+ruleRows;
      document.querySelectorAll('[data-use-program-template]').forEach(button=>button.addEventListener('click',()=>{const template=workoutState.templates.find(row=>row.id===button.dataset.useProgramTemplate);if(!template||!programWorkout)return;programWorkout.template={name:programWorkout.name,exercises:cloneTemplateExercises(template.exercises)};renderExercisePicker();}));
      document.querySelectorAll('[data-program-rule-id]').forEach(row=>{
        const getItem=()=>programWorkout?.template?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId);
        row.querySelectorAll('[data-program-rule]').forEach(control=>control.addEventListener('change',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:5,max:8,timeMin:30,timeMax:60,timeStep:5,incrementType:progressionSetup.incrementType,incrementValue:progressionSetup.incrementValue,repsOnly:false};
          const field=control.dataset.programRule;
          if(field==='setCount'){
            const count=Math.max(1,Math.min(20,Number(control.value)||1));
            const existing=item.sets||[];
            item.sets=Array.from({length:count},(_,index)=>existing[index]||{w:'',r:'',seconds:'',rpe:'',tags:[],complete:false});
          }else if(field==='mode'){
            profile.mode=control.value; item.tracking=control.value;
          }else if(field==='incrementType'){
            profile.incrementType=control.value;
          }else{
            profile[field]=Number(control.value);
          }
          item.progression=profile; renderExercisePicker();
        }));
        row.querySelector('[data-program-reps-only]')?.addEventListener('click',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:5,max:8,timeMin:30,timeMax:60,timeStep:5,incrementType:progressionSetup.incrementType,incrementValue:progressionSetup.incrementValue,repsOnly:false};
          profile.repsOnly=!profile.repsOnly; item.progression=profile; renderExercisePicker();
        });
        row.querySelector('[data-program-exercise-tags]')?.addEventListener('click',()=>openExerciseTagDialog({mode:'program',exerciseId:row.dataset.programRuleId}));
      });
      const matches = exercises.filter(ex => !q || normalize([ex.name, ...ex.primary, ...ex.secondary, ex.equipment].join(' ')).includes(q)).slice(0,80);
      const recentIds = q ? [] : recentExerciseIds().filter(id => matches.some(ex => ex.id === id)).slice(0,5);
      const recentSet = new Set(recentIds);
      const rows = [...recentIds.map(id => matches.find(ex => ex.id === id)), ...matches.filter(ex => !recentSet.has(ex.id))].filter(Boolean);
      $('#exercisePickerList').innerHTML = rows.length ? rows.map((ex,index) => `${index === 0 && recentIds.length ? '<div class="picker-section-label">RECENT</div>' : ''}${index === recentIds.length && recentIds.length && rows.length > recentIds.length ? '<div class="picker-section-label">ALL EXERCISES</div>' : ''}<button class="picker-item" type="button" data-id="${escapeHtml(ex.id)}" aria-pressed="${chosen.has(ex.id)}"><span><strong>${escapeHtml(ex.name)}</strong><span>${escapeHtml(ex.primary.join(', ') || 'Unspecified muscle')} · ${escapeHtml(ex.equipment || 'No equipment')}</span></span><span class="picker-state">${chosen.has(ex.id) ? '✓' : '+'}</span></button>`).join('') : '<div class="dialog-empty">No matching exercises.</div>';
      document.querySelectorAll('#exercisePickerList .picker-item').forEach(button => button.addEventListener('click', () => {
        if(programMode){
          if(!programWorkout)return;
          if(!programWorkout.template)programWorkout.template={name:programWorkout.name,exercises:[]};
          const existing=programWorkout.template.exercises.find(item=>item.exerciseId===button.dataset.id);
          if(existing)programWorkout.template.exercises=programWorkout.template.exercises.filter(item=>item.exerciseId!==button.dataset.id);
          else { const ex=exercises.find(row=>row.id===button.dataset.id); programWorkout.template.exercises.push({exerciseId:button.dataset.id,tracking:ex?.tracking||'reps',note:'',exerciseTags:[],supersetId:null,progression:sampleProgressionProfiles[button.dataset.id]?{...sampleProgressionProfiles[button.dataset.id]}:null,sets:Array.from({length:3},()=>({w:'',r:'',seconds:'',rpe:'',tags:[],complete:false}))}); }
        }else{
          const existing = workoutState.draft.exercises.find(item => item.exerciseId === button.dataset.id);
          if (existing) workoutState.draft.exercises = workoutState.draft.exercises.filter(item => item.exerciseId !== button.dataset.id);
          else { const ex=exercises.find(row=>row.id===button.dataset.id); workoutState.draft.exercises.push({uid:uid('exercise'), exerciseId:button.dataset.id, tracking:ex?.tracking||'reps', sets:[newSet()], note:'', exerciseTags:[], supersetId:null}); }
          prepareDraftProgression(workoutState.draft, workoutState.activeProgram?.id===workoutState.draft.programId?workoutState.activeProgram.progression:{...progressionSetup,stallDetection:false});
          renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        }
        renderExercisePicker();
      }));
    }

    
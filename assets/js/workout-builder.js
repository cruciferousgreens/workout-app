
    /** Builds reusable workouts from the library and keeps exercise-level configuration intact. */
    function cloneTemplateExercises(rows){return (rows||[]).map(item=>({exerciseId:item.exerciseId,tracking:item.tracking||item.progression?.mode||null,note:item.note||'',exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,progression:item.progression?{...item.progression}:null,sets:(item.sets?.length?item.sets:[{w:'',r:'',seconds:'',rpe:'',tags:[]}]).map(set=>({w:'',r:set.r??'',seconds:set.seconds??'',rpe:set.rpe??'',tags:[...(set.tags||[])],complete:false}))}));}
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
      templateBox.hidden=false;
      const templateButtons=programMode&&workoutState.templates.length?`<strong>START FROM A TEMPLATE</strong><div class="picker-template-buttons">${workoutState.templates.map(template=>`<button class="picker-template-button" type="button" data-use-program-template="${escapeHtml(template.id)}">${escapeHtml(template.name)}</button>`).join('')}</div>`:'';
      const ruleRangeSummary=(profile,time,setCount)=>`${setCount} set${setCount===1?'':'s'} · `+(time?`${profile.timeMin}–${profile.timeMax} sec`:(profile.amrap?`AMRAP from ${profile.min} reps`:profile.openTop?`${profile.min}+ reps`:`${profile.min}–${profile.max} reps`));
      const ruleRows=collection.length?`<div class="exercise-rules-list">${collection.map(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        const defaults=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup;
        const range=defaults.defaultRange||progressionSetup.defaultRange;
        const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue,repsOnly:false};
        const time=profile.mode==='time', setCount=Math.max(1,item.sets?.length||1), incrementType=profile.incrementType||progressionSetup.incrementType||'lb';
        const rangeSummary=ruleRangeSummary(profile,time,setCount);
        return `<details class="exercise-rule-accordion" data-program-rule-id="${escapeHtml(item.exerciseId)}" data-rule-uid="${escapeHtml(item.uid||'')}" open>
          <summary class="exercise-rule-accordion-head"><span class="exercise-rule-accordion-title"><strong>${escapeHtml(ex?.name||'Exercise')}</strong><small>${escapeHtml(rangeSummary)}</small></span><span class="exercise-accordion-chevron" aria-hidden="true">›</span></summary>
          <div class="exercise-rule-accordion-body"><div class="exercise-rule-row">
          <div class="exercise-rule-head"><label class="rule-field set-count-field"><span>Sets</span><input type="number" inputmode="numeric" min="1" max="20" step="1" value="${setCount}" data-program-rule="setCount" aria-label="Number of sets for ${escapeHtml(ex?.name||'exercise')}"></label></div>
          <div class="exercise-rule-controls">
            <label class="rule-field"><span>Track</span><select data-program-rule="mode"><option value="reps" ${time?'':'selected'}>Reps</option><option value="time" ${time?'selected':''}>Seconds</option></select></label>
            <label class="rule-field"><span>${time?'Min sec':'Min reps'}</span><input type="number" min="1" value="${time?profile.timeMin:profile.min}" data-program-rule="${time?'timeMin':'min'}"></label>
            <label class="rule-field"><span>${time?'Max sec':'Max reps'}</span><input type="number" min="1" value="${time?profile.timeMax:profile.max}" data-program-rule="${time?'timeMax':'max'}" ${(!time&&profile.amrap)?'disabled':''}></label>
            ${time?'':`<button class="reps-only-toggle" type="button" data-program-amrap aria-pressed="${!!profile.amrap}" aria-label="AMRAP rep target for ${escapeHtml(ex?.name||'exercise')}">AMRAP</button>`}
            ${time?`<div class="rule-field"><span>Step</span><div class="step-pills" data-step-pills role="group" aria-label="Time step in seconds"></div></div>`:''}
            <div class="load-progression ${profile.repsOnly?'is-disabled':''}"><span class="load-control-title">Load progression</span><div class="load-progression-row"><select data-program-rule="incrementType" aria-label="Load increment type"><option value="lb" ${incrementType==='lb'?'selected':''}>Pounds</option><option value="percent" ${incrementType==='percent'?'selected':''}>Percent</option></select><span class="lp-value"><input type="number" min="0.5" step="0.5" value="${profile.incrementValue??progressionSetup.incrementValue}" data-program-rule="incrementValue" aria-label="Load increment value"><em class="unit">${incrementType==='percent'?'%':'lb'}</em></span><button class="reps-only-toggle" type="button" data-program-reps-only aria-pressed="${!!profile.repsOnly}">Increase reps only</button></div></div>
          </div>
          <div class="exercise-tags-builder"><div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-program-exercise-tags="${escapeHtml(item.exerciseId)}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div></div>
        </div></div>
        </details>`;
      }).join('')}</div>`:'<span class="field-help">Choose exercises below, then set the number of sets, rep or time range, and load progression.</span>';
      templateBox.innerHTML=templateButtons+ruleRows;
      document.querySelectorAll('[data-use-program-template]').forEach(button=>button.addEventListener('click',()=>{const template=workoutState.templates.find(row=>row.id===button.dataset.useProgramTemplate);if(!template||!programWorkout)return;programWorkout.template={name:programWorkout.name,exercises:cloneTemplateExercises(template.exercises)};renderExercisePicker();}));
      document.querySelectorAll('[data-program-rule-id]').forEach(row=>{
        const getItem=()=>programMode?programWorkout?.template?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId):(workoutState.draft?.exercises.find(entry=>entry.uid===row.dataset.ruleUid)||workoutState.draft?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId));
        row.querySelectorAll('[data-program-rule]').forEach(control=>control.addEventListener('change',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const defaults=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup,range=defaults.defaultRange||progressionSetup.defaultRange;
          const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,timeMin:30,timeMax:60,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue,repsOnly:false};
          const field=control.dataset.programRule;
          if(field==='setCount'){
            const count=Math.max(1,Math.min(20,Number(control.value)||1));
            const existing=item.sets||[];
            item.sets=Array.from({length:count},(_,index)=>existing[index]||newSet());
          }else if(field==='mode'){
            profile.mode=control.value; item.tracking=control.value;
          }else if(field==='incrementType'){
            profile.incrementType=control.value;
            const unitEl=row.querySelector('.lp-value .unit');
            if(unitEl) unitEl.textContent = control.value==='percent' ? '%' : 'lb';
          }else{
            profile[field]=Number(control.value);
          }
          item.progression=profile;
          if(field==='min'||field==='max'||field==='timeMin'||field==='timeMax'){
            const small=row.querySelector('.exercise-rule-accordion-title small');
            if(small)small.textContent=ruleRangeSummary(profile,profile.mode==='time',Math.max(1,item.sets?.length||1));
          }
          if(!programMode){prepareDraftProgression(workoutState.draft,{...progressionSetup,stallDetection:false});renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
          if(field==='setCount'||field==='mode'||field==='incrementType')renderExercisePicker();
        }));
        row.querySelectorAll('[data-step-pills]').forEach(pills=>{
          const readStep=()=>{const item=getItem();return item?.progression?.timeStep||(programMode?workoutState.activeProgram?.progression?.timeStep:progressionSetup.timeStep)||5;};
          wireTimeStepPills(pills,readStep,n=>{
            const item=getItem(); if(!item)return;
            const ex=exercises.find(entry=>entry.id===item.exerciseId);
            const dflt=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup,range=dflt.defaultRange||progressionSetup.defaultRange;
            const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,timeMin:30,timeMax:60,timeStep:dflt.timeStep||5,incrementType:dflt.incrementType,incrementValue:dflt.incrementValue,repsOnly:false};
            profile.timeStep=n; item.progression=profile;
            if(!programMode){prepareDraftProgression(workoutState.draft,{...progressionSetup,stallDetection:false});renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
            else syncTimeStepPills(pills,n);
          });
        });
        row.querySelector('[data-program-reps-only]')?.addEventListener('click',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const defaults=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup,range=defaults.defaultRange||progressionSetup.defaultRange;
          const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,timeMin:30,timeMax:60,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue,repsOnly:false};
          profile.repsOnly=!profile.repsOnly; item.progression=profile; if(!programMode){renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();} renderExercisePicker();
        });
        row.querySelector('[data-program-amrap]')?.addEventListener('click',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const defaults=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup,range=defaults.defaultRange||progressionSetup.defaultRange;
          const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue,repsOnly:false};
          profile.amrap=!profile.amrap; item.progression=profile;
          if(!programMode){prepareDraftProgression(workoutState.draft,{...progressionSetup,stallDetection:false});renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
          renderExercisePicker();
        });
        row.querySelector('[data-program-exercise-tags]')?.addEventListener('click',()=>openExerciseTagDialog(programMode?{mode:'program',exerciseId:row.dataset.programRuleId}:{mode:'draft',exerciseUid:row.dataset.ruleUid}));
      });
      const matches = q ? rankedExerciseMatches($('#exercisePickerSearch').value,80) : exercises.slice(0,80);
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
          else { const ex=exercises.find(row=>row.id===button.dataset.id),program=workoutState.activeProgram,range=programRangeForWeek(program,programWeek(program)); programWorkout.template.exercises.push({exerciseId:button.dataset.id,tracking:ex?.tracking||'reps',note:'',exerciseTags:[],supersetId:null,progression:{mode:ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:program?.progression?.timeStep||5,incrementType:program?.progression?.incrementType||'lb',incrementValue:program?.progression?.incrementValue||5,repsOnly:false},sets:Array.from({length:3},()=>({w:'',r:range.amrap?'':String(range.min),seconds:'',rpe:'',tags:[],complete:false}))}); }
        }else{
          const existing = workoutState.draft.exercises.find(item => item.exerciseId === button.dataset.id);
          if (existing) workoutState.draft.exercises = workoutState.draft.exercises.filter(item => item.exerciseId !== button.dataset.id);
          else { const ex=exercises.find(row=>row.id===button.dataset.id),range=progressionSetup.defaultRange; workoutState.draft.exercises.push({uid:uid('exercise'), exerciseId:button.dataset.id, tracking:ex?.tracking||'reps', sets:Array.from({length:3},()=>newSet()), note:'', exerciseTags:[], supersetId:null, progression:{mode:ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:progressionSetup.timeStep||5,incrementType:progressionSetup.incrementType,incrementValue:progressionSetup.incrementValue,repsOnly:false}}); }
          prepareDraftProgression(workoutState.draft, workoutState.activeProgram?.id===workoutState.draft.programId?workoutState.activeProgram.progression:{...progressionSetup,stallDetection:false});
          renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        }
        renderExercisePicker();
      }));
    }

    
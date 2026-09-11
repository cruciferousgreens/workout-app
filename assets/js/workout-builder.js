
/* ===== module: workout-builder.js ===== */
    /** Builds reusable workouts from the library and keeps exercise-level configuration intact. */
    /* Picker-scoped filters: the add-exercise dialog carries the Exercises tab's
       search + filter interface (user 2026-09-10). Separate from the library's
       filters; reset every time the dialog opens. */
    const pickerFilters={muscles:new Set(),equipment:'',onlyFavorites:false,onlyCustom:false};
    function resetPickerFilters(){pickerFilters.muscles.clear();pickerFilters.equipment='';pickerFilters.onlyFavorites=false;pickerFilters.onlyCustom=false;}
    function pickerFilterMatch(x){
      const allMuscles=[...(x.primary||[]),...(x.secondary||[])];
      const muscleMatch=!pickerFilters.muscles.size||[...pickerFilters.muscles].every(m=>allMuscles.includes(m));
      const favMatch=!pickerFilters.onlyFavorites||state.favorites.has(x.id);
      const customMatch=!pickerFilters.onlyCustom||x.custom;
      return muscleMatch&&favMatch&&customMatch&&(!pickerFilters.equipment||x.equipment===pickerFilters.equipment);
    }
    function pickerFilterActive(){return pickerFilters.muscles.size>0||!!pickerFilters.equipment||pickerFilters.onlyFavorites||pickerFilters.onlyCustom;}
    /* Exercises added during this picker opening: the rules section at the
       top only shows these, never exercises already in the workout (user
       2026-09-11). Reset every time the dialog opens. */
    let pickerSessionAdded=new Set();
    function resetPickerSession(){pickerSessionAdded=new Set();}
    function populatePickerFilters(){
      const muscles=[...new Set(exercises.flatMap(x=>[...(x.primary||[]),...(x.secondary||[])]))].sort();
      const equipment=[...new Set(exercises.map(x=>x.equipment).filter(Boolean))].sort();
      $('#pickerMuscleOptions').innerHTML=muscles.map(x=>`<button class="muscle-option" type="button" data-picker-muscle="${x}" aria-pressed="false">${titleCase(x)}</button>`).join('');
      $('#pickerEquipmentFilter').innerHTML='<option value="">All equipment</option>'+equipment.map(x=>`<option value="${x}">${titleCase(x)}</option>`).join('');
      renderPickerFilterState();
    }
    function renderPickerFilterState(){
      document.querySelectorAll('#pickerMuscleOptions .muscle-option').forEach(b=>b.setAttribute('aria-pressed',String(pickerFilters.muscles.has(b.dataset.pickerMuscle))));
      $('#pickerFavoritesToggle')?.setAttribute('aria-pressed',String(pickerFilters.onlyFavorites));
      $('#pickerCustomToggle')?.setAttribute('aria-pressed',String(pickerFilters.onlyCustom));
      $('#pickerEquipmentFilter').value=pickerFilters.equipment;
      $('#pickerClearMuscles').hidden=pickerFilters.muscles.size===0;
    }
    function preparePickerFilters(){
      resetPickerFilters();
      populatePickerFilters();
      const panel=$('#pickerFilterPanel');panel.classList.remove('open');
      $('#pickerFilterToggle').setAttribute('aria-expanded','false');
    }
    function cloneTemplateExercises(rows){return (rows||[]).map(item=>({exerciseId:item.exerciseId,tracking:item.tracking||item.progression?.mode||null,note:item.note||'',exerciseTags:[...(item.exerciseTags||[])],supersetId:item.supersetId||null,progression:item.progression?{...item.progression}:null,sets:(item.sets?.length?item.sets:[{w:'',r:'',seconds:'',rpe:'',tags:[]}]).map(set=>({w:'',r:set.r??'',seconds:set.seconds??'',rpe:set.rpe??'',tags:[...(set.tags||[])],complete:false}))}));}
    function pickerProgramWorkout(){return workoutState.activeProgram?.workouts.find(row=>row.uid===workoutState.programWorkoutTarget)||null;}
    /* #74: edit a saved template in the builder. Live-mutates the template's
       exercises like program mode does (no draft involved). */
    function pickerTemplate(){return workoutState.templates.find(row=>row.id===workoutState.templateEditTarget)||null;}
    function openTemplateBuilder(template){
      workoutState.pickerMode='template';workoutState.templateEditTarget=template.id;workoutState.programWorkoutTarget=null;
      $('#exercisePickerTitle').textContent=`Edit ${template.name}`;
      $('#exercisePickerTitle').nextElementSibling.textContent='Add exercises from the library.';
      $('#exercisePickerSearch').value='';preparePickerFilters();resetPickerSession();renderExercisePicker();$('#exercisePickerDialog').showModal();
      requestAnimationFrame(()=>$('#exercisePickerSearch').focus());
    }
    function openProgramWorkoutBuilder(program,workout){
      workoutState.pickerMode='program';workoutState.programWorkoutTarget=workout.uid;
      $('#exercisePickerTitle').textContent=`Build ${workout.name}`;
      $('#exercisePickerTitle').nextElementSibling.textContent='Add exercises from the library.';
      $('#exercisePickerSearch').value='';preparePickerFilters();resetPickerSession();renderExercisePicker();$('#exercisePickerDialog').showModal();
      requestAnimationFrame(()=>$('#exercisePickerSearch').focus());
    }
    function pickerCollection(){const mode=workoutState.pickerMode;if(mode==='program')return pickerProgramWorkout()?.template?.exercises||[];if(mode==='template')return pickerTemplate()?.exercises||[];return workoutState.draft?.exercises||[];}
    // Rules section only (chosen exercises + their sets/range/load config).
    // Re-renders without touching the exercise list below, so the list's scroll
    // position and the search field's focus survive adding/removing exercises.
    // Pass a selector to restore focus after the re-render (rule field edits).
    function renderPickerRules(focusSelector) {
      const dialog=$('#exercisePickerDialog'),prevScroll=dialog?dialog.scrollTop:0;
      const programMode=workoutState.pickerMode==='program',programWorkout=pickerProgramWorkout(),templateMode=workoutState.pickerMode==='template',editTemplate=pickerTemplate();
      const collection=pickerCollection();
      const templateBox=$('#pickerTemplateOptions');
      templateBox.hidden=false;
      // Bug fix (user 2026-09-11): changing a rule control (e.g. the load
      // progression type dropdown) re-renders these rows, which collapsed
      // every open accordion. Remember which cards are open and restore them.
      const openAccordions=new Set();
      templateBox.querySelectorAll('details.exercise-rule-accordion[open]').forEach(openDetails=>{
        openAccordions.add(openDetails.dataset.ruleUid||openDetails.dataset.programRuleId);
      });
      /* #64 (user 2026-09-11): templates do NOT belong in the workout builder. Removed. */
      const templateButtons='';
      const ruleRangeSummary=(profile,time,setCount)=>`${setCount} set${setCount===1?'':'s'} · `+(time?`${profile.timeMin}–${profile.timeMax} sec`:(profile.amrap?(profile.min>1?`AMRAP from ${profile.min} reps`:'AMRAP'):(profile.openTop||profile.max==null)?`${profile.min}+ reps`:`${profile.min??''}–${profile.max??''} reps`));
      /* Top rules show only exercises added during this picker opening, never
         exercises that were already in the workout (user 2026-09-11). */
      const sessionItems=collection.filter(item=>pickerSessionAdded.has(item.exerciseId));
      const ruleRows=sessionItems.length?`<div class="exercise-rules-list">${sessionItems.map(item=>{
        const ex=exercises.find(row=>row.id===item.exerciseId);
        const defaults=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup;
        const range=defaults.defaultRange||progressionSetup.defaultRange;
        const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue,repsOnly:false};
        const time=profile.mode==='time', setCount=Math.max(1,item.sets?.length||1), incrementType=profile.incrementType||progressionSetup.incrementType||'lb';
        const rangeSummary=ruleRangeSummary(profile,time,setCount);
        const accordionOpen=openAccordions.has(item.uid||item.exerciseId);
        return `<details class="exercise-rule-accordion" ${accordionOpen?'open':''} data-program-rule-id="${escapeHtml(item.exerciseId)}" data-rule-uid="${escapeHtml(item.uid||'')}">
          <summary class="exercise-rule-accordion-head"><span class="exercise-rule-accordion-title"><strong>${escapeHtml(ex?.name||'Exercise')}</strong><small>${escapeHtml(rangeSummary)}</small></span><span class="rule-head-actions"><button class="rule-remove" type="button" data-remove-rule aria-label="Remove ${escapeHtml(ex?.name||'exercise')} from this workout">×</button><span class="exercise-accordion-chevron" aria-hidden="true">›</span></span></summary>
          <div class="exercise-rule-accordion-body"><div class="exercise-rule-row">
          <div class="exercise-rule-head"><label class="rule-field set-count-field"><span>Sets</span><input type="number" inputmode="numeric" min="1" max="20" step="1" value="${setCount}" data-program-rule="setCount" aria-label="Number of sets for ${escapeHtml(ex?.name||'exercise')}"></label></div>
          <div class="exercise-rule-controls">
            <label class="rule-field"><span>Track</span><select data-program-rule="mode"><option value="reps" ${time?'':'selected'}>Reps</option><option value="time" ${time?'selected':''}>Seconds</option></select></label>
            <label class="rule-field"><span>${time?'Min sec':'Min reps'}</span><input type="number" inputmode="numeric" min="1" value="${time?profile.timeMin:(profile.min??'')}" data-program-rule="${time?'timeMin':'min'}" ${time?'':`aria-label="Minimum reps${profile.amrap?', AMRAP with no maximum':''}"`}></label>
            <label class="rule-field"><span>${time?'Max sec':'Max reps'}</span><input type="number" inputmode="numeric" min="1" value="${time?profile.timeMax:(profile.max??'')}" data-program-rule="${time?'timeMax':'max'}" ${time?'':`placeholder="AMRAP" aria-label="Maximum reps. Leave blank for AMRAP."`}></label>
            ${time?'':'<span class="field-help rule-amrap-hint">Leave <b>Max</b> blank for AMRAP.</span>'}
            ${time?`<div class="rule-field"><span>Step</span><div class="step-pills" data-step-pills role="group" aria-label="Time step in seconds"></div></div>`:''}
            <div class="load-progression ${profile.repsOnly?'is-disabled':''}"><span class="load-control-title">Load progression</span><div class="load-progression-row"><select data-program-rule="incrementType" aria-label="Load increment type"><option value="lb" ${incrementType==='lb'?'selected':''}>${isMetric()?'Kilograms':'Pounds'}</option><option value="percent" ${incrementType==='percent'?'selected':''}>Percent</option></select><span class="lp-value"><input type="number" min="0.5" step="0.5" value="${profile.incrementValue??progressionSetup.incrementValue}" data-program-rule="incrementValue" aria-label="Load increment value"><em class="unit">${incrementType==='percent'?'%':weightUnit()}</em></span><button class="reps-only-toggle" type="button" data-program-reps-only aria-pressed="${!!profile.repsOnly}">Increase reps only</button></div></div>
          </div>
          <div class="exercise-tags-builder"><div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-program-exercise-tags="${escapeHtml(item.exerciseId)}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div></div>
        </div></div>
        </details>`;
      }).join('')}</div>`:'';
      templateBox.innerHTML=templateButtons+ruleRows;
      /* Hide the box when empty (no templates, no rules) to avoid a weird empty bar. */
      templateBox.hidden=!templateBox.innerHTML.trim();
      document.querySelectorAll('[data-use-program-template]').forEach(button=>button.addEventListener('click',()=>{const template=workoutState.templates.find(row=>row.id===button.dataset.useProgramTemplate);if(!template||!programWorkout)return;programWorkout.template={name:programWorkout.name,exercises:cloneTemplateExercises(template.exercises)};programWorkout.template.exercises.forEach(item=>pickerSessionAdded.add(item.exerciseId));renderPickerRules();}));
      document.querySelectorAll('[data-program-rule-id]').forEach(row=>{
        const getItem=()=>{
          if(programMode)return programWorkout?.template?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId);
          if(templateMode)return editTemplate?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId);
          return workoutState.draft?.exercises.find(entry=>entry.uid===row.dataset.ruleUid)||workoutState.draft?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId);
        };
        /* × on a chosen exercise removes it outright, so an accidental tap in
           the list below doesn't require hunting the row down again. */
        row.querySelector('[data-remove-rule]')?.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          const item=getItem();if(!item)return;
          pickerSessionAdded.delete(item.exerciseId);
          if(programMode){if(programWorkout?.template)programWorkout.template.exercises=programWorkout.template.exercises.filter(entry=>entry.exerciseId!==item.exerciseId);}
          else if(templateMode){if(editTemplate)editTemplate.exercises=editTemplate.exercises.filter(entry=>entry.exerciseId!==item.exerciseId);schedulePersist();renderWorkoutTemplateList();}
          else{workoutState.draft.exercises=workoutState.draft.exercises.filter(entry=>entry.uid!==item.uid);prepareDraftProgression(workoutState.draft,freeformProgressionConfig());renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
          renderPickerRules();renderPickerList();
        });
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
            if(unitEl) unitEl.textContent = control.value==='percent' ? '%' : weightUnit();
          }else if(field==='min'||field==='max'){
            // Reps mode only (time mode uses timeMin/timeMax). A blank Max means
            // AMRAP: no upper rep bound, so AMRAP and open-ended are exclusive.
            // Min always keeps a numeric floor (blank → 1).
            const raw=String(control.value).trim();
            const num=raw===''?null:Math.max(1,parseInt(raw,10)||1);
            if(field==='min'){profile.min=num??1;}
            else{profile.max=num;profile.amrap=num==null;if(profile.amrap)profile.openTop=false;}
          }else{
            profile[field]=Number(control.value);
          }
          // Zone-defining fields mark the range as explicitly chosen, so the
          // freestyle engine follows it instead of the lifter's last zone.
          if(field==='mode'||field==='min'||field==='max'||field==='timeMin'||field==='timeMax')profile.custom=true;
          item.progression=profile;
          if(field==='min'||field==='max'||field==='timeMin'||field==='timeMax'){
            const small=row.querySelector('.exercise-rule-accordion-title small');
            if(small)small.textContent=ruleRangeSummary(profile,profile.mode==='time',Math.max(1,item.sets?.length||1));
          }
          if(templateMode){schedulePersist();}else if(!programMode){prepareDraftProgression(workoutState.draft,freeformProgressionConfig());renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
          if(field==='setCount'||field==='mode'||field==='incrementType'){
            // Rules-only re-render keeps the exercise list's scroll; restore
            // focus to the edited control so keyboard/VO users don't lose place.
            const key=row.dataset.ruleUid?`[data-rule-uid="${CSS.escape(row.dataset.ruleUid)}"]`:`[data-program-rule-id="${CSS.escape(row.dataset.programRuleId)}"]`;
            renderPickerRules(`${key} [data-program-rule="${field}"]`);
          }
        }));
        row.querySelectorAll('[data-step-pills]').forEach(pills=>{
          const readStep=()=>{const item=getItem();return item?.progression?.timeStep||(programMode?workoutState.activeProgram?.progression?.timeStep:progressionSetup.timeStep)||5;};
          wireTimeStepPills(pills,readStep,n=>{
            const item=getItem(); if(!item)return;
            const ex=exercises.find(entry=>entry.id===item.exerciseId);
            const dflt=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup,range=dflt.defaultRange||progressionSetup.defaultRange;
            const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,timeMin:30,timeMax:60,timeStep:dflt.timeStep||5,incrementType:dflt.incrementType,incrementValue:dflt.incrementValue,repsOnly:false};
            profile.timeStep=n; item.progression=profile;
            if(templateMode){schedulePersist();}else if(!programMode){prepareDraftProgression(workoutState.draft,freeformProgressionConfig());renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
            else syncTimeStepPills(pills,n);
          });
        });
        row.querySelector('[data-program-reps-only]')?.addEventListener('click',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const defaults=(programMode?workoutState.activeProgram?.progression:progressionSetup)||progressionSetup,range=defaults.defaultRange||progressionSetup.defaultRange;
          const profile=item.progression||{mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,timeMin:30,timeMax:60,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue,repsOnly:false};
          profile.repsOnly=!profile.repsOnly; item.progression=profile; if(templateMode){schedulePersist();}else if(!programMode){renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();} renderPickerRules();
        });
        row.querySelector('[data-program-exercise-tags]')?.addEventListener('click',()=>openExerciseTagDialog(programMode?{mode:'program',exerciseId:row.dataset.programRuleId}:templateMode?{mode:'template',exerciseId:row.dataset.programRuleId}:{mode:'draft',exerciseUid:row.dataset.ruleUid}));
      });
      if(dialog)dialog.scrollTop=prevScroll;
      if(focusSelector){const el=document.querySelector(focusSelector);if(el)el.focus({preventScroll:true});}
    }
    // Exercise list only. Re-rendered on search typing and dialog open; the
    // toggle handler updates rows in place instead, so scrolling the list to
    // tap exercises no longer jumps back to the top on every tap.
    function renderPickerList() {
      const list=$('#exercisePickerList'),prevScroll=list?list.scrollTop:0;
      const programMode=workoutState.pickerMode==='program',programWorkout=pickerProgramWorkout(),templateMode=workoutState.pickerMode==='template',editTemplate=pickerTemplate();
      const q=normalize($('#exercisePickerSearch').value);
      const collection=pickerCollection();
      const chosen=new Set(collection.map(item=>item.exerciseId));
      const matches = q ? rankedExerciseMatches($('#exercisePickerSearch').value,exercises.length).filter(pickerFilterMatch).slice(0,80) : exercises.filter(pickerFilterMatch).slice(0,80);
      /* Recents first, favorites pinned to the top of recents (user 2026-09-10). Skipped while searching or filtering. */
      const recentIds = (q||pickerFilterActive()) ? [] : recentExerciseIds().filter(id => matches.some(ex => ex.id === id))
        .sort((a, b) => Number(state.favorites.has(b)) - Number(state.favorites.has(a))).slice(0,5);
      const recentSet = new Set(recentIds);
      const rows = [...recentIds.map(id => matches.find(ex => ex.id === id)), ...matches.filter(ex => !recentSet.has(ex.id))].filter(Boolean);
      const clockIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
      list.innerHTML = rows.length ? rows.map((ex,index) => `${index === 0 && recentIds.length ? `<div class="picker-section-label">${clockIcon}<span>RECENT</span></div>` : ''}${index === recentIds.length && recentIds.length && rows.length > recentIds.length ? '<div class="picker-section-label">ALL EXERCISES</div>' : ''}<button class="picker-item" type="button" data-id="${escapeHtml(ex.id)}" aria-pressed="${chosen.has(ex.id)}"><span><strong>${escapeHtml(ex.name)}</strong><span>${escapeHtml(ex.primary.join(', ') || 'Unspecified muscle')} · ${escapeHtml(ex.equipment || 'No equipment')}</span></span><span class="picker-state">${chosen.has(ex.id) ? '✓' : '+'}</span></button>`).join('') : '<div class="dialog-empty">No matching exercises.</div>';
      if(list)list.scrollTop=prevScroll;
      document.querySelectorAll('#exercisePickerList .picker-item').forEach(button => button.addEventListener('click', () => {
        let nowChosen;
        if(programMode){
          if(!programWorkout)return;
          if(!programWorkout.template)programWorkout.template={name:programWorkout.name,exercises:[]};
          const existing=programWorkout.template.exercises.find(item=>item.exerciseId===button.dataset.id);
          nowChosen=!existing;
          if(existing){programWorkout.template.exercises=programWorkout.template.exercises.filter(item=>item.exerciseId!==button.dataset.id);pickerSessionAdded.delete(button.dataset.id);}
          else{const ex=exercises.find(row=>row.id===button.dataset.id),program=workoutState.activeProgram,range=programRangeForWeek(program,programWeek(program));programWorkout.template.exercises.push({exerciseId:button.dataset.id,tracking:ex?.tracking||'reps',note:'',exerciseTags:[],supersetId:null,progression:{mode:ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:program?.progression?.timeStep||5,incrementType:program?.progression?.incrementType||'lb',incrementValue:program?.progression?.incrementValue||5,repsOnly:false},sets:Array.from({length:3},()=>({w:'',r:range.amrap?'':String(range.min),seconds:'',rpe:'',tags:[],complete:false}))});pickerSessionAdded.add(button.dataset.id);}
        }else if(templateMode){
          /* #74: add/remove exercises on the template being edited. */
          if(!editTemplate)return;
          const existing=editTemplate.exercises.find(item=>item.exerciseId===button.dataset.id);
          nowChosen=!existing;
          if(existing){editTemplate.exercises=editTemplate.exercises.filter(item=>item.exerciseId!==button.dataset.id);pickerSessionAdded.delete(button.dataset.id);}
          else{const ex=exercises.find(row=>row.id===button.dataset.id),range=progressionSetup.defaultRange;editTemplate.exercises.push({exerciseId:button.dataset.id,tracking:ex?.tracking||'reps',note:'',exerciseTags:[],supersetId:null,progression:{mode:ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:progressionSetup.timeStep||5,incrementType:progressionSetup.incrementType,incrementValue:progressionSetup.incrementValue,repsOnly:false},sets:Array.from({length:3},()=>({w:'',r:range.amrap?'':String(range.min),seconds:'',rpe:'',tags:[],complete:false}))});pickerSessionAdded.add(button.dataset.id);}
          schedulePersist();
        }else{
          const existing=workoutState.draft.exercises.find(item=>item.exerciseId===button.dataset.id);
          nowChosen=!existing;
          if(existing){workoutState.draft.exercises=workoutState.draft.exercises.filter(item=>item.exerciseId!==button.dataset.id);pickerSessionAdded.delete(button.dataset.id);}
          else{const ex=exercises.find(row=>row.id===button.dataset.id),range=progressionSetup.defaultRange;workoutState.draft.exercises.push({uid:uid('exercise'),exerciseId:button.dataset.id,tracking:ex?.tracking||'reps',sets:Array.from({length:3},()=>newSet()),note:'',exerciseTags:[],supersetId:null,progression:{mode:ex?.tracking||'reps',min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:progressionSetup.timeStep||5,incrementType:progressionSetup.incrementType,incrementValue:progressionSetup.incrementValue,repsOnly:false,custom:false}});pickerSessionAdded.add(button.dataset.id);}
          prepareDraftProgression(workoutState.draft, workoutState.activeProgram?.id===workoutState.draft.programId?workoutState.activeProgram.progression:freeformProgressionConfig());
          renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        }
        // In-place row update + rules-only re-render: the list keeps its scroll
        // position and the search field keeps focus instead of the whole dialog
        // flashing back to the top on every tap.
        button.setAttribute('aria-pressed',String(nowChosen));
        const stateEl=button.querySelector('.picker-state');if(stateEl)stateEl.textContent=nowChosen?'✓':'+';
        renderPickerRules();
      }));
    }
    function renderExercisePicker(){renderPickerRules();renderPickerList();}

    

/* ===== module: workout-builder.js ===== */
    /** Builds reusable workouts from the library and keeps exercise-level configuration intact. */
    /* Module map (v1.006) — Key: renderExercisePicker(), openTemplateBuilder(), startExerciseSwap()/performExerciseSwap(), cloneTemplateExercises(). Depends on: catalog, workout-editor factories, progression defaults, state picker state. */
    /* Picker-scoped filters: the add-exercise dialog carries the Exercises tab's
       search + filter interface (user 2026-09-10). Separate from the library's
       filters; reset every time the dialog opens. */
    const pickerFilters={muscles:new Set(),equipment:'',onlyFavorites:false,onlyCustom:false};
    function resetPickerFilters(){pickerFilters.muscles.clear();pickerFilters.equipment='';pickerFilters.onlyFavorites=false;pickerFilters.onlyCustom=false;}
    function pickerFilterMatch(x){
      /* A8 (#99): soft-deleted customs never list in the picker. */
      if(exerciseDeleted(x))return false;
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
    function resetPickerSession(){pickerSessionAdded=new Set();workoutState.pickerSwapUid=null;}
    /* #192 (user 2026-09-12): where the viewport goes when the exercise
       picker closes after adding exercises — the exact scroll position from
       when the picker opened, never a snap to the new card. Pure so tests
       can pin the rule. */
    function exercisePickerCloseScrollY(){return workoutState.pickerScrollY||0;}
    function populatePickerFilters(){
      const muscles=allMuscleOptions();
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
    /* Deep copy of template exercises for a new live session: carries targets over,
       drops logged values and completion marks (see cloneSetFields modes in
       utilities.js). */
    function cloneTemplateExercises(rows){return (rows||[]).map(item=>cloneExerciseItem(item,'fromTemplate',{trackingFallback:null,emptyDefault:true}));}
    /* #74: edit a saved template in the builder. Live-mutates the template's
       exercises directly (no draft involved). */
    function pickerTemplate(){
      /* The saved-workout builder (user 2026-09-11) is in-memory until saved,
         so the picker falls back to it when the edit target matches. */
      if(state.savedBuilder&&workoutState.templateEditTarget===state.savedBuilder.id)return state.savedBuilder;
      return workoutState.templates.find(row=>row.id===workoutState.templateEditTarget)||null;
    }
    function openTemplateBuilder(template){
      workoutState.pickerMode='template';workoutState.templateEditTarget=template.id;
      $('#exercisePickerTitle').textContent=`Edit ${template.name||'New saved workout'}`;
      $('#exercisePickerTitle').nextElementSibling.textContent='Add exercises from the library.';
      $('#exercisePickerSearch').value='';preparePickerFilters();resetPickerSession();renderExercisePicker();$('#exercisePickerDialog').showModal();
      requestAnimationFrame(()=>$('#exercisePickerSearch').focus());
    }
    function pickerCollection(){const mode=workoutState.pickerMode;if(mode==='template')return pickerTemplate()?.exercises||[];return workoutState.draft?.exercises||[];}
    /* #142: swap one exercise for another inside a workout (live log or
       saved-workout builder). The picker opens in swap mode; the chosen
       replacement keeps the original's set structure (counts + entered
       values + tags) while its prescription resets to the new movement's
       defaults and progression suggestions re-run for the replacement. */
    function startExerciseSwap(uid,mode){
      workoutState.pickerMode=mode;
      if(mode==='template'&&state.savedBuilder)workoutState.templateEditTarget=state.savedBuilder.id;
      const item=pickerCollection().find(x=>x.uid===uid);if(!item)return;
      const ex=exercises.find(e=>e.id===item.exerciseId);
      $('#exercisePickerTitle').textContent='Swap exercise';
      $('#exercisePickerTitle').nextElementSibling.textContent=`Choose a replacement for ${ex?.name||'this exercise'} \u2014 its sets carry over.`;
      $('#exercisePickerSearch').value='';preparePickerFilters();resetPickerSession();
      workoutState.pickerSwapUid=uid;
      renderExercisePicker();$('#exercisePickerDialog').showModal();
      requestAnimationFrame(()=>$('#exercisePickerSearch').focus());
    }
    function performExerciseSwap(newExerciseId){
      const uid=workoutState.pickerSwapUid;workoutState.pickerSwapUid=null;
      const templateMode=workoutState.pickerMode==='template';
      const item=pickerCollection().find(x=>x.uid===uid);
      const ex=exercises.find(e=>e.id===newExerciseId);
      let swapped=false;
      if(item&&ex&&item.exerciseId!==newExerciseId){
        const range=templateMode?builderPickerDefaultRange():progressionSetup.defaultRange;
        item.exerciseId=newExerciseId;
        /* Sets carry over untouched. The prescription resets to the new
           movement's defaults — a stale range/tracking would show the wrong
           inputs (e.g. rep ranges kept for a time-based exercise). */
        item.tracking=ex.tracking||'reps';
        item.progression=Object.assign(defaultExerciseProgression({mode:ex.tracking||'reps',min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,custom:range.custom}),range.preset?{preset:range.preset}:null);
        item.suggestedTarget=null;
        if(templateMode)schedulePersist();
        else{
          prepareDraftProgression(workoutState.draft, workoutState.activeProgram?.id===workoutState.draft.programId?workoutState.activeProgram.progression:freeformProgressionConfig());
          markDraftSaved();
        }
        swapped=true;
      }
      $('#exercisePickerDialog').close();
      if(templateMode)renderPickerRules();
      else{renderWorkoutExercises();renderWorkoutProgression();}
      if(swapped)showToast(`Swapped to ${ex.name} \u2014 sets carried over.`);
    }
    /* Builder edit mode for a program workout (user 2026-09-12): exercises
       added here default to the program's rep range for the current week, not
       the global default — the program's prescription wins until configured. */
    function builderPickerDefaultRange(){
      const b=state.savedBuilder;
      if(b?.editTarget?.kind==='program'&&workoutState.activeProgram){
        return programRangeForWeek(workoutState.activeProgram,programWeek(workoutState.activeProgram));
      }
      /* P6 #100 (user 2026-09-12): a focus pill selected in the saved-workout
         builder applies to exercises added afterwards too — the header says
         Strength 1–5, so new exercises must not fall back to the global
         default. The program's own prescription still wins for program
         edits (above). */
      const focusKey=b?.focusKey||'',preset=focusKey?REP_PRESETS[focusKey]:null;
      if(preset)return {preset:focusKey,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap,custom:true};
      return progressionSetup.defaultRange;
    }
    // Rules section only (chosen exercises + their sets/range/load config).
    // Re-renders without touching the exercise list below, so the list's scroll
    // position and the search field's focus survive adding/removing exercises.
    // Pass a selector to restore focus after the re-render (rule field edits).
    function renderPickerRules(focusSelector) {
      const dialog=$('#exercisePickerDialog'),prevScroll=dialog?dialog.scrollTop:0;
      const templateMode=workoutState.pickerMode==='template',editTemplate=pickerTemplate();
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
        const defaults=progressionSetup;
        const range=defaults.defaultRange||progressionSetup.defaultRange;
        /* #99 B7: all progression fallbacks route through the canonical factory. */
        const profile=item.progression||defaultExerciseProgression({mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue});
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
      document.querySelectorAll('[data-program-rule-id]').forEach(row=>{
        const getItem=()=>{
          if(templateMode)return editTemplate?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId);
          return workoutState.draft?.exercises.find(entry=>entry.uid===row.dataset.ruleUid)||workoutState.draft?.exercises.find(entry=>entry.exerciseId===row.dataset.programRuleId);
        };
        /* × on a chosen exercise removes it outright, so an accidental tap in
           the list below doesn't require hunting the row down again. */
        row.querySelector('[data-remove-rule]')?.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          const item=getItem();if(!item)return;
          pickerSessionAdded.delete(item.exerciseId);
          if(templateMode){if(editTemplate)editTemplate.exercises=editTemplate.exercises.filter(entry=>entry.exerciseId!==item.exerciseId);schedulePersist();if(typeof refreshTemplateViews==='function')refreshTemplateViews();}
          else{workoutState.draft.exercises=workoutState.draft.exercises.filter(entry=>entry.uid!==item.uid);prepareDraftProgression(workoutState.draft,freeformProgressionConfig());renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
          renderPickerRules();renderPickerList();
        });
        row.querySelectorAll('[data-program-rule]').forEach(control=>control.addEventListener('change',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const defaults=progressionSetup,range=defaults.defaultRange||progressionSetup.defaultRange;
          const profile=item.progression||defaultExerciseProgression({mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue});
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
          if(templateMode){schedulePersist();}else{prepareDraftProgression(workoutState.draft,freeformProgressionConfig());renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
          if(field==='setCount'||field==='mode'||field==='incrementType'){
            // Rules-only re-render keeps the exercise list's scroll; restore
            // focus to the edited control so keyboard/VO users don't lose place.
            const key=row.dataset.ruleUid?`[data-rule-uid="${CSS.escape(row.dataset.ruleUid)}"]`:`[data-program-rule-id="${CSS.escape(row.dataset.programRuleId)}"]`;
            renderPickerRules(`${key} [data-program-rule="${field}"]`);
          }
        }));
        row.querySelectorAll('[data-step-pills]').forEach(pills=>{
          const readStep=()=>{const item=getItem();return item?.progression?.timeStep||progressionSetup.timeStep||5;};
          wireTimeStepPills(pills,readStep,n=>{
            const item=getItem(); if(!item)return;
            const ex=exercises.find(entry=>entry.id===item.exerciseId);
            const dflt=progressionSetup,range=dflt.defaultRange||progressionSetup.defaultRange;
            const profile=item.progression||defaultExerciseProgression({mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,timeStep:dflt.timeStep||5,incrementType:dflt.incrementType,incrementValue:dflt.incrementValue});
            profile.timeStep=n; item.progression=profile;
            if(templateMode){schedulePersist();}else{prepareDraftProgression(workoutState.draft,freeformProgressionConfig());renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
          });
        });
        row.querySelector('[data-program-reps-only]')?.addEventListener('click',()=>{
          const item=getItem(); if(!item)return;
          const ex=exercises.find(entry=>entry.id===item.exerciseId);
          const defaults=progressionSetup,range=defaults.defaultRange||progressionSetup.defaultRange;
          const profile=item.progression||defaultExerciseProgression({mode:item.tracking||ex?.tracking||'reps',min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,timeStep:defaults.timeStep||5,incrementType:defaults.incrementType,incrementValue:defaults.incrementValue});
          profile.repsOnly=!profile.repsOnly; item.progression=profile; if(templateMode){schedulePersist();}else{renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();} renderPickerRules();
        });
        row.querySelector('[data-program-exercise-tags]')?.addEventListener('click',()=>openExerciseTagDialog(templateMode?{mode:'template',exerciseId:row.dataset.programRuleId}:{mode:'draft',exerciseUid:row.dataset.ruleUid}));
      });
      if(dialog)dialog.scrollTop=prevScroll;
      if(focusSelector){const el=document.querySelector(focusSelector);if(el)el.focus({preventScroll:true});}
    }
    // Exercise list only. Re-rendered on search typing and dialog open; the
    // toggle handler updates rows in place instead, so scrolling the list to
    // tap exercises no longer jumps back to the top on every tap.
    function renderPickerList() {
      const list=$('#exercisePickerList'),prevScroll=list?list.scrollTop:0;
      const templateMode=workoutState.pickerMode==='template',editTemplate=pickerTemplate();
      const q=normalize($('#exercisePickerSearch').value);
      const collection=pickerCollection();
      const chosen=new Set(collection.map(item=>item.exerciseId));
      /* #142: in swap mode the row being replaced reads as the current one. */
      const swapMode=!!workoutState.pickerSwapUid;
      const swapFromId=swapMode?((collection.find(x=>x.uid===workoutState.pickerSwapUid)||{}).exerciseId||null):null;
      const matches = q ? rankedExerciseMatches($('#exercisePickerSearch').value,exercises.length).filter(pickerFilterMatch).slice(0,80) : exercises.filter(pickerFilterMatch).slice(0,80);
      /* #144: favorites sort first in the picker. Search already floats favorites
         within each relevance tier (#155 — a favorite never outranks an
         exact/prefix match); in browse and filtered browse, favorites pin to
         the very top, ahead of the recents row. Recents are skipped while
         searching or filtering. */
      const favRows = q ? [] : matches.filter(ex => state.favorites.has(ex.id));
      const favSet = new Set(favRows.map(ex => ex.id));
      const recentIds = (q||pickerFilterActive()) ? [] : recentExerciseIds().filter(id => !favSet.has(id) && matches.some(ex => ex.id === id)).slice(0,5);
      const recentSet = new Set(recentIds);
      const rows = [...favRows, ...recentIds.map(id => matches.find(ex => ex.id === id)), ...matches.filter(ex => !favSet.has(ex.id) && !recentSet.has(ex.id))].filter(Boolean);
      const clockIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
      const starIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
      const sectionBreaks = [];
      if (favRows.length) sectionBreaks.push([0, `${starIcon}<span>FAVORITES</span>`]);
      if (recentIds.length) sectionBreaks.push([favRows.length, `${clockIcon}<span>RECENT</span>`]);
      if ((favRows.length || recentIds.length) && rows.length > favRows.length + recentIds.length) sectionBreaks.push([favRows.length + recentIds.length, '<span>ALL EXERCISES</span>']);
      list.innerHTML = rows.length ? rows.map((ex,index) => {const brk = sectionBreaks.find(([at]) => at === index);return `${brk ? `<div class="picker-section-label">${brk[1]}</div>` : ''}<button class="picker-item" type="button" data-id="${escapeHtml(ex.id)}" aria-pressed="${swapMode?String(ex.id===swapFromId):chosen.has(ex.id)}"><span><strong>${escapeHtml(ex.name)}</strong><span>${escapeHtml(ex.primary.join(', ') || 'Unspecified muscle')} · ${escapeHtml(ex.equipment || 'No equipment')}</span></span><span class="picker-state">${swapMode?(ex.id===swapFromId?'✓':'→'):(chosen.has(ex.id) ? '✓' : '+')}</span></button>`;}).join('') : '<div class="dialog-empty">No matching exercises.</div>';
      if(list)list.scrollTop=prevScroll;
      updatePickerHint();
      document.querySelectorAll('#exercisePickerList .picker-item').forEach(button => button.addEventListener('click', () => {
        /* #142: swap mode — one tap replaces the exercise, no add/remove toggle. */
        if(workoutState.pickerSwapUid){performExerciseSwap(button.dataset.id);return;}
        let nowChosen;
        if(templateMode){
          /* #74: add/remove exercises on the template being edited. */
          if(!editTemplate)return;
          const existing=editTemplate.exercises.find(item=>item.exerciseId===button.dataset.id);
          nowChosen=!existing;
          if(existing){editTemplate.exercises=editTemplate.exercises.filter(item=>item.exerciseId!==button.dataset.id);pickerSessionAdded.delete(button.dataset.id);}
          else{const ex=exercises.find(row=>row.id===button.dataset.id),range=builderPickerDefaultRange();const progression=Object.assign(defaultExerciseProgression({mode:ex?.tracking||'reps',min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,custom:range.custom}),range.preset?{preset:range.preset}:null);editTemplate.exercises.push(newExerciseItem({exerciseId:button.dataset.id,tracking:ex?.tracking||'reps',progression,sets:Array.from({length:3},()=>Object.assign(newSet(),{r:range.amrap?'':String(range.min)}))}));pickerSessionAdded.add(button.dataset.id);}
          schedulePersist();
        }else{
          const existing=workoutState.draft.exercises.find(item=>item.exerciseId===button.dataset.id);
          nowChosen=!existing;
          if(existing){workoutState.draft.exercises=workoutState.draft.exercises.filter(item=>item.exerciseId!==button.dataset.id);pickerSessionAdded.delete(button.dataset.id);}
          else{const ex=exercises.find(row=>row.id===button.dataset.id),range=progressionSetup.defaultRange;workoutState.draft.exercises.push(newExerciseItem({exerciseId:button.dataset.id,tracking:ex?.tracking||'reps',sets:Array.from({length:3},()=>newSet()),progression:defaultExerciseProgression({mode:ex?.tracking||'reps',min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap})}));pickerSessionAdded.add(button.dataset.id);}
          prepareDraftProgression(workoutState.draft, workoutState.activeProgram?.id===workoutState.draft.programId?workoutState.activeProgram.progression:freeformProgressionConfig());
          renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        }
        // In-place row update + rules-only re-render: the list keeps its scroll
        // position and the search field keeps focus instead of the whole dialog
        // flashing back to the top on every tap.
        button.setAttribute('aria-pressed',String(nowChosen));
        const stateEl=button.querySelector('.picker-state');if(stateEl)stateEl.textContent=nowChosen?'✓':'+';
        updatePickerHint();
        renderPickerRules();
      }));
    }
    function renderExercisePicker(){renderPickerRules();renderPickerList();}
    /* #167: selection-count hint under the picker title (aria-live so the
       count announces). Kept in a helper because row taps update in place
       without a full list re-render. */
    function updatePickerHint(){
      const hint=$('#exercisePickerHint');
      /* #142: swap mode is single-choice — the hint names the action instead
         of implying multi-select. */
      if(workoutState.pickerSwapUid){if(hint)hint.textContent='Tap an exercise to swap it in';return;}
      const templateMode=workoutState.pickerMode==='template',editTemplate=pickerTemplate();
      const n=(templateMode?editTemplate?.exercises:workoutState.draft.exercises)?.length||0;
      if(hint)hint.innerHTML=`Tap to add \u00b7 <strong>${n}</strong> selected`;
    }

    
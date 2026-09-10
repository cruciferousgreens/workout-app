
    /** Computes RPE-gated rep, time, and load suggestions from real completed history. */
    function topSetForSession(session) {
      if (!session?.sets?.length) return null;
      const mode=session.tracking==='time'||session.sets.some(set=>set.seconds!=null)?'time':'reps';
      const failureSets=session.sets.filter(set=>(set.tags||[]).some(tag=>tag.toLowerCase()==='to failure'));
      const candidates=failureSets.length?failureSets:session.sets;
      return candidates.reduce((best,set,index) => {
        const weight=Number(set.w)||0, reps=Number(set.r)||0, seconds=Number(set.seconds)||0;
        const performance=mode==='time'?seconds:reps;
        if(!best || weight>best.weight || (weight===best.weight && performance>best.performance)) return {weight,reps,seconds,performance,mode,rpe:set.rpe==null?null:Number(set.rpe),index,toFailure:failureSets.length>0};
        return best;
      },null);
    }

    function roundedIncrement(weight,type,value) {
      if(type==='percent') return Math.round((weight*(1+Number(value)/100))*2)/2;
      return Math.round((weight+Number(value))*2)/2;
    }

    function progressionForExercise(exerciseId, profile, includeSamples=false, config=null) {
      const programConfig=config || workoutState.activeProgram?.progression || progressionSetup;
      const logs=getExerciseLogs(exerciseId,includeSamples).filter(log=>includeSamples?log.sample:!log.sample).sort((a,b)=>b.isoDate.localeCompare(a.isoDate));
      if(!logs.length)return null;
      const latest=topSetForSession(logs[0]); if(!latest)return null;
      const mode=profile?.mode || latest.mode || 'reps';
      const threshold=Number(programConfig.threshold ?? 8), min=Number(profile?.min ?? 5), max=Number(profile?.max ?? 8);
      const timeMin=Number(profile?.timeMin ?? 30), timeMax=Number(profile?.timeMax ?? 60), timeStep=Number(profile?.timeStep ?? 5);
      const incrementType=profile?.incrementType || programConfig.incrementType || 'lb';
      const incrementValue=Number(profile?.incrementValue ?? programConfig.incrementValue ?? 5);
      const repsOnly=!!profile?.repsOnly;
      let nextWeight=latest.weight,nextReps=latest.reps,nextSeconds=latest.seconds,kind='hold',reason='Top-set RPE is above the progression trigger.';
      if(latest.rpe!=null && latest.rpe<=threshold){
        if(mode==='time'){
          if(latest.seconds<timeMax){nextSeconds=Math.min(timeMax,Math.max(timeMin,latest.seconds+timeStep));kind='time';reason=`Top set was at or below RPE ${threshold}; add ${timeStep} seconds inside the ${timeMin}–${timeMax}s range.`;}
          else if(repsOnly){kind='hold';reason=`Time ceiling reached. Load progression is off, so hold ${timeMax} seconds.`;}
          else{nextWeight=roundedIncrement(latest.weight,incrementType,incrementValue);nextSeconds=timeMin;kind='load';reason=`Time ceiling reached at RPE ${latest.rpe}; add ${incrementType==='percent'?`${incrementValue}%`:`${incrementValue} lb`} and reset to ${timeMin} seconds.`;}
        } else if(profile?.amrap){nextReps=Math.max(min,latest.reps);kind='hold';reason=`AMRAP target: keep the load and stop when the set reaches the program effort target.`;}
        else if(profile?.openTop){nextReps=Math.max(min,latest.reps+1);kind='reps';reason=`Open-ended range: add one rep while the top set stays at or below RPE ${threshold}.`;}
        else if(latest.reps<max){nextReps=Math.max(min,latest.reps+1);kind='reps';reason=`Top set was at or below RPE ${threshold}; add one rep inside the ${min}–${max} range.`;}
        else if(repsOnly){kind='hold';reason=`Rep ceiling reached. Load progression is off, so hold ${latest.weight||0} lb.`;}
        else{nextWeight=roundedIncrement(latest.weight,incrementType,incrementValue);nextReps=min;kind='load';reason=`Rep ceiling reached at RPE ${latest.rpe}; add ${incrementType==='percent'?`${incrementValue}%`:`${incrementValue} lb`} and reset to ${min} reps.`;}
      } else if(latest.rpe==null){reason='No RPE on the latest top set, so the engine holds the target.';}
      const recent=logs.slice(0,3).map(topSetForSession).filter(Boolean).reverse();
      const flat=recent.length>=3 && recent.every((row,i)=>i===0 || (row.weight<=recent[i-1].weight && row.performance<=recent[i-1].performance));
      const rising=recent.length>=3 && recent.every((row,i)=>i===0 || row.rpe==null || recent[i-1].rpe==null || row.rpe>=recent[i-1].rpe);
      const stall=!!programConfig.stallDetection && flat && rising;
      return {exerciseId,latest,mode,nextWeight,nextReps,nextSeconds,kind,reason,sourceDate:logs[0].isoDate,sourceWorkout:logs[0].name,range:mode==='time'?[timeMin,timeMax]:[min,max],timeStep,repsOnly,stall,sampleDerived:includeSamples};
    }

    function sampleSuggestions() {
      return Object.entries(sampleProgressionProfiles).map(([id,profile])=>progressionForExercise(id,profile,true,{...progressionSetup})).filter(Boolean).slice(0,4);
    }

    function suggestionCardMarkup(suggestion,index,interactive=true) {
      const ex=exercises.find(x=>x.id===suggestion.exerciseId);
      const formatTarget=(weight,performance)=>`${weight ? `${weight} lb · ` : ''}${performance} ${suggestion.mode==='time'?'sec':'reps'}`;
      const oldTarget=formatTarget(suggestion.latest.weight,suggestion.mode==='time'?suggestion.latest.seconds:suggestion.latest.reps);
      const nextTarget=formatTarget(suggestion.nextWeight,suggestion.mode==='time'?suggestion.nextSeconds:suggestion.nextReps);
      const label=suggestion.kind==='hold'?'Hold':suggestion.kind==='load'?'Load +':suggestion.kind==='time'?'Time +':'Rep +';
      const basis=suggestion.sampleDerived?'':`<div class="suggestion-basis">Based on ${escapeHtml(suggestion.sourceWorkout||'your last workout')} · ${escapeHtml(formatLogDate(suggestion.sourceDate))} · latest top set ${oldTarget}${suggestion.latest.rpe==null?' without RPE':` @ RPE ${suggestion.latest.rpe}`}</div>`;
      return `<${interactive?'button':'div'} class="suggestion-card ${suggestion.applied?'applied':''}" ${interactive?`type="button" data-demo-suggestion="${index}"`:''}><div class="suggestion-name">${escapeHtml(ex?.name||'Exercise')}<span>${label}</span></div><div class="suggestion-change"><span>${oldTarget}</span><span>→</span><strong>${nextTarget}</strong></div><div class="suggestion-reason">${escapeHtml(suggestion.reason)}</div>${basis}</${interactive?'button':'div'}>`;
    }

    function renderProgressionPreview() {
      const suggestions=sampleSuggestions();
      const fallback='<div class="chart-empty">Sample history is cleared. Complete workouts to generate progression targets.</div>';
      const ruleMarkup=suggestions.map(item=>{
        const ex=exercises.find(x=>x.id===item.exerciseId),profile=sampleProgressionProfiles[item.exerciseId],time=profile.mode==='time';
        return `<div class="exercise-rule-row" data-rule-id="${escapeHtml(item.exerciseId)}"><strong title="${escapeHtml(ex?.name||'Exercise')}">${escapeHtml(ex?.name||'Exercise')}</strong><label class="rule-field"><span>Track</span><select data-rule-field="mode"><option value="reps" ${time?'':'selected'}>Reps</option><option value="time" ${time?'selected':''}>Seconds</option></select></label><label class="rule-field"><span>${time?'Min sec':'Min reps'}</span><input type="number" min="1" max="600" value="${time?profile.timeMin:profile.min}" data-rule-field="${time?'timeMin':'min'}"></label><label class="rule-field"><span>${time?'Max sec':'Max reps'}</span><input type="number" min="1" max="600" value="${time?profile.timeMax:profile.max}" data-rule-field="${time?'timeMax':'max'}"></label><label class="rule-field"><span>${time?'Sec step':'Load step'}</span><input type="number" min="0.5" step="0.5" value="${time?profile.timeStep:profile.incrementValue}" data-rule-field="${time?'timeStep':'incrementValue'}"></label><label class="reps-only-label"><input type="checkbox" data-rule-field="repsOnly" ${profile.repsOnly?'checked':''}> Increase reps only</label></div>`;
      }).join('');
      $('#progressionPreview').innerHTML=`<div class="progression-preview-head"><div><h2 id="progressionPreviewTitle">Next-session suggestions</h2><p>Tap a card to apply its target. Rep- and time-range progression use the same RPE 8 trigger.</p></div><span class="sample-derived">Sample-derived preview</span></div>${suggestions.length?`<details class="exercise-rules"><summary>Adjust sample exercise rules</summary>${ruleMarkup}</details><div class="suggestion-list">${suggestions.map((item,i)=>suggestionCardMarkup(item,i,true)).join('')}</div>`:fallback}<p class="progression-footnote">These preview values come only from labeled sample history. In an actual program, cards use real completed workouts. The engine never schedules a deload automatically.</p>`;
      document.querySelectorAll('[data-demo-suggestion]').forEach(button=>button.addEventListener('click',()=>{const suggestion=suggestions[Number(button.dataset.demoSuggestion)];if(!suggestion)return;suggestion.applied=!suggestion.applied;button.classList.toggle('applied',suggestion.applied);button.querySelector('.suggestion-name span').textContent=suggestion.applied?'Applied ✓':(suggestion.kind==='load'?'Load +':suggestion.kind==='time'?'Time +':suggestion.kind==='hold'?'Hold':'Rep +');}));
      document.querySelectorAll('[data-rule-id]').forEach(row=>row.querySelectorAll('[data-rule-field]').forEach(control=>control.addEventListener('change',()=>{const profile=sampleProgressionProfiles[row.dataset.ruleId],field=control.dataset.ruleField;if(!profile)return;if(field==='repsOnly')profile[field]=control.checked;else if(field==='mode')profile[field]=control.value;else profile[field]=Number(control.value);if((profile.min||0)>(profile.max||Infinity))profile.max=profile.min;if((profile.timeMin||0)>(profile.timeMax||Infinity))profile.timeMax=profile.timeMin;renderProgressionPreview();})));
    }

    function progressionProfileForDraftItem(item) {
      const ex=exercises.find(row=>row.id===item.exerciseId),mode=exerciseTracking(item,ex);
      const config=workoutState.activeProgram?.progression||progressionSetup,range=config.defaultRange||progressionSetup.defaultRange;
      return item.progression || {mode,min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:config.timeStep||5,incrementType:config.incrementType||'lb',incrementValue:config.incrementValue||5,repsOnly:false};
    }

    function prepareDraftProgression(draft,programConfig) {
      if(!draft)return;
      draft.progressionSuggestions=draft.exercises.map(item=>progressionForExercise(item.exerciseId,progressionProfileForDraftItem(item),false,programConfig)).filter(Boolean);
    }

    function applyProgressionSuggestion(draft,suggestion,rerender=true) {
      const item=draft?.exercises.find(row=>row.exerciseId===suggestion.exerciseId); if(!item)return;
      item.tracking=suggestion.mode;
      item.sets.forEach(set=>{set.w=suggestion.nextWeight?String(suggestion.nextWeight):'';if(suggestion.mode==='time'){set.seconds=String(suggestion.nextSeconds);set.r='';}else{set.r=String(suggestion.nextReps);set.seconds='';}set.complete=false;});
      suggestion.applied=true;
      if(rerender){renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
    }

    function renderWorkoutProgression() {
      const draft=workoutState.draft, box=$('#workoutProgression'), context=$('#workoutContext');
      const program=workoutState.activeProgram && draft?.programId===workoutState.activeProgram.id?workoutState.activeProgram:null;
      context.hidden=!program; context.textContent=program?`${program.name} · ${draft.name}`:'';
      const suggestions=draft?.progressionSuggestions||[];
      if(!draft?.exercises?.length){box.hidden=true;return;}
      box.hidden=false;
      if(!suggestions.length){box.innerHTML=`<div class="progression-banner-head"><div><h3>No progression suggestions yet</h3><p>Suggestions only appear for exercises in this workout after you have real completed history. Sample workouts are never used.</p></div><span class="real-data-label">Real logs only</span></div>`;return;}
      box.innerHTML=`<div class="progression-banner-head"><div><h3>Suggestions for this workout</h3><p>Only exercises below with real completed history appear. Tap a card to apply its target to every set.</p></div><span class="real-data-label">Real logs only</span></div><div class="suggestion-list">${suggestions.map((s,i)=>suggestionCardMarkup(s,i,true).replace('data-demo-suggestion','data-real-suggestion')).join('')}</div>${suggestions.some(s=>s.stall)?`<div class="stall-card"><strong>Possible stall detected.</strong> Progress has been flat while RPE is rising. Consider scheduling a deload week; nothing has been changed automatically.</div>`:''}`;
      document.querySelectorAll('[data-real-suggestion]').forEach(button=>button.addEventListener('click',()=>applyProgressionSuggestion(draft,suggestions[Number(button.dataset.realSuggestion)])));
    }

    
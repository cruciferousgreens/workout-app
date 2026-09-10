
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

    function progressionForExercise(exerciseId, profile, config=null) {
      const programConfig=config || workoutState.activeProgram?.progression || progressionSetup;
      const logs=getExerciseLogs(exerciseId).sort((a,b)=>b.isoDate.localeCompare(a.isoDate));
      if(!logs.length)return null;
      const targetMode=profile?.mode || 'reps';
      const threshold=Number(programConfig.threshold ?? 8), min=Number(profile?.min ?? 5), max=Number(profile?.max ?? 8);
      const timeMin=Number(profile?.timeMin ?? 30), timeMax=Number(profile?.timeMax ?? 60), timeStep=Number(profile?.timeStep ?? 5);
      // Suggest from the most recent log in the SAME rep/time zone as the target.
      // Basing the suggestion on the latest log regardless of zone produced invented
      // loads (e.g. a Friday 4s e1RM interpolated into a Monday 8s target); the
      // program's own zone history is the honest basis. Falls back to the latest log.
      // Zone is matched first by the stored progression profile, then by the actual
      // logged top-set reps/seconds, because older logs (e.g. blank-logged sessions)
      // may carry no stored profile at all.
      const inStoredZone=log=>{
        const p=log.progression; if(!p)return false;
        if((p.mode||'reps')!==targetMode)return false;
        if(targetMode==='time'){if(!(Number(p.timeMin)===timeMin&&Number(p.timeMax)===timeMax))return false;}
        else if(!(Number(p.min)===min&&Number(p.max)===max&&!!p.amrap===!!profile?.amrap&&!!p.openTop===!!profile?.openTop))return false;
        // A matching stored target range is not enough on its own: the actual
        // logged top set must have landed inside that zone. Blank-logged
        // sessions get the default range stamped on them, so the profile alone
        // can't tell zones apart — a 5–8 target logged as 255×4 belongs to the
        // 4s zone, not the 5–8 zone.
        const top=topSetForSession(log); if(!top)return false;
        if(targetMode==='time')return top.mode==='time'&&top.seconds>=timeMin&&top.seconds<=timeMax;
        return top.mode==='reps'&&top.reps>=min&&(profile?.openTop||profile?.amrap||top.reps<=max);
      };
      const inLoggedZone=log=>{
        const top=topSetForSession(log); if(!top)return false;
        if(targetMode==='time')return top.mode==='time'&&top.seconds>=timeMin&&top.seconds<=timeMax;
        return top.mode==='reps'&&top.reps>=min&&(profile?.openTop||profile?.amrap||top.reps<=max);
      };
      const zoneLog=logs.find(inStoredZone)||logs.find(inLoggedZone);
      const latestLog=zoneLog||logs[0],latest=topSetForSession(latestLog); if(!latest)return null;
      const mode=profile?.mode || latest.mode || 'reps';
      const incrementType=profile?.incrementType || programConfig.incrementType || 'lb';
      const incrementValue=Number(profile?.incrementValue ?? programConfig.incrementValue ?? 5);
      const repsOnly=!!profile?.repsOnly;
      const previousProfile=latestLog.progression;
      const previousMin=Number(previousProfile?.min),previousMax=Number(previousProfile?.max);
      const hasStoredRange=Number.isFinite(previousMin)&&Number.isFinite(previousMax),outsideNewRange=latest.reps<min||(!profile?.openTop&&!profile?.amrap&&latest.reps>max);
      const repRangeChanged=mode==='reps'&&previousProfile?.mode!=='time'&&((hasStoredRange&&(previousMin!==min||previousMax!==max))||(!hasStoredRange&&outsideNewRange));
      let nextWeight=latest.weight,nextReps=latest.reps,nextSeconds=latest.seconds,kind='hold',reason='Top-set RPE is above the progression trigger.',estimated1RM=0;
      if(repRangeChanged&&latest.weight>0){
        estimated1RM=estimate1RM({w:latest.weight,r:latest.reps,rpe:latest.rpe});
        const targetReps=profile?.openTop?min:Math.max(min,max),rawTarget=estimated1RM/(1+targetReps/30);
        nextWeight=Math.max(0,Math.round(rawTarget*10)/10);nextReps=min;kind='range';
        const week=Number(programConfig.currentWeek)||null,weekPrefix=week?`Week ${week} is `:'This block is ';
        reason=`${weekPrefix}${programRangeLabel(profile)}; suggesting ${nextWeight} lb from your estimated 1RM of ${Math.round(estimated1RM)} lb so the new rep target starts at a sensible load.`;
      } else if(latest.rpe!=null && latest.rpe<=threshold){
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
      return {exerciseId,latest,mode,nextWeight,nextReps,nextSeconds,kind,reason,estimated1RM,sourceDate:latestLog.isoDate,sourceWorkout:latestLog.name,range:mode==='time'?[timeMin,timeMax]:[min,max],timeStep,repsOnly,stall};
    }

    function suggestionCardMarkup(suggestion,index,interactive=true) {
      const ex=exercises.find(x=>x.id===suggestion.exerciseId);
      const formatTarget=(weight,performance)=>`${weight ? `${weight} lb · ` : ''}${performance} ${suggestion.mode==='time'?'sec':'reps'}`;
      const oldTarget=formatTarget(suggestion.latest.weight,suggestion.mode==='time'?suggestion.latest.seconds:suggestion.latest.reps);
      const nextTarget=formatTarget(suggestion.nextWeight,suggestion.mode==='time'?suggestion.nextSeconds:suggestion.nextReps);
      const label=suggestion.applied?'Applied ✓':suggestion.kind==='hold'?'Hold':suggestion.kind==='load'?'Load +':suggestion.kind==='range'?'Week range':suggestion.kind==='time'?'Time +':'Rep +';
      const basis=`<div class="suggestion-basis">Based on ${escapeHtml(suggestion.sourceWorkout||'your last workout')} · ${escapeHtml(formatLogDate(suggestion.sourceDate))} · latest top set ${oldTarget}${suggestion.latest.rpe==null?' without RPE':` @ RPE ${suggestion.latest.rpe}`}</div>`;
      return `<${interactive?'button':'div'} class="suggestion-card ${suggestion.applied?'applied':''}" ${interactive?`type="button" data-demo-suggestion="${index}"`:''}><div class="suggestion-name">${escapeHtml(ex?.name||'Exercise')}<span>${label}</span></div><div class="suggestion-change"><span>${oldTarget}</span><span>→</span><strong>${nextTarget}</strong></div><div class="suggestion-reason">${escapeHtml(suggestion.reason)}</div>${basis}</${interactive?'button':'div'}>`;
    }

    function renderProgressionPreview() {
      const host=$('#progressionPreview'); if(!host)return;
      const ids=[...new Set(realWorkouts().flatMap(workout=>workout.exercises.map(item=>item.exerciseId)))];
      const suggestions=ids.map(id=>progressionForExercise(id,progressionProfileForDraftItem({exerciseId:id}),{...progressionSetup})).filter(Boolean).slice(0,4);
      const fallback='<div class="chart-empty">Complete workouts to generate progression targets.</div>';
      host.innerHTML=`<div class="progression-preview-head"><div><h2 id="progressionPreviewTitle">Next-session suggestions</h2><p>Based on your completed history. Rep- and time-range progression use the same RPE trigger.</p></div></div>${suggestions.length?`<div class="suggestion-list">${suggestions.map((item,i)=>suggestionCardMarkup(item,i,false)).join('')}</div>`:fallback}<p class="progression-footnote">The engine never schedules a deload automatically.</p>`;
    }

    function progressionProfileForDraftItem(item) {
      const ex=exercises.find(row=>row.id===item.exerciseId),mode=exerciseTracking(item,ex);
      const config=workoutState.activeProgram?.progression||progressionSetup,range=config.defaultRange||progressionSetup.defaultRange;
      return item.progression || {mode,min:range.min,max:range.max,openTop:!!range.openTop,amrap:!!range.amrap,timeMin:30,timeMax:60,timeStep:config.timeStep||5,incrementType:config.incrementType||'lb',incrementValue:config.incrementValue||5,repsOnly:false};
    }

    function prepareDraftProgression(draft,programConfig) {
      if(!draft)return;
      draft.progressionSuggestions=draft.exercises.map(item=>progressionForExercise(item.exerciseId,progressionProfileForDraftItem(item),programConfig)).filter(Boolean);
    }

    function applyProgressionSuggestion(draft,suggestion,rerender=true) {
      const item=draft?.exercises.find(row=>row.exerciseId===suggestion.exerciseId); if(!item)return;
      item.tracking=suggestion.mode;
      item.sets.forEach(set=>{set.w='';set.r='';set.seconds='';set.complete=false;});
      // Suggested targets are hints, not values: they render as true HTML placeholders
      // (ghosted text, empty value, cleared on focus) and are saved only when a set is
      // completed with its field untouched.
      item.suggestedTarget={w:suggestion.nextWeight?String(suggestion.nextWeight):'',r:suggestion.mode==='time'?'':String(suggestion.nextReps),seconds:suggestion.mode==='time'?String(suggestion.nextSeconds):''};
      suggestion.applied=true;
      if(rerender){renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
    }

    function renderWorkoutProgression() {
      const draft=workoutState.draft, box=$('#workoutProgression'), context=$('#workoutContext');
      const program=workoutState.activeProgram && draft?.programId===workoutState.activeProgram.id?workoutState.activeProgram:null;
      context.hidden=!program; context.textContent=program?`${program.name} · Week ${programWeek(program)} · ${draft.name}`:'';
      const suggestions=draft?.progressionSuggestions||[];
      if(!draft?.exercises?.length){box.hidden=true;return;}
      box.hidden=false;
      if(!suggestions.length){box.innerHTML=`<div class="progression-banner-head"><div><h3>No progression suggestions yet</h3><p>Suggestions appear for exercises in this workout once you have completed history.</p></div></div>`;return;}
      box.innerHTML=`<div class="progression-banner-head"><div><h3>${draft.autoAppliedProgression?'Progression targets applied':'Suggestions for this workout'}</h3><p>${draft.autoAppliedProgression?'Targets below appear as ghosted hints in each set. Type to override — completing a set untouched saves the hinted value.':'Only exercises below with completed history appear. Tap a card to apply its target to every set.'}</p></div></div><div class="suggestion-list">${suggestions.map((s,i)=>suggestionCardMarkup(s,i,true).replace('data-demo-suggestion','data-real-suggestion')).join('')}</div>${suggestions.some(s=>s.stall)?`<div class="stall-card"><strong>Possible stall detected.</strong> Progress has been flat while RPE is rising. Consider scheduling a deload week; nothing has been changed automatically.</div>`:''}`;
      document.querySelectorAll('[data-real-suggestion]').forEach(button=>button.addEventListener('click',()=>applyProgressionSuggestion(draft,suggestions[Number(button.dataset.realSuggestion)])));
    }

    
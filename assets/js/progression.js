
/* ===== module: progression.js ===== */
    /** Computes RPE-gated rep, time, and load suggestions from real completed history. */
    /* Module map (v1.006) — Key: progressionForExercise(), prepareDraftProgression(), applyProgressionSuggestion(), suggestionCardMarkup(), roundedIncrement(). Depends on: exercise-detail (estimate1RM), workoutState.completed history, state.progressionSetup, utilities. */
    function topSetForSession(session) {
      if (!session?.sets?.length) return null;
      const mode=session.tracking==='time'||session.sets.some(set=>set.seconds!=null)?'time':'reps';
      // Tags are labels only — they must not influence the math. All sets
      // compete for top set on equal terms: heaviest weight wins, ties broken
      // by reps/seconds.
      const candidates=session.sets;
      return candidates.reduce((best,set,index) => {
        const weight=Number(set.w)||0, reps=Number(set.r)||0, seconds=Number(set.seconds)||0;
        const performance=mode==='time'?seconds:reps;
        if(!best || weight>best.weight || (weight===best.weight && performance>best.performance)) return {weight,reps,seconds,performance,mode,rpe:set.rpe==null?null:Number(set.rpe),index};
        return best;
      },null);
    }

    function roundedIncrement(weight,type,value) {
      if(type==='percent') return Math.round((weight*(1+Number(value)/100))*2)/2;
      return Math.round((weight+Number(value))*2)/2;
    }

    /* Plate snapping for %1RM loads (user 2026-09-11): 5 lb plates imperial,
       2.5 kg plates metric. B3-fixed: the metric path converts lb→kg BEFORE
       snapping and back to lb after — the original had ×/÷ swapped. */
    function snapPlateLoad(rawLb){
      return isMetric()?Math.round(rawLb*LB_TO_KG/2.5)*2.5/LB_TO_KG:Math.round(rawLb/5)*5;
    }
    /* % of 1RM clamps to 1–100 (v0.99994 behavior); unset/invalid → 75. */
    function clampPct1RM(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.min(100,Math.max(1,Math.round(n))):75;}
    /* Deload load clamps to 40–80%; unset/invalid → 60. */
    function clampDeloadPct(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.min(80,Math.max(40,Math.round(n))):60;}

    /* The suggestion engine's entry point: from one exercise's real completed history +
       its progression profile, returns the next-session target (weight/reps/seconds) or
       a hold. Suggestions are hints only — see applyProgressionSuggestion. */
    function progressionForExercise(exerciseId, profile, config=null, hasStoredZone=false) {
      const programConfig=config || workoutState.activeProgram?.progression || progressionSetup;
      // Progression scheme: 'rpe' is the default double progression; 'linear'
      // adds the increment every session with no RPE gate (per-program setting,
      // stamped onto each exercise at program start so repeats stay linear);
      // 'onerm' prescribes load as a percentage of the training max (#54).
      const scheme=profile?.scheme||programConfig?.scheme||'rpe';
      const logs=getExerciseLogs(exerciseId).sort(sortByRecencyDesc); /* #99 A13: completedAt first, isoDate fallback */
      // %1RM with an entered training max needs no history at all.
      // trainingMax is the v1.001 rename of manual1RM — read the old key as a
      // fallback for one cycle so legacy profiles keep working.
      const trainingMax=Number(profile?.trainingMax ?? profile?.manual1RM)||0;
      if(!logs.length&&!(scheme==='onerm'&&trainingMax>0))return null;
      const targetMode=profile?.mode || 'reps';
      const threshold=Number(programConfig.threshold ?? 8);
      // AMRAP has no upper rep bound: a blank max means "as many as possible" from an
      // optional floor (blank min defaults to 1). Normalize both sides the same way so
      // a blank max matches a blank max (not 0, not the 8 fallback) in zone comparisons.
      const normMin=p=>p?.amrap?(Number(p?.min)||1):Number(p?.min ?? 5);
      const normMax=p=>p?.amrap?null:Number(p?.max ?? 8);
      const min0=normMin(profile), max0=normMax(profile);
      let min=min0, max=max0;
      let timeMin=Number(profile?.timeMin ?? 30), timeMax=Number(profile?.timeMax ?? 60);
      const timeStep=Number(profile?.timeStep)||5;
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
        // For AMRAP the max is open, so stored logs match on the amrap flag and the
        // floor (blank min normalizes to 1 on both sides) rather than on a max.
        else if(!((profile?.amrap?normMin(p)===min:Number(p.min)===min)&&(profile?.amrap||normMax(p)===max)&&!!p.amrap===!!profile?.amrap&&!!p.openTop===!!profile?.openTop))return false;
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
      const latestLog=zoneLog||logs[0], latest=latestLog?topSetForSession(latestLog):null;
      const mode=profile?.mode || latest?.mode || 'reps';
      // Freestyle (out-of-program) with no explicit range: follow the lifter's
      // most recent zone instead of rebasing into the Settings default zone.
      // A program prescribes its zone; a freestyle session doesn't, so imposing
      // the default range via e1RM is the "weird" part. The retarget only
      // matters when the latest log landed outside the default zone (when it
      // matches, the zone logic above already applies). The lifter's zone is a
      // single number — their top set — so the suggestion becomes "same reps,
      // add load when the RPE trigger hits". Explicitly chosen ranges
      // (profile.custom, set in the exercise rule rows), AMRAP, and open-top
      // keep the existing behavior. A repeat or template-start whose draft item
      // carries a stored zone from a real workout also keeps its zone (#48):
      // collapsing it contradicted the program-start suggestion for identical
      // history.
      const followLifter=!!config?.freeform&&!profile?.custom&&!hasStoredZone;
      if(latest&&followLifter&&!profile?.amrap&&!profile?.openTop&&latest.mode===mode){
        if(mode==='time'){timeMin=Math.max(1,latest.seconds);timeMax=Math.max(1,latest.seconds);}
        else{min=Math.max(1,latest.reps);max=Math.max(1,latest.reps);}
      }
      const incrementType=profile?.incrementType || programConfig.incrementType || 'lb';
      const incrementValue=Number(profile?.incrementValue ?? programConfig.incrementValue ?? 5);
      /* incrementValue is entered in the user's display units; convert to the
         canonical lb before applying it to stored weights. */
      const incrementValueLb=incrementType==='percent'?incrementValue:(isMetric()?incrementValue/LB_TO_KG:incrementValue);
      const incrementLabel=incrementType==='percent'?`${incrementValue}%`:`${incrementValue} ${weightUnit()}`;
      const repsOnly=!!profile?.repsOnly;
      // Progression scheme: 'rpe' is the default double progression; 'linear'
      // adds the increment every session with no RPE gate; 'onerm' prescribes
      // load as a percentage of the training max (#54, restored v1.001).
      const previousProfile=latestLog?.progression;
      const previousMin=normMin(previousProfile),previousMax=normMax(previousProfile);
      const hasStoredRange=Number.isFinite(Number(previousProfile?.min))&&(!!previousProfile?.amrap||Number.isFinite(Number(previousProfile?.max))),outsideNewRange=!!latest&&(latest.reps<min||(!profile?.openTop&&!profile?.amrap&&latest.reps>max));
      const repRangeChanged=!!latest&&mode==='reps'&&previousProfile?.mode!=='time'&&((hasStoredRange&&(previousMin!==min||previousMax!==max))||(!hasStoredRange&&outsideNewRange));
      let nextWeight=latest?.weight??0,nextReps=latest?.reps??min,nextSeconds=latest?.seconds??timeMin,kind='hold',reason='Top-set RPE is above the progression trigger.',estimated1RM=0;
      const week=Number(programConfig.currentWeek)||null;
      /* B8 fix: the %1RM basis is the BEST same-zone top set's e1RM, not the
         heaviest set's. Reuses the same-zone selection above, extended to the
         max e1RM over the whole zone window. */
      const bestZoneE1RM=()=>{
        let best=0;
        for(const log of logs){
          if(!(inStoredZone(log)||inLoggedZone(log)))continue;
          const top=topSetForSession(log);
          if(!top||!(top.weight>0)||!(top.reps>0))continue;
          const e=estimate1RM({w:top.weight,r:top.reps,rpe:top.rpe});
          if(e>best)best=e;
        }
        return best;
      };
      /* %1RM prescription (#54, restored v1.001): the target load is a fixed
         percentage of the training max — no RPE gate, no rep ladder.
         Percent: per-exercise override → weekly % wave → program default → 75.
         Basis is TM-first: an entered training max wins; otherwise the best
         same-zone estimated 1RM. Time-based exercises fall through to the
         standard path — %1RM is a load prescription for rep work. */
      const onermRx=()=>{
        if(mode==='time')return null;
        const pct=clampPct1RM(Number(profile?.percentOf1RM)||programPctForWeek(programConfig,week)||Number(programConfig?.percentOf1RM)||75);
        let basis=0,basisNote='',tmSource=null;
        if(trainingMax>0){
          basis=trainingMax;tmSource='manual';
          basisNote=`your training max of ${displayWeight(trainingMax)} ${weightUnit()}`;
        }else{
          const auto=bestZoneE1RM();
          if(auto>0){basis=auto;tmSource='auto';basisNote=`an auto training max of ≈${displayWeight(Math.round(auto))} ${weightUnit()} from your best same-zone top set`;}
        }
        if(basis<=0)return null;
        return {weight:snapPlateLoad(basis*(pct/100)),pct,basis,basisNote,tmSource};
      };
      /* Scheduled deloads (#54, v1.001): this override runs BEFORE the scheme
         branches. A week is a deload week only when the user scheduled it
         (every-N-weeks, or flagged in the % wave panel) — deloads are never
         inferred, so the "engine never auto-deloads" rule stands. On a deload
         week the load is reduced and the linear +increment is skipped. */
      const deloadPct=clampDeloadPct(Number(programConfig.deloadPct ?? progressionSetup.deloadPct ?? 60));
      const deloadWeek=!!week&&isDeloadWeek(programConfig,week);
      let onermInfo=null;
      /* The %1RM prescription resolves before the deload branch: a manually
         entered training max is a valid basis with no history, so a scheduled
         deload still reduces it. No basis at all means no card, even on a
         deload week. */
      const rx=(scheme==='onerm'&&mode!=='time')?onermRx():null;
      if(scheme==='onerm'&&mode!=='time'&&!rx)return null;
      if(deloadWeek&&((latest&&latest.weight>0)||rx)){
        let normal=0,normalNote='';
        if(rx){onermInfo=rx;normal=rx.weight;normalNote=`the ${rx.pct}% prescription`;}
        else if(repRangeChanged&&latest.weight>0&&!followLifter){
          /* Deload wins on load, but the week-range rebase still applies to
             the normal prescription the deload % is taken from. */
          const e1=estimate1RM({w:latest.weight,r:latest.reps,rpe:latest.rpe});
          const targetReps=profile?.openTop?min:Math.max(min,max);
          normal=Math.max(0,Math.round(e1/(1+targetReps/30)*10)/10);normalNote='the rebased prescription';estimated1RM=e1;
        }
        else{normal=latest.weight;normalNote='your latest top set';}
        nextWeight=snapPlateLoad(normal*(deloadPct/100));
        if(rx)nextReps=min; // %1RM deload: the reduced load still targets the range minimum.
        kind='deload';
        reason=`Week ${week} is a scheduled deload — ${deloadPct}% of ${normalNote}; suggesting ${displayWeight(nextWeight)} ${weightUnit()}.`;
      }
      else if(rx){
        onermInfo=rx;
        nextWeight=rx.weight;nextReps=min;kind='onerm';estimated1RM=rx.basis;
        reason=`${rx.pct}% of ${rx.basisNote}; suggesting ${displayWeight(nextWeight)} ${weightUnit()}${profile?.amrap?' at AMRAP':` at ${min} rep${min===1?'':'s'}`}.`;
      }
      // The standard path needs real history.
      else if(!latest)return null;
      else if(scheme==='linear'){
        // Linear progression (user's call 2026-09-11): the increment applies
        // every session, even when reps were missed. Reps and seconds carry
        // over from the latest top set; only the load moves.
        if(repsOnly){reason='Linear progression is on, but load progression is off for this exercise.';}
        else{nextWeight=roundedIncrement(latest.weight,incrementType,incrementValueLb);kind='load';reason=`Linear progression: add ${incrementLabel} every session.`;}
      }
      // Freestyle follow-the-lifter skips the e1RM rebase entirely: there is no
      // prescribed zone to rebase into, the lifter's own zone is the target.
      else if(repRangeChanged&&latest.weight>0&&!followLifter){
        estimated1RM=estimate1RM({w:latest.weight,r:latest.reps,rpe:latest.rpe});
        const targetReps=profile?.openTop?min:Math.max(min,max),rawTarget=estimated1RM/(1+targetReps/30);
        nextWeight=Math.max(0,Math.round(rawTarget*10)/10);nextReps=min;kind='range';
        const weekPrefix=config?.freeform?'This session is ':week?`Week ${week} is `:'This block is ';
        reason=`${weekPrefix}${programRangeLabel(profile)}; suggesting ${displayWeight(nextWeight)} ${weightUnit()} from your estimated 1RM of ${displayWeight(Math.round(estimated1RM))} ${weightUnit()} so the new rep target starts at a sensible load.`;
        /* #250: a rebased target must never regress below the lifter's current
           top set. When the computed load would drop (e.g. a high-RPE top set
           rebased into a lower-rep range), hold the top set instead — the #79
           no-change check below then suppresses the card, which is the honest
           outcome: a top set above the RPE trigger earns no progression. */
        if(nextWeight<latest.weight){
          nextWeight=latest.weight;nextReps=latest.reps;kind='hold';
          reason=`${weekPrefix}${programRangeLabel(profile)}, but the rebased load would drop below your ${displayWeight(latest.weight)} ${weightUnit()} top set — holding steady.`;
        }
      } else if(latest.rpe!=null && latest.rpe<=threshold){
        if(mode==='time'){
          if(latest.seconds<timeMax){nextSeconds=Math.min(timeMax,Math.max(timeMin,latest.seconds+timeStep));kind='time';reason=`Top set was at or below RPE ${threshold}; add ${timeStep} seconds inside the ${timeMin}–${timeMax}s range.`;}
          else if(repsOnly){kind='hold';reason=`Time ceiling reached. Load progression is off, so hold ${timeMax} seconds.`;}
          else{nextWeight=roundedIncrement(latest.weight,incrementType,incrementValueLb);nextSeconds=timeMin;kind='load';reason=`Time ceiling reached at RPE ${latest.rpe}; add ${incrementLabel} and reset to ${timeMin} seconds.`;}
        } else if(profile?.amrap){nextReps=Math.max(min,latest.reps);kind='hold';reason=`AMRAP target: keep the load and take the set to the effort target (top-set RPE ${threshold} or below).`;}
        else if(profile?.openTop){nextReps=Math.max(min,latest.reps+1);kind='reps';reason=`Open-ended range: add one rep while the top set stays at or below RPE ${threshold}.`;}
        else if(latest.reps<max){nextReps=Math.max(min,latest.reps+1);kind='reps';reason=`Top set was at or below RPE ${threshold}; add one rep inside the ${min}–${max} range.`;}
        else if(repsOnly){kind='hold';reason=`Rep ceiling reached. Load progression is off, so hold ${displayWeight(latest.weight)||0} ${weightUnit()}.`;}
        // A single-number zone (min===max, the freestyle follow-the-lifter retarget)
        // reads better as "add load at N reps" than "reset to N reps".
        else{nextWeight=roundedIncrement(latest.weight,incrementType,incrementValueLb);nextReps=min;kind='load';reason=min===max?`Top set was at or below RPE ${threshold}; add ${incrementLabel} at ${min} reps.`:`Rep ceiling reached at RPE ${latest.rpe}; add ${incrementLabel} and reset to ${min} reps.`;}
      } else if(latest.rpe==null){reason='No RPE on the latest top set, so the engine holds the target.';}
      /* #79: suppress suggestions that propose no actual change from the latest
         top set (e.g. "25 lb · 6 reps → 25 lb · 6 reps"). A suggestion that
         changes nothing is noise, not guidance. */
      if(latest){
        const weightSame=Math.abs((nextWeight||0)-(latest.weight||0))<0.001;
        const noChange=mode==='time'
          ? weightSame&&nextSeconds===latest.seconds
          : profile?.amrap ? weightSame : weightSame&&nextReps===latest.reps;
        if(noChange)return null;
      }
      return {exerciseId,latest,mode,nextWeight,nextReps,nextSeconds,kind,reason,estimated1RM,sourceDate:latestLog?.isoDate,sourceWorkout:latestLog?.name,range:mode==='time'?[timeMin,timeMax]:[min,max],timeStep,repsOnly,freeform:!!config?.freeform,scheme,amrap:!!profile?.amrap,pct:onermInfo?.pct??null,tmSource:onermInfo?.tmSource??null};
    }

    function suggestionCardMarkup(suggestion,index,interactive=true) {
      const ex=exercises.find(x=>x.id===suggestion.exerciseId);
      const formatTarget=(weight,performance)=>`${weight ? `${displayWeight(weight)} ${weightUnit()} · ` : ''}${performance} ${suggestion.mode==='time'?'sec':'reps'}`;
      const oldTarget=suggestion.latest?formatTarget(suggestion.latest.weight,suggestion.mode==='time'?suggestion.latest.seconds:suggestion.latest.reps):`1RM ${displayWeight(suggestion.estimated1RM)} ${weightUnit()}`;
      const nextTarget=suggestion.amrap&&suggestion.mode!=='time'?`${suggestion.nextWeight?`${displayWeight(suggestion.nextWeight)} ${weightUnit()} · `:''}AMRAP`:formatTarget(suggestion.nextWeight,suggestion.mode==='time'?suggestion.nextSeconds:suggestion.nextReps);
      const label=suggestion.applied?'Applied ✓':suggestion.kind==='hold'?'Hold':suggestion.kind==='load'?'Load +':suggestion.kind==='onerm'?'%1RM':suggestion.kind==='deload'?'Deload':suggestion.kind==='range'?(suggestion.freeform?'New range':'Week range'):suggestion.kind==='time'?'Time +':'Rep +';
      // user 2026-09-11 (#44): cards stay lean — name, kind, and the target
      // change only. The reason/basis sentences were gratuitous.
      return `<${interactive?'button':'div'} class="suggestion-card ${suggestion.applied?'applied':''}" ${interactive?`type="button" data-demo-suggestion="${index}"`:''}><div class="suggestion-name"><span class="suggestion-exercise">${escapeHtml(ex?.name||'Exercise')}</span><span>${label}</span></div><div class="suggestion-change"><span>${oldTarget}</span><span>→</span><strong>${nextTarget}</strong></div></${interactive?'button':'div'}>`;
    }

    function progressionProfileForDraftItem(item) {
      const ex=exercises.find(row=>row.id===item.exerciseId),mode=exerciseTracking(item,ex);
      const config=workoutState.activeProgram?.progression||progressionSetup,range=config.defaultRange||progressionSetup.defaultRange;
      /* #99 B7: the draft fallback routes through the canonical factory. */
      return item.progression || defaultExerciseProgression({mode,min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,timeStep:config.timeStep||5,incrementType:config.incrementType||'lb',incrementValue:config.incrementValue||5});
    }

    function freeformProgressionConfig() {
      // Out-of-program workouts: global defaults and the freeform flag so the
      // engine follows the lifter's last zone instead of rebasing into the
      // default range (see progressionForExercise).
      return {...progressionSetup,freeform:true};
    }

    function prepareDraftProgression(draft,programConfig) {
      if(!draft)return;
      /* #148: editing a previously completed workout is history, not a plan —
         no suggestion cards and no ghosted targets. Clear any stale
         suggestions so nothing session-planning leaks into the edit. */
      if(draft.editingId){draft.progressionSuggestions=[];draft.exercises.forEach(item=>{delete item.suggestedTarget;});return;}
      draft.progressionSuggestions=draft.exercises.map(item=>{
        // #48: the draft item carries a prescribed zone when it was copied from
        // a real workout (repeat) or a zoned template — the freestyle
        // follow-the-lifter retarget must not collapse it.
        const p=item.progression,hasStoredZone=!!(p&&(p.min!=null||p.max!=null||p.amrap||p.openTop));
        return progressionForExercise(item.exerciseId,progressionProfileForDraftItem(item),programConfig,hasStoredZone);
      }).filter(Boolean);
    }

    function applyProgressionSuggestion(draft,suggestion,rerender=true) {
      const item=draft?.exercises.find(row=>row.exerciseId===suggestion.exerciseId); if(!item)return;
      item.tracking=suggestion.mode;
      /* #99 C2: never touch user-entered values or complete=true attestations.
         The suggestion writes only to suggestedTarget (ghosted placeholders,
         per the comment below); sets with user-entered values are left alone. */
      // Suggested targets are hints, not values: they render as true HTML placeholders
      // (ghosted text, empty value, cleared on focus) and are saved only when a set is
      // completed with its field untouched.
      item.suggestedTarget={w:suggestion.nextWeight?String(suggestion.nextWeight):'',r:suggestion.mode==='time'?'':(suggestion.amrap?'':String(suggestion.nextReps)),seconds:suggestion.mode==='time'?String(suggestion.nextSeconds):''};
      suggestion.applied=true;
      if(rerender){renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
    }

    function renderWorkoutProgression() {
      const draft=workoutState.draft, box=$('#workoutProgression'), context=$('#workoutContext');
      /* #148: never render suggestion cards while editing a completed workout. */
      if(draft?.editingId){box.hidden=true;return;}
      const program=workoutState.activeProgram && draft?.programId===workoutState.activeProgram.id?workoutState.activeProgram:null;
      /* #68: the pill duplicates the workout name field when they match. The pill
         carries program context; the name field carries the name. Only show the
         scheduled workout name in the pill when the user renamed this workout,
         so the pill still says which program slot this is. */
      let contextText='';
      if(program){
        contextText=`${program.name} · Week ${programWeek(program)}`;
        const scheduled=program.workouts.find(w=>w.uid===draft.programWorkoutUid);
        const scheduledName=(scheduled?.name||'').trim(), draftName=(draft.name||'').trim();
        if(scheduledName&&draftName&&scheduledName.toLowerCase()!==draftName.toLowerCase())contextText+=` · ${scheduledName}`;
      }
      context.hidden=!program; context.textContent=contextText;
      const suggestions=draft?.progressionSuggestions||[];
      if(!draft?.exercises?.length){box.hidden=true;return;}
      box.hidden=false;
      if(!suggestions.length){box.hidden=true;return;}
      box.innerHTML=`<div class="progression-banner-head"><div><h3>${draft.autoAppliedProgression?'Progression targets applied':'Suggestions for this workout'}</h3><p>${draft.autoAppliedProgression?'Targets below appear as ghosted hints in each set. Type to override — completing a set untouched saves the hinted value.':'Only exercises below with completed history appear. Tap a card to apply its target to every set.'}</p></div></div><div class="suggestion-list">${suggestions.map((s,i)=>suggestionCardMarkup(s,i,true).replace('data-demo-suggestion','data-real-suggestion')).join('')}</div>`;
      document.querySelectorAll('[data-real-suggestion]').forEach(button=>button.addEventListener('click',()=>applyProgressionSuggestion(draft,suggestions[Number(button.dataset.realSuggestion)])));
    }

    
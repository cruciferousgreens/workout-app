
/* ===== module: progression.js ===== */
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

    function progressionForExercise(exerciseId, profile, config=null, hasStoredZone=false) {
      const programConfig=config || workoutState.activeProgram?.progression || progressionSetup;
      // Progression scheme: 'rpe' is the default double progression; 'linear'
      // adds the increment every session with no RPE gate (per-program setting,
      // stamped onto each exercise at program start so repeats stay linear);
      // 'onerm' prescribes load as a percentage of the estimated 1RM (#54).
      const scheme=profile?.scheme||programConfig?.scheme||'rpe';
      const logs=getExerciseLogs(exerciseId).sort((a,b)=>b.isoDate.localeCompare(a.isoDate));
      const manual1RM=Number(profile?.manual1RM)||0;
      // %1RM with a manual 1RM needs no history at all.
      if(!logs.length&&!(scheme==='onerm'&&manual1RM>0))return null;
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
      // adds the increment every session with no RPE gate (per-program setting,
      // stamped onto each exercise at program start so repeats stay linear);
      // 'onerm' prescribes load as a percentage of the estimated 1RM (#54).
      const previousProfile=latestLog?.progression;
      const previousMin=normMin(previousProfile),previousMax=normMax(previousProfile);
      const hasStoredRange=Number.isFinite(Number(previousProfile?.min))&&(!!previousProfile?.amrap||Number.isFinite(Number(previousProfile?.max))),outsideNewRange=!!latest&&(latest.reps<min||(!profile?.openTop&&!profile?.amrap&&latest.reps>max));
      const repRangeChanged=!!latest&&mode==='reps'&&previousProfile?.mode!=='time'&&((hasStoredRange&&(previousMin!==min||previousMax!==max))||(!hasStoredRange&&outsideNewRange));
      let nextWeight=latest?.weight??0,nextReps=latest?.reps??min,nextSeconds=latest?.seconds??timeMin,kind='hold',reason='Top-set RPE is above the progression trigger.',estimated1RM=0;
      if(scheme==='onerm'&&mode!=='time'){
        // %1RM prescription (user's call 2026-09-11, #54): the target load
        // is a fixed percentage of the estimated 1RM — no RPE gate, no rep
        // ladder. The estimate comes from the same-zone top set (RPE-based
        // when RPE was logged, Epley fallback); a manual 1RM covers exercises
        // with no history yet. Time-based exercises fall through to the
        // standard path — %1RM is a load prescription for rep work.
        const pct=Number(profile?.percentOf1RM)||75;
        let basis=0,basisNote='';
        if(latest&&latest.weight>0){
          basis=estimate1RM({w:latest.weight,r:latest.reps,rpe:latest.rpe});
          basisNote=`estimated 1RM of ${displayWeight(Math.round(basis))} ${weightUnit()}`;
        }else if(manual1RM>0){
          basis=manual1RM;basisNote=`your entered 1RM of ${displayWeight(manual1RM)} ${weightUnit()}`;
        }
        if(basis>0){
          // user 2026-09-11: snap %1RM loads to 5 lb plates (2.5 kg metric).
          const rawLoad=basis*(pct/100);
          nextWeight=isMetric()?Math.round(rawLoad/LB_TO_KG/2.5)*2.5*LB_TO_KG:Math.round(rawLoad/5)*5;
          nextReps=min;kind='onerm';
          reason=`${pct}% of ${basisNote}; suggesting ${displayWeight(nextWeight)} ${weightUnit()} at ${min} rep${min===1?'':'s'}.`;
          estimated1RM=basis;
        }else return null;
      }
      // The standard path needs real history; only %1RM+manual-1RM reaches here
      // without it, and time-based %1RM has no prescription — no card.
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
        const week=Number(programConfig.currentWeek)||null,weekPrefix=config?.freeform?'This session is ':week?`Week ${week} is `:'This block is ';
        reason=`${weekPrefix}${programRangeLabel(profile)}; suggesting ${displayWeight(nextWeight)} ${weightUnit()} from your estimated 1RM of ${displayWeight(Math.round(estimated1RM))} ${weightUnit()} so the new rep target starts at a sensible load.`;
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
      const recent=logs.slice(0,3).map(topSetForSession).filter(Boolean).reverse();
      const flat=recent.length>=3 && recent.every((row,i)=>i===0 || (row.weight<=recent[i-1].weight && row.performance<=recent[i-1].performance));
      const rising=recent.length>=3 && recent.every((row,i)=>i===0 || row.rpe==null || recent[i-1].rpe==null || row.rpe>=recent[i-1].rpe);
      const stall=!!programConfig.stallDetection && flat && rising;
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
      return {exerciseId,latest,mode,nextWeight,nextReps,nextSeconds,kind,reason,estimated1RM,sourceDate:latestLog?.isoDate,sourceWorkout:latestLog?.name,range:mode==='time'?[timeMin,timeMax]:[min,max],timeStep,repsOnly,stall,freeform:!!config?.freeform,scheme,amrap:!!profile?.amrap};
    }

    function suggestionCardMarkup(suggestion,index,interactive=true) {
      const ex=exercises.find(x=>x.id===suggestion.exerciseId);
      const formatTarget=(weight,performance)=>`${weight ? `${displayWeight(weight)} ${weightUnit()} · ` : ''}${performance} ${suggestion.mode==='time'?'sec':'reps'}`;
      // Manual-1RM %1RM suggestions have no logged top set — show the 1RM basis instead.
      const oldTarget=suggestion.latest?formatTarget(suggestion.latest.weight,suggestion.mode==='time'?suggestion.latest.seconds:suggestion.latest.reps):`1RM ${displayWeight(suggestion.estimated1RM)} ${weightUnit()}`;
      const nextTarget=suggestion.amrap&&suggestion.mode!=='time'?`${suggestion.nextWeight?`${displayWeight(suggestion.nextWeight)} ${weightUnit()} · `:''}AMRAP`:formatTarget(suggestion.nextWeight,suggestion.mode==='time'?suggestion.nextSeconds:suggestion.nextReps);
      const label=suggestion.applied?'Applied ✓':suggestion.kind==='hold'?'Hold':suggestion.kind==='load'?'Load +':suggestion.kind==='onerm'?'%1RM':suggestion.kind==='range'?(suggestion.freeform?'New range':'Week range'):suggestion.kind==='time'?'Time +':'Rep +';
      // user 2026-09-11 (#44): cards stay lean — name, kind, and the target
      // change only. The reason/basis sentences were gratuitous.
      return `<${interactive?'button':'div'} class="suggestion-card ${suggestion.applied?'applied':''}" ${interactive?`type="button" data-demo-suggestion="${index}"`:''}><div class="suggestion-name">${escapeHtml(ex?.name||'Exercise')}<span>${label}</span></div><div class="suggestion-change"><span>${oldTarget}</span><span>→</span><strong>${nextTarget}</strong></div></${interactive?'button':'div'}>`;
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

    function freeformProgressionConfig() {
      // Out-of-program workouts: global defaults, no stall detection, and the
      // freeform flag so the engine follows the lifter's last zone instead of
      // rebasing into the default range (see progressionForExercise).
      return {...progressionSetup,stallDetection:false,freeform:true};
    }

    function prepareDraftProgression(draft,programConfig) {
      if(!draft)return;
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
      item.sets.forEach(set=>{set.w='';set.r='';set.seconds='';set.complete=false;});
      // Suggested targets are hints, not values: they render as true HTML placeholders
      // (ghosted text, empty value, cleared on focus) and are saved only when a set is
      // completed with its field untouched.
      item.suggestedTarget={w:suggestion.nextWeight?String(suggestion.nextWeight):'',r:suggestion.mode==='time'?'':(suggestion.amrap?'':String(suggestion.nextReps)),seconds:suggestion.mode==='time'?String(suggestion.nextSeconds):''};
      suggestion.applied=true;
      if(rerender){renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
    }

    function renderWorkoutProgression() {
      const draft=workoutState.draft, box=$('#workoutProgression'), context=$('#workoutContext');
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
      box.innerHTML=`<div class="progression-banner-head"><div><h3>${draft.autoAppliedProgression?'Progression targets applied':'Suggestions for this workout'}</h3><p>${draft.autoAppliedProgression?'Targets below appear as ghosted hints in each set. Type to override — completing a set untouched saves the hinted value.':'Only exercises below with completed history appear. Tap a card to apply its target to every set.'}</p></div></div><div class="suggestion-list">${suggestions.map((s,i)=>suggestionCardMarkup(s,i,true).replace('data-demo-suggestion','data-real-suggestion')).join('')}</div>${suggestions.some(s=>s.stall)?`<div class="stall-card"><strong>Possible stall detected.</strong> Progress has been flat while RPE is rising. Consider scheduling a deload week; nothing has been changed automatically.</div>`:''}`;
      document.querySelectorAll('[data-real-suggestion]').forEach(button=>button.addEventListener('click',()=>applyProgressionSuggestion(draft,suggestions[Number(button.dataset.realSuggestion)])));
    }

    

/* ===== module: dashboard-stats.js ===== */
    /** Produces dashboard calendars, charts, and muscle-volume analysis from completed workouts. */
    function isoForDate(date) { return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10); }
    function workoutsForPeriod(period) {
      const now=new Date(), today=isoForDate(now); let start=null;
      if(period==='today') start=today;
      if(period==='week'){const d=new Date(now);d.setDate(now.getDate()-((now.getDay()+6)%7));start=isoForDate(d);}
      if(period==='month') start=`${today.slice(0,7)}-01`;
      if(period==='year') start=`${today.slice(0,4)}-01-01`;
      return workoutState.completed.filter(w=>(!start||w.date>=start)&&w.date<=today);
    }
    function comparisonPeriods(period) {
      const now=new Date(); now.setHours(12,0,0,0);
      let currentStart, currentEnd, previousStart, previousEnd, label;
      if(period==='today'){
        currentStart=new Date(now); currentEnd=new Date(now); currentEnd.setDate(now.getDate()+1);
        previousStart=new Date(now); previousStart.setDate(now.getDate()-1); previousEnd=new Date(now);
        label='today vs yesterday';
      }else if(period==='week'){
        currentStart=new Date(now); currentStart.setDate(now.getDate()-((now.getDay()+6)%7)); currentEnd=new Date(currentStart); currentEnd.setDate(currentStart.getDate()+7);
        previousStart=new Date(currentStart); previousStart.setDate(currentStart.getDate()-7); previousEnd=new Date(currentStart);
        label='this week vs last week';
      }else if(period==='month'){
        currentStart=new Date(now.getFullYear(),now.getMonth(),1,12); currentEnd=new Date(now.getFullYear(),now.getMonth()+1,1,12);
        previousStart=new Date(now.getFullYear(),now.getMonth()-1,1,12); previousEnd=new Date(currentStart);
        label='this month vs last month';
      }else if(period==='year'){
        currentStart=new Date(now.getFullYear(),0,1,12); currentEnd=new Date(now.getFullYear()+1,0,1,12);
        previousStart=new Date(now.getFullYear()-1,0,1,12); previousEnd=new Date(currentStart);
        label='this year vs last year';
      }else{
        currentEnd=new Date(now); currentEnd.setDate(now.getDate()+1); currentStart=new Date(currentEnd); currentStart.setDate(currentEnd.getDate()-28);
        previousEnd=new Date(currentStart); previousStart=new Date(previousEnd); previousStart.setDate(previousEnd.getDate()-28);
        label='last 4 weeks vs prior 4 weeks';
      }
      const inWindow=(workout,start,end)=>workout.date>=isoForDate(start)&&workout.date<isoForDate(end);
      return {current:workoutState.completed.filter(workout=>inWindow(workout,currentStart,currentEnd)),previous:workoutState.completed.filter(workout=>inWindow(workout,previousStart,previousEnd)),label};
    }
    function muscleBalanceGroups(volumes) {
      const groups={Push:0,Pull:0,Lower:0,Core:0,Other:0};
      const groupFor=muscle=>{
        if(['chest','shoulders','triceps'].includes(muscle))return 'Push';
        if(['lats','middle back','lower back','traps','biceps','forearms'].includes(muscle))return 'Pull';
        if(['quadriceps','hamstrings','glutes','calves','adductors','abductors'].includes(muscle))return 'Lower';
        if(['abdominals'].includes(muscle))return 'Core';
        return 'Other';
      };
      Object.entries(volumes).forEach(([muscle,value])=>{groups[groupFor(muscle)]+=Number(value)||0;});
      return groups;
    }
    function recentPRRows(workouts) {
      const rows=[];
      workouts.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(workout=>workout.exercises.forEach(item=>{
        const current=item.sets.filter(set=>Number(set.w)>0&&Number(set.r)>0); if(!current.length)return;
        const prior=workoutState.completed.filter(row=>row.id!==workout.id&&row.date<workout.date).flatMap(row=>row.exercises.filter(entry=>entry.exerciseId===item.exerciseId).flatMap(entry=>entry.sets)).filter(set=>Number(set.w)>0&&Number(set.r)>0);
        if(!prior.length)return;
        const best=Math.max(...current.map(estimate1RM)),priorBest=Math.max(...prior.map(estimate1RM)),weight=Math.max(...current.map(set=>Number(set.w))),priorWeight=Math.max(...prior.map(set=>Number(set.w)));
        const kind=best>priorBest+.5?'Estimated 1RM PR':weight>priorWeight?'Heaviest set PR':'';
        if(kind){const displayValue=kind.startsWith('Estimated')?`${Math.round(displayWeight(best))} ${weightUnit()}`:`${displayWeight(weight)} ${weightUnit()}`;rows.push({exerciseId:item.exerciseId,date:workout.date,kind,sample:isSampleWorkout(workout),value:displayValue});}
      }));
      return rows.slice(0,6);
    }
    function renderMuscleAnalysis(workouts,period) {
      /* Volume|Sets toggle for the muscle breakdown (user 2026-09-11) —
         mirrors the #14 Top Exercises segmented control. Session-only
         (state.muscleVolumeMode); the default comes from the saved
         Units → Stats default setting. */
      const byMuscleSets=state.muscleVolumeMode==='sets';
      const metric=byMuscleSets?muscleSetCounts(workouts):muscleVolumes(workouts);
      const rows=Object.entries(metric).filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]);
      const max=Math.max(1,...rows.map(([,value])=>value));
      document.querySelectorAll('#muscleVolumeMode [data-muscle-mode]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(btn.dataset.muscleMode===(byMuscleSets?'sets':'volume')));
        btn.onclick=()=>{const mode=btn.dataset.muscleMode;if(state.muscleVolumeMode===mode)return;const y=window.scrollY;state.muscleVolumeMode=mode;renderStats();window.scrollTo(0,y);};
      });
      $('#muscleVolumeNote').textContent=byMuscleSets
        ?'Completed sets per muscle, primary and secondary.'
        :'Weighted volume. Secondary muscles receive 45% of the set\u2019s volume.';
      /* #7: muscle rows are tappable — expanding shows the top exercises
         driving that muscle in the period (sorted by the active metric),
         each opening the exercise detail (which carries its own e1RM
         chart + history). */
      $('#muscleVolumeBreakdown').innerHTML=rows.length?rows.slice(0,10).map(([muscle,value])=>{
        const isOpen=expandedMuscle===muscle;
        const drivers=isOpen?exercisesForMuscle(muscle,workouts,byMuscleSets):[];
        const drill=drivers.length?`<div class="muscle-drilldown">${drivers.map(([id,entry])=>{const setsLabel=`${entry.sets} set${entry.sets===1?'':'s'}`;return `<button class="drilldown-row" type="button" data-stat-exercise="${escapeHtml(id)}"><span>${escapeHtml(exercises.find(ex=>ex.id===id)?.name||'Exercise')}</span><span class="drilldown-value">${byMuscleSets?`${setsLabel} · ${formatVolume(entry.volume)}`:`${formatVolume(entry.volume)} · ${setsLabel}`}</span><span aria-hidden="true">›</span></button>`;}).join('')}</div>`:'';
        const valueLabel=byMuscleSets?`${value} set${value===1?'':'s'}`:formatVolume(value);
        return `<div class="muscle-volume-group"><button class="muscle-volume-row${isOpen?' is-open':''}" type="button" data-muscle-drill="${escapeHtml(muscle)}" aria-expanded="${isOpen}"><strong class="analysis-label">${escapeHtml(muscle)}</strong><span class="analysis-track"><i class="analysis-fill" style="width:${Math.max(3,(value/max)*100).toFixed(1)}%"></i></span><span class="analysis-value">${valueLabel}</span><span class="drill-chevron" aria-hidden="true">›</span></button>${drill}</div>`;
      }).join(''):`<p class="section-note">${byMuscleSets?'No completed sets in this period yet.':'No weighted muscle volume in this period.'}</p>`;
      document.querySelectorAll('[data-muscle-drill]').forEach(btn=>btn.addEventListener('click',()=>{
        const y=window.scrollY;
        expandedMuscle=expandedMuscle===btn.dataset.muscleDrill?null:btn.dataset.muscleDrill;
        renderStats();
        window.scrollTo(0,y);
      }));
      const focus={Strength:0,Hypertrophy:0,Endurance:0};
      workouts.forEach(workout=>workout.exercises.forEach(item=>{if((item.tracking||'reps')==='time')return;item.sets.forEach(set=>{if((set.tags||[]).some(tag=>tag.toLowerCase()==='warmup'))return;const reps=Number(set.r);if(!reps)return;if(reps<=5)focus.Strength+=1;else if(reps<=12)focus.Hypertrophy+=1;else focus.Endurance+=1;});}));
      const focusTotal=Object.values(focus).reduce((sum,value)=>sum+value,0);
      $('#trainingFocus').innerHTML=focusTotal?Object.entries(focus).map(([name,value])=>{const share=Math.round(value/focusTotal*100);return `<div class="focus-key"><strong>${name}</strong><span class="analysis-track"><i class="analysis-fill" style="width:${share}%"></i></span><span class="analysis-value">${share}%</span></div>`;}).join(''):'<p class="section-note">Complete rep-based working sets to see your training focus.</p>';
      /* Top exercises metric dropdown (#14). */
      const exerciseStats={};workouts.forEach(workout=>workout.exercises.forEach(item=>{const entry=exerciseStats[item.exerciseId]||(exerciseStats[item.exerciseId]={volume:0,sets:0});entry.volume+=item.sets.reduce((sum,set)=>sum+setVolume(set),0);entry.sets+=item.sets.length;}));
      const bySets=state.topExercisesMode==='sets';
      const top=Object.entries(exerciseStats).filter(([,entry])=>bySets?entry.sets>0:entry.volume>0).sort((a,b)=>bySets?b[1].sets-a[1].sets:b[1].volume-a[1].volume).slice(0,6);
      /* #14: compact two-option segmented control with fixed button widths —
         the old text-swapping button changed width on every tap and jumped. */
      document.querySelectorAll('#topExercisesMode [data-top-mode]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(btn.dataset.topMode===(bySets?'sets':'volume')));
        btn.onclick=()=>{const mode=btn.dataset.topMode;if(state.topExercisesMode===mode)return;const y=window.scrollY;state.topExercisesMode=mode;schedulePersist();renderStats();window.scrollTo(0,y);};
      });
      $('#topExercises').innerHTML=top.length?`<div class="action-list">${top.map(([id,entry])=>`<button class="action-row" type="button" data-stat-exercise="${escapeHtml(id)}"><span><strong>${escapeHtml(exercises.find(ex=>ex.id===id)?.name||'Exercise')}</strong><span>Open history and trend</span></span><span class="action-row-value">${bySets?`${entry.sets} set${entry.sets===1?'':'s'}`:formatVolume(entry.volume)}</span></button>`).join('')}</div>`:`<p class="section-note">${bySets?'No completed sets in this period yet.':'No weighted exercise volume in this period.'}</p>`;
      const prs=recentPRRows(workouts);
      $('#recentPRs').innerHTML=prs.length?`<div class="action-list">${prs.map(pr=>`<button class="action-row" type="button" data-stat-exercise="${escapeHtml(pr.exerciseId)}"><span><strong>${escapeHtml(exercises.find(ex=>ex.id===pr.exerciseId)?.name||'Exercise')}</strong><span>${escapeHtml(pr.kind)}${pr.sample?' <span class="sample-label">Sample</span>':''} · ${escapeHtml(formatLogDate(pr.date))}</span></span><span class="action-row-value">${escapeHtml(pr.value)}</span></button>`).join('')}</div>`:'<p class="section-note">No new PRs in this period yet. Keep logging completed sets—your next one will show here.</p>';
      document.querySelectorAll('[data-stat-exercise]').forEach(button=>button.addEventListener('click',()=>openExercise(button.dataset.statExercise)));
      const comparison=comparisonPeriods(period), current=muscleVolumes(comparison.current), previous=muscleVolumes(comparison.previous);
      const trendRows=[...new Set([...Object.keys(current),...Object.keys(previous)])].map(muscle=>({muscle,current:Number(current[muscle]||0),previous:Number(previous[muscle]||0)})).filter(row=>row.current>0||row.previous>0).sort((a,b)=>b.current-a.current).slice(0,8);
      $('#muscleTrendNote').textContent=titleCase(comparison.label);
      $('#muscleTrends').innerHTML=trendRows.length?trendRows.map(row=>{const change=row.previous?Math.round((row.current-row.previous)/row.previous*100):null;const changeText=change==null?(row.current?'New':'—'):`${change>0?'+':''}${change}%`;const direction=change>0?'up':change<0?'down':'';return `<div class="trend-row"><div><strong>${escapeHtml(row.muscle)}</strong><span>${formatVolume(row.current)} now · ${formatVolume(row.previous)} before</span></div><span class="trend-change ${direction}">${changeText}</span></div>`;}).join(''):'<p class="section-note">No muscle trend is available for these periods yet.</p>';
    }
    function muscleCounts(workouts) {
      const muscles={}; workouts.forEach(w=>w.exercises.forEach(item=>{const ex=exercises.find(x=>x.id===item.exerciseId);(ex?.primary||[]).forEach(m=>muscles[m]=(muscles[m]||0)+item.sets.length);})); return muscles;
    }
    function muscleVolumes(workouts) {
      const volumes={};
      workouts.forEach(workout=>workout.exercises.forEach(item=>{
        const ex=exercises.find(x=>x.id===item.exerciseId); if(!ex)return;
        const volume=item.sets.reduce((total,set)=>total+setVolume(set),0);
        (ex.primary||[]).forEach(m=>volumes[m]=(volumes[m]||0)+volume);
        (ex.secondary||[]).forEach(m=>volumes[m]=(volumes[m]||0)+(volume*.45));
      }));
      return volumes;
    }
    /* Completed-set counts per muscle, primary and secondary (user 2026-09-11:
       the Sets view of "Volume by muscle"). Sets are whole — no 45%
       weighting — so secondary muscles get the full set count. */
    function muscleSetCounts(workouts) {
      const counts={};
      workouts.forEach(workout=>workout.exercises.forEach(item=>{
        const ex=exercises.find(x=>x.id===item.exerciseId); if(!ex)return;
        const n=item.sets.length;
        (ex.primary||[]).forEach(m=>counts[m]=(counts[m]||0)+n);
        (ex.secondary||[]).forEach(m=>counts[m]=(counts[m]||0)+n);
      }));
      return counts;
    }
    function formatVolume(value) {
      const n=displayVolume(value), unit=weightUnit(), rounded=Math.round(n);
      return rounded>=1000?`${(rounded/1000).toFixed(rounded>=10000?0:1)}k ${unit}`:`${rounded.toLocaleString()} ${unit}`;
    }
    function heatLevel(value,max) {
      if(!value||!max)return 0;
      return Math.max(1,Math.min(5,Math.ceil(Math.sqrt(value/max)*5)));
    }
    /* Sasha anatomical body map (restored 2026-09-10 at user's request; the
       style revisit is pinned in UX-BACKLOG.md). SVG regions carry data-muscle;
       this maps them to the exercise library's muscle names. */
    const bodyMapMuscleAliases={
      'upper-chest':'chest','lower-chest':'chest','front-delts':'shoulders','rear-delts':'shoulders','side-delts':'shoulders',
      'quads':'quadriceps','hamstrings':'hamstrings','glutes':'glutes','forearms':'forearms','abs':'abdominals',
      'lats':'lats','lower-back':'lower back','traps':'traps','triceps':'triceps','biceps':'biceps','calves':'calves','obliques':'abdominals'
    };
    let bodyMapTemplatePromise;
    function loadBodyMapTemplate(){
      if(!bodyMapTemplatePromise)bodyMapTemplatePromise=fetch('data/sasha-male-body.svg').then(response=>{if(!response.ok)throw new Error('Body map unavailable');return response.text();}).catch(()=>null);
      return bodyMapTemplatePromise;
    }
    function paintBodyRegion(region,level,label){
      region.classList.add(`heat-${level}`);
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');
      title.textContent=label;region.prepend(title);
    }
    function hydrateBodyMaps(){
      /* Volume heat maps (dashboard + stats): data-volumes holds {muscle: volume}.
         Returns a promise that resolves when hydration completes (user 2026-09-11:
         callers need to wait so scroll restoration happens after the async SVG inject). */
      const volumeHosts=[...document.querySelectorAll('.anatomy-map[data-volumes]:not([data-hydrated])')];
      /* Per-exercise maps (exercise detail): data-primary/data-secondary hold
         comma-separated library muscle names; primary = full heat, secondary = soft. */
      const exerciseHosts=[...document.querySelectorAll('.anatomy-map[data-primary]:not([data-hydrated])')];
      const hosts=volumeHosts.concat(exerciseHosts);
      if(!hosts.length)return Promise.resolve();
      return loadBodyMapTemplate().then(template=>{
        hosts.forEach(host=>{
          if(!template){host.innerHTML='<div class="chart-empty">Body map unavailable.</div>';return;}
          host.innerHTML=template;
          const regions=[...host.querySelectorAll('[data-muscle]')];
          if(host.dataset.primary!==undefined){
            const primary=new Set(host.dataset.primary.split(',').filter(Boolean));
            const secondary=new Set(host.dataset.secondary.split(',').filter(Boolean));
            regions.forEach(region=>{
              const muscle=bodyMapMuscleAliases[region.dataset.muscle];
              const kind=muscle&&primary.has(muscle)?'primary':muscle&&secondary.has(muscle)?'secondary':null;
              paintBodyRegion(region,kind==='primary'?5:kind==='secondary'?2:0,`${titleCase(muscle||region.dataset.muscle)}${kind?` · ${kind}`:' · not targeted'}`);
            });
          }else{
            const volumes=JSON.parse(decodeURIComponent(host.dataset.volumes));
            const regionValue=region=>Number(volumes[bodyMapMuscleAliases[region.dataset.muscle]]||0);
            const max=Math.max(1,...regions.map(regionValue));
            regions.forEach(region=>{
              const muscle=bodyMapMuscleAliases[region.dataset.muscle];
              const value=regionValue(region);
              paintBodyRegion(region,heatLevel(value,max),`${titleCase(muscle||region.dataset.muscle)} · ${formatVolume(value)}`);
            });
          }
          host.dataset.hydrated='true';
        });
      });
    }
    function muscleHeatmapMarkup(volumes,compact=false) {
      /* Anatomical muscle map, always the worked view (user 2026-09-11:
         the #72 Worked/Unworked toggle was removed). */
      const rows=Object.entries(volumes).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      if(!rows.length)return '<div class="chart-empty">No weighted training volume in this period.</div>';
      const max=Math.max(1,...rows.map(([,v])=>v));
      const shown=compact?rows.slice(0,4):rows;
      const encoded=encodeURIComponent(JSON.stringify(volumes));
      const map=`<div class="anatomy-map" data-volumes="${encoded}"><div class="chart-empty">Loading anatomical map\u2026</div></div>`;
      const list=shown.map(([muscle,value])=>`<div class="heatmap-row"><i class="heatmap-swatch heat-${heatLevel(value,max)}"></i><span>${escapeHtml(titleCase(muscle))}</span><strong>${formatVolume(value)}</strong></div>`).join('');
      const legend=compact?'':`<div class="heatmap-legend"><span>Less</span><i class="heatmap-gradient"></i><span>More volume</span></div>`;
      return `<div class="heatmap-shell">${map}<div><div class="heatmap-list">${list}</div>${legend}</div></div>`;
    }
    /* Per-exercise body map for the exercise detail page (user 2026-09-10).
       The legend carries the actual muscle names with their colors, so the
       "muscles worked" live with the map instead of the top of the page. */
    function exerciseBodyMapMarkup(ex){
      const primary=(ex.primary||[]).join(','),secondary=(ex.secondary||[]).join(',');
      const pNames=(ex.primary||[]).map(titleCase).join(', '),sNames=(ex.secondary||[]).map(titleCase).join(', ');
      const legend=[pNames?`<span><i class="heatmap-swatch heat-5"></i>Primary \u00b7 ${escapeHtml(pNames)}</span>`:'',sNames?`<span><i class="heatmap-swatch heat-2"></i>Secondary \u00b7 ${escapeHtml(sNames)}</span>`:''].join('');
      return `<div class="anatomy-map exercise-map" data-primary="${escapeHtml(primary)}" data-secondary="${escapeHtml(secondary)}"><div class="chart-empty">Loading anatomical map\u2026</div></div><div class="exercise-map-legend">${legend}</div>`;
    }

    /* #4: tapping a future calendar date shows the upcoming program workout
       for that date — the program week it falls in plus the next suggested
       session, with a one-tap start. */
    function upcomingProgramMarkup(selDate){
      const program=workoutState.activeProgram;
      if(!program)return '<p>Nothing logged for this date.</p>';
      const week=programWeekAtDate(program,selDate), next=suggestedProgramWorkout(program);
      const exerciseCount=next?.template?.exercises?.length||0;
      return `<div class="upcoming-program"><p class="upcoming-kicker">Upcoming · ${escapeHtml(program.name)}</p>${next?`<p class="upcoming-name"><strong>${escapeHtml(next.name)}</strong></p><p class="section-note">Week ${week} of ${program.length}${exerciseCount?` · ${exerciseCount} exercise${exerciseCount===1?'':'s'}`:''}</p><button class="secondary-button" id="startUpcomingProgramWorkout" type="button">Start this workout</button>`:`<p class="section-note">Week ${week} of ${program.length}. Add exercises to a program workout to get a suggestion here.</p>`}</div>`;
    }
    function renderDashboard() {
      const now=new Date();
      const strip=$('#weekStrip'),start=new Date(now);start.setHours(12,0,0,0);start.setDate(now.getDate()-((now.getDay()+6)%7)+(state.calendarWeekOffset*7));
      const end=new Date(start);end.setDate(start.getDate()+6);
      const sameMonth=start.getMonth()===end.getMonth();
      $('#calendarWeekLabel').textContent=sameMonth?`${new Intl.DateTimeFormat('en-US',{month:'short'}).format(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`:`${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(start)} – ${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(end)}`;
      $('#nextWeek').disabled=state.calendarWeekOffset>=0;
      strip.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const iso=isoForDate(d);const dayWorkouts=workoutState.completed.filter(w=>w.date===iso);const selected=state.selectedDashboardDate===iso;return `<button type="button" class="day-chip ${d.toDateString()===now.toDateString()?'today':''} ${dayWorkouts.length?'has-workout':''} ${dayWorkouts.length?'has-real-workout':''} ${selected?'selected':''}" data-calendar-date="${iso}" aria-pressed="${selected}" aria-label="${new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(d)}${dayWorkouts.length?' · Workout logged':''}"><span>${new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d)}</span><strong>${d.getDate()}</strong><em aria-hidden="true">${dayWorkouts.length?'<i></i>':''}</em></button>`}).join('');
      document.querySelectorAll('[data-calendar-date]').forEach(button=>button.addEventListener('click',()=>{state.selectedDashboardDate=state.selectedDashboardDate===button.dataset.calendarDate?null:button.dataset.calendarDate;renderDashboard();}));
      $('#previousWeek').onclick=()=>{state.calendarWeekOffset-=1;state.selectedDashboardDate=null;renderDashboard();};
      $('#nextWeek').onclick=()=>{if(state.calendarWeekOffset<0){state.calendarWeekOffset+=1;state.selectedDashboardDate=null;renderDashboard();}};
      let weekSwipeStart=null;
      strip.onpointerdown=event=>{weekSwipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};};
      strip.onpointermove=event=>{if(!weekSwipeStart||event.pointerId!==weekSwipeStart.id)return;if(Math.abs(event.clientX-weekSwipeStart.x)>12)strip.setPointerCapture?.(event.pointerId);};
      strip.onpointercancel=()=>{weekSwipeStart=null;};
      strip.onpointerup=event=>{if(!weekSwipeStart||event.pointerId!==weekSwipeStart.id)return;const dx=event.clientX-weekSwipeStart.x,dy=event.clientY-weekSwipeStart.y;weekSwipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){if(dx>0)$('#previousWeek').click();else $('#nextWeek').click();}};
      const selectedWorkouts=state.selectedDashboardDate?workoutState.completed.filter(w=>w.date===state.selectedDashboardDate):workoutState.completed.slice(0,4);
      /* #4: future dates show the upcoming program workout instead of history. */
      const selectedIsFuture=!!state.selectedDashboardDate&&state.selectedDashboardDate>localIsoDate();
      if(state.selectedDashboardDate){const label=formatLogDate(state.selectedDashboardDate);$('#calendarSummary').textContent=selectedIsFuture?`${label} · Upcoming program`:`${label} · ${selectedWorkouts.length?`${selectedWorkouts.length} workout${selectedWorkouts.length===1?'':'s'}`:'No workouts'}`;$('#dashRecentTitle').textContent=selectedIsFuture?'Upcoming':label;}else{const summary=$('#calendarSummary');if(state.calendarWeekOffset===0){summary.textContent='This week.';}else{summary.innerHTML='<button type="button" class="link-button" id="gotoThisWeek">Go to this week.</button>';const go=$('#gotoThisWeek');if(go)go.addEventListener('click',()=>{state.calendarWeekOffset=0;state.selectedDashboardDate=null;renderDashboard();});}$('#dashRecentTitle').textContent='Recent workouts';}
      const p=workoutState.activeProgram; $('#dashboardProgram').innerHTML=p?`<p><strong>${escapeHtml(p.name)}</strong><br>Week ${programWeek(p)} of ${p.length} · ${p.workouts.length} workouts in rotation</p><button class="secondary-button" id="openDashboardProgram" type="button">Open program</button>`:'<p>No active program yet. Build a training block when you’re ready.</p><button class="secondary-button" id="openDashboardProgram" type="button">Create program</button>';
      $('#openDashboardProgram').addEventListener('click',()=>showProgram());
      const periodLabels={today:'Today',week:'Week',month:'Month',year:'Year',all:'All time'};
      $('#dashPeriodTabs').innerHTML=Object.entries(periodLabels).map(([key,label])=>`<button class="period-tab" type="button" data-dash-period="${key}" aria-pressed="${state.dashboardPeriod===key}">${label}</button>`).join('');
      document.querySelectorAll('[data-dash-period]').forEach(button=>button.addEventListener('click',()=>{
        if(state.dashboardPeriod===button.dataset.dashPeriod)return;
        state.dashboardPeriod=button.dataset.dashPeriod;schedulePersist();
        const scrollY=window.scrollY;
        /* Different periods render different content heights — restore the
           scroll position so the page doesn't jump (user 2026-09-11).
           The body-map SVG hydrates async, so wait for it before restoring. */
        const restoreScroll=()=>requestAnimationFrame(()=>window.scrollTo(0,scrollY));
        const hyd=renderDashboard();
        if(hyd&&hyd.then)hyd.then(restoreScroll,restoreScroll);else restoreScroll();
        /* The re-render destroys the tapped button; refocus its replacement so iOS
           Safari doesn't drop focus to <body> and scroll to the top (user 2026-09-10). */
        document.querySelector('[data-dash-period="'+state.dashboardPeriod+'"]')?.focus({preventScroll:true});
      }));
      const periodWorkouts=workoutsForPeriod(state.dashboardPeriod), periodSets=periodWorkouts.flatMap(w=>w.exercises.flatMap(e=>e.sets)), volume=periodSets.reduce((n,set)=>n+setVolume(set),0);
      $('#dashboardStats').innerHTML=`<div class="stats-panel"><strong>${periodWorkouts.length}</strong><span>Completed workouts</span></div><div class="stats-panel"><strong>${periodSets.length}</strong><span>Completed sets</span></div><div class="stats-panel"><strong>${Math.round(displayVolume(volume)).toLocaleString()}</strong><span>Total ${weightUnit()} volume</span></div>`;
      const muscles=muscleCounts(periodWorkouts),volumes=muscleVolumes(periodWorkouts);$('#dashboardMuscles').innerHTML=Object.keys(muscles).length?Object.entries(muscles).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m,n])=>`<span class="tag primary">${escapeHtml(m)} · ${n}</span>`).join(''):'<span class="section-note">No muscles logged in this period.</span>';
      $('#dashboardHeatmap').innerHTML=muscleHeatmapMarkup(volumes,true);
      const dashHydration=hydrateBodyMaps();
      renderBlindspots(volumes,'#dashBlindspots');
      const selDate=state.selectedDashboardDate, todayIso=localIsoDate();
      /* #4: future dates render the upcoming program workout (see
         upcomingProgramMarkup) instead of the dead "nothing logged" note. */
      const futureDateCopy=selectedIsFuture?upcomingProgramMarkup(selDate):'';
      const emptyDateCopy=futureDateCopy||(selDate===todayIso?'<p>No workout logged yet today. <button class="filter-clear" id="startSelectedDateWorkout" type="button">Start workout</button></p>':'<p>No workout logged for this date. <button class="filter-clear" id="startSelectedDateWorkout" type="button">Log a workout</button></p>');
      $('#dashboardRecent').innerHTML=selectedWorkouts.length?selectedWorkouts.map(w=>{const setCount=w.exercises.flatMap(e=>e.sets).length;const detail=state.selectedDashboardDate?`${w.exercises.length} exercise${w.exercises.length===1?'':'s'} · ${setCount} set${setCount===1?'':'s'}`:formatLogDate(w.date);return `<button class="recent-workout" type="button" data-workout-id="${escapeHtml(w.id)}"><span><strong>${escapeHtml(w.name)}${isSampleWorkout(w)?'<span class="sample-label">Sample</span>':''}</strong><small>${escapeHtml(detail)}</small></span><span aria-hidden="true">›</span></button>`;}).join(''):state.selectedDashboardDate?emptyDateCopy:'<p>No completed workouts yet. Your first session will appear here.</p>';
      document.querySelectorAll('[data-workout-id]').forEach(b=>b.addEventListener('click',()=>{state.workoutDetailReturn='dashboard';showWorkouts();renderCompletedWorkout(workoutState.completed.find(w=>w.id===b.dataset.workoutId));}));
      $('#startSelectedDateWorkout')?.addEventListener('click',()=>{const date=state.selectedDashboardDate;showWorkouts();startBlankWorkout();workoutState.draft.date=date;renderWorkoutScreen();});
      /* #4: one-tap start for the upcoming program workout shown on future dates. */
      $('#startUpcomingProgramWorkout')?.addEventListener('click',()=>{const program=workoutState.activeProgram,next=program&&suggestedProgramWorkout(program);if(program&&next)startProgramWorkout(program,next);});
      return dashHydration;
    }
    /* Muscle blindspots: library muscles with zero weighted volume in the
       period, always visible as dashed pills (user 2026-09-10 — no toggle).
       #13 (user 2026-09-11): sectioned out — a horizontal divider, then a
       "Blind spots" label, then the pills. Shared by the Stats muscle map
       and the Home At-a-glance card. */
    function renderBlindspots(volumes,wrapSelector){
      const wrap=$(wrapSelector||'#blindspotWrap');if(!wrap)return;
      const allMuscles=[...new Set(exercises.flatMap(ex=>[...(ex.primary||[]),...(ex.secondary||[])].map(m=>String(m).toLowerCase())))].sort();
      const missing=allMuscles.filter(m=>!volumes[m]);
      if(!missing.length){wrap.innerHTML='';return;}
      wrap.innerHTML=`<div class="blindspot-section"><hr class="blindspot-rule"><p class="blindspot-label">Blind spots</p><div class="tag-row blindspot-list">${missing.map(m=>`<span class="tag blindspot-tag">${escapeHtml(titleCase(m))}</span>`).join('')}</div></div>`;
    }
    function renderStats() {
      const labels={today:'Today',week:'Week',month:'Month',year:'Year',all:'All time'};
      $('#statsPeriodTabs').innerHTML=Object.entries(labels).map(([key,label])=>`<button class="period-tab" type="button" data-stats-period="${key}" aria-pressed="${state.statsPeriod===key}">${label}</button>`).join('');
      document.querySelectorAll('[data-stats-period]').forEach(button=>button.addEventListener('click',()=>{
        if(state.statsPeriod===button.dataset.statsPeriod)return;
        state.statsPeriod=button.dataset.statsPeriod;schedulePersist();renderStats();
        /* Same focus-drop scroll-to-top guard as the dashboard tabs (user 2026-09-10). */
        document.querySelector('[data-stats-period="'+state.statsPeriod+'"]')?.focus({preventScroll:true});
      }));
      const workouts=workoutsForPeriod(state.statsPeriod), sets=workouts.flatMap(w=>w.exercises.flatMap(e=>e.sets)), volume=sets.reduce((n,set)=>n+setVolume(set),0);
      $('#statsGrid').innerHTML=`<div class="stats-panel"><strong>${workouts.length}</strong><span>Completed workouts</span></div><div class="stats-panel"><strong>${sets.length}</strong><span>Completed sets</span></div><div class="stats-panel"><strong>${Math.round(displayVolume(volume)).toLocaleString()}</strong><span>Total ${weightUnit()} volume</span></div>`;
      const muscles=muscleCounts(workouts), volumes=muscleVolumes(workouts);
      $('#muscleHeatmap').innerHTML=muscleHeatmapMarkup(volumes,false);hydrateBodyMaps();
      $('#muscleStats').innerHTML=Object.keys(muscles).length?`<div class="tag-row">${Object.entries(muscles).sort((a,b)=>b[1]-a[1]).map(([m,n])=>`<span class="tag primary">${escapeHtml(m)} · ${n} sets</span>`).join('')}</div>`:'<p class="section-note">Complete a workout to start building muscle-level stats.</p>';
      renderBlindspots(volumes);
      renderMuscleAnalysis(workouts,state.statsPeriod);
      renderExerciseTrends();
      const allWorkouts=workoutState.completed,monday=new Date();monday.setHours(12,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const weeks=Array.from({length:10},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()-(7*(9-i)));const next=new Date(d);next.setDate(d.getDate()+7);const startIso=isoForDate(d),endIso=isoForDate(next);const value=allWorkouts.filter(w=>w.date>=startIso&&w.date<endIso).flatMap(w=>w.exercises.flatMap(e=>e.sets)).reduce((n,set)=>n+setVolume(set),0);return{label:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(d),shortLabel:new Intl.DateTimeFormat('en-US',{month:'numeric',day:'numeric'}).format(d),value};});
      $('#volumeChart').innerHTML=allWorkouts.length?lineChart(weeks,value=>`${Math.round(displayVolume(value)).toLocaleString()} ${weightUnit()}`):'<div class="chart-empty">Complete a workout to start the weekly volume chart.</div>';
    }
    /* #8: lightweight SVG bar chart (no libs). Same 620x190 viewBox as
       lineChart so it scales identically at 393px. */
    function barChart(points, valueLabel = value => `${Math.round(value).toLocaleString()}`) {
      if (!points.length) return '<div class="chart-empty">Complete workouts to start this chart.</div>';
      const width=620, height=190, left=42, right=14, top=14, bottom=30;
      const values=points.map(p=>Number(p.value)||0), max=Math.max(...values,1);
      const plotW=width-left-right, plotH=height-top-bottom;
      const n=points.length, slot=plotW/n, barW=Math.min(36,Math.max(8,slot*0.55));
      const bars=points.map((p,i)=>{
        const h=(Number(p.value)||0)/max*plotH;
        const x=left+i*slot+(slot-barW)/2, y=top+plotH-h;
        return `<rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(2,h).toFixed(1)}" rx="3"><title>${escapeHtml(p.label)}: ${escapeHtml(valueLabel(p.value))}</title></rect>${(i===0||i===n-1||n<6)?`<text class="chart-label" x="${(x+barW/2).toFixed(1)}" y="${height-8}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${escapeHtml(p.shortLabel||p.label)}</text>`:''}`;
      }).join('');
      return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(points.map(p=>`${p.label}: ${valueLabel(p.value)}`).join(', '))}"><line class="chart-axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"/><line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"/><text class="chart-label" x="${left-6}" y="${top+4}" text-anchor="end">${escapeHtml(valueLabel(max))}</text><text class="chart-label" x="${left-6}" y="${height-bottom}" text-anchor="end">${escapeHtml(valueLabel(0))}</text>${bars}</svg>`;
    }
    /* #8: per-session e1RM + volume for one exercise, oldest session first. */
    function exerciseTrendData(exerciseId) {
      const logs=getExerciseLogs(exerciseId).slice().reverse();
      const e1rm=[], volume=[];
      logs.forEach(session=>{
        const shortLabel=String(session.date).replace(/, \d{4}/,'');
        const sets=session.sets.filter(s=>Number(s.w)>0&&Number(s.r)>0);
        if(sets.length)e1rm.push({label:session.date,shortLabel,value:Math.round(Math.max(...sets.map(estimate1RM)))});
        const vol=session.sets.reduce((sum,s)=>sum+setVolume(s),0);
        if(vol>0)volume.push({label:session.date,shortLabel,value:vol});
      });
      return {e1rm,volume};
    }
    /* #8: Exercise trends section — picker chips + e1RM line + volume bars.
       Selection is session-only (module-local); defaults to most-recent. */
    let statsTrendExerciseId=null;
    function renderExerciseTrends() {
      const picker=$('#exerciseTrendPicker'), e1rmWrap=$('#exerciseTrendChart'), volWrap=$('#exerciseVolumeChart');
      if(!picker||!e1rmWrap||!volWrap)return;
      const ids=recentExerciseIds().slice(0,12);
      if(!ids.length){
        picker.innerHTML='';
        picker.style.display='none';
        e1rmWrap.innerHTML='<div class="chart-empty">Log a workout to see exercise trends.</div>';
        volWrap.innerHTML='';
        volWrap.style.display='none';
        return;
      }
      picker.style.display='';
      volWrap.style.display='';
      if(!statsTrendExerciseId||!ids.includes(statsTrendExerciseId))statsTrendExerciseId=ids[0];
      const ex=exercises.find(x=>x.id===statsTrendExerciseId);
      picker.innerHTML=ids.map(id=>{
        const name=exercises.find(x=>x.id===id)?.name||'Exercise';
        return `<button type="button" class="trend-chip${id===statsTrendExerciseId?' is-active':''}" data-trend-exercise="${escapeHtml(id)}" aria-pressed="${id===statsTrendExerciseId}">${escapeHtml(name)}</button>`;
      }).join('');
      picker.querySelectorAll('[data-trend-exercise]').forEach(btn=>btn.addEventListener('click',()=>{
        if(statsTrendExerciseId===btn.dataset.trendExercise)return;
        statsTrendExerciseId=btn.dataset.trendExercise;
        const y=window.scrollY;
        renderExerciseTrends();
        window.scrollTo(0,y);
        picker.querySelector(`[data-trend-exercise="${CSS.escape(statsTrendExerciseId)}"]`)?.scrollIntoView({block:'nearest',inline:'center'});
      }));
      const {e1rm,volume}=exerciseTrendData(statsTrendExerciseId);
      const isBW=(ex?.equipment||'').toLowerCase()==='body only';
      e1rmWrap.innerHTML=`<p class="chart-kicker">Estimated 1RM · ${escapeHtml(ex?.name||'')}</p>`+(isBW?'<div class="chart-empty">Bodyweight trend uses reps and added load.</div>':lineChart(e1rm,v=>`${Math.round(displayWeight(v))} ${weightUnit()}`));
      if(volume.length){
        volWrap.style.display='';
        volWrap.innerHTML=`<p class="chart-kicker">Volume per session · ${escapeHtml(ex?.name||'')}</p>`+barChart(volume,v=>`${Math.round(displayVolume(v)).toLocaleString()} ${weightUnit()}`);
      }else{
        volWrap.innerHTML='';
        volWrap.style.display='none';
      }
    }
    /* #7: which exercises drove a muscle's volume in the period (primary =
       full set volume, secondary = 45%, matching muscleVolumes). */
    function exercisesForMuscle(muscle, workouts, bySets=false) {
      const m=String(muscle).toLowerCase(), stats={};
      workouts.forEach(w=>w.exercises.forEach(item=>{
        const ex=exercises.find(x=>x.id===item.exerciseId); if(!ex)return;
        const lower=a=>(a||[]).map(s=>String(s).toLowerCase());
        const isPrimary=lower(ex.primary).includes(m), isSecondary=lower(ex.secondary).includes(m);
        if(!isPrimary&&!isSecondary)return;
        const vol=item.sets.reduce((sum,s)=>sum+setVolume(s),0)*(isPrimary?1:0.45);
        const entry=stats[item.exerciseId]||(stats[item.exerciseId]={volume:0,sets:0});
        entry.volume+=vol; entry.sets+=item.sets.length;
      }));
      /* #7 drill-down: in Sets mode bodyweight work (volume 0, sets > 0)
         must still appear, and drivers sort by the active metric. */
      return Object.entries(stats).filter(([,e])=>bySets?e.sets>0:e.volume>0).sort((a,b)=>bySets?b[1].sets-a[1].sets:b[1].volume-a[1].volume).slice(0,4);
    }
    /* #7: muscle drill-down expansion state (session-only). */
    let expandedMuscle=null;
    
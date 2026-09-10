
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
        if(kind)rows.push({exerciseId:item.exerciseId,date:workout.date,kind,value:kind.startsWith('Estimated')?`${Math.round(best)} lb`:`${weight} lb`});
      }));
      return rows.slice(0,6);
    }
    function renderMuscleAnalysis(workouts,period) {
      const volumes=muscleVolumes(workouts), rows=Object.entries(volumes).filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]);
      const max=Math.max(1,...rows.map(([,value])=>value));
      $('#muscleVolumeBreakdown').innerHTML=rows.length?rows.slice(0,10).map(([muscle,value])=>`<div class="muscle-volume-row"><strong class="analysis-label">${escapeHtml(muscle)}</strong><span class="analysis-track"><i class="analysis-fill" style="width:${Math.max(3,(value/max)*100).toFixed(1)}%"></i></span><span class="analysis-value">${formatVolume(value)}</span></div>`).join(''):'<p class="section-note">No weighted muscle volume in this period.</p>';
      const focus={Strength:0,Hypertrophy:0,Endurance:0};
      workouts.forEach(workout=>workout.exercises.forEach(item=>{if((item.tracking||'reps')==='time')return;item.sets.forEach(set=>{if((set.tags||[]).some(tag=>tag.toLowerCase()==='warmup'))return;const reps=Number(set.r);if(!reps)return;if(reps<=5)focus.Strength+=1;else if(reps<=12)focus.Hypertrophy+=1;else focus.Endurance+=1;});}));
      const focusTotal=Object.values(focus).reduce((sum,value)=>sum+value,0);
      $('#trainingFocus').innerHTML=focusTotal?Object.entries(focus).map(([name,value])=>{const share=Math.round(value/focusTotal*100);return `<div class="focus-key"><strong>${name}</strong><span class="analysis-track"><i class="analysis-fill" style="width:${share}%"></i></span><span class="analysis-value">${share}%</span></div>`;}).join(''):'<p class="section-note">Complete rep-based working sets to see your training focus.</p>';
      const exerciseVolumes={};workouts.forEach(workout=>workout.exercises.forEach(item=>{exerciseVolumes[item.exerciseId]=(exerciseVolumes[item.exerciseId]||0)+item.sets.reduce((sum,set)=>sum+setVolume(set),0);}));
      const top=Object.entries(exerciseVolumes).filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]).slice(0,6);
      $('#topExercises').innerHTML=top.length?`<div class="action-list">${top.map(([id,value])=>`<button class="action-row" type="button" data-stat-exercise="${escapeHtml(id)}"><span><strong>${escapeHtml(exercises.find(ex=>ex.id===id)?.name||'Exercise')}</strong><span>Open history and trend</span></span><span class="action-row-value">${formatVolume(value)}</span></button>`).join('')}</div>`:'<p class="section-note">No weighted exercise volume in this period.</p>';
      const prs=recentPRRows(workouts);
      $('#recentPRs').innerHTML=prs.length?`<div class="action-list">${prs.map(pr=>`<button class="action-row" type="button" data-stat-exercise="${escapeHtml(pr.exerciseId)}"><span><strong>${escapeHtml(exercises.find(ex=>ex.id===pr.exerciseId)?.name||'Exercise')}</strong><span>${escapeHtml(pr.kind)} · ${escapeHtml(formatLogDate(pr.date))}</span></span><span class="action-row-value">${escapeHtml(pr.value)}</span></button>`).join('')}</div>`:'<p class="section-note">No new PRs in this period yet. Keep logging completed sets—your next one will show here.</p>';
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
    function formatVolume(value) {
      const n=Math.round(Number(value)||0); return n>=1000?`${(n/1000).toFixed(n>=10000?0:1)}k lb`:`${n.toLocaleString()} lb`;
    }
    function heatLevel(value,max) {
      if(!value||!max)return 0;
      return Math.max(1,Math.min(5,Math.ceil(Math.sqrt(value/max)*5)));
    }
    function bodyMapSvg(view) {
      const front=view==='front';
      return `<figure class="body-figure"><svg viewBox="0 0 120 260" role="img" aria-label="${front?'Front':'Back'} muscle volume silhouette">
        <circle class="body-silhouette" cx="60" cy="22" r="14"></circle><path class="body-silhouette" d="M43 40 Q60 34 77 40 L91 70 82 125 76 155 84 243 66 243 60 172 54 243 36 243 44 155 38 125 29 70Z"></path>
        ${front?`<ellipse class="body-region" data-muscle="shoulders" cx="37" cy="57" rx="11" ry="9"></ellipse><ellipse class="body-region" data-muscle="shoulders" cx="83" cy="57" rx="11" ry="9"></ellipse><path class="body-region" data-muscle="chest" d="M45 54 Q60 47 59 75 Q46 77 42 66Z"></path><path class="body-region" data-muscle="chest" d="M75 54 Q60 47 61 75 Q74 77 78 66Z"></path><rect class="body-region" data-muscle="biceps" x="29" y="70" width="9" height="30" rx="4"></rect><rect class="body-region" data-muscle="biceps" x="82" y="70" width="9" height="30" rx="4"></rect><rect class="body-region" data-muscle="forearms" x="25" y="101" width="8" height="28" rx="4"></rect><rect class="body-region" data-muscle="forearms" x="87" y="101" width="8" height="28" rx="4"></rect><rect class="body-region" data-muscle="abdominals" x="49" y="78" width="22" height="49" rx="8"></rect><path class="body-region" data-muscle="quadriceps" d="M44 139 Q57 135 57 170 L53 204 39 202Z"></path><path class="body-region" data-muscle="quadriceps" d="M76 139 Q63 135 63 170 L67 204 81 202Z"></path><path class="body-region" data-muscle="calves" d="M39 205 53 207 50 239 38 239Z"></path><path class="body-region" data-muscle="calves" d="M81 205 67 207 70 239 82 239Z"></path>`:`<path class="body-region" data-muscle="traps" d="M46 43 60 38 74 43 68 61 52 61Z"></path><path class="body-region" data-muscle="lats" d="M42 61 Q51 57 58 67 L54 108 40 116 35 78Z"></path><path class="body-region" data-muscle="lats" d="M78 61 Q69 57 62 67 L66 108 80 116 85 78Z"></path><rect class="body-region" data-muscle="triceps" x="29" y="69" width="9" height="31" rx="4"></rect><rect class="body-region" data-muscle="triceps" x="82" y="69" width="9" height="31" rx="4"></rect><rect class="body-region" data-muscle="lower back" x="47" y="99" width="26" height="30" rx="8"></rect><ellipse class="body-region" data-muscle="glutes" cx="49" cy="143" rx="12" ry="13"></ellipse><ellipse class="body-region" data-muscle="glutes" cx="71" cy="143" rx="12" ry="13"></ellipse><path class="body-region" data-muscle="hamstrings" d="M41 157 Q53 153 57 163 L53 203 39 201Z"></path><path class="body-region" data-muscle="hamstrings" d="M79 157 Q67 153 63 163 L67 203 81 201Z"></path><path class="body-region" data-muscle="calves" d="M39 205 53 207 50 239 38 239Z"></path><path class="body-region" data-muscle="calves" d="M81 205 67 207 70 239 82 239Z"></path>`}
      </svg><figcaption>${front?'Front':'Back'}</figcaption></figure>`;
    }
    function hydrateBodyMaps(){
      document.querySelectorAll('.anatomy-map[data-volumes]').forEach(host=>{
        if(host.dataset.hydrated)return;
        const volumes=JSON.parse(decodeURIComponent(host.dataset.volumes));
        const regions=[...host.querySelectorAll('[data-muscle]')];
        const regionValue=region=>Number(volumes[region.dataset.muscle]||0);
        const max=Math.max(1,...regions.map(regionValue));
        regions.forEach(region=>{
          const muscle=region.dataset.muscle;
          const value=regionValue(region);
          region.classList.add(`heat-${heatLevel(value,max)}`);
          const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`${titleCase(muscle)} · ${formatVolume(value)}`;region.prepend(title);
        });
        host.dataset.hydrated='true';
      });
    }
    function muscleHeatmapMarkup(volumes,compact=false) {
      const rows=Object.entries(volumes).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      if(!rows.length)return '<div class="chart-empty">No weighted training volume in this period.</div>';
      const max=Math.max(...rows.map(([,v])=>v)),shown=compact?rows.slice(0,4):rows;
      const encoded=encodeURIComponent(JSON.stringify(volumes));
      const body=`<div class="body-map-grid">${bodyMapSvg('front')}${bodyMapSvg('back')}</div>`;
      return `<div class="heatmap-shell"><div class="anatomy-map" data-volumes="${encoded}">${body}</div><div><div class="heatmap-list">${shown.map(([muscle,value])=>`<div class="heatmap-row"><i class="heatmap-swatch heat-${heatLevel(value,max)}"></i><span>${escapeHtml(titleCase(muscle))}</span><strong>${formatVolume(value)}</strong></div>`).join('')}</div>${compact?'':`<div class="heatmap-legend"><span>Less</span><i class="heatmap-gradient"></i><span>More volume</span></div>`}</div></div>`;
    }
    function renderDashboard() {
      const now=new Date(); $('#dashboardDate').textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(now);
      const strip=$('#weekStrip'),start=new Date(now);start.setHours(12,0,0,0);start.setDate(now.getDate()-((now.getDay()+6)%7)+(state.calendarWeekOffset*7));
      const end=new Date(start);end.setDate(start.getDate()+6);
      const sameMonth=start.getMonth()===end.getMonth();
      $('#calendarWeekLabel').textContent=sameMonth?`${new Intl.DateTimeFormat('en-US',{month:'short'}).format(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`:`${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(start)} – ${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(end)}`;
      $('#nextWeek').disabled=state.calendarWeekOffset>=0;
      strip.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const iso=isoForDate(d);const dayWorkouts=workoutState.completed.filter(w=>w.date===iso);const selected=state.selectedDashboardDate===iso;return `<button type="button" class="day-chip ${d.toDateString()===now.toDateString()?'today':''} ${dayWorkouts.length?'has-workout':''} ${dayWorkouts.length?'has-real-workout':''} ${selected?'selected':''}" data-calendar-date="${iso}" aria-pressed="${selected}" aria-label="${new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(d)}${dayWorkouts.length?' · Workout logged':''}"><span>${new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d)}</span><strong>${d.getDate()}</strong><em>${dayWorkouts.length?`<i aria-hidden="true"></i>Logged`:'&nbsp;'}</em></button>`}).join('');
      document.querySelectorAll('[data-calendar-date]').forEach(button=>button.addEventListener('click',()=>{state.selectedDashboardDate=state.selectedDashboardDate===button.dataset.calendarDate?null:button.dataset.calendarDate;renderDashboard();}));
      $('#previousWeek').onclick=()=>{state.calendarWeekOffset-=1;state.selectedDashboardDate=null;renderDashboard();};
      $('#nextWeek').onclick=()=>{if(state.calendarWeekOffset<0){state.calendarWeekOffset+=1;state.selectedDashboardDate=null;renderDashboard();}};
      let weekSwipeStart=null;
      strip.onpointerdown=event=>{weekSwipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};strip.setPointerCapture?.(event.pointerId);};
      strip.onpointerup=event=>{if(!weekSwipeStart||event.pointerId!==weekSwipeStart.id)return;const dx=event.clientX-weekSwipeStart.x,dy=event.clientY-weekSwipeStart.y;weekSwipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){if(dx>0)$('#previousWeek').click();else $('#nextWeek').click();}};
      const selectedWorkouts=state.selectedDashboardDate?workoutState.completed.filter(w=>w.date===state.selectedDashboardDate):workoutState.completed.slice(0,4);
      if(state.selectedDashboardDate){const label=formatLogDate(state.selectedDashboardDate);$('#calendarSummary').textContent=`${label} · ${selectedWorkouts.length?`${selectedWorkouts.length} workout${selectedWorkouts.length===1?'':'s'}`:'No workouts'}`;$('#dashRecentTitle').textContent=label;}else{$('#calendarSummary').textContent=state.calendarWeekOffset===0?'This week. Tap a day to see its workouts.':'Earlier week. Tap a day to see its workouts.';$('#dashRecentTitle').textContent='Recent workouts';}
      const p=workoutState.activeProgram; $('#dashboardProgram').innerHTML=p?`<p><strong>${escapeHtml(p.name)}</strong><br>Week ${programWeek(p)} of ${p.length} · ${p.workouts.length} workouts in rotation</p><button class="secondary-button" id="openDashboardProgram" type="button">Open program</button>`:'<p>No active program yet. Build a training block when you’re ready.</p><button class="secondary-button" id="openDashboardProgram" type="button">Create program</button>';
      $('#openDashboardProgram').addEventListener('click',()=>showProgram());
      const periodLabels={today:'Today',week:'This week',month:'This month',year:'This year',all:'All time'};
      $('#periodLabel').textContent=periodLabels[state.dashboardPeriod];
      $('#periodMenu').innerHTML=Object.entries(periodLabels).map(([key,label])=>`<button class="period-option" type="button" role="menuitemradio" aria-checked="${state.dashboardPeriod===key}" data-period="${key}">${label}</button>`).join('');
      const periodWorkouts=workoutsForPeriod(state.dashboardPeriod), periodSets=periodWorkouts.flatMap(w=>w.exercises.flatMap(e=>e.sets)), volume=periodSets.reduce((n,set)=>n+setVolume(set),0);
      $('#dashboardStats').innerHTML=`<div class="mini-stat"><strong>${periodWorkouts.length}</strong><span>workouts</span></div><div class="mini-stat"><strong>${periodSets.length}</strong><span>sets</span></div><div class="mini-stat"><strong>${Math.round(volume).toLocaleString()}</strong><span>lb volume</span></div>`;
      const muscles=muscleCounts(periodWorkouts),volumes=muscleVolumes(periodWorkouts);$('#dashboardMuscles').innerHTML=Object.keys(muscles).length?Object.entries(muscles).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m,n])=>`<span class="tag primary">${escapeHtml(m)} · ${n}</span>`).join(''):'<span class="section-note">No muscles logged in this period.</span>';
      $('#dashboardHeatmap').innerHTML=muscleHeatmapMarkup(volumes,true);hydrateBodyMaps();
      $('#dashboardRecent').innerHTML=selectedWorkouts.length?selectedWorkouts.map(w=>`<button class="recent-workout" type="button" data-workout-id="${escapeHtml(w.id)}"><strong>${escapeHtml(w.name)}</strong><span>${escapeHtml(formatLogDate(w.date))}</span></button>`).join(''):state.selectedDashboardDate?`<p>No workout logged. <button class="filter-clear" id="startSelectedDateWorkout" type="button">Start one for this date</button></p>`:'<p>No completed workouts yet. Your first session will appear here.</p>';
      $('#periodTrigger').onclick=()=>{const menu=$('#periodMenu');menu.hidden=!menu.hidden;$('#periodTrigger').setAttribute('aria-expanded',String(!menu.hidden));};
      document.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>{state.dashboardPeriod=button.dataset.period;$('#periodMenu').hidden=true;schedulePersist();renderDashboard();}));
      document.querySelectorAll('[data-workout-id]').forEach(b=>b.addEventListener('click',()=>{state.workoutDetailReturn='dashboard';showWorkouts();renderCompletedWorkout(workoutState.completed.find(w=>w.id===b.dataset.workoutId));}));
      $('#startSelectedDateWorkout')?.addEventListener('click',()=>{const date=state.selectedDashboardDate;showWorkouts();startBlankWorkout();workoutState.draft.date=date;renderWorkoutScreen();});
    }
    function renderStats() {
      const labels={today:'Today',week:'Week',month:'Month',year:'Year',all:'All time'};
      $('#statsPeriodTabs').innerHTML=Object.entries(labels).map(([key,label])=>`<button class="period-tab" type="button" data-stats-period="${key}" aria-pressed="${state.statsPeriod===key}">${label}</button>`).join('');
      document.querySelectorAll('[data-stats-period]').forEach(button=>button.addEventListener('click',()=>{state.statsPeriod=button.dataset.statsPeriod;schedulePersist();renderStats();}));
      const workouts=workoutsForPeriod(state.statsPeriod), sets=workouts.flatMap(w=>w.exercises.flatMap(e=>e.sets)), volume=sets.reduce((n,set)=>n+setVolume(set),0);
      $('#statsGrid').innerHTML=`<div class="stats-panel"><strong>${workouts.length}</strong><span>Completed workouts</span></div><div class="stats-panel"><strong>${sets.length}</strong><span>Completed sets</span></div><div class="stats-panel"><strong>${Math.round(volume).toLocaleString()}</strong><span>Total lb volume</span></div>`;
      const muscles=muscleCounts(workouts), volumes=muscleVolumes(workouts);
      $('#muscleHeatmapNote').textContent=`${labels[state.statsPeriod]} · weighted volume by primary and secondary muscle`;
      $('#muscleHeatmap').innerHTML=muscleHeatmapMarkup(volumes,false);hydrateBodyMaps();
      $('#muscleStats').innerHTML=Object.keys(muscles).length?`<div class="tag-row">${Object.entries(muscles).sort((a,b)=>b[1]-a[1]).map(([m,n])=>`<span class="tag primary">${escapeHtml(m)} · ${n} sets</span>`).join('')}</div>`:'<p class="section-note">Complete a workout to start building muscle-level stats.</p>';
      renderMuscleAnalysis(workouts,state.statsPeriod);
      const allWorkouts=workoutState.completed,monday=new Date();monday.setHours(12,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const weeks=Array.from({length:10},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()-(7*(9-i)));const next=new Date(d);next.setDate(d.getDate()+7);const startIso=isoForDate(d),endIso=isoForDate(next);const value=allWorkouts.filter(w=>w.date>=startIso&&w.date<endIso).flatMap(w=>w.exercises.flatMap(e=>e.sets)).reduce((n,set)=>n+setVolume(set),0);return{label:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(d),shortLabel:new Intl.DateTimeFormat('en-US',{month:'numeric',day:'numeric'}).format(d),value};});
      $('#volumeChart').innerHTML=allWorkouts.length?lineChart(weeks,value=>`${Math.round(value).toLocaleString()} lb`):'<div class="chart-empty">Complete a workout to start the weekly volume chart.</div>';
    }
    

/* ===== module: dashboard-stats.js ===== */
    /** Produces dashboard calendars, charts, and muscle-volume analysis from completed workouts. */
    /* Module map (v1.006) — Key: renderDashboard(), renderStats(), workoutsForPeriod(), muscleVolumes(), dashboardWeekModel(). Depends on: workoutState.completed (state.js), date/format/volume helpers (utilities.js), navigation scroll restore. */
    /* #99 L12: isoForDate removed — use the canonical localIsoDate(date) from utilities.js. */
    function workoutsForPeriod(period) {
      const now=new Date(), today=localIsoDate(now); let start=null;
      if(period==='today') start=today;
      if(period==='week'){const d=new Date(now);d.setDate(now.getDate()-((now.getDay()+6)%7));start=localIsoDate(d);}
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
      }else if(period==='all'){
        /* #99 M12: 'all' means every logged workout. There is no "previous"
           all-time to compare against, so previous is empty (trends render
           as "New", which is honest). */
        currentStart=new Date(2000,0,1,12); currentEnd=new Date(now); currentEnd.setDate(now.getDate()+1);
        previousStart=new Date(now); previousEnd=new Date(now);
        label='all time';
      }else{
        currentEnd=new Date(now); currentEnd.setDate(now.getDate()+1); currentStart=new Date(currentEnd); currentStart.setDate(currentEnd.getDate()-28);
        previousEnd=new Date(currentStart); previousStart=new Date(previousEnd); previousStart.setDate(previousEnd.getDate()-28);
        label='last 4 weeks vs prior 4 weeks';
      }
      const inWindow=(workout,start,end)=>workout.date>=localIsoDate(start)&&workout.date<localIsoDate(end);
      return {current:workoutState.completed.filter(workout=>inWindow(workout,currentStart,currentEnd)),previous:workoutState.completed.filter(workout=>inWindow(workout,previousStart,previousEnd)),label};
    }
    function recentPRRows(workouts) {
      const rows=[];
      workouts.slice().sort(sortByRecencyDesc).forEach(workout=>workout.exercises.forEach(item=>{
        /* #282: timed PRs — longest hold at a given load, same celebration. */
        if((item.tracking||'reps')==='time'){
          const current=item.sets.filter(set=>Number(set.seconds)>0); if(!current.length)return;
          const prior=priorSetsForPR(workout,item.exerciseId);
          if(!prior.length||!detectTimedPRs(current,prior))return;
          const best=Math.max(...current.map(set=>Number(set.seconds)));
          rows.push({exerciseId:item.exerciseId,date:workout.date,kind:'Longest hold PR',value:`${best} sec`});
          return;
        }
        const current=item.sets.filter(set=>Number(set.w)>0&&Number(set.r)>0); if(!current.length)return;
        /* #99 A15 + #158: compare against prior sessions — all other records
           except the current one, including earlier same-day sessions (never
           later ones). priorSetsForPR matches the live PR banner's definition. */
        const prior=priorSetsForPR(workout,item.exerciseId).filter(set=>Number(set.w)>0&&Number(set.r)>0);
        if(!prior.length)return;
        const kind=detectExercisePRs(current,prior);
        const label=kind==='e1rm'?'Estimated 1RM PR':kind==='heaviest'?'Heaviest set PR':'';
        if(label){const best=Math.max(...current.map(estimate1RM)),weight=Math.max(...current.map(set=>Number(set.w)));const displayValue=label.startsWith('Estimated')?`${Math.round(displayWeight(best))} ${weightUnit()}`:`${displayWeight(weight)} ${weightUnit()}`;rows.push({exerciseId:item.exerciseId,date:workout.date,kind:label,value:displayValue});}
      }));
      return rows.slice(0,6);
    }    /* #99 B18: renderMuscleAnalysis decomposed by pure code motion into one
       component per panel — muscle breakdown, top exercises, recent PRs,
       stat-exercise link wiring (shared by the first three, so it runs after
       them), and muscle trends. renderMuscleAnalysis only orchestrates the
       same steps in the same order. */
    function renderMuscleBreakdown(workouts){
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
    }
    function renderTopExercises(workouts){
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
    }
    function renderRecentPRs(workouts){
      const prs=recentPRRows(workouts);
      $('#recentPRs').innerHTML=prs.length?`<div class="action-list">${prs.map(pr=>`<button class="action-row" type="button" data-stat-exercise="${escapeHtml(pr.exerciseId)}"><span><strong>${escapeHtml(exercises.find(ex=>ex.id===pr.exerciseId)?.name||'Exercise')}</strong><span>${escapeHtml(pr.kind)} · ${escapeHtml(formatLogDate(pr.date))}</span></span><span class="action-row-value">${escapeHtml(pr.value)}</span></button>`).join('')}</div>`:'<p class="section-note">No new PRs in this period yet.</p>';
    }
    function wireStatExerciseLinks(){
      document.querySelectorAll('[data-stat-exercise]').forEach(button=>button.addEventListener('click',()=>openExercise(button.dataset.statExercise)));
    }
    function renderMuscleTrends(period){
      const comparison=comparisonPeriods(period), current=muscleVolumes(comparison.current), previous=muscleVolumes(comparison.previous);
      const trendRows=[...new Set([...Object.keys(current),...Object.keys(previous)])].map(muscle=>({muscle,current:Number(current[muscle]||0),previous:Number(previous[muscle]||0)})).filter(row=>row.current>0||row.previous>0).sort((a,b)=>b.current-a.current).slice(0,8);
      $('#muscleTrendNote').textContent=titleCase(comparison.label);
      $('#muscleTrends').innerHTML=trendRows.length?trendRows.map(row=>{const change=row.previous?Math.round((row.current-row.previous)/row.previous*100):null;const changeText=change==null?(row.current?'New':'—'):`${change>0?'+':''}${change}%`;const direction=change>0?'up':change<0?'down':'';return `<div class="trend-row"><div><strong>${escapeHtml(row.muscle)}</strong><span>${formatVolume(row.current)} now · ${formatVolume(row.previous)} before</span></div><span class="trend-change ${direction}">${changeText}</span></div>`;}).join(''):'<p class="section-note">No muscle trend is available for these periods yet.</p>';
    }
    function renderMuscleAnalysis(workouts,period) {
      renderMuscleBreakdown(workouts);
      /* #126 (user 2026-09-11): Training focus panel removed — rep-range share carried no real info. */
      renderTopExercises(workouts);
      renderRecentPRs(workouts);
      wireStatExerciseLinks();
      renderMuscleTrends(period);
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
        (ex.secondary||[]).forEach(m=>volumes[m]=(volumes[m]||0)+(volume*SECONDARY_MUSCLE_WEIGHT));
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
    /* #170 (user 2026-09-12): muscles with at least one completed set in the
       period, primary or secondary — bodyweight sets count even though their
       weighted volume is 0. Used only to light the muscle map; volume math
       (muscleVolumes) is untouched. */
    function workedMuscles(workouts) {
      const worked=new Set();
      workouts.forEach(workout=>workout.exercises.forEach(item=>{
        const ex=exercises.find(x=>x.id===item.exerciseId); if(!ex)return;
        if(!item.sets.length)return;
        (ex.primary||[]).forEach(m=>worked.add(String(m).toLowerCase()));
        (ex.secondary||[]).forEach(m=>worked.add(String(m).toLowerCase()));
      }));
      return worked;
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
    /* Region -> muscle names it represents. A region may cover several of the
       user's muscle names (e.g. the traps region also lights for "upper
       back", user 2026-09-12), so values are arrays. */
    /* #136: the three delt heads + rhomboids light their regions (common
       aliases included). Rhomboids have no dedicated region — the traps
       region is the closest visual proxy.
       #194 (user 2026-09-12): adductors, abductors, middle back and neck
       have no dedicated SVG region either, so they light the closest one —
       a bodyweight adductor session must fill the map, not vanish. */
    const bodyMapMuscleAliases={
      'upper-chest':['chest'],'lower-chest':['chest'],
      'front-delts':['shoulders','front delts','front delt','front deltoid','anterior delts','anterior deltoid'],
      'rear-delts':['shoulders','rear delts','rear delt','rear deltoid','posterior delts','posterior deltoid'],
      'side-delts':['shoulders','side delts','side delt','lateral delts','lateral deltoid','middle delts'],
      'quads':['quadriceps','adductors'],'hamstrings':['hamstrings'],'glutes':['glutes','abductors'],'forearms':['forearms'],'abs':['abdominals'],
      'lats':['lats'],'lower-back':['lower back'],'traps':['traps','upper back','rhomboids','rhomboid','middle back','neck'],'triceps':['triceps'],'biceps':['biceps'],'calves':['calves'],'obliques':['abdominals']
    };
    /* Sum a per-muscle map across every muscle name a region represents. */
    function regionMuscleTotal(map,region){
      return (bodyMapMuscleAliases[region.dataset.muscle]||[]).reduce((sum,m)=>sum+Number(map[m]||0),0);
    }
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
      /* Completed-workout maps: data-worked holds comma-separated library muscle
         names; every worked region gets one flat highlight, no heat ranking. */
      const workedHosts=[...document.querySelectorAll('.anatomy-map[data-worked]:not([data-hydrated])')];
      const hosts=volumeHosts.concat(exerciseHosts,workedHosts);
      if(!hosts.length)return Promise.resolve();
      return loadBodyMapTemplate().then(template=>{
        hosts.forEach(host=>{
          /* #164: the injected SVG is decorative — the muscle lists and legend
             beside it carry the information. Hide the whole host from
             assistive tech so a screen reader doesn't walk dozens of region
             <title> nodes, and keep the SVG out of the tab order. */
          if(!template){host.innerHTML='<div class="chart-empty">Body map unavailable.</div>';host.setAttribute('data-hydrated','true');return;}
          host.setAttribute('aria-hidden','true');
          host.innerHTML=template;
          host.setAttribute('data-hydrated','true');
          /* User 2026-09-13: mark the host hydrated so the CSS pre-hydration
             reserve (min-height + 760/614 aspect-ratio, #182) releases and the
             host hugs the injected SVG — without this the compact home map
             kept its tall ratio box under the 160px-capped SVG, leaving dead
             space between the map and the legend. */
          host.querySelectorAll('svg').forEach(svgNode=>{svgNode.setAttribute('aria-hidden','true');svgNode.setAttribute('focusable','false');});
          const regions=[...host.querySelectorAll('[data-muscle]')];
          /* #170: a volume map may ALSO carry data-worked (comma-separated
             lowercase muscle names with >=1 completed set). Zero-volume but
             worked regions — bodyweight work — get the flat heat-worked
             highlight instead of staying dark. */
          if(host.dataset.primary!==undefined){
            const primary=new Set(host.dataset.primary.split(',').filter(Boolean));
            const secondary=new Set(host.dataset.secondary.split(',').filter(Boolean));
            regions.forEach(region=>{
              const candidates=bodyMapMuscleAliases[region.dataset.muscle]||[];
              const kind=candidates.some(m=>primary.has(m))?'primary':candidates.some(m=>secondary.has(m))?'secondary':null;
              paintBodyRegion(region,kind==='primary'?5:kind==='secondary'?2:0,`${titleCase(candidates[0]||region.dataset.muscle)}${kind?` · ${kind}`:' · not targeted'}`);
            });
          }else if(host.dataset.volumes!==undefined){
            const volumes=JSON.parse(decodeURIComponent(host.dataset.volumes));
            const worked=new Set((host.dataset.worked||'').split(',').filter(Boolean));
            const bySets=host.dataset.metric==='sets';
            const regionValue=region=>regionMuscleTotal(volumes,region);
            const valueLabel=value=>bySets?`${value} set${value===1?'':'s'}`:formatVolume(value);
            const max=Math.max(1,...regions.map(regionValue));
            regions.forEach(region=>{
              const value=regionValue(region);
              if(value>0){
                paintBodyRegion(region,heatLevel(value,max),`${titleCase((bodyMapMuscleAliases[region.dataset.muscle]||[])[0]||region.dataset.muscle)} · ${valueLabel(value)}`);
              }else{
                const hit=(bodyMapMuscleAliases[region.dataset.muscle]||[]).find(m=>worked.has(m));
                if(hit){
                  region.classList.add('heat-worked');
                  const title=document.createElementNS('http://www.w3.org/2000/svg','title');
                  title.textContent=titleCase(hit);region.prepend(title);
                }
              }
            });
          }else if(host.dataset.worked!==undefined){
            const worked=new Set(host.dataset.worked.split(',').filter(Boolean));
            regions.forEach(region=>{
              const hit=(bodyMapMuscleAliases[region.dataset.muscle]||[]).find(m=>worked.has(m));
              if(hit){
                region.classList.add('heat-worked');
                const title=document.createElementNS('http://www.w3.org/2000/svg','title');
                title.textContent=titleCase(hit);region.prepend(title);
              }
            });
          }
          host.dataset.hydrated='true';
        });
      });
    }
    /* #319 (user 2026-09-13): the Stats Volume|Sets toggle also switches
       the muscle map — `bySets` renders per-muscle set counts (heat ranking,
       value labels, tooltips) instead of volume. The dashboard's compact map
       stays volume-only (it has no toggle). */
    function muscleHeatmapMarkup(volumes,worked,compact=false,bySets=false) {
      /* Anatomical muscle map, always the worked view (user 2026-09-11:
         the #72 Worked/Unworked toggle was removed).
         #170: `worked` is the Set of lowercase muscle names with at least one
         completed set in the period (workedMuscles) — bodyweight work has
         volume 0 but must still light its regions (flat heat-worked, no
         volume ranking). */
      const valueLabel=value=>bySets?`${value} set${value===1?'':'s'}`:formatVolume(value);
      const rows=Object.entries(volumes).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      const workedList=[...(worked||[])];
      if(!rows.length&&!workedList.length)return `<div class="chart-empty">${bySets?'No completed sets in this period.':'No weighted training volume in this period.'}</div>`;
      const max=Math.max(1,...rows.map(([,v])=>v));
      const shown=compact?rows.slice(0,4):rows;
      const encoded=encodeURIComponent(JSON.stringify(volumes));
      const workedAttr=workedList.map(m=>String(m).toLowerCase()).join(',');
      const map=`<div class="anatomy-map" data-volumes="${encoded}" data-worked="${escapeHtml(workedAttr)}"${bySets?' data-metric="sets"':''}><div class="chart-empty">Loading anatomical map\u2026</div></div>`;
      const list=shown.map(([muscle,value])=>`<div class="heatmap-row"><i class="heatmap-swatch heat-${heatLevel(value,max)}"></i><span>${escapeHtml(titleCase(muscle))}</span><strong>${valueLabel(value)}</strong></div>`).join('');
      const note=(!rows.length&&!bySets)?'<p class="section-note">Bodyweight work only — no weighted volume this period.</p>':'';
      /* #238 (user 2026-09-12): the Less/More legend was duplicative — the
         swatches and volume numbers already carry the scale. */
      return `<div class="heatmap-shell">${map}<div><div class="heatmap-list">${list}</div>${note}</div></div>`;
    }
    /* Completed-workout body map (user phone QA 2026-09-12): data-worked holds
       comma-separated library muscle names; every worked region gets ONE flat
       highlight — no heat ranking. Muscles with no map region stay visible as
       pills below the map, so there are no blind spots. */
    function workoutBodyMapMarkup(muscles){
      const worked=muscles.map(m=>String(m).toLowerCase()).join(',');
      return `<div class="anatomy-map workout-map" data-worked="${escapeHtml(worked)}"><div class="chart-empty">Loading anatomical map…</div></div>`;
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
    /* #99: single canonical period-tab renderer — replaces the duplicated
       dashboard + stats tab markups. */
    const PERIOD_LABELS={today:'Today',week:'Week',month:'Month',year:'Year',all:'All time'};
    function periodTabs(dataAttr, activePeriod) {
      return Object.entries(PERIOD_LABELS).map(([key,label])=>`<button class="period-tab" type="button" ${dataAttr}="${key}" aria-pressed="${activePeriod===key}">${label}</button>`).join('');
    }
    /* Compact stat numbers (user 2026-09-12, #149): huge totals stay in their
       third of the 3-card row by abbreviating — volume only at ≥1M ("1M+");
       below that the full total shows with thousands separators. Sets ≥10K
       shows "10K+". Tapping an abbreviated card toggles the true total in
       smaller text; tapping again restores. */
    function compactStat(value,tiers){
      const v=Math.round(value);
      for(const [threshold,divisor,suffix] of tiers){
        if(v>=threshold) return {short:Math.floor(v/divisor)+suffix+'+',full:v.toLocaleString()};
      }
      return {short:v.toLocaleString(),full:null};
    }
    function statValuePanel(value,tiers,label){
      const c=compactStat(value,tiers);
      if(!c.full) return `<div class="stats-panel"><strong>${escapeHtml(c.short)}</strong><span>${escapeHtml(label)}</span></div>`;
      return `<button type="button" class="stats-panel stats-panel-link stat-toggle" data-short="${escapeHtml(c.short)}" data-full="${escapeHtml(c.full)}" aria-label="${escapeHtml(label)}: ${escapeHtml(c.full)}. Activate to show the exact total."><strong>${escapeHtml(c.short)}</strong><span>${escapeHtml(label)}</span></button>`;
    }
    /* Tappable abbreviated stat numbers (user 2026-09-12): the number's box
       is locked to its natural (abbreviated) height — measured once per
       render — so showing the full total can never move the label below or
       knock the number out of line with the other cards. The full total
       shrink-to-fits instead of cutting off. */
    function fitStatToggle(btn){
      const strong=btn.querySelector('strong');
      if(!strong)return;
      if(!strong.dataset.naturalH)strong.dataset.naturalH=strong.offsetHeight;
      strong.style.minHeight=strong.dataset.naturalH+'px';
      strong.style.fontSize='';
      let size=parseFloat(getComputedStyle(strong).fontSize)||14,guard=60;
      while(strong.scrollWidth>strong.clientWidth+1&&size>9&&guard--){
        size-=0.5;
        strong.style.fontSize=size+'px';
      }
    }
    function wireStatToggles(root){
      if(!root)return;
      root.querySelectorAll('.stat-toggle').forEach(btn=>{
        fitStatToggle(btn);
        btn.addEventListener('click',()=>{
          const show=btn.classList.toggle('show-full');
          btn.querySelector('strong').textContent=show?btn.dataset.full:btn.dataset.short;
          fitStatToggle(btn);
        });
      });
    }
    const VOLUME_TIERS=[[1e6,1e6,'M']], SETS_TIERS=[[1e4,1e3,'K']];    /* #99 B17: renderDashboard decomposed by pure code motion. The week date
       math moved verbatim into dashboardWeekModel; the calendar strip, summary
       line, program card, period tabs, at-a-glance stats, and recent-workout
       panel each moved verbatim into their own render/wire helper.
       renderDashboard only orchestrates the same steps in the same order and
       still returns the body-map hydration promise. */
    function dashboardWeekModel(now){
      const start=new Date(now);start.setHours(12,0,0,0);start.setDate(now.getDate()-((now.getDay()+6)%7)+(state.calendarWeekOffset*7));
      const end=new Date(start);end.setDate(start.getDate()+6);
      return {start,end};
    }
    function renderDashboardCalendar(now,start,end){
      const strip=$('#weekStrip');
      const sameMonth=start.getMonth()===end.getMonth();
      $('#calendarWeekLabel').textContent=sameMonth?`${new Intl.DateTimeFormat('en-US',{month:'short'}).format(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`:`${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(start)} – ${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(end)}`;
      $('#nextWeek').disabled=state.calendarWeekOffset>=0;
      strip.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const iso=localIsoDate(d);const dayWorkouts=workoutState.completed.filter(w=>w.date===iso);const selected=state.selectedDashboardDate===iso;return `<button type="button" class="day-chip ${d.toDateString()===now.toDateString()?'today':''} ${dayWorkouts.length?'has-workout':''} ${selected?'selected':''}" data-calendar-date="${iso}" aria-pressed="${selected}" aria-label="${new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(d)}${dayWorkouts.length?' · Workout logged':''}"><span>${new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d)}</span><strong>${d.getDate()}</strong><em aria-hidden="true">${dayWorkouts.length?'<i></i>':''}</em></button>`}).join('');
      document.querySelectorAll('[data-calendar-date]').forEach(button=>button.addEventListener('click',()=>{state.selectedDashboardDate=state.selectedDashboardDate===button.dataset.calendarDate?null:button.dataset.calendarDate;renderDashboard();}));
      $('#previousWeek').onclick=()=>{state.calendarWeekOffset-=1;state.selectedDashboardDate=null;renderDashboard();};
      $('#nextWeek').onclick=()=>{if(state.calendarWeekOffset<0){state.calendarWeekOffset+=1;state.selectedDashboardDate=null;renderDashboard();}};
      let weekSwipeStart=null;
      strip.onpointerdown=event=>{weekSwipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};};
      strip.onpointermove=event=>{if(!weekSwipeStart||event.pointerId!==weekSwipeStart.id)return;if(Math.abs(event.clientX-weekSwipeStart.x)>12)strip.setPointerCapture?.(event.pointerId);};
      strip.onpointercancel=()=>{weekSwipeStart=null;};
      strip.onpointerup=event=>{if(!weekSwipeStart||event.pointerId!==weekSwipeStart.id)return;const dx=event.clientX-weekSwipeStart.x,dy=event.clientY-weekSwipeStart.y;weekSwipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){if(dx>0)$('#previousWeek').click();else $('#nextWeek').click();}};
    }
    function renderDashboardSummary(selectedWorkouts,selectedIsFuture){
      if(state.selectedDashboardDate){const label=formatLogDate(state.selectedDashboardDate);$('#calendarSummary').textContent=selectedIsFuture?`${label} · Upcoming program`:`${label} · ${selectedWorkouts.length?`${selectedWorkouts.length} workout${selectedWorkouts.length===1?'':'s'}`:'No workouts'}`;$('#dashRecentTitle').textContent=selectedIsFuture?'Upcoming':label;}else{const summary=$('#calendarSummary');if(state.calendarWeekOffset===0){summary.textContent='';}else{summary.innerHTML='<button type="button" class="link-button" id="gotoThisWeek">Go to this week.</button>';const go=$('#gotoThisWeek');if(go)go.addEventListener('click',()=>{state.calendarWeekOffset=0;state.selectedDashboardDate=null;renderDashboard();});}$('#dashRecentTitle').textContent='Recent workouts';}
    }
    function renderDashboardProgram(){
      const p=workoutState.activeProgram; $('#dashboardProgram').innerHTML=p?`<p><strong>${escapeHtml(p.name)}</strong><br>Week ${programWeek(p)} of ${p.length} · ${p.workouts.length} workouts in rotation</p><button class="secondary-button" id="openDashboardProgram" type="button">Open program</button>`:'<p>No active program yet. Build a training block when you’re ready.</p><button class="secondary-button" id="openDashboardProgram" type="button">Create program</button>';
      $('#openDashboardProgram').addEventListener('click',()=>showProgram());
    }
    function wireDashboardPeriodTabs(){
      $('#dashPeriodTabs').innerHTML=periodTabs('data-dash-period',state.dashboardPeriod);
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
    }
    /* #195 (user 2026-09-12): the At-a-glance Workouts card opens the logs
       list filtered to the dashboard's selected period. */
    function openLogsForDashboardPeriod(){
      state.logPeriod=state.dashboardPeriod||'week';
      schedulePersist();
      showWorkouts(false);showWorkoutHistory();
    }
    function renderDashboardStats(){
      const periodWorkouts=workoutsForPeriod(state.dashboardPeriod), periodSets=periodWorkouts.flatMap(w=>w.exercises.flatMap(e=>e.sets)), volume=periodSets.reduce((n,set)=>n+setVolume(set),0);
      const periodLabel=PERIOD_LABELS[state.dashboardPeriod]||'';
      $('#dashboardStats').innerHTML=`<button class="stats-panel stats-panel-link" id="dashWorkoutsCard" type="button" aria-label="View workout logs for ${escapeHtml(periodLabel)}"><strong>${periodWorkouts.length}</strong><span>${periodWorkouts.length===1?'Workout':'Workouts'}</span></button>${statValuePanel(periodSets.length,SETS_TIERS,periodSets.length===1?'Set':'Sets')}${statValuePanel(displayVolume(volume),VOLUME_TIERS,`Volume (${weightUnit()})`)}`;
      $('#dashWorkoutsCard').onclick=openLogsForDashboardPeriod;
      wireStatToggles($('#dashboardStats'));
      const muscles=muscleCounts(periodWorkouts),volumes=muscleVolumes(periodWorkouts);$('#dashboardMuscles').innerHTML=Object.keys(muscles).length?Object.entries(muscles).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m,n])=>musclePill(m,` · ${n}`)).join(''):'<span class="section-note">No muscles logged in this period.</span>';
      $('#dashboardHeatmap').innerHTML=muscleHeatmapMarkup(volumes,workedMuscles(periodWorkouts),true);
      const dashHydration=hydrateBodyMaps();
      renderBlindspots(volumes,workedMuscles(periodWorkouts),'#dashBlindspots');
      return dashHydration;
    }
    function renderDashboardRecent(selectedWorkouts,selectedIsFuture){
      const selDate=state.selectedDashboardDate, todayIso=localIsoDate();
      /* #4: future dates render the upcoming program workout (see
         upcomingProgramMarkup) instead of the dead "nothing logged" note. */
      const futureDateCopy=selectedIsFuture?upcomingProgramMarkup(selDate):'';
      const emptyDateCopy=futureDateCopy||(selDate===todayIso?'<p>No workout logged yet today. <button class="filter-clear" id="startSelectedDateWorkout" type="button">Start workout</button></p>':'<p>No workout logged for this date. <button class="filter-clear" id="startSelectedDateWorkout" type="button">Log a workout</button></p>');
      $('#dashboardRecent').innerHTML=selectedWorkouts.length?selectedWorkouts.map(w=>{const setCount=w.exercises.flatMap(e=>e.sets).length;const detail=state.selectedDashboardDate?`${w.exercises.length} exercise${w.exercises.length===1?'':'s'} · ${setCount} set${setCount===1?'':'s'}`:null;return recentWorkoutButton(w,'data-workout-id',detail);}).join(''):state.selectedDashboardDate?emptyDateCopy:'<p>No completed workouts yet. <button class="filter-clear" id="startFirstWorkout" type="button">Start a workout</button></p>';
      document.querySelectorAll('[data-workout-id]').forEach(b=>b.addEventListener('click',()=>{state.workoutDetailReturn=ROUTES.DETAIL_RETURN.DASHBOARD;showWorkouts(false);renderCompletedWorkout(workoutState.completed.find(w=>w.id===b.dataset.workoutId),{push:true});}));
      $('#startSelectedDateWorkout')?.addEventListener('click',()=>{const date=state.selectedDashboardDate;showWorkouts();startBlankWorkout();workoutState.draft.date=date;renderWorkoutScreen();});
      /* #154: the no-workouts empty state gets the same one-tap start as the
         per-date empty states — without it a fresh account had no visible
         path from Home into a first session. */
      $('#startFirstWorkout')?.addEventListener('click',()=>{showWorkouts();startBlankWorkout();});
      /* User 2026-09-12: "See all" on the recent-workouts card jumps to the
         full workout logs (same destination as the Stats card, #128). */
      $('#seeAllWorkouts').onclick=()=>{showWorkouts(false);showWorkoutHistory();};
      /* #4: one-tap start for the upcoming program workout shown on future dates. */
      $('#startUpcomingProgramWorkout')?.addEventListener('click',()=>{const program=workoutState.activeProgram,next=program&&suggestedProgramWorkout(program);if(program&&next)startProgramWorkout(program,next);});
    }
    function renderDashboard() {
      const now=new Date();
      const {start,end}=dashboardWeekModel(now);
      renderDashboardCalendar(now,start,end);
      /* #273: Home's recent-4 must follow recency (completedAt-first), like the
         Logs list and Repeat-last — raw insertion order disagrees after sync
         merges or mid-edit-delete re-saves. */
      const selectedWorkouts=state.selectedDashboardDate?workoutState.completed.filter(w=>w.date===state.selectedDashboardDate):workoutState.completed.slice().sort(sortByRecencyDesc).slice(0,4);
      /* #4: future dates show the upcoming program workout instead of history. */
      const selectedIsFuture=!!state.selectedDashboardDate&&state.selectedDashboardDate>localIsoDate();
      renderDashboardSummary(selectedWorkouts,selectedIsFuture);
      renderDashboardProgram();
      wireDashboardPeriodTabs();
      const dashHydration=renderDashboardStats();
      renderDashboardRecent(selectedWorkouts,selectedIsFuture);
      return dashHydration;
    }
    /* Muscle blindspots: library muscles with zero weighted volume in the
       period, always visible as dashed pills (user 2026-09-10 — no toggle).
       #13 (user 2026-09-11): sectioned out — a horizontal divider, then a
       "Blind spots" label, then the pills. Shared by the Stats muscle map
       and the Home At-a-glance card. */
    /* #194 (user 2026-09-12): blind spots are muscles with NO work at all in
       the period — bodyweight sets count as work even though their volume
       is 0. Pure so tests can pin it. */
    function blindspotMuscles(volumes,worked){
      const allMuscles=[...new Set(exercises.flatMap(ex=>[...(ex.primary||[]),...(ex.secondary||[])].map(m=>String(m).toLowerCase())))].sort();
      return allMuscles.filter(m=>!volumes[m]&&!(worked&&worked.has(m)));
    }
    function renderBlindspots(volumes,worked,wrapSelector){
      const wrap=$(wrapSelector||'#blindspotWrap');if(!wrap)return;
      const missing=blindspotMuscles(volumes,worked);
      if(!missing.length){wrap.innerHTML='';return;}
      wrap.innerHTML=`<div class="blindspot-section"><hr class="blindspot-rule"><p class="blindspot-label">Blind spots</p><div class="tag-row blindspot-list">${missing.map(m=>`<span class="tag blindspot-tag">${escapeHtml(titleCase(m))}</span>`).join('')}</div></div>`;
    }
    function renderStats() {
      $('#statsPeriodTabs').innerHTML=periodTabs('data-stats-period',state.statsPeriod);
      document.querySelectorAll('[data-stats-period]').forEach(button=>button.addEventListener('click',()=>{
        if(state.statsPeriod===button.dataset.statsPeriod)return;
        state.statsPeriod=button.dataset.statsPeriod;schedulePersist();renderStats();
        /* Same focus-drop scroll-to-top guard as the dashboard tabs (user 2026-09-10). */
        document.querySelector('[data-stats-period="'+state.statsPeriod+'"]')?.focus({preventScroll:true});
      }));
      const workouts=workoutsForPeriod(state.statsPeriod), sets=workouts.flatMap(w=>w.exercises.flatMap(e=>e.sets)), volume=sets.reduce((n,set)=>n+setVolume(set),0);
      /* User 2026-09-12 (#128): the Completed-workouts stat is the Stats-tab
         door to the workout logs — tapping it jumps to the full list. */
      $('#statsGrid').innerHTML=`<button class="stats-panel stats-panel-link" id="statsCompletedWorkouts" type="button"><strong>${workouts.length}</strong><span>${workouts.length===1?'Workout':'Workouts'}</span></button>${statValuePanel(sets.length,SETS_TIERS,sets.length===1?'Set':'Sets')}${statValuePanel(displayVolume(volume),VOLUME_TIERS,`Volume (${weightUnit()})`)}`;
      $('#statsCompletedWorkouts').onclick=()=>{showWorkouts(false);showWorkoutHistory();};
      wireStatToggles($('#statsGrid'));
      const muscles=muscleCounts(workouts), volumes=muscleVolumes(workouts);
      /* #319 (user 2026-09-13): the muscle map has its OWN Volume|Sets toggle
         (independent of the Volume-by-muscle list toggle below it).
         #323: the volume option is labeled Volume, not Weight. */
      const mapBySets=state.muscleMapMode==='sets';
      document.querySelectorAll('#muscleMapMode [data-map-mode]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(btn.dataset.mapMode===(mapBySets?'sets':'volume')));
        btn.onclick=()=>{const mode=btn.dataset.mapMode;if(state.muscleMapMode===mode)return;const y=window.scrollY;state.muscleMapMode=mode;renderStats();window.scrollTo(0,y);};
      });
      $('#muscleHeatmap').innerHTML=muscleHeatmapMarkup(mapBySets?muscleSetCounts(workouts):volumes,workedMuscles(workouts),false,mapBySets);hydrateBodyMaps();
      /* #322 (user 2026-09-12): the set-count chips under the stats muscle map
         are gone — the map stands alone. */
      $('#muscleStats').innerHTML=Object.keys(muscles).length?'':'<p class="section-note">Complete a workout to start building muscle-level stats.</p>';
      renderBlindspots(volumes,workedMuscles(workouts));
      renderMuscleAnalysis(workouts,state.statsPeriod);
      /* #126 (user 2026-09-11): Weekly volume chart removed from Stats. */
    }
    /* #7: which exercises drove a muscle's volume in the period (primary =
       full set volume, secondary = SECONDARY_MUSCLE_WEIGHT, matching muscleVolumes). */
    function exercisesForMuscle(muscle, workouts, bySets=false) {
      const m=String(muscle).toLowerCase(), stats={};
      workouts.forEach(w=>w.exercises.forEach(item=>{
        const ex=exercises.find(x=>x.id===item.exerciseId); if(!ex)return;
        const lower=a=>(a||[]).map(s=>String(s).toLowerCase());
        const isPrimary=lower(ex.primary).includes(m), isSecondary=lower(ex.secondary).includes(m);
        if(!isPrimary&&!isSecondary)return;
        const vol=item.sets.reduce((sum,s)=>sum+setVolume(s),0)*(isPrimary?1:SECONDARY_MUSCLE_WEIGHT);
        const entry=stats[item.exerciseId]||(stats[item.exerciseId]={volume:0,sets:0});
        entry.volume+=vol; entry.sets+=item.sets.length;
      }));
      /* #7 drill-down: in Sets mode bodyweight work (volume 0, sets > 0)
         must still appear, and drivers sort by the active metric. */
      return Object.entries(stats).filter(([,e])=>bySets?e.sets>0:e.volume>0).sort((a,b)=>bySets?b[1].sets-a[1].sets:b[1].volume-a[1].volume).slice(0,4);
    }
    /* #7: muscle drill-down expansion state (session-only). */
    let expandedMuscle=null;
    
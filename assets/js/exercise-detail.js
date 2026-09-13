
/* ===== module: exercise-detail.js ===== */
    /** Calculates exercise PRs, history, similarity, and detail-view presentation. */
    /* Module map (v1.006) — Key: openExercise(), renderHistory(), statsFor(), estimate1RM(), similarTo(). Depends on: catalog `exercises`, workoutState.completed, utilities (format/date/PR/chart helpers). */
    function estimate1RM(set) {
      // Use the logged load as-is; dumbbell entries are the combined total, not a per-hand value.
      const weight = Number(set.w);
      if (!Number.isFinite(weight) || weight <= 0) return 0;
      const rir = set.rpe == null || set.rpe === '' ? 0 : Math.max(0, 10 - Number(set.rpe));
      return weight * (1 + (Number(set.r) + rir) / 30);
    }

    /* #125 (user 2026-09-11): exercise trends moved here from Stats —
       per-session e1RM line + volume bars live on the exercise page now.
       Lightweight SVG bar chart (no libs); same 620x190 viewBox as lineChart. */
    /* Hevy-style charts (user 2026-09-12): phone-first 360x210 viewBox
       fills the card (no letterbox dead bands); horizontal gridlines only —
       no left-axis numbers (user 2026-09-12), so the plot runs nearly
       full-bleed; few date labels; the fixed headline (value + date) updates
       in place when a point is tapped — nothing is inserted or removed, so
       the chart can never jump around. */
    const CHART_W=360, CHART_H=210, CHART_L=8, CHART_R=12, CHART_T=12, CHART_B=30;
    /* Progress metric toggle (user 2026-09-12; #200 made it an explicit
       segmented control): the exercise Progress chart flips between
       Estimated 1RM and Heaviest weight. The headline keeps its tap/keyboard
       toggle; the segmented control drives the same state. Kept across
       exercises for the session. */
    let progressMetric='e1rm';
    /* #200: tiny state contract for the toggle — pinning the mode mapping so
       the control can never display a mode the chart isn't in. */
    function isProgressMetric(m){return m==='e1rm'||m==='heaviest';}
    function flipProgressMetric(m){return m==='heaviest'?'e1rm':'heaviest';}
    /* Nice-number ticks covering [min,max] for the gridlines — replaces the
       old max/min-only axis (which duplicated labels on flat data and left
       intermediate gridlines bare). */
    function chartTicks(min,max,count=4){
      let lo=min,hi=max;
      if(!(hi>lo)){const pad=Math.abs(hi)*0.1||1;lo=hi-pad;hi=hi+pad;}
      const raw=(hi-lo)/Math.max(1,count-1),mag=Math.pow(10,Math.floor(Math.log10(raw)));
      const step=(raw/mag>=5?5:raw/mag>=2?2:1)*mag;
      const start=Math.floor(lo/step)*step,end=Math.ceil(hi/step)*step,ticks=[];
      for(let v=start;v<=end+step/2;v+=step)ticks.push(+v.toFixed(10));
      return ticks.length>1?ticks:[start,end];
    }
    /* Fewer date labels (user 2026-09-12): at most ~4 across the axis. */
    function chartXLabels(coords){
      const step=Math.max(1,Math.ceil(coords.length/3)),n=coords.length;
      return coords.map((p,i)=>(i%step===0||i===n-1)?`<text class="chart-label" x="${p.x.toFixed(1)}" y="${CHART_H-9}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${escapeHtml(p.shortLabel||p.label)}</text>`:'').join('');
    }
    /* Gridlines only — no left-axis labels (user 2026-09-12). */
    function chartGrid(ticks,Y){
      return ticks.map(t=>{const y=Y(t).toFixed(1);return `<line class="chart-grid" x1="${CHART_L}" y1="${y}" x2="${CHART_W-CHART_R}" y2="${y}"/>`;}).join('');
    }
    function barChart(points, valueLabel = value => `${Math.round(value).toLocaleString()}`) {
      if (!points.length) return '<div class="chart-empty">Complete workouts to start this chart.</div>';
      const plotW=CHART_W-CHART_L-CHART_R,plotH=CHART_H-CHART_T-CHART_B;
      const values=points.map(p=>Number(p.value)||0),max=Math.max(...values,1);
      const ticks=chartTicks(0,max,4),top=ticks[ticks.length-1];
      const Y=v=>CHART_T+(1-v/top)*plotH,base=Y(0);
      const n=points.length,slot=plotW/n,barW=Math.min(40,Math.max(10,slot*0.55));
      const coords=points.map((p,i)=>({x:CHART_L+i*slot+(slot-barW)/2+barW/2,...p}));
      const bars=points.map((p,i)=>{
        const h=(Number(p.value)||0)/top*plotH,x=CHART_L+i*slot+(slot-barW)/2,y=base-h;
        return `<rect class="chart-bar" data-i="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(2,h).toFixed(1)}" rx="3"><title>${escapeHtml(p.label)}: ${escapeHtml(valueLabel(p.value))}</title></rect>`;
      }).join('');
      /* Tappable: an invisible rect over each slot so bars are easy to hit
         with a finger. */
      const hits=points.map((p,i)=>`<rect class="chart-hit" data-i="${i}" x="${(CHART_L+i*slot).toFixed(1)}" y="${CHART_T}" width="${slot.toFixed(1)}" height="${plotH}" fill="transparent"/>`).join('');
      const aria=points.map(p=>`${p.label}: ${valueLabel(p.value)}`).join(', ');
      return `<svg viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${escapeHtml(aria)}">${chartGrid(ticks,Y)}${bars}${hits}${chartXLabels(coords)}</svg>`;
    }
    /* #165: same-day sessions share a date label — annotate each log with its
       chronological ordinal for the day so charts and history read "Sep 12",
       "Sep 12 (2)". Numbered oldest-first within each date, independent of
       the caller's input order (ties keep input order; the sort is stable). */
    function annotateSessionOrdinals(logs){
      const counts={};
      logs.slice().sort((a,b)=>{
        if(a.isoDate!==b.isoDate)return a.isoDate<b.isoDate?-1:1;
        const x=a.completedAt||'',y=b.completedAt||'';
        return x<y?-1:x>y?1:0;
      }).forEach(s=>{s.dayOrdinal=(counts[s.isoDate]=(counts[s.isoDate]||0)+1);});
      return logs;
    }
    function ordinalDateLabel(session){
      return session.dayOrdinal>1?`${session.date} (${session.dayOrdinal})`:session.date;
    }
    function ordinalShortLabel(session){
      const short=String(session.date).replace(/, \d{4}/,'');
      return session.dayOrdinal>1?`${short} (${session.dayOrdinal})`:short;
    }
    /* #8: per-session e1RM + heaviest set + volume for one exercise, oldest session first.
       #278: seconds-tracked sessions get their own trend series (longest
       hold per session + time under tension) — the e1RM/heaviest filters
       exclude them, which used to leave timed-only history chartless. */
    function exerciseTrendData(exerciseId) {
      const logs=annotateSessionOrdinals(getExerciseLogs(exerciseId)).reverse();
      const e1rm=[], volume=[], heaviest=[], hold=[], timeVolume=[];
      /* #308 (user 2026-09-12): the bar charts are about the weight/volume,
         not the session — like #249's heaviest labels, they use the plain
         date with no day ordinal ("Sep 2 (2)"). */
      const plainLabelOf=session=>session.date, plainShortOf=session=>String(session.date).replace(/, \d{4}/,'');
      logs.forEach(session=>{
        const label=ordinalDateLabel(session), shortLabel=ordinalShortLabel(session);
        const plainLabel=plainLabelOf(session), plainShort=plainShortOf(session);
        const sets=session.sets.filter(s=>Number(s.w)>0&&Number(s.r)>0);
        if(sets.length){
          e1rm.push({label,shortLabel,value:Math.round(Math.max(...sets.map(estimate1RM)))});
          /* Heaviest set per session (user 2026-09-12): the Progress headline
             toggles between this and e1RM, so both series share sessions.
             #249: this chart is about the weight, not the session — drop the
             day ordinal ("Sep 2 (2)") from its labels. */
          heaviest.push({label:plainLabel,shortLabel:plainShort,value:Math.max(...sets.map(s=>Number(s.w)))});
        }
        const timed=session.sets.filter(s=>Number(s.seconds)>0);
        if(timed.length){
          hold.push({label,shortLabel,value:Math.max(...timed.map(s=>Number(s.seconds)))});
          timeVolume.push({label:plainLabel,shortLabel:plainShort,value:timed.reduce((sum,s)=>sum+(Number(s.seconds)||0),0)});
        }
        const vol=session.sets.reduce((sum,s)=>sum+setVolume(s),0);
        if(vol>0)volume.push({label:plainLabel,shortLabel:plainShort,value:vol});
      });
      return {e1rm,volume,heaviest,hold,timeVolume};
    }
    /* #125 (user 2026-09-11): charts cleaned up — soft area fill under the
       line, light horizontal gridlines instead of bare axes, tabular-nums
       labels, first/last x-labels only when crowded. */
    function lineChart(points, valueLabel = value => `${Math.round(value).toLocaleString()}`) {
      if (!points.length) return '<div class="chart-empty">Complete workouts to start this chart.</div>';
      const plotW=CHART_W-CHART_L-CHART_R,plotH=CHART_H-CHART_T-CHART_B;
      const values=points.map(p=>Number(p.value)||0);
      const dMin=Math.min(...values),dMax=Math.max(...values);
      /* Pad the data range before ticking so dots never sit on the frame. */
      const pad=Math.max((dMax-dMin)*0.2,Math.abs(dMax)*0.05||1);
      const ticks=chartTicks(dMin-pad,dMax+pad,4),t0=ticks[0],span=Math.max(1e-9,ticks[ticks.length-1]-t0);
      const X=i=>CHART_L+(points.length===1?plotW/2:i*plotW/(points.length-1));
      const Y=v=>CHART_T+(1-(v-t0)/span)*plotH;
      const coords=points.map((p,i)=>({x:X(i),y:Y(Number(p.value)||0),...p}));
      const line=coords.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const base=(CHART_T+plotH).toFixed(1);
      const area=`${line} L ${coords[coords.length-1].x.toFixed(1)} ${base} L ${coords[0].x.toFixed(1)} ${base} Z`;
      const aria=points.map(p=>`${p.label}: ${valueLabel(p.value)}`).join(', ');
      const dots=coords.map((p,i)=>`<circle class="chart-dot" data-i="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"><title>${escapeHtml(p.label)}: ${escapeHtml(valueLabel(p.value))}</title></circle>`).join('');
      /* Generous invisible hit circles — the visible dots are too small
         for fingers. */
      const hits=coords.map((p,i)=>`<circle class="chart-hit" data-i="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="18" fill="transparent"/>`).join('');
      return `<svg viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${escapeHtml(aria)}">${chartGrid(ticks,Y)}<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${dots}${hits}${chartXLabels(coords)}</svg>`;
    }

    /* Fixed headline + tap-to-inspect (user 2026-09-12, Hevy-style): the
       headline always shows a point (latest by default), and tapping a
       dot/bar only swaps its text — the old readout element that inserted
       itself above the chart (and jumped the layout ~25px) is gone. */
    function chartBlock(kicker,svg,points,valueLabel){
      const latest=points[points.length-1];
      const val=escapeHtml(valueLabel(latest.value)),when=escapeHtml(latest.shortLabel||latest.label);
      return `<p class="chart-kicker">${escapeHtml(kicker)}</p><div class="chart-tappable"><p class="chart-headline"><strong>${val}</strong><span>${when}</span></p>${svg}</div>`;
    }
    function wireChartTaps(tappable,points,valueLabel){
      if(!tappable||!points.length)return;
      const svg=tappable.querySelector('svg');if(!svg)return;
      const strong=tappable.querySelector('.chart-headline strong'),when=tappable.querySelector('.chart-headline span');
      const latest=points.length-1;
      const show=i=>{const p=points[i];strong.textContent=valueLabel(p.value);when.textContent=p.shortLabel||p.label;};
      let selected=-1;
      svg.addEventListener('click',e=>{
        const hit=e.target.closest('.chart-hit');
        const i=hit?Number(hit.dataset.i):-1;
        selected=(i===selected)?-1:i;
        svg.querySelectorAll('[data-i]').forEach(el=>el.classList.toggle('is-selected',Number(el.dataset.i)===selected));
        /* Tapping only swaps headline text — geometry never moves. */
        show(selected<0?latest:selected);
      });
    }

    function allSets(logs) {
      return logs.flatMap(session => session.sets.map(set => ({...set, date:session.date})));
    }

    /* A12 (#99): sessions and rep bests come from valid REP sets regardless
       of added load — bodyweight training has no load. e1RM and heaviest-set
       stay reserved for sets with load.
       #278: seconds-tracked sets are completed sets too — a timed-only
       history must not read "No completed sets yet". Timed bests surface
       as longestHold; rep-derived metrics stay rep-only. */
    function statsFor(id) {
      const logs = getExerciseLogs(id);
      const validSets = allSets(logs).filter(set => Number(set.r) > 0 || Number(set.seconds) > 0);
      if (!validSets.length) return null;
      const repSets = validSets.filter(set => Number(set.r) > 0);
      const timedSets = validSets.filter(set => Number(set.seconds) > 0);
      const loaded = repSets.filter(set => Number(set.w) > 0);
      const bestEst = loaded.length ? loaded.reduce((a,b) => estimate1RM(a) > estimate1RM(b) ? a : b) : null;
      const heaviest = loaded.length ? loaded.reduce((a,b) => Number(a.w) > Number(b.w) ? a : b) : null;
      return {sessions:logs.length, sets:validSets.length,
        bestRepSet:repSets.length?Math.max(...repSets.map(s => Number(s.r) || 0)):0,
        longestHold:timedSets.length?Math.max(...timedSets.map(s => Number(s.seconds) || 0)):0,
        bestEst, heaviest, projected:bestEst ? Math.round(estimate1RM(bestEst)) : null};
    }

    function similarity(a, b) {
      const sharedPrimary = a.primary.filter(m => b.primary.includes(m)).length;
      const sharedSecondary = a.secondary.filter(m => b.secondary.includes(m)).length;
      return sharedPrimary * 3 + sharedSecondary + (a.equipment === b.equipment ? 2 : 0);
    }

    function similarTo(ex) {
      /* A8 (#99): soft-deleted customs don't surface as similar either. */
      return exercises.filter(x => x.id !== ex.id && !exerciseDeleted(x)).map(x => ({...x, score:similarity(ex,x)})).filter(x => x.score > 0).sort((a,b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0,4);
    }

    /* #281: the per-session headline metric. Seconds-tracked sessions have
       no 1RM estimate — they show the longest hold instead of a misleading
       "Best estimate 0 lb". Unweighted rep sessions hide the estimate rather
       than showing 0. Returns '' when there is nothing meaningful to show. */
    function sessionBestLabel(session){
      if(session.tracking==='time'){
        const best=Math.max(0,...session.sets.map(s=>Number(s.seconds)||0));
        return best>0?`Longest hold ${best} sec`:'';
      }
      const top=Math.round(Math.max(0,...session.sets.map(estimate1RM)));
      return top>0?`Best estimate ${displayWeight(top)} ${weightUnit()}`:'';
    }

    function renderHistory(id) {
      const logs = annotateSessionOrdinals(getExerciseLogs(id));
      $('#historyCount').textContent = logs.length ? `${logs.length} completed workout${logs.length===1?'':'s'}` : '';
      const toggle=$('#historyToggle'),list=$('#historyList'),label=$('#historyToggleLabel');
      /* Auto-collapsed (user 2026-09-12): a long set-by-set history dominated
         the page — it now starts collapsed behind a toggle. */
      if(toggle)toggle.hidden=!logs.length;
      if(label)label.textContent=logs.length?`Show all ${logs.length} session${logs.length===1?'':'s'} · latest ${ordinalDateLabel(logs[0])}`:'';
      if(toggle)toggle.setAttribute('aria-expanded','false');
      if(list)list.hidden=logs.length>0;
      if(toggle)toggle.onclick=()=>{
        const open=list.hidden;
        list.hidden=!open;
        toggle.setAttribute('aria-expanded',String(open));
        if(label)label.textContent=open?'Hide history':`Show all ${logs.length} session${logs.length===1?'':'s'} · latest ${ordinalDateLabel(logs[0])}`;
      };
      $('#historyList').classList.toggle('is-empty', !logs.length);
      /* Prettier set rows (user 2026-09-12): one compact line per set —
         number, weight × reps, and RPE/tags right-aligned — instead of the
         four-column grid with its awkward empty cells. */
      const setRow=(s,i,session)=>{
        const main=session.tracking==='time'
          ? `<strong>${s.seconds ?? '—'}</strong> sec`
          : (s.w==null?`<strong>${s.r}</strong> reps`:`<strong>${displayWeight(s.w)}</strong> ${weightUnit()} × <strong>${s.r}</strong>`);
        const metaBits=[];
        if(s.rpe!=null)metaBits.push(`<span class="set-rpe">RPE <strong>${s.rpe}</strong></span>`);
        (s.tags||[]).forEach(t=>metaBits.push(`<span class="set-tag">${escapeHtml(t)}</span>`));
        return `<div class="set-row"><span class="set-num">${i+1}</span><span class="set-main">${main}</span><span class="set-meta">${metaBits.join(' ')||'—'}</span></div>`;
      };
    /* #281: the per-session headline metric. Seconds-tracked sessions have
       no 1RM estimate — they show the longest hold instead of a misleading
       "Best estimate 0 lb". Unweighted rep sessions hide the estimate rather
       than showing 0. Returns '' when there is nothing meaningful to show. */
      $('#historyList').innerHTML = logs.length ? logs.map(session => {
        const best = sessionBestLabel(session);
        return `<div class="history-session">
          <div class="session-head"><span class="session-date">${escapeHtml(ordinalDateLabel(session))}</span><span class="session-est">${best?escapeHtml(best)+' · ':''}<button class="filter-clear" type="button" data-history-workout="${escapeHtml(session.workoutId)}">View workout</button></span></div>
          ${session.exerciseTags?.length?`<div class="exercise-tag-row">${session.exerciseTags.map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}</div>`:''}
          <div class="sets">${session.sets.map((s,i) => setRow(s,i,session)).join('')}</div>
        </div>`;
      }).join('') : `<div class="history-empty">No history for this movement yet.</div>`;
      /* #99: scoped to the detail view (not document-wide). */
      document.querySelectorAll('#detailView [data-history-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=workoutState.completed.find(row=>row.id===button.dataset.historyWorkout);if(workout){state.workoutDetailReturn=ROUTES.DETAIL_RETURN.EXERCISE_DETAIL;state.workoutDetailExerciseId=id;state.workoutDetailExerciseReturn=state.exerciseDetailReturn;showWorkouts(false);renderCompletedWorkout(workout,{push:true});}}));
    }

    /** Opens the exercise detail. returnTo ({view, workoutId}) records where Back should go;
     *  when omitted it is derived from the current tab (library, stats, dashboard, ...). */
    function openExercise(id, push = true, returnTo) {
      const ex = exercises.find(x => x.id === id);
      if (!ex) return;
      // Drilling from one exercise detail into another (e.g. a similar exercise) must
      // land at the top of the new page — restoring the old detail scroll would leave
      // the user staring at the bottom, looking like the tap did nothing.
      const fromDetail = state.activeView === 'detail';
      rememberScroll();
      state.selected = id;
      if (returnTo !== undefined) {
        state.exerciseDetailReturn = returnTo;
      } else if (state.activeView !== 'detail' && state.activeView !== 'settings') {
        // History navigation can land on a detail straight from Settings; keep the
        // previous return so the breadcrumb/back don't point at Settings itself.
        /* From a workout sub-screen (live editor, saved builder, saved editor),
           record the sub-screen too, so Back restores it instead of the start
           screen (user 2026-09-12). */
        /* #99 B11: one return-route shape via makeReturnRoute. */
        state.exerciseDetailReturn = state.activeView === ROUTES.VIEW.WORKOUT
          ? makeReturnRoute(ROUTES.VIEW.WORKOUT,{sub:state.workoutSubScreen,savedWorkoutId:state.savedWorkoutId})
          : makeReturnRoute(state.activeView);
      }
      $('#detailTitle').textContent = ex.name;
      const detailFav = $('#detailFavToggle');
      if (detailFav) {
        const fav = state.favorites.has(id);
        detailFav.setAttribute('aria-pressed', String(fav));
        detailFav.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
      }
      /* Muscle names live with the "Muscles worked" heat map below (user
         2026-09-10); the top keeps only equipment/custom context. */
      $('#detailTags').innerHTML = [`<span class="tag">${escapeHtml(ex.equipment || 'no equipment')}</span>`, ...(ex.custom ? ['<span class="tag custom">Custom</span>'] : [])].join('');
      const realStats = statsFor(id);
      const st = realStats;
      const isBodyweight = ex.equipment === 'body only';
      /* A12 (#99): the weighted block needs loaded sets; bodyweight and
         unweighted history get rep-based cards, with the "complete a
         weighted set" messaging kept only on the load-derived metrics. */
      const sessionsSub = `Across ${st?st.sessions:0} workout${st&&st.sessions===1?'':'s'}`;
      /* #278: timed-only history (no rep sets at all) gets its own card set —
         the longest hold is the headline metric, not "No completed sets yet". */
      const timedOnly = !!(st && st.longestHold>0 && !st.bestRepSet);
      $('#stats').innerHTML = st && !isBodyweight && st.bestEst ? `
        <div class="stat"><span class="stat-label">PROJECTED 1RM</span><span class="stat-value">${displayWeight(st.projected)} ${weightUnit()}</span><span class="stat-sub">RPE-adjusted · ${displayWeight(st.bestEst.w)} × ${st.bestEst.r} @ ${st.bestEst.rpe ?? '—'}</span></div>
        <div class="stat"><span class="stat-label">HEAVIEST SET PR</span><span class="stat-value">${displayWeight(st.heaviest.w)} ${weightUnit()}</span><span class="stat-sub">${st.heaviest.r} reps · ${st.heaviest.date}</span></div>
        <div class="stat"><span class="stat-label">VOLUME LOGGED</span><span class="stat-value">${st.sets} set${st.sets===1?'':'s'}</span><span class="stat-sub">${sessionsSub}</span></div>` : timedOnly ? `
        <div class="stat"><span class="stat-label">LONGEST HOLD</span><span class="stat-value">${st.longestHold} sec</span><span class="stat-sub">${sessionsSub}</span></div>
        <div class="stat"><span class="stat-label">PROJECTED 1RM</span><span class="stat-value">—</span><span class="stat-sub">Timed sets don't project a 1RM</span></div>
        <div class="stat"><span class="stat-label">SESSIONS</span><span class="stat-value">${st.sessions}</span><span class="stat-sub">Completed workouts</span></div>` : st && isBodyweight ? `
        <div class="stat"><span class="stat-label">BODYWEIGHT MOVEMENT</span><span class="stat-value">${st.sets} set${st.sets===1?'':'s'}</span><span class="stat-sub">Added weight is optional</span></div>
        <div class="stat"><span class="stat-label">BEST REP SET</span><span class="stat-value">${st.bestRepSet} reps</span><span class="stat-sub">${sessionsSub}</span></div>
        <div class="stat"><span class="stat-label">SESSIONS</span><span class="stat-value">${st.sessions}</span><span class="stat-sub">Completed workouts</span></div>` : st ? `
        <div class="stat"><span class="stat-label">PROJECTED 1RM</span><span class="stat-value">—</span><span class="stat-sub">Complete a weighted set to calculate it</span></div>
        <div class="stat"><span class="stat-label">BEST REP SET</span><span class="stat-value">${st.bestRepSet} reps</span><span class="stat-sub">${sessionsSub}</span></div>
        <div class="stat"><span class="stat-label">SESSIONS</span><span class="stat-value">${st.sessions}</span><span class="stat-sub">Completed workouts</span></div>` : `
        <div class="stat"><span class="stat-label">PROJECTED 1RM</span><span class="stat-value">—</span><span class="stat-sub">Complete a weighted set to calculate it</span></div>
        <div class="stat"><span class="stat-label">HEAVIEST SET PR</span><span class="stat-value">—</span><span class="stat-sub">No completed sets yet</span></div>
        <div class="stat"><span class="stat-label">VOLUME LOGGED</span><span class="stat-value">0 sets</span><span class="stat-sub">No completed sets yet</span></div>`;
      /* Phone QA 2026-09-11: exercise images removed from this page for now
         (v1.007 deleted the ~120KB exerciseImageMap base64 data). */
      /* #125: exercise trends live here now (moved off Stats) — e1RM line
         plus volume-per-session bars. */
      const trendData=exerciseTrendData(id);
      const e1rmLabel=value=>`${Math.round(displayWeight(value))} ${weightUnit()}`;
      const volLabel=v=>`${Math.round(displayVolume(v)).toLocaleString()} ${weightUnit()}`;
      const progressHost=$('#exerciseProgressChart');
      const progressNote=$('#progressNote');
      /* Headline metric toggle (user 2026-09-12): tapping the headline flips
         the metric AND the line chart between Estimated 1RM and Heaviest
         weight. Dot-tap inspection keeps working — it listens on the svg,
         the toggle listens on the headline, so they never fight. */
      /* #200 (user 2026-09-12): explicit 1RM | Heaviest segmented toggle — the
         headline-tap flip was undiscoverable.
         #309 (user 2026-09-12): the toggle sits inline with the chart's own
         header ("Estimated 1RM" / "Heaviest weight"), right-justified — not
         up in the section head. It renders with the chart, so it only exists
         when there is a metric to switch (never for bodyweight / no data). */
      function progressChartBlock(kicker,svg,points,valueLabel){
        const latest=points[points.length-1];
        const val=escapeHtml(valueLabel(latest.value)),when=escapeHtml(latest.shortLabel||latest.label);
        const seg=['e1rm','heaviest'].map(m=>`<button type="button" data-progress-metric="${m}" aria-pressed="${m===progressMetric}">${m==='e1rm'?'1RM':'Heaviest'}</button>`).join('');
        /* #318 refinement (user 2026-09-12): kicker + headline form one left
           block with the toggle vertically centered against the whole block.
           The header stays inside .chart-tappable so dot-tap inspection keeps
           working. */
        return `<div class="chart-tappable"><div class="chart-head-row"><div class="chart-head-text"><p class="chart-kicker">${escapeHtml(kicker)}</p><p class="chart-headline"><strong>${val}</strong><span>${when}</span></p></div><div class="mini-segmented" role="group" aria-label="Progress metric">${seg}</div></div>${svg}</div>`;
      }
      function paintProgressMetric(){
        const heavy=progressMetric==='heaviest';
        const points=heavy?trendData.heaviest:trendData.e1rm;
        progressHost.innerHTML=progressChartBlock(heavy?'Heaviest weight':'Estimated 1RM',lineChart(points,e1rmLabel),points,e1rmLabel);
        wireChartTaps(progressHost.querySelector('.chart-tappable'),points,e1rmLabel);
        progressHost.querySelectorAll('[data-progress-metric]').forEach(btn=>{
          btn.onclick=()=>{const mode=btn.dataset.progressMetric;if(isProgressMetric(mode)&&mode!==progressMetric){progressMetric=mode;paintProgressMetric();}};
        });
        const head=progressHost.querySelector('.chart-headline');
        head.classList.add('metric-toggle');
        head.setAttribute('role','button');
        head.setAttribute('tabindex','0');
        head.setAttribute('aria-label',heavy?'Show estimated 1RM':'Show heaviest weight');
        const flip=()=>{progressMetric=flipProgressMetric(progressMetric);paintProgressMetric();};
        head.addEventListener('click',flip);
        head.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip();}});
        if(progressNote)progressNote.textContent=`${heavy?'Heaviest weight':'Estimated 1RM'} and volume per session · tap a point to inspect it`;
      }
      /* #278: timed-only history paints a longest-hold line instead of the
         e1RM/heaviest chart (which has no points for timed sets). */
      const timedTrend=!trendData.e1rm.length&&trendData.hold.length>0;
      const secLabel=v=>`${Math.round(v)} sec`;
      if(timedTrend){
        progressHost.innerHTML=chartBlock('Longest hold',lineChart(trendData.hold,secLabel),trendData.hold,secLabel);
        wireChartTaps(progressHost.querySelector('.chart-tappable'),trendData.hold,secLabel);
        if(progressNote)progressNote.textContent='Longest hold per session · tap a point to inspect it';
      }else if(isBodyweight){
        progressHost.innerHTML='<div class="chart-empty">Bodyweight progress will use reps and added load from your workouts.</div>';
        if(progressNote)progressNote.textContent='Estimated 1RM and volume per session · tap a point to inspect it';
      }else if(trendData.e1rm.length){
        paintProgressMetric();
        /* #169: with exactly one session the chart is a single dot — the
           "tap a point to inspect it" instructions mislead, so replace them
           with plain copy. The headline metric above still shows the session. */
        if(trendData.e1rm.length===1&&progressNote)progressNote.textContent='Log one more session to see your progress chart.';
      }else{
        progressHost.innerHTML='<div class="chart-empty">Complete a workout to start this chart.</div>';
        if(progressNote)progressNote.textContent='Estimated 1RM and volume per session · tap a point to inspect it';
      }
      const volumeHost=$('#exerciseVolumeChart');
      /* #278: timed-only history bars time under tension instead of
         (meaningless, all-zero) lb volume. */
      const volSeries=trendData.volume.length
        ? {points:trendData.volume,kicker:'Volume per session',label:volLabel}
        : (timedTrend&&trendData.timeVolume.length
          ? {points:trendData.timeVolume,kicker:'Time under tension',label:secLabel}
          : null);
      volumeHost.innerHTML=volSeries
        ? chartBlock(volSeries.kicker,barChart(volSeries.points,volSeries.label),volSeries.points,volSeries.label)
        : '';
      wireChartTaps(volumeHost.querySelector('.chart-tappable'),volSeries?volSeries.points:[],volSeries?volSeries.label:volLabel);
      renderHistory(id);
      /* #202 (user 2026-09-12): the exercise-specific Notes card is removed
         from this page for now (may return as a future feature). Per-exercise
         notes inside workouts are untouched. */
      /* #125 (user 2026-09-11): the standalone Movement card is gone — its
         force/mechanic/primary/secondary info lives in the muscle-map modal
         (wired below). Custom-exercise Edit joins Delete in the bottom row. */
      $('#customToolsRow').innerHTML = ex.custom ? `<button class="custom-tool" id="editCustomExercise" type="button">Edit</button><button class="custom-tool danger custom-delete-btn" id="deleteCustomExercise" type="button">Delete exercise</button>` : '';
      $('#editCustomExercise')?.addEventListener('click', () => openCustomDialog(ex));
      $('#deleteCustomExercise')?.addEventListener('click', () => requestDeleteCustomExercise(ex.id));
      /* Muscle-map info modal: same movement facts the old card showed. */
      $('#closeMovementInfo').onclick = () => $('#movementInfoDialog').close();
      $('#muscleMapInfoButton').onclick = () => {
        $('#movementInfoSub').textContent = ex.name;
        $('#movementInfoBody').innerHTML = `<div><dt>Force</dt><dd>${escapeHtml(ex.force || '—')}</dd></div><div><dt>Mechanic</dt><dd>${escapeHtml(ex.mechanic || '—')}</dd></div><div><dt>Primary</dt><dd>${escapeHtml(ex.primary.join(', ') || '—')}</dd></div><div><dt>Secondary</dt><dd>${escapeHtml(ex.secondary.join(', ') || '—')}</dd></div>`;
        $('#movementInfoDialog').showModal();
      };
      $('#instructions').innerHTML = ex.instructions.length ? ex.instructions.map(x => `<li>${escapeHtml(x)}</li>`).join('') : '<li>No instructions added.</li>';
      $('#similarGrid').innerHTML = `<div class="action-list">${similarTo(ex).map(x => `<button class="action-row" type="button" data-id="${escapeHtml(x.id)}" aria-label="Open ${escapeHtml(x.name)}"><span><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.primary[0] || 'Unspecified muscle')} · ${escapeHtml(x.equipment || 'No equipment')}</span></span><span class="similar-chevron" aria-hidden="true">›</span></button>`).join('')}</div>`;
      document.querySelectorAll('#similarGrid [data-id]').forEach(btn => btn.addEventListener('click', () => openExercise(btn.dataset.id)));
      /* Anatomical muscle map for this exercise (user 2026-09-10). */
      $('#exerciseBodyMap').innerHTML = exerciseBodyMapMarkup(ex);
      hydrateBodyMaps();
      state.activeView = 'detail';
      hideAllViews();
      $('#detailView').classList.add('active');
      setActiveNav('library');
      updateTopBar('detail', ex.name);
      if (fromDetail) state.scroll['detail'] = 0;
      restoreScroll('detail');
      updateExerciseBackLabel();
      /* Coherent history (user 2026-09-12): the pushed entry carries its
         return, so system back restores the exact screen — including a
         completed log — instead of a derived guess. */
      if (push) history.pushState({exercise:id, exReturn: state.exerciseDetailReturn || null}, '', `#${encodeURIComponent(id)}`);
    }
    /** Names the destination on the top-bar Back button's accessible label. */
    function updateExerciseBackLabel() {
      const topBack = $('#topBarBack'); if (!topBack) return;
      const names = {'completed-workout':'workout', workout:'workout', stats:'stats', dashboard:'home', program:'program', library:'library'};
      const dest = names[state.exerciseDetailReturn?.view] || 'library';
      topBack.setAttribute('aria-label', `Back to ${dest}`);
    }

    /** Returns from the exercise detail to the recorded origin (library, stats, dashboard,
     *  the workout tab, or the completed workout it was drilled into). Back pops one
     *  navigation level: it navigates without pushing a new history entry, so tapping
     *  Back then the browser back button never ping-pongs. */
    function backFromExerciseDetail() {
      /* Coherent history (user 2026-09-12): when this detail is the current
         history entry, pop it — chevron and system back agree, and popstate
         restores the entry below. Unpushed (boot, restored) keeps the
         in-app return. */
      if (history.state?.exercise) { history.back(); return; }
      const ret = state.exerciseDetailReturn;
      if (ret && ret.view === 'completed-workout' && ret.workoutId) {
        const workout = workoutState.completed.find(w => w.id === ret.workoutId);
        if (workout) { showWorkouts(false); renderCompletedWorkout(workout); return; }
        showWorkouts(false); return;
      }
      if (ret && ret.view === 'stats') { showStats(false); return; }
      if (ret && ret.view === 'dashboard') { showDashboard(false); return; }
      if (ret && ret.view === 'program') { showProgram(false); return; }
      if (ret && ret.view === 'workout') {
        /* Restore the exact workout sub-screen the user came from (user
           2026-09-12): info → back from the builder/editor/saved editor must
           land back there, not on the workout start screen. */
        state.workoutEditorOpen = ret.sub === 'editor' && !!workoutState.draft;
        state.builderOpen = ret.sub === 'builder' && !!state.savedBuilder;
        state.savedWorkoutId = ret.sub === 'saved' ? (ret.savedWorkoutId || null) : null;
        state.workoutHistoryOpen = ret.sub === 'history';
        showWorkouts(false, true);
        return;
      }
      showLibrary(false);
    }
    
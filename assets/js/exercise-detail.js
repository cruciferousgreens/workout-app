
    /** Calculates exercise PRs, history, similarity, and detail-view presentation. */
    function estimate1RM(set) {
      // Use the logged load as-is; dumbbell entries are the combined total, not a per-hand value.
      const weight = Number(set.w);
      if (!Number.isFinite(weight) || weight <= 0) return 0;
      const rir = set.rpe == null || set.rpe === '' ? 0 : Math.max(0, 10 - Number(set.rpe));
      return weight * (1 + (Number(set.r) + rir) / 30);
    }

    function lineChart(points, valueLabel = value => `${Math.round(value).toLocaleString()}`) {
      if (!points.length) return '<div class="chart-empty">Complete workouts to start this chart.</div>';
      const width=620, height=190, left=42, right=14, top=14, bottom=30;
      const values=points.map(p=>Number(p.value)||0), max=Math.max(...values,1), min=Math.min(...values,0);
      const range=Math.max(1,max-min), plotW=width-left-right, plotH=height-top-bottom;
      const coords=points.map((p,i)=>({x:left+(points.length===1?plotW/2:i*plotW/(points.length-1)),y:top+(max-(Number(p.value)||0))*plotH/range,...p}));
      const path=coords.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(points.map(p=>`${p.label}: ${valueLabel(p.value)}`).join(', '))}"><line class="chart-axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"/><line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"/><text class="chart-label" x="${left-6}" y="${top+4}" text-anchor="end">${escapeHtml(valueLabel(max))}</text><text class="chart-label" x="${left-6}" y="${height-bottom}" text-anchor="end">${escapeHtml(valueLabel(min))}</text><path class="chart-line" d="${path}"/>${coords.map((p,i)=>`<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="4"><title>${escapeHtml(p.label)}: ${escapeHtml(valueLabel(p.value))}</title></circle>${(i===0||i===coords.length-1||points.length<5)?`<text class="chart-label" x="${p.x}" y="${height-8}" text-anchor="${i===0?'start':i===coords.length-1?'end':'middle'}">${escapeHtml(p.shortLabel||p.label)}</text>`:''}`).join('')}</svg>`;
    }

    function allSets(logs) {
      return logs.flatMap(session => session.sets.map(set => ({...set, date:session.date})));
    }

    function statsFor(id) {
      const logs = getExerciseLogs(id);
      const sets = allSets(logs).filter(set => Number(set.w) > 0 && Number(set.r) > 0);
      if (!sets.length) return null;
      const bestEst = sets.reduce((a,b) => estimate1RM(a) > estimate1RM(b) ? a : b);
      const heaviest = sets.reduce((a,b) => Number(a.w) > Number(b.w) ? a : b);
      return {sessions:logs.length, sets:sets.length, bestEst, projected:Math.round(estimate1RM(bestEst)), heaviest};
    }

    function similarity(a, b) {
      const sharedPrimary = a.primary.filter(m => b.primary.includes(m)).length;
      const sharedSecondary = a.secondary.filter(m => b.secondary.includes(m)).length;
      return sharedPrimary * 3 + sharedSecondary + (a.equipment === b.equipment ? 2 : 0);
    }

    function similarTo(ex) {
      return exercises.filter(x => x.id !== ex.id).map(x => ({...x, score:similarity(ex,x)})).filter(x => x.score > 0).sort((a,b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0,4);
    }

    function renderHistory(id) {
      const logs = getExerciseLogs(id);
      $('#historyCount').textContent = logs.length ? `${logs.length} completed workout${logs.length===1?'':'s'}` : '';
      $('#historyList').classList.toggle('is-empty', !logs.length);
      $('#historyList').innerHTML = logs.length ? logs.map(session => {
        const top = Math.round(Math.max(...session.sets.map(estimate1RM)));
        return `<div class="history-session">
          <div class="session-head"><span class="session-date">${escapeHtml(session.date)}</span><span class="session-est">Best estimate ${top} lb · <button class="filter-clear" type="button" data-history-workout="${escapeHtml(session.workoutId)}">View workout</button></span></div>
          ${session.exerciseTags?.length?`<div class="exercise-tag-row">${session.exerciseTags.map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}</div>`:''}
          <div class="sets">${session.sets.map((s,i) => `<div class="set-row"><span class="set-num">SET ${i+1}</span><span class="set-cell"><strong>${s.w ?? '—'}</strong>${s.w == null ? '' : ' lb'}</span><span class="set-cell"><strong>${session.tracking === 'time' ? (s.seconds ?? '—') : s.r}</strong> ${session.tracking === 'time' ? 'sec' : 'reps'}</span><span class="set-cell">${s.rpe == null ? '—' : `RPE <strong>${s.rpe}</strong>`}${s.tags?.length ? `<br><small>${s.tags.map(escapeHtml).join(' · ')}</small>` : ''}</span></div>`).join('')}</div>
        </div>`;
      }).join('') : `<div class="history-empty">No history for this movement yet.</div>`;
      document.querySelectorAll('[data-history-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=workoutState.completed.find(row=>row.id===button.dataset.historyWorkout);if(workout){state.workoutDetailReturn='library';showWorkouts();renderCompletedWorkout(workout);}}));
      $('#formulaNote').textContent = '';
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
      } else if (state.activeView !== 'detail') {
        state.exerciseDetailReturn = {view: state.activeView};
      }
      $('#detailTitle').textContent = ex.name;
      $('#detailTags').innerHTML = [...ex.primary.map(x => `<span class="tag primary">${escapeHtml(x)}</span>`), ...ex.secondary.map(x => `<span class="tag">${escapeHtml(x)}</span>`), `<span class="tag">${escapeHtml(ex.equipment || 'no equipment')}</span>`, ...(ex.custom ? ['<span class="tag custom">Custom</span>'] : [])].join('');
      $('#sourceId').innerHTML = ex.custom ? 'Created in this session' : `Source record <strong>${escapeHtml(ex.id)}</strong><br><a href="${SOURCE_URL}" target="_blank" rel="noreferrer">View dataset ↗</a>`;
      const realStats = statsFor(id);
      const st = realStats;
      const isBodyweight = ex.equipment === 'body only';
      $('#stats').innerHTML = st && !isBodyweight ? `
        <div class="stat"><span class="stat-label">PROJECTED 1RM</span><span class="stat-value">${st.projected} lb</span><span class="stat-sub">RPE-adjusted · ${st.bestEst.w} × ${st.bestEst.r} @ ${st.bestEst.rpe ?? '—'}</span></div>
        <div class="stat"><span class="stat-label">HEAVIEST SET PR</span><span class="stat-value">${st.heaviest.w} lb</span><span class="stat-sub">${st.heaviest.r} reps · ${st.heaviest.date}</span></div>
        <div class="stat"><span class="stat-label">VOLUME LOGGED</span><span class="stat-value">${st.sets} sets</span><span class="stat-sub">Across ${st.sessions} workout${st.sessions===1?'':'s'}</span></div>` : st ? `
        <div class="stat"><span class="stat-label">BODYWEIGHT MOVEMENT</span><span class="stat-value">${st.sets} sets</span><span class="stat-sub">Added weight is optional</span></div>
        <div class="stat"><span class="stat-label">BEST REP SET</span><span class="stat-value">${Math.max(...allSets(getExerciseLogs(id)).map(s=>Number(s.r)||0))} reps</span><span class="stat-sub">Across ${st.sessions} workout${st.sessions===1?'':'s'}</span></div>
        <div class="stat"><span class="stat-label">SESSIONS</span><span class="stat-value">${st.sessions}</span><span class="stat-sub">Completed workouts</span></div>` : `
        <div class="stat"><span class="stat-label">PROJECTED 1RM</span><span class="stat-value">—</span><span class="stat-sub">Complete a weighted set to calculate it</span></div>
        <div class="stat"><span class="stat-label">HEAVIEST SET PR</span><span class="stat-value">—</span><span class="stat-sub">No completed sets yet</span></div>
        <div class="stat"><span class="stat-label">VOLUME LOGGED</span><span class="stat-value">0 sets</span><span class="stat-sub">No completed sets yet</span></div>`;
      const visual=exerciseImageMap[id];
      $('#exerciseVisual').classList.toggle('visible', !!visual);
      $('#exerciseVisual').innerHTML=visual?`<img src="${visual.src}" alt="${escapeHtml(visual.alt)}"><div class="exercise-visual-copy"><strong>Movement reference</strong><p>Use the instructions below for setup and execution. <a href="${visual.source}" target="_blank" rel="noreferrer">Image source ↗</a></p></div>`:'';
      const trendLogs = getExerciseLogs(id);
      const trend=trendLogs.slice().reverse().map(session=>({label:session.date,shortLabel:session.date.replace(/, \d{4}/,''),value:Math.round(Math.max(...session.sets.map(estimate1RM)))})).filter(p=>p.value>0);
      $('#exerciseProgressChart').innerHTML=isBodyweight?'<div class="chart-empty">Bodyweight progress will use reps and added load from your workouts.</div>':lineChart(trend,value=>`${Math.round(value)} lb`);
      renderHistory(id);
      $('#noteCard').innerHTML = `No notes for this movement yet.<span class="note-meta">Exercise-specific note</span>`;
      $('#movementCard').innerHTML = `<dl><dt>Force</dt><dd>${escapeHtml(ex.force || '—')}</dd><dt>Mechanic</dt><dd>${escapeHtml(ex.mechanic || '—')}</dd><dt>Primary</dt><dd>${escapeHtml(ex.primary.join(', ') || '—')}</dd><dt>Secondary</dt><dd>${escapeHtml(ex.secondary.join(', ') || '—')}</dd></dl>${ex.custom ? `<div class="custom-tools"><button class="custom-tool" id="editCustomExercise" type="button">Edit</button><button class="custom-tool danger" id="deleteCustomExercise" type="button">Delete</button></div>` : ''}`;
      $('#instructions').innerHTML = ex.instructions.length ? ex.instructions.map(x => `<li>${escapeHtml(x)}</li>`).join('') : '<li>No instructions added.</li>';
      if (ex.custom) {
        $('#editCustomExercise').addEventListener('click', () => openCustomDialog(ex));
        $('#deleteCustomExercise').addEventListener('click', () => deleteCustomExercise(ex.id));
      }
      $('#similarGrid').innerHTML = `<div class="action-list">${similarTo(ex).map(x => `<button class="action-row" type="button" data-id="${escapeHtml(x.id)}" aria-label="Open ${escapeHtml(x.name)}"><span><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.primary[0] || 'Unspecified muscle')} · ${escapeHtml(x.equipment || 'No equipment')}</span></span><span class="similar-chevron" aria-hidden="true">›</span></button>`).join('')}</div>`;
      document.querySelectorAll('#similarGrid [data-id]').forEach(btn => btn.addEventListener('click', () => openExercise(btn.dataset.id)));
      state.activeView = 'detail';
      $('#dashboardView').classList.remove('active');
      $('#statsView').classList.remove('active');
      $('#libraryView').classList.add('hidden');
      $('#workoutView').classList.remove('active');
      $('#programView').classList.remove('active');
      $('#detailView').classList.add('active');
      setActiveNav('library');
      if (fromDetail) state.scroll['detail'] = 0;
      restoreScroll('detail');
      updateExerciseBackLabel();
      if (push) history.pushState({exercise:id}, '', `#${encodeURIComponent(id)}`);
    }
    /** Names the destination on the Back button's accessible label. */
    function updateExerciseBackLabel() {
      const back = $('#backButton'); if (!back) return;
      const names = {'completed-workout':'workout', workout:'training', stats:'stats', dashboard:'home', program:'program', library:'library'};
      const dest = names[state.exerciseDetailReturn?.view] || 'library';
      back.setAttribute('aria-label', `Back to ${dest}`);
    }

    /** Returns from the exercise detail to the recorded origin (library, stats, dashboard,
     *  the workout tab, or the completed workout it was drilled into). */
    function backFromExerciseDetail() {
      const ret = state.exerciseDetailReturn;
      if (ret && ret.view === 'completed-workout' && ret.workoutId) {
        const workout = workoutState.completed.find(w => w.id === ret.workoutId);
        if (workout) { showWorkouts(false); renderCompletedWorkout(workout); return; }
      }
      if (ret && ret.view === 'stats') { showStats(); return; }
      if (ret && ret.view === 'dashboard') { showDashboard(); return; }
      if (ret && ret.view === 'program') { showProgram(); return; }
      if (ret && ret.view === 'workout') { showWorkouts(); return; }
      showLibrary();
    }
    
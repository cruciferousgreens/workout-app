
/* ===== module: exercise-library.js ===== */
    /** Renders searchable exercise cards and the multi-muscle AND filter. */
    function populateFilters() {
      const muscles = [...new Set(exercises.flatMap(x => [...x.primary, ...x.secondary]))].sort();
      const equipment = [...new Set(exercises.map(x => x.equipment).filter(Boolean))].sort();
      $('#muscleOptions').innerHTML = muscles.map(x => `<button class="muscle-option" type="button" data-muscle="${x}" aria-pressed="false">${titleCase(x)}</button>`).join('');
      $('#equipmentFilter').innerHTML = '<option value="">All equipment</option>' + equipment.map(x => `<option value="${x}">${titleCase(x)}</option>`).join('');
      document.querySelectorAll('.muscle-option').forEach(button => button.addEventListener('click', () => {
        const muscle = button.dataset.muscle;
        if (state.muscles.has(muscle)) state.muscles.delete(muscle); else state.muscles.add(muscle);
        renderMuscleSelection();
        renderLibrary();
      }));
    }

    function renderMuscleSelection() {
      document.querySelectorAll('.muscle-option').forEach(button => button.setAttribute('aria-pressed', state.muscles.has(button.dataset.muscle)));
      $('#clearMuscles').hidden = state.muscles.size === 0;
    }

    function filteredExercises() {
      const ranked = state.query ? rankedExerciseMatches(state.query, exercises.length) : exercises;
      return ranked.filter(x => {
        const allMuscles = [...x.primary, ...x.secondary];
        const muscleMatch = !state.muscles.size || [...state.muscles].every(muscle => allMuscles.includes(muscle));
        return muscleMatch && (!state.equipment || x.equipment === state.equipment);
      });
    }

    function exerciseCard(x) {
      const muscles = x.primary.length ? x.primary.map(muscle => `<span class="tag primary">${escapeHtml(muscle)}</span>`).join('') : '<span class="tag primary">Unspecified muscle</span>';
      return `<button class="exercise-card" type="button" data-id="${escapeHtml(x.id)}">
        <h2>${escapeHtml(x.name)}</h2>
        <div class="tag-row">${muscles}<span class="tag">${escapeHtml(x.equipment || 'none')}</span>${x.custom ? '<span class="tag custom">Custom</span>' : ''}</div>
      </button>`;
    }

    /** Real completed history only — sample workouts are excluded so the progression engine,
     *  PRs, and exercise stats never treat demo data as the user's own. */
    function getExerciseLogs(id) {
      return realWorkouts().flatMap(workout => workout.exercises
        .filter(item => item.exerciseId === id)
        .map(item => ({workoutId:workout.id,date: formatLogDate(workout.date), isoDate:workout.date, tracking:item.tracking || (item.sets.some(set => set.seconds != null) ? 'time' : 'reps'), progression:item.progression?{...item.progression}:null, exerciseTags:[...(item.exerciseTags||[])], sets:item.sets.map(set => ({w:set.w,r:set.r,seconds:set.seconds,rpe:set.rpe,tags:[...(set.tags || [])]})), name:workout.name})));
    }

    function recentExerciseIds() {
      const ids = new Set();
      realWorkouts().forEach(workout => workout.exercises.forEach(item => ids.add(item.exerciseId)));
      return [...ids].sort((a, b) => {
        const aDate = getExerciseLogs(a)[0]?.isoDate || '';
        const bDate = getExerciseLogs(b)[0]?.isoDate || '';
        return bDate.localeCompare(aDate);
      });
    }

    function renderLibrary() {
      const rows = filteredExercises();
      const filtered = !!state.query || state.muscles.size > 0 || !!state.equipment;
      const recentIds = recentExerciseIds();
      const recent = filtered ? [] : recentIds.map(id => rows.find(x => x.id === id)).filter(Boolean);
      const recentSet = new Set(recent.map(x => x.id));
      const rest = rows.filter(x => !recentSet.has(x.id));
      const exactQuery=normalize(state.query),hasLiteral=!state.query||rows.some(x=>normalize([x.name,x.id].join(' ')).includes(exactQuery));
      $('#resultCount').innerHTML = `${rows.length} of ${exercises.length} movements${state.query ? ` ${hasLiteral?'matching':'closest to'} <span class="active-query">“${escapeHtml(state.query)}”</span>` : ''}`;
      $('#exerciseResults').innerHTML = rows.length ? `${recent.length ? `<section class="library-section" aria-labelledby="recentHeading"><div class="library-heading-row"><h2 class="library-heading" id="recentHeading">Recent</h2></div><div class="exercise-grid">${recent.map(exerciseCard).join('')}</div></section>` : ''}<section class="library-section" aria-labelledby="allHeading"><div class="library-heading-row"><h2 class="library-heading" id="allHeading">${recent.length ? 'All exercises' : 'Exercises'}</h2><button class="text-link" id="newExerciseLink" type="button">+ New exercise</button></div><div class="exercise-grid">${rest.map(exerciseCard).join('')}</div></section>` : `<div class="exercise-grid"><div class="empty"><strong>No movements found</strong>Try a broader name or clear one of the filters.</div></div>`;
      document.querySelectorAll('.exercise-card').forEach(btn => btn.addEventListener('click', () => openExercise(btn.dataset.id)));
      $('#newExerciseLink')?.addEventListener('click', () => openCustomDialog());
    }

    
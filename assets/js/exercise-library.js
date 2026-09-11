
/* ===== module: exercise-library.js ===== */
    /** Renders searchable exercise cards and the multi-muscle AND filter. */
    function populateFilters() {
      const muscles = [...new Set(exercises.flatMap(x => [...x.primary, ...x.secondary]))].sort();
      const equipment = [...new Set(exercises.map(x => x.equipment).filter(Boolean))].sort();
      $('#muscleOptions').innerHTML = muscles.map(x => `<button class="muscle-option" type="button" data-muscle="${x}" aria-pressed="false">${titleCase(x)}</button>`).join('');
      $('#equipmentFilter').innerHTML = '<option value="">All equipment</option>' + equipment.map(x => `<option value="${x}">${titleCase(x)}</option>`).join('');
      /* Scope to [data-muscle]: the ★ Favorites toggle shares the muscle-option
         class but has no data-muscle — the generic handler would add `undefined`
         to the muscle set and empty the library (QA 2026-09-10). */
      document.querySelectorAll('.muscle-option[data-muscle]').forEach(button => button.addEventListener('click', () => {
        const muscle = button.dataset.muscle;
        if (state.muscles.has(muscle)) state.muscles.delete(muscle); else state.muscles.add(muscle);
        renderMuscleSelection();
        renderLibrary();
      }));
      $('#favoritesToggle')?.addEventListener('click', () => {
        state.onlyFavorites = !state.onlyFavorites;
        renderMuscleSelection();
        renderLibrary();
      });
      /* Custom-exercise filter sits beside ★ Favorites (user 2026-09-10). */
      $('#customToggle')?.addEventListener('click', () => {
        state.onlyCustom = !state.onlyCustom;
        renderMuscleSelection();
        renderLibrary();
      });
    }

    function renderMuscleSelection() {
      document.querySelectorAll('.muscle-option').forEach(button => button.setAttribute('aria-pressed', state.muscles.has(button.dataset.muscle)));
      const favToggle = $('#favoritesToggle');
      if (favToggle) favToggle.setAttribute('aria-pressed', String(state.onlyFavorites));
      const customToggle = $('#customToggle');
      if (customToggle) customToggle.setAttribute('aria-pressed', String(state.onlyCustom));
      $('#clearMuscles').hidden = state.muscles.size === 0;
    }

    function filteredExercises() {
      const ranked = state.query ? rankedExerciseMatches(state.query, exercises.length) : exercises;
      return ranked.filter(x => {
        const allMuscles = [...x.primary, ...x.secondary];
        const muscleMatch = !state.muscles.size || [...state.muscles].every(muscle => allMuscles.includes(muscle));
        const favMatch = !state.onlyFavorites || state.favorites.has(x.id);
        const customMatch = !state.onlyCustom || x.custom;
        return muscleMatch && favMatch && customMatch && (!state.equipment || x.equipment === state.equipment);
      });
    }

    const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
    function isFavorite(id) { return state.favorites.has(id); }
    function toggleFavorite(id) {
      if (!id) return;
      if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
      schedulePersist();
      /* Update every visible star for this exercise in place (no re-render, no scroll loss). */
      const fav = state.favorites.has(id);
      document.querySelectorAll('.fav-toggle[data-id]').forEach(btn => {
        if (btn.dataset.id !== id) return;
        btn.setAttribute('aria-pressed', String(fav));
        btn.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
      });
      const detailFav = $('#detailFavToggle');
      if (detailFav && state.selected === id) {
        detailFav.setAttribute('aria-pressed', String(fav));
        detailFav.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
      }
      /* Unfavoriting while the Favorites filter is on removes the card. */
      if (state.onlyFavorites) renderLibrary();
    }

    function exerciseCard(x) {
      const muscles = x.primary.length ? x.primary.map(muscle => `<span class="tag primary">${escapeHtml(muscle)}</span>`).join('') : '<span class="tag primary">Unspecified muscle</span>';
      const fav = isFavorite(x.id);
      return `<div class="exercise-card" data-id="${escapeHtml(x.id)}">
        <button class="exercise-card-main" type="button" data-id="${escapeHtml(x.id)}" aria-label="Open ${escapeHtml(x.name)}">
          <h2>${escapeHtml(x.name)}</h2>
          <div class="tag-row">${muscles}<span class="tag">${escapeHtml(x.equipment || 'none')}</span>${x.custom ? '<span class="tag custom">Custom</span>' : ''}</div>
        </button>
        <button class="fav-toggle" type="button" data-id="${escapeHtml(x.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}">${STAR_SVG}</button>
      </div>`;
    }

    /** Completed history for this exercise (per-exercise logs). */
    function getExerciseLogs(id) {
      return workoutState.completed.flatMap(workout => workout.exercises
        .filter(item => item.exerciseId === id)
        .map(item => ({workoutId:workout.id,date: formatLogDate(workout.date), isoDate:workout.date, tracking:item.tracking || (item.sets.some(set => set.seconds != null) ? 'time' : 'reps'), progression:item.progression?{...item.progression}:null, exerciseTags:[...(item.exerciseTags||[])], sets:item.sets.map(set => ({w:set.w,r:set.r,seconds:set.seconds,rpe:set.rpe,tags:[...(set.tags || [])]})), name:workout.name})));
    }

    function recentExerciseIds() {
      const ids = new Set();
      workoutState.completed.forEach(workout => workout.exercises.forEach(item => ids.add(item.exerciseId)));
      return [...ids].sort((a, b) => {
        const aDate = getExerciseLogs(a)[0]?.isoDate || '';
        const bDate = getExerciseLogs(b)[0]?.isoDate || '';
        return bDate.localeCompare(aDate);
      });
    }

    function renderLibrary() {
      const rows = filteredExercises();
      const filtered = !!state.query || state.muscles.size > 0 || !!state.equipment || state.onlyFavorites;
      const recentIds = recentExerciseIds();
      const recent = filtered ? [] : recentIds.map(id => rows.find(x => x.id === id)).filter(Boolean);
      const recentSet = new Set(recent.map(x => x.id));
      const rest = rows.filter(x => !recentSet.has(x.id));
      const exactQuery=normalize(state.query),hasLiteral=!state.query||rows.some(x=>normalize([x.name,x.id].join(' ')).includes(exactQuery));
      $('#resultCount').innerHTML = `${rows.length} of ${exercises.length} movements${state.query ? ` ${hasLiteral?'matching':'closest to'} <span class="active-query">“${escapeHtml(state.query)}”</span>` : ''}`;
      const emptyMsg = state.onlyFavorites && !state.favorites.size
        ? `<div class="exercise-grid"><div class="empty"><strong>No favorites yet</strong>Tap the ☆ on any exercise to pin it here.</div></div>`
        : `<div class="exercise-grid"><div class="empty"><strong>No movements found</strong>Try a broader name or clear one of the filters.</div></div>`;
      $('#exerciseResults').innerHTML = rows.length ? `${recent.length ? `<section class="library-section" aria-labelledby="recentHeading"><div class="library-heading-row"><h2 class="library-heading" id="recentHeading">Recent</h2></div><div class="exercise-grid">${recent.map(exerciseCard).join('')}</div></section>` : ''}<section class="library-section" aria-labelledby="allHeading"><div class="library-heading-row"><h2 class="library-heading" id="allHeading">${recent.length ? 'All exercises' : 'Exercises'}</h2><button class="text-link" id="newExerciseLink" type="button">+ New exercise</button></div><div class="exercise-grid">${rest.map(exerciseCard).join('')}</div></section>` : emptyMsg;
      document.querySelectorAll('.exercise-card-main').forEach(btn => btn.addEventListener('click', () => openExercise(btn.dataset.id)));
      document.querySelectorAll('.exercise-card .fav-toggle').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(btn.dataset.id); }));
      $('#newExerciseLink')?.addEventListener('click', () => openCustomDialog());
    }

    
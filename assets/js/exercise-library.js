
/* ===== module: exercise-library.js ===== */
    /** Renders searchable exercise cards and the multi-muscle AND filter. */
    /* #99 H2: favorites/custom toggles are persistent DOM nodes — bind their
       listeners exactly once. populateFilters() re-runs after every
       custom-exercise save/delete, and re-binding would stack N handlers
       (even N = the toggle silently no-ops). */
    let filterTogglesBound = false;
    function populateFilters() {
      const muscles = allMuscleOptions();
      /* A8 (#99): soft-deleted customs leave the filter UI. */
      const equipment = [...new Set(exercises.filter(x=>!exerciseDeleted(x)).map(x => x.equipment).filter(Boolean))].sort();
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
      if (!filterTogglesBound) {
        filterTogglesBound = true;
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
        /* A8 (#99): soft-deleted customs stay resolvable for history/stats
           but never list in the library. */
        if (exerciseDeleted(x)) return false;
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
      const muscles = x.primary.length ? x.primary.map(muscle=>musclePill(muscle)).join('') : musclePill('Unspecified muscle');
      const fav = isFavorite(x.id);
      return `<div class="exercise-card" data-id="${escapeHtml(x.id)}">
        <button class="exercise-card-main" type="button" data-id="${escapeHtml(x.id)}" aria-label="Open ${escapeHtml(x.name)}">
          <h2>${escapeHtml(x.name)}</h2>
          <div class="tag-row">${muscles}<span class="tag">${escapeHtml(x.equipment || 'none')}</span>${x.custom ? '<span class="tag custom">Custom</span>' : ''}</div>
        </button>
        <button class="fav-toggle" type="button" data-id="${escapeHtml(x.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}">${STAR_SVG}</button>
      </div>`;
    }

    /** Completed history for this exercise (per-exercise logs), newest first. */
    function getExerciseLogs(id) {
      return workoutState.completed.flatMap(workout => workout.exercises
        .filter(item => item.exerciseId === id)
        .map(item => ({workoutId:workout.id,date: formatLogDate(workout.date), isoDate:workout.date, completedAt:workout.completedAt||null, tracking:item.tracking || (item.sets.some(set => set.seconds != null) ? 'time' : 'reps'), progression:item.progression?{...item.progression}:null, exerciseTags:[...(item.exerciseTags||[])], sets:item.sets.map(set => ({w:set.w,r:set.r,seconds:set.seconds,rpe:set.rpe,tags:[...(set.tags || [])]})), name:workout.name})))
        /* #99 A13: newest-first must mean "latest by completion", not
           insertion luck (sync unions reorder equal-date records). */
        .sort(sortByRecencyDesc);
    }

    function recentExerciseIds() {
      const ids = new Set();
      workoutState.completed.forEach(workout => workout.exercises.forEach(item => ids.add(item.exerciseId)));
      return [...ids].sort((a, b) => {
        /* #99 A13: "most recently used" compares actual completion recency. */
        const la = getExerciseLogs(a)[0] || {}, lb = getExerciseLogs(b)[0] || {};
        return sortByRecencyDesc(la, lb);
      });
    }

    function renderLibrary() {
      const rows = filteredExercises();
      /* Favorites always lead the Exercises list (user 2026-09-12): their
         own section first, then Recents (non-favorites) after a hairline,
         then everything else. No sections while searching or while the
         Favorites filter is on — search already floats favorites first. */
      const sectioned = !state.query && !state.onlyFavorites;
      const favorites = sectioned ? [...state.favorites].map(id => rows.find(x => x.id === id)).filter(Boolean) : [];
      const favSet = new Set(favorites.map(x => x.id));
      const recentIds = recentExerciseIds();
      const recent = sectioned ? recentIds.filter(id => !favSet.has(id)).map(id => rows.find(x => x.id === id)).filter(Boolean) : [];
      const recentSet = new Set(recent.map(x => x.id));
      const rest = rows.filter(x => !favSet.has(x.id) && !recentSet.has(x.id));
      const exactQuery=normalize(state.query),hasLiteral=!state.query||rows.some(x=>normalize([x.name,x.id].join(' ')).includes(exactQuery));
      /* A8 (#99): the library total counts visible movements only. */
      const visibleTotal=exercises.filter(x=>!exerciseDeleted(x)).length;
      $('#resultCount').innerHTML = `${rows.length} of ${visibleTotal} movements${state.query ? ` ${hasLiteral?'matching':'closest to'} <span class="active-query">“${escapeHtml(state.query)}”</span>` : ''}`;
      const emptyMsg = state.onlyFavorites && !state.favorites.size
        ? `<div class="exercise-grid"><div class="empty"><strong>No favorites yet</strong>Tap the ☆ on any exercise to pin it here.</div></div>`
        : `<div class="exercise-grid"><div class="empty"><strong>No movements found</strong>Try a broader name or clear one of the filters.</div></div>`;
      $('#exerciseResults').innerHTML = rows.length ? `${favorites.length ? `<section class="library-section" aria-labelledby="favHeading"><div class="library-heading-row"><h2 class="library-heading" id="favHeading">Favorites</h2></div><div class="exercise-grid">${favorites.map(exerciseCard).join('')}</div></section><hr class="library-hairline">` : ''}${recent.length ? `<section class="library-section" aria-labelledby="recentHeading"><div class="library-heading-row"><h2 class="library-heading" id="recentHeading">Recent</h2></div><div class="exercise-grid">${recent.map(exerciseCard).join('')}</div></section>` : ''}<section class="library-section" aria-labelledby="allHeading"><div class="library-heading-row"><h2 class="library-heading" id="allHeading">${(favorites.length || recent.length) ? 'All exercises' : 'Exercises'}</h2><button class="text-link" id="newExerciseLink" type="button">+ New exercise</button></div><div class="exercise-grid">${rest.map(exerciseCard).join('')}</div></section>` : emptyMsg;
      document.querySelectorAll('.exercise-card-main').forEach(btn => btn.addEventListener('click', () => openExercise(btn.dataset.id)));
      document.querySelectorAll('.exercise-card .fav-toggle').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(btn.dataset.id); }));
      $('#newExerciseLink')?.addEventListener('click', () => openCustomDialog());
    }

    
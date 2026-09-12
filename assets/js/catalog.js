/* ===== module: catalog.js ===== */
    /** Normalizes the bundled exercise database (records live in
        exercise-data.js, #99 B19) into the app's lightweight exercise model. */
        /* Module map (v1.006) — Key: `exercises` — the normalized catalog every picker and detail view reads. Depends on: window.FREE_EXERCISE_DB from data/exercises-db.js (exercise-data.js's coreExercises is only the fallback when the DB script fails to load). */

    let exercises = Array.isArray(window.FREE_EXERCISE_DB) ? window.FREE_EXERCISE_DB.map(x => ({
      id: x.id,
      name: x.name,
      force: x.force,
      level: x.level,
      mechanic: x.mechanic,
      equipment: x.equipment,
      primary: x.primaryMuscles || [],
      secondary: x.secondaryMuscles || [],
      category: x.category,
      tracking: x.force === 'static' ? 'time' : 'reps',
      instructions: x.instructions || [],
      images: x.images || []
    })).filter(x => x.id && x.name) : coreExercises;

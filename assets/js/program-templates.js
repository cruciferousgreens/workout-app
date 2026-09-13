/* ===== module: program-templates.js ===== */
    /** Built-in workout templates — removed 2026-09-13 per user (StrongLifts A/B deleted). */
    /* Module map (v1.006) — Key: programTemplateExercise(), buildStrongLiftsWorkoutTemplates(), cloneWorkoutTemplates(). Depends on: workout-editor factories (newSet()/newExerciseItem() — runtime only; this file loads first), state.templates (populated at bootstrap). */
    function programTemplateExercise(exerciseId, setCount, reps, exerciseTags = ['Straight sets']) {
      return newExerciseItem({
        exerciseId,
        tracking:'reps',
        note:'',
        exerciseTags:[...exerciseTags],
        progression:defaultExerciseProgression({mode:'reps',min:reps,max:reps}),
        sets:Array.from({length:setCount},()=>Object.assign(newSet(),{r:String(reps)}))
      });
    }

    /* 2026-09-13 (user): the two built-in StrongLifts templates are deleted.
       Stub returns [] so existing callers (bootstrap seed, persistence merge,
       sync clearSyncableKey) naturally produce an empty template list, and any
       previously-persisted built-ins are filtered out on restore (see
       persistence.js setSyncableValue). */
    function buildStrongLiftsWorkoutTemplates(){
      return [];
    }

    /** Fresh deep copies of the built-in workout templates (safe to mutate per session). */
    function cloneWorkoutTemplates() {
      return [];
    }

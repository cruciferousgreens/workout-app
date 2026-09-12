
/* ===== module: program-templates.js ===== */
    /** Defines permanent built-in program templates and their reusable workout templates. */
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

    /* P0 hotfix 2026-09-11 (v0.99e): this used to be a top-level const whose
       initializers called newExerciseItem()/newSet()/defaultExerciseProgression().
       Those factories live in workout-editor.js, which loads AFTER this file —
       so the const threw ReferenceError at script load and killed the whole app.
       Construction is now lazy: nothing calls the factories until runtime,
       after every script has loaded. Do NOT move this back to a top-level const. */
    function buildStrongLiftsWorkoutTemplates(){
      return [
      {id:'builtin-stronglifts-a',builtIn:true,name:'StrongLifts 5×5 · Workout A',exercises:[
        programTemplateExercise('Barbell_Squat',5,5),
        programTemplateExercise('Barbell_Bench_Press_-_Medium_Grip',5,5),
        programTemplateExercise('Bent_Over_Barbell_Row',5,5)
      ]},
      {id:'builtin-stronglifts-b',builtIn:true,name:'StrongLifts 5×5 · Workout B',exercises:[
        programTemplateExercise('Barbell_Squat',5,5),
        programTemplateExercise('Standing_Military_Press',5,5),
        programTemplateExercise('Barbell_Deadlift',1,5)
      ]}
      ];
    }

    /* StrongLifts remains available only as reusable Workout A/B templates. */

    /** Fresh deep copies of the built-in workout templates (safe to mutate per session). */
    function cloneWorkoutTemplates() {
      return buildStrongLiftsWorkoutTemplates().map(template=>({...template,exercises:template.exercises.map(item=>({...item,exerciseTags:[...(item.exerciseTags||[])],progression:{...item.progression},sets:item.sets.map(set=>({...set,tags:[...(set.tags||[])]}))}))}));
    }

    

    /** Defines permanent built-in program templates and their reusable workout templates. */
    function programTemplateExercise(exerciseId, setCount, reps, exerciseTags = ['Straight sets']) {
      return {
        exerciseId,
        tracking:'reps',
        note:'',
        exerciseTags:[...exerciseTags],
        supersetId:null,
        progression:{mode:'reps',min:reps,max:reps,incrementType:'lb',incrementValue:5,repsOnly:false},
        sets:Array.from({length:setCount},()=>({w:'',r:String(reps),seconds:'',rpe:'',tags:[],complete:false}))
      };
    }

    const strongLiftsWorkoutTemplates = [
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

    /* StrongLifts remains available only as reusable Workout A/B templates. */
    const builtInPrograms = [];

    /** Fresh deep copies of the built-in workout templates (safe to mutate per session). */
    function cloneWorkoutTemplates() {
      return strongLiftsWorkoutTemplates.map(template=>({...template,exercises:template.exercises.map(item=>({...item,exerciseTags:[...(item.exerciseTags||[])],progression:{...item.progression},sets:item.sets.map(set=>({...set,tags:[...(set.tags||[])]}))}))}));
    }

    
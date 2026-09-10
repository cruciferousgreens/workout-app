
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

    const builtInPrograms = [{
      id:'builtin-stronglifts-5x5',
      name:'StrongLifts 5×5',
      length:12,
      focus:'Alternating full-body strength sessions three days per week.',
      schedule:'A / B / A, then B / A / B',
      progression:{threshold:8,incrementType:'lb',incrementValue:5,treatment:'suggestions',stallDetection:true},
      workouts:[
        {uid:'builtin-sl-a',name:'Workout A',template:{name:'Workout A',exercises:strongLiftsWorkoutTemplates[0].exercises}},
        {uid:'builtin-sl-b',name:'Workout B',template:{name:'Workout B',exercises:strongLiftsWorkoutTemplates[1].exercises}}
      ]
    }];

    const initialSampleWorkouts = generateSampleWorkouts();
    const historicalProgramWorkoutIds = { 'Upper A':'sample-upper-a', 'Lower A':'sample-lower-a', 'Upper B':'sample-upper-b', 'Lower B':'sample-lower-b' };
    const historicalProgramLogs = initialSampleWorkouts.slice(-16);
    historicalProgramLogs.forEach(workout => {
      workout.programId = 'sample-spring-strength';
      workout.programWorkoutUid = historicalProgramWorkoutIds[workout.name] || null;
    });
    const sampleHistoricalProgram = {
      id:'sample-spring-strength',
      sample:true,
      name:'Sample · Spring Strength Block',
      length:4,
      focus:'A completed four-week example program for testing program history and audit views.',
      startedAt:historicalProgramLogs.at(-1)?.date || localIsoDate(),
      archivedAt:historicalProgramLogs[0]?.date || localIsoDate(),
      progression:{threshold:8,incrementType:'lb',incrementValue:5,treatment:'suggestions',stallDetection:true},
      workouts:[
        {uid:'sample-upper-a',name:'Upper A'}, {uid:'sample-lower-a',name:'Lower A'},
        {uid:'sample-upper-b',name:'Upper B'}, {uid:'sample-lower-b',name:'Lower B'}
      ]
    };

    const sampleNotes = {
      'Wide-Grip_Lat_Pulldown':'Shoulder-width-plus grip felt strongest. Keep the chest high and think “elbows into back pockets.” The last rep gets loose when the torso leans too far back.',
      'Barbell_Bench_Press_-_Medium_Grip':'Pause the first rep of each set. Right wrist stacks better when the grip is one finger narrower.',
      'Barbell_Squat':'Use the second rack height. Brace before unracking and keep the walkout to two steps.'
    };

    
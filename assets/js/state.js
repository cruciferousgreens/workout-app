
    /** Holds in-memory UI and training state; persistence is intentionally outside this static preview. */
    const state = { query:'', muscles:new Set(), equipment:'', selected:null, customExercises:[], activeView:'dashboard', workoutDetailReturn:'workout', dashboardPeriod:'week', statsPeriod:'week', selectedDashboardDate:null, calendarWeekOffset:0, samplePromptShown:false, scroll:{dashboard:0, library:0, workout:0, program:0, stats:0, detail:0} };
    const customDraft = { primary:new Set(), secondary:new Set(), equipment:'', force:'', mechanic:'', tracking:'reps' };
    const workoutState = {
      draft: null,
      completed: initialSampleWorkouts,
      templates: strongLiftsWorkoutTemplates.map(template=>({...template,exercises:template.exercises.map(item=>({...item,exerciseTags:[...(item.exerciseTags||[])],progression:{...item.progression},sets:item.sets.map(set=>({...set,tags:[...(set.tags||[])]}))}))})),
      tags: ['Warmup','Dropset','Full ROM','Slow and controlled','Cheat set','Paused','Assisted','To failure'],
      exerciseTagPresets: ['Main lift','Accessory','Unilateral','Straight sets','Tempo','Technique','Rehab'],
      tagTarget: null,
      exerciseTagTarget: null,
      supersetTarget: null,
      pickerMode: 'draft',
      programWorkoutTarget: null,
      activeProgram: null,
      archivedPrograms: [sampleHistoricalProgram]
    };
    const progressionSetup = { threshold:8, incrementType:'lb', incrementValue:5, timeStep:5, treatment:'suggestions', stallDetection:true, defaultRange:{preset:'hypertrophy',min:6,max:12,openTop:false,amrap:false}, undulating:false, weeklyRanges:[] };
    const sampleProgressionProfiles = {
      'Barbell_Deadlift': {mode:'reps',min:2,max:4,incrementType:'lb',incrementValue:5,repsOnly:false},
      'Barbell_Bench_Press_-_Medium_Grip': {mode:'reps',min:5,max:8,incrementType:'lb',incrementValue:5,repsOnly:false},
      'Wide-Grip_Lat_Pulldown': {mode:'reps',min:8,max:12,incrementType:'percent',incrementValue:5,repsOnly:false},
      'Side_Lateral_Raise': {mode:'reps',min:10,max:15,incrementType:'lb',incrementValue:0,repsOnly:true},
      'Plank': {mode:'time',timeMin:30,timeMax:60,timeStep:5,incrementType:'lb',incrementValue:5,repsOnly:true}
    };
    
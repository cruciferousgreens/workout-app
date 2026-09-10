
    /** Creates clearly labeled demonstration workouts without mixing them into real progression. */
    function sampleSet(weight, reps, rpe, tags = [], tracking = 'reps') {
      return tracking === 'time'
        ? {w:weight, r:null, seconds:reps, rpe, tags, complete:true}
        : {w:weight, r:reps, seconds:null, rpe, tags, complete:true};
    }

    function generateSampleWorkouts() {
      const today = new Date(); today.setHours(12,0,0,0);
      const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const plans = [
        {day:0,name:'Upper A',moves:[
          ['Barbell_Bench_Press_-_Medium_Grip',145,5,3],['Bent_Over_Barbell_Row',115,6,3],['Incline_Dumbbell_Press',45,8,3],['Triceps_Pushdown',50,10,3],['Plank',0,30,3,'time']
        ]},
        {day:1,name:'Lower A',moves:[
          ['Barbell_Deadlift',265,2,3],['Barbell_Squat',205,5,3],['Romanian_Deadlift',155,6,3],['Leg_Extensions',80,10,3],['Standing_Calf_Raises',90,10,3]
        ]},
        {day:3,name:'Upper B',moves:[
          ['Standing_Military_Press',75,6,3],['Wide-Grip_Lat_Pulldown',110,8,3],['Seated_Cable_Rows',105,8,3],['Dumbbell_Bicep_Curl',25,10,3]
        ]},
        {day:5,name:'Lower B',moves:[
          ['Leg_Press',250,8,3],['Lying_Leg_Curls',70,10,3],['Barbell_Squat',185,8,3],['Standing_Calf_Raises',95,12,3]
        ]}
      ];
      const workouts = [];
      for (let week = 0; week < 10; week += 1) {
        const weekStart = new Date(monday); weekStart.setDate(monday.getDate() - ((9 - week) * 7));
        plans.forEach((plan, sessionIndex) => {
          const date = new Date(weekStart); date.setDate(weekStart.getDate() + plan.day);
          if (date > today) return;
          const exercisesForSession = plan.moves.map((move, moveIndex) => {
            const [exerciseId, baseWeight, baseReps, setCount, tracking = 'reps'] = move;
            const increment = tracking === 'time' ? 0 : (['Barbell_Deadlift','Barbell_Squat','Leg_Press','Romanian_Deadlift'].includes(exerciseId) ? 5 * Math.floor(week / 2) : 5 * Math.floor(week / 3));
            const weight = baseWeight + increment;
            return {exerciseId,tracking,note:'',exerciseTags:[moveIndex < 2 ? 'Main lift' : 'Accessory'],supersetId:null,sets:Array.from({length:setCount},(_,setIndex) => {
              const reps = baseReps + (tracking === 'time' ? week * 3 : ((week + setIndex + moveIndex) % 3 === 0 ? 1 : 0));
              const rpe = (week + setIndex + moveIndex) % 8 === 0 ? null : [7,7.5,8][Math.min(setIndex,2)];
              const tags = setIndex === 0 && moveIndex > 1 ? ['Warmup'] : (setIndex === setCount - 1 && week % 3 === 2 ? ['Full ROM'] : []);
              return sampleSet(weight, reps, rpe, tags, tracking);
            })};
          });
          workouts.push({id:`sample-${week}-${sessionIndex}`,name:plan.name,date:date.toISOString().slice(0,10),sample:true,programId:null,programWorkoutUid:null,exercises:exercisesForSession});
        });
      }
      return workouts.sort((a,b) => b.date.localeCompare(a.date));
    }

    
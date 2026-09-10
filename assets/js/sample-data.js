/* ===== module: sample-data.js ===== */
/** Opt-in sample history (Settings → Data). Samples are flagged `sample:true`, labeled SAMPLE
 *  wherever listed, and isolated from the progression engine, which uses real history only. */
function isSampleWorkout(workout){return !!(workout&&workout.sample===true);}
function realWorkouts(){return workoutState.completed.filter(workout=>!isSampleWorkout(workout));}
function hasSampleData(){return workoutState.completed.some(isSampleWorkout);}
function daysAgoIso(days){
  const now=new Date();
  const d=new Date(now.getTime()-now.getTimezoneOffset()*60000-days*86400000);
  return d.toISOString().slice(0,10);
}
function sampleSet(w,r,rpe,tags){
  return {w:Number(w),r:Number(r),seconds:null,rpe:rpe==null?null:Number(rpe),tags:tags||[],complete:true};
}
/** Compact realistic history: push/pull/legs across ~3 weeks with gentle progressive overload. */
function buildSampleWorkouts(){
  const spec=[
    {ago:20,name:'Push Day',rows:[
      ['Barbell_Bench_Press_-_Medium_Grip',[[95,10,6,['Warmup']],[135,8,7.5],[145,8,8],[145,7,8.5]]],
      ['Standing_Military_Press',[[65,10,6,['Warmup']],[75,8,7.5],[80,8,8]]]]},
    {ago:18,name:'Pull Day',rows:[
      ['Bent_Over_Barbell_Row',[[95,10,6,['Warmup']],[115,8,7.5],[125,8,8],[125,8,8.5]]],
      ['Close-Grip_Front_Lat_Pulldown',[[110,10,7],[120,10,7.5],[130,10,8]]]]},
    {ago:15,name:'Leg Day',rows:[
      ['Barbell_Squat',[[135,8,6,['Warmup']],[185,8,7.5],[195,8,8],[205,6,8.5]]],
      ['Barbell_Hip_Thrust',[[135,10,7],[155,10,7.5],[175,10,8]]],
      ['Barbell_Deadlift',[[225,5,8]]]]},
    {ago:13,name:'Push Day',rows:[
      ['Barbell_Bench_Press_-_Medium_Grip',[[95,10,6,['Warmup']],[140,8,7.5],[150,8,8],[150,7,8.5]]],
      ['Standing_Military_Press',[[65,10,6,['Warmup']],[80,8,7.5],[85,8,8]]]]},
    {ago:11,name:'Pull Day',rows:[
      ['Bent_Over_Barbell_Row',[[95,10,6,['Warmup']],[120,8,7.5],[130,8,8],[130,8,8.5]]],
      ['Close-Grip_Front_Lat_Pulldown',[[120,10,7],[130,10,7.5],[140,10,8]]]]},
    {ago:8,name:'Leg Day',rows:[
      ['Barbell_Squat',[[135,8,6,['Warmup']],[195,8,7.5],[205,8,8],[215,6,8.5]]],
      ['Barbell_Hip_Thrust',[[155,10,7],[175,10,7.5],[185,10,8]]],
      ['Barbell_Deadlift',[[245,5,8.5]]]]},
    {ago:6,name:'Push Day',rows:[
      ['Barbell_Bench_Press_-_Medium_Grip',[[95,10,6,['Warmup']],[145,8,7.5],[155,8,8],[155,7,8.5]]],
      ['Standing_Military_Press',[[65,10,6,['Warmup']],[85,8,7.5],[90,8,8]]]]},
    {ago:3,name:'Pull Day',rows:[
      ['Bent_Over_Barbell_Row',[[95,10,6,['Warmup']],[125,8,7.5],[135,8,8],[135,7,8.5]]],
      ['Close-Grip_Front_Lat_Pulldown',[[130,10,7],[140,10,7.5],[150,10,8]]]]}
  ];
  return spec.map(entry=>({
    id:uid('workout'),name:entry.name,date:daysAgoIso(entry.ago),
    programId:null,programWorkoutUid:null,sample:true,
    exercises:entry.rows.map(([exerciseId,sets])=>({
      exerciseId,tracking:'reps',note:'',exerciseTags:[],supersetId:null,progression:null,
      sets:sets.map(([w,r,rpe,tags])=>sampleSet(w,r,rpe,tags))
    }))
  }));
}
function addSampleData(){
  if(hasSampleData()){showToast('Sample data is already in your history.');return;}
  const samples=buildSampleWorkouts().filter(workout=>exercises.some(ex=>ex.id===workout.exercises[0].exerciseId));
  if(!samples.length){showToast('Sample exercises are not in the library.');return;}
  workoutState.completed=[...workoutState.completed,...samples].sort((a,b)=>b.date.localeCompare(a.date));
  persistNow();renderDashboard();renderStats();renderWorkoutScreen();renderLibrary();renderSettings();
  showToast(`Added ${samples.length} sample workouts.`);
}
function clearSampleData(){
  if(!hasSampleData()){showToast('No sample data to clear.');return;}
  const viewingSample=!$('#workoutComplete').hidden;
  workoutState.completed=workoutState.completed.filter(workout=>!isSampleWorkout(workout));
  persistNow();
  if(viewingSample){$('#workoutComplete').hidden=true;}
  renderDashboard();renderStats();renderWorkoutScreen();renderLibrary();renderSettings();
  showToast('Sample data cleared.');
}

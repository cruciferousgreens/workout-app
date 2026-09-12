'use strict';
/* Fixture builders for fake completed-workout logs. Shape matches what the
   real getExerciseLogs reads off workoutState.completed: {id,date,isoDate,
   completedAt,name,exercises:[{exerciseId,tracking,progression,exerciseTags,
   sets:[{w,r,seconds,rpe,tags}]}]}. */
function mkSet(s){
  return {w:s.w??'',r:s.r??'',seconds:s.seconds??null,rpe:s.rpe??null,tags:s.tags||[]};
}
function mkItem(exerciseId,sets,opts={}){
  return {
    exerciseId,
    tracking:opts.tracking||'reps',
    progression:opts.progression||null,
    exerciseTags:opts.exerciseTags||[],
    supersetId:opts.supersetId||null,
    sets:sets.map(mkSet),
  };
}
function mkLog(id,date,items,name){
  return {id,date,isoDate:date,completedAt:date+'T12:00:00',
    name:name||('Workout '+date),exercises:items};
}
module.exports={mkSet,mkItem,mkLog};

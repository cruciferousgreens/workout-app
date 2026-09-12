'use strict';
/* Fixture: 6-exercise fake catalog for tests that read the global `exercises`
   (csv-import fuzzy matcher, stats-math muscle attribution, utilities
   search). Small on purpose — real-catalog behavior is covered by the app's
   QA builds, not by unit tests. */
module.exports=[
  {id:'bench-press',name:'Barbell Bench Press',force:'push',equipment:'barbell',
   primary:['chest'],secondary:['front delts','triceps'],category:'strength',tracking:'reps'},
  {id:'back-squat',name:'Barbell Back Squat',force:'push',equipment:'barbell',
   primary:['quadriceps','glutes'],secondary:['hamstrings'],category:'strength',tracking:'reps'},
  {id:'overhead-press',name:'Barbell Shoulder Press',force:'push',equipment:'barbell',
   primary:['front delts','side delts'],secondary:['triceps'],category:'strength',tracking:'reps'},
  {id:'barbell-row',name:'Barbell Bent-Over Row',force:'pull',equipment:'barbell',
   primary:['lats','upper back'],secondary:['biceps'],category:'strength',tracking:'reps'},
  {id:'deadlift',name:'Barbell Deadlift',force:'pull',equipment:'barbell',
   primary:['hamstrings','glutes','lower back'],secondary:['lats'],category:'strength',tracking:'reps'},
  {id:'dumbbell-curl',name:'Dumbbell Bicep Curl',force:'pull',equipment:'dumbbell',
   primary:['biceps'],secondary:[],category:'strength',tracking:'reps'},
];

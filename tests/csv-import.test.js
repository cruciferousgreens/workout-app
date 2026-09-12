'use strict';
/* Role: csv-import — parse layer only (ob* functions); the UI overlay is
   excluded. Pins CSV splitting, format detection, Hevy/MacroFactor mapping,
   the fuzzy matcher golden pairs, and end-to-end goldens over the fixture
   CSVs. The fuzzy matcher reads the global `exercises` catalog — the
   6-exercise fixture catalog is injected. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const catalog=require('./fixtures/catalog');
const {
  obSplitCsvLine, obDetectCsvFormat, obParseCsvText,
  obHevyDate, obHevyLbs, obMfRirToRpe, obParseMfRepRange,
  obParseCsvReps, obParseCsvNumber, obCsvHash, obValidIsoDate,
  obCleanExerciseName, obCsvAliasCandidates, obCanonicalCsvTag,
  obFzScore, obFzEligible, obFzTokens, obCsvFuzzy,
  obParseMfTemplateSheet,
  OB_CSV_COLUMNS,
  obResolveCsvExercise,
}=loadRole('csv-import',{globals:{exercises:catalog}});

const FIX=path.join(__dirname,'fixtures','csv');

describe('obSplitCsvLine',()=>{
  it('handles quoted commas',()=>{
    assert.deepEqual(obSplitCsvLine('"a,b",c'),['a,b','c']);
  });
  it('handles escaped quotes',()=>{
    assert.deepEqual(obSplitCsvLine('a,"b""c",d'),['a','b"c','d']);
  });
  it('handles empty fields',()=>{
    assert.deepEqual(obSplitCsvLine('a,,c'),['a','','c']);
  });
});

describe('obDetectCsvFormat',()=>{
  it('native vs mf-history vs hevy vs hevy-title vs unknown',()=>{
    assert.equal(obDetectCsvFormat(OB_CSV_COLUMNS.slice()),'native');
    assert.equal(obDetectCsvFormat(['date','workout','exercise','set type','weight (lb)']),'mf-history');
    assert.equal(obDetectCsvFormat(['title','start_time','exercise_title']),'hevy');
    assert.equal(obDetectCsvFormat(['workout name','exercise name','workout start']),'hevy-title');
    assert.equal(obDetectCsvFormat(['foo','bar']),null);
  });
  it('MacroFactor is checked before Hevy (explicit beats lucky)',()=>{
    assert.equal(obDetectCsvFormat(['workout','exercise','set type','weight (lb)','exercise_title']), 'mf-history');
  });
});

describe('Hevy mapping',()=>{
  it('obHevyDate accepts the known shapes, rejects garbage',()=>{
    assert.equal(obHevyDate('2024-01-05 08:00:00'),'2024-01-05');
    assert.equal(obHevyDate('5 Jan 2024'),'2024-01-05');
    assert.equal(obHevyDate('January 5, 2024'),'2024-01-05');
    assert.equal(obHevyDate('garbage'),'');
  });
  it('obHevyLbs converts kg→lb at 2.20462, 2-decimal rounding',()=>{
    assert.equal(obHevyLbs('100'),'220.46');
    assert.equal(obHevyLbs(''),'');
    assert.equal(obHevyLbs('abc'),'');
  });
  it('golden end-to-end: hevy.csv → mapped rows',()=>{
    const {rows,errors,format}=obParseCsvText(
      fs.readFileSync(path.join(FIX,'hevy.csv'),'utf8'));
    assert.equal(format,'hevy');
    assert.deepEqual(errors,[]);
    assert.equal(rows.length,4);
    assert.deepEqual(
      (({date,workout_name,exercise,reps,weight_lb,tags})=>({date,workout_name,exercise,reps,weight_lb,tags}))(rows[0]),
      {date:'2024-01-05',workout_name:'Morning Push',exercise:'Bench Press (Barbell)',
       reps:'10',weight_lb:'135',tags:'Warmup'});
    assert.equal(rows[2].rpe,'9.5');
    assert.equal(rows[2].tags,'To failure');
    assert.equal(rows[3].exercise,'Squat (Barbell)');
  });
});

describe('MacroFactor mapping',()=>{
  it('obMfRirToRpe pins the RIR→RPE table',()=>{
    assert.equal(obMfRirToRpe('2'),'8');
    assert.equal(obMfRirToRpe('0'),'10');
    assert.equal(obMfRirToRpe('2.5'),'7.5');
    assert.equal(obMfRirToRpe(''),'');
  });
  it('obParseMfRepRange handles ranges, open-top, singles',()=>{
    assert.deepEqual(obParseMfRepRange('8-10'),{min:8,max:10});
    assert.deepEqual(obParseMfRepRange('8+'),{min:8,max:8,openTop:true});
    assert.deepEqual(obParseMfRepRange('8'),{min:8,max:8});
    assert.equal(obParseMfRepRange(''),null);
  });
  it('golden end-to-end: mf-history.csv → mapped rows',()=>{
    const {rows,errors,format}=obParseCsvText(
      fs.readFileSync(path.join(FIX,'mf-history.csv'),'utf8'));
    assert.equal(format,'mf-history');
    assert.deepEqual(errors,[]);
    assert.equal(rows.length,4);
    assert.equal(rows[0].rpe,'8');   // RIR 2 → RPE 8
    assert.equal(rows[1].rpe,'6');   // RIR 4 → RPE 6
    assert.equal(rows[1].tags,'Warmup');
    assert.equal(rows[2].tags,'Dropset');
    assert.equal(rows[3].exercise,'Reverse Nordic Curl'); // ∈ SS1 marker stripped
    assert.equal(rows[3].rpe,'7');
  });
  it('mf-template.json → parsed template sheet',()=>{
    const sheet=JSON.parse(fs.readFileSync(path.join(FIX,'mf-template.json'),'utf8'));
    const parsed=obParseMfTemplateSheet(sheet);
    assert.ok(!parsed.error);
    assert.equal(parsed.workouts.length,2);
    assert.equal(parsed.workouts[0].name,'Day 1');
    assert.equal(parsed.workouts[0].exercises.length,2);
    assert.deepEqual(parsed.workouts[0].exercises[0].sets,
      [{type:'Standard Set',repRange:'6-8',rir:'2'}]);
    assert.equal(parsed.workouts[1].exercises[0].name,'Squat');
  });
});

describe('row-level parsers',()=>{
  it('obParseCsvReps: ranges become notes, numbers stay numbers',()=>{
    assert.deepEqual(obParseCsvReps('8-10','1'),{r:null,note:'Set 1: 8–10 reps'});
    assert.deepEqual(obParseCsvReps('8','1'),{r:8,note:''});
    assert.deepEqual(obParseCsvReps('','1'),{r:null,note:''});
  });
  it('obParseCsvNumber: blank/non-numeric → null',()=>{
    assert.equal(obParseCsvNumber(''),null);
    assert.equal(obParseCsvNumber('abc'),null);
    assert.equal(obParseCsvNumber('5'),5);
  });
  it('obCsvHash is a deterministic djb2 base36',()=>{
    assert.equal(obCsvHash('abc'),obCsvHash('abc'));
    assert.ok(/^[0-9a-z]+$/.test(obCsvHash('abc')));
    assert.notEqual(obCsvHash('abc'),obCsvHash('abd'));
  });
  it('obValidIsoDate accepts YYYY-MM-DD only',()=>{
    assert.equal(obValidIsoDate('2024-01-05'),true);
    assert.equal(obValidIsoDate('2024-13-01'),false);
    assert.equal(obValidIsoDate('2024-02-30'),false);
    assert.equal(obValidIsoDate('foo'),false);
  });
  it('obCleanExerciseName strips MacroFactor superset markers',()=>{
    assert.equal(obCleanExerciseName('Reverse Nordic Curl ∈ SS1'),'Reverse Nordic Curl');
    assert.equal(obCleanExerciseName('Scapular Retraction ∈ C2'),'Scapular Retraction');
    assert.equal(obCleanExerciseName('Bench Press'),'Bench Press');
  });
  it('obCsvAliasCandidates expands "(Equipment)" names',()=>{
    assert.deepEqual(obCsvAliasCandidates('Bench Press (Barbell)'),
      ['Barbell Bench Press','Bench Press']);
    assert.deepEqual(obCsvAliasCandidates('Squat'),[]);
  });
  it('obCanonicalCsvTag canonicalizes case-insensitively',()=>{
    assert.equal(obCanonicalCsvTag('warmup'),'Warmup');
    assert.equal(obCanonicalCsvTag('WARMUP'),'Warmup');
    assert.equal(obCanonicalCsvTag('nope'),null);
  });
});

describe('fuzzy matcher (fixture catalog)',()=>{
  it('plurals stem: "Bicep curls" → Dumbbell Bicep Curl',()=>{
    assert.equal(obCsvFuzzy('Bicep curls',3)[0].id,'dumbbell-curl');
  });
  it('synonym affinity: "Shoulder Press" → Barbell Shoulder Press',()=>{
    assert.equal(obCsvFuzzy('Shoulder Press',3)[0].id,'overhead-press');
  });
  it('token-subset: "Deadlift" → Barbell Deadlift',()=>{
    assert.equal(obCsvFuzzy('Deadlift',3)[0].id,'deadlift');
  });
  it('equipment mismatch blocks the score (obFzEligible)',()=>{
    assert.equal(obFzEligible(obFzTokens('Dumbbell Curl'),obFzTokens('Barbell Curl')),false);
    assert.equal(obFzEligible(obFzTokens('Bicep Curl'),obFzTokens('Dumbbell Bicep Curl')),true);
  });
  it('obFzScore is symmetric-ish and rewards overlap',()=>{
    const a=obFzScore(obFzTokens('bench press'),obFzTokens('barbell bench press'));
    const b=obFzScore(obFzTokens('bench press'),obFzTokens('barbell squat'));
    assert.ok(a.score>b.score);
  });
});


/* Generic-name aliases + variant ties (user 2026-09-12): generic import
   names resolve through the real bundled EXERCISE_ALIASES (the aliases
   ride along via tests/module-map.js), and an ambiguous "Lateral Raise"
   auto-maps to the first catalog variant instead of staying manual. Runs
   against a dedicated small catalog with real alias-target ids in real DB
   order; the memoized lookup is reset first so the earlier fixture-catalog
   lookups don't leak in. */
describe('import generic-name aliases and variant ties',()=>{
  const vm=require('node:vm');
  const ALIAS_CATALOG=[
    {id:'Barbell_Squat',name:'Barbell Squat'},
    {id:'Barbell_Deadlift',name:'Barbell Deadlift'},
    {id:'Barbell_Bench_Press_-_Medium_Grip',name:'Barbell Bench Press - Medium Grip'},
    {id:'Barbell_Shoulder_Press',name:'Barbell Shoulder Press'},
    {id:'Cable_Seated_Lateral_Raise',name:'Cable Seated Lateral Raise'},
    {id:'Side_Lateral_Raise',name:'Side Lateral Raise'},
    {id:'Seated_Side_Lateral_Raise',name:'Seated Side Lateral Raise'},
  ];
  /* Each it() below swaps in the alias catalog + resets the memoized lookup
     first (the earlier fixture-catalog tests run first; swapping only inside
     the it() bodies keeps them untouched). */
  function useAliasCatalog(){
    vm.runInThisContext('obCsvNameToId=obCsvIdSet=obCsvStemToId=obCsvAliasToId=null;');
    globalThis.exercises=ALIAS_CATALOG;
  }
  const aliasCases=[
    ['Deadlift','Barbell_Deadlift'],
    ['Squat','Barbell_Squat'],
    ['Bench','Barbell_Bench_Press_-_Medium_Grip'],
    ['Bench Press','Barbell_Bench_Press_-_Medium_Grip'],
    ['OHP','Barbell_Shoulder_Press'],
    ['ohp','Barbell_Shoulder_Press'],
    ['Overhead Press','Barbell_Shoulder_Press'],
    ['oh press','Barbell_Shoulder_Press'],
  ];
  for(const [input,want] of aliasCases){
    it(`alias "${input}" -> ${want}`,()=>{
      useAliasCatalog();
      const r=obResolveCsvExercise(input);
      assert.equal(r.status,'matched');
      assert.equal(r.id,want);
      assert.equal(r.via,'alias');
    });
  }
  it('"Lateral Raise" auto-maps to the first DB variant, deterministically',()=>{
    useAliasCatalog();
    const a=obResolveCsvExercise('Lateral Raise');
    const b=obResolveCsvExercise('Lateral Raise');
    assert.equal(a.status,'matched');
    assert.equal(a.id,'Cable_Seated_Lateral_Raise');
    assert.equal(b.id,a.id);
  });
});

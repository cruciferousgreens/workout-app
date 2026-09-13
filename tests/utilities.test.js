'use strict';
/* Role: utilities — shared helpers. Pins levenshtein/normalize/tokenize,
   the DB total-weight invariant in setVolume (never auto-double), PR
   detection incl. the 0.5 e1RM noise tolerance, escapeHtml, and the date
   formatters, plus rankedExerciseMatches over the fixture catalog. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=require('./fixtures/catalog');
const {
  levenshtein, normalize, tokenize, setVolume,
  detectExercisePRs, detectTimedPRs, PR_E1RM_TOLERANCE, priorSetsForPR,
  escapeHtml, localIsoDate, formatLogDate, formatPrettyDate,
  rankedExerciseMatches, workoutState, cloneSetFields,
}=loadRole('utilities',{globals:{exercises:catalog}});

describe('levenshtein / normalize / tokenize',()=>{
  it('classic pairs',()=>{
    assert.equal(levenshtein('kitten','sitting'),3);
    assert.equal(levenshtein('','abc'),3);
    assert.equal(levenshtein('abc',''),3);
    assert.equal(levenshtein('abc','abc'),0);
  });
  it('normalize strips punctuation and case',()=>{
    assert.equal(normalize('Bench-Press 2!'),'benchpress2');
  });
  it('tokenize splits on non-alphanumerics',()=>{
    assert.deepEqual(tokenize('Barbell  Bench-Press'),['barbell','bench','press']);
  });
});

describe('setVolume',()=>{
  it('is weight × reps',()=>{
    assert.equal(setVolume({w:100,r:5}),500);
  });
  it('DB total-weight pin: the logged weight is used as-is, never doubled',()=>{
    // User rule: dumbbell weight is ALWAYS the combined total — no
    // auto-doubling may ever appear in this function.
    assert.equal(setVolume({w:50,r:10}),500);
  });
});

describe('detectExercisePRs',()=>{
  it('new e1RM best → e1rm',()=>{
    const pr=detectExercisePRs([{w:100,r:8,rpe:7}],[{w:100,r:5,rpe:10}]);
    assert.equal(pr,'e1rm');
  });
  it('heavier but lower e1RM → heaviest',()=>{
    const pr=detectExercisePRs([{w:105,r:5,rpe:10}],[{w:100,r:10,rpe:7}]);
    assert.equal(pr,'heaviest');
  });
  it('nothing new → empty string',()=>{
    assert.equal(detectExercisePRs([{w:90,r:5,rpe:9}],[{w:100,r:5,rpe:9}]),'');
    assert.equal(detectExercisePRs([],[{w:100,r:5}]),'');
  });
  it('PR_E1RM_TOLERANCE suppresses rounding noise (+0.4 is not a PR)',()=>{
    assert.equal(PR_E1RM_TOLERANCE,0.5);
    // prior e1RM 11.667, current 12.0 → +0.333 < 0.5, same top weight
    assert.equal(detectExercisePRs([{w:10,r:6}],[{w:10,r:5}]),'');
  });
});

describe('escapeHtml',()=>{
  it('escapes <, >, &',()=>{
    assert.equal(escapeHtml('<b>a&b</b>'),'&lt;b&gt;a&amp;b&lt;/b&gt;');
  });
});

describe('dates',()=>{
  it('localIsoDate returns the LOCAL date (not UTC)',()=>{
    const s=localIsoDate(new Date());
    assert.match(s,/^\d{4}-\d{2}-\d{2}$/);
    const now=new Date();
    const expected=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    assert.equal(s,expected);
  });
  it('formatLogDate / formatPrettyDate golden strings',()=>{
    assert.equal(formatLogDate('2024-01-05'),'Jan 5, 2024');
    assert.equal(formatPrettyDate('2024-01-05'),'Fri, Jan 5, 2024');
    assert.equal(formatLogDate(''), '');
  });
});

describe('rankedExerciseMatches (fixture catalog)',()=>{
  it('"ohp" ranks Barbell Shoulder Press first (synonym path)',()=>{
    assert.equal(rankedExerciseMatches('ohp')[0].id,'overhead-press');
  });
  it('"bench" ranks Barbell Bench Press first',()=>{
    assert.equal(rankedExerciseMatches('bench')[0].id,'bench-press');
  });
  it('empty query returns the catalog head',()=>{
    assert.equal(rankedExerciseMatches('').length,6);
  });
});

describe('detectTimedPRs (#282)',()=>{
  const t=(seconds,w)=>({seconds,w:w??null});
  it('longer hold at the same load → PR',()=>{
    assert.equal(detectTimedPRs([t(75)],[t(60)]),true);
  });
  it('shorter hold → no PR',()=>{
    assert.equal(detectTimedPRs([t(45)],[t(60)]),false);
  });
  it('tie → no PR',()=>{
    assert.equal(detectTimedPRs([t(60)],[t(60)]),false);
  });
  it('first hold at a new load is a PR (new territory)',()=>{
    assert.equal(detectTimedPRs([t(30,25)],[t(90)]),true);
  });
  it('a heavier-loaded hold does not PR against a lighter load best',()=>{
    assert.equal(detectTimedPRs([t(30,25)],[t(60,25)]),false);
  });
  it('no prior → no PR',()=>{
    assert.equal(detectTimedPRs([t(75)],[]),false);
  });
  it('no current → no PR',()=>{
    assert.equal(detectTimedPRs([],[t(60)]),false);
  });
  it('zero-second sets are ignored on both sides',()=>{
    assert.equal(detectTimedPRs([t(0)],[t(60)]),false);
    assert.equal(detectTimedPRs([t(75)],[t(0)]),false);
  });
});

describe('priorSetsForPR (#277 — same-day chronology survives sync reorder)',()=>{
  const set=(w,r)=>({w,r,seconds:null,rpe:null,tags:[]});
  const log=(id,date,completedAt,w)=>({id,date,completedAt,name:'W',
    exercises:[{exerciseId:'bench-press',tracking:'reps',sets:[set(w,8)]}]});
  const morning=log('am','2026-09-12','2026-09-12T08:00:00.000Z',135);
  const evening=log('pm','2026-09-12','2026-09-12T20:00:00.000Z',145);
  it('evening session sees the morning session as prior',()=>{
    workoutState.completed=[evening,morning];
    assert.deepEqual(priorSetsForPR(evening,'bench-press'),[set(135,8)]);
  });
  it('morning session does NOT see the evening session as prior',()=>{
    workoutState.completed=[evening,morning];
    assert.deepEqual(priorSetsForPR(morning,'bench-press'),[]);
  });
  it('result is identical when the array order is reversed (sync reorder)',()=>{
    workoutState.completed=[morning,evening]; /* oldest-first: a reorder */
    assert.deepEqual(priorSetsForPR(evening,'bench-press'),[set(135,8)]);
    assert.deepEqual(priorSetsForPR(morning,'bench-press'),[]);
  });
  it('earlier dates still count as prior regardless of order',()=>{
    const older=log('old','2026-09-10','2026-09-10T08:00:00.000Z',125);
    workoutState.completed=[morning,older];
    assert.deepEqual(priorSetsForPR(morning,'bench-press'),[set(125,8)]);
  });
  it('stamp-less legacy rows keep the index-based same-day rule',()=>{
    const am={...morning,completedAt:undefined},pm={...evening,completedAt:undefined};
    workoutState.completed=[pm,am]; /* newest-first assumed */
    assert.deepEqual(priorSetsForPR(pm,'bench-press'),[set(135,8)]);
    assert.deepEqual(priorSetsForPR(am,'bench-press'),[]);
  });
});

describe('cloneSetFields forNewSession (#267 — repeat blanks performance)',()=>{
  const logged={w:135,r:8,seconds:null,rpe:9,targetRpe:'',tags:['warmup']};
  it('blanks r and seconds so the ghost suggestion shows',()=>{
    const c=cloneSetFields(logged,'forNewSession');
    assert.equal(c.r,'');
    assert.equal(c.seconds,'');
  });
  it('keeps weight as a real value (#175) and clears actual RPE (A7)',()=>{
    const c=cloneSetFields(logged,'forNewSession');
    assert.equal(c.w,'135');
    assert.equal(c.rpe,'');
  });
  it('keeps tags and stored targetRpe',()=>{
    const c=cloneSetFields({...logged,targetRpe:'8'},'forNewSession');
    assert.deepEqual(c.tags,['warmup']);
    assert.equal(c.targetRpe,'8');
  });
  it('forTemplate still carries r (template prescriptions are targets)',()=>{
    const c=cloneSetFields(logged,'forTemplate');
    assert.equal(c.r,'8');
  });
});

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
  detectExercisePRs, PR_E1RM_TOLERANCE,
  escapeHtml, localIsoDate, formatLogDate, formatPrettyDate,
  rankedExerciseMatches,
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

/* strength.js — pure strength-math helpers for the workout tracker.
 *
 * Classic script (no modules, no dependencies). Defines globals:
 *   estimate1RM(weight, reps, rpe)
 *   exerciseStats(allSets)
 *   similarExercises(exercise, allExercises, limit)
 *   METHOD_LABELS
 *
 * Everything here is a pure function of its inputs so it can be unit-tested
 * and reused by any future storage adapter or UI.
 */

'use strict';

/* Standard RPE percentage-of-1RM chart (Reactive Training Systems style).
 * RPE_TABLE[reps][rpe] = percent of 1RM that `weight` represents.
 * Columns: RPE 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5.
 */
var RPE_TABLE = {
  1:  { '10': 100,  '9.5': 97.8, '9': 95.5, '8.5': 93.9, '8': 92.2, '7.5': 90.7, '7': 89.2, '6.5': 87.8 },
  2:  { '10': 97.8, '9.5': 95.5, '9': 93.9, '8.5': 92.2, '8': 90.7, '7.5': 89.2, '7': 87.8, '6.5': 86.3 },
  3:  { '10': 95.5, '9.5': 93.9, '9': 92.2, '8.5': 90.7, '8': 89.2, '7.5': 87.8, '7': 86.3, '6.5': 84.9 },
  4:  { '10': 93.9, '9.5': 92.2, '9': 90.7, '8.5': 89.2, '8': 87.8, '7.5': 86.3, '7': 84.9, '6.5': 83.7 },
  5:  { '10': 92.2, '9.5': 90.7, '9': 89.2, '8.5': 87.8, '8': 86.3, '7.5': 84.9, '7': 83.7, '6.5': 82.4 },
  6:  { '10': 90.7, '9.5': 89.2, '9': 87.8, '8.5': 86.3, '8': 84.9, '7.5': 83.7, '7': 82.4, '6.5': 81.1 },
  7:  { '10': 89.2, '9.5': 87.8, '9': 86.3, '8.5': 84.9, '8': 83.7, '7.5': 82.4, '7': 81.1, '6.5': 80.0 },
  8:  { '10': 87.8, '9.5': 86.3, '9': 84.9, '8.5': 83.7, '8': 82.4, '7.5': 81.1, '7': 80.0, '6.5': 78.6 },
  9:  { '10': 86.3, '9.5': 84.9, '9': 83.7, '8.5': 82.4, '8': 81.1, '7.5': 80.0, '7': 78.6, '6.5': 77.4 },
  10: { '10': 84.9, '9.5': 83.7, '9': 82.4, '8.5': 81.1, '8': 80.0, '7.5': 78.6, '7': 77.4, '6.5': 76.2 }
};

/* Human-readable labels for the estimation methods returned below. */
var METHOD_LABELS = {
  'rpe-table': 'RPE chart',
  'epley': 'Epley formula',
  'epley-rpe': 'Epley (RPE-adjusted)',
  'invalid': 'n/a'
};

function _round1(x) {
  return Math.round(x * 10) / 10;
}

/* Estimate a one-rep max from a logged set.
 *   weight: load used (any unit, used consistently)
 *   reps:   reps performed (positive number)
 *   rpe:    optional 1-10 rating of perceived exertion
 * Returns { value, method } where method is one of the METHOD_LABELS keys.
 *   - rpe given and reps within the chart (1-10): RPE percentage table.
 *   - rpe given but reps outside the chart: Epley on RPE-adjusted reps
 *     (reps + (10 - rpe) estimates reps-to-failure).
 *   - no rpe: classic Epley formula, weight * (1 + reps/30).
 */
function estimate1RM(weight, reps, rpe) {
  var w = Number(weight);
  var r = Number(reps);
  if (!isFinite(w) || w <= 0 || !isFinite(r) || r <= 0) {
    return { value: null, method: 'invalid' };
  }

  var rp = (rpe === null || rpe === undefined || rpe === '') ? null : Number(rpe);
  var hasRpe = rp !== null && isFinite(rp) && rp >= 6 && rp <= 10;

  if (hasRpe && r >= 1 && r <= 10) {
    var repsKey = Math.max(1, Math.min(10, Math.round(r)));
    // Round RPE to the nearest 0.5 and clamp to the table's columns.
    // String(8) -> '8' matches the table keys; toFixed(1) would give '8.0'.
    var rpeKey = String(Math.max(6.5, Math.min(10, Math.round(rp * 2) / 2)));
    var pct = RPE_TABLE[repsKey][rpeKey];
    return { value: _round1(w / (pct / 100)), method: 'rpe-table' };
  }

  if (hasRpe) {
    // Reps outside the chart: convert RPE to estimated reps-in-reserve,
    // then run Epley on the estimated reps-to-failure.
    var effReps = Math.max(1, r + (10 - rp));
    return { value: _round1(w * (1 + effReps / 30)), method: 'epley-rpe' };
  }

  return { value: _round1(w * (1 + r / 30)), method: 'epley' };
}

/* Aggregate stats for one exercise across all logged sets.
 *   allSets: [{ dateISO, weight, reps, rpe, ... }] (extra fields ignored)
 * Returns null when there are no valid sets, otherwise:
 *   {
 *     bestE1RM:    { value, method, set }  // highest estimated 1RM ever
 *     heaviestSet: { dateISO, weight, reps, rpe, ... } // heaviest load lifted
 *     projected1RM:{ value, method, set }  // the most recent set among
 *                                          // those tied for highest e1RM
 *   }
 */
function exerciseStats(allSets) {
  var scored = [];
  for (var i = 0; i < allSets.length; i++) {
    var s = allSets[i];
    var e = estimate1RM(s.weight, s.reps, s.rpe);
    if (e.value === null) continue;
    scored.push({ set: s, e1rm: e.value, method: e.method });
  }
  if (scored.length === 0) return null;

  var best = scored[0];
  var heaviest = scored[0];
  for (var j = 1; j < scored.length; j++) {
    if (scored[j].e1rm > best.e1rm) best = scored[j];
    if (scored[j].set.weight > heaviest.set.weight) heaviest = scored[j];
  }

  // Projected 1RM: the most recent set among those tied for highest e1RM.
  var projected = best;
  for (var k = 0; k < scored.length; k++) {
    if (scored[k].e1rm === best.e1rm &&
        String(scored[k].set.dateISO) > String(projected.set.dateISO)) {
      projected = scored[k];
    }
  }

  return {
    bestE1RM: { value: best.e1rm, method: best.method, set: best.set },
    heaviestSet: heaviest.set,
    projected1RM: { value: projected.e1rm, method: projected.method, set: projected.set }
  };
}

function _sharedCount(a, b) {
  var n = 0;
  var seen = {};
  for (var i = 0; i < b.length; i++) seen[b[i]] = true;
  for (var j = 0; j < a.length; j++) {
    if (seen[a[j]]) { n++; seen[a[j]] = false; } // count each match once
  }
  return n;
}

/* Find exercises similar to `exercise`.
 * Score = 3 * shared primary muscles
 *       + 1 * shared secondary muscles
 *       + 2 * same equipment
 *       + 1 * same category
 * Excludes the exercise itself. Returns the top `limit` (default 6) as
 * [{ exercise, score }] sorted by score desc, then name.
 */
function similarExercises(exercise, allExercises, limit) {
  limit = limit || 6;
  var prim = exercise.primaryMuscles || [];
  var sec = exercise.secondaryMuscles || [];
  var results = [];

  for (var i = 0; i < allExercises.length; i++) {
    var o = allExercises[i];
    if (o.id === exercise.id) continue;
    var score = 0;
    score += 3 * _sharedCount(prim, o.primaryMuscles || []);
    score += 1 * _sharedCount(sec, o.secondaryMuscles || []);
    if (exercise.equipment && o.equipment && exercise.equipment === o.equipment) score += 2;
    if (exercise.category && o.category && exercise.category === o.category) score += 1;
    if (score > 0) results.push({ exercise: o, score: score });
  }

  results.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.exercise.name < b.exercise.name ? -1 : (a.exercise.name > b.exercise.name ? 1 : 0);
  });
  return results.slice(0, limit);
}

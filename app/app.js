/* app.js — Workout Tracker PWA, milestone 1.
 *
 * Classic script (no modules, no dependencies). Depends on strength.js
 * (estimate1RM, exerciseStats, similarExercises, METHOD_LABELS).
 *
 * Views: #/library (default) and #/exercise/{id}. The router is a small
 * table so future views (#/log, #/calendar, ...) slot in without rework.
 */

(function () {
'use strict';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

var EXERCISE_DB_URL = '../data/exercises.json';

/* Pinned commit of yuhonas/free-exercise-db — image URLs are hotlinked
 * against this exact revision so they never drift. */
var EXERCISE_DB_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f';
var IMAGE_BASE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/' +
  EXERCISE_DB_COMMIT + '/exercises/';

var PAGE_SIZE = 40;      // exercise rows rendered per library "page"
var NOTE_SAVE_DELAY = 500; // ms debounce for autosaving notes

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/*                                                                     */
/* StorageAdapter interface: every method below must be implemented.   */
/* LocalStorageAdapter is the current implementation; a future cloud    */
/* adapter only needs to provide the same methods — app code never      */
/* touches localStorage directly.                                       */
/*                                                                     */
/*   getExerciseNotes() -> { exerciseId: text }                        */
/*   saveExerciseNote(exerciseId, text)                                 */
/*   getLogs() -> [ { id, dateISO, name, sample?,                       */
/*                    entries: [ { exerciseId,                          */
/*                                  sets: [ { reps, weight, rpe } ] } ] } ] */
/*   saveLogs(logs)                                                     */
/*   clearSampleLogs() — removes logs flagged sample:true              */
/*   getSavedWorkouts() / saveSavedWorkouts(list)   (milestone 2)       */
/*   getPrograms() / savePrograms(list)             (milestone 2)       */
/* ------------------------------------------------------------------ */

function LocalStorageAdapter(prefix) {
  this.prefix = prefix || 'workoutapp.';
}

LocalStorageAdapter.prototype._key = function (name) {
  return this.prefix + name;
};

LocalStorageAdapter.prototype._read = function (name, fallback) {
  try {
    var raw = localStorage.getItem(this._key(name));
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};

LocalStorageAdapter.prototype._write = function (name, value) {
  try {
    localStorage.setItem(this._key(name), JSON.stringify(value));
  } catch (e) { /* storage full / private mode: app still renders */ }
};

LocalStorageAdapter.prototype.getExerciseNotes = function () {
  return this._read('notes', {});
};

LocalStorageAdapter.prototype.saveExerciseNote = function (exerciseId, text) {
  var notes = this.getExerciseNotes();
  if (text) {
    notes[exerciseId] = text;
  } else {
    delete notes[exerciseId];
  }
  this._write('notes', notes);
};

LocalStorageAdapter.prototype.getLogs = function () {
  return this._read('logs', []);
};

LocalStorageAdapter.prototype.saveLogs = function (logs) {
  this._write('logs', logs);
};

LocalStorageAdapter.prototype.clearSampleLogs = function () {
  var kept = this.getLogs().filter(function (l) { return !l.sample; });
  this.saveLogs(kept);
  return kept;
};

LocalStorageAdapter.prototype.hasSampleLogs = function () {
  return this.getLogs().some(function (l) { return !!l.sample; });
};

LocalStorageAdapter.prototype.getSavedWorkouts = function () {
  return this._read('savedWorkouts', []);
};

LocalStorageAdapter.prototype.saveSavedWorkouts = function (list) {
  this._write('savedWorkouts', list);
};

LocalStorageAdapter.prototype.getPrograms = function () {
  return this._read('programs', []);
};

LocalStorageAdapter.prototype.savePrograms = function (list) {
  this._write('programs', list);
};

var store = new LocalStorageAdapter();

/* ------------------------------------------------------------------ */
/* Sample data (clearly marked; removable from the footer)             */
/* ------------------------------------------------------------------ */

var SAMPLE_LOGS = [
  {
    id: 'sample-log-1',
    dateISO: '2026-08-19',
    name: 'Sample – Pull Day',
    sample: true,
    entries: [
      { exerciseId: 'Wide-Grip_Lat_Pulldown', sets: [
        { reps: 10, weight: 120, rpe: 8 },
        { reps: 10, weight: 120, rpe: 8.5 },
        { reps: 10, weight: 120, rpe: 9 }
      ] },
      { exerciseId: 'Close-Grip_Front_Lat_Pulldown', sets: [
        { reps: 10, weight: 100, rpe: 8 },
        { reps: 10, weight: 100, rpe: 8.5 },
        { reps: 8, weight: 100, rpe: 9 }
      ] }
    ]
  },
  {
    id: 'sample-log-2',
    dateISO: '2026-08-26',
    name: 'Sample – Pull Day',
    sample: true,
    entries: [
      { exerciseId: 'Wide-Grip_Lat_Pulldown', sets: [
        { reps: 10, weight: 130, rpe: 8 },
        { reps: 10, weight: 130, rpe: 8.5 },
        { reps: 8, weight: 130, rpe: 9 }
      ] },
      { exerciseId: 'Close-Grip_Front_Lat_Pulldown', sets: [
        { reps: 10, weight: 105, rpe: 8 },
        { reps: 10, weight: 105, rpe: 8.5 }
      ] }
    ]
  },
  {
    id: 'sample-log-3',
    dateISO: '2026-09-02',
    name: 'Sample – Pull Day',
    sample: true,
    entries: [
      { exerciseId: 'Wide-Grip_Lat_Pulldown', sets: [
        { reps: 8, weight: 140, rpe: 8 },
        { reps: 8, weight: 140, rpe: 8.5 },
        { reps: 8, weight: 140, rpe: 9 }
      ] },
      { exerciseId: 'One_Arm_Lat_Pulldown', sets: [
        { reps: 10, weight: 60, rpe: 8 },
        { reps: 10, weight: 60, rpe: 8.5 }
      ] }
    ]
  }
];

function ensureSeeded() {
  // Seed once: if the flag is absent we have never seeded this browser.
  if (store._read('seeded', null) !== null) return;
  store.saveLogs(SAMPLE_LOGS.slice());
  store._write('seeded', true);
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  // "2026-08-19" -> "Aug 19, 2026" without timezone pitfalls.
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
}

function fmtNum(n) {
  return (Math.round(n * 10) / 10).toString();
}

var toastTimer = null;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
}

/* ------------------------------------------------------------------ */
/* Exercise data                                                       */
/* ------------------------------------------------------------------ */

var EXERCISES = [];
var EXERCISE_BY_ID = {};

function muscleList() {
  var seen = {};
  EXERCISES.forEach(function (e) {
    (e.primaryMuscles || []).forEach(function (m) { seen[m] = true; });
  });
  return Object.keys(seen).sort();
}

function equipmentList() {
  var seen = {};
  EXERCISES.forEach(function (e) {
    if (e.equipment) seen[e.equipment] = true;
  });
  return Object.keys(seen).sort();
}

/* All logged sets for one exercise, newest first:
 * [{ dateISO, logName, sample, reps, weight, rpe }] */
function setsForExercise(exerciseId) {
  var out = [];
  store.getLogs().forEach(function (log) {
    (log.entries || []).forEach(function (entry) {
      if (entry.exerciseId !== exerciseId) return;
      (entry.sets || []).forEach(function (s) {
        out.push({
          dateISO: log.dateISO,
          logName: log.name,
          sample: !!log.sample,
          reps: s.reps,
          weight: s.weight,
          rpe: s.rpe
        });
      });
    });
  });
  out.sort(function (a, b) {
    return String(b.dateISO) < String(a.dateISO) ? -1 :
           String(b.dateISO) > String(a.dateISO) ? 1 : 0;
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

var viewEl, footerEl;

var ROUTES = {
  library: renderLibrary,
  exercise: renderExerciseDetail
  // Future: log: renderLog, calendar: renderCalendar, ...
};

function parseHash() {
  var h = (location.hash || '#/library').replace(/^#\//, '');
  var parts = h.split('/');
  return {
    name: parts[0] || 'library',
    param: parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null
  };
}

function render() {
  var r = parseHash();
  var fn = ROUTES[r.name];
  if (!fn) {
    viewEl.innerHTML = '<h1>Not found</h1><p><a href="#/library">Back to library</a></p>';
    return;
  }
  fn(r.param);
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ */
/* Library view                                                        */
/* ------------------------------------------------------------------ */

var libState = { q: '', muscle: 'all', equipment: 'all', shown: PAGE_SIZE };

function filteredExercises() {
  var q = libState.q.trim().toLowerCase();
  return EXERCISES.filter(function (e) {
    if (q && e.name.toLowerCase().indexOf(q) === -1) return false;
    if (libState.muscle !== 'all' &&
        (e.primaryMuscles || []).indexOf(libState.muscle) === -1) return false;
    if (libState.equipment !== 'all' && e.equipment !== libState.equipment) return false;
    return true;
  });
}

function exerciseRowHtml(e) {
  var meta = (e.primaryMuscles || []).join(', ') +
    (e.equipment ? ' · ' + e.equipment : '');
  return '<a class="ex-row" href="#/exercise/' + encodeURIComponent(e.id) + '">' +
    '<div class="ex-row-name">' + esc(e.name) + '</div>' +
    '<div class="ex-row-meta">' + esc(meta) + '</div>' +
    '</a>';
}

function renderExerciseList() {
  var list = filteredExercises();
  var slice = list.slice(0, libState.shown);
  var html = slice.map(exerciseRowHtml).join('');
  var listEl = document.getElementById('ex-list');
  listEl.innerHTML = html || '<p class="muted">No exercises match.</p>';
  document.getElementById('result-count').textContent =
    list.length + ' of ' + EXERCISES.length + ' exercises';
  var moreEl = document.getElementById('load-more-wrap');
  moreEl.style.display = list.length > libState.shown ? '' : 'none';
}

function renderLibrary() {
  var muscles = muscleList().map(function (m) {
    return '<option value="' + esc(m) + '"' +
      (libState.muscle === m ? ' selected' : '') + '>' + esc(m) + '</option>';
  }).join('');
  var equip = equipmentList().map(function (e) {
    return '<option value="' + esc(e) + '"' +
      (libState.equipment === e ? ' selected' : '') + '>' + esc(e) + '</option>';
  }).join('');

  viewEl.innerHTML =
    '<h1>Exercise Library</h1>' +
    '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search exercises…" value="' + esc(libState.q) + '" autocomplete="off">' +
      '<div class="controls-row">' +
        '<select id="f-muscle" aria-label="Filter by muscle">' +
          '<option value="all">All muscles</option>' + muscles +
        '</select>' +
        '<select id="f-equip" aria-label="Filter by equipment">' +
          '<option value="all">All equipment</option>' + equip +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="result-count" id="result-count"></div>' +
    '<div id="ex-list"></div>' +
    '<div class="load-more-wrap" id="load-more-wrap">' +
      '<button id="load-more">Show more</button>' +
    '</div>';

  function resetAndRender() {
    libState.shown = PAGE_SIZE;
    renderExerciseList();
  }

  var qEl = document.getElementById('q');
  qEl.addEventListener('input', function () {
    libState.q = qEl.value;
    resetAndRender();
  });
  // Keep focus usable on iOS: don't steal focus on re-render (we only
  // re-render the list, never the controls).
  document.getElementById('f-muscle').addEventListener('change', function (ev) {
    libState.muscle = ev.target.value;
    resetAndRender();
  });
  document.getElementById('f-equip').addEventListener('change', function (ev) {
    libState.equipment = ev.target.value;
    resetAndRender();
  });
  document.getElementById('load-more').addEventListener('click', function () {
    libState.shown += PAGE_SIZE;
    renderExerciseList();
  });

  renderExerciseList();
}

/* ------------------------------------------------------------------ */
/* Exercise detail view                                                */
/* ------------------------------------------------------------------ */

function statsHtml(exercise) {
  var sets = setsForExercise(exercise.id);
  if (!sets.length) {
    return '<p class="muted">No logged sets yet. Log a workout to start tracking this exercise.</p>';
  }
  var stats = exerciseStats(sets);
  var hasSample = sets.some(function (s) { return s.sample; });

  var html = '';
  if (hasSample) {
    html += '<p><span class="tag sample">sample data</span></p>';
  }

  if (stats) {
    html += '<div class="stat-line"><span class="stat-label">Projected 1RM</span>' +
      '<strong>' + fmtNum(stats.projected1RM.value) + '</strong> ' +
      '<span class="muted">(' + esc(METHOD_LABELS[stats.projected1RM.method] || stats.projected1RM.method) + ')</span></div>';
    html += '<div class="stat-line"><span class="stat-label">PR — best estimated 1RM</span>' +
      '<strong>' + fmtNum(stats.bestE1RM.value) + '</strong> ' +
      '<span class="muted">(' + esc(METHOD_LABELS[stats.bestE1RM.method] || stats.bestE1RM.method) +
      ', ' + fmtDate(stats.bestE1RM.set.dateISO) + ')</span></div>';
    var hs = stats.heaviestSet;
    html += '<div class="stat-line"><span class="stat-label">PR — heaviest set</span>' +
      '<strong>' + fmtNum(hs.weight) + ' × ' + esc(hs.reps) + '</strong> ' +
      '<span class="muted">(' + fmtDate(hs.dateISO) +
      (hs.rpe !== null && hs.rpe !== undefined && hs.rpe !== '' ? ', RPE ' + esc(hs.rpe) : '') + ')</span></div>';
  }

  html += '<h3>History</h3><div class="table-wrap"><table>' +
    '<thead><tr><th>Date</th><th>Weight</th><th>Reps</th><th>RPE</th><th>Est. 1RM</th></tr></thead><tbody>';
  sets.forEach(function (s) {
    var e = estimate1RM(s.weight, s.reps, s.rpe);
    html += '<tr>' +
      '<td>' + esc(fmtDate(s.dateISO)) + (s.sample ? ' <span class="tag sample">sample</span>' : '') + '</td>' +
      '<td>' + fmtNum(s.weight) + '</td>' +
      '<td>' + esc(s.reps) + '</td>' +
      '<td>' + (s.rpe !== null && s.rpe !== undefined && s.rpe !== '' ? esc(s.rpe) : '–') + '</td>' +
      '<td>' + (e.value === null ? '–' : fmtNum(e.value)) + '</td>' +
      '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function notesHtml(exerciseId) {
  var notes = store.getExerciseNotes();
  return '<h2>Notes</h2>' +
    '<textarea id="ex-notes" placeholder="Cues, setup notes, how it felt…">' +
    esc(notes[exerciseId] || '') + '</textarea>' +
    '<div class="notes-status" id="notes-status"></div>';
}

function similarHtml(exercise) {
  var sims = similarExercises(exercise, EXERCISES, 6);
  if (!sims.length) return '<p class="muted">No similar exercises found.</p>';
  return '<div>' + sims.map(function (s) {
    var shared = [];
    (s.exercise.primaryMuscles || []).forEach(function (m) {
      if ((exercise.primaryMuscles || []).indexOf(m) !== -1) shared.push(m);
    });
    return '<a class="ex-row" href="#/exercise/' + encodeURIComponent(s.exercise.id) + '">' +
      '<div class="ex-row-name">' + esc(s.exercise.name) + '</div>' +
      '<div class="ex-row-meta">' + esc(shared.join(', ') || (s.exercise.primaryMuscles || []).join(', ')) + '</div>' +
      '</a>';
  }).join('') + '</div>';
}

var noteTimer = null;

function renderExerciseDetail(id) {
  var exercise = EXERCISE_BY_ID[id];
  if (!exercise) {
    viewEl.innerHTML = '<h1>Exercise not found</h1><p><a href="#/library">Back to library</a></p>';
    return;
  }

  var img = (exercise.images && exercise.images[0])
    ? '<img class="ex-image" loading="lazy" src="' + IMAGE_BASE_URL + exercise.images[0] +
      '" alt="' + esc(exercise.name) + '">'
    : '';

  viewEl.innerHTML =
    '<a class="back-link" href="#/library">‹ Library</a>' +
    '<h1>' + esc(exercise.name) + '</h1>' +
    '<div>' +
      (exercise.primaryMuscles || []).map(function (m) { return '<span class="tag">' + esc(m) + '</span>'; }).join('') +
      (exercise.secondaryMuscles || []).map(function (m) { return '<span class="tag">' + esc(m) + ' (secondary)</span>'; }).join('') +
    '</div>' +
    '<dl class="meta-grid">' +
      (exercise.equipment ? '<dt>Equipment</dt><dd>' + esc(exercise.equipment) + '</dd>' : '') +
      (exercise.level ? '<dt>Level</dt><dd>' + esc(exercise.level) + '</dd>' : '') +
      (exercise.mechanic ? '<dt>Mechanic</dt><dd>' + esc(exercise.mechanic) + '</dd>' : '') +
      (exercise.force ? '<dt>Force</dt><dd>' + esc(exercise.force) + '</dd>' : '') +
      (exercise.category ? '<dt>Category</dt><dd>' + esc(exercise.category) + '</dd>' : '') +
    '</dl>' +
    img +
    ((exercise.instructions && exercise.instructions.length)
      ? '<h2>Instructions</h2><ol class="instructions">' +
        exercise.instructions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
        '</ol>'
      : '') +
    '<h2>Your stats</h2>' +
    statsHtml(exercise) +
    notesHtml(exercise.id) +
    '<h2>Similar exercises</h2>' +
    similarHtml(exercise);

  // Autosave notes (debounced).
  var notesEl = document.getElementById('ex-notes');
  var statusEl = document.getElementById('notes-status');
  notesEl.addEventListener('input', function () {
    statusEl.textContent = 'Saving…';
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(function () {
      store.saveExerciseNote(exercise.id, notesEl.value.trim());
      statusEl.textContent = notesEl.value.trim() ? 'Saved.' : '';
    }, NOTE_SAVE_DELAY);
  });
}

/* ------------------------------------------------------------------ */
/* Footer (settings area)                                              */
/* ------------------------------------------------------------------ */

function renderFooter() {
  if (store.hasSampleLogs()) {
    footerEl.innerHTML =
      '<span class="muted">Showing 3 sample workouts for demo.</span>' +
      '<button class="danger" id="clear-sample">Clear sample data</button>';
    document.getElementById('clear-sample').addEventListener('click', function () {
      if (!window.confirm('Remove the sample workouts? Your own logged data is kept.')) return;
      store.clearSampleLogs();
      renderFooter();
      render();
      showToast('Sample data cleared.');
    });
  } else {
    footerEl.innerHTML =
      '<span class="muted">Data is stored on this device only. Accounts & sync coming later.</span>';
  }
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

function init() {
  viewEl = document.getElementById('view');
  footerEl = document.getElementById('app-footer');

  ensureSeeded();

  fetch(EXERCISE_DB_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      EXERCISES = data;
      data.forEach(function (e) { EXERCISE_BY_ID[e.id] = e; });
      renderFooter();
      render();
    })
    .catch(function () {
      viewEl.innerHTML =
        '<h1>Couldn’t load exercises</h1>' +
        '<p class="muted">The exercise database failed to load. Check your connection and reload.</p>';
    });

  window.addEventListener('hashchange', render);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline is best-effort */ });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();

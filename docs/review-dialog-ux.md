# Review-sets ("Finish") dialog — UX research & recommendations

Researched 2026-09-11. Context: [#43](https://github.com/cruciferousgreens/workout-app/issues/43) — the finish flow must never save null data (user's hard constraint), but the current "Review sets" dialog dead-ends on partially-filled sets.

## Our current flow (as of 2026-09-11)

Tapping **Finish** with problem sets opens one "Review sets" dialog summarizing issues
(e.g. "2 sets are missing reps, seconds, or weight. 1 set isn't marked complete.") with:

- **Mark all complete** — shown ONLY when every set has valid values but some aren't
  marked complete. Hidden whenever any set has missing values (never-null rule).
- **Finish and delete empty sets** — deletes only *fully*-empty sets (no weight, reps,
  seconds, RPE, or tags), then finishes. Partially-filled sets are never auto-deleted.
- **Keep editing** — closes the dialog; the user hunts down the bad sets manually.

The pain point: a **partial set** (weight typed, reps missing) can't be auto-deleted
(data loss), can't be saved as null (paradigm violation), and "Mark all complete" is
hidden — so the user gets a dead-end dialog and must manually fix or delete the set.

## How other apps handle it

### Strong & Hevy — the commit happens at the ✓ tap; finish is frictionless

The industry model, documented in a public competitor teardown of Strong / Hevy /
Boostcamp / Alpha Progression (gabandres/fitness-tracker-pwa,
`docs/research/train-template-ux.md`, researched 2026-08-18):

- **Nothing is logged until the lifter taps.** Tapping the checkmark on a set is the
  single commit point. In Strong/Hevy, tapping done on a set with a target
  **commits the target values** — "the one-tap confirm Strong and Hevy use, and the
  reason nothing is logged until the lifter actually taps."
- **Empties are pruned at finish, silently.** Their rule is literally
  `reps != null` ⟺ "this set was performed," and a `dropEmptySets` pass prunes
  unperformed sets at finish. No prompt, no dialog.
- **Partial sets structurally can't exist.** Because the done-tap commits the full
  target (weight + reps), a set is either fully valid or untouched. "A load with no
  reps has never counted as a logged set" — so pre-filled weight alone is safe.
- The teardown explicitly flags the naive alternative as a **data-fabrication bug**:
  writing a template's reps into a session set *before* the user taps done would
  record workouts the lifter never did.

Takeaway: Strong/Hevy satisfy "never null" **structurally** — the tap is the user's
attestation, and finish never has to triage partials because partials can't occur.

### Fitbod — per-set log-as-complete; unlogged sets simply don't exist

Fitbod generates the workout; you log each set as complete as you go (Android Central
review: "when you complete exercise reps, you have to log each one as complete").
Unmarked sets are just not part of the record. There is no finish gate at all —
ending the workout saves whatever was explicitly logged.

### FitNotes — only performed sets are ever added

FitNotes has no finish flow either: you add sets to the day's log one at a time with
values filled in. A routine starts with empty set shells, but nothing is recorded
until you explicitly log a set. Unperformed sets never enter the log.

### Jefit — log-as-you-go, timer-driven

Same family: sets are logged during the workout; ending the workout saves the log.
No triage dialog at finish.

### The pattern

Every comparator puts the commit at the **done-tap** and makes finish frictionless.
None of them auto-save half-typed input, so none of them need a triage dialog.
**Our app is the outlier**: inputs auto-save as typed *and* sets need explicit
completion — a hybrid neither Strong nor Hevy uses — which creates the partial-set
state that no competitor has to handle.

## Evaluation of our current flow

| | Industry (Strong/Hevy/Fitbod/FitNotes) | Ours |
|---|---|---|
| Commit point | ✓ tap commits full values | ✓ tap marks complete; values may be partial |
| Partial sets | Impossible by construction | Possible (auto-saved half-typed input) |
| Empty sets at finish | Silently dropped | "Finish and delete empty sets" (explicit, counted — good) |
| Finish friction | Zero | Dialog whenever anything is unmarked/partial |

Our dialog is honest and safe, but it taxes the user for a state the industry
prevents. The never-null constraint is *compatible* with the industry model — in
fact the industry model enforces it structurally.

## Recommendations

### Option 1 (recommended, structural): make ✓ the commit point — "tap means I did this"

Adopt the Strong/Hevy semantic: **tapping ✓ on a set commits any placeholder/
suggested values into the fields**, so a set is either fully valid or untouched.

- Our app already does this for **weight** ("completing a set with the input
  untouched saves the placeholder value"). Extend the same semantic to
  reps/seconds: if the reps field is empty but shows a placeholder (last reps for
  that exercise, or the rep-range floor), tapping ✓ commits the placeholder.
- After this, the only unfinished states at finish are (a) sets never marked
  complete and (b) fully-empty sets. The review dialog keeps "Mark all complete"
  (now always safe to show) and "Finish and delete empty sets"; the partial-set
  dead-end disappears because partials can't be created via ✓.
- A set with *typed* partial values (user typed weight, left reps blank, tapped ✓)
  still needs a rule: either block the ✓ with an inline nudge ("add reps or clear
  the set") or commit the reps placeholder. Blocking is more honest; committing
  is more Strong-like. user's call.
- **Tradeoff to be explicit about:** this leans on placeholder accuracy. If the
  suggestion says 8 reps and the lifter did 6 but tapped ✓ out of habit, we log 8.
  Strong/Hevy accept this — the tap is the attestation. Our weight-placeholder
  behavior already accepted it for weight. But it *is* a step toward the
  data-fabrication failure mode the teardown warns about, so the committed value
  should be visibly the placeholder (not a surprise) and typed input must always
  win — both already true in our UI.
- Respects "never automatically react mid-workout": nothing happens without the
  user's tap.

### Option 2 (near-term, no data-model change): turn the dialog into a triage checklist

Keep the current data model, but replace the dead-end summary + 3 buttons with an
**itemized list of the problem sets**, each row showing what it has
("Bench Press · set 3 · 135 lb × ? reps") with two inline actions:

- **Fix** — closes the dialog, scrolls to the set, focuses the missing field.
- **Discard** — deletes that set (explicit, per-set, eyes-open; no silent loss).

Keep "Finish and delete N empty sets" as the bulk action at the top, and "Mark all
complete" only when valid (current rule). The manual path stays manual, but each
resolution is one contextual tap instead of "Keep editing → hunt for the set."

### Option 3 (middle path): explicit "Discard N partial sets" with itemized confirm

Add one button to the existing dialog: **"Discard N incomplete sets"** (danger
styling, with the count). Tapping it opens a confirm dialog that **lists each
set's partial data** ("Bench Press set 3 — 135 lb, no reps · OHP set 2 — 95 × ? …")
with **Keep editing** / **Discard N sets and finish**. The user reviews exactly
what will be lost, confirms once, and the workout finishes. One extra tap versus
per-set triage; explicit enough to satisfy the safety bar; never writes nulls.

## Suggested sequencing

1. **Now:** Option 2 or 3 — small, reversible, kills the dead-end without touching
   the data model. (Option 3 is less UI work; Option 2 is better UX.)
2. **Next:** Option 1 — the structural fix that removes the partial state the way
   the whole industry does. Needs user's explicit call on the
   block-vs-commit decision for typed partials, since it touches the honesty
   guarantee.

## Sources

- Competitor teardown (Strong, Hevy, Boostcamp, Alpha Progression) — template/session
  UX research, 2026-08-18: https://github.com/gabandres/fitness-tracker-pwa/blob/HEAD/docs/research/train-template-ux.md
  (documents the one-tap target commit, `reps != null` ⟺ performed, and
  `dropEmptySets`-at-finish behavior)
- Fitbod per-set log-as-complete model: https://www.androidcentral.com/apps-software/fitbod-favorite-fitness-app-2023
- FitNotes add-only-performed-sets model: https://www.ghacks.net/2013/06/09/keep-a-gym-workout-log-with-fitnotes-for-android/
- 2026 app comparison (Strong vs Hevy vs Fitbod positioning): https://www.sensai.fit/blog/fitness-app-comparison

Note: app behaviors above are drawn from published teardowns, help docs, and
reviews (no live in-app verification — no browser automation available in this
session). Specifics of Strong/Hevy's current finish pruning should be spot-checked
on-device before citing them as gospel.

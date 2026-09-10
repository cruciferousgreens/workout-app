# Workout App Changelog

Newest first. Dates are release dates (America/New_York).

## 2026-09-10 — Workout UI batch

- **Nixed the plate calculator.** The Plate calculator button and dialog are gone from the workout builder.
- **Save as template / Add to active program moved.** These no longer appear during a live workout; they now live as quiet secondary actions on the completed-workout detail screen, alongside Edit workout.
- **Prettier date.** The workout date now shows as e.g. “Thu, Sep 10, 2026” on a tappable button; tapping still opens the native date picker.
- **Tags fixed.** Restoring saved data now *merges* your custom set tags and exercise-tag presets with the built-in defaults (defaults first, customs appended, deduped) instead of replacing one with the other. New default tags added in future updates will now show up for existing users too. “To failure” is now also an exercise-tag preset.
- **Prettier load-progression boxes.** Load +, Rep +, Hold, and range/time suggestion cards got a cleaner hierarchy: exercise name as a small kicker, the new target big and bold, the change reason and basis in quieter supporting type.
- **Collapsible exercise cards.** Each exercise in the live workout is now its own collapsible card: the header shows the name plus a compact summary (sets · top weight · completed count); tap to expand sets, targets, and progression controls. Expanded/collapsed state is remembered per exercise. The exercise picker’s old single “Sets, targets & progression” list is gone too — each added exercise now gets its own collapsible card showing its set count and rep/time range.
- **StrongLifts 5×5 templates restored.** Workout A and Workout B are back in the “From template” list. Built-in templates are now always present; your own saved templates are merged in on top and persist as before.

## 2026-09-10 — Code takeover: durable saving

- Took over the code directly (`staging/` is now the source of truth) so saving actually works.
- **Durable localStorage persistence** (`workout-app:v1`): completed workouts, templates, set tags, exercise-tag presets, active/archived programs, the in-progress draft, custom exercises, progression defaults, and dashboard/stats periods all survive reloads. Auto-saves on every change, plus a 5-second safety flush and a page-hide flush.
- **Sample data removed entirely.** No more seeded workouts or templates.
- **New Settings tab** (sixth nav tab): dark mode toggle (moved out of the header), progression defaults (RPE threshold, load step type/value, default rep range, time step, stall detector), data tools (one-tap JSON export, two-step delete-all), attributions, and about.
- **Templates moved** out of the Program tab into a collapsed “From template” list under Start training.
- **Continue-program option** on the Training screen when a program is active.
- **Anatomical heat map restored** (Sasha-style front/back SVG) everywhere; the minimal abstract map is gone.
- **Red dot removed** from workout rows.
- **Exact progression weights**: undulating rebase no longer snaps to the nearest 2.5 lb.

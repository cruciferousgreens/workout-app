# Major releases

Newest first. Only user-facing milestones — the full batch-by-batch history
lives in [CHANGELOG.md](CHANGELOG.md).

## v0.5 — Accounts & sync (in testing)

- Sign in with a magic link; workouts sync across devices.
- Editable display name on the account. Everything is still free.

## v0.6

- Public beta begins: the accounts build takes over app.cruciferousgreens.com
  (production). Plus is free for everyone during the beta.

## v0.56

- Settings → Account: breathing room between the email field and the
  "Email me a sign-in link" button.

## v0.55

- Exercise detail page shows the exercise name as the page title again (it
  was hidden along with the old breadcrumb header).

## v0.54

- Card icons are consistent: the workout exercise card's info button moved to
  the top-right corner, matching the library card's star.

## v0.53

- "This week." now sits right under the week dates in the calendar header,
  between the arrows, instead of below the day chips.

## v0.52

- Exercise detail header no longer shows a breadcrumb — just the parent
  page name; the exercise name lives in the detail body.
- Blind spots are now a proper section: divider, "Blind spots" label, pills.

## v0.51

- Scroll state: the Workout tab's start screen, live editor, and completed
  review each remember their own scroll position; starting or finishing a
  workout always lands at the top, with no visible jump.
- Workout Focus pills now ask before replacing rep ranges set per exercise.
- The Workout tab's continue-program card shows the workout's actual rep
  range(s) instead of the program default.
- Finish-review delete only removes fully-empty sets (never sets with
  partial values).
- Program Progression rules restyled to match Settings → Progression
  defaults (default rep range moved inside, same notch-field styling).

## v0.50

- Exercise picker: the top rules section only shows exercises added during
  that picker opening; the All list still shows everything (in-workout
  exercises marked ✓, tap to remove).
- Program cover: tighter header, no focus note, compact Edit program button;
  Workouts get an inline + button (auto-named Workout 1, 2, …) instead of the
  name field + Add workout button.
- Settings → About shows the app version and a "Last updated" build stamp.
- Undulating weekly range pills use bare ranges (1–5, 6–12, 12–20, 15+, AMRAP).
- The progression card hides entirely when there are no suggestions.

## v0.49

- New navigation: five fixed tabs, settings behind the top-right gear.
- Color themes (Cruciferous plus Catppuccin and Rosé Pine flavors).
- Progression engine: tap-to-apply suggestion cards, per-program defaults,
  stall detector, time-based progression, AMRAP support.
- Opt-in sample data, StrongLifts 5×5 template, anatomical body map.

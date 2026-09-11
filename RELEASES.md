# Major releases

Newest first. Only user-facing milestones — the full batch-by-batch history
lives in [CHANGELOG.md](CHANGELOG.md).

## v0.91

- Swipe can now start anywhere on a set row, including the checkbox and
  set-number (user's explicit ask). The v0.89 exclusion that made those
  two tap-only turned out to be the actual blocker: the row is densely
  packed with no bare background, so the checkbox and set-number are the
  two most natural places to grab, and a deliberate swipe starting on
  either visibly did nothing — the lab proved the v0.90 gesture engine
  itself is sound from field starts. Tap vs swipe is still decided at
  release by travel (≥24px = swipe), so plain taps still check the box,
  focus fields, and open the set tag dialog. A swipe that starts on the
  set-number no longer ends in a click that pops the tag dialog open.

## v0.90

- Fixed swipe being 100% dead (lab-proven): the v0.86 keyboard-blur line
  referenced `isSetSwipe` inside the pointermove handler, but the variable
  was only declared inside the pointerdown handler — a ReferenceError on
  every swipe start killed the gesture before it began. Hoisted to per-item
  scope. Combined with v0.89's pointer-capture removal, swipes should now
  actually engage on iPhone. Note: red rails in screenshots taken before this
  fix came from a stale service-worker-cached copy on the phone, not from
  the shipped code — a true hard refresh is required.

## v0.89

- Fixed the real swipe-killer (user's "swiping not working at all"):
  removed the explicit `setPointerCapture` call entirely. On iOS Safari,
  WebKit yanks that capture back ~1ms later and fires `lostpointercapture`,
  which was canceling every swipe one event after the direction lock — and
  letting thumb-drift on taps pop the rail open. Touch already captures
  implicitly, so nothing was lost. The checkbox/set-number swipe-start
  exclusion is back (small controls + thumb drift = accidental rails), and
  the vertical-vs-horizontal decision waits for ~12px so slightly arcing
  swipes aren't killed in their first samples.

## v0.88

- Fixed the stuck-open rail (user's screenshot): tap-vs-swipe is now
  decided at release by actual finger travel (≥ 24px), not at the 7px
  direction lock. A tap with finger jitter can no longer pop the rail open
  or get it stuck open — the checkbox just checks, fields just focus, and a
  tap on an open row dismisses it. Deliberate swipes work from anywhere on
  the row, including starting on the checkbox.

## v0.87

- Tapping the set checkbox just checks the box now (user's screenshot):
  taps starting on the checkbox or set-number button can no longer drift
  into a swipe from finger jitter — those stay pure tap. Swipe still starts
  from the weight/reps/RPE fields and the rest of the row.

## v0.86

- Toolbar cleanup (user's screenshot): the reorder/add icon buttons were
  stretching into giant full-width pills on phones — they're compact and
  right-aligned again. The reorder button also hides when there's only one
  exercise (it did nothing there).
- Swipe now starts from anywhere on a set row, including the weight/reps/RPE
  fields (user's guess was right — the fields were swallowing every swipe).
  A tap still focuses the field; only a horizontal drag swipes, and the
  keyboard dismisses as the swipe locks.

## v0.85

- Re-reconciled: the main-chat agent's "bump 0.84" was pushed from the stale
  tree again and reverted the v0.84 merge. Restored the merged tree and kept
  their one real change since (dashboard scroll restoration now waits for the
  body-map SVG hydration).

## v0.84

- Reconciliation (user's call — their changes take precedence): merged the
  main-chat line's real work that stale-tree pushes had been dropping — the
  at-a-glance period-tab scroll fix, the progression summary under Exercise
  options, and the hairline separator above Remove exercise — on top of the
  v0.83 swipe/checkbox/scroll work, which is all intact.

## v0.83

- Fixed the "stuck open" delete rails (user's screenshot): the red action
  sits behind the row, and set rows are transparent — so the red bled through
  and every row looked half-swiped. Rows are opaque now, only one rail can be
  open at a time, and tapping an open row dismisses its rail.
- Merged the other agent's in-flight work (their push was built from a stale
  tree and had reverted v0.81–v0.83): %1RM loads snap to 5 lb plates, AMRAP
  suggestion cards, and a reorder-exercises modal (up/down arrows) in the
  workout toolbar.

## v0.82

- Fixed the sideways page scroll on mobile (user's "major issue"): the root
  touch rule explicitly allowed horizontal panning (`pan-x pan-y`); it's now
  vertical-only. Nothing in the app needs horizontal page panning, and the
  set-row swipe is JS-driven with its own touch rule, so it keeps working.

## v0.81

- Set rows: the complete toggle is an open checkbox now (user's Strong
  inspiration) instead of the check-circle, and the input fields are wider —
  the old 93px action column left dead space on the right.
- Swipe-to-delete redo (user's feedback + Strong inspiration): only the
  trailing 72px end is red now — the row slides left over it, iOS-Mail style.
  The delete affordance is an icon-only minus-circle, no text.
- Swipe gesture fixes: pointer capture now engages only after horizontal
  intent is locked (vertical page scroll stays native and never fights the
  row), and tapping anywhere outside an open row closes it — no more stuck
  rails.
- Home Screen app note (user's status-bar report): iOS caches the system
  status-bar tint at launch, so Settings → Appearance now notes that the
  status bar tint refreshes after closing and reopening the app.

## v0.80

- Exercise cards are no longer swipe-to-delete — only set rows swipe (user).
  Removing an exercise still goes through the "Remove exercise" button.
- Sticky-hover fix (user): on touch devices, `:hover` styles that matched the
  selected look no longer stick after a tap (exercise picker, suggestion cards,
  period options, calendar). Hover styling now only applies on hover-capable
  devices.

## v0.79

- Swipe to delete sets (user): on touch devices, swipe a set row left to
  reveal Delete. New Settings → Appearance toggle (on by default), saved to
  the account and synced across devices. Desktop keeps the × button.

## v0.78

- Removed the Liquid Glass theme (user's call — parked as
  [workout-app#78](https://github.com/cruciferousgreens/workout-app/issues/78)
  for maybe-later). Header refinements from v0.76 re-applied on the latest
  tree: 22px page titles, chevron-only back button.

## v0.76

- Header refinement (user's pick, mockup C): page titles 22px, and the
  back button is now just a chevron — same 44px footprint as the gear, so
  the bar is symmetrical.

## v0.75

- The iOS status-bar strip now wears the top bar's background (white in
  light mode) instead of the cream page background, and page titles in the
  top bar are a touch bigger (17px → 20px).

## v0.74

- The no-zoom / no-scrollbar treatment now covers mobile browser tabs too,
  not just the installed app — the line is touch vs. desktop
  (`pointer: coarse`), so desktop stays exactly as it is.

## v0.73

- The installed iPhone app also hides its scrollbars now, and the
  no-pinch-zoom lock is scoped to the installed app only — desktop and
  in-browser tabs are completely unaffected.

## v0.72

- The iPhone home-screen app no longer pinch-zooms by accident — it stays
  at app scale like a native app.

## v0.71

- Sign in with a code from the email, not just the magic link — the
  code is the reliable way into the iPhone home-screen app, whose storage
  iOS keeps separate from Safari. The link still works as before, and the
  email now leads with the code.

## v0.7

- Settings → About has a "Check for updates" button, and the app now checks
  for new versions on its own when foregrounded — no more stale builds stuck
  on your phone. An "Update ready" prompt offers Refresh now / Later, and
  never interrupts a live workout.

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

# Major releases

Newest first. Only user-facing milestones.

## v1.000

- **Your numbers are right now** — a full pass over wrong-number bugs:
  metric autofill no longer shows pounds in a kilogram field; target RPE
  (what the plan calls for) is separated from the RPE you actually felt;
  bodyweight exercises count their sets properly in stats; same-day PRs and
  workout order work correctly; program weeks follow the calendar;
  imported exercises can't collide with existing ones; and share links are
  validated before they're opened.
- **Your data is safer** — if the phone can't save, the app now says so
  instead of failing silently; a corrupted save is quarantined with a
  recovery option instead of being overwritten; syncing two devices now
  resolves conflicts by recency (newest edit wins) and reports what
  actually happened; deleting a workout, template, or exercise on one
  device now deletes it on the other too; and "delete all data" really
  deletes everywhere.
- **Small annoyances fixed** — "Start a workout" works again after wiping
  data; exercise search puts exact matches first; helper text wraps;
  typing a weight no longer silently un-marks a completed set; the sticky
  header no longer covers buttons; the app explains why there's no
  progression suggestion; "Save as template" says what it means; and
  repeating a workout carries your last weight as a starting point.
- **Under the hood** — the sync engine and the app's internal structure
  were reworked so conflicts, deletions, and future features behave
  predictably. No visible changes from this part.

## v0.99ao

- **At a glance labels fit their cards** — the stat cards now read
  "Workouts", "Sets", and "Volume (lb)" on one line each. The longer
  labels overflowed the cards on phone widths; the meaning is unchanged.

## v0.99an

- **Share links are much shorter** — shared workouts and programs now
  travel in a compressed link (a typical workout link went from ~2,700
  characters to under 200), so they survive being texted. Opening a share
  link while the app is already open now pops it up over your current
  screen instead of yanking you away, and a broken link tells you it's
  broken instead of failing silently.
- **Exercise Progress headline is tappable** — tap the Estimated 1RM
  headline to flip it (and the line chart) to Heaviest weight per session;
  tap again to flip back. Your pick sticks while you browse exercises.
- **Program workout edit → Discard returns to that workout's page** —
  backing out of the builder (Discard or Back) lands on the program
  workout you came from, not the program cover or the Workout tab.
- **Editing a workout log opens the editor** — tapping Edit on a completed
  workout now actually opens it for editing. If a live workout is already
  in progress, the app asks first: editing replaces the current session.
- **Program workouts land on the log when finished** — completing a program
  workout now stays on the completed workout log, like every other workout,
  instead of jumping straight to the Program page.

## v0.99am

- **Shared workouts open full-screen** — opening a share link now shows the
  actual workout (exercises, sets, muscles) instead of a small dialog, with
  the actions right on it. **Start workout** is the primary button when
  you're signed out (no account needed); it saves the workout to your
  library too. The "Not now" button is gone.

## v0.99al

- **Hold weeks read right** — when the progression engine holds (top set over
  the RPE trigger, so no suggestion fires), set rows now ghost your latest top
  set (100 lb × 6) instead of the range minimum (100 × 1).
- **Saved-workout filters stick** — the muscle pills and "In a program" toggle
  on the saved list are remembered across reloads.

## v0.99ak

- **Program workout cards** — the chevron gets the same spacing as the
  saved-workout cards instead of sitting jammed against the card edge.

## v0.99aj

- **Program list stops jumping around** — adding a saved workout to a program
  keeps you on the program page (no more getting yanked into the added
  workout), and deleting a workout from the program list keeps your scroll
  position instead of jumping to the top.

## v0.99ai

- **Stat cards fixed** — tapping an abbreviated card (like "1M+") shows the
  exact total with the font shrinking to fit instead of cutting off; the
  number stays in line with the other cards and the label below never moves.
- **Share, repositioned and visible** — the Share button now sits next to
  Start at the top of saved workouts, and program workouts can be shared too
  (they're template-shaped, so they share the same way). Tapping Share shows
  the link itself with a copy button; the system sheet shares the bare link
  with no workout name prepended.
- **Quieter charts** — the left-axis numbers are gone (gridlines stay) and
  fewer date labels crowd the bottom.
- **Favorites lead the Exercises list** — favorites get their own section at
  the top, Recents follow after a hairline divider.

## v0.99ah

- **Hevy-style charts** — exercise charts are rebuilt: a fixed headline (value +
  date, like Hevy) updates in place when a point is tapped, so the chart never
  jumps; the phone-first plot fills the card with no dead bands; every
  gridline gets a labeled nice-number tick instead of the old max/min-only
  axis.
- **Tappable "Log" header** — on the log list and completed logs, the header
  title is a hidden button (looks identical) that jumps to the full log list.

## v0.99ag

- **Compact stat numbers** — the 3-card row stays 3-across at every width: huge
  totals abbreviate instead of bursting the card (volume shows "1M+" at a
  million, "250K+" style below that; sets show "10K+"). Tapping an abbreviated
  card reveals the true total in smaller text; tapping again restores it.

## v0.99af

- **Navigation state rebuild** — the three systematic defects are fixed: the
  Workout tab always lands home (no more resurrecting stale log lists or old
  completed reviews), workout sub-screens are mutually exclusive, and the
  in-app back chevron and the system/swipe back now agree with each other.
- **Logs are their own page** — the log list and completed logs no longer
  highlight the Workout tab; nothing highlights while a log is open.
- **Swipe back from a log** — opening a log pushes a page, so swiping back
  returns to the log list instead of skipping to the screen before it.
- **Program swipe-to-delete** — swiping a program workout row now opens its
  delete rail; previously every swipe died because the row's tap target
  covered it, leaving only the ×.
- **Tab press animation removed** — the split-second shrink on tab taps is
  gone; the highlight pill is the tap feedback.

## v0.99ae

- **Log navigation fixed** — tapping a workout in the log list opens it as its
  own page; the detail no longer renders inline under the list.
- **"Log" titles** — the log list and completed-workout views show "Log" in
  the top bar, not "Workout". Completed workouts are logs.
- **At-a-glance overflow** — on narrow screens the stat tiles go two-plus-one
  so a seven-digit lifetime volume fits its tile instead of bursting it.

## v0.99ad

- **Tappable exercise charts** — tap a dot on the 1RM line or a volume bar to
  see that session's date and value; tap again to dismiss.
- **Muscle map first:** on the exercise page the Muscles worked map now sits
  above the Progress charts.
- **Favorites float in search** — starred exercises rank above the rest when
  searching, in the Exercises tab and the workout builder picker.

## v0.99ac

- **Workout logs get period pills** — Today / Week / Month / Year / All time,
  matching Home and Stats — and the list now uses the same row layout as
  Home's Recent workouts. Search covers exercise names too.
- **Completed workout, one back button:** the extra in-page Back pill is gone —
  the top-bar chevron is the way back, and it returns to wherever you came
  from. The save button moved into the header next to the title, like the
  program page's Start button, and just says "Save".
- **Share links are visible:** sharing opens the system share sheet when
  available, otherwise a dialog shows the full link with Copy and Done.
- **Program cards:** deleting a workout no longer jumps the page, the divider
  before the × is subtler, and the "Swipe to delete" setting now covers
  program cards as well as sets.
- **Smoother tab switches:** the app now clears focus when changing tabs and
  reserves the body map's space before it loads, so async content can't shift
  the page.

## v0.99ab

- **"Upper back" is now a muscle option** everywhere muscles are picked —
  exercise library filter, workout builder, and custom exercises — and it
  lights the traps region on the anatomical body map.

## v0.99aa

- **Sync failures are actionable:** a failed sync no longer shows Safari's
  cryptic "TypeError: Load failed" — it says the network couldn't be reached,
  offers a "Try sync again" button, and retries once automatically.
- **Exercise history is collapsible and cleaner:** the History section on an
  exercise page starts collapsed (toggle shows the session count and latest
  date), and each set is one compact line — weight × reps with RPE/tags
  right-aligned.

## v0.99z

- **Share links (#32):** saved workouts and programs now have a Share button —
  copy a link and anyone opening it gets an import preview to add it to
  their library (custom exercises referenced by the share come along too).
- **Saved workouts are one filterable list:** search by name or exercise,
  plus a filter for primary muscles and program membership. Program
  workouts carry their program chip in the same list.
- **Program workouts get a visible delete button** on each card (swipe still
  works), and the card corners render correctly.
- **Workout logs:** the dashboard's Recent workouts card has a right-justified
  "See all", and the Stats tab's Completed workouts stat jumps to the full
  log list (now titled "Workout logs").

## v0.99y

- **Under-the-hood cleanup:** removed the dead legacy program exercise picker
  (program workouts use the shared saved-workout builder now), centralized
  navigation (tab taps always land home, Back restores context), and unified
  duplicate helpers for PR detection, muscle pills, and data wiping. No
  visible changes — this is reliability work ahead of v1.0.

## v0.99x

- **Import matching got much smarter:** obvious MacroFactor exercise matches
  now auto-resolve (59 of 113 names in testing, up from 7) — "Barbell Back
  Squat" → Barbell Squat, "Seated Neutral Grip Dumbbell Overhead Press" →
  Seated Dumbbell Press — while genuinely ambiguous names stay manual.
  MacroFactor's `∈ SS1` / `∈ C1` superset tags are stripped so they no
  longer break matching.
- **Import review hides perfect data:** auto-matched exercises collapse
  behind a per-workout "✓ N auto-matched" toggle, and the summary tells you
  exactly how many exercises need your review — no more scrolling past rows
  that need zero decisions.

## v0.99w

- **Start sits inline with the workout name:** on saved-workout and
  program-workout pages the big full-width button is gone — a compact "Start"
  pill sits top-right next to the name.
- **Reps/Seconds toggle fixed in the builder:** tapping Seconds now actually
  switches the exercise to seconds (it silently did nothing before) and no
  longer jumps the page.
- **Program "+" goes straight to the builder:** adding a workout to a program
  opens the workout editor immediately, with a dashed "Part of \<program\>"
  chip beside the Saved workout signifier.
- **Program workouts in the saved-workout list:** active-program workouts show
  under "From \<program\>" with a program-name chip, styled exactly like the
  saved-workout cards; tapping one opens its program-workout page.
- **Program chip on completed workouts:** Home (and history) rows for
  program-completed workouts show a Built-in-style chip with the program name.
- **Program workout cards fixed:** they now fill the row exactly like
  saved-workout cards (width bug from phone QA).
- **Program tab always lands on the program home:** tapping the tab clears
  any program-workout sub-page (a dirty program edit still asks first).

## v0.99v

- **Program edit gets a back button + discard-changes modal:** the title-bar
  chevron now shows while editing a program; backing out with unsaved edits
  asks first.
- **Program workouts look like saved workouts:** the list is now chevron cards
  (name, exercise count), and tapping one opens its own page — stats, muscle
  map, Start workout on top, Edit, delete — mirroring the saved-workout page.
- **One builder for everything:** Edit on a saved workout or a program workout
  opens the creation page in edit mode (pre-filled, saves in place). Exercise
  adds inside a program-workout edit default to the program's rep range.
- **Saved-workout page reworked:** Start workout moved to the top; bottom row
  is now Edit + Duplicate; Archive is a dashed button; built-in templates show
  Edit as disabled (duplicate one to customize it).
- **Dashed "+ Add saved workout" on the program page:** pulls an existing
  saved workout into the program as a new workout, copying its exercises.

## v0.99u

- **"No focus" pill removed:** tapping the selected focus pill again clears it,
  in the live editor and the saved-workout builder.
- **Plus buttons unified:** plain (non-green) circular buttons with a perfectly
  centered SVG plus, in the live editor, saved-workout builder, and program
  workouts.
- **Live chip → title dot:** tapping the "Live" pill flies its dot to a pulsing
  dot next to the Workout title (respecting reduced-motion); the Workout tab's
  duplicate dot badge is gone (tint kept).
- **Autosave note deleted:** the "Changes are saved on this device" line is
  gone — saving stays silent and instant.
- **Saved-workout builder finished:** focus actually applies, Configure opens a
  target-range dialog, Save workout persists and opens the saved page, supersets
  and reordering work through the same shared dialogs as the live editor, and
  options gain the progression summary, exercise tags, and Apply-set-1-to-all.
- **Saved-workout page enriched:** focus, set totals, muscle map + muscle pills,
  and a cleaner Start / Edit / Rename / Archive / delete button stack.
- **Exercise info Back fixed:** Back from an exercise opened inside the
  builder/editor/saved-workout page returns there, not to the workout start
  screen.

## v0.99t

- **"Live" chip placement fixed:** it now truly renders top-right next to the
  settings gear (v0.99s's cluster collapsed left), and its visibility refreshes
  on every tab switch and on opening Settings.

## v0.99s

- **Saved-workout builder rework:** the builder now mirrors the live editor
  exactly (same cards, set rows, notes, options — no checkboxes), marked with
  a "Saved workout" pill. Drafts autosave: backing out keeps the draft on a
  dashed "Saved workout draft" card; only Discard deletes it. "+ Add saved
  workout" with a draft open asks to keep or delete it.
- **"Live" chip** moved next to the settings gear (was top-left "Live workout").
- **Back buttons live in the title bar** on every workout sub-screen.

## v0.99r

- **Live-workout chip:** a pulsing "Live workout" chip in the top-left header
  appears whenever a session is live and you're not on the live editor page;
  tapping it jumps straight back into the session.

## v0.99q

- **MacroFactor .xlsx import fixed:** the spreadsheet reader could stall
  forever on "Reading spreadsheet…" in some browsers (it wrote all compressed
  data before reading any decompressed output, which some browsers never
  finish). It now reads and writes at the same time, with a timeout so a stall
  surfaces as an error instead of hanging.

## v0.99p

- **Saved-workout builder page:** the hero's "New saved workout" button is
  gone; a dashed "+ Add saved workout" under the saved list opens a full-page
  creator (name, focus pills, per-set targets, Discard / Save workout, no
  checkboxes). The saved list stays visible under the Continue card during a
  live session.
- **"Workout in progress" conflict is now one reusable modal,** now also guarding
  program-tab starts instead of silently overwriting.


## v0.99o

- **MacroFactor imports:** the importer (Settings → Data, and first-run
  onboarding) now accepts two MacroFactor formats. A MacroFactor
  program/workout spreadsheet (.xlsx) imports as **saved workouts** — rep
  ranges become progression targets, RIR becomes set RPE, warmup sets become
  Warmup tags. A MacroFactor **workout-history CSV** (one row per set)
  imports as completed history like Hevy exports do. The old "MacroFactor
  can't be imported" note only ever applied to their bulk data export.

## v0.9998

- **#93 fixed (the checkbox/red-rail bug):** tapping a set's checkbox no longer
  reveals the red delete rail behind it. Root cause was CSS, not gestures —
  `.log-set.is-complete { background: transparent; }` made checked rows
  see-through, exposing the rail underneath. Checked swipe rows now keep an
  opaque background. Also hardened the gesture code: checkbox clicks
  unconditionally clear swipe state, and checked rows refuse the drag.

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

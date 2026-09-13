# Major releases

Newest first. Only user-facing milestones.

## v1.032 (2026-09-13)
Easy-win UX batch (user):
- #313: the top-bar "Workout" title is now always dead-center — the live-session dot used to sit in the layout flow and nudge the title left of center on the live workout screen.
- #308: the volume-per-session bar chart no longer shows the day ordinal ("Sep 2 (2)") — same plain session labels as the heaviest-set chart (#249).
- #309: the 1RM / Heaviest toggle now sits on the chart's own header line ("Estimated 1RM" / "Heaviest weight"), right-justified, instead of up in the section head.
- #310: saved-workout cards get their corners back — same iOS wrapper fix the program cards received.
- #311: the logs list count note shows just the count for the period ("7 sessions"), never "7 of 24 sessions".
- #312: adding a saved workout to a program no longer shows it twice in the saved list — the template card already carries the program chip, so the program copy doesn't render as a second card.

## v1.031 (2026-09-13)
Phone QA follow-ups:
- #254: the Continue-program card's shadow also follows the Rosé accent — the last element still glowing blue.
- #305: signing out now actually signs out — local workout data is wiped from the device (the cloud copy comes back on the next sign-in).
- #244: share modal per the user's pick — no copy on the share screen, no Done button (the × closes it), two centered buttons; the sign-in prompt reads "Sharing needs an account. It’s free to sign up."
- #232: the "clearing the search" link is now plain text (regular color, not bold, not underlined); clearing scrolls the list into view instead of jumping; filter "Clear all" drops the modal, then scrolls.
- #238: the filter dialog's PROGRAM chip row now has breathing room below the muscle chips.
- Signed-out share landings show a clean first-run header — just the Start button, no bookmark ribbon, no ×.
- #306: boot no longer pre-renders the Stats tab (it renders on first visit instead).
Fixes found in the v1.029 browser QA pass:
- #295: the program form's "% of 1RM" row no longer flashes visible on first load with RPE-based selected.
- #254: the Continue-program card's halo around the card also follows the Rosé accent (pink) under the Rosé theme.
- #301: the completed-workout summary card now reads "1 exercise" / "1 completed set" for a single exercise/set.
- #283: the exercise Configure dialog now rejects an inverted range (e.g. Min sec 90 / Max sec 60) with an error instead of saving it.

## v1.029 (2026-09-12)
Easy-win batch 2:
- #249: the heaviest-weight chart's labels no longer show the day ordinal in parentheses.
- #238: removed the duplicative Less/More heatmap legend.
- #254: the Continue-program card's border/glow follows the Rosé accent (pink) under the Rosé theme.
- #234: numeric set inputs have a light, theme-matched caret again.
- #232: "clearing the search" in the saved-workouts empty state is now a tappable link that clears the search and filters.
- #295: the program form's "% of 1RM" row and help text show only for the %1RM scheme; the saved percent value now loads into the field.
- #301: singular "1 set" in recent workouts (also fixed in muscle-stat pills, exercise stats, and the continue-workout card).
- #302: timed-only workout summaries show total time instead of a meaningless "total volume: 0 lb".
- #303: cold-opening a share link keeps the /s/<slug> deep link in the address bar.

## v1.028 (2026-09-12)
- #296: opening a shared workout link now lands directly on the share landing (with a loading state) instead of flashing the home tab first.
- #297: the share landing's header start control is a green Start button, not a bare play icon.

## v1.027 (2026-09-12)
Batch 1 of post-v1.1 fixes (14 small, safe changes):
- #269: the completed-workout view's Start button now asks first when a workout is in progress (it used to silently replace the live draft).
- #264: the share sign-in cooldown timer no longer leaks if the dialog is dismissed with Esc.
- #268: sets with no RPE recorded (legacy/imported) no longer trip the review-sets check — RPE is optional.
- #271: the saved-workouts empty state now names the real button ("Save as template on a completed workout").
- #272: deleting an exercise no longer leaves a stale superset tag behind.
- #273: Home's recent workouts are sorted by recency, matching the Logs list.
- #275: finishing an edit from the Logs list returns to the Logs list, not the Workout page.
- #283: time-based rules can't be saved with Min sec above Max sec anymore.
- #292: old sync delete-records are pruned after 90 days.
- #260: saved-workout rows can be swiped to delete (with the usual confirmation).
- #261: already in place — the saved-workout page has Share to the left of Start.
- #266: the PR toast fires once per exercise per workout, not once per set.
- #270: the inline set-delete × now asks for confirmation (the swipe delete stays instant).
- #285: suggestion cards no longer show a "0 sec" old target for exercises just flipped to time tracking.

## v1.026 (2026-09-12)
- #242 (corrected): a completed set's checkbox is tappable again — tapping it un-checks (uncompletes) the set. The set's other fields (weight, reps, RPE) stay frozen while it is complete.

## v1.025 (2026-09-12)
- #240: after "Save as template" on a completed workout, the completed view's button now becomes "Start" — it launches the new template right away, and reopening the workout still offers Start instead of saving another copy.
- #242: a completed set's checkbox is no longer tappable — it shows checked and disabled, and the set's inputs stay frozen. To deliberately edit a completed set, tap its set number: that un-checks the set and restores editing.
- #241: the PR toast now uses an opaque gold-tinted background so it stays readable over the app.
- #243: the "Sign in to share" helper note renders in muted text (it was picking up a red accent under the Rosé theme).
- Review sets (follow-up to #199; corrected per phone QA): the dialog always shows three actions when sets need review — primary "Finish anyway", secondary "Delete N unfinished sets" (with the count; deletes the unfinished sets and finishes in one tap), and "Keep editing" as the quiet text link last. The explanation copy is short and plain ("14 sets are missing reps, seconds, or weight.") with no dropped-sets lecture.
- #256: program sharing is temporarily removed — no Share action on the active program or program workouts (programs still can't mint short links). Workout sharing is unchanged.

## v1.024 (2026-09-12)
- #250: progression targets can no longer regress. When a rep-range change rebases the target from estimated 1RM, the suggested weight is floored at the lifter's current top set — a top set above the RPE trigger now yields no card instead of a lighter "New range" suggestion (e.g. 245x1 @ RPE 9 no longer suggests 224 lb).
- Settings → About: removed the "Release notes" link (user direction); version and Last-updated text stay.

## v1.023 (2026-09-12)
- #199: the "Review sets" dialog now explains the situation in a plain sentence ("8 sets are missing reps, seconds, or weight. Finish without them — they'll be dropped, nothing is saved half-filled — or keep editing.") and gives the actions a clear visual hierarchy: exactly one primary button (the recommended finish — the one that destroys nothing entered), the other finishing action as a secondary button, and "Keep editing" as a quiet text link. "Finish anyway" is flagged with danger styling whenever it would drop sets with user-entered values, and its label stays honest when empty sets are mixed in ("drop 3 sets", not "3 incomplete").
- #198: confirmed fixed — deleting a live-workout set no longer flashes, jumps the scroll, or changes exercise expansion (the v1.015 surgical-delete replaced the old full list rebuild; the user's report predated that fix). Added a regression test pinning the delete path so a full re-render can't sneak back in.
- #145 (live-workout variant): tapping "+ Add set" in a live workout no longer jumps the scroll. It was the same full-rebuild mechanism as the old #198 — the new set's row is now appended in place with identical markup and only the new row's listeners wired.

## v1.022 (2026-09-12)
- #211: link-preview metadata, static tier. Shared links now preview with the headline "Cruciferous Greens Workout — 800+ exercises, free forever" (matching the approved share-card copy) and the approved home share card image at an absolute prod URL; a `<meta name="description">` was added in sync with og:description. Per-share workout/program names still need a server piece — tracked separately for after prod.

## v1.021 (2026-09-12)
- #222: the Rosé theme works again. A leftover stray `}` from an earlier cleanup was silently killing the whole rose palette — tapping Rosé now turns the app's accents rose as intended.
- #218: live-workout set inputs now render their values bold in the exercise-name shade, and the blinking text caret is gone from the numeric weight/reps/RPE fields. Placeholders stay light.
- #224: the inline sign-in form in the "Sign in to share" modal has breathing room — the "Email me a code" / "Sign in" pills no longer sit jammed against the fields above them.
- #225: the share-info step now leads with "Copy link" (primary), then "Share…" with the share icon, then "Done" as a quiet single-line text link.
- #226: the "Share link copied." toast now appears above the share modal instead of hiding underneath it.

## v1.020 (2026-09-12)
- #215: the "Sign in to share" prompt is now a self-contained flow inside one modal — no more trip to Settings. "Sign in" is the first, primary button; tapping it reveals the sign-in form right in the modal (email field + "Email me a code", reusing the Settings card's magic-link/OTP logic), including the code step. Once signed in, the modal mints the share (server short link first, long-link fallback) and shows the link with Copy link / Share… / Done — all without leaving the modal. Dismissing early mints nothing; sign-in errors show inline with a retry.

## v1.019 (2026-09-12)
- #210: saved workouts can now tag sets. In the saved-workout editor, tapping a set number opens the tag popup (warmup, dropset, custom tags, etc.), tagged sets get the same accent as live workouts, tags persist with the template, and starting the workout carries them into the live sets. Deleting a global tag also removes it from saved templates.
- #211: link-preview metadata fixed (static). Homepage shares now preview with the "Cruciferous Greens" headline, the approved share card image, and a proper description on iMessage/X/etc. Dynamic per-share workout/program names still need a server piece — tracked separately.
- #212/#213/#214: share landings always open as a full page (no modal), even while a live workout draft is open — the draft stays intact underneath and is restored on dismiss. New layout per user feedback: compact bookmark (save) + play (start) icon buttons sit in the header next to the ×, one tap away without scrolling; the full descriptive buttons live at the bottom of the landing in the approved pattern — big primary pill + green text link + quiet grey note. Signed-in workout landing: "Add to my library" leads, "or start the workout" secondary; signed-out: "Start workout" leads, "or just save it to my library" secondary; program landing: "Add to my library" only, with a note that programs open per-workout. The corner primary pill is gone.
- #209 follow-up: the delete × on each set row in the saved-workout editor is now danger red (the actual control uses `.builder-x`, not the `.rule-remove` class pinned in v1.018).

## v1.018 (2026-09-12)
- #209: the delete × on each exercise in the saved-workout editor now renders in danger red (color + ring), matching the app's destructive-control convention. Visual only — behavior unchanged.

## v1.017 (2026-09-12)
- #206: the %1RM progression-defaults block in Settings no longer renders garbled — the notched-label CSS was catching every span inside a field, floating the inputs over truncated labels ("LT", "TY DEFAULT", "0 = NO SCHEDULED DELOADS."). The % of 1RM / deload rows now use the same clean label-above-input pattern as the other settings fields, and the notch rule only targets the label. The program-builder's %1RM rows got the same treatment.
- #206 follow-up: "Deload every N weeks" now explains itself — the help reads "E.g. 4 = every 4th week is a deload. 0 = off." (in Settings and the program builder).
- #207: sharing now requires an account. Tapping Share while signed out shows a short "Sign in to share" prompt (Sign in / Not now) instead of minting a link; the Sign in button lands on Settings → Account with the email field focused. Signed-in sharing is unchanged — server short link first, long link fallback. Recipient-side link opening is untouched.
- #207 drive-by: fixed a ReferenceError in the no-deflate share fallback — `SHARE_LEGACY_VERSION` is module-scoped inside share-codec.js and invisible to share.js, so the v1 path broke on browsers without CompressionStream. The version is now inline with a comment.
- Filed, not in this batch: #201 (hide the progress chart until 2+ sessions), #204 (exercise-history layout polish pass).

## v1.016 (2026-09-12)
- #205: in Settings → Progression defaults, tapping a Progression mode pill now shows only that mode's one-paragraph description (the old combined block described all three at once), and swapping descriptions no longer nudges the scroll position.

## v1.015 (2026-09-12)
- #197: saved-workout exercise rows are full-width and uniform — the detail rows no longer shrink-wrap to ragged widths.
- #198: deleting a set mid-workout no longer flashes, jumps the scroll, or changes exercise expansion — only the deleted row is removed; surviving sets are renumbered in place and everything else on the page is untouched.
- #199: the Review-sets dialog now always offers a way out — "Finish anyway" appears whenever any set is invalid (not just when all are empty) and says exactly what it drops; "Delete N empty sets" still only touches fully-empty sets, and exactly one dialog is ever shown. Partial values are dropped, never saved half-filled.
- #200: the exercise Progress card now shows an explicit "1RM | Heaviest" segmented toggle — the headline tap still flips the metric, but the control makes the toggle discoverable.
- #202: removed the "Notes" card from the exercise detail page (per-exercise notes inside workouts are untouched; it may return as a future feature).
- #203: "Similar exercises" now sits below "How to" on the exercise detail page.
- #177 follow-up: any `/s/<segment>` route — malformed, unknown, or corrupt — now shows the friendly invalid-link message instead of silently opening Home.
- Filed, not in this batch: #201 (hide the progress chart until 2+ sessions), #204 (exercise-history layout polish pass).

## v1.014 (2026-09-12)
- Server short links for shares (#177): when signed in, sharing a workout or program now mints a short `https://app.cruciferousgreens.com/s/<slug>` link backed by a new `share_links` table (the SQL migration ships in `supabase/migrations/` and is run separately); signed-out sharing — and any failure — keeps the existing long links, so sharing never breaks. Opening a short link decodes through the same v2 path and lands on the same share preview, and a `404.html` fallback makes `/s/<slug>` work on static hosting.

## v1.013 (2026-09-12)
- New app icon (user-approved): the Ballpark-style icon — diagonal mowed-grass stripes, white banner, cream medallion with the leafy-green mark and a BETA ribbon — now serves as the app icon, apple-touch-icon, and browser favicon (192/512/180 px generated from the approved artwork).
- New home link share card (user-approved): shared links now preview with the branded home card — "Cruciferous Greens · Workout Tracker" with the 800+ exercises / FREE-forever tiles and the anatomical muscle heat map — via absolute prod URLs.

## v1.012 (2026-09-12)
- #187: the logs list now opens over a live workout — the draft keeps running untouched underneath, and backing out (chevron or the Live chip) returns to the editor with the draft intact. Bottom-tab taps still land on the start screen with the Continue card.
- #192: adding an exercise mid-workout no longer snaps the viewport to the new card — the picker restores the exact scroll position from when it opened.
- #194: bodyweight work now lights the muscle map — muscles with no dedicated SVG region (adductors, abductors, middle back, neck) map to the closest region, and blind spots no longer list muscles that got bodyweight sets.
- #195: the At-a-glance Workouts card is now tappable and opens the logs list filtered to the selected period.
- #196: workout home with no program — the "Next in program" card is gone; the blank-workout card becomes the highlighted hero card at the top, a "Create a program" card (›) takes its old slot, and the Repeat last card only appears once there's a completed workout.


## v1.011 (2026-09-12)
- Removed the chevron from the "Logs" top-bar title (user feedback: didn't fit the design and the title-tap is a shortcut, not navigation).


## v1.010

- **Deleting a workout from the logs list keeps you on the logs list** (#188).
  The delete confirmation used to drop you on the workout home screen no
  matter where you started; now it returns to the logs when you came from
  there. Deleting from anywhere else behaves as before.
- **One confirmation when finishing with empty sets** (#189). Tapping Finish
  with empty sets showed the Review-sets dialog, and choosing "Finish and
  delete empty sets" could pop the same dialog up a second time for the sets
  that were left. Now deleting the empties finishes directly when everything
  remaining has valid values — the dialog only reappears if a set still has
  genuinely missing values that need your eyes.

## v1.009

- **Completed sets freeze** — checking a set now locks its weight, reps,
  seconds, RPE, and tags. To change a value, un-check the set first; the
  checkbox and delete stay available. Applying set 1 to all no longer touches
  completed sets.

## v1.008

- **Account buttons fixed** — a build regression had left every account
  control (Email me a code, verify code, sign out, sync now) unwired; boot
  now starts sync again.
- **Cleaner Logs page** — the top header reads "Logs" and the duplicate
  "Workout logs" subheader is gone.
- **Shared links for new users** — opening a shared workout link without an
  account now shows a Start workout action in the corner instead of a dead-end
  ×; already-open links still pop the modal with the open-or-save choice.
- **Smarter workout imports** — generic names like Deadlift, Squat, Bench,
  and OHP map straight to their barbell exercises, and ambiguous names like
  Lateral Raise pick the first database variant instead of asking.
- **Linear progression confirmed** — it stays selectable per program and in
  Settings defaults; RPE double progression remains the default.
- **Quieter empty states** — shorter, friendlier placeholder text across
  Home, the library, saved workouts, exercise history, and programs.

## v1.007

- **Harmonized delete color** — the swipe-to-delete red is now mixed toward
  each theme's accent instead of a flat danger red, so it reads destructive
  without clashing with the theme.
- **Consistent buttons and labels** — buttons now follow three sanctioned
  styles (pill CTAs, 14px rounded dialog/tool buttons, toggles), and tiny
  labels across the app use exactly two sizes, so nothing looks off-scale.
- **Toasts sit higher** — success, error, and PR toasts now float clearly
  above the bottom tab bar instead of hugging it.
- **Bodyweight work lights the muscle map** — sets with no added weight now
  highlight their muscles on the Home and Stats maps (volume totals are
  unchanged; bodyweight volume stays out of the lb counts).
- **Share cards** — shared workout links now show a branded preview card when
  pasted into messages.
- **No more double dot** — tapping the "Live" chip no longer flashes two
  dots while the dot moves to the title.
- **Under-the-hood cleanup** — deleted ~120KB of unused exercise-image data
  and other dead code, shrinking the app.

## v1.006

- **Under-the-hood: code documentation** — every module in the app now carries
  a header describing what it owns and what it depends on, and the tricky
  parts (progression engine, sync merging, share links, imports) got inline
  explanations. There's also a new `docs/ARCHITECTURE.md` one-pager covering
  how the app is layered, how sync merging works, and how builds ship. Nothing
  looks different; this is for the humans who maintain the app.

## v1.005

- **Under-the-hood: automated tests** — the app now carries its own test
  suite (119 checks) covering workout math, progression suggestions, sync
  merging, share links, and data imports. Nothing looks different; it just
  means regressions get caught by the build before they can reach your phone.

## v1.004

- **Tighter copy everywhere** — helper text across the app says the same thing
  in fewer words: rep-range scope, PR empty states, import, share notes, set
  prompts, program session notes, and the delete-all confirm (now one sentence).
- **Error toasts are visible** — error messages now get the red treatment
  instead of looking like a regular toast.
- **Stat cards pluralize correctly** — "1 Workout" and "1 Set" instead of
  "1 Workouts" / "1 Sets".
- **Workout focus options match the RPE style** — square option boxes instead
  of pills, consistent with the RPE threshold picker.
- **The Log title shows it's tappable** — a chevron now marks the title button
  that jumps to the full workout log list.
- **Set rows can't overlap on phone** (#183) — the check + delete buttons get
  a full-width action column when swipe-delete is off, so they never collide.
- **Long exercise names stay on their card** — suggestion cards ellipsize the
  name instead of pushing the kind pill off-screen.
- **Dialog buttons in a consistent order** — safe action first, destructive
  action last (update prompt, focus confirm, review-sets).
- **Program cover shows the real session count** — no more hardcoded "three
  sessions per week".

## v1.003

- **Swap an exercise without losing your sets** (#142) — Exercise options now
  has "Swap exercise": pick a replacement from the library and the set
  structure (counts, entered values, tags) carries over. The new movement
  gets a fresh prescription and its progression suggestions re-run.
- **Finish anyway** (#178) — when every unfinished set is completely blank,
  the review dialog offers "Finish anyway": it drops the empty sets, finishes
  the workout, and marks the log "Finished with unlogged sets." It never
  appears when a set has partial values — those still need a fix, so nothing
  you typed can silently become empty.
- **Add past sessions to a program** (#64) — the add-workout dialog on a
  program now has Saved / Past sessions tabs. Pulling in a past session
  copies its exercises, set counts, rep/time ranges, and progression rules
  (last session's numbers become targets, the way "save as template" already
  worked).
- **Same-day sessions are distinguishable** (#165) — two sessions in one day
  now read "Sep 12" and "Sep 12 (2)" across charts, tooltips, and history.
- **Clearer dumbbell logging** (#146) — dumbbell exercises label the weight
  column TOTAL and show a live "per-hand × 2 = total" readout, so it's
  obvious the number is both dumbbells combined. Entered values are untouched.
- **Tapping exercises takes you somewhere** (#181) — exercise rows in saved
  workouts and program workouts now open the exercise detail page, and Back
  returns you to exactly where you were.
- **New muscles to pick** (#136) — rhomboids and front/side/rear delts (plus
  common aliases) are now selectable muscles for custom exercises, and the
  body heatmap lights up for them.
- **Favorites first in the exercise picker** (#144) — favorites lead the
  browse list, then recents, then everything else; search still ranks by
  relevance.
- **The picker tells you what to do** (#167) — a live hint under the picker
  title reads "Tap to add · N selected", or "Tap an exercise to swap it in"
  when swapping.
- **New exercises don't lose your place** (#143) — adding exercises
  mid-workout now lands you on the newly added card, expanded.
- **Saved workouts open in the right place** (#135) — opening a saved
  workout always lands on the Workout tab first, so the header and tab can
  never disagree about where you are.
- **Program save is explicit** (#173) — program setup says plainly that
  nothing saves until you tap save; the edit heading reads "Edit your active
  program."
- **No ghost suggestions while editing history** (#148) — progression
  suggestions and their explanations stay hidden while you're editing a past
  workout.
- **Share landing cleanup** (#179) — opening a shared link now says what
  happened, with one clear primary action instead of two competing buttons,
  and no dead space under the card.
- **Heatmap hugs its content** (#182) — the muscle heatmap no longer leaves
  a big empty gap before the legend.
- **Bigger delete targets on sets** (#94) — the inline set-delete button is
  now a real 44px tap target that can't overlap the complete checkbox.
- **Calmer card animation** (#88) — exercise cards still expand smoothly but
  collapse instantly; reduced-motion users get the instant toggle both ways.
- **Overflow fix** (#145) — action button rows now wrap instead of spilling
  off the phone screen.

## v1.002

- **Smarter workout imports** — when you import a spreadsheet of workouts,
  the app now recognizes more exercise names on its own (things like
  "Bicep curl" or "Deadlift" map to the right library exercise instead of
  asking you). Anything it isn't sure about, it still asks — and now you
  can point an unmatched exercise at an existing one from your library
  instead of only creating a new custom entry.
- **Skip really skips** — choosing "Skip" for an exercise during import now
  actually leaves it out, even when that exercise shows up in more than one
  workout in the file.

## v1.001

- **%1RM programming is back** — programs and exercises can run on percent
  of 1RM again: set a default percent per program (or per week with the
  optional weekly % wave), a training max per exercise, and each session's
  load is computed from the percent, snapped to plates. When no training
  max is entered, the engine uses your best estimated 1RM from same-zone
  top sets and says so.
- **Scheduled deloads** — programs can schedule a deload every N weeks at
  a chosen intensity, or flag individual weeks in the % wave panel. Deload
  weeks are marked on the program cover and the engine reduces the
  prescription instead of progressing it. The engine still never deloads
  on its own — only weeks you schedule.
- Share links now carry the %1RM settings (scheme, percent, training max)
  so a shared program keeps its programming.

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

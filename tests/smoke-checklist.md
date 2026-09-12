# Browser smoke checklist

The unit harness (`node tests/run.js`) verifies the code; this checklist
verifies the experience. It is run by the parent agent in its browser
session against the QA build (dev → main merge, github.io URL). Per the
standing QA-gate rule, the user's phone tap-through is still required to
close GitHub issues — this checklist never substitutes for it.

## How to fill

For each build under test, add a version section below (copy the template),
work the steps, and mark each `[ ]` → `[x]` (or note the failure). Gate G3
passes only when every box is checked for the current build.

---

## Template (copy per build)

### Build vX.XXX — YYYY-MM-DD — status: pending | complete

- [ ] **1. Boot** — QA build loads with no console errors; dashboard renders; the selected theme applies.
- [ ] **2. Offline log** — airplane mode → log a workout → reload → data intact (localStorage path).
- [ ] **3. Progression card** — on an exercise with real history a suggestion card appears; tapping "apply" fills set hints WITHOUT wiping already-typed values (pins the #67 review finding).
- [ ] **4. Share** — create a link on the QA build → open it in a second tab/incognito → full-screen landing renders → Start / Add-to-library works.
- [ ] **5. CSV import** — Settings → Data → import `tests/fixtures/csv/hevy.csv` → preview shows the mapped rows.
- [ ] **6. Auth** — magic-link request reaches the "check your email" state with no cryptic error (#70 regression area).
- [ ] **7. Service worker** — Settings → About shows the bumped version; an offline reload serves from cache.

Notes / failures:

---

## v1.015 — 2026-09-12 — status: pending

- [ ] **1. Boot** — QA build loads with no console errors; dashboard renders; the selected theme applies.
- [ ] **2. Offline log** — airplane mode → log a workout → reload → data intact (localStorage path).
- [ ] **3. Progression card** — on an exercise with real history a suggestion card appears; tapping "apply" fills set hints WITHOUT wiping already-typed values (pins the #67 review finding).
- [ ] **4. Share** — create a link on the QA build → open it in a second tab/incognito → full-screen landing renders → Start / Add-to-library works.
- [ ] **5. CSV import** — Settings → Data → import `tests/fixtures/csv/hevy.csv` → preview shows the mapped rows.
- [ ] **6. Auth** — magic-link request reaches the "check your email" state with no cryptic error (#70 regression area).
- [ ] **7. Service worker** — Settings → About shows v1.015; an offline reload serves from cache.
- [ ] **8. #197** — open a saved workout → every exercise row spans the full card width, uniform.
- [ ] **9. #198** — live workout: expand an exercise, delete a middle set → no flash, no scroll jump, no other exercise expands/collapses; set numbers renumber 1..N.
- [ ] **10. #199** — finish with partial-invalid sets → Review dialog shows Keep editing + "Finish anyway — drop N incomplete" (+ Delete-empty-sets when empties exist); Finish anyway drops them with a toast and finishes; exactly one dialog.
- [ ] **11. #200** — exercise detail Progress card → visible "1RM | Heaviest" segmented toggle reflects the current metric; tapping it and the headline both flip.
- [ ] **12. #202/#203** — exercise detail: no Notes card; Similar exercises sits below How to.
- [ ] **13. #177** — open `/s/doesnotexist1` (bad slug) → friendly invalid-link toast, no silent Home.

Notes / failures:

---

## v1.005 — 2026-09-12 — status: pending

- [ ] **1. Boot** — QA build loads with no console errors; dashboard renders; the selected theme applies.
- [ ] **2. Offline log** — airplane mode → log a workout → reload → data intact (localStorage path).
- [ ] **3. Progression card** — on an exercise with real history a suggestion card appears; tapping "apply" fills set hints WITHOUT wiping already-typed values (pins the #67 review finding).
- [ ] **4. Share** — create a link on the QA build → open it in a second tab/incognito → full-screen landing renders → Start / Add-to-library works.
- [ ] **5. CSV import** — Settings → Data → import `tests/fixtures/csv/hevy.csv` → preview shows the mapped rows.
- [ ] **6. Auth** — magic-link request reaches the "check your email" state with no cryptic error (#70 regression area).
- [ ] **7. Service worker** — Settings → About shows v1.005; an offline reload serves from cache.

Notes / failures:

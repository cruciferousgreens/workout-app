# Cruciferous Greens — Workout Tracker

Log workouts, track RPE and progression. A mobile-first progressive web app (beta).

- **Live app:** https://app.cruciferousgreens.com
- **Stack:** vanilla JS, no build step, `localStorage` persistence (`workout-app:v1`), service-worker offline support. Accounts are coming later as a separate fork.

## Layout

- `index.html` — app shell, views, and inline SVG assets (Sasha-style anatomical body map)
- `assets/js/*.js` — feature modules, each headed by `/* ===== module: <name>.js ===== */`, loaded in dependency order by the `<script>` tags in `index.html`
- `assets/styles.css` — all styling, organized in commented sections
- `data/exercises-db.js` — bundled exercise database (from [free-exercise-db](https://github.com/yuhonas/free-exercise-db)), normalized by `assets/js/catalog.js`
- `sw.js`, `manifest.webmanifest`, `icon-180.png`, `icon-512.png` — PWA support (copied from `overlay/`)
- `CHANGELOG.md` — user-facing release notes, newest first

## Deploy

`staging/` is the source of truth — edit it directly (never the old artifact export; `split.py` is retired).

```bash
python3 make-sw.py            # regenerate sw.js asset list from staging/
bash post-split.sh            # copy overlay root files into staging/, inject manifest link
python3 ~/workspace/skills/github/bin/gh-push.py cruciferousgreens/workout-app main staging "<msg>" --sync
python3 ~/workspace/skills/github/bin/gh-api.py GET /repos/cruciferousgreens/workout-app/pages/builds/latest  # commit must match, status built
```

Preview first: push `staging` to `cruciferousgreens/workout-app-preview` (no `CNAME` there) and verify on-device before promoting to production.

## Key conventions

- Dumbbell weight is always the **combined total** (both dumbbells); never auto-double.
- Suggested weights are **exact** — no plate snapping. No rest timers, no auto-deload, no mid-workout auto-adjustments.
- Progression suggestions use **real logged history only**, labeled with their basis.
- Sample data is **opt-in** (Settings → Data), clearly labeled, and isolated from the progression engine.
- No AI-generated imagery anywhere — standard emoji / system assets only.

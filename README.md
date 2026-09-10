# Workout Tracker

Log workouts, track RPE and progression. A mobile-first progressive web app.

- **Live app:** https://app.cruciferousgreens.com
- **Stack:** vanilla JS, no build step, `localStorage` persistence (accounts later)

## Layout

- `index.html`, `app.js`, `styles.css`, `strength.js` — app shell and logic
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA support
- `data/exercises.json` — exercise database
- `data/EXERCISE_DB_PIN.txt` — pinned spec for the exercise DB

## Deploy

Pushed to `main` → GitHub Pages serves the repo root at the custom domain.

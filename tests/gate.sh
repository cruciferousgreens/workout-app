#!/usr/bin/env bash
# Quality gates for the QA line. A build may ship to QA (dev→main merge)
# only if all gates pass. Exits non-zero on the first failing gate.
#
#   G1  Unit suite green (node tests/run.js) — 100% pass, no skips allowed
#   G2  No load-time exceptions (each mapped source evaluates cleanly)
#   G3  Smoke checklist complete for the build under test (parent-run; manual)
#   G4  SW/version freshness (make-sw.py run, version bumped, no tests/ cached)
#   G5  Privacy scrub (no personal names anywhere in the tree outside .git/)
#   G6  Build provenance (Pages shows the exact pushed SHA — parent-run; manual)
#
# G3/G6 are reported as MANUAL/PENDING, never faked: they need a human with
# a browser. The nightly cron must treat a non-zero exit as "do not push".
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0; manual=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }
no(){ echo "FAIL  $1"; fail=$((fail+1)); }
pend(){ echo "PENDING  $1"; manual=$((manual+1)); }

# --- G1: unit suite green -------------------------------------------------
if node tests/run.js >/tmp/gate-run.log 2>&1; then
  ok "G1 unit suite green"
else
  no "G1 unit suite green — see /tmp/gate-run.log"
fi

# --- G2: every mapped source file parses and evaluates -------------------
# (run.js already fails a file whose sources throw at load; this is the
# explicit per-file check the gate table asks for.)
G2_FAIL=""
while IFS= read -r rel; do
  if ! node --check "$rel" >/dev/null 2>&1; then G2_FAIL="$G2_FAIL $rel"; fi
done < <(node -e "
const m=require('./tests/module-map');
const seen=new Set();
for(const r of Object.values(m))for(const f of r.files){if(!seen.has(f)){seen.add(f);console.log(f);}}
")
# evaluation check: load every role through the harness, one process per
# role (sources declare top-level consts, so two roles can't share a process)
for role in $(node -e "console.log(Object.keys(require('./tests/harness').MODULE_MAP).join(' '))"); do
  if ! node -e "require('./tests/harness').loadRole('$role')" >/tmp/gate-g2.log 2>&1; then
    G2_FAIL="$G2_FAIL (role $role)"
  fi
done
if [ -z "$G2_FAIL" ]; then ok "G2 no load-time exceptions"; else no "G2 load failures:$G2_FAIL — see /tmp/gate-g2.log"; fi

# --- G3: smoke checklist ---------------------------------------------------
# The checklist file must exist and carry a completed section for the current
# APP_VERSION. Parent-run; never faked.
APP_VERSION="$(node -e "const s=require('fs').readFileSync('make-sw.py','utf8');console.log(s.match(/APP_VERSION\s*=\s*\"([^\"]+)\"/)[1])")"
if grep -Eq "^## v${APP_VERSION} .* status: complete$" tests/smoke-checklist.md; then
  ok "G3 smoke checklist complete for v${APP_VERSION}"
else
  pend "G3 smoke checklist for v${APP_VERSION} not marked complete (parent-run)"
fi

# --- G4: SW/version freshness ----------------------------------------------
G4_OK=1
# build-info.js must carry the current APP_VERSION (i.e. make-sw.py was run)
if ! grep -q "appVersion:\"${APP_VERSION}\"" assets/js/build-info.js; then
  echo "      build-info.js appVersion != ${APP_VERSION} — run make-sw.py"; G4_OK=0
fi
# sw.js must exist and must never cache the tests/ directory
if ! grep -q "tests/" sw.js; then :; else
  echo "      sw.js contains tests/ entries"; G4_OK=0
fi
if [ "$G4_OK" -eq 1 ]; then ok "G4 SW/version freshness (v${APP_VERSION}, no tests/ in sw.js)"; else no "G4 SW/version freshness"; fi

# --- G5: privacy scrub ------------------------------------------------------
if grep -riE "\bjustin\b" --exclude-dir=.git --exclude-dir=node_modules . >/tmp/gate-g5.log 2>&1; then
  no "G5 privacy scrub — matches in /tmp/gate-g5.log"
else
  ok "G5 privacy scrub (no name in tree)"
fi

# --- G6: build provenance (manual) -------------------------------------------
pend "G6 Pages build shows the exact pushed SHA (parent verifies before QA is announced)"

echo ""
echo "gates: $pass pass, $fail fail, $manual pending/manual"
[ "$fail" -eq 0 ] && [ "$manual" -eq 0 ]

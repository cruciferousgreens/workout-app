/* ===== module: app-updates.js ===== */
    /** In-app update checks (user 2026-09-11). iOS home-screen PWAs resumed
        from the app switcher fire no navigation, so the browser can go days
        without discovering a new service worker. We poll explicitly instead:
        a manual "Check for updates" button in Settings → About, plus a quiet
        auto-check whenever the app is foregrounded. Never force-reloads — the
        user confirms, and a live workout draft always defers the prompt. */
        /* Module map (v1.006) — Key: armUpdateWatch(), maybeAutoUpdateCheck(), offerUpdateRefresh(), waitForWorkerState(). Depends on: navigator.serviceWorker only; no app-module deps. */

    const AUTO_UPDATE_CHECK_MS = 10 * 60 * 1000;
    const UPDATE_ACTIVATION_TIMEOUT_MS = 20000;
    let lastAutoUpdateCheck = 0;
    let pendingUpdateWorker = null;
    let dismissedUpdateWorker = null;
    /* #99 A18: the generated SW calls skipWaiting() immediately, so a fast
       worker is already `active` (and claimed) by the time a check looks at
       reg.installing/reg.waiting — both are empty and the check wrongly
       reports "latest". We retain the installing worker through its lifecycle
       via updatefound, and treat a mid-session controller flip as an update
       (this page still runs the old code). */
    let trackedUpdateWorker = null;
    const swApi = ('serviceWorker' in navigator) ? navigator.serviceWorker : null;
    const initialSWController = swApi ? swApi.controller : null;
    function draftIsLive() {
      return typeof workoutState !== 'undefined' && !!workoutState.draft;
    }
    function offerUpdateRefresh(worker) {
      if (worker) pendingUpdateWorker = worker;
      if (dismissedUpdateWorker && worker && dismissedUpdateWorker === worker) return; /* snoozed with "Later" */
      if (draftIsLive()) return; /* a live workout is never interrupted — the offer surfaces on a later check */
      const dlg = $('#updateAvailableDialog');
      if (dlg && !dlg.open) dlg.showModal();
    }
    function armUpdateWatch(reg) {
      if (!reg || reg._cgUpdateWatchArmed) return;
      reg._cgUpdateWatchArmed = true;
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        trackedUpdateWorker = worker; /* retain through the lifecycle */
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') offerUpdateRefresh(worker);
          else if (worker.state === 'redundant' && trackedUpdateWorker === worker) trackedUpdateWorker = null;
        });
      });
    }
    if (swApi) {
      /* A new controller mid-session means an update activated and claimed
         this page (skipWaiting + clients.claim in the SW). The initial claim
         on first install runs the code this page already loaded — not an update. */
      swApi.addEventListener('controllerchange', () => {
        const c = swApi.controller;
        if (initialSWController && c && c !== initialSWController) offerUpdateRefresh(c);
      });
    }

    /** Resolve with the worker's state once it reaches `target` (or goes
        redundant), or with its current state on timeout. */
    function waitForWorkerState(worker, target, timeoutMs) {
      return new Promise((resolve) => {
        if (!worker || worker.state === target || worker.state === 'redundant') {
          resolve(worker ? worker.state : 'none');
          return;
        }
        const timer = setTimeout(() => {
          worker.removeEventListener('statechange', onChange);
          resolve(worker.state);
        }, timeoutMs);
        function onChange() {
          if (worker.state === target || worker.state === 'redundant') {
            clearTimeout(timer);
            worker.removeEventListener('statechange', onChange);
            resolve(worker.state);
          }
        }
        worker.addEventListener('statechange', onChange);
      });
    }

    async function checkForAppUpdate({ manual = false } = {}) {
      try {
        if (!('serviceWorker' in navigator)) {
          if (manual) showToast('Updates are handled by your browser.');
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          if (manual) showToast("Couldn't check for updates — try again in a moment.");
          return;
        }
        /* Force the check now instead of waiting for the next navigation.
           The authoritative signal is reg.installing / reg.waiting — the
           browser already compared sw.js for us. */
        armUpdateWatch(reg);
        const beforeController = swApi ? swApi.controller : null;
        try { await reg.update(); } catch (_) { /* offline or deploy in flight */ }
        await new Promise((r) => setTimeout(r, 0));
        /* #99 A18: a fast worker already activated (and claimed) during the
           check — reg.installing/reg.waiting are empty, but the controller
           flip proves new code is ready while this page still runs old code. */
        const afterController = swApi ? swApi.controller : null;
        if (beforeController && afterController && afterController !== beforeController) {
          offerUpdateRefresh(afterController);
          return;
        }
        const worker = reg.installing || reg.waiting ||
          ((trackedUpdateWorker && trackedUpdateWorker.state !== 'redundant' && trackedUpdateWorker.state !== 'activated') ? trackedUpdateWorker : null);
        if (!worker) {
          /* An offer deferred earlier (live draft) still surfaces on a later
             check once the draft is gone. */
          if (pendingUpdateWorker && !draftIsLive()) { offerUpdateRefresh(pendingUpdateWorker); return; }
          if (manual) showToast("You're on the latest version.");
          return;
        }
        /* Don't offer Refresh until the new worker is actually activated —
           reloading while it's still installing renders the old version. */
        const state = await waitForWorkerState(worker, 'activated', UPDATE_ACTIVATION_TIMEOUT_MS);
        if (state !== 'activated') {
          if (manual) showToast(state === 'redundant'
            ? "Update found but couldn't download — try again."
            : 'Still downloading the update — try again in a moment.');
          return;
        }
        offerUpdateRefresh(worker);
        return;
      } catch (_) {
        if (manual) showToast("Couldn't check for updates — you're offline?");
      }
    }

    function maybeAutoUpdateCheck() {
      const now = Date.now();
      if (now - lastAutoUpdateCheck < AUTO_UPDATE_CHECK_MS) return;
      lastAutoUpdateCheck = now;
      /* A live workout is never interrupted — the next check fires after the
         draft closes. Manual checks always show immediately. */
      if (typeof workoutState !== 'undefined' && workoutState.draft) return;
      checkForAppUpdate({ manual: false });
    }

    $('#checkUpdatesButton')?.addEventListener('click', () => checkForAppUpdate({ manual: true }));
    $('#updateRefreshNow')?.addEventListener('click', () => {
      $('#updateAvailableDialog')?.close();
      /* skipWaiting() is in the install handler and clients.claim() in
         activate, so the reloaded page is controlled by the new worker. */
      location.reload();
    });
    $('#updateLater')?.addEventListener('click', () => {
      dismissedUpdateWorker = pendingUpdateWorker;
      pendingUpdateWorker = null;
      $('#updateAvailableDialog')?.close();
    });
    $('#closeUpdateAvailable')?.addEventListener('click', () => {
      dismissedUpdateWorker = pendingUpdateWorker;
      pendingUpdateWorker = null;
      $('#updateAvailableDialog')?.close();
    });

    document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeAutoUpdateCheck(); });
    window.addEventListener('focus', () => maybeAutoUpdateCheck());
    window.addEventListener('online', () => maybeAutoUpdateCheck());
    window.addEventListener('load', () => setTimeout(maybeAutoUpdateCheck, 5000));

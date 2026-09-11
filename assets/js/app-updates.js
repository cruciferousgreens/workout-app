/* ===== module: app-updates.js ===== */
    /** In-app update checks (user 2026-09-11). iOS home-screen PWAs resumed
        from the app switcher fire no navigation, so the browser can go days
        without discovering a new service worker. We poll explicitly instead:
        a manual "Check for updates" button in Settings → About, plus a quiet
        auto-check whenever the app is foregrounded. Never force-reloads — the
        user confirms, and a live workout draft always defers the prompt. */

    const AUTO_UPDATE_CHECK_MS = 10 * 60 * 1000;
    const UPDATE_ACTIVATION_TIMEOUT_MS = 20000;
    let lastAutoUpdateCheck = 0;
    let pendingUpdateWorker = null;
    let dismissedUpdateWorker = null;

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
        try { await reg.update(); } catch (_) { /* offline or deploy in flight */ }
        await new Promise((r) => setTimeout(r, 0));
        const worker = reg.installing || reg.waiting;
        if (!worker) {
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
        if (dismissedUpdateWorker === worker) return; /* snoozed with "Later" */
        pendingUpdateWorker = worker;
        const dlg = $('#updateAvailableDialog');
        if (dlg && !dlg.open) dlg.showModal();
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

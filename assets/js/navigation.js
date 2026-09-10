
    /** Coordinates view routing, bottom navigation state, and per-view scroll restoration. */
    function hideAllViews() {
      $('#dashboardView').classList.remove('active');
      $('#libraryView').classList.add('hidden');
      $('#detailView').classList.remove('active');
      $('#workoutView').classList.remove('active');
      $('#programView').classList.remove('active');
      $('#statsView').classList.remove('active');
      $('#settingsView').classList.remove('active');
    }
    function showDashboard(push = true) {
      rememberScroll(); state.activeView = 'dashboard'; hideAllViews();
      $('#dashboardView').classList.add('active'); setActiveNav('dashboard'); renderDashboard(); restoreScroll('dashboard');
      if (push) history.pushState({view:'dashboard'}, '', '#dashboard');
    }
    function showLibrary(push = true) {
      rememberScroll(); state.selected = null; state.activeView = 'library'; hideAllViews();
      $('#libraryView').classList.remove('hidden'); setActiveNav('library'); restoreScroll('library');
      if (push) history.pushState({view:'library'}, '', '#library');
    }
    function showWorkouts(push = true) {
      rememberScroll(); state.selected = null; state.activeView = 'workout'; hideAllViews();
      $('#workoutView').classList.add('active'); setActiveNav('workout'); renderWorkoutScreen(); restoreScroll('workout');
      if (push) history.pushState({view:'workout'}, '', '#workout');
    }
    function showProgram(push = true) {
      rememberScroll(); state.selected = null; state.activeView = 'program'; hideAllViews();
      $('#programView').classList.add('active'); setActiveNav('program'); renderProgram(); restoreScroll('program');
      if (push) history.pushState({view:'program'}, '', '#program');
    }
    function showStats(push = true) {
      rememberScroll(); state.selected = null; state.activeView = 'stats'; hideAllViews();
      $('#statsView').classList.add('active'); setActiveNav('stats'); renderStats(); restoreScroll('stats');
      if (push) history.pushState({view:'stats'}, '', '#stats');
    }
    function showSettings(push = true) {
      let from = state.activeView;
      if (from === 'detail') {
        const ret = state.exerciseDetailReturn && state.exerciseDetailReturn.view;
        from = { library: 'library', workout: 'workout', program: 'program', dashboard: 'dashboard', stats: 'stats', 'completed-workout': 'workout' }[ret] || 'dashboard';
      }
      rememberScroll(); state.selected = null; state.activeView = 'settings'; hideAllViews();
      if (from !== 'settings' && TOP_BAR_TITLES[from]) state.settingsReturn = from;
      $('#settingsView').classList.add('active'); setActiveNav('settings'); renderSettings(); restoreScroll('settings');
      if (push) history.pushState({view:'settings'}, '', '#settings');
    }
    /** Bottom-tab taps always land at the top of the destination page. In-flow
     *  back/forward (popstate) keeps per-view scroll restoration; only explicit
     *  tab taps reset. Tapping the already-active tab also returns to top. */
    function goTab(show, view) { show(); state.scroll[view] = 0; window.scrollTo({top:0, behavior:'auto'}); }
    /** Tints the Workout tab and adds a dot badge while a draft is live. Called on every
     *  render of the workout screen, after finish/discard, and once at boot (restored drafts). */
    function updateLiveWorkoutIndicator() {
      const nav = $('#workoutsNav'); if (!nav) return;
      const live = !!workoutState.draft;
      nav.classList.toggle('has-live-draft', live);
      nav.setAttribute('aria-label', live ? 'Workout — session in progress' : 'Workout');
    }

    
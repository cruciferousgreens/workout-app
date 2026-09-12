
/* ===== module: navigation.js ===== */
    /** Coordinates view routing, bottom navigation state, and per-view scroll restoration. */
    /* Module map (v1.006) — Key: goTab(), showDashboard()/showWorkouts()/showProgram()/showStats()/showLibrary()/showSettings(), hideAllViews(), makeReturnRoute(). Depends on: the render functions of the feature modules it routes to; state.scroll for scroll restoration. */
    function hideAllViews() {
      /* iOS Safari fires an unpredictable scroll when the focused element's
         view is hidden mid-session (user 2026-09-12: "crazy weird jump"
         tapping Home from the workout logs — the same focus-drop scroll
         documented for the dashboard period tabs on 2026-09-10). Blur first
         so no focus-drop scroll can fire; also dismisses the keyboard. */
      const focused=document.activeElement;
      if(focused&&focused!==document.body)focused.blur();
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
    function showWorkouts(push = true, keepSub = false) {
      rememberScroll(); state.selected = null; state.activeView = 'workout'; hideAllViews();
      /* #129: tab/back navigation lands on the start screen (with the Continue
         card when a session is live), never straight into the editor. keepSub
         (user 2026-09-12) preserves the sub-screen flags the caller already
         restored — exercise-detail Back returning to the builder/editor. */
      if (!keepSub) {
        state.workoutEditorOpen = false; state.savedWorkoutId = null;
        state.sharePreview = null;
        /* Builder (user 2026-09-11): leaving the page keeps the in-progress
           builder data — the start screen offers a continue-building card. */
        state.builderOpen = false;
        /* Systematic defect #3 (user 2026-09-12): a tab switch always lands on
           the tab home — collapse the log list and dismiss any completed
           review instead of resurrecting a stale sub-screen. */
        state.workoutHistoryOpen = false;
        $('#workoutComplete').hidden = true;
      }
      $('#workoutView').classList.add('active');
      /* Logs are their own page (user 2026-09-12): the list lights no tab. */
      setActiveNav('workout', state.workoutHistoryOpen ? null : 'workout');
      renderWorkoutScreen(); restoreScroll('workout');
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
      /* Whether this visit pushed a history entry: only then can Back truly pop it.
       * A directly-opened (deep-linked) Settings has no entry to pop, so Back must
       * navigate explicitly to the recorded return tab instead of leaving the app. */
      state.settingsPushed = !!push;
      $('#settingsView').classList.add('active'); setActiveNav('settings'); renderSettings(); restoreScroll('settings');
      updateLiveWorkoutIndicator();
      if (push) history.pushState({view:'settings'}, '', '#settings');
    }
    /** Back from Settings honors the recorded return tab. When this visit pushed a
     *  history entry, pop it for real; otherwise navigate explicitly to the return
     *  tab (safe in-app fallback instead of ejecting from the app). */
    function backFromSettings() {
      if (state.settingsPushed) { history.back(); return; }
      const show = { dashboard: showDashboard, library: showLibrary, workout: showWorkouts, program: showProgram, stats: showStats }[state.settingsReturn];
      if (show) show(false); else showDashboard(false);
    }
    /** Bottom-tab taps always land at the top of the destination page and never
     *  restore a saved scroll position (#127: the old restore-then-zero order let
     *  the stale restore win "sometimes" on iOS). In-flow back/forward
     *  (popstate) keeps per-view scroll restoration; only explicit tab taps
     *  reset. Tapping the already-active tab also returns to top. */
    function goTab(show) {
      /* Clear the whole scroll map BEFORE show(): showX() calls restoreScroll(),
         which must land at 0 — no stale position may survive a tab switch. */
      state.scroll = {};
      show();
      window.scrollTo({top:0, behavior:'auto'});
      /* The header Live chip must reflect the new view: a live session hides it
         on the editor page and shows it everywhere else (user 2026-09-11). */
      updateLiveWorkoutIndicator();
    }
    /* ===== Tab-home / one-level Back (efficiency pass 2026-09-12) =====
       Tab tap = go home: every sub-screen on that tab collapses to the tab's
       start page. Back = one level up: only the topmost sub-screen pops,
       restoring the prior nested context (user 2026-09-12). */
    /* One-level Back on the Workout tab: pops the topmost sub-screen only.
       Returns true when something was popped, false when already home. */
    function collapseWorkoutSubScreen(){
      /* Share preview (user 2026-09-12): backs out to the workout start
         screen, clearing the share hash. */
      if(state.sharePreview){state.sharePreview=null;clearShareHash();renderWorkoutScreen();window.scrollTo({top:0});return true;}
      if(state.workoutEditorOpen&&workoutState.draft){state.workoutEditorOpen=false;renderWorkoutScreen();window.scrollTo({top:0});return true;}
      if(state.builderOpen){closeBuilderToReturn(false);return true;}
      if(state.savedWorkoutId){state.savedWorkoutId=null;renderWorkoutScreen();window.scrollTo({top:0});return true;}
      if(state.workoutHistoryOpen){hideWorkoutHistory();return true;}
      if(!$('#workoutComplete').hidden){$('#workoutComplete').hidden=true;renderWorkoutScreen();window.scrollTo({top:0});return true;}
      return false;
    }
    /* Workout tab tap (#129): lands on the start screen (with the Continue
       card when a session is live), never straight into the editor. The draft
       is autosaved, never disturbed. */
    function collapseWorkoutToStart(){
      /* A completed review dismisses first (the common post-finish tap);
         otherwise the live editor drops to its Continue card. */
      if(!workoutState.draft&&!$('#workoutComplete').hidden){$('#workoutComplete').hidden=true;renderWorkoutScreen();window.scrollTo({top:0});return;}
      /* A tab tap always lands on the Workout start screen — never follows
         builderReturn back to Program (that restore is Back's job). The
         builder draft is autosaved, never disturbed. */
      if(state.builderOpen){state.builderOpen=false;renderWorkoutScreen();window.scrollTo({top:0});return;}
      if(collapseWorkoutSubScreen())return;
      /* Already home: just reset scroll. */
      state.scroll[scrollKeyFor('workout')]=0;window.scrollTo({top:0});
    }
    /* Program tab (user 2026-09-12): always lands on the program home
       (cover), never the last sub-page seen — the icon going active has to
       mean a fresh home, not a stale nested page. A dirty program edit still
       asks before discarding. */
    function showProgramHome(){
      state.programWorkoutUid=null;
      if($('#createProgram')?.dataset.editing==='true'){requestCancelProgramEdit();return;}
      goTab(showProgram);
    }
    /* #99 B11: one vocabulary for routes. View/sub/return strings were
       scattered magic literals across navigation.js, exercise-detail.js,
       workout-history.js, workout-editor.js, dashboard-stats.js, programs.js,
       utilities.js, and app-bootstrap.js — renaming a route meant synchronized
       edits in all of them. The values are frozen so a typo fails loudly at
       the use site instead of silently creating a new route. DETAIL_RETURN
       values are serialized into history.state, so they stay plain strings. */
    const ROUTES=Object.freeze({
      VIEW:Object.freeze({DASHBOARD:'dashboard',LIBRARY:'library',WORKOUT:'workout',PROGRAM:'program',STATS:'stats',SETTINGS:'settings',DETAIL:'detail'}),
      WORKOUT_SUB:Object.freeze({HISTORY:'history',COMPLETE:'complete',BUILDER:'builder',EDITOR:'editor',SAVED:'saved'}),
      DETAIL_RETURN:Object.freeze({DASHBOARD:'dashboard',PROGRAM:'program',LIBRARY:'library',HISTORY:'history',EXERCISE_DETAIL:'exercise-detail',WORKOUT:'workout'})
    });
    /* #99 B11: one return-route shape. A return route is {view, ...extra} —
       e.g. {view:'workout', sub:'editor', savedWorkoutId}. The completed-
       workout return keeps its legacy bare-string form (it round-trips
       through history.state); returnRouteKey normalizes either form to the
       registry key. */
    function makeReturnRoute(view,extra={}){return Object.assign({view},extra);}
    function returnRouteKey(route){
      if(typeof route==='string')return route;
      if(route&&typeof route.view==='string')return route.view;
      return undefined;
    }
    /* Completed-workout Back destinations (efficiency pass 2026-09-12): one
       registry instead of an if/else chain — a new source sets
       state.workoutDetailReturn to its ROUTES.DETAIL_RETURN key and registers here. */
    const WORKOUT_DETAIL_RETURNS={
      [ROUTES.DETAIL_RETURN.DASHBOARD]:()=>showDashboard(false),
      [ROUTES.DETAIL_RETURN.PROGRAM]:()=>showProgram(false),
      [ROUTES.DETAIL_RETURN.LIBRARY]:()=>showLibrary(false),
      [ROUTES.DETAIL_RETURN.HISTORY]:()=>{state.workoutHistoryOpen=true;$('#workoutComplete').hidden=true;renderWorkoutScreen();},
      [ROUTES.DETAIL_RETURN.EXERCISE_DETAIL]:()=>{
        if(state.workoutDetailExerciseId)openExercise(state.workoutDetailExerciseId,false,state.workoutDetailExerciseReturn||makeReturnRoute(ROUTES.VIEW.LIBRARY));
        else WORKOUT_DETAIL_RETURNS[ROUTES.DETAIL_RETURN.WORKOUT]();
      },
      [ROUTES.DETAIL_RETURN.WORKOUT]:()=>{$('#workoutComplete').hidden=true;renderWorkoutScreen();},
    };
    function backFromWorkoutDetail(){
      const target=returnRouteKey(state.workoutDetailReturn)||ROUTES.DETAIL_RETURN.WORKOUT;
      (WORKOUT_DETAIL_RETURNS[target]||WORKOUT_DETAIL_RETURNS[ROUTES.DETAIL_RETURN.WORKOUT])();
    }
    /** Tints the Workout tab while a draft is live. Called on every render of
     *  the workout screen, after finish/discard, on tab switches, and once at
     *  boot (restored drafts). */
    function updateLiveWorkoutIndicator() {
      const nav = $('#workoutsNav'); if (!nav) return;
      const live = !!workoutState.draft;
      /* The tab keeps only its accent tint now (user 2026-09-12): the dot
         badge was duplicative once the header owned the live dot. */
      nav.classList.toggle('has-live-draft', live);
      nav.setAttribute('aria-label', live ? 'Workout — session in progress' : 'Workout');
      /* Live-workout chip (user 2026-09-11): top-right header shortcut, visible
         whenever a session is live and we're not on the live editor page.
         #187: the logs list opens over a draft, so the chip stays visible
         there — it's the way back to the editor. */
      const chip = $('#liveWorkoutChip');
      if (chip) chip.hidden = !live || (state.activeView === 'workout' && state.workoutEditorOpen && !state.workoutHistoryOpen);
      /* On the live editor the pill is gone; its dot lives next to the
         "Workout" title instead (user 2026-09-12). */
      const titleDot = $('#liveTitleDot');
      if (titleDot) titleDot.hidden = !live || !(state.activeView === 'workout' && state.workoutEditorOpen && !state.workoutHistoryOpen);
    }

    
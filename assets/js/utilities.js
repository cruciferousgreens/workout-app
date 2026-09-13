
/* ===== module: utilities.js ===== */
    /** Shared DOM, formatting, ID, and date helpers used by the feature modules below. */
    /* Module map (v1.006) — Key: $, escapeHtml(), uid/new*Id(), localIsoDate(), displayWeight(), cloneSetFields()/cloneExerciseSets(), setVolume(), detectExercisePRs(). Depends on: none (loads right after catalog; everything below builds on it). */
    /* #161 (user 2026-09-12): freeze rule — once a set is checked complete its
       form inputs are read-only until the set is un-checked; the only actions
       on a completed set are un-complete and delete. Single source of truth:
       the live set-row renderer (workout-editor.js liveExerciseCardHtml) and
       the checkbox toggle (wireLiveCompleteSet) both derive the frozen state
       from this helper, so render and toggle can never disagree. */
    function setIsFrozen(set){return !!set&&set.complete===true;}
    const $ = (s) => document.querySelector(s);
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tokenize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
    /* Query synonyms as alternative phrases: an exact-key query scores each phrase
       separately and takes the best, so "ohp" ranks "Barbell Shoulder Press"
       (via "shoulder press") above names that merely stack more synonym words.
       Ties break toward the name closest to the bare phrase (fewest extra
       words), so the canonical lift outranks "Alternating Cable …". */
    const searchSynonyms = {
      'knee extension':['leg extension'], 'knee extensions':['leg extension'], 'quad extension':['leg extension'],
      'smith bench':['smith machine bench press'], 'smith press':['smith machine bench press'],
      'ohp':['overhead press','military press','shoulder press'], 'overhead press':['overhead press','military press','shoulder press'],
      'rdl':['romanian deadlift'], 'lat pull down':['lat pulldown'],
      'pull up':['pullup','chinup'], 'rear delt':['reverse fly','posterior deltoid'], 'calf raise':['calf raise']
    };
    function levenshtein(a,b){const m=a.length,n=b.length,row=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i+=1){let prev=row[0];row[0]=i;for(let j=1;j<=n;j+=1){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[n];}
    /* Canonical muscle vocabulary: the pickers derive options from exercise
       data, but the user's own vocabulary may include muscles no exercise
       uses yet (user 2026-09-12: "upper back" as an option). Unioned into
       every muscle picker so it's always selectable, e.g. for custom
       exercises. */
    /* #136: rhomboids + the three delt heads are selectable vocabulary (custom
       exercises, filters) even though no stock exercise names them. */
    const EXTRA_MUSCLES=['upper back','rhomboids','front delts','side delts','rear delts'];
    function allMuscleOptions(){
      /* A8 (#99): soft-deleted customs stay in the store but leave the filter UI. */
      return [...new Set([...exercises.filter(x=>!exerciseDeleted(x)).flatMap(x=>[...(x.primary||[]),...(x.secondary||[])]),...EXTRA_MUSCLES])].filter(Boolean).sort();
    }
    function phraseScore(ex,phrase){
      const qTokens=tokenize(phrase), normQ=normalize(phrase);
      const name=ex.name.toLowerCase(), normName=normalize(ex.name);
      const haystack=[ex.name,ex.id,...ex.primary,...ex.secondary,ex.equipment].join(' ').toLowerCase();
      /* #155: normalized exact tier — "push up" and "Pushups" differ only by
         spacing/punctuation, so they must count as the same query. A lone
         trailing "s" is also ignored ("Pushups" is exact for "push up"). */
      const pluralExact=normQ.length>2&&normName.length>2&&(normName===normQ+'s'||normQ===normName+'s');
      if(normQ&&(normName===normQ||pluralExact))return 100;
      if(name===phrase)return 100;
      /* Normalized prefix tier — "pushup…" outranks any partial-token hit. */
      if(normQ&&normName.startsWith(normQ))return 85;
      if(phrase&&name.includes(phrase))return 80;
      if(phrase&&haystack.includes(phrase))return 75;
      const words=tokenize(haystack); let score=0,matched=0;
      qTokens.forEach(token=>{
        /* Plural-insensitive full-token match: "curls" matches "curl" and back. */
        const singular=token.length>3&&token.endsWith('s')?token.slice(0,-1):null;
        const fullHit=words.some(word=>word===token||word===singular||(token.length>3&&word===token+'s'));
        if(fullHit){score+=15;matched++;}
        /* Substring either way — but not via 1–2 letter fragments: the "t"
           in "T-Bar" must not match every token containing a t. */
        else if(token.length>=3&&words.some(word=>word.length>=3&&(word.includes(token)||token.includes(word)))){score+=9;matched++;}
        else{const best=Math.min(...words.map(word=>levenshtein(token,word)));if(best<=Math.max(1,Math.floor(token.length*.34))){score+=5;matched++;}}
      });
      /* Weak hits don't count: every query token must match at least fuzzily,
         and a lone fuzzy token (e.g. one near-miss letter) is not a match. */
      if(!matched||matched<qTokens.length)return 0;
      if(qTokens.length===1&&score<15)return 0;
      return score;
    }
    function exerciseSearchScore(ex,query){
      const raw=(query||'').toLowerCase().trim(); if(!raw)return 1;
      const keys=Object.keys(searchSynonyms);
      if(searchSynonyms[raw])return Math.max(...searchSynonyms[raw].map(phrase=>phraseScore(ex,phrase)));
      const alias=keys.map(key=>({key,distance:levenshtein(raw,key)})).sort((a,b)=>a.distance-b.distance)[0];
      if(alias&&alias.distance<=Math.max(1,Math.floor(raw.length*.18)))return Math.max(...searchSynonyms[alias.key].map(phrase=>phraseScore(ex,phrase)));
      return phraseScore(ex,raw);
    }
    /* A8 (#99): custom exercises soft-delete via a deletedAt timestamp
       (the sync-tombstone shape a later phase uses). The record stays in the
       store so history/stats/PR lookups keep resolving; listings filter it. */
    function exerciseDeleted(ex){return !!ex?.deletedAt;}
    function rankedExerciseMatches(query,limit=80){
      if(!query)return exercises.slice(0,limit);
      const raw=(query||'').toLowerCase().trim(), phrases=searchSynonyms[raw]||[raw];
      /* #155: tiebreak on normalized closeness — "pushups" is one char past
         "pushup", "push up to side plank" is eleven past it, so the plain
         lift sorts first when scores tie. */
      const extraChars=name=>{const nn=normalize(name);let best=Infinity;phrases.forEach(p=>{const nq=normalize(p);if(nq&&nn.includes(nq))best=Math.min(best,nn.length-nq.length);});return best;};
      /* #155: favorites float only within a relevance tier — a favorite must
         never outrank an exact/prefix match. Tiers: 0 = normalized exact,
         1 = prefix, 2 = substring, 3 = token matches. */
      const tier=score=>score>=100?0:score>=85?1:score>=75?2:3;
      const notFav=id=>state.favorites.has(id)?0:1;
      return exercises.map(ex=>({ex,score:exerciseSearchScore(ex,query),extra:extraChars(ex.name)})).filter(row=>row.score>0&&!exerciseDeleted(row.ex)).sort((a,b)=>tier(a.score)-tier(b.score)||notFav(a.ex.id)-notFav(b.ex.id)||b.score-a.score||a.extra-b.extra||a.ex.name.localeCompare(b.ex.name)).slice(0,limit).map(row=>row.ex);
    }
    const titleCase = (s) => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '—';
    /* #99 B28: ID generation. Old ids (any format) keep resolving everywhere —
       ids are only ever compared with === (sync union, share payloads,
       tombstones), never parsed — so the generator format is free to change. */
    const ID_KIND={set:'set',exercise:'exercise',workout:'workout',template:'template',program:'program',programWorkout:'program-workout',superset:'superset',custom:'custom'};
    /* crypto.randomUUID() is the random core; the Math.random fallback only
       runs on file:// or ancient browsers that lack it. */
    function randomCore(){
      if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});
    }
    /* Kind info stays in the prefix (e.g. "template-<uuid>"); per-model
       wrappers name the intent at each minting site. */
    function uid(kind){return `${kind}-${randomCore()}`;}
    function newSetId(){return uid(ID_KIND.set);}
    function newExerciseUid(){return uid(ID_KIND.exercise);}
    function newWorkoutId(){return uid(ID_KIND.workout);}
    function newTemplateId(){return uid(ID_KIND.template);}
    function newProgramId(){return uid(ID_KIND.program);}
    function newProgramWorkoutUid(){return uid(ID_KIND.programWorkout);}
    function newSupersetGroupId(){return uid(ID_KIND.superset);}
    /* Custom exercises keep the human-readable name slug (it shows in
       exports/debugging), with a random suffix so two same-named customs
       can never share an id. */
    function newCustomExerciseId(name){return `${ID_KIND.custom}-${normalize(name)||'exercise'}-${randomCore().slice(0,8)}`;}
    /* #290: stable content-derived ids for imports. Accepting the same share
       (or importing the same file) on two devices must mint the SAME id, so
       the sync id-union dedups instead of surfacing two copies. cyrb53:
       deterministic, compact, no async crypto needed. The caller decides the
       content key — it must be stable across devices for the same payload
       (so: payload/file content, never a per-device resolved id). */
    function contentHash53(str){
      let h1=0xdeadbeef,h2=0x41c6ce57;
      for(let i=0;i<str.length;i++){
        const ch=str.charCodeAt(i);
        h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);
      }
      h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
      h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
      return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');
    }
    function stableImportUid(kind,key){return `${kind}-import-${contentHash53(String(key))}`;}
    function stableTemplateId(key){return stableImportUid(ID_KIND.template,key);}
    function stableProgramId(key){return stableImportUid(ID_KIND.program,key);}
    /* #263: re-accepting a share must not stack identical "(shared)" names —
       keep suffixing until the name is unique. */
    function uniqueSuffixedName(base,existingNames){
      if(!existingNames.includes(base))return base;
      let n=1,candidate=`${base} (shared)`;
      while(existingNames.includes(candidate)){n++;candidate=`${base} (shared ${n})`;}
      return candidate;
    }
    /* #99 L12: single canonical local-date formatter. Accepts an optional Date
       (defaults to now) — replaces the dashboard-stats isoForDate duplicate. */
    function localIsoDate(date) {
      const now = date || new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0,10);
    }
    /* #99 A13: finished workouts carry a completedAt ISO timestamp; legacy
       records only have date. Anything that means "latest"/recency sorts by
       completedAt with date (or a log's isoDate) as the legacy fallback.
       `date` stays the display/grouping key everywhere. */
    function sortByRecencyDesc(a,b){
      const key=w=>(w&&w.completedAt)||(w&&(w.isoDate||w.date))||'';
      const x=key(a),y=key(b);
      return y<x?-1:y>x?1:0;
    }
    function formatLogDate(value) {
      if (!value) return '';
      return new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric'}).format(new Date(`${value}T12:00:00`));
    }
    function formatPrettyDate(value) {
      if (!value) return '';
      return new Intl.DateTimeFormat('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'}).format(new Date(`${value}T12:00:00`));
    }
    /** Logged weight is already the total external load, including for dumbbells. Never multiply by implement count. */
    function setVolume(set) { return (Number(set.w) || 0) * (Number(set.r) || 0); }
    /* Muscle volume attribution: a set counts fully toward each primary
       muscle and at SECONDARY_MUSCLE_WEIGHT toward each secondary muscle. */
    const SECONDARY_MUSCLE_WEIGHT=0.45;
    /* PR detection core: compares current sets against prior sets and reports
       which PR kind (if any) the current work achieves — 'e1rm' for a new
       estimated-1RM best, 'heaviest' for a new heaviest set. The tolerance
       keeps tiny rounding noise from flagging e1RM PRs. Callers own the
       definition of "prior" (all history vs. other workouts). Shared by the
       live-workout PR label and the Stats recent-PRs list. */
    const PR_E1RM_TOLERANCE=0.5;
    function detectExercisePRs(currentSets,priorSets){
      const current=currentSets||[],prior=priorSets||[];
      if(!current.length||!prior.length)return '';
      const best=Math.max(...current.map(estimate1RM)),priorBest=Math.max(...prior.map(estimate1RM));
      if(best>priorBest+PR_E1RM_TOLERANCE)return 'e1rm';
      const weight=Math.max(...current.map(set=>Number(set.w)||0)),priorWeight=Math.max(...prior.map(set=>Number(set.w)||0));
      if(weight>priorWeight)return 'heaviest';
      return '';
    }
    /* #282: timed-PR detection — longest hold at a given load. A hold beats
       the prior best at the SAME load (unweighted = load 0); a load with no
       prior hold is new territory, so any hold there is a PR — mirroring how
       'heaviest' treats a new top weight. Callers own the "prior" definition,
       same contract as detectExercisePRs. */
    function detectTimedPRs(currentSets,priorSets){
      const current=(currentSets||[]).filter(s=>Number(s.seconds)>0),prior=(priorSets||[]).filter(s=>Number(s.seconds)>0);
      if(!current.length||!prior.length)return false;
      const load=s=>Number(s.w)||0;
      const bestAt=target=>{const pool=prior.filter(s=>load(s)===target);return pool.length?Math.max(...pool.map(s=>Number(s.seconds))):-Infinity;};
      return current.some(s=>Number(s.seconds)>bestAt(load(s)));
    }
    /* #158: the shared "prior" definition for PR detection. Matches the live
       PR banner (which compares against all of getExerciseLogs): earlier
       sessions from the SAME date count, because they completed before this
       workout. workoutState.completed is newest-first, so a same-date row
       after this workout's index is an earlier session. The old
       row.date<workout.date gate silently dropped those. */
    function priorSetsForPR(workout,exerciseId){
      const ordered=workoutState.completed||[],selfIdx=ordered.findIndex(row=>row.id===workout.id);
      const stamp=row=>row&&row.completedAt?Date.parse(row.completedAt):NaN;
      const selfStamp=stamp(workout);
      return ordered
        .filter((row,i)=>{
          if(row.id===workout.id)return false;
          if(row.date<workout.date)return true;
          if(row.date>workout.date)return false;
          /* #277: same-day chronology comes from completedAt, not array order —
             a sync reorder must not flip which session counts as "prior".
             Stamp-less legacy rows keep the index comparison. */
          const rowStamp=stamp(row);
          if(!isNaN(selfStamp)&&!isNaN(rowStamp))return rowStamp<selfStamp;
          return selfIdx>=0&&i>selfIdx;
        })
        .flatMap(row=>row.exercises.filter(entry=>entry.exerciseId===exerciseId).flatMap(entry=>entry.sets));
    }
    /* Units (2026-09-10): weights are stored canonically in pounds; the metric
       setting only changes display and input. 1 lb = 0.45359237 kg. */
    const LB_TO_KG=0.45359237;
    function isMetric(){return progressionSetup.units==='metric';}
    function weightUnit(){return isMetric()?'kg':'lb';}
    function displayWeight(lb){
      if(lb==null||String(lb).trim()==='')return '';
      const n=Number(lb); if(!isFinite(n))return '';
      return isMetric()?String(Math.round(n*LB_TO_KG*10)/10):String(n);
    }
    function storageWeight(val){
      if(val==null||String(val).trim()==='')return '';
      const n=Number(val); if(!isFinite(n))return '';
      return isMetric()?String(Math.round(n/LB_TO_KG*10)/10):String(val);
    }
    function displayVolume(lbReps){
      const n=Number(lbReps)||0;
      return isMetric()?n*LB_TO_KG:n;
    }
    /* A7 (issue #99): prescribed target RPE is a different datum from the
       actual RPE logged on a set. Templates/programs/imports store targets;
       live sessions store actuals in `rpe`. This normalizes a candidate
       target (legacy template `rpe`, MacroFactor RIR-derived RPE, share
       payloads) to a clean string or ''. */
    function cleanTargetRpe(v){
      if(v==null||String(v).trim()==='')return '';
      const n=Number(v); if(!Number.isFinite(n)||n<1||n>10)return '';
      return String(v).trim();
    }
    function escapeHtml(text) {
      const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }
    /* Muscle pill: the shared primary-tag muscle chip used by Stats, the
       exercise library, program pages, and workout detail. The optional
       suffix is code-generated (e.g. ` · 12`), never user text. */
    function musclePill(name,suffix=''){
      return `<span class="tag primary">${escapeHtml(name)}${suffix}</span>`;
    }
    /* Time-step preset pills (2026-09-10, user picked presets over a stepper;
       Custom removed app-wide 2026-09-10, #45).
       Shared by Settings, program setup, and per-exercise rule rows. */
    const TIME_STEP_PRESETS=[5,10,15,30];
    function timeStepPillsHTML(){
      return TIME_STEP_PRESETS.map(n=>`<button type="button" data-step="${n}" aria-pressed="false">${n}s</button>`).join('');
    }
    function syncTimeStepPills(root,value){
      if(!root)return;
      const n=Number(value);
      root.querySelectorAll('[data-step]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(Number(btn.dataset.step)===n));
      });
    }
    function wireTimeStepPills(root,get,set){
      if(!root)return;
      root.innerHTML=timeStepPillsHTML();
      syncTimeStepPills(root,get());
      root.addEventListener('click',e=>{
        const btn=e.target.closest('[data-step]');
        if(!btn||!root.contains(btn))return;
        set(Number(btn.dataset.step));
        syncTimeStepPills(root,get());
      });
    }
    /* #99 B12: one shared toast service. showToast (the app-wide toast) and
       syncToast (the sync UI's toast) used to race on #appToast with
       independent timers — a sync toast could clobber an app toast
       mid-display, and a stale fade timer could hide a fresh toast early.
       Every toast now shares one timer pair, so a new toast always cancels
       the old one cleanly. kind appends a CSS class (e.g. 'error',
       'pr-toast'); durationMs defaults to 3600. opts.onAbsent runs when the
       toast host is missing (the sync UI falls back to its account status
       line); otherwise a missing host is a silent no-op, as before. */
    let toastTimer=null,toastFadeTimer=null;
    /* #226: a native <dialog> shown with showModal() paints in the top layer,
       above the fixed-position #appToast — "Share link copied." was invisible
       under the share modal. While any dialog is open the toast is reparented
       into the topmost one so it joins the top layer too (position:fixed keeps
       its viewport placement); with no dialog open it lives in <body>. */
    function toastTopLayerHost(){
      const open=document.querySelectorAll('dialog[open]');
      return open.length?open[open.length-1]:document.body;
    }
    function toastService(message,opts={}){
      const el=document.getElementById('appToast');
      if(!el){if(typeof opts.onAbsent==='function')opts.onAbsent();return;}
      try{
        const host=toastTopLayerHost();
        if(el.parentNode!==host)host.appendChild(el);
        el.textContent=message;
        el.className=`app-toast ${opts.kind||''}`.trim();
        el.hidden=false;
        clearTimeout(toastTimer);clearTimeout(toastFadeTimer);
        requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
        toastTimer=setTimeout(()=>{
          el.classList.remove('show');
          toastFadeTimer=setTimeout(()=>{
            if(!el.classList.contains('show')){
              el.hidden=true;
              if(!document.querySelector('dialog[open]')&&el.parentNode!==document.body)document.body.appendChild(el);
            }
          },300);
        },opts.durationMs||3600);
      }catch(_){}
    }
    /* The app-wide toast every module already calls — same signature as the
       old workout-editor.js showToast it replaces. */
    function showToast(message,kind='',durationMs=3600){
      toastService(message,{kind,durationMs});
    }
    /* Per-screen scroll memory (#66, 2026-09-11): the Workout tab hosts four
       distinct screens — the start screen, the live editor, the completed
       review, and the history list — which must not share one scroll slot. A
       position saved mid-workout would otherwise restore partway down the
       start screen (and vice versa). Each tab remembers its own scroll across
       tab switches; genuinely new screens begin at the top. Scrolls apply
       synchronously in the same task as the render, so the browser never
       paints at the wrong position first (no visible jump). */
    function workoutScrollKey() {
      if (workoutState.draft) return 'workout:editor';
      const complete = document.querySelector('#workoutComplete');
      if (complete && !complete.hidden) return 'workout:complete';
      /* The 'workout:history' slot existed in the scroll map but this key was
         never returned (efficiency pass 2026-09-12) — the history list kept
         inheriting the start screen's position. */
      if (state.workoutHistoryOpen) return 'workout:history';
      return 'workout:start';
    }
    function scrollKeyFor(view) { return view === 'workout' ? workoutScrollKey() : view; }
    function rememberScroll() { state.scroll[scrollKeyFor(state.activeView)] = window.scrollY; }
    function restoreScroll(view) { window.scrollTo({top: state.scroll[scrollKeyFor(view)] || 0, behavior:'auto'}); }
    /* Logs are their own page (user 2026-09-12): pass highlight=null to light
       no tab while the top bar still follows `view`. */
    function setActiveNav(view, highlight) {
      if (highlight === undefined) highlight = view;
      [['dashboard',$('#dashboardNav')],['library',$('#libraryNav')],['workout',$('#workoutsNav')],['program',$('#programNav')],['stats',$('#statsNav')]].forEach(([key,button]) => {
        const active = key === highlight;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      });
      updateTopBar(view);
    }
    /** Slim persistent top bar: title per view, back chevron only on non-root screens,
     *  settings gear everywhere except on Settings itself. */
    const TOP_BAR_TITLES = { dashboard: 'Home', library: 'Exercises', workout: 'Workout', program: 'Program', stats: 'Stats', settings: 'Settings' };
    /* #313: the live-session dot lives inside the title-text span
       (absolutely positioned, so it never shifts the centered title) —
       every title update re-appends it instead of wiping it. */
    function setTopBarTitle(el, html){
      const dot=$('#liveTitleDot');
      el.innerHTML=html;
      if(dot)el.appendChild(dot);
    }
    function updateTopBar(view, customTitle) {
      const titleEl = $('#topBarTitle'); if (!titleEl) return;
      /* The title text lives in its own span so the live-session dot next to
         it survives title updates (user 2026-09-12). */
      const titleText = $('#topBarTitleText') || titleEl;
      const back = $('#topBarBack'); const gear = $('#topBarSettings');
      /* Title-bar back is the repeatable pattern (user 2026-09-11): it shows
         on Settings, exercise detail, every workout sub-screen, the program
         setup form while editing, and a program-workout page. In-page back
         buttons are gone. */
      const workoutSub = view === 'workout' && state.workoutSubScreen && state.workoutSubScreen !== 'start';
      const programSub = view === 'program' && ($('#createProgram')?.dataset.editing === 'true' || !!state.programWorkoutUid);
      if (back) {
        back.hidden = !(view === 'settings' || view === 'detail' || workoutSub || programSub);
        if (workoutSub || programSub) back.setAttribute('aria-label', 'Back');
      }
      /* The gear stays visible on Settings, shown active like an active tab (user 2026-09-10). */
      if (gear) gear.classList.toggle('active', view === 'settings');
      if (view === 'detail') {
        /* #10 (user 2026-09-11): no breadcrumb in the header — it shows only
           the parent page ("Exercises" etc.). The exercise name lives in the
           detail body; the top-bar back chevron is the one and only back
           affordance. */
        const ret = state.exerciseDetailReturn && state.exerciseDetailReturn.view;
        const parentKey = { library: 'library', workout: 'workout', program: 'program', dashboard: 'dashboard', stats: 'stats', 'completed-workout': 'workout' }[ret] || 'library';
        setTopBarTitle(titleText, escapeHtml(TOP_BAR_TITLES[parentKey]));
      } else if (view === 'settings') {
        // Settings is its own page, not a breadcrumb (user 2026-09-10).
        setTopBarTitle(titleText, 'Settings');
      } else if (view === 'workout' && (state.workoutSubScreen === 'history' || state.workoutSubScreen === 'complete')) {
        /* User 2026-09-12: the log list and a completed workout are "Logs",
           not "Workout" — these are completed sessions. The title is a hidden
           button (looks identical to other pages) that jumps to the full
           log list. The chevron was removed per user feedback: it doesn't
           fit the design and the title tap is a shortcut, not navigation. */
        const logLabel = customTitle || 'Logs';
        setTopBarTitle(titleText, `<button type="button" class="title-tap" id="topBarTitleTap" aria-label="View all workout logs">${escapeHtml(logLabel)}</button>`);
        const titleTap = $('#topBarTitleTap');
        if (titleTap) titleTap.addEventListener('click', () => {
          /* Already on the list: don't push a duplicate history entry. */
          if (state.workoutSubScreen === 'history') { window.scrollTo({top:0,behavior:'auto'}); return; }
          showWorkoutHistory();
        });
      } else {
        setTopBarTitle(titleText, escapeHtml(customTitle || TOP_BAR_TITLES[view] || ''));
      }
    }

        /* ===== Shared exercise/tracking helpers (efficiency pass 2026-09-12) =====
       Used across workout-editor.js, programs.js, app-bootstrap.js,
       progression.js, and workout-history.js. They live here (utilities.js
       loads first) so no feature module reaches into another for them. */
    /* ===== Shared domain constants (moved here 2026-09-12, #99 B23) =====
       REP_PRESETS and defaultExerciseProgression were owned by feature modules
       (programs.js, workout-editor.js) but consumed cross-module; the dead
       OB_RANGE_PRESETS duplicate died with the onboarding gate (#99 B1). */
    /* 15+ and AMRAP are open-ended: no max (user 2026-09-10). An empty max
       field elsewhere also means open. */
    const REP_PRESETS={strength:{label:'Strength',min:1,max:5},hypertrophy:{label:'Hypertrophy',min:6,max:12},endurance:{label:'Endurance',min:12,max:20},open:{label:'15+',min:15,max:null,openTop:true},amrap:{label:'AMRAP',min:1,max:null,amrap:true}};
    /* #99: ONE factory owns the exercise-level progression profile shape.
       `overrides` fills in the mode/range; increment/timeStep fall back to the
       global progressionSetup defaults. */
    function defaultExerciseProgression(overrides={}) {
      return {
        mode: overrides.mode || 'reps',
        min: overrides.min ?? null,
        max: overrides.max ?? null,
        openTop: !!overrides.openTop,
        amrap: !!overrides.amrap,
        timeMin: overrides.timeMin ?? 30,
        timeMax: overrides.timeMax ?? 60,
        timeStep: overrides.timeStep ?? progressionSetup.timeStep ?? 5,
        incrementType: overrides.incrementType || progressionSetup.incrementType || 'lb',
        incrementValue: overrides.incrementValue ?? progressionSetup.incrementValue ?? 5,
        repsOnly: !!overrides.repsOnly,
        custom: !!overrides.custom
      };
    }
    /* ===== #99 B8: canonical clone utilities =====
       Eight hand-written exercise/set clone paths used to encode the same
       schema as inline literals (repeat, template-from-completed,
       template-start, program-start, builder copy, history edit, share
       import) — and they already disagreed on RPE (A7). Every rebuild of an
       exercise item from another record goes through ONE of these explicit
       conversion modes, so schema fields can't silently disappear on one
       path. Semantics preserved EXACTLY:
       - A7: 'forNewSession' clears actual RPE and carries only a STORED
         prescribed target; 'forTemplate' converts a completed set's ACTUAL
         rpe into a suggested targetRpe.
       - #175: 'forNewSession' carries the previous weight as a real value.
       - #267: 'forNewSession' blanks r/seconds so the ghost suggestion shows.
       - Legacy templates stored prescribed targets in `rpe`; 'fromTemplate'
         and 'fromProgram' prefer `targetRpe` over `rpe`.
       - 'forEdit' is the full-fidelity round trip (actual RPE kept,
         complete preserved) — it is editing, not a new session.
       - Tracking resolution is per-mode: only 'fromTemplate' consults
         progression.mode (opts.trackingFallback preserves the builder
         copy's `||null`); the other modes keep their old `||'reps'`.
       - 'fromShare' decodes the v2 slim arrays; the codec passes its own
         progression decoder (it lives in the share codec module). */
    function cloneSetFields(set,mode){
      const s=set||{};
      switch(mode){
        /* #267 (user 2026-09-12): repeat-as-new blanks performance (r/seconds)
           so the Rep+ ghost suggestion shows — carrying last session's reps
           as real values hid the ghost. Weight still carries (#175), RPE
           still clears (A7). */
        case 'forNewSession':return {w:s.w==null?'':String(s.w),r:'',seconds:'',rpe:'',targetRpe:cleanTargetRpe(s.targetRpe),tags:[...(s.tags||[])]};
        case 'forTemplate':return {w:s.w==null?'':String(s.w),r:s.r==null?'':String(s.r),seconds:s.seconds==null?'':String(s.seconds),rpe:'',targetRpe:cleanTargetRpe(s.rpe),tags:[...(s.tags||[])]};
        case 'fromTemplate':return {w:'',r:s.r??'',seconds:s.seconds??'',rpe:'',targetRpe:cleanTargetRpe(s.targetRpe??s.rpe),tags:[...(s.tags||[])]};
        case 'fromProgram':return {w:'',r:'',seconds:'',rpe:'',targetRpe:cleanTargetRpe(s.targetRpe??s.rpe),tags:[...(s.tags||[])]};
        case 'forEdit':return {w:s.w==null?'':String(s.w),r:s.r==null?'':String(s.r),seconds:s.seconds==null?'':String(s.seconds),rpe:s.rpe==null?'':String(s.rpe),targetRpe:'',tags:[...(s.tags||[])],complete:true};
        /* Builder → saved-template persist: prescriptions only; every logged
           actual (weight, RPE, stored target) is dropped. Orphaned superset
           ids are dropped by the caller via opts.supersetId. */
        case 'forSaveTemplate':return {w:'',r:s.r??'',seconds:s.seconds??'',rpe:'',targetRpe:'',tags:[...(s.tags||[])]};
        default:return {w:'',r:'',seconds:'',rpe:'',targetRpe:'',tags:[]};
      }
    }
    /* opts.emptyDefault: some paths (builder copy, program start) mint one
       blank set when the source has none; the others keep an empty list. */
    function cloneExerciseSets(sets,mode,opts={}){
      const rows=(sets&&sets.length)?sets:(opts.emptyDefault?[{w:'',r:'',seconds:'',rpe:'',tags:[]}]:[]);
      return rows.map(set=>Object.assign(newSet(),cloneSetFields(set,mode)));
    }
    function cloneExerciseItem(item,mode,opts={}){
      const src=item||{};
      const tracking=opts.tracking||(mode==='fromTemplate'
        ? src.tracking||src.progression?.mode||('trackingFallback' in opts?opts.trackingFallback:'reps')
        : src.tracking||'reps');
      return newExerciseItem({
        exerciseId:'exerciseId' in opts?opts.exerciseId:src.exerciseId,
        tracking,
        note:'note' in opts?opts.note:(src.note||''),
        noteOpen:!!opts.noteOpen,
        exerciseTags:'exerciseTags' in opts?opts.exerciseTags:src.exerciseTags,
        supersetId:'supersetId' in opts?opts.supersetId:src.supersetId,
        progression:'progression' in opts?opts.progression:src.progression,
        sets:'sets' in opts?opts.sets:cloneExerciseSets(src.sets,mode,opts)
      });
    }
    /* Share import: slim v2 arrays → full items. Uids are regenerated and
       sets rebuilt through newSet so defaults always match the recipient's
       app version. decodeProgression is the share codec's own decoder. */
    function cloneExerciseItemFromShare(sitem,decodeProgression){
      const cols=a=>Array.isArray(a)?a:[];
      return cloneExerciseItem(null,'fromShare',{
        exerciseId:sitem.i,
        tracking:sitem.k||'reps',
        note:sitem.o||'',
        exerciseTags:Array.isArray(sitem.g)?[...sitem.g]:[],
        supersetId:sitem.u||null,
        progression:decodeProgression(sitem.p),
        sets:(sitem.e||[]).map(a=>{const c=cols(a);return Object.assign(newSet(),{w:c[0]??'',r:c[1]??'',seconds:c[2]??'',rpe:c[3]??'',tags:[...cols(c[4])],targetRpe:cleanTargetRpe(c[5])});})
      });
    }
    /* #99 B13: one shared exercise-target summary for saved-workout rows
       (programs.js) and share-preview rows (share.js). The caller injects the
       resolved exercise name — share payloads resolve names against their own
       custom exercises first, since those aren't in the recipient's library. */
    function exerciseTargetSummary(item,name){
      const n=(item.sets||[]).length,p=item.progression||{};
      let target='';
      if((item.tracking||p.mode)==='time')target=`${p.timeMin??30}–${p.timeMax??60} sec`;
      else if(p.min!=null||p.max!=null)target=`${p.min??''}–${p.max??''} reps`;
      else{const rs=[...new Set((item.sets||[]).map(s=>s.r).filter(v=>v!==''&&v!=null))];if(rs.length)target=`${rs.join('/')} reps`;}
      return {name,meta:`${n} set${n===1?'':'s'}${target?` · ${target}`:''}`};
    }
    /* #81: number superset groups (Superset 1, Superset 2, …) so multiple
       groups are visually distinct. Numbering follows order of first appearance. */
    function supersetGroupNumber(exercises,supersetId){
      const seen=[];
      for(const row of exercises){
        if(row.supersetId&&!seen.includes(row.supersetId))seen.push(row.supersetId);
      }
      return seen.indexOf(supersetId)+1;
    }
    /* Canonical tracking read (efficiency pass 2026-09-12): the toggle says
       "seconds" but the canonical value is 'time' — a pre-fix builder bug
       persisted raw 'seconds' strings, so normalize here, the single read
       point, instead of scattering ==='seconds' checks. */
    function exerciseTracking(item, ex) {
      const t=item?.tracking || item?.progression?.mode || ex?.tracking || (ex?.force === 'static' ? 'time' : 'reps');
      return t==='seconds'?'time':t;
    }
    /* Rep/time-range placeholder for set inputs (2026-09-10): the placeholder
       shows the target range ("6–12", "6+", "AMRAP", "30–60 sec") while the
       value auto-saved when completing an untouched set is the range minimum —
       the conservative, honest default. AMRAP has no auto value: reps must be
       entered. A progression suggestion (target) takes precedence over both. */
    function rangePlaceholder(profile,time){
      profile=profile||{};
      if(time){
        const min=profile.timeMin,max=profile.timeMax;
        if(min&&max&&min!==max)return {text:`${min}–${max} sec`,value:String(min)};
        if(min)return {text:`${min} sec`,value:String(min)};
        return {text:'',value:''};
      }
      if(profile.amrap)return {text:profile.min>1?`AMRAP from ${profile.min}`:'AMRAP',value:''};
      const min=profile.min,max=profile.max;
      if(profile.openTop&&min)return {text:`${min}+`,value:String(min)};
      if(min&&max)return min===max?{text:String(min),value:String(min)}:{text:`${min}–${max}`,value:String(min)};
      if(min)return {text:String(min),value:String(min)};
      return {text:'',value:''};
    }
    /* Effective progression scheme for an exercise item (#54, v1.001): the
       item's own stamped scheme first, then the program context (program
       drafts stamp scheme at start; the builder's program-workout editor
       reads the active program), then the global default. */
    function resolvedExerciseScheme(item){
      const prof = item?.progression || {};
      if(prof.scheme) return prof.scheme;
      const d = workoutState.draft;
      if(d?.programId && workoutState.activeProgram?.id === d.programId){
        const s = workoutState.activeProgram.progression?.scheme;
        if(s) return s;
      }
      const b = state.savedBuilder;
      if(b?.editTarget?.kind === 'program'){
        const s = workoutState.activeProgram?.progression?.scheme;
        if(s) return s;
      }
      return progressionSetup.scheme || 'rpe';
    }
    /* #205 (user 2026-09-12): one-paragraph description per progression mode
       for the Settings → Progression defaults picker. Tapping a pill shows
       only that mode's copy — the old combined block described all three at
       once. Wording is the existing copy, split per mode. */
    const SCHEME_DESCRIPTIONS={
      rpe:'RPE-based adds reps first, then weight, gated by the RPE trigger.',
      linear:'Linear adds the increment every session, no RPE needed.',
      onerm:'%1RM prescribes each exercise\'s load as a percentage of its estimated 1RM.'
    };
    function schemeDescription(scheme){return SCHEME_DESCRIPTIONS[scheme]||SCHEME_DESCRIPTIONS.rpe;}
    function progressionSummaryForOptions(item) {
      // user 2026-09-11: show the exercise's progression setup under Exercise
      // options so the suggestion basis is visible during the workout.
      const prof = item.progression || {};
      const scheme = resolvedExerciseScheme(item);
      const schemeLabel = scheme === 'onerm' ? '%1RM' : scheme === 'linear' ? 'Linear' : 'RPE-based';
      const time = prof.mode === 'time' || exerciseTracking(item, exercises.find(e=>e.id===item.exerciseId)) === 'time';
      let target;
      if (time) {
        target = `${prof.timeMin || 30}–${prof.timeMax || 60} sec`;
      } else if (prof.amrap) {
        target = `AMRAP from ${prof.min || 1} reps`;
      } else if (prof.openTop) {
        target = `${prof.min || 5}+ reps`;
      } else {
        target = `${prof.min || 5}–${prof.max || 8} reps`;
      }
      // Include the live suggestion reason if one exists for this exercise
      const sugg = (workoutState.draft?.progressionSuggestions || []).find(x => x.exerciseId === item.exerciseId);
      let detail = '';
      let onermInputs = '';
      if(scheme === 'onerm'){
        // Provenance display line (#54, v1.001): "75% of TM 225 lb (you set)"
        // or "75% of auto TM ~ 240 lb from e1RM".
        const rawPct = Number(prof.percentOf1RM);
        const pctEff = sugg?.pct ?? (Number.isFinite(rawPct) && rawPct > 0 ? clampPct1RM(rawPct) : 75);
        const tm = Number(prof.trainingMax ?? prof.manual1RM) || 0;
        if(sugg && sugg.kind === 'onerm'){
          detail = sugg.tmSource === 'manual'
            ? `${sugg.pct}% of TM ${displayWeight(sugg.estimated1RM)} ${weightUnit()} (you set)`
            : `${sugg.pct}% of auto TM ~ ${displayWeight(Math.round(sugg.estimated1RM))} ${weightUnit()} from e1RM`;
        }else if(tm > 0){
          detail = `${pctEff}% of TM ${displayWeight(tm)} ${weightUnit()} (you set)`;
        }else{
          detail = `${pctEff}% of estimated 1RM`;
        }
        onermInputs = `<div class="prog-onerm-fields"><label class="prog-onerm-field"><span>% of 1RM</span><span class="prog-onerm-input"><input type="number" inputmode="numeric" min="1" max="100" step="1" value="${prof.percentOf1RM ?? ''}" placeholder="${pctEff}" data-onerm-pct="${escapeHtml(item.uid)}" aria-label="Percent of 1RM override, blank for program default"><em class="unit">%</em></span></label><label class="prog-onerm-field"><span>Training max</span><span class="prog-onerm-input"><input type="number" inputmode="decimal" min="1" step="0.5" value="${tm > 0 ? displayWeight(tm) : ''}" placeholder="Auto" data-onerm-tm="${escapeHtml(item.uid)}" aria-label="Training max, blank for automatic"><em class="unit">${weightUnit()}</em></span></label></div>`;
      }else{
        const incType = prof.incrementType || 'lb';
        const incVal = prof.incrementValue ?? 5;
        detail = prof.repsOnly ? 'reps only, no load progression' : `+${incVal} ${incType === 'percent' ? '%' : weightUnit()} per jump`;
      }
      let basis = sugg?.reason ? `<span class="prog-basis">${escapeHtml(sugg.reason)}</span>` : '';
      if(!basis && !workoutState.draft?.editingId){
        /* #166: the engine returned no suggestion for this exercise — say why,
           grounded in the engine's own null cases (progressionForExercise
           returns null only when there is no history, or history with no
           valid latest top set / a suppressed no-change). Holds already
           arrive as suggestions with their own reason above. #148: skip the
           why-copy while editing a completed workout — suggestions don't
           apply to history. */
        const hasHistory=getExerciseLogs(item.exerciseId).length>0;
        basis=`<span class="prog-basis">${hasHistory?'History exists, but there is not enough valid data for a suggestion.':'No completed history for this exercise yet.'}</span>`;
      }
      return `<div class="prog-summary"><span class="prog-scheme">${escapeHtml(schemeLabel)}</span><span class="prog-target">${escapeHtml(target)}</span><span class="prog-detail">${escapeHtml(detail)}</span>${onermInputs}${basis}</div>`;
    }
    /* %1RM per-exercise inputs (#54, v1.001): % override + training max,
       rendered by progressionSummaryForOptions in both the live editor and
       the saved-workout builder. 'change' (not 'input') so typing isn't
       interrupted; afterChange lets each host recompute its suggestions. */
    function wireOnermOptionInputs(scope, findItem, afterChange){
      if(!scope || typeof findItem !== 'function') return;
      scope.querySelectorAll('[data-onerm-pct]').forEach(input => input.addEventListener('change', () => {
        const item = findItem(input.dataset.onermPct); if(!item) return;
        const p = item.progression || (item.progression = {});
        const v = Number(input.value);
        if(input.value.trim() === '' || !Number.isFinite(v) || v <= 0) delete p.percentOf1RM;
        else p.percentOf1RM = clampPct1RM(v);
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
      scope.querySelectorAll('[data-onerm-tm]').forEach(input => input.addEventListener('change', () => {
        const item = findItem(input.dataset.onermTm); if(!item) return;
        const p = item.progression || (item.progression = {});
        const v = Number(input.value);
        if(input.value.trim() === '' || !Number.isFinite(v) || v <= 0){ delete p.trainingMax; delete p.tmSource; }
        else{ p.trainingMax = Math.max(1, Math.round(Number(storageWeight(input.value)) * 10) / 10); p.tmSource = 'manual'; }
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
    }
    /* One canonical tracking-mode switch (efficiency pass 2026-09-12): maps
       the toggle's "seconds" to canonical 'time', no-ops when already set (no
       scroll jump), keeps the progression mode in sync, never mutates entered
       rep/seconds values. Returns true when the mode actually changed. */
    function setExerciseTracking(item, next, {resetCompletion=false}={}){
      const mode=next==='seconds'?'time':'reps';
      const ex=exercises.find(e=>e.id===item.exerciseId);
      if(exerciseTracking(item,ex)===mode)return false;
      item.tracking=mode;
      item.progression={...progressionProfileForDraftItem(item),mode};
      if(resetCompletion)item.sets.forEach(set=>{set.complete=false;});
      return true;
    }

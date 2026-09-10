
/* ===== module: utilities.js ===== */
    /** Shared DOM, formatting, ID, and date helpers used by the feature modules below. */
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
    function phraseScore(ex,phrase){
      const qTokens=tokenize(phrase), name=ex.name.toLowerCase(), haystack=[ex.name,ex.id,...ex.primary,...ex.secondary,ex.equipment].join(' ').toLowerCase();
      if(name===phrase)return 100;if(name.includes(phrase)||haystack.includes(phrase))return 80;
      const words=tokenize(haystack); let score=0;
      qTokens.forEach(token=>{if(words.includes(token))score+=15;else if(words.some(word=>word.includes(token)||token.includes(word)))score+=9;else{const best=Math.min(...words.map(word=>levenshtein(token,word)));if(best<=Math.max(1,Math.floor(token.length*.34)))score+=5;}});
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
    function rankedExerciseMatches(query,limit=80){
      if(!query)return exercises.slice(0,limit);
      const raw=(query||'').toLowerCase().trim(), phrases=searchSynonyms[raw]||[raw];
      const extraWords=name=>{const n=(name||'').toLowerCase(),wn=tokenize(n).length;let best=Infinity;phrases.forEach(p=>{if(n.includes(p))best=Math.min(best,wn-tokenize(p).length);});return best;};
      return exercises.map(ex=>({ex,score:exerciseSearchScore(ex,query),extra:extraWords(ex.name)})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.extra-b.extra||a.ex.name.localeCompare(b.ex.name)).slice(0,limit).map(row=>row.ex);
    }
    const titleCase = (s) => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '—';
    let uidCounter = 0;
    function uid(prefix) { uidCounter += 1; return `${prefix}-${Date.now()}-${uidCounter}`; }
    function localIsoDate() {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0,10);
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
    function escapeHtml(text) {
      const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }
    /* Time-step preset pills (2026-09-10, Justin picked presets over a stepper).
       Shared by Settings, program setup, and per-exercise rule rows. */
    const TIME_STEP_PRESETS=[5,10,15,30];
    function timeStepPillsHTML(){
      return TIME_STEP_PRESETS.map(n=>`<button type="button" data-step="${n}" aria-pressed="false">${n}s</button>`).join('')
        + `<button type="button" data-step="custom" aria-pressed="false">Custom</button>`
        + `<input type="number" inputmode="numeric" min="1" step="1" class="step-custom" data-step-custom aria-label="Custom time step in seconds" hidden>`;
    }
    function syncTimeStepPills(root,value){
      if(!root)return;
      const n=Math.max(1,Number(value)||5), isPreset=TIME_STEP_PRESETS.includes(n);
      root.querySelectorAll('[data-step]').forEach(btn=>{
        const key=btn.dataset.step;
        btn.setAttribute('aria-pressed',String(key==='custom'?!isPreset:Number(key)===n));
      });
      const custom=root.querySelector('[data-step-custom]');
      if(custom){custom.hidden=isPreset;if(!isPreset&&document.activeElement!==custom)custom.value=n;}
    }
    function wireTimeStepPills(root,get,set){
      if(!root)return;
      root.innerHTML=timeStepPillsHTML();
      syncTimeStepPills(root,get());
      root.addEventListener('click',e=>{
        const btn=e.target.closest('[data-step]');
        if(!btn||!root.contains(btn))return;
        if(btn.dataset.step==='custom'){
          const custom=root.querySelector('[data-step-custom]');
          root.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
          if(custom){custom.hidden=false;custom.value=get();custom.focus();custom.select();}
          return;
        }
        set(Number(btn.dataset.step));
        syncTimeStepPills(root,get());
      });
      const custom=root.querySelector('[data-step-custom]');
      custom.addEventListener('change',()=>{const n=Math.max(1,Number(custom.value)||5);set(n);syncTimeStepPills(root,get());});
    }
    function rememberScroll() { state.scroll[state.activeView] = window.scrollY; }
    function restoreScroll(view) { requestAnimationFrame(() => window.scrollTo({top:state.scroll[view] || 0, behavior:'auto'})); }
    function setActiveNav(view) {
      [['dashboard',$('#dashboardNav')],['library',$('#libraryNav')],['workout',$('#workoutsNav')],['program',$('#programNav')],['stats',$('#statsNav')]].forEach(([key,button]) => {
        const active = key === view;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      });
      updateTopBar(view);
    }
    /** Slim persistent top bar: title per view, back chevron only on non-root screens,
     *  settings gear everywhere except on Settings itself. */
    const TOP_BAR_TITLES = { dashboard: 'Home', library: 'Exercises', workout: 'Workout', program: 'Program', stats: 'Stats', settings: 'Settings' };
    function goToTab(key) {
      if (key === 'library') showLibrary();
      else if (key === 'workout') showWorkouts();
      else if (key === 'program') showProgram();
      else if (key === 'stats') showStats();
      else showDashboard();
    }
    /** Breadcrumb title on sub-pages, e.g. "Exercises / Air Bike". The parent is a
     *  tappable button that performs the same navigation as the back chevron. */
    function setCrumbTitle(titleEl, parentLabel, currentLabel, goParent) {
      titleEl.textContent = '';
      const parent = document.createElement('button');
      parent.type = 'button'; parent.className = 'crumb-parent'; parent.textContent = parentLabel;
      parent.setAttribute('aria-label', `Back to ${parentLabel}`);
      parent.addEventListener('click', goParent);
      const sep = document.createElement('span');
      sep.className = 'crumb-sep'; sep.setAttribute('aria-hidden', 'true'); sep.textContent = '/';
      const here = document.createElement('span'); here.className = 'crumb-here'; here.textContent = currentLabel;
      titleEl.append(parent, sep, here);
    }
    function updateTopBar(view, customTitle) {
      const titleEl = $('#topBarTitle'); if (!titleEl) return;
      const back = $('#topBarBack'); const gear = $('#topBarSettings');
      if (back) back.hidden = !(view === 'settings' || view === 'detail');
      if (gear) gear.hidden = view === 'settings';
      if (view === 'detail') {
        const ret = state.exerciseDetailReturn && state.exerciseDetailReturn.view;
        const parentKey = { library: 'library', workout: 'workout', program: 'program', dashboard: 'dashboard', stats: 'stats', 'completed-workout': 'workout' }[ret] || 'library';
        setCrumbTitle(titleEl, TOP_BAR_TITLES[parentKey], customTitle || '', () => backFromExerciseDetail());
      } else if (view === 'settings') {
        // Settings is its own page, not a breadcrumb (Justin 2026-09-10).
        titleEl.textContent = 'Settings';
      } else {
        titleEl.textContent = customTitle || TOP_BAR_TITLES[view] || '';
      }
    }

    
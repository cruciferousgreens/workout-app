
    /** Shared DOM, formatting, ID, and date helpers used by the feature modules below. */
    const $ = (s) => document.querySelector(s);
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tokenize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
    const searchSynonyms = {
      'knee extension':'leg extension', 'knee extensions':'leg extension', 'quad extension':'leg extension',
      'smith bench':'smith machine bench press', 'smith press':'smith machine bench press',
      'ohp':'overhead press military press', 'rdl':'romanian deadlift', 'lat pull down':'lat pulldown',
      'pull up':'pullup chinup', 'rear delt':'reverse fly posterior deltoid', 'calf raise':'calf raises'
    };
    function levenshtein(a,b){const m=a.length,n=b.length,row=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i+=1){let prev=row[0];row[0]=i;for(let j=1;j<=n;j+=1){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[n];}
    function exerciseSearchScore(ex,query){
      const raw=(query||'').toLowerCase().trim(); if(!raw)return 1;
      const alias=Object.entries(searchSynonyms).map(([key,value])=>({key,value,distance:levenshtein(raw,key)})).sort((a,b)=>a.distance-b.distance)[0];
      const expanded=searchSynonyms[raw]||(alias&&alias.distance<=Math.max(1,Math.floor(raw.length*.18))?alias.value:raw), qTokens=tokenize(expanded), name=ex.name.toLowerCase(), haystack=[ex.name,ex.id,...ex.primary,...ex.secondary,ex.equipment].join(' ').toLowerCase();
      if(name===expanded)return 100;if(name.includes(expanded)||haystack.includes(expanded))return 80;
      const words=tokenize(haystack); let score=0;
      qTokens.forEach(token=>{if(words.includes(token))score+=15;else if(words.some(word=>word.includes(token)||token.includes(word)))score+=9;else{const best=Math.min(...words.map(word=>levenshtein(token,word)));if(best<=Math.max(1,Math.floor(token.length*.34)))score+=5;}});
      return score;
    }
    function rankedExerciseMatches(query,limit=80){
      if(!query)return exercises.slice(0,limit);
      return exercises.map(ex=>({ex,score:exerciseSearchScore(ex,query)})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.ex.name.localeCompare(b.ex.name)).slice(0,limit).map(row=>row.ex);
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
    /** Logged weight is already the total external load, including for dumbbells. Never multiply by implement count. */
    function setVolume(set) { return (Number(set.w) || 0) * (Number(set.r) || 0); }
    function escapeHtml(text) {
      const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
    }
    function rememberScroll() { state.scroll[state.activeView] = window.scrollY; }
    function restoreScroll(view) { requestAnimationFrame(() => window.scrollTo({top:state.scroll[view] || 0, behavior:'auto'})); }
    function setActiveNav(view) {
      [['dashboard',$('#dashboardNav')],['library',$('#libraryNav')],['workout',$('#workoutsNav')],['program',$('#programNav')],['stats',$('#statsNav')]].forEach(([key,button]) => {
        const active = key === view;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      });
    }

    
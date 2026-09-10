
    /** Shared DOM, formatting, ID, and date helpers used by the feature modules below. */
    const $ = (s) => document.querySelector(s);
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

    
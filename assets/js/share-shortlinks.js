/* ===== module: share-shortlinks.js ===== */
    /* Server-backed short links for shares (#177, user 2026-09-12).
       When SIGNED IN, sharing a workout/program mints a short link
       https://app.cruciferousgreens.com/s/<slug> backed by the
       public.share_links table (see supabase/migrations/0001_share_links.sql
       — the user runs the migration separately; the app degrades gracefully
       when the table is absent). The payload column holds the exact v2
       compressed string long links use, so opening a short link decodes
       through shareDecodeAny and lands on the SAME share preview/modal as
       long links. Slugs are client-generated: 8 chars from
       crypto.getRandomValues over [a-zA-Z0-9]; a unique-violation retries
       with a fresh slug (5 tries), then the flow falls back to the long
       link. Signed-out shares — and ANY failure — keep the existing long
       compressed-link behavior untouched: sharing never breaks.
       Static-host routing: GitHub Pages has no rewrites, so /s/<slug> is
       served by 404.html, which stashes the path in sessionStorage and
       hands off to index.html; boot consumes it here (one-shot). */
       /* Module map (v1.014) — Key: newShareSlug()/isValidShareSlug(),
          buildShortShareUrl(), tryShortShareLink(), shortSlugFromPath(),
          shortLinkAttemptFromPath() (#177 follow-up),
          resolveShortShareLink(), clearShortSharePath(),
          takeSpaRedirectSlug(), spaBaseForPath(). Depends on: share-codec
          (shareDecodeAny, validSharePayload — loads just before), Sync
          namespace (getSupabase — sync-adapter.js, loads earlier). No DOM
          at load time. */
    const SHARE_SHORT_ORIGIN='https://app.cruciferousgreens.com';
    const SHARE_SLUG_ALPHABET='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const SHARE_SLUG_LENGTH=8;
    const SHARE_SHORT_MAX_ATTEMPTS=5;
    /* sessionStorage key the 404.html SPA fallback uses to hand the
       requested path to index.html. The inline copy in 404.html hardcodes
       the same string — keep them in sync. */
    const SPA_REDIRECT_KEY='cg-spa-redirect';

    /* ---- Slug generation ---- */
    function shareSlugFromBytes(bytes){
      let s='';
      for(let i=0;i<bytes.length;i++)s+=SHARE_SLUG_ALPHABET[bytes[i]%SHARE_SLUG_ALPHABET.length];
      return s;
    }
    function isValidShareSlug(s){
      return typeof s==='string'&&/^[A-Za-z0-9]{8}$/.test(s);
    }
    function newShareSlug(){
      const g=(typeof globalThis!=='undefined')?globalThis:{};
      const c=g.crypto;
      if(!c||typeof c.getRandomValues!=='function')throw new Error('no secure RNG for share slug');
      const bytes=new Uint8Array(SHARE_SLUG_LENGTH);
      c.getRandomValues(bytes);
      return shareSlugFromBytes(bytes);
    }
    function buildShortShareUrl(slug){
      return SHARE_SHORT_ORIGIN+'/s/'+slug;
    }

    /* ---- Signed-in + Supabase access (best-effort) ---- */
    function shortLinksSignedIn(){
      /* share.js owns the canonical check; fall back to the raw globals so
         this module stays testable standalone. */
      if(typeof shareSignedIn==='function'){try{return !!shareSignedIn();}catch(_){}}
      try{if(typeof lastAuthUid!=='undefined'&&lastAuthUid)return true;}catch(_){}
      try{return !!((typeof Sync!=='undefined'&&Sync&&Sync.lastAuthUid)||(typeof window!=='undefined'&&window.Sync&&window.Sync.lastAuthUid));}catch(_){return false;}
    }
    function shortLinksSupabase(){
      try{
        if(typeof Sync!=='undefined'&&Sync&&typeof Sync.getSupabase==='function')return Sync.getSupabase();
      }catch(_){}
      return Promise.resolve(null);
    }

    /* ---- Minting: signed-in shares get the short link, else null ---- */
    async function tryShortShareLink(payload,code){
      /* Returns the short URL, or null when the long link should be used
         instead (signed out, no Supabase client, insert failure, or 5 slug
         collisions). Never throws — sharing must never break. */
      try{
        if(!shortLinksSignedIn())return null;
        if(!code||typeof code!=='string')return null;
        const sb=await shortLinksSupabase();
        if(!sb)return null;
        const kind=(payload&&payload.kind==='program')?'program':'workout';
        for(let attempt=0;attempt<SHARE_SHORT_MAX_ATTEMPTS;attempt++){
          let slug;
          try{slug=newShareSlug();}catch(_){return null;}
          try{
            const res=await sb.from('share_links').insert({slug,kind,payload:code});
            const err=res&&res.error;
            if(!err)return buildShortShareUrl(slug);
            if(!err||err.code!=='23505')return null; /* unique-violation retries; anything else stops */
          }catch(_){return null;}
        }
        return null; /* 5 collisions — keep the long link */
      }catch(_){return null;}
    }

    /* ---- Opening: /s/<slug> → payload ---- */
    const SHORT_SHARE_PATH_RE=/(?:^|\/)s\/([A-Za-z0-9]{8})\/?$/;
    function shortSlugFromPath(pathname){
      const m=SHORT_SHARE_PATH_RE.exec(pathname||'');
      return m?m[1]:null;
    }
    /* #177 follow-up (user 2026-09-12): distinguishes "a /s/... route with
       an invalid slug" from "no short-link route at all". Matches ANY single
       /s/<segment> — malformed, unknown, or corrupt — so every attempted
       short link takes the invalid-link feedback path instead of silently
       opening Home. */
    const SHORT_SHARE_ATTEMPT_RE=/(?:^|\/)s\/([^\/]+)\/?$/;
    function shortLinkAttemptFromPath(pathname){
      const m=SHORT_SHARE_ATTEMPT_RE.exec(pathname||'');
      return m?m[1]:null;
    }
    async function resolveShortShareLink(slug){
      /* Fetches the row and runs the payload through the EXISTING v2
         decoder + validator. Unknown slug, missing table, offline — all
         resolve to null and the caller shows the standard invalid-link
         feedback. Never throws. */
      try{
        if(!isValidShareSlug(slug))return null;
        const sb=await shortLinksSupabase();
        if(!sb)return null;
        const {data,error}=await sb.from('share_links').select('payload').eq('slug',slug).maybeSingle();
        if(error||!data||typeof data.payload!=='string')return null;
        const payload=await shareDecodeAny(data.payload);
        if(!validSharePayload(payload))return null;
        return payload;
      }catch(_){return null;}
    }
    function clearShortSharePath(){
      /* Mirrors clearShareHash: after acting on (or dismissing) a short-link
         share, drop the /s/<slug> suffix so a reload doesn't re-offer it.
         #177 follow-up: also clears attempted-but-invalid /s/<segment> paths
         so the invalid-link toast doesn't replay on reload. */
      try{
        if(typeof location==='undefined'||!location)return;
        if(!shortLinkAttemptFromPath(location.pathname))return;
        let base=location.pathname.replace(/(?:^|\/)s\/[^\/]+\/?$/,'');
        if(!base)base='/';
        else if(base[base.length-1]!=='/')base+='/';
        history.replaceState(null,'',base+location.search);
      }catch(_){}
    }

    /* ---- 404.html SPA-fallback handoff ---- */
    function spaBaseForPath(pathname){
      /* The redirect target 404.html uses. MUST stay in sync with the
         inline copy in 404.html: project Pages serves under
         /workout-app-accounts/, prod serves at the domain root. */
      return (pathname||'').indexOf('/workout-app-accounts/')===0?'/workout-app-accounts/':'/';
    }
    function takeSpaRedirectSlug(){
      /* One-shot consume of the 404.html handoff. Returns the attempted slug
         segment for any /s/<segment> path (#177 follow-up: malformed slugs
         must also reach the invalid-link feedback, not be silently dropped);
         anything else is ignored (the key is always cleared so it never
         replays). */
      try{
        if(typeof sessionStorage==='undefined')return null;
        const saved=sessionStorage.getItem(SPA_REDIRECT_KEY);
        if(saved!=null)sessionStorage.removeItem(SPA_REDIRECT_KEY);
        if(!saved)return null;
        const m=/^([^?#]*)/.exec(saved);
        return m?shortLinkAttemptFromPath(m[1]):null;
      }catch(_){return null;}
    }

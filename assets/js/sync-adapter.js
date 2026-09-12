/* ===== module: sync-adapter.js ===== */
    /** Supabase client/transport adapter for the sync system (split from sync.js, #99 B15).
     *
     *  The client is lazily created via dynamic import() of the CDN build inside
     *  this classic script — if the CDN is unreachable the app degrades
     *  silently to signed-out local-only behavior. The session persists in
     *  localStorage and magic-link redirects are detected by default.
     *  (The publishable key ships in the app by design.)
     */
    var Sync = window.Sync = window.Sync || {};
    (function(){
      'use strict';
      const SUPABASE_URL='https://kbiikscyyiedgzijamnu.supabase.co';
      const SUPABASE_PUBLISHABLE_KEY='sb_publishable_OcWd1Wt0WKMtMpI3jBIGUg_kJ4kJ3wn';

      let supabaseClient=null, supabaseUnavailable=false;

      /** Lazily import the Supabase client. Dynamic import in try/catch so an
          unreachable CDN (offline / blocked) leaves the app fully working. */
      async function getSupabase(){
        if(supabaseClient)return supabaseClient;
        if(supabaseUnavailable)return null;
        try{
          const mod=await import('https://esm.sh/@supabase/supabase-js@2');
          supabaseClient=mod.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
          return supabaseClient;
        }catch(err){supabaseUnavailable=true;return null;}
      }
      function resetSupabaseUnavailable(){supabaseUnavailable=false;}
      async function signedInUser(){
        const sb=await getSupabase();
        if(!sb)return null;
        try{const {data}=await sb.auth.getSession();return data&&data.session&&data.session.user?data.session.user:null;}
        catch(_){return null;}
      }
      /* #70: Safari reports failed fetches as TypeError "Load failed" — a
         cryptic dead end. Translate network-type failures into something
         actionable everywhere sync/auth touches the network. */
      function isNetworkError(err){
        if(typeof navigator!=='undefined'&&navigator&&navigator.onLine===false)return true;
        const m=String((err&&(err.message||err))||'').toLowerCase();
        return /load failed|failed to fetch|network error|network request failed|fetch failed|econn|etimedout|enotfound|socket/.test(m);
      }

      Sync.getSupabase=getSupabase;
      Sync.resetSupabaseUnavailable=resetSupabaseUnavailable;
      Sync.signedInUser=signedInUser;
      Sync.isNetworkError=isNetworkError;
    })();
    /* Global shims retained for compatibility (their last call sites were the
       parked onboarding gate, deleted #99 B1). New code should use the Sync
       namespace. */
    function getSupabase(){return Sync.getSupabase();}
    function signedInUser(){return Sync.signedInUser();}

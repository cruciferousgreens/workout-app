/* ===== module: sync-auth.js ===== */
    /** Auth: session lifecycle, sign-in code, profile updates, sign out, the
     *  login-transition adopt/upload step, and resume/init (split from sync.js, #99 B15).
     *
     *  - Login paradigm (user 2026-09-11): the login TRANSITION is
     *    adopt-vs-upload, never a merge. Remote has data (existing account)
     *    → discard local syncable state and adopt the cloud wholesale.
     *    Remote empty (new account) → upload local (keep it). This runs once
     *    per uid, gated on a persisted adopted-uid marker so reloads,
     *    back-online resumes, and visibility changes never re-trigger it.
     *  - A17: handleAuthChange refreshes lastAuthProfile from the live
     *    session's user_metadata — it no longer resets the profile, so the
     *    display name and account type persist in memory across auth changes.
     */
     /* Module map (v1.006) — Key: initSync(), sendSignInLink(), verifySignInCode(), signOutAccount(), adoptOrUploadOnSignIn(), handleAuthChange(). Depends on: sync-adapter (session/client), sync-engine (merge/push), persistence (syncable keys). */
    var Sync = window.Sync = window.Sync || {};
    (function(){
      'use strict';
      /* Login-transition marker (user 2026-09-11): the adopt-vs-upload decision
         must run exactly once per account sign-in, never on reload/online/
         visibility resume (resumeSync calls handleAuthChange on all of those —
         wiping there would destroy offline edits). Set when the transition
         settles for a uid; cleared on sign-out and account deletion. */
      const ADOPTED_UID_KEY='workout-app:adopted-uid';
      function getAdoptedUid(){try{return localStorage.getItem(ADOPTED_UID_KEY)||null;}catch(_){return null;}}
      function setAdoptedUid(uid){try{localStorage.setItem(ADOPTED_UID_KEY,uid);}catch(_){}}
      function clearAdoptedUid(){try{localStorage.removeItem(ADOPTED_UID_KEY);}catch(_){}}
      let syncInitialized=false, authListenerAttached=false;

      /* ===== identity state =====
         Sync.lastAuthUid is the source of truth; the bare global `lastAuthUid`
         is kept in sync for pre-existing callers (share.js). */
      Sync.lastAuthUid=Sync.lastAuthUid||null;
      Sync.lastAuthEmail=Sync.lastAuthEmail||'';
      /* Keep the bare global in sync from load for pre-existing readers (share.js). */
      try{if(window.lastAuthUid===undefined)window.lastAuthUid=null;}catch(_){}
      /* Account profile (2026-09-10, #30): display name + account_type live in
         Supabase user_metadata so they sync across devices with the session. */
      Sync.lastAuthProfile=Sync.lastAuthProfile||{display_name:'',account_type:'free'};
      function setAuthIdentity(uid,email){
        Sync.lastAuthUid=uid;
        Sync.lastAuthEmail=email||'';
        try{window.lastAuthUid=uid;}catch(_){} /* global shim for share.js */
      }
      /* ===== sign-in code =====
         #215: the Supabase sign-in actions, parameterized so the Settings
         account card and the share sign-in modal reuse the same logic with
         their own inputs and status writers. Both return true on success. */
      async function requestSignInCode(opts){
        const email=(opts&&opts.email||'').trim();
        const setStatus=(opts&&opts.setStatus)||Sync.setAccountStatus;
        if(!email||email.indexOf('@')<0){setStatus('Enter a valid email address.',true);return false;}
        const left=Sync.magicLinkCooldownRemaining();
        if(left>0){setStatus('Wait '+Math.ceil(left/1000)+'s before requesting another link.',true);return false;}
        const sb=await Sync.getSupabase();
        if(!sb){setStatus('Can\u2019t reach the network \u2014 try again when you\u2019re online.',true);return false;}
        setStatus('Sending code\u2026');
        try{
          const {error}=await sb.auth.signInWithOtp({email:email,options:{emailRedirectTo:location.origin+location.pathname}});
          /* Cooldown starts on any completed attempt — even a rate-limited one —
             so rapid taps can't burn the Supabase email quota. */
          Sync.startMagicLinkCooldown();
          if(error){setStatus(sendLinkErrorText(error),true);return false;}
          return true;
        }catch(err){setStatus(requestErrorText(err,'Could not send the code.'),true);return false;}
      }
      async function sendSignInLink(){
        /* Settings wrapper: same logic, plus the card's progressive disclosure. */
        const input=$('#accountEmail');
        const ok=await requestSignInCode({email:(input&&input.value||''),setStatus:Sync.setAccountStatus});
        if(!ok)return;
        /* #75: progressive disclosure — reveal the code step once the email is sent. */
        const otpStep=$('#otpStep');
        if(otpStep)otpStep.hidden=false;
        /* #124 (user 2026-09-11): after sending, the status says only this — the
           OTP field sits directly above the status line, and the code-first
           flow is primary (#75). */
        Sync.setAccountStatus('Code sent, enter it above.');
      }
      /* ===== 6-digit sign-in code (2026-09-11) =====
         verifyOtp needs no PKCE code verifier, so it completes wherever the
         email is read — including the iPhone home-screen app, whose storage
         is isolated from Safari and which never sees a tapped magic link. */
      async function confirmSignInCode(opts){
        const email=(opts&&opts.email||'').trim();
        const token=(opts&&opts.token||'').trim().replace(/[\s-]+/g,'');
        const setStatus=(opts&&opts.setStatus)||Sync.setAccountStatus;
        if(!email||email.indexOf('@')<0){setStatus('Enter your email address above first.',true);return false;}
        if(!token){setStatus('Enter the code from the email.',true);return false;}
        const sb=await Sync.getSupabase();
        if(!sb){setStatus('Can\u2019t reach the network \u2014 try again when you\u2019re online.',true);return false;}
        setStatus('Verifying code\u2026');
        try{
          const {error}=await sb.auth.verifyOtp({email:email,token:token,type:'email'});
          if(error){setStatus(otpErrorText(error),true);return false;}
          /* onAuthStateChange -> handleAuthChange picks up the session and
             runs the first sync cycle. */
          setStatus('');
          return true;
        }catch(err){setStatus(requestErrorText(err,'Could not verify the code.'),true);return false;}
      }
      async function verifySignInCode(){
        /* Settings wrapper: same logic, reading the card's inputs. */
        const emailInput=$('#accountEmail');
        const input=$('#accountOtp');
        const ok=await confirmSignInCode({email:(emailInput&&emailInput.value||''),token:(input&&input.value||''),setStatus:Sync.setAccountStatus});
        if(ok&&input)input.value='';
      }
      /* Friendlier wording for "Email me a code" send failures (#70). */
      function sendLinkErrorText(error){
        const msg=String((error&&error.message)||'');
        const low=msg.toLowerCase();
        if(low.indexOf('rate limit')>=0||low.indexOf('too many')>=0||/after \d+ second/.test(low))
          return 'Too many requests \u2014 wait a moment, then tap \u2018Email me a code\u2019 again.';
        if(low.indexOf('error sending')>=0||low.indexOf('could not send')>=0)
          return 'Couldn\u2019t send the email \u2014 double-check the address and try again.';
        return msg||'Could not send the code.';
      }
      /* Friendlier wording for the common code failures (#70: cryptic errors). */
      function otpErrorText(error){
        const msg=String((error&&error.message)||'');
        const low=msg.toLowerCase();
        if(low.indexOf('expired')>=0)return 'That code expired \u2014 tap \u2018Email me a code\u2019 for a fresh one.';
        if(low.indexOf('invalid')>=0||low.indexOf('used')>=0||low.indexOf('token')>=0)return 'That code didn\u2019t work \u2014 double-check it against the email and try again.';
        return msg||'Could not verify the code.';
      }
      function requestErrorText(err,fallback){
        if(Sync.isNetworkError(err))return 'Can\u2019t reach the network \u2014 check your connection and try again.';
        return (err&&err.message)||fallback;
      }
      /* ===== profile / sign out ===== */
      async function saveDisplayName(){
        const sb=await Sync.getSupabase();
        if(!sb){Sync.setAccountStatus('Can\u2019t reach the network \u2014 try again when you\u2019re online.',true);return;}
        const value=(($('#editNameInput')&&$('#editNameInput').value)||'').trim().slice(0,60);
        try{
          const {error}=await sb.auth.updateUser({data:{display_name:value}});
          if(error){Sync.setAccountStatus(error.message,true);return;}
        }catch(err){Sync.setAccountStatus((err&&err.message)||'Could not save the name.',true);return;}
        Sync.lastAuthProfile.display_name=value;
        const d=$('#editNameDialog');if(d)d.close();
        Sync.setAccountStatus('');
        Sync.renderAccount();
      }
      async function signOutAccount(){
        const sb=await Sync.getSupabase();
        try{if(sb)await sb.auth.signOut();}catch(_){}
        setAuthIdentity(null,'');
        Sync.lastAuthProfile={display_name:'',account_type:'free'};
        /* The next sign-in for any account re-runs the adopt-vs-upload
           transition (the adopted marker must not survive sign-out). */
        clearAdoptedUid();
        /* User 2026-09-12 (major bug): signing out actually signs out — the
           device is wiped clean of workout data instead of keeping it. The
           cloud copy re-adopts on the next sign-in, so nothing is lost. */
        if(typeof wipeLocalUserData==='function')wipeLocalUserData({removeSyncKeys:true});
        if(Sync.resetSyncMeta)Sync.resetSyncMeta();
        Sync.setAccountStatus('Signed out.');
        Sync.renderAccount();
        /* A share preview paints before auth resolves — let it re-render so
           the primary action matches the account state (user 2026-09-12). */
        if(typeof noteShareAuthChanged==='function'){try{noteShareAuthChanged();}catch(_){}}
        /* Reload into the clean, signed-out state (mirrors delete-account). */
        setTimeout(()=>location.reload(),1200);
      }
      async function syncNowManual(){
        Sync.setAccountStatus('Syncing\u2026');
        const ok=await Sync.syncCycle();
        if(ok)Sync.setAccountStatus('');
        else Sync.setAccountStatus('Sync unavailable \u2014 sign in and check your connection.',true);
        Sync.renderAccount();
      }
      /* ===== login-transition adopt-vs-upload (user 2026-09-11) ===== */
      /** Login transition: remote has data (existing account) → discard local
          syncable state and adopt the cloud wholesale (no merge); remote empty
          (new account) → upload local (keep it). Returns true when the
          transition settled; false on offline/fetch error — the caller then
          wipes NOTHING and leaves the adopted marker unset so a later sign-in
          retries. Never wipe on uncertain state. */
      async function adoptOrUploadOnSignIn(user){
        Sync.ensureSyncMeta();
        const sb=await Sync.getSupabase();
        if(!sb||!navigator.onLine)return false;
        let rows;
        try{
          const res=await sb.from('user_data').select('key,value,updated_at').eq('user_id',user.id);
          if(res.error){Sync.showSyncError(res.error);return false;}
          rows=res.data;
        }catch(err){Sync.showSyncError(err);return false;}
        const byKey={};
        (rows||[]).forEach(r=>{if(r&&typeof r.key==='string')byKey[r.key]=r;});
        const remoteHasData=SYNCABLE_KEYS.some(k=>byKey[k]&&!Sync.isEmptySyncValue(k,byKey[k].value));
        if(!remoteHasData){
          /* New account: upload local (keep it) — the existing first-sign-in
             migration path. */
          const ok=await Sync.syncCycle();
          if(ok)Sync.setAccountStatus('Signed in \u2014 your data was saved to your account.');
          return ok;
        }
        /* Existing account: discard local syncable state, adopt remote
           wholesale. Keys with no remote row are cleared locally so stale
           device state can't resurrect on the next push. Tombstones clear too —
           the cloud is authoritative for this account. */
        Sync.clearTombstoneRegistry();
        const meta=Sync.getSyncMeta();
        for(const key of SYNCABLE_KEYS){
          const remote=byKey[key];
          if(remote)Sync.applyRemoteKey(key,remote);
          else{
            Sync.clearSyncableKey(key);
            meta.keys[key]={updatedAt:new Date(0).toISOString(),snapshot:Sync.snapshotOf(key),dirty:false};
          }
        }
        if(typeof mergeCustomExercises==='function'){try{mergeCustomExercises();}catch(_){}}
        Sync.saveSyncMeta();
        persistNow();
        Sync.rerenderCurrentView();
        meta.everSynced=true;
        Sync.saveSyncMeta();
        Sync.setAccountStatus('Signed in \u2014 loaded your cloud data. Anything previously on this device was replaced.');
        return true;
      }
      async function handleAuthChange(session){
        const user=session&&session.user?session.user:null;
        const uid=user?user.id:null;
        const meta=(user&&user.user_metadata)||{};
        /* A17: refresh the profile from the live session's user_metadata —
           the display name and account type persist in memory across auth
           changes instead of being reset. */
        Sync.lastAuthProfile={display_name:meta.display_name||'',account_type:meta.account_type||'free'};
        /* Seed account_type=free once so the structure exists from the start;
           nothing about pricing changes — everything stays free. */
        if(user&&!meta.account_type){
          try{const sb=await Sync.getSupabase();if(sb)await sb.auth.updateUser({data:{account_type:'free'}});}catch(_){}
        }
        if(uid===Sync.lastAuthUid&&syncInitialized){Sync.renderAccount();return;}
        setAuthIdentity(uid,user?(user.email||''):'');
        /* A share preview paints before auth resolves — let it re-render so
           the primary action matches the account state (user 2026-09-12). */
        if(typeof noteShareAuthChanged==='function'){try{noteShareAuthChanged();}catch(_){}}
        if(!user){clearAdoptedUid();Sync.renderAccount();return;}
        /* Login transition (user 2026-09-11): adopt-vs-upload runs once per uid.
           Same-uid resumes (reload/online/visibility) skip it — the adopted
           marker proves the transition already settled. */
        const SYNCING_TEXT='Syncing\u2026';
        Sync.setAccountStatus(SYNCING_TEXT);
        try{
          if(getAdoptedUid()===uid){await Sync.syncCycle();Sync.setAccountStatus('');}
          else{
            const settled=await adoptOrUploadOnSignIn(user);
            if(settled)setAdoptedUid(uid);
            /* adoptOrUploadOnSignIn sets its own final status on every settled
               or error path; only clear here when it returned silently
               (offline/unreachable), so 'Syncing…' doesn't linger. */
            const statusEl=$('#accountStatus');
            if(statusEl&&statusEl.textContent===SYNCING_TEXT)Sync.setAccountStatus('');
            /* Unsettled: wipe NOTHING, marker stays unset, a later sign-in
               retries the transition. */
          }
          syncInitialized=true;
        }catch(err){Sync.showSyncError(err);}
        Sync.renderAccount();
      }
      /* ===== resume / init ===== */
      async function resumeSync(){
        /* #70: capture before Supabase init — on success the client strips
           ?code= from the URL, so a lingering code plus no session afterwards
           means the link failed (expired, already used, or opened in a
           different browser: PKCE links only work where they were requested).
           getSession() awaits init, so the exchange has settled by the check. */
        const hadAuthCode=/[?&]code=/.test(location.search);
        const hashErr=Sync.authCallbackErrorText();
        const sb=await Sync.getSupabase();
        if(!sb){
          if(hashErr||hadAuthCode)Sync.showAuthRecovery((hashErr||'That sign-in link didn\u2019t work.')+' No network connection \u2014 reconnect and try again.');
          else Sync.setAccountStatus('Sync unavailable offline \u2014 your data stays on this device.',true);
          return;
        }
        try{
          if(!authListenerAttached){
            authListenerAttached=true;
            sb.auth.onAuthStateChange((_event,s)=>{handleAuthChange(s).catch(()=>{});});
          }
          const {data}=await sb.auth.getSession();
          const session=data&&data.session?data.session:null;
          await handleAuthChange(session);
          if(!session&&(hadAuthCode||hashErr)){
            Sync.showAuthRecovery((hashErr||'That sign-in link didn\u2019t work \u2014 it may have expired, already been used, or been opened in a different browser.')+' Enter the code from the email below, or tap \u2018Email me a code\u2019 for a fresh one.');
          }
          /* Startup / back-online catch-up for an already-signed-in user:
             handleAuthChange no-ops for the same uid, so run a cycle explicitly. */
          if(session&&syncInitialized){
            Sync.setAccountStatus('Syncing\u2026');
            await Sync.syncCycle();
            Sync.setAccountStatus('');
          }
        }catch(_){/* stay local-only */}
        Sync.renderAccount();
      }
      function initSync(){
        Sync.wireAccountUI();
        Sync.renderAccount();
        /* 'online' re-arms the CDN import (getSupabase caches failures) and resumes. */
        window.addEventListener('online',()=>{Sync.resetSupabaseUnavailable();resumeSync().catch(()=>{});});
        /* A tab that was hidden/suspended may have missed its debounced push
           (background timers don't fire reliably) — catch up when visible again. */
        document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeSync().catch(()=>{});});
        resumeSync().catch(()=>{});
      }

      Sync.getAdoptedUid=getAdoptedUid;
      Sync.setAdoptedUid=setAdoptedUid;
      Sync.clearAdoptedUid=clearAdoptedUid;
      Sync.sendSignInLink=sendSignInLink;
      Sync.verifySignInCode=verifySignInCode;
      Sync.requestSignInCode=requestSignInCode;
      Sync.confirmSignInCode=confirmSignInCode;
      Sync.saveDisplayName=saveDisplayName;
      Sync.signOutAccount=signOutAccount;
      Sync.syncNowManual=syncNowManual;
      Sync.adoptOrUploadOnSignIn=adoptOrUploadOnSignIn;
      Sync.handleAuthChange=handleAuthChange;
      Sync.resumeSync=resumeSync;
      Sync.initSync=initSync;
    })();
    /* Global shims for pre-existing call sites. `lastAuthUid` stays a real
       global because share.js reads it; it mirrors Sync.lastAuthUid. */
    function initSync(){return Sync.initSync();}

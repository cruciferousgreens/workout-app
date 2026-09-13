/* ===== module: sync-account-ui.js ===== */
    /** Account UI: status line, toasts, sync errors, and the Settings account
     *  card + dialogs (split from sync.js, #99 B15).
     *
     *  Auth actions live in sync-auth.js; this file only presents them in the
     *  DOM and owns the account-related DOM ids.
     */
     /* Module map (v1.006) — Key: renderAccount(), wireAccountUI(), tickMagicLinkCooldown(), showSyncError(), syncToast(). Depends on: sync-auth.js actions, sync-engine status, the Sync namespace. */
    var Sync = window.Sync = window.Sync || {};
    (function(){
      'use strict';
      /* ===== status line + toasts ===== */
      function setAccountStatus(msg,isError){
        const el=$('#accountStatus');
        if(el){el.textContent=msg||'';el.classList.toggle('is-error',!!isError);}
        /* A fresh non-error status clears the sync-retry affordance. */
        if(!isError){const retry=$('#retrySyncButton');if(retry)retry.hidden=true;}
      }
      /* Sync-path errors (user 2026-09-12): a big import on a flaky connection
         surfaces Safari's raw "TypeError: Load failed" — translate it like the
         auth flows do (#70), offer a manual retry, and schedule one automatic
         retry. Keys stay dirty, so any later change retries too. */
      function syncErrorText(err){
        if(Sync.isNetworkError(err))return 'Sync failed — could not reach the network. Check your connection and try again.';
        return 'Sync failed: '+((err&&err.message)||'please try again.');
      }
      let syncRetryTimer=null;
      function showSyncError(err){
        setAccountStatus(syncErrorText(err),true);
        const retry=$('#retrySyncButton');if(retry)retry.hidden=false;
        if(Sync.isNetworkError(err)){
          clearTimeout(syncRetryTimer);
          syncRetryTimer=setTimeout(()=>{Sync.syncCycle().catch(()=>{});},15000);
        }
      }
      /* Transient toast for sync events (mirrors the app's #appToast pattern).
         Falls back to the account status line if the toast host is absent. */
      /* #99 B12: one shared toast service (utilities.js) — same timers as
         showToast, so a sync toast can no longer clobber an app toast
         mid-display. Keeps the account-status fallback for when the toast
         host is absent. */
      function syncToast(msg){
        toastService(msg,{onAbsent:()=>setAccountStatus(msg)});
      }
      /* ===== account card (Settings) ===== */
      function renderAccount(){
        Sync.ensureSyncMeta();
        const signedIn=!!Sync.lastAuthUid;
        const outEl=$('#accountSignedOut'),inEl=$('#accountSignedIn');
        if(!outEl||!inEl)return;
        outEl.hidden=signedIn;inEl.hidden=!signedIn;
        if(signedIn){
          const rowEmail=$('#accountRowEmail');
          if(rowEmail)rowEmail.textContent=Sync.lastAuthEmail||'';
          const dlgEmail=$('#accountDialogEmail');
          if(dlgEmail)dlgEmail.textContent=Sync.lastAuthEmail||'';
          const profile=Sync.lastAuthProfile||{display_name:'',account_type:'free'};
          const nameEl=$('#accountDialogName');
          if(nameEl)nameEl.textContent=profile.display_name||'—';
          const planEl=$('#accountDialogPlan');
          if(planEl)planEl.textContent=profile.account_type==='free'?'Free plan':String(profile.account_type||'Free plan');
          const syncEl=$('#accountDialogSync');
          if(syncEl)syncEl.textContent=Sync.getSyncMeta().lastSyncAt?new Date(Sync.getSyncMeta().lastSyncAt).toLocaleString():'Not synced yet';
        }
      }
      /* ===== magic-link resend cooldown (2 min, survives reload) ===== */
      const MAGIC_LINK_COOLDOWN_MS=120000;
      const MAGIC_LINK_COOLDOWN_KEY='workout-magiclink-cooldown';
      let magicLinkCooldownTimer=null;
      function magicLinkCooldownRemaining(){
        let ts=0;
        try{ts=parseInt(localStorage.getItem(MAGIC_LINK_COOLDOWN_KEY)||'0',10)||0;}catch(_){}
        return Math.max(0,ts+MAGIC_LINK_COOLDOWN_MS-Date.now());
      }
      function fmtCooldown(ms){
        const s=Math.ceil(ms/1000),m=Math.floor(s/60);
        return m+':'+String(s%60).padStart(2,'0');
      }
      function tickMagicLinkCooldown(){
        const btn=$('#sendMagicLinkButton');
        const left=magicLinkCooldownRemaining();
        if(left<=0){
          if(magicLinkCooldownTimer){clearInterval(magicLinkCooldownTimer);magicLinkCooldownTimer=null;}
          if(btn){btn.disabled=false;btn.textContent='Email me a code';}
          try{localStorage.removeItem(MAGIC_LINK_COOLDOWN_KEY);}catch(_){}
          return;
        }
        if(btn){btn.disabled=true;btn.textContent='Resend in '+fmtCooldown(left);}
      }
      function startMagicLinkCooldown(){
        try{localStorage.setItem(MAGIC_LINK_COOLDOWN_KEY,String(Date.now()));}catch(_){}
        tickMagicLinkCooldown();
        if(magicLinkCooldownTimer)clearInterval(magicLinkCooldownTimer);
        magicLinkCooldownTimer=setInterval(tickMagicLinkCooldown,1000);
      }
      /* #70: a failed magic-link attempt must leave a usable recovery path:
         reveal the code step, lift the resend cooldown (it started when the
         original link was sent), and drop the stale code/error from the URL. */
      function clearMagicLinkCooldown(){
        if(magicLinkCooldownTimer){clearInterval(magicLinkCooldownTimer);magicLinkCooldownTimer=null;}
        try{localStorage.removeItem(MAGIC_LINK_COOLDOWN_KEY);}catch(_){}
        const btn=$('#sendMagicLinkButton');
        if(btn){btn.disabled=false;btn.textContent='Email me a code';}
      }
      /* #70: surface human-readable magic-link errors. Supabase puts auth
         failures in the URL hash (#error=...&error_description=...) when the
         redirect itself carries an error. Returns the message, or null. */
      function authCallbackErrorText(){
        const hash=location.hash||'';
        if(!hash.includes('error='))return null;
        const params=new URLSearchParams(hash.slice(1));
        const desc=(params.get('error_description')||'').toLowerCase();
        const code=(params.get('error')||'').toLowerCase();
        let msg='That sign-in link didn\u2019t work.';
        if(typeof navigator!=='undefined'&&navigator&&navigator.onLine===false)msg='No network connection when that link was opened. Reconnect and try again.';
        else if(desc.includes('expired')||code.includes('expired'))msg='That sign-in link expired.';
        else if(desc.includes('already')||desc.includes('used')||code.includes('invalid'))msg='That sign-in link was already used or is invalid.';
        return msg;
      }
      function showAuthRecovery(msg){
        const s=$('#otpStep');
        if(s)s.hidden=false;
        clearMagicLinkCooldown();
        /* Drop the stale ?code= / #error= so a refresh doesn't re-trigger. */
        try{
          const u=new URL(location.href);
          u.searchParams.delete('code');
          u.hash='';
          history.replaceState(null,'',u.pathname+u.search+u.hash);
        }catch(_){}
        setAccountStatus(msg,true);
      }
      /* ===== wiring ===== */
      /* #286 (user 2026-09-12): post-workout signed-out nudge. Finishing a
         workout while signed out pops a dialog explaining sync/backup, with
         Sign in / Dismiss and a persisted "Don't show again". The flag is a
         local-only localStorage key — the user is signed out, so there is
         nothing to sync it to. */
      const SIGNIN_NUDGE_DISMISSED_KEY='workout-signin-nudge-dismissed';
      function signinNudgeDismissed(){try{return localStorage.getItem(SIGNIN_NUDGE_DISMISSED_KEY)==='1';}catch(_){return false;}}
      function setSigninNudgeDismissed(){try{localStorage.setItem(SIGNIN_NUDGE_DISMISSED_KEY,'1');}catch(_){}}
      function maybeShowSigninNudge(){
        try{if(Sync&&Sync.lastAuthUid)return;}catch(_){} /* signed in: nothing to nudge */
        if(signinNudgeDismissed())return;
        const d=$('#signinNudgeDialog');if(!d)return;
        const cb=$('#signinNudgeDontShow');if(cb)cb.checked=false;
        try{d.showModal();}catch(_){}
      }
      function wireSigninNudge(){
        const closeNudge=()=>{
          if($('#signinNudgeDontShow')?.checked)setSigninNudgeDismissed();
          $('#signinNudgeDialog')?.close();
        };
        $('#closeSigninNudge')?.addEventListener('click',closeNudge);
        $('#signinNudgeDismiss')?.addEventListener('click',closeNudge);
        $('#signinNudgeSignIn')?.addEventListener('click',()=>{
          if($('#signinNudgeDontShow')?.checked)setSigninNudgeDismissed();
          $('#signinNudgeDialog')?.close();
          /* Take the user to the Settings account section to sign in. */
          try{if(typeof showSettings==='function')showSettings();}catch(_){}
          const card=$('#accountSignedOut');
          if(card){try{card.scrollIntoView({block:'start'});}catch(_){}try{$('#accountEmail')?.focus({preventScroll:true});}catch(_){}}
        });
      }
      Sync.maybeShowSigninNudge=maybeShowSigninNudge;
      function wireAccountUI(){
        wireSigninNudge(); /* #286 */
        const send=$('#sendMagicLinkButton');
        if(send)send.addEventListener('click',()=>{Sync.sendSignInLink().catch(()=>{});});
        const verify=$('#verifyOtpButton');
        if(verify)verify.addEventListener('click',()=>{Sync.verifySignInCode().catch(()=>{});});
        const otp=$('#accountOtp');
        if(otp)otp.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();Sync.verifySignInCode().catch(()=>{});}});
        const row=$('#accountRowButton');
        if(row)row.addEventListener('click',()=>{renderAccount();const d=$('#accountDialog');if(d)d.showModal();});
        /* Manual sync retry (user 2026-09-12): after a failure the keys stay
           dirty, but nothing would retry until the next local change. */
        const retry=$('#retrySyncButton');
        if(retry)retry.addEventListener('click',()=>{retry.hidden=true;setAccountStatus('Syncing…');Sync.syncCycle().catch(()=>{});});
        const closeDlg=$('#closeAccountDialog');
        if(closeDlg)closeDlg.addEventListener('click',()=>{const d=$('#accountDialog');if(d)d.close();});
        const out=$('#accountDialogSignOut');
        if(out)out.addEventListener('click',()=>{const d=$('#accountDialog');if(d)d.close();Sync.signOutAccount().catch(()=>{});});
        /* #37: delete account — confirmation, then wipe remote + local data and sign out. */
        const del=$('#accountDialogDelete');
        if(del)del.addEventListener('click',()=>{const d=$('#accountDialog');if(d)d.close();const cd=$('#deleteAccountDialog');if(cd)cd.showModal();});
        const closeDel=$('#closeDeleteAccount');
        if(closeDel)closeDel.addEventListener('click',()=>$('#deleteAccountDialog').close());
        const cancelDel=$('#cancelDeleteAccount');
        if(cancelDel)cancelDel.addEventListener('click',()=>$('#deleteAccountDialog').close());
        const confirmDel=$('#confirmDeleteAccount');
        if(confirmDel)confirmDel.addEventListener('click',async()=>{
          $('#deleteAccountDialog').close();
          /* Shared wipe (efficiency pass 2026-09-12). #99 C1: in-memory FIRST —
             wipeRemoteData() snapshots live memory into syncMeta, and
             persistNow() (5s interval + pagehide) would otherwise resurrect
             everything from memory within seconds. */
          wipeLocalUserData({removeSyncKeys:true});
          Sync.resetSyncMeta(); /* force the engine to rebuild empty inside wipeRemoteData */
          await Sync.wipeRemoteData();
          await Sync.signOutAccount();
          /* The client key cannot delete the Supabase Auth user (no delete-user
             edge function exists) — report honestly, then reload into the clean,
             signed-out state. */
          setAccountStatus('Signed out and all data erased.',true);
          setTimeout(()=>location.reload(),1500);
        });
        const now=$('#accountDialogSyncNow');
        if(now)now.addEventListener('click',()=>{Sync.syncNowManual().catch(()=>{});});
        const edit=$('#accountDialogEditName');
        if(edit)edit.addEventListener('click',()=>{const input=$('#editNameInput');if(input)input.value=(Sync.lastAuthProfile&&Sync.lastAuthProfile.display_name)||'';const d=$('#editNameDialog');if(d)d.showModal();});
        const cancelEdit=$('#cancelEditName');
        if(cancelEdit)cancelEdit.addEventListener('click',()=>$('#editNameDialog').close());
        const dismissEdit=$('#dismissEditName');
        if(dismissEdit)dismissEdit.addEventListener('click',()=>$('#editNameDialog').close());
        const saveName=$('#saveNameButton');
        if(saveName)saveName.addEventListener('click',()=>{Sync.saveDisplayName().catch(()=>{});});
        /* Resume an in-progress resend cooldown across reloads. */
        if(magicLinkCooldownRemaining()>0){startMagicLinkCooldown();/* #75: a code was already sent — keep the OTP step visible. */const s=$('#otpStep');if(s)s.hidden=false;}
      }

      Sync.setAccountStatus=setAccountStatus;
      Sync.showSyncError=showSyncError;
      Sync.syncErrorText=syncErrorText;
      Sync.syncToast=syncToast;
      Sync.renderAccount=renderAccount;
      Sync.magicLinkCooldownRemaining=magicLinkCooldownRemaining;
      Sync.startMagicLinkCooldown=startMagicLinkCooldown;
      Sync.clearMagicLinkCooldown=clearMagicLinkCooldown;
      Sync.authCallbackErrorText=authCallbackErrorText;
      Sync.showAuthRecovery=showAuthRecovery;
      Sync.wireAccountUI=wireAccountUI;
    })();

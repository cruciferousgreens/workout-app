
/* ===== module: sync.js ===== */
    /** Accounts sync (Supabase, local-first).
     *
     *  - localStorage stays the read path: the app works offline exactly as
     *    today, signed out or not.
     *  - When signed in and online, a debounced outbox pushes changed keys to
     *    the `user_data` table and pulls newer remote keys in the background.
     *  - The live workout draft is NEVER synced (ephemeral device-local state).
     *  - Conflict policy: collection keys (workouts, templates, tags, programs,
     *    custom exercises, favorites) UNION by id when both sides hold different
     *    items — neither device's entries are ever silently lost. Membership
     *    merges; per-item content and all scalar keys stay last-write-wins by
     *    updated_at. Empty-state guards still apply: empty never clobbers real
     *    data. A short toast notes when a merge happened.
     *  - Known limit: deletes don't propagate through a union — an item deleted
     *    on device A is resurrected if device B still holds it at merge time
     *    (tombstones = future work).
     *  - If the Supabase CDN is unreachable, everything degrades silently to
     *    the signed-out local-only behavior.
     */
    const SUPABASE_URL='https://kbiikscyyiedgzijamnu.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY='sb_publishable_OcWd1Wt0WKMtMpI3jBIGUg_kJ4kJ3wn';
    const SYNC_META_KEY='workout-sync:v1';
    const SYNC_PUSH_DEBOUNCE_MS=2500;

    let supabaseClient=null, supabaseUnavailable=false;
    let syncMeta=null; /* {keys:{<key>:{updatedAt,snapshot,dirty}},lastSyncAt,everSynced} */
    let lastAuthUid=null, lastAuthEmail='';
    /* Account profile (2026-09-10, #30): display name + account_type live in
       Supabase user_metadata so they sync across devices with the session. */
    let lastAuthProfile={display_name:'',account_type:'free'};
    let syncPushTimer=null, syncInitialized=false;

    /** Lazily import the Supabase client. Dynamic import in try/catch so an
        unreachable CDN (offline / blocked) leaves the app fully working.
        The client persists the session in localStorage and detects the
        magic-link redirect (detectSessionInUrl defaults to true). */
    async function getSupabase(){
      if(supabaseClient)return supabaseClient;
      if(supabaseUnavailable)return null;
      try{
        const mod=await import('https://esm.sh/@supabase/supabase-js@2');
        supabaseClient=mod.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
        return supabaseClient;
      }catch(err){supabaseUnavailable=true;return null;}
    }
    function ensureSyncMeta(){
      if(syncMeta)return syncMeta;
      let parsed=null;
      try{const raw=localStorage.getItem(SYNC_META_KEY);if(raw)parsed=JSON.parse(raw);}catch(_){}
      syncMeta=(parsed&&typeof parsed==='object')?parsed:{};
      if(!syncMeta.keys||typeof syncMeta.keys!=='object')syncMeta.keys={};
      return syncMeta;
    }
    function saveSyncMeta(){try{localStorage.setItem(SYNC_META_KEY,JSON.stringify(syncMeta));}catch(_){}}
    function snapshotOf(key){
      try{const s=JSON.stringify(getSyncableValue(key));return typeof s==='string'?s:'null';}
      catch(_){return 'null';}
    }
    /** "Empty" for the adoption guards: never adopt an empty remote over real
        local data, and never push empty local state over real remote data. */
    function isEmptySyncValue(key,value){
      if(value==null)return true;
      if(Array.isArray(value)){
        if(key==='templates')return !value.some(t=>t&&!t.builtIn);
        return value.length===0;
      }
      if(typeof value==='object')return Object.keys(value).length===0;
      return false;
    }
    /** Called from persistNow(): mark keys whose value changed since the last
        snapshot as dirty and schedule a debounced background push. Runs even
        signed out / offline — the push itself no-ops until a session exists. */
    function markSyncDirty(){
      ensureSyncMeta();
      const now=new Date().toISOString();
      let any=false;
      for(const key of SYNCABLE_KEYS){
        const snap=snapshotOf(key);
        const m=syncMeta.keys[key];
        if(!m||m.snapshot!==snap){syncMeta.keys[key]={updatedAt:now,snapshot:snap,dirty:true};any=true;}
      }
      if(any){saveSyncMeta();scheduleSyncPush();}
    }
    function scheduleSyncPush(){
      clearTimeout(syncPushTimer);
      syncPushTimer=setTimeout(()=>{syncCycle().catch(()=>{});},SYNC_PUSH_DEBOUNCE_MS);
    }
    async function signedInUser(){
      const sb=await getSupabase();
      if(!sb)return null;
      try{const {data}=await sb.auth.getSession();return data&&data.session&&data.session.user?data.session.user:null;}
      catch(_){return null;}
    }
    /** Push every dirty key. Returns true when there was nothing to do or the
        push succeeded; false when offline, signed out, or failed. */
    async function pushDirtyKeys(){
      ensureSyncMeta();
      const sb=await getSupabase();
      if(!sb||!navigator.onLine)return false;
      const user=await signedInUser();
      if(!user)return false;
      const dirty=SYNCABLE_KEYS.filter(key=>syncMeta.keys[key]&&syncMeta.keys[key].dirty);
      if(!dirty.length)return true;
      for(const key of dirty){
        const value=getSyncableValue(key);
        /* Never upsert a null value: if a key's accessor isn't ready (e.g. a
           mixed old/new asset load during a service-worker update), skip it —
           it stays dirty and retries on a later cycle once assets converge. */
        if(value===undefined)continue;
        if(value===null){
          /* Null local state (e.g. no active program): delete the remote row
             so a stale value can't resurrect on another device. The column is
             NOT NULL, so upserting null would abort the whole push. Needs the
             DELETE RLS policy (same as the delete-all wipe). */
          const {error:delError}=await sb.from('user_data').delete().eq('user_id',user.id).eq('key',key);
          if(delError){setAccountStatus('Sync failed: '+delError.message);return false;}
          syncMeta.keys[key].dirty=false;
          continue;
        }
        const row={user_id:user.id,key:key,value:value,updated_at:syncMeta.keys[key].updatedAt};
        const {error}=await sb.from('user_data').upsert(row,{onConflict:'user_id,key'});
        if(error){setAccountStatus('Sync failed: '+error.message);return false;}
        syncMeta.keys[key].dirty=false;
      }
      syncMeta.lastSyncAt=new Date().toISOString();
      saveSyncMeta();renderAccount();
      return true;
    }
    /** Apply one remote row to local state and record its timestamp/snapshot. */
    function applyRemoteKey(key,remote){
      setSyncableValue(key,remote.value);
      syncMeta.keys[key]={updatedAt:remote.updated_at,snapshot:snapshotOf(key),dirty:false};
    }
    /* ===== union merge for collection keys (Justin's call 2026-09-10) ===== */
    /** Keys whose values are collections: when both sides hold different items,
        they union by id instead of last-write-wins. */
    const MERGE_KEYS=new Set(['completed','templates','tags','exerciseTagPresets','archivedPrograms','customExercises','favorites']);
    /** Identity stamp for union dedupe: object id for id-bearing items,
        case-insensitive string for tag lists (matches mergeTagLists), exact
        string for id lists like favorites. Id-less objects fall back to their
        JSON so identical content dedupes. */
    function mergeStamp(key,item){
      if(item&&typeof item==='object'){
        if(item.id!=null)return 'id:'+String(item.id);
        return 'json:'+JSON.stringify(item);
      }
      const s=String(item);
      return (key==='tags'||key==='exerciseTagPresets')?'str:'+s.toLowerCase():'str:'+s;
    }
    function unionSyncArrays(key,localArr,remoteArr){
      const seen=new Set(),out=[];
      const push=item=>{const k=mergeStamp(key,item);if(!seen.has(k)){seen.add(k);out.push(item);}};
      (Array.isArray(localArr)?localArr:[]).forEach(push);
      (Array.isArray(remoteArr)?remoteArr:[]).forEach(push);
      return out;
    }
    function idMultiset(key,arr){
      const counts=new Map();
      (Array.isArray(arr)?arr:[]).forEach(item=>{
        const k=mergeStamp(key,item);
        counts.set(k,(counts.get(k)||0)+1);
      });
      return counts;
    }
    function sameIdMultiset(a,b){
      if(a.size!==b.size)return false;
      for(const [k,v] of a)if(b.get(k)!==v)return false;
      return true;
    }
    /** Returns true when the union actually adds membership either side lacks
        (order-only differences don't count — those converge via LWW adopt). */
    function unionAddsMembership(key,localArr,remoteArr){
      const mLocal=idMultiset(key,localArr),mRemote=idMultiset(key,remoteArr);
      const mUnion=idMultiset(key,unionSyncArrays(key,localArr,remoteArr));
      return !(sameIdMultiset(mUnion,mLocal)&&sameIdMultiset(mUnion,mRemote));
    }
    /* Transient toast for sync events (mirrors the app's #appToast pattern).
       Falls back to the account status line if the toast host is absent. */
    let syncToastTimer=null;
    function syncToast(msg){
      try{
        const el=document.getElementById('appToast');
        if(!el){setAccountStatus(msg);return;}
        el.textContent=msg;el.className='app-toast';el.hidden=false;
        requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
        clearTimeout(syncToastTimer);
        syncToastTimer=setTimeout(()=>{
          el.classList.remove('show');
          setTimeout(()=>{if(!el.classList.contains('show'))el.hidden=true;},300);
        },3600);
      }catch(_){}
    }
    /** Pull all remote rows; adopt newer ones (last-write-wins per key, with
        empty-guards so real data is never clobbered by empty state). First
        sign-in with zero remote rows uploads every non-empty local key
        (migration). Returns true on success. */
    async function pullRemote(){
      ensureSyncMeta();
      const sb=await getSupabase();
      if(!sb||!navigator.onLine)return false;
      const user=await signedInUser();
      if(!user)return false;
      const {data:rows,error}=await sb.from('user_data').select('key,value,updated_at').eq('user_id',user.id);
      if(error){setAccountStatus('Sync failed: '+error.message);return false;}
      const byKey={};
      (rows||[]).forEach(r=>{if(r&&typeof r.key==='string')byKey[r.key]=r;});
      /* First-sync baseline: last-write-wins needs a local timestamp. Seed it
         from the payload's savedAt so long-standing local data beats an older
         remote write instead of losing to it. */
      let baseline=null;
      if(!syncMeta.everSynced){
        try{
          const raw=localStorage.getItem(PERSIST_KEY);
          const d=raw?JSON.parse(raw):null;
          if(d&&d.savedAt)baseline=new Date(d.savedAt).toISOString();
        }catch(_){}
      }
      let changed=false,customChanged=false,didMerge=false;
      for(const key of SYNCABLE_KEYS){
        let m=syncMeta.keys[key];
        const isNew=!m;
        if(!m)m=syncMeta.keys[key]={updatedAt:baseline||new Date(0).toISOString(),snapshot:snapshotOf(key),dirty:false};
        const remote=byKey[key];
        const localVal=getSyncableValue(key);
        const localEmpty=isEmptySyncValue(key,localVal);
        if(!remote){
          /* No remote row: upload non-empty local state (first-sign-in migration). */
          if(!localEmpty&&(isNew||m.snapshot!==snapshotOf(key))){m.updatedAt=new Date().toISOString();m.snapshot=snapshotOf(key);m.dirty=true;}
          continue;
        }
        const remoteEmpty=isEmptySyncValue(key,remote.value);
        if(remoteEmpty&&!localEmpty){m.updatedAt=new Date().toISOString();m.snapshot=snapshotOf(key);m.dirty=true;continue;}
        if(!remoteEmpty&&localEmpty){
          /* Adopt real remote data over empty local state — unless the empty
             local state is a deliberate delete waiting to push (m.dirty), in
             which case the delete wins and must not be resurrected. */
          if(!m.dirty){applyRemoteKey(key,remote);changed=true;if(key==='customExercises')customChanged=true;}
          continue;
        }
        if(remote.updated_at>m.updatedAt){
          if(MERGE_KEYS.has(key)&&!remoteEmpty&&!localEmpty&&unionAddsMembership(key,localVal,remote.value)){
            /* Genuine conflict on a collection: union by id so neither side's
               items are lost. Marked dirty so the merged result converges to
               the cloud on push. Per-item content still follows last-write-wins
               via the fall-through below when membership is identical. */
            const merged=unionSyncArrays(key,localVal,remote.value);
            setSyncableValue(key,merged);
            m.updatedAt=new Date().toISOString();
            m.snapshot=snapshotOf(key);
            m.dirty=true;changed=true;didMerge=true;
            if(key==='customExercises')customChanged=true;
            continue;
          }
          applyRemoteKey(key,remote);changed=true;if(key==='customExercises')customChanged=true;
        }
      }
      saveSyncMeta();
      if(customChanged&&typeof mergeCustomExercises==='function'){try{mergeCustomExercises();}catch(_){}}
      if(didMerge)syncToast('Combined your cloud and device data — nothing was lost.');
      if(changed){
        persistNow();
        rerenderCurrentView();
      }
      syncMeta.lastSyncAt=new Date().toISOString();
      saveSyncMeta();
      return true;
    }
    /** Re-render the visible view after remote changes arrive. Skipped while a
        draft is open so in-progress logging is never disrupted. */
    function rerenderCurrentView(){
      try{
        if(workoutState.draft)return;
        const v=state.activeView;
        if(v==='dashboard'&&typeof renderDashboard==='function')renderDashboard();
        else if(v==='library'&&typeof renderLibrary==='function')renderLibrary();
        else if(v==='workout'&&typeof renderWorkoutScreen==='function')renderWorkoutScreen();
        else if(v==='program'&&typeof renderProgram==='function')renderProgram();
        else if(v==='stats'&&typeof renderStats==='function')renderStats();
        else if(v==='settings'&&typeof renderSettings==='function')renderSettings();
        if(typeof updateLiveWorkoutIndicator==='function')updateLiveWorkoutIndicator();
      }catch(_){}
    }
    /* ===== account UI (Settings) ===== */
    function setAccountStatus(msg){
      const el=$('#accountStatus');
      if(el)el.textContent=msg||'';
    }
    function renderAccount(){
      ensureSyncMeta();
      const signedIn=!!lastAuthUid;
      const outEl=$('#accountSignedOut'),inEl=$('#accountSignedIn');
      if(!outEl||!inEl)return;
      outEl.hidden=signedIn;inEl.hidden=!signedIn;
      if(signedIn){
        const rowEmail=$('#accountRowEmail');
        if(rowEmail)rowEmail.textContent=lastAuthEmail||'';
        const dlgEmail=$('#accountDialogEmail');
        if(dlgEmail)dlgEmail.textContent=lastAuthEmail||'';
        const nameEl=$('#accountDialogName');
        if(nameEl)nameEl.textContent=lastAuthProfile.display_name||'—';
        const planEl=$('#accountDialogPlan');
        if(planEl)planEl.textContent=lastAuthProfile.account_type==='free'?'Free plan':String(lastAuthProfile.account_type||'Free plan');
        const syncEl=$('#accountDialogSync');
        if(syncEl)syncEl.textContent=syncMeta.lastSyncAt?new Date(syncMeta.lastSyncAt).toLocaleString():'Not synced yet';
      }
    }
    async function sendSignInLink(){
      const input=$('#accountEmail');
      const email=(input&&input.value||'').trim();
      if(!email||email.indexOf('@')<0){setAccountStatus('Enter a valid email address.');return;}
      const left=magicLinkCooldownRemaining();
      if(left>0){setAccountStatus('Wait '+fmtCooldown(left)+' before requesting another link.');return;}
      const sb=await getSupabase();
      if(!sb){setAccountStatus('Can\u2019t reach the network \u2014 try again when you\u2019re online.');return;}
      setAccountStatus('Sending sign-in link\u2026');
      try{
        const {error}=await sb.auth.signInWithOtp({email:email,options:{emailRedirectTo:location.origin+location.pathname}});
        /* Cooldown starts on any completed attempt — even a rate-limited one —
           so rapid taps can't burn the Supabase email quota. */
        startMagicLinkCooldown();
        if(error){setAccountStatus(error.message);return;}
        setAccountStatus('Check your email for the sign-in link.');
      }catch(err){setAccountStatus((err&&err.message)||'Could not send the link.');}
    }
    async function saveDisplayName(){
      const sb=await getSupabase();
      if(!sb){setAccountStatus('Can\u2019t reach the network \u2014 try again when you\u2019re online.');return;}
      const value=(($('#editNameInput')&&$('#editNameInput').value)||'').trim().slice(0,60);
      try{
        const {error}=await sb.auth.updateUser({data:{display_name:value}});
        if(error){setAccountStatus(error.message);return;}
      }catch(err){setAccountStatus((err&&err.message)||'Could not save the name.');return;}
      lastAuthProfile.display_name=value;
      const d=$('#editNameDialog');if(d)d.close();
      setAccountStatus('');
      renderAccount();
    }
    async function signOutAccount(){
      const sb=await getSupabase();
      try{if(sb)await sb.auth.signOut();}catch(_){}
      lastAuthUid=null;lastAuthEmail='';lastAuthProfile={display_name:'',account_type:'free'};
      setAccountStatus('Signed out. Your data stays on this device.');
      renderAccount();
    }
    /** Best-effort remote wipe for "Delete all data": removes the user's rows
        server-side too. Returns true when the remote is confirmed empty; on
        failure the dirty-flagged empty state (set by markSyncDirty in the
        delete handler) converges via the normal push path instead. */
    async function wipeRemoteData(){
      const sb=await getSupabase();
      if(!sb||!navigator.onLine)return false;
      try{
        const {data}=await sb.auth.getSession();
        const user=data&&data.session&&data.session.user?data.session.user:null;
        if(!user)return false;
        const {error}=await sb.from('user_data').delete().eq('user_id',user.id);
        if(error)return false;
      }catch(_){return false;}
      /* Converged: remote rows are gone — align local snapshots with the empty state. */
      ensureSyncMeta();
      const now=new Date().toISOString();
      for(const key of SYNCABLE_KEYS)syncMeta.keys[key]={updatedAt:now,snapshot:snapshotOf(key),dirty:false};
      saveSyncMeta();
      return true;
    }
    async function syncNowManual(){
      setAccountStatus('Syncing\u2026');
      const ok=await syncCycle();
      if(ok)setAccountStatus('');
      else setAccountStatus('Sync unavailable \u2014 sign in and check your connection.');
      renderAccount();
    }
    /* One pull+push round trip, guarded against concurrent runs. */
    let syncBusy=false;
    async function syncCycle(){
      if(syncBusy)return false;
      syncBusy=true;
      try{
        ensureSyncMeta();
        const pulled=await pullRemote();
        if(pulled)await pushDirtyKeys();
        if(pulled&&!syncMeta.everSynced){syncMeta.everSynced=true;saveSyncMeta();}
        return pulled;
      }finally{syncBusy=false;}
    }
    async function handleAuthChange(session){
      const user=session&&session.user?session.user:null;
      const uid=user?user.id:null;
      const meta=(user&&user.user_metadata)||{};
      lastAuthProfile={display_name:meta.display_name||'',account_type:meta.account_type||'free'};
      /* Seed account_type=free once so the structure exists from the start;
         nothing about pricing changes — everything stays free. */
      if(user&&!meta.account_type){
        try{const sb=await getSupabase();if(sb)await sb.auth.updateUser({data:{account_type:'free'}});}catch(_){}
      }
      if(uid===lastAuthUid&&syncInitialized){renderAccount();return;}
      lastAuthUid=uid;lastAuthEmail=user?(user.email||''):'';
      if(!user){renderAccount();return;}
      setAccountStatus('Syncing\u2026');
      try{
        await syncCycle();
        syncInitialized=true;
        setAccountStatus('');
      }catch(err){setAccountStatus('Sync failed: '+((err&&err.message)||err));}
      renderAccount();
    }
    function wireAccountUI(){
      const send=$('#sendMagicLinkButton');
      if(send)send.addEventListener('click',()=>{sendSignInLink().catch(()=>{});});
      const row=$('#accountRowButton');
      if(row)row.addEventListener('click',()=>{renderAccount();const d=$('#accountDialog');if(d)d.showModal();});
      const closeDlg=$('#closeAccountDialog');
      if(closeDlg)closeDlg.addEventListener('click',()=>{const d=$('#accountDialog');if(d)d.close();});
      const out=$('#accountDialogSignOut');
      if(out)out.addEventListener('click',()=>{const d=$('#accountDialog');if(d)d.close();signOutAccount().catch(()=>{});});
      const now=$('#accountDialogSyncNow');
      if(now)now.addEventListener('click',()=>{syncNowManual().catch(()=>{});});
      const edit=$('#accountDialogEditName');
      if(edit)edit.addEventListener('click',()=>{const input=$('#editNameInput');if(input)input.value=lastAuthProfile.display_name||'';const d=$('#editNameDialog');if(d)d.showModal();});
      const cancelEdit=$('#cancelEditName');
      if(cancelEdit)cancelEdit.addEventListener('click',()=>$('#editNameDialog').close());
      const dismissEdit=$('#dismissEditName');
      if(dismissEdit)dismissEdit.addEventListener('click',()=>$('#editNameDialog').close());
      const saveName=$('#saveNameButton');
      if(saveName)saveName.addEventListener('click',()=>{saveDisplayName().catch(()=>{});});
      /* Resume an in-progress resend cooldown across reloads. */
      if(magicLinkCooldownRemaining()>0)startMagicLinkCooldown();
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
        if(btn){btn.disabled=false;btn.textContent='Email me a sign-in link';}
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
    let authListenerAttached=false;
    async function resumeSync(){
      const sb=await getSupabase();
      if(!sb){setAccountStatus('Sync unavailable offline \u2014 your data stays on this device.');return;}
      try{
        if(!authListenerAttached){
          authListenerAttached=true;
          sb.auth.onAuthStateChange((_event,s)=>{handleAuthChange(s).catch(()=>{});});
        }
        const {data}=await sb.auth.getSession();
        const session=data&&data.session?data.session:null;
        await handleAuthChange(session);
        /* Startup / back-online catch-up for an already-signed-in user:
           handleAuthChange no-ops for the same uid, so run a cycle explicitly. */
        if(session&&syncInitialized){
          setAccountStatus('Syncing\u2026');
          await syncCycle();
          setAccountStatus('');
        }
      }catch(_){/* stay local-only */}
      renderAccount();
    }
    function initSync(){
      wireAccountUI();
      renderAccount();
      /* 'online' re-arms the CDN import (getSupabase caches failures) and resumes. */
      window.addEventListener('online',()=>{supabaseUnavailable=false;resumeSync().catch(()=>{});});
      resumeSync().catch(()=>{});
    }
    initSync();

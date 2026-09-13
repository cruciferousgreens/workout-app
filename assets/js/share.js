
/* ===== module: share.js ===== */
    /* Share-link UI, import, and launch (#32, user 2026-09-12).
       Codec + schema live in share-codec.js (loads just before this file).
       Opening a share link cold renders the shared workout/program
       full-screen; a link arriving while the app is already open pops the
       same card as a modal over the current screen (user 2026-09-12). Start
       workout (primary for signed-out) and Add to my library act over it.
       Accepting copies the workout/program into the recipient's library (any
       custom exercises it references come along too).
       #215 (user 2026-09-12): the signed-out sign-in prompt is a self-contained
       modal flow — intro → inline sign-in → share info — reusing the Settings
       card's magic-link/OTP logic (sync-auth.js) with modal-scoped inputs. */
       /* Module map (v1.006) — Key: renderSharePreview(), importShareCustomExercises(), addSharedTemplateToLibrary()/addSharedProgramToLibrary(), startSharedWorkout(). Depends on: share-codec (loads just before), workout-editor factories, state, persistence. */
    async function parseShareHash(){
      const m=/^#share=(.+)$/.exec(location.hash||'');
      if(!m)return null;
      try{
        const payload=await shareDecodeAny(m[1]);
        if(!validSharePayload(payload))return null;
        return payload;
      }catch(e){return null;}
    }

    /* ---- Link building + delivery (UI entry points) ---- */
    async function shareCode(payload){
      /* v2 (short) when the platform can deflate; v1 otherwise — either
         way the recipient's decoder handles both. Returns the bare code
         (no origin); callers wrap it in the long or short URL. */
      let code=null;
      if(typeof CompressionStream!=='undefined'){
        try{code=await shareEncodeV2(payload);}catch(e){code=null;}
      }
      if(!code)code=shareEncodeV1({...payload,v:1}); /* v1 legacy version, inline:
         SHARE_LEGACY_VERSION is a module-scoped const in share-codec.js and
         is not visible here (#207: this ReferenceError broke the no-deflate
         fallback on older browsers). */
      return code;
    }
    /* Delivering a share link (user 2026-09-12): the link itself must be
       visible. The old flow went straight to the system sheet, which
       prepends the workout name before the link and hides the URL itself
       ("I still don't see share links"). Now the dialog shows the bare
       link with a copy button; the native sheet — sharing the link ONLY,
       no prepended name — is one tap away inside the dialog. */
    async function deliverShareLink(payload){
      /* #207: sharing requires an account. A signed-out tap shows the
         sign-in prompt — no link is generated, short or long. #215: the
         payload is stashed so the prompt can mint it after sign-in. */
      if(!shareSignedIn()){openShareSignInPrompt(payload);return;}
      const field=$('#shareLinkField');
      if(field){field.value='Building link…';}
      const dlg=$('#shareLinkDialog');
      if(dlg&&!dlg.open)dlg.showModal();
      try{
        const code=await shareCode(payload);
        /* #177: signed-in shares mint a server short link (/s/<slug>);
           anything else — signed out, offline, insert failure — keeps the
           existing long link. Sharing never breaks. */
        const short=(typeof tryShortShareLink==='function')?await tryShortShareLink(payload,code):null;
        openShareLinkDialog(short||(location.origin+location.pathname+'#share='+code));
      }catch(e){
        if(field){field.value='';}
        showToast('Could not build a share link for this workout.');
        dlg?.close();
      }
    }
    function openShareLinkDialog(url){
      const field=$('#shareLinkField');
      if(field){field.value=url;}
      const sysBtn=$('#nativeShareLinkBtn');
      if(sysBtn)sysBtn.hidden=!navigator.share;
      const dlg=$('#shareLinkDialog');
      if(dlg&&!dlg.open)dlg.showModal();
    }
    async function shareTemplate(templateId){
      const payload=buildTemplateShare(templateId);
      if(!payload){showToast('Could not build a share link for this workout.');return;}
      await deliverShareLink(payload);
    }
    /* Program workouts share as saved workouts (user 2026-09-12). */
    async function shareTemplateLike(name,exerciseRows){
      const payload=buildTemplateLikeShare(name,exerciseRows);
      if(!payload){showToast('Could not build a share link for this workout.');return;}
      await deliverShareLink(payload);
    }
    async function shareActiveProgram(){
      const payload=buildProgramShare();
      if(!payload){showToast('No active program to share.');return;}
      await deliverShareLink(payload);
    }
    function clearShareHash(){
      /* Acting on (or dismissing) a share clears the hash so a reload
         doesn't re-offer it. */
      history.replaceState(null,'',location.pathname+location.search);
    }
    function shareSignedIn(){
      /* #207: auth can live on the Sync namespace or the window shim
         (sync-auth.js); either one counts. */
      try{if(typeof lastAuthUid!=='undefined'&&lastAuthUid)return true;}catch(_){}
      try{return !!((typeof Sync!=='undefined'&&Sync&&Sync.lastAuthUid)||(typeof window!=='undefined'&&window.Sync&&window.Sync.lastAuthUid));}catch(_){return false;}
    }
    /* #215: the sign-in prompt is a self-contained 3-step flow inside one
       modal — intro → inline sign-in → share info. The share payload is
       stashed when the prompt opens and is minted only after a successful
       sign-in; dismissing at any point before that mints nothing. */
    let pendingSharePayload=null;
    let shareSignInCooldownTimer=null;
    function shareSignInShowStep(n){
      for(let i=1;i<=3;i++){const el=$('#shareSignInStep'+i);if(el)el.hidden=(i!==n);}
    }
    /* #326 (user 2026-09-12): the dialog header must follow the sign-in
       state. Step 3 renders after a successful sign-in, so it gets the
       regular share-dialog copy — otherwise the link sits under a stale
       "Sign in to share" header. Reopening the prompt resets to the
       signed-out copy. */
    function setShareSignInCopy(signedIn){
      const title=$('#shareSignInTitle');
      const desc=$('#shareSignInDesc');
      if(title)title.textContent=signedIn?'Share link':'Sign in to share';
      if(desc)desc.textContent=signedIn?'Send this shared workout with the link below.':'Sharing needs an account. It\u2019s free to sign up.';
    }
    function setShareSignInStatus(msg,isError){
      const el=$('#shareSignInStatus');
      if(el){el.textContent=msg||'';el.classList.toggle('is-error',!!isError);}
    }
    function openShareSignInPrompt(payload){
      pendingSharePayload=payload||null;
      const otp=$('#shareSignInOtp');
      if(otp)otp.value='';
      const otpStep=$('#shareSignInOtpStep');
      if(otpStep)otpStep.hidden=true;
      setShareSignInStatus('');
      shareSignInShowStep(1);
      setShareSignInCopy(false);
      const dlg=$('#shareSignInDialog');
      if(dlg&&!dlg.open)dlg.showModal();
      else showToast('Sign in to share workouts.');
    }
    /* Step 1 → step 2: the sign-in form lives in the modal — no trip to
       Settings. */
    function goShareSignInInline(){
      setShareSignInStatus('');
      shareSignInShowStep(2);
      if(shareSignInCooldownTimer)clearInterval(shareSignInCooldownTimer);
      shareSignInTickCooldown();
      shareSignInCooldownTimer=setInterval(shareSignInTickCooldown,1000);
      const email=$('#shareSignInEmail');
      if(email&&typeof email.focus==='function')email.focus();
    }
    /* The resend cooldown is shared with Settings (same localStorage key via
       Sync.magicLinkCooldownRemaining); this only repaints the modal button. */
    function shareSignInTickCooldown(){
      const btn=$('#shareSignInSendCode');if(!btn)return;
      let left=0;
      try{left=(typeof Sync!=='undefined'&&Sync&&typeof Sync.magicLinkCooldownRemaining==='function')?Sync.magicLinkCooldownRemaining():0;}catch(_){}
      if(left<=0){btn.disabled=false;btn.textContent='Email me a code';}
      else{btn.disabled=true;const s=Math.ceil(left/1000);btn.textContent='Resend in '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
    }
    function stopShareSignInCooldown(){
      if(shareSignInCooldownTimer){clearInterval(shareSignInCooldownTimer);shareSignInCooldownTimer=null;}
    }
    async function shareSignInSendCode(){
      const syncNS=(typeof Sync!=='undefined')?Sync:null;
      const email=(($('#shareSignInEmail')||{}).value||'');
      if(!syncNS||typeof syncNS.requestSignInCode!=='function'){setShareSignInStatus('Sign-in is unavailable right now.',true);return;}
      const ok=await syncNS.requestSignInCode({email:email,setStatus:setShareSignInStatus});
      if(!ok)return;
      const otpStep=$('#shareSignInOtpStep');
      if(otpStep)otpStep.hidden=false;
      setShareSignInStatus('Code sent, enter it above.');
      shareSignInTickCooldown();
      const otp=$('#shareSignInOtp');
      if(otp&&typeof otp.focus==='function')otp.focus();
    }
    async function shareSignInVerifyCode(){
      const syncNS=(typeof Sync!=='undefined')?Sync:null;
      const email=(($('#shareSignInEmail')||{}).value||'');
      const otpEl=$('#shareSignInOtp');
      const token=((otpEl&&otpEl.value)||'');
      if(!syncNS||typeof syncNS.confirmSignInCode!=='function'){setShareSignInStatus('Sign-in is unavailable right now.',true);return;}
      const ok=await syncNS.confirmSignInCode({email:email,token:token,setStatus:setShareSignInStatus});
      if(!ok)return;
      if(otpEl)otpEl.value='';
      /* verifyOtp resolves before onAuthStateChange lands — wait for the
         session to arrive (bounded), then mint the share. */
      const t0=Date.now();
      while(!shareSignedIn()&&Date.now()-t0<8000){
        await new Promise(r=>setTimeout(r,100));
      }
      const dlg=$('#shareSignInDialog');
      if(!dlg||!dlg.open)return; /* dismissed mid-verify — mint nothing */
      if(!shareSignedIn()){setShareSignInStatus('Signed in, but the session didn\u2019t arrive \u2014 try again.',true);return;}
      await shareSignInMintShare();
    }
    async function shareSignInMintShare(){
      /* Step 3: the same build path as the signed-in flow — short link
         first, long-link fallback — displayed inside this modal. */
      const field=$('#shareSignInLinkField');
      if(field)field.value='Building link\u2026';
      shareSignInShowStep(3);
      setShareSignInCopy(true);
      try{
        const code=await shareCode(pendingSharePayload);
        const short=(typeof tryShortShareLink==='function')?await tryShortShareLink(pendingSharePayload,code):null;
        const url=short||(location.origin+location.pathname+'#share='+code);
        if(field)field.value=url;
        const sysBtn=$('#shareSignInNativeBtn');
        if(sysBtn)sysBtn.hidden=!(typeof navigator!=='undefined'&&navigator&&navigator.share);
      }catch(e){
        if(field)field.value='';
        showToast('Could not build a share link for this workout.');
      }
    }
    /* Full-screen share landing (user 2026-09-12): opening a share link
       renders the shared workout/program as its own screen — the recipient
       sees what was shared, with the actions over it. Start workout is the
       primary action for signed-out recipients; Add to my library leads for
       signed-in ones, with Start one tap away either way. There is no
       "Not now": the × backs out to the workout start screen.
       #214: the landing opens OVER a live draft without disturbing it —
       workoutEditorOpen is left alone and the pane selector yields to the
       share preview while it's set; dismissing restores whatever was
       underneath (same principle as #187's logs-over-draft). */
    function openSharePreview(payload,opts={}){
      state.sharePreview=payload;
      state.savedWorkoutId=null;state.builderOpen=false;
      state.workoutHistoryOpen=false;$('#workoutComplete').hidden=true;
      showWorkouts(false,true);
      /* #265: one history entry per preview — system Back dismisses it
         (popstate clears the preview state via backOutOfSharePreview)
         instead of exiting the app (cold open) or leaving a stale preview
         cached (in-app). The boot loading state already pushed; the in-app
         hashchange entry covers its own Back. */
      if(opts.push!==false){
        try{if(!history.state||history.state.sub!=='share')history.pushState({view:'workout',sub:'share'},'',location.href);}catch(_){}
      }
      window.scrollTo(0,0);
    }
    /* #296 (user 2026-09-12): a cold-opened share link must land directly on
       the share landing — never flash the home tab first while the payload
       decodes (hash links) or resolves over the network (server short
       links). The landing renders immediately in a loading state; the
       resolved payload fills it in. */
    function openSharePreviewLoading(){
      state.sharePreview={loading:true};
      state.savedWorkoutId=null;state.builderOpen=false;
      state.workoutHistoryOpen=false;$('#workoutComplete').hidden=true;
      showWorkouts(false,true);
      /* #265: a cold-opened preview is the only history entry — without a
         push, system Back exits the app instead of dismissing the preview.
         Pushing gives Back a popstate to fire within the app. */
      try{if(!history.state||history.state.sub!=='share')history.pushState({view:'workout',sub:'share'},'',location.href);}catch(_){}
      window.scrollTo(0,0);
    }
    function dismissSharePreview(){
      state.sharePreview=null;
      clearShareHash();
      /* #177: also drop a /s/<slug> path so a reload doesn't re-offer it. */
      try{if(typeof clearShortSharePath==='function')clearShortSharePath();}catch(_){}
    }
    /* #265: system Back out of a share preview. Clears the preview state so
       the destination can't render with a stale preview cached, and strips
       a share hash / short path left on the destination entry so a reload
       can't re-offer a dismissed preview. The caller (popstate) then routes
       the destination normally — cold-open Back lands on Home. */
    function backOutOfSharePreview(){
      if(!state.sharePreview)return false;
      state.sharePreview=null;
      try{
        if(/^#share=/.test(location.hash||''))history.replaceState(null,'',location.pathname+location.search);
        if(typeof clearShortSharePath==='function')clearShortSharePath();
      }catch(_){}
      return true;
    }
    /* Exercise names resolve against the payload's own custom exercises
       first — they aren't in the recipient's library until imported. */
    function shareExerciseName(item,payload){
      const custom=(payload.customExercises||[]).find(e=>e.id===item.exerciseId);
      if(custom)return custom.name||'Custom exercise';
      return exercises.find(e=>e.id===item.exerciseId)?.name||'Exercise';
    }
    function shareExerciseSummary(item,payload){
      return exerciseTargetSummary(item,shareExerciseName(item,payload));
    }
    function shareMuscles(exerciseRows,payload){
      return [...new Set((exerciseRows||[]).flatMap(item=>{
        const custom=(payload.customExercises||[]).find(e=>e.id===item.exerciseId);
        const ex=custom||exercises.find(e=>e.id===item.exerciseId);
        return [...(ex?.primary||[]),...(ex?.secondary||[])];
      }))];
    }
    /* The share card renders as its own full-screen page (#214, user
       2026-09-12: the old modal variant is gone — a share link always lands
       on the full page, opening over a live draft without disturbing it).
       Header: a green Start button (#297) plus the bookmark icon next to the
       ×, so the actions are one tap away without scrolling.
       Footer: the full descriptive buttons in the approved pattern —
       full-width primary pill + green text link + quiet grey note.
       #213: every version uses the same pattern and the #180 order per
       account state (signed-in: Add leads; signed-out: Start leads). */
    function sharePreviewCardHtml(payload){
      const isTemplate=payload.kind==='template';
      const rows=isTemplate?(payload.template?.exercises||[]):[];
      const programRows=isTemplate?[]:(payload.program?.workouts||[]).flatMap(w=>w.template?.exercises||[]);
      const muscles=shareMuscles(isTemplate?rows:programRows,payload);
      const totalSets=rows.reduce((n,item)=>n+(item.sets||[]).length,0);
      const customCount=(payload.customExercises||[]).length;
      const meta=isTemplate
        ?`${rows.length} exercise${rows.length===1?'':'s'} · ${totalSets} set${totalSets===1?'':'s'}${customCount?` · includes ${customCount} custom exercise${customCount===1?'':'s'}`:''}`
        :`${(payload.program?.workouts||[]).length} workout${(payload.program?.workouts||[]).length===1?'':'s'}${customCount?` · includes ${customCount} custom exercise${customCount===1?'':'s'}`:''}`;
      const body=isTemplate
        ?(rows.map(item=>{const s=shareExerciseSummary(item,payload);return `<div class="picker-item saved-editor-row"><span><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.meta)}</span></span></div>`;}).join('')||'<p class="section-note">No exercises in this workout.</p>')
        :((payload.program?.workouts||[]).map(w=>{const n=(w.template?.exercises||[]).length;return `<div class="picker-item saved-editor-row"><span><strong>${escapeHtml(w.name||'Workout')}</strong><span>${n} exercise${n===1?'':'s'}</span></span></div>`;}).join('')||'<p class="section-note">No workouts in this program.</p>');
      /* #180: primary action follows the account state (user 2026-09-12):
         Start workout leads for signed-out recipients; Add to my library
         leads for signed-in ones. Programs can't start as one workout. */
      const signedIn=shareSignedIn();
      /* #179: the old two-button row read as redundant (starting already
         saves). One primary per the account state; the other path stays one
         tap away as a quiet text action. */
      const bookmarkBtn=`<button class="share-icon-button" data-share-act="add" type="button" aria-label="Add to my library"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg></button>`;
      /* #297 (user 2026-09-12): the header start control is a green Start
         button, not a bare play icon — the primary action must read at a
         glance. */
      const playBtn=`<button class="primary-button share-start-btn" data-share-act="start" type="button">Start</button>`;
      /* Header icon order follows the #180 action order per state. */
      /* User 2026-09-12: signed-out recipients get the clean first-run
         header — just Start. No bookmark ribbon by it and no × (a new user
         has no app to dismiss back to; system Back still exits). */
      const headerBtns=isTemplate
        ?(signedIn?bookmarkBtn+playBtn:playBtn)
        :(signedIn?bookmarkBtn:'');
      const dismissBtn=signedIn?'<button class="dialog-close" data-share-act="dismiss" type="button" aria-label="Dismiss">×</button>':'';
      const primaryBtn=isTemplate
        ?(signedIn
          ?`<button class="primary-button" data-share-act="add" type="button">Add to my library</button><button class="share-alt-action" data-share-act="start" type="button">or start the workout</button>`
          :`<button class="primary-button" data-share-act="start" type="button">Start workout</button><button class="share-alt-action" data-share-act="add" type="button">or just save it to my library</button>`)
        :`<button class="primary-button" data-share-act="add" type="button">Add to my library</button>`;
      const actions=`<div class="share-actions">${primaryBtn}</div>`;
      const note=isTemplate
        ?`<p class="section-note">Starting also saves it to your library.</p>`
        :'<p class="section-note">Programs save to your library — open one of its workouts to train it.</p>';
      const context=`You opened a shared ${isTemplate?'workout':'program'} link.`; /* #179: landing context */
      return `<div class="completed-card"><span class="continue-kicker">${isTemplate?'Shared workout':'Shared program'}</span><div class="detail-title-row"><h2>${escapeHtml(payload.name||'Shared')}</h2><div class="share-header-actions">${headerBtns}${dismissBtn}</div></div><p class="share-context">${context}</p><p class="completed-meta">${escapeHtml(meta)}</p>
      ${muscles.length?`<div class="section-head"><h3>Muscles worked</h3></div>${workoutBodyMapMarkup(muscles)}<div class="workout-muscles">${muscles.map(m=>musclePill(m)).join('')}</div>`:''}
      <div class="section-head"><h3>${isTemplate?'Exercises':'Workouts'}</h3></div>${body}
      <div class="share-footer-actions">${actions}${note}</div></div>`;
    }
    function wireSharePreviewButtons(root,payload,onDismiss){
      const isTemplate=payload.kind==='template';
      /* Header icons and footer buttons share the same actions — wire all. */
      root.querySelectorAll('[data-share-act="dismiss"]').forEach(b=>b.addEventListener('click',onDismiss));
      root.querySelectorAll('[data-share-act="start"]').forEach(b=>b.addEventListener('click',startSharedWorkout));
      root.querySelectorAll('[data-share-act="add"]').forEach(b=>b.addEventListener('click',()=>{isTemplate?saveSharedWorkout():saveSharedProgram();}));
    }
    /* #307 (user 2026-09-13): the old "Loading…" intermediate page is gone.
       The landing renders the real card layout immediately with skeleton
       placeholders that hydrate in place when the payload resolves — no
       weird intermediate, no layout jump. No × during loading for anyone
       (user 2026-09-13): if a resolve hangs, system Back exits via the
       pushed history entry. Header skeletons mirror the template landing
       (the common case); kind-specific details fill in on hydrate. */
    function sharePreviewSkeletonHtml(){
      const signedIn=shareSignedIn();
      const headerBtns=signedIn
        ?'<span class="skel skel-circle"></span><span class="skel skel-start"></span>'
        :'<span class="skel skel-start"></span>';
      return `<div class="completed-card" aria-busy="true" aria-label="Loading shared link"><span class="continue-kicker">Shared link</span><div class="detail-title-row"><span class="skel skel-title"></span><div class="share-header-actions">${headerBtns}</div></div><p class="share-context"><span class="skel skel-line" style="width:55%"></span></p><p class="completed-meta"><span class="skel skel-line" style="width:40%"></span></p>
      <div class="section-head"><span class="skel skel-line" style="width:130px"></span></div><div class="skel skel-map"></div><div class="workout-muscles"><span class="skel skel-pill"></span><span class="skel skel-pill"></span><span class="skel skel-pill"></span><span class="skel skel-pill"></span></div>
      <div class="section-head"><span class="skel skel-line" style="width:100px"></span></div><div class="skel skel-row" style="margin-bottom:8px"></div><div class="skel skel-row" style="margin-bottom:8px"></div><div class="skel skel-row"></div>
      <div class="share-footer-actions"><div class="share-actions"><span class="skel skel-btn"></span><span class="skel skel-line" style="width:150px;margin-top:8px"></span></div><p class="section-note"><span class="skel skel-line" style="width:60%;margin:0 auto"></span></p></div></div>`;
    }
    function renderSharePreview(){
      const host=$('#sharePreviewBody');if(!host)return;
      const payload=state.sharePreview;
      if(!payload){host.innerHTML='';return;}
      if(payload.loading){
        host.innerHTML=sharePreviewSkeletonHtml();
        return;
      }
      host.innerHTML=sharePreviewCardHtml(payload);
      hydrateBodyMaps();
      wireSharePreviewButtons(host,payload,()=>{collapseWorkoutSubScreen();});
    }
    /* Custom exercises the recipient lacks come along with the share. */
    function importShareCustomExercises(payload){
      let importedCustom=0;
      (payload.customExercises||[]).forEach(ex=>{
        if(!ex?.id||exercises.some(e=>e.id===ex.id))return;
        const copy={...ex,custom:true};
        state.customExercises.push(copy);
        exercises.unshift(copy);
        importedCustom++;
      });
      return importedCustom;
    }
    function addSharedTemplateToLibrary(payload){
      const importedCustom=importShareCustomExercises(payload);
      const src=payload.template||{};
      /* #263: suffixes stay unique across re-accepts.
         #315 (user 2026-09-13): no parenthetical suffix in the name — the
         template carries shared:true and the library renders a SHARED chip. */
      const name=uniqueSuffixedName(src.name||'Shared workout',(workoutState.templates||[]).map(t=>t.name),true);
      /* #290: the id derives from the payload content — the same share
         accepted on another device mints the same id, so sync dedups it.
         An id already present means an explicit re-accept on this device:
         mint a fresh id for the second copy (ids must stay unique). */
      const stableId=stableTemplateId(JSON.stringify({k:payload.kind,n:payload.name,t:src,c:payload.customExercises||[]}));
      const id=(workoutState.templates||[]).some(t=>t.id===stableId)?newTemplateId():stableId;
      const template={id:id,name,shared:true,
        exercises:JSON.parse(JSON.stringify(src.exercises||[]))};
      workoutState.templates.unshift(template);
      schedulePersist();refreshTemplateViews();
      return {template,importedCustom};
    }
    function addSharedProgramToLibrary(payload){
      const importedCustom=importShareCustomExercises(payload);
      const src=payload.program||{};
      /* #263: suffixes stay unique across re-accepts. */
      const existing=[workoutState.activeProgram,...(workoutState.archivedPrograms||[])].filter(Boolean);
      const name=uniqueSuffixedName(src.name||'Shared program',existing.map(p=>p.name));
      /* #290: stable content-derived id — the same share accepted on another
         device mints the same id, so sync dedups it. Re-accept on this
         device (id already present) gets a fresh id for the second copy. */
      const stableId=stableProgramId(JSON.stringify({k:payload.kind,n:payload.name,p:src,c:payload.customExercises||[]}));
      const id=existing.some(p=>p.id===stableId)?newProgramId():stableId;
      /* Shared programs land in the archived list — restoring one to active
         is an explicit user action, never a surprise. */
      const program={id:id,name,length:src.length||4,startWeek:src.startWeek||1,
        focus:src.focus||'',startedAt:localIsoDate(),archivedAt:localIsoDate(),
        progression:src.progression||null,
        workouts:(src.workouts||[]).map(w=>({uid:newProgramWorkoutUid(),name:w.name,
          template:{name:w.template?.name,exercises:JSON.parse(JSON.stringify(w.template?.exercises||[]))}}))};
      workoutState.archivedPrograms.unshift(program);
      schedulePersist();renderProgram();renderDashboard();
      return {program,importedCustom};
    }
    function customNoteFor(n){
      return n?` (+${n} custom exercise${n===1?'':'s'})`:'';
    }
    /* Start (user 2026-09-12): the shared workout begins immediately — and
       it's saved to the library too, so the recipient keeps it either way.
       A live draft in progress keeps its conflict guard. */
    function startSharedWorkout(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='template')return;
      const name=payload.template?.name||payload.name||'Shared workout';
      requestStartWithConflict(name,()=>{
        const {template}=addSharedTemplateToLibrary(payload);
        dismissSharePreview();
        startWorkoutFromTemplate(template.id);
      });
    }
    function saveSharedWorkout(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='template')return;
      const {template,importedCustom}=addSharedTemplateToLibrary(payload);
      dismissSharePreview();
      openSavedWorkoutEditor(template.id);
      showToast(`Added "${template.name}" to your saved workouts${customNoteFor(importedCustom)}.`);
    }
    function saveSharedProgram(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='program')return;
      const {program,importedCustom}=addSharedProgramToLibrary(payload);
      dismissSharePreview();
      showProgram(false);
      showToast(`Added "${program.name}" to your programs${customNoteFor(importedCustom)} — restore it from the Program tab.`);
    }
    /* Auth can resolve after the preview paints (the signed-out layout shows
       first) — re-render so the primary action matches the account state. */
    function noteShareAuthChanged(){
      if(!state.sharePreview)return;
      renderSharePreview();
    }
    /* One-time wiring for the share-link dialog (user 2026-09-12, #32). */
    (function wireShareLink(){
      const closeShareDlg=()=>$('#shareLinkDialog').close();
      $('#closeShareLinkDialog')?.addEventListener('click',closeShareDlg);
      $('#copyShareLinkBtn')?.addEventListener('click',async()=>{
        const field=$('#shareLinkField');
        try{await navigator.clipboard.writeText(field?field.value:'');showToast('Share link copied.');}
        catch(e){field?.select?.();showToast('Copy the link above.');}
      });
      /* Native sheet from inside the dialog: the link ONLY, no prepended
         workout name (user 2026-09-12). */
      $('#nativeShareLinkBtn')?.addEventListener('click',async()=>{
        const url=$('#shareLinkField')?.value||'';
        if(!url||!navigator.share)return;
        try{await navigator.share({url});}
        catch(e){/* dismiss = abort, dialog stays open */}
      });
      /* #215: the sign-in prompt is now a self-contained 3-step flow —
         Sign in (primary, first) reveals the sign-in form inline in the
         modal; on success the modal mints the share and shows the link.
         Nothing routes to Settings anymore. */
      const closeSignInPrompt=()=>{stopShareSignInCooldown();const d=$('#shareSignInDialog');if(d)d.close();};
      $('#closeShareSignInDialog')?.addEventListener('click',closeSignInPrompt);
      $('#cancelShareSignIn')?.addEventListener('click',closeSignInPrompt);
      $('#cancelShareSignIn2')?.addEventListener('click',closeSignInPrompt);
      $('#goShareSignIn')?.addEventListener('click',goShareSignInInline);
      $('#shareSignInSendCode')?.addEventListener('click',()=>{shareSignInSendCode().catch(()=>{});});
      $('#shareSignInVerify')?.addEventListener('click',()=>{shareSignInVerifyCode().catch(()=>{});});
      /* #264: Esc (or any non-button dismiss) fires 'close' without going
         through closeSignInPrompt — stop the cooldown on the dialog's close
         event too, or the interval leaks. */
      $('#shareSignInDialog')?.addEventListener('close',stopShareSignInCooldown);
      $('#shareSignInCopyBtn')?.addEventListener('click',async()=>{
        const field=$('#shareSignInLinkField');
        try{await navigator.clipboard.writeText(field?field.value:'');showToast('Share link copied.');}
        catch(e){field?.select?.();showToast('Copy the link above.');}
      });
      /* Native sheet from inside the modal: the link ONLY, no prepended
         workout name (same as the share-link dialog). */
      $('#shareSignInNativeBtn')?.addEventListener('click',async()=>{
        const url=$('#shareSignInLinkField')?.value||'';
        if(!url||!navigator.share)return;
        try{await navigator.share({url});}
        catch(e){/* dismiss = abort, modal stays open */}
      });
      /* Enter submits the inline form, mirroring the Settings card. */
      $('#shareSignInEmail')?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();shareSignInSendCode().catch(()=>{});}});
      $('#shareSignInOtp')?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();shareSignInVerifyCode().catch(()=>{});}});
    })();

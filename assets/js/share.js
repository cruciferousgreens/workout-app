
/* ===== module: share.js ===== */
    /* Share-link UI, import, and launch (#32, user 2026-09-12).
       Codec + schema live in share-codec.js (loads just before this file).
       Opening a share link cold renders the shared workout/program
       full-screen; a link arriving while the app is already open pops the
       same card as a modal over the current screen (user 2026-09-12). Start
       workout (primary for signed-out) and Add to my library act over it.
       Accepting copies the workout/program into the recipient's library (any
       custom exercises it references come along too). */
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
    async function shareLink(payload){
      /* v2 (short) when the platform can deflate; v1 otherwise — either
         way the recipient's decoder handles both. */
      let code=null;
      if(typeof CompressionStream!=='undefined'){
        try{code=await shareEncodeV2(payload);}catch(e){code=null;}
      }
      if(!code)code=shareEncodeV1({...payload,v:SHARE_LEGACY_VERSION});
      return location.origin+location.pathname+'#share='+code;
    }
    /* Delivering a share link (user 2026-09-12): the link itself must be
       visible. The old flow went straight to the system sheet, which
       prepends the workout name before the link and hides the URL itself
       ("I still don't see share links"). Now the dialog shows the bare
       link with a copy button; the native sheet — sharing the link ONLY,
       no prepended name — is one tap away inside the dialog. */
    async function deliverShareLink(payload){
      const field=$('#shareLinkField');
      if(field){field.value='Building link…';}
      const dlg=$('#shareLinkDialog');
      if(dlg&&!dlg.open)dlg.showModal();
      try{
        openShareLinkDialog(await shareLink(payload));
      }catch(e){
        if(field){field.value='';}
        showToast('Could not build a share link for this workout.');
        dlg?.close();
      }
    }
    function openShareLinkDialog(url){
      const field=$('#shareLinkField');
      if(field){field.value=url;}
      const note=$('#shareLinkNote');
      if(note)note.textContent='Send this link to a friend. Opening it shows the full workout — they can start it right away or save it.';
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
      try{return typeof lastAuthUid!=='undefined'&&!!lastAuthUid;}catch(_){return false;}
    }
    /* Full-screen share landing (user 2026-09-12): opening a share link
       renders the shared workout/program as its own screen — the recipient
       sees what was shared, with the actions over it. Start workout is the
       primary action for signed-out recipients; Add to my library leads for
       signed-in ones, with Start one tap away either way. There is no
       "Not now": the × backs out to the workout start screen. */
    function openSharePreview(payload){
      state.sharePreview=payload;
      state.savedWorkoutId=null;state.workoutEditorOpen=false;state.builderOpen=false;
      state.workoutHistoryOpen=false;$('#workoutComplete').hidden=true;
      showWorkouts(false,true);
      window.scrollTo(0,0);
    }
    function dismissSharePreview(){
      state.sharePreview=null;
      clearShareHash();
      /* Also drop the incoming-share modal if it was the one open. */
      const dlg=$('#shareIncomingDialog');
      if(dlg&&dlg.open)dlg.close();
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
    /* The share card markup is shared by the full-screen preview (cold boot
       from a share link) and the incoming-share modal (link tapped while the
       app is already open — user 2026-09-12). Same card, same actions; only
       the dismiss target differs. */
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
      /* Primary action follows the account state (user 2026-09-12): Start
         workout leads for signed-out recipients; Add to my library leads for
         signed-in ones. Programs can't start as one workout — they save. */
      const signedIn=shareSignedIn();
      const startBtn=`<button class="${signedIn?'secondary-button':'primary-button'}" data-share-act="start" type="button">Start workout</button>`;
      const addBtn=`<button class="${signedIn||!isTemplate?'primary-button':'secondary-button'}" data-share-act="add" type="button">Add to my library</button>`;
      const actions=isTemplate?(signedIn?addBtn+startBtn:startBtn+addBtn):addBtn;
      const note=isTemplate
        ?`<p class="section-note">${signedIn?'Starting also saves it to your library.':'No account needed — starting also saves it to your library on this device.'}</p>`
        :'<p class="section-note">Programs save to your library — open one of its workouts to train it.</p>';
      return `<div class="completed-card"><span class="continue-kicker">${isTemplate?'Shared workout':'Shared program'}</span><div class="detail-title-row"><h2>${escapeHtml(payload.name||'Shared')}</h2><button class="dialog-close" data-share-act="dismiss" type="button" aria-label="Dismiss">×</button></div><p class="completed-meta">${escapeHtml(meta)}</p>
      ${muscles.length?`<div class="section-head"><h3>Muscles worked</h3></div>${workoutBodyMapMarkup(muscles)}<div class="workout-muscles">${muscles.map(m=>musclePill(m)).join('')}</div>`:''}
      <div class="section-head"><h3>${isTemplate?'Exercises':'Workouts'}</h3></div>${body}
      <div class="detail-action-buttons"><div class="detail-action-row">${actions}</div>${note}</div></div>`;
    }
    function wireSharePreviewButtons(root,payload,onDismiss){
      const isTemplate=payload.kind==='template';
      root.querySelector('[data-share-act="dismiss"]')?.addEventListener('click',onDismiss);
      root.querySelector('[data-share-act="start"]')?.addEventListener('click',startSharedWorkout);
      root.querySelector('[data-share-act="add"]')?.addEventListener('click',()=>{isTemplate?saveSharedWorkout():saveSharedProgram();});
    }
    function renderSharePreview(){
      const host=$('#sharePreviewBody');if(!host)return;
      const payload=state.sharePreview;
      if(!payload){host.innerHTML='';return;}
      host.innerHTML=sharePreviewCardHtml(payload);
      hydrateBodyMaps();
      wireSharePreviewButtons(host,payload,()=>{collapseWorkoutSubScreen();});
    }
    /* Incoming share modal (user 2026-09-12): a share link tapped while the
       app is already open must not yank the user away from what they're
       doing — it pops the same share card as a modal over the current
       screen. × returns them exactly where they were. */
    function openShareModal(payload){
      state.sharePreview=payload;
      renderShareModal();
      const dlg=$('#shareIncomingDialog');
      if(dlg&&!dlg.open)dlg.showModal();
    }
    function renderShareModal(){
      const host=$('#shareIncomingBody');if(!host)return;
      const payload=state.sharePreview;
      if(!payload){host.innerHTML='';return;}
      host.innerHTML=sharePreviewCardHtml(payload);
      hydrateBodyMaps();
      wireSharePreviewButtons(host,payload,()=>{dismissSharePreview();});
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
      let name=src.name||'Shared workout';
      if((workoutState.templates||[]).some(t=>t.name===name))name=`${name} (shared)`;
      const template={id:newTemplateId(),name,
        exercises:JSON.parse(JSON.stringify(src.exercises||[]))};
      workoutState.templates.unshift(template);
      schedulePersist();refreshTemplateViews();
      return {template,importedCustom};
    }
    function addSharedProgramToLibrary(payload){
      const importedCustom=importShareCustomExercises(payload);
      const src=payload.program||{};
      let name=src.name||'Shared program';
      const existing=[workoutState.activeProgram,...(workoutState.archivedPrograms||[])].filter(Boolean);
      if(existing.some(p=>p.name===name))name=`${name} (shared)`;
      /* Shared programs land in the archived list — restoring one to active
         is an explicit user action, never a surprise. */
      const program={id:newProgramId(),name,length:src.length||4,startWeek:src.startWeek||1,
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
      const dlg=$('#shareIncomingDialog');
      if(dlg&&dlg.open)renderShareModal();
      else renderSharePreview();
    }
    /* One-time wiring for the share-link dialog (user 2026-09-12, #32). */
    (function wireShareLink(){
      const closeShareDlg=()=>$('#shareLinkDialog').close();
      /* Escaping out of the incoming-share modal (Esc key / backdrop) is a
         dismiss: clear the payload and hash so a reload doesn't re-offer it. */
      $('#shareIncomingDialog')?.addEventListener('close',()=>{dismissSharePreview();});
      $('#closeShareLinkDialog')?.addEventListener('click',closeShareDlg);
      $('#closeShareLinkDone')?.addEventListener('click',closeShareDlg);
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
    })();

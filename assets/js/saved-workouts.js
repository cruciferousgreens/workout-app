/* ===== module: saved-workouts.js ===== */
    /* Saved-workout repository, builder UI, and template-launch service
       (split from programs.js, #99 B3). Owns: saved-workout templates
       (list/filter/editor/duplicate/delete), repeat-workout, starting a
       workout from a template, the saved-workout builder (draft autosave,
       exercise cards, configure dialog, persist), and the live-start
       conflict dialog. Program-domain rendering it navigates back to
       (openProgramWorkoutPage) lives in programs.js, which loads right
       after this file. */
    let pendingRepeatWorkout=null;
    function repeatWorkout(workout,confirmed=false){
      if(!workout)return;
      if(workoutState.draft&&!confirmed){pendingRepeatWorkout=workout;$('#replaceDraftDialog').showModal();return;}
      showWorkouts();
      /* #99 H5: a live draft wins over the history sub-pane (was done in render). */
      state.workoutHistoryOpen=false;
      workoutState.draft={
        name:workout.name, date:localIsoDate(), programId:null, programWorkoutUid:null, editingId:null,
        /* #99 B8: canonical clone — A7 (actual RPE stays cleared, only a stored
           target carries) + #175 (weight carried as a real value). */
        exercises:workout.exercises.map(item=>cloneExerciseItem(item,'forNewSession'))
      };
      prepareDraftProgression(workoutState.draft,freeformProgressionConfig());
      schedulePersist();
      state.workoutEditorOpen = true; /* #129: repeat starts the session immediately. */
      renderWorkoutScreen();
    }
    /* A7 (#99): a saved workout stores PRESCRIPTIONS, not history. Last
       session's actual RPE becomes a suggested target — it must never start
       a new session pre-filled as an actual. Canonical clone (#99 B8). */
    function templateExercisesFromCompleted(workout) {
      return workout.exercises.map(item=>cloneExerciseItem(item,'forTemplate'));
    }
    function saveCompletedAsTemplate(workout,statusEl) {
      if(!workout?.exercises?.length)return;
      const template={id:newTemplateId(),name:workout.name||'Saved workout',exercises:templateExercisesFromCompleted(workout)};
      workoutState.templates.unshift(template); schedulePersist();
      const message=`Saved “${template.name}” as a saved workout.`;
      if(statusEl)statusEl.textContent=message; showToast(message);
    }
    function startWorkoutFromTemplate(id) {
      const t=workoutState.templates.find(x=>x.id===id);if(!t)return;
      state.workoutHistoryOpen=false;state.savedWorkoutId=null;
      workoutState.draft={
        name:t.name, date:localIsoDate(), programId:null, programWorkoutUid:null, editingId:null,
        /* #99 B8: canonical clone — A7 (actual RPE never pre-fills; legacy
           templates stored the target in `rpe`, so targetRpe is preferred). */
        exercises:t.exercises.map(x=>cloneExerciseItem(x,'fromTemplate',{noteOpen:!!x.note}))
      };
      prepareDraftProgression(workoutState.draft,freeformProgressionConfig());schedulePersist();
      state.workoutEditorOpen = true; /* #129 rework: Start is tapped from the saved-workout editor. */
      renderWorkoutScreen();
    }
    /* #129 rework (user phone QA 2026-09-12): saved workouts render as clean
       StrongLifts-style cards — name, Built-in badge, exercise count, chevron.
       No inline Edit/Rename/Archive/delete; tapping a card opens the saved
       workout's editor page (never a live workout). The redundant "+ New saved
       workout" button is gone — the hero button is the one creation path. */
    /* Saved-list filter state (user 2026-09-12): one filterable saved-workout
       list. muscles = required primary muscles (AND), inProgram = only
       workouts linked to a program. Saved-workout tags come later. */
    function savedFilterState(){
      state.savedFilter=state.savedFilter||{muscles:[],inProgram:false};
      return state.savedFilter;
    }
    /* Primary muscles hit by saved-workout exercise rows. */
    function savedItemMuscles(exerciseRows){
      const out=new Set();
      (exerciseRows||[]).forEach(item=>{
        const ex=exercises.find(e=>e.id===item.exerciseId);
        (ex?.primary||[]).forEach(m=>out.add(m));
      });
      return [...out];
    }
    /* Which programs reference a saved workout (user 2026-09-12: a saved workout
       may live in multiple programs — shells carry sourceTemplateId, so the
       link survives renames and the model allows many programs per saved workout). */
    function templateProgramNames(templateId){
      const names=[];
      [workoutState.activeProgram,...(workoutState.archivedPrograms||[])].filter(Boolean).forEach(p=>{
        (p.workouts||[]).forEach(w=>{if(w.sourceTemplateId===templateId&&!names.includes(p.name))names.push(p.name);});
      });
      return names;
    }
    function renderWorkoutTemplateList() {
      const host=$('#savedWorkoutList');if(!host)return;
      const filter=savedFilterState();
      const query=($('#savedSearch')?.value||'').trim().toLowerCase();
      const program=workoutState.activeProgram;
      /* One unified list (user 2026-09-12): saved workouts and program workouts
         together, each card carrying its chips (Built-in / program name). */
      const items=[];
      (workoutState.templates||[]).filter(t=>!t.archivedAt).forEach(t=>{
        items.push({kind:'template',id:t.id,name:t.name||'Untitled',builtIn:!!t.builtIn,
          exercises:t.exercises||[],programNames:templateProgramNames(t.id),
          muscles:savedItemMuscles(t.exercises||[])});
      });
      (program?.workouts||[]).forEach(w=>{
        items.push({kind:'program',uid:w.uid,name:w.name||'Untitled',
          exercises:w.template?.exercises||[],programNames:[program.name],
          muscles:savedItemMuscles(w.template?.exercises||[])});
      });
      const matches=item=>{
        if(filter.inProgram&&!item.programNames.length)return false;
        if(filter.muscles.length&&!filter.muscles.every(m=>item.muscles.includes(m)))return false;
        if(query){
          const hay=(item.name+' '+item.exercises.map(e=>exercises.find(x=>x.id===e.exerciseId)?.name||'').join(' ')).toLowerCase();
          if(!hay.includes(query))return false;
        }
        return true;
      };
      const shown=items.filter(matches).sort((a,b)=>a.name.localeCompare(b.name));
      const card=item=>{
        const chips=`${item.kind==='template'&&item.builtIn?'<span class="built-in-label">Built-in</span>':''}${item.programNames.map(n=>`<span class="built-in-label">${escapeHtml(n)}</span>`).join('')}`;
        const count=item.exercises.length;
        const attr=item.kind==='template'?`data-saved-id="${escapeHtml(item.id)}"`:`data-program-workout="${escapeHtml(item.uid)}"`;
        return `<button class="picker-item saved-workout-card" type="button" ${attr} aria-label="Open ${escapeHtml(item.name)}"><span><strong>${escapeHtml(item.name)} ${chips}</strong><span>${count} exercise${count===1?'':'s'}</span></span><span class="picker-state">›</span></button>`;
      };
      const archived=(workoutState.templates||[]).filter(t=>t.archivedAt);
      const archivedCard=t=>card({kind:'template',id:t.id,name:t.name||'Untitled',builtIn:!!t.builtIn,exercises:t.exercises||[],programNames:[],muscles:[]});
      const filtering=query||filter.muscles.length||filter.inProgram;
      host.innerHTML=(shown.length?`<div class="saved-workout-cards">${shown.map(card).join('')}</div>`
        :filtering?'<div class="dialog-empty"><strong>No saved workouts match.</strong><br>Try clearing the search or filters.</div>'
        :'<div class="dialog-empty"><strong>No saved workouts yet.</strong><br>Build a workout, then choose Save workout.</div>')
        +(archived.length?`<details class="archived-saved-disclosure"><summary>Archived (${archived.length})</summary><div class="saved-workout-cards">${archived.map(archivedCard).join('')}</div></details>`:'')
        +`<button class="new-template-button" id="addSavedWorkoutButton" type="button">+ Add saved workout</button>`;
      host.querySelectorAll('[data-saved-id]').forEach(b=>b.addEventListener('click',()=>openSavedWorkoutEditor(b.dataset.savedId)));
      host.querySelectorAll('[data-program-workout]').forEach(b=>b.addEventListener('click',()=>openProgramWorkoutPage(b.dataset.programWorkout)));
      $('#addSavedWorkoutButton')?.addEventListener('click',()=>startSavedBuilder());
      updateSavedFilterBadge();
    }
    function updateSavedFilterBadge(){
      const filter=savedFilterState(),n=filter.muscles.length+(filter.inProgram?1:0);
      const badge=$('#savedFilterCount');
      if(badge){badge.hidden=!n;badge.textContent=n||'';}
      $('#savedFilterBtn')?.classList.toggle('has-filters',!!n);
    }
    function renderSavedFilterDialog(){
      const filter=savedFilterState();
      const all=new Set();
      (workoutState.templates||[]).forEach(t=>savedItemMuscles(t.exercises||[]).forEach(m=>all.add(m)));
      (workoutState.activeProgram?.workouts||[]).forEach(w=>savedItemMuscles(w.template?.exercises||[]).forEach(m=>all.add(m)));
      const muscles=[...all].sort();
      const host=$('#savedMuscleOptions');
      host.innerHTML=muscles.length?muscles.map(m=>`<button class="muscle-option" type="button" data-saved-muscle="${escapeHtml(m)}" aria-pressed="${filter.muscles.includes(m)}">${escapeHtml(titleCase(m))}</button>`).join(''):'<p class="section-note">No muscles in saved workouts yet.</p>';
      host.querySelectorAll('[data-saved-muscle]').forEach(b=>b.addEventListener('click',()=>{
        const m=b.dataset.savedMuscle,f=savedFilterState();
        f.muscles=f.muscles.includes(m)?f.muscles.filter(x=>x!==m):[...f.muscles,m];
        b.setAttribute('aria-pressed',String(f.muscles.includes(m)));
        $('#clearSavedMuscles').hidden=!f.muscles.length;
        updateSavedFilterBadge();schedulePersist(); /* v0.99al: filter survives reloads */
      }));
      $('#clearSavedMuscles').hidden=!filter.muscles.length;
      $('#savedInProgramToggle').setAttribute('aria-pressed',String(filter.inProgram));
    }
    function openSavedFilterDialog(){
      renderSavedFilterDialog();
      $('#savedFilterDialog').showModal();
    }
    /* One-time wiring for the saved-list search + filter (user 2026-09-12). */
    (function wireSavedListControls(){
      $('#savedSearch')?.addEventListener('input',()=>renderWorkoutTemplateList());
      $('#savedFilterBtn')?.addEventListener('click',openSavedFilterDialog);
      $('#closeSavedFilter')?.addEventListener('click',()=>$('#savedFilterDialog').close());
      $('#clearSavedMuscles')?.addEventListener('click',()=>{savedFilterState().muscles=[];renderSavedFilterDialog();updateSavedFilterBadge();schedulePersist();});
      $('#savedInProgramToggle')?.addEventListener('click',e=>{const f=savedFilterState();f.inProgram=!f.inProgram;e.currentTarget.setAttribute('aria-pressed',String(f.inProgram));updateSavedFilterBadge();schedulePersist();});
      $('#clearSavedFilters')?.addEventListener('click',()=>{const f=savedFilterState();f.muscles=[];f.inProgram=false;const s=$('#savedSearch');if(s)s.value='';renderSavedFilterDialog();renderWorkoutTemplateList();schedulePersist();});
      $('#applySavedFilters')?.addEventListener('click',()=>{$('#savedFilterDialog').close();renderWorkoutTemplateList();});
    })();
    /* Saved-workout editor page (user 2026-09-12): view/edit/start a saved
       workout. Edit/Rename/Archive/Delete live here, not on the list. #32
       will add the share-link action here too. */
    function openSavedWorkoutEditor(id){
      if(!workoutState.templates.some(t=>t.id===id))return;
      state.savedWorkoutId=id;state.workoutEditorOpen=false;state.builderOpen=false;renderWorkoutScreen();
    }
    function savedExerciseSummary(item){
      const ex=exercises.find(e=>e.id===item.exerciseId);
      return exerciseTargetSummary(item,ex?.name||'Exercise');
    }
    function renderSavedWorkoutEditor(){
      const host=$('#savedWorkoutBody');if(!host)return;
      const t=workoutState.templates.find(x=>x.id===state.savedWorkoutId);
      if(!t){host.innerHTML='<div class="dialog-empty">Saved workout not found.</div>';return;}
      /* Richer summary (user 2026-09-12): focus, set totals, muscle map. */
      const focusLabel=t.focusKey&&REP_PRESETS[t.focusKey]?(()=>{const p=REP_PRESETS[t.focusKey];
        if(p.amrap)return `${p.label} · from ${p.min} rep`;
        if(p.openTop)return `${p.label} · ${p.min}+ reps`;
        return `${p.label} · ${p.min}–${p.max} reps`;})():'';
      const muscles=[...new Set((t.exercises||[]).flatMap(item=>{const ex=exercises.find(e=>e.id===item.exerciseId);return [...(ex?.primary||[]),...(ex?.secondary||[])];}))];
      const totalSets=(t.exercises||[]).reduce((n,item)=>n+(item.sets||[]).length,0);
      const rows=(t.exercises||[]).map(item=>{const s=savedExerciseSummary(item);return `<div class="picker-item saved-editor-row"><span><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.meta)}</span></span></div>`;}).join('');
      /* Layout (user 2026-09-12): Start sits inline with the workout name,
         top-right (just "Start"), not a full-width button under the stats.
         Edit opens the builder in edit mode (the creation page reused);
         built-in templates show Edit as disabled. Bottom row is Edit +
         Duplicate; Archive is a dashed button beneath. */
      const badges=`${t.builtIn?'<span class="built-in-label">Built-in</span>':''}${t.archivedAt?' <span class="built-in-label">Archived</span>':''}`;
      host.innerHTML=`<div class="completed-card"><span class="continue-kicker">Saved workout</span><div class="detail-title-row"><h2>${escapeHtml(t.name)} ${badges}</h2><span class="title-actions"><button class="icon-button" id="shareSavedWorkoutBtn" type="button" aria-label="Share ${escapeHtml(t.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.6 7.4L12 3l4.4 4.4"/><path d="M6 11.5V19a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 19v-7.5"/></svg></button><button class="start-inline-button" id="startSavedWorkoutBtn" type="button">Start</button></span></div><p class="completed-meta">${t.exercises.length} exercise${t.exercises.length===1?'':'s'} · ${totalSets} set${totalSets===1?'':'s'}${focusLabel?` · Focus: ${escapeHtml(focusLabel)}`:''}</p>
      ${muscles.length?`<div class="section-head"><h3>Muscles worked</h3></div>${workoutBodyMapMarkup(muscles)}<div class="workout-muscles">${muscles.map(m=>musclePill(m)).join('')}</div>`:''}
      <div class="section-head"><h3>Exercises</h3></div>${rows||'<p class="section-note">No exercises yet — add some below.</p>'}
      <div class="detail-action-buttons"><div class="detail-action-row"><button class="secondary-button" id="editSavedWorkoutBtn" type="button" ${t.builtIn?'disabled aria-disabled="true" title="Built-in workouts can\'t be edited — duplicate one to customize it"':''}>Edit</button><button class="secondary-button" id="duplicateSavedWorkoutBtn" type="button">Duplicate</button></div>
      ${t.builtIn?'':`<button class="new-template-button neutral" id="archiveSavedWorkoutBtn" type="button">${t.archivedAt?'Restore':'Archive'}</button>
      <button class="template-delete-text" id="deleteSavedWorkoutBtn" type="button">delete saved workout</button>`}</div></div>`;
      hydrateBodyMaps();
      $('#startSavedWorkoutBtn').addEventListener('click',()=>requestStartSavedWorkout(t.id));
      if(!t.builtIn)$('#editSavedWorkoutBtn')?.addEventListener('click',()=>startSavedBuilder({templateId:t.id}));
      $('#duplicateSavedWorkoutBtn')?.addEventListener('click',()=>duplicateSavedWorkout(t.id));
      $('#shareSavedWorkoutBtn')?.addEventListener('click',()=>shareTemplate(t.id));
      if(!t.builtIn){
        $('#archiveSavedWorkoutBtn')?.addEventListener('click',()=>{
          if(t.archivedAt){delete t.archivedAt;showToast(`Restored “${t.name}”.`);}
          else{t.archivedAt=new Date().toISOString();showToast(`Archived “${t.name}”.`);}
          schedulePersist();refreshTemplateViews();
        });
        $('#deleteSavedWorkoutBtn')?.addEventListener('click',()=>{
          pendingDeleteTemplateId=t.id;
          $('#deleteTemplateDesc').textContent=`Delete “${t.name}”? This cannot be undone.`;
          $('#deleteTemplateDialog').showModal();
        });
      }
    }
    /* Duplicate a saved workout (user 2026-09-12): deep copy with a fresh id —
       the natural way to customize a built-in template. */
    function duplicateSavedWorkout(id){
      const t=workoutState.templates.find(x=>x.id===id);if(!t)return;
      const copy={id:newTemplateId(),name:`${t.name} copy`,focusKey:t.focusKey||null,createdAt:Date.now(),exercises:cloneTemplateExercises(t.exercises||[])};
      workoutState.templates.unshift(copy);
      schedulePersist();
      showToast(`Duplicated as “${copy.name}”.`);
      openSavedWorkoutEditor(copy.id);
    }
    /* "Workout in progress" conflict (user 2026-09-12): starting a saved
       workout OR a program workout while a session is live asks first — back
       to the live workout, or switch (replace the draft). Editing a
       completed log goes through the same modal with edit-flavored copy
       (user 2026-09-12): editing opens the log as a live workout, so it
       must never silently replace the session in progress. One reusable
       modal. */
    let pendingConflictStart=null;
    function requestStartWithConflict(name,startFn,verb){
      if(workoutState.draft){
        pendingConflictStart=startFn;
        const action=verb||'Starting';
        $('#startSavedConflictDesc').textContent=`You have a workout in progress. ${action} “${name}” will replace it.`;
        $('#switchToSavedWorkout').textContent=verb==='Editing'?'Edit anyway':'Switch workout';
        $('#startSavedConflictDialog').showModal();
        return;
      }
      startFn();
    }
    function requestStartSavedWorkout(id){
      const t=workoutState.templates.find(x=>x.id===id);if(!t)return;
      requestStartWithConflict(t.name,()=>startWorkoutFromTemplate(id));
    }
    /* Saved-workout builder (user 2026-09-11): a full-page creator mirroring
       the live editor — name, focus pills, per-set targets — with "Save
       workout" instead of "Finish workout" and no complete checkboxes. The
       builder is in-memory until saved; it survives tab switches via a
       "Saved workout in progress" continue card, like a draft.
       Edit mode (user 2026-09-12): the creation page doubles as the editor.
       `source` is {templateId} for a saved workout or {programUid} for a
       program workout — every tool (focus, configure, supersets, tags,
       reorder) is the same code; only the save destination differs. */
    let pendingBuilderSource=null;
    /* Single "clear the builder draft" (efficiency pass 2026-09-12): every
       path that discards an in-progress builder goes through here so they
       can't disagree on what "clear" means. */
    function clearBuilderDraft(){
      state.savedBuilder=null;
      state.builderReturn=null;
      schedulePersist();
    }
    /* Backing out of the saved-workout builder without saving (user
       2026-09-12): a program-workout edit returns to that workout's page;
       any other builder returns to the Workout start screen. Back (chevron/
       system) keeps the draft — reopening the builder re-offers it; only
       the Discard confirmation clears it. Reads builderReturn before
       clearBuilderDraft() can wipe it. */
    function closeBuilderToReturn(clearDraft){
      const ret=state.builderReturn;
      state.builderOpen=false;
      if(clearDraft)clearBuilderDraft();else schedulePersist();
      const uid=ret&&ret.view==='program'?ret.programWorkoutUid:null;
      const stillThere=uid&&workoutState.activeProgram&&workoutState.activeProgram.workouts.some(w=>w.uid===uid);
      if(ret&&ret.view==='program'){
        /* The workout may have been deleted mid-edit — then the program
           cover is the sane fallback. */
        state.programWorkoutUid=stillThere?uid:null;
        showProgram(false);
      }else{
        renderWorkoutScreen();
      }
      window.scrollTo({top:0});
    }
    function startSavedBuilder(source){
      /* A draft already open -> ask first: keep editing it, or delete it and
         start fresh (user 2026-09-11). */
      if(state.savedBuilder){pendingBuilderSource=source||null;$('#builderDraftExistsDialog').showModal();return;}
      openSavedBuilder(source||null);
    }
    /* Sources describe intent; shells materialize at open time, after any
       draft conflict is resolved (efficiency pass 2026-09-12) — if a draft
       was already in progress and the user keeps it, no orphan "Workout N"
       is left behind. */
    function resolveProgramWorkoutSource(source){
      if(source?.programUid||!source?.newProgramWorkout)return source;
      const program=workoutState.activeProgram;
      if(!program)return null;
      const shell={uid:newProgramWorkoutUid(),name:`Workout ${program.workouts.length+1}`};
      program.workouts.push(shell);
      schedulePersist();
      return {programUid:shell.uid};
    }
    function openSavedBuilder(source){
      pendingBuilderSource=null;
      /* The builder lives on the Workout tab (efficiency pass 2026-09-12):
         the screen owns its tab switch, so no caller has to remember that
         this page "secretly" belongs to another tab. */
      if(state.activeView!=='workout')showWorkouts(false);
      source=resolveProgramWorkoutSource(source);
      const programWorkout=source?.programUid?workoutState.activeProgram?.workouts.find(w=>w.uid===source.programUid):null;
      const template=source?.templateId?workoutState.templates.find(t=>t.id===source.templateId):null;
      const base=programWorkout?.template||template;
      /* Editing clones the exercises so the original is untouched until Save. */
      state.savedBuilder={
        id:template?template.id:newTemplateId(),
        name:programWorkout?programWorkout.name:(template?template.name:''),
        focusKey:base?.focusKey||null,
        exercises:cloneTemplateExercises(base?.exercises||[]),
        editTarget:programWorkout?{kind:'program',uid:programWorkout.uid}:template?{kind:'template',id:template.id}:null
      };
      /* Backing out of a program-workout edit returns to that workout's
         page (user 2026-09-12) — not the program cover, not the Workout tab. */
      state.builderReturn=programWorkout?{view:'program',programWorkoutUid:programWorkout.uid}:null;
      state.builderOpen=true;state.savedWorkoutId=null;state.workoutEditorOpen=false;
      schedulePersist();renderWorkoutScreen();window.scrollTo({top:0});
    }
    /* The builder mirrors the live editor card-for-card (user 2026-09-11):
       same accordion, chevron, corner info button, set rows, add-set row,
       notes, and exercise options -- minus every logging control (no weight,
       RPE, tags, or complete checkboxes). Set inputs hold per-set targets. */
    function builderExerciseCard(item,list){
      const ex=exercises.find(e=>e.id===item.exerciseId);
      const time=exerciseTracking(item,ex)==='time';
      const unit=time?'sec':'reps';
      const uidAttr=escapeHtml(item.uid||'');
      const rp=rangePlaceholder(item.progression,time);
      const rangeSummary=rp.text||'';
      const grouped=item.supersetId&&list.filter(x=>x.supersetId===item.supersetId).length>1;
      const groupNum=grouped?supersetGroupNumber(list,item.supersetId):0;
      const setRows=(item.sets||[]).map((set,i)=>{
        const val=time?(set.seconds??''):(set.r??'');
        return `<div class="builder-set-row"><span class="builder-set-num">${i+1}</span><input class="log-input" type="number" inputmode="numeric" min="1" value="${escapeHtml(String(val))}" placeholder="${escapeHtml(rangeSummary||'Target')}" data-builder-set="${i}" data-builder-uid="${uidAttr}" aria-label="Set ${i+1} target ${unit}"><button class="builder-x" type="button" data-builder-del-set="${i}" data-builder-uid="${uidAttr}" aria-label="Remove set ${i+1}">\u00d7</button></div>`;
      }).join('');
      return `<details class="exercise-accordion workout-exercise" data-builder-exercise="${uidAttr}" ${item.cardOpen===false?'':'open'}>
            <button class="exercise-info-button corner-icon" type="button" data-exercise-info="${escapeHtml(item.exerciseId)}" aria-label="About ${escapeHtml(ex?.name||'exercise')}">i</button>
            <summary class="exercise-accordion-head"><span class="exercise-accordion-chevron" aria-hidden="true">\u203a</span><span class="exercise-accordion-title"><strong>${escapeHtml(ex?.name||'Exercise')}</strong>${rangeSummary?`<small>${escapeHtml(rangeSummary)}</small>`:''}</span></summary>
            <div class="exercise-accordion-body">
            ${grouped?`<div class="superset-band">Superset ${groupNum}</div>`:''}
            <div class="log-labels builder-labels"><span>SET</span><span>${time?'SECONDS':'REPS'}</span><span></span></div>
            <div class="log-sets">${setRows||'<div class="history-empty">No sets yet.</div>'}</div>
            <div class="set-utility-row"><button class="add-set" type="button" data-builder-add-set="${uidAttr}">+ Add set</button>${list.length>1?`<button class="superset-button ${grouped?'active':''}" type="button" data-builder-superset="${uidAttr}">${grouped?'Edit superset':'Create superset'}</button>`:''}</div>
            <div class="exercise-note">${item.noteOpen||item.note?`<textarea id="note-${uidAttr}" data-builder-note="${uidAttr}" aria-label="Exercise notes" placeholder="Cues, setup, pain, or anything to remember">${escapeHtml(item.note||'')}</textarea>`:`<button class="add-note-toggle" type="button" data-builder-add-note="${uidAttr}">Add notes</button>`}</div>
            <details class="advanced-options" ${item.optionsOpen?'open':''}><summary>Exercise options</summary><div class="advanced-options-body"><div class="exercise-tools"><div class="tracking-segment" role="group" aria-label="Track reps or seconds"><button type="button" data-builder-tracking="reps" data-builder-uid="${uidAttr}" aria-pressed="${time?'false':'true'}">Reps</button><button type="button" data-builder-tracking="seconds" data-builder-uid="${uidAttr}" aria-pressed="${time?'true':'false'}">Seconds</button></div></div><div class="builder-targets-row"><span class="range-summary">Targets${rangeSummary?`: ${escapeHtml(rangeSummary)}`:''}</span><button class="small-button" type="button" data-builder-configure="${uidAttr}">Configure</button></div>${progressionSummaryForOptions(item)}<div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-builder-exercise-tags="${uidAttr}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div><div class="options-apply-row"><button class="copy-first-set" type="button" data-builder-copy-first="${uidAttr}" ${item.sets.length<2?'disabled':''}>Apply set 1 to all</button><span class="inline-feedback" data-builder-copy-feedback="${uidAttr}" aria-live="polite"></span></div><div class="remove-exercise-separator"></div><button class="remove-workout-exercise text-danger-button" type="button" data-builder-del-ex="${uidAttr}" aria-label="Remove ${escapeHtml(ex?.name||'exercise')} from this workout">Remove exercise</button></div></details>
            </div>
          </details>`;
    }    /* #99 B4: renderSavedBuilder decomposed by pure code motion. The page HTML
       moved verbatim into savedBuilderPageHtml; each listener group moved
       verbatim into a wire* helper. renderSavedBuilder only orchestrates
       the same steps in the same order. */
    function savedBuilderPageHtml(b){
      const cards=(b.exercises||[]).map(item=>builderExerciseCard(item,b.exercises)).join('');
      return `<div class="builder-signifier"><span class="saved-pill">Saved workout</span>${(b.editTarget?.kind==='program'&&workoutState.activeProgram)?`<span class="saved-pill program-part-pill">Part of ${escapeHtml(workoutState.activeProgram.name)}</span>`:''}</div>
      <div class="workout-meta">
      <div class="field"><label for="builderName">WORKOUT NAME</label><input id="builderName" type="text" value="${escapeHtml(b.name||'')}" placeholder="Workout" autocomplete="off" maxlength="80"></div>
      <div class="workout-focus-open">
      <span class="workout-focus-label" id="builderFocusLabel">Workout focus</span>
      <div class="rep-preset-row" role="group" aria-labelledby="builderFocusLabel"><button class="rep-preset" type="button" data-builder-focus="strength">Strength \u00b7 1\u20135</button><button class="rep-preset" type="button" data-builder-focus="hypertrophy">Hypertrophy \u00b7 6\u201312</button><button class="rep-preset" type="button" data-builder-focus="endurance">Endurance \u00b7 12\u201320</button><button class="rep-preset" type="button" data-builder-focus="open">15+</button><button class="rep-preset" type="button" data-builder-focus="amrap">AMRAP</button></div>
      <p class="field-help">Applies the rep range to every reps-tracked exercise in this workout, replacing any per-exercise ranges you set.</p>
      </div>
      </div>
      <div class="workout-toolbar"><h2>Exercises</h2><div class="workout-toolbar-actions"><button class="exercise-info-button plain-glyph" id="builderReorderExercises" type="button" aria-label="Reorder exercises"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3v18M8 3 4 7m4-4 4 4M16 21V3m0 18 4-4m-4 4-4-4"/></svg></button><button class="exercise-info-button plain-glyph" id="builderAddExercise" type="button" aria-label="Add exercises"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div></div>
      <div class="workout-exercises">${cards||'<div class="history-empty">No exercises yet. Add your first movement above.</div>'}</div>
      <button class="secondary-button add-exercise-bottom" id="builderAddExerciseBottom" type="button">+ Add exercise</button>
      <div class="workout-footer"><div class="workout-actions"><button class="secondary-button" id="discardBuilderBtn" type="button">Discard</button><button class="primary-button" id="saveBuilderBtn" type="button">Save workout</button></div></div>`;
    }
    function wireBuilderName(b){
      $('#builderName')?.addEventListener('input',e=>{b.name=e.target.value;schedulePersist();});
    }
    function wireBuilderFocusRow(host){
      host.querySelectorAll('[data-builder-focus]').forEach(btn=>btn.addEventListener('click',()=>applyBuilderFocus(btn.dataset.builderFocus||'')));
    }
    function wireBuilderAddButtons(host,b){
      $('#builderAddExercise')?.addEventListener('click',()=>openTemplateBuilder(b));
      $('#builderAddExerciseBottom')?.addEventListener('click',()=>openTemplateBuilder(b));
    }
    function wireBuilderExerciseInfo(host){
      host.querySelectorAll('[data-exercise-info]').forEach(btn=>btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openExercise(btn.dataset.exerciseInfo);}));
    }
    function wireBuilderCardToggles(host,findItem){
      host.querySelectorAll('[data-builder-exercise]').forEach(card=>card.addEventListener('toggle',()=>{const item=findItem(card.dataset.builderExercise);if(item){item.cardOpen=card.open;schedulePersist();}}));
    }
    function wireBuilderAdvancedToggles(host,findItem){
      host.querySelectorAll('.advanced-options').forEach(det=>det.addEventListener('toggle',()=>{const item=findItem(det.closest('[data-builder-exercise]')?.dataset.builderExercise);if(item){item.optionsOpen=det.open;schedulePersist();}}));
    }
    function wireBuilderDeleteExercise(host,b){
      host.querySelectorAll('[data-builder-del-ex]').forEach(btn=>btn.addEventListener('click',()=>{b.exercises=b.exercises.filter(x=>x.uid!==btn.dataset.builderDelEx);schedulePersist();renderSavedBuilder();}));
    }
    function wireBuilderAddSet(host,findItem){
      host.querySelectorAll('[data-builder-add-set]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderAddSet);if(!item)return;
        const ex=exercises.find(e=>e.id===item.exerciseId),time=exerciseTracking(item,ex)==='time';
        const last=(item.sets||[])[item.sets.length-1],pr=item.progression||{};
        const fallback=time?String(pr.timeMin??''): (pr.amrap?'':String(pr.min??''));
        item.sets=[...(item.sets||[]),Object.assign(newSet(),time?{seconds:last?.seconds??fallback}:{r:last?.r??fallback})];
        schedulePersist();renderSavedBuilder();
      }));
    }
    function wireBuilderDeleteSet(host,findItem){
      host.querySelectorAll('[data-builder-del-set]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderUid);if(!item)return;
        item.sets=(item.sets||[]).filter((_,i)=>i!==Number(btn.dataset.builderDelSet));
        schedulePersist();renderSavedBuilder();
      }));
    }
    function wireBuilderSetInputs(host,findItem){
      host.querySelectorAll('[data-builder-set]').forEach(input=>input.addEventListener('change',()=>{
        const item=findItem(input.dataset.builderUid);if(!item)return;
        const set=(item.sets||[])[Number(input.dataset.builderSet)];if(!set)return;
        const ex=exercises.find(e=>e.id===item.exerciseId),time=exerciseTracking(item,ex)==='time';
        const v=input.value.trim();
        if(time)set.seconds=v;else set.r=v;
        schedulePersist();
      }));
    }
    function wireBuilderTracking(host,findItem){
      host.querySelectorAll('[data-builder-tracking]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderUid);if(!item)return;
        /* One canonical switch (efficiency pass 2026-09-12, shared with the
           live editor): maps "seconds" to 'time', no-ops when already set (no
           scroll jump), keeps the progression mode in sync. */
        if(!setExerciseTracking(item, btn.dataset.builderTracking))return;
        schedulePersist();renderSavedBuilder();
      }));
    }
    function wireBuilderAddNote(host,findItem){
      host.querySelectorAll('[data-builder-add-note]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderAddNote);if(!item)return;
        item.noteOpen=true;item.note=item.note||'';
        const ta=document.createElement('textarea');ta.id=`note-${item.uid}`;ta.dataset.builderNote=item.uid;
        ta.setAttribute('aria-label','Exercise notes');ta.placeholder='Cues, setup, pain, or anything to remember';ta.value=item.note;
        ta.addEventListener('input',()=>{item.note=ta.value;schedulePersist();});
        btn.replaceWith(ta);ta.focus({preventScroll:true});schedulePersist();
      }));
    }
    function wireBuilderNoteInputs(host,findItem){
      host.querySelectorAll('[data-builder-note]').forEach(ta=>ta.addEventListener('input',()=>{const item=findItem(ta.dataset.builderNote);if(item){item.note=ta.value;schedulePersist();}}));
    }
    function wireBuilderConfigure(host){
      host.querySelectorAll('[data-builder-configure]').forEach(btn=>btn.addEventListener('click',()=>configureBuilderExercise(btn.dataset.builderConfigure)));
    }
    function wireBuilderSuperset(host){
      host.querySelectorAll('[data-builder-superset]').forEach(btn=>btn.addEventListener('click',()=>openSupersetDialog(btn.dataset.builderSuperset)));
    }
    function wireBuilderExerciseTags(host){
      host.querySelectorAll('[data-builder-exercise-tags]').forEach(btn=>btn.addEventListener('click',()=>openExerciseTagDialog({mode:'builder',exerciseUid:btn.dataset.builderExerciseTags})));
    }
    function wireBuilderCopyFirst(host,findItem){
      host.querySelectorAll('[data-builder-copy-first]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderCopyFirst);if(!item||(item.sets||[]).length<2)return;
        const ex=exercises.find(e=>e.id===item.exerciseId),time=exerciseTracking(item,ex)==='time';
        const first=item.sets[0];
        item.sets.slice(1).forEach(set=>{if(time)set.seconds=first.seconds;else set.r=first.r;});
        schedulePersist();renderSavedBuilder();
        const fb=host.querySelector(`[data-builder-copy-feedback="${CSS.escape(btn.dataset.builderCopyFirst)}"]`);
        if(fb){fb.textContent='Applied';setTimeout(()=>{if(fb.isConnected)fb.textContent='';},1600);}
      }));
    }
    function wireBuilderReorder(host,b){
      const reorderBtn=$('#builderReorderExercises');
      if(reorderBtn){reorderBtn.style.display=b.exercises.length>=2?'':'none';reorderBtn.addEventListener('click',openReorderDialog);}
    }
    function wireBuilderFooter(b){
      $('#discardBuilderBtn')?.addEventListener('click',()=>{discardingBuilder=true;$('#discardDraftDialog').showModal();});
      $('#saveBuilderBtn')?.addEventListener('click',saveBuilderWorkout);
    }
    function renderSavedBuilder(){
      const host=$('#savedBuilderBody');if(!host)return;
      const b=state.savedBuilder;
      if(!b){host.innerHTML='';return;}
      /* Keep the scroll position across the full re-render (user 2026-09-12:
         toggling options jumped the page). openSavedBuilder scrolls to top
         after its own initial render, so restoring here never fights it. */
      const scrollY=window.scrollY;
      host.innerHTML=savedBuilderPageHtml(b);
      if(scrollY)window.scrollTo(0,scrollY);
      const findItem=uid=>b.exercises.find(x=>x.uid===uid);
      wireBuilderName(b);
      wireBuilderFocusRow(host);
      wireBuilderAddButtons(host,b);
      wireBuilderExerciseInfo(host);
      wireBuilderCardToggles(host,findItem);
      wireBuilderAdvancedToggles(host,findItem);
      wireBuilderDeleteExercise(host,b);
      wireBuilderAddSet(host,findItem);
      wireBuilderDeleteSet(host,findItem);
      wireBuilderSetInputs(host,findItem);
      wireBuilderTracking(host,findItem);
      wireBuilderAddNote(host,findItem);
      wireBuilderNoteInputs(host,findItem);
      wireBuilderConfigure(host);
      wireBuilderSuperset(host);
      wireBuilderExerciseTags(host);
      wireBuilderCopyFirst(host,findItem);
      wireBuilderReorder(host,b);
      wireBuilderFooter(b);
      syncBuilderFocusPills();
    }
    function applyBuilderFocus(key){
      const b=state.savedBuilder;if(!b)return;
      /* Tapping the selected pill clears the focus (user 2026-09-12) — the old
         "No focus" pill is gone. */
      if((key||'')===(b.focusKey||'')){b.focusKey=null;schedulePersist();renderSavedBuilder();return;}
      b.focusKey=key||null;
      const preset=REP_PRESETS[key];
      if(preset){
        b.exercises.forEach(item=>{
          const ex=exercises.find(row=>row.id===item.exerciseId);
          if(exerciseTracking(item,ex)==='time')return;
          item.progression={...(item.progression||{}),preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap,custom:true};
          const target=preset.amrap?'':String(preset.min);
          (item.sets||[]).forEach(set=>{set.r=target;});
        });
      }
      schedulePersist();renderSavedBuilder();
    }
    /* Mirrors syncWorkoutFocusPills for the saved-workout builder. */
    function syncBuilderFocusPills(){
      const key=state.savedBuilder?.focusKey||'';
      document.querySelectorAll('[data-builder-focus]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.builderFocus||'')===key)));
    }
    let pendingBuilderConfigureUid=null;
    /* Per-exercise target range editor for the builder (Configure button):
       the live editor's progression summary is display-only, so the builder
       gets this small min/max dialog instead. */
    function configureBuilderExercise(uidAttr){
      const b=state.savedBuilder;const item=b?.exercises.find(x=>x.uid===uidAttr);if(!item)return;
      pendingBuilderConfigureUid=uidAttr;
      const ex=exercises.find(e=>e.id===item.exerciseId);
      const time=exerciseTracking(item,ex)==='time';
      const p=item.progression||{};
      $('#builderConfigureTitle').textContent=ex?.name||'Exercise targets';
      $('#builderConfigureSub').textContent=time?'Target time range per set.':'Target rep range per set. Leave max blank for AMRAP.';
      $('#builderConfigureMinLabel').textContent=time?'Min sec':'Min reps';
      $('#builderConfigureMaxLabel').textContent=time?'Max sec':'Max reps';
      $('#builderConfigureMin').value=time?(p.timeMin??''):(p.min??'');
      $('#builderConfigureMax').value=time?(p.timeMax??''):(p.max??'');
      $('#builderConfigureMax').placeholder=time?'':'AMRAP';
      $('#builderConfigureDialog').showModal();
      $('#builderConfigureMin').focus({preventScroll:true});
    }
    $('#cancelBuilderConfigure')?.addEventListener('click',()=>{$('#builderConfigureDialog').close();pendingBuilderConfigureUid=null;});
    $('#applyBuilderConfigure')?.addEventListener('click',()=>{
      const b=state.savedBuilder;const item=b?.exercises.find(x=>x.uid===pendingBuilderConfigureUid);
      $('#builderConfigureDialog').close();
      if(!item){pendingBuilderConfigureUid=null;return;}
      const ex=exercises.find(e=>e.id===item.exerciseId);
      const time=exerciseTracking(item,ex)==='time';
      const minVal=$('#builderConfigureMin').value.trim(),maxVal=$('#builderConfigureMax').value.trim();
      const p={...(item.progression||{}),custom:true};
      if(time){
        p.timeMin=minVal?Number(minVal):30;p.timeMax=maxVal?Number(maxVal):p.timeMin;
        const target=String(p.timeMin);
        (item.sets||[]).forEach(set=>{set.seconds=target;});
      }else{
        p.min=minVal?Number(minVal):null;p.max=maxVal?Number(maxVal):null;
        p.amrap=!maxVal&&!!minVal;p.openTop=false;
        const target=p.amrap?'':String(p.min??'');
        (item.sets||[]).forEach(set=>{set.r=target;});
      }
      item.progression=p;
      pendingBuilderConfigureUid=null;
      schedulePersist();renderSavedBuilder();
    });
    /* Persists the builder as a saved workout and opens its page. */
    function saveBuilderWorkout(){
      const b=state.savedBuilder;if(!b)return;
      if(!b.exercises.length){showToast('Add at least one exercise first.','error');return;}
      const name=(b.name||'').trim()||'New saved workout';
      /* Drop orphaned superset ids (a group reduced to one exercise when its
         partner was removed) before persisting the template. */
      const counts={};
      b.exercises.forEach(item=>{if(item.supersetId)counts[item.supersetId]=(counts[item.supersetId]||0)+1;});
      const template={
        id:b.id||newTemplateId(),
        name,
        focusKey:b.focusKey||null,
        createdAt:b.createdAt||Date.now(),
        exercises:b.exercises.map(item=>cloneExerciseItem(item,'forSaveTemplate',{
          noteOpen:!!item.note,
          /* Drop orphaned superset ids (a group reduced to one exercise when
             its partner was removed) before persisting the template. */
          supersetId:item.supersetId&&counts[item.supersetId]>1?item.supersetId:null,
          progression:{...(item.progression||{})}
        }))
      };
      const idx=workoutState.templates.findIndex(t=>t.id===template.id);
      /* Program-workout edit (user 2026-09-12): write back to the program
         workout's template and return to its page. If the workout vanished
         (deleted mid-edit), fall through and save as a regular template. */
      const programWorkout=b.editTarget?.kind==='program'?workoutState.activeProgram?.workouts.find(w=>w.uid===b.editTarget.uid):null;
      if(programWorkout){
        programWorkout.name=name;
        programWorkout.template={name,exercises:template.exercises};
        state.savedBuilder=null;state.builderOpen=false;state.builderReturn=null;
        schedulePersist();
        showToast(`Saved "${name}".`);
        state.programWorkoutUid=programWorkout.uid;
        showProgram(false);
        window.scrollTo({top:0});
        return;
      }
      if(idx>=0)workoutState.templates[idx]=template;else workoutState.templates.unshift(template);
      state.savedBuilder=null;state.builderOpen=false;state.builderReturn=null;
      schedulePersist();
      showToast(`Saved "${name}".`);
      openSavedWorkoutEditor(template.id);
    }
    function renderBuilderContinue(){
      const wrap=$('#builderContinueWrap');if(!wrap)return;
      const b=state.savedBuilder;
      if(!b||state.builderOpen){wrap.hidden=true;wrap.innerHTML='';return;}
      wrap.hidden=false;
      const n=(b.exercises||[]).length;
      wrap.innerHTML=`<button class="continue-workout-card is-draft" id="continueBuilderCard" type="button"><span><span class="continue-kicker">Saved workout draft</span><strong>${escapeHtml(b.name||'New saved workout')}</strong><small>${n} exercise${n===1?'':'s'} added</small></span><span class="continue-arrow">\u203a</span></button>`;
      $('#continueBuilderCard')?.addEventListener('click',()=>{state.builderOpen=true;renderWorkoutScreen();window.scrollTo({top:0});});
    }
    /* Both the list and the open editor refresh after rename/archive/delete. */
    function refreshTemplateViews(){
      renderWorkoutTemplateList();
      if(state.savedWorkoutId)renderSavedWorkoutEditor();
    }
    /* #74: delete template dialog. */
    let pendingDeleteTemplateId=null;
    let discardingBuilder=false;
    $('#cancelDeleteTemplate')?.addEventListener('click',()=>$('#deleteTemplateDialog').close());
    $('#keepTemplate')?.addEventListener('click',()=>$('#deleteTemplateDialog').close());
    $('#confirmDeleteTemplate')?.addEventListener('click',()=>{
      $('#deleteTemplateDialog').close();
      if(pendingDeleteTemplateId){
        /* A3 (#99): record a tombstone so the delete propagates through sync
           instead of being resurrected by another device's copy. */
        if(typeof noteTombstone==='function')noteTombstone('templates',pendingDeleteTemplateId);
        workoutState.templates=workoutState.templates.filter(x=>x.id!==pendingDeleteTemplateId);
        if(state.savedWorkoutId===pendingDeleteTemplateId)state.savedWorkoutId=null;
        schedulePersist();showToast('Saved workout deleted.');
        /* A deleted open editor must fall back to the start screen. */
        renderWorkoutScreen();
      }
      pendingDeleteTemplateId=null;
    });

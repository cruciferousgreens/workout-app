/* ===== module: share-codec.js ===== */
    /* Share-link codec + schema (#32, user 2026-09-12) — pure functions, no DOM.
       v2 (user 2026-09-12, "much shorter links"): the payload is slimmed
       (every structurally-empty field dropped — uids, empty strings/arrays,
       false flags, default-valued progression fields) then deflate-compressed
       before base64url — a 3-exercise workout goes from ~2700 chars to ~330,
       so chat apps stop mangling it. v1 links (plain base64url JSON) still
       open. No backend, works offline, works for signed-out recipients.
       Split from share.js (#99 B16): the UI/import/launch side lives in
       share.js, which loads right after this file. The validSharePayload
       gates below are the security boundary for hand-edited/corrupt links —
       keep them byte-for-byte in sync with any change here. */
       /* Module map (v1.006) — Key: buildTemplateShare()/buildProgramShare()/buildTemplateLikeShare(), slimSharePayload()/expandSharePayload(), validSharePayload(). Depends on: native CompressionStream only; no app-module deps. */
    /* Shareable template/program links (#32, user 2026-09-12).
       v2 (user 2026-09-12, "much shorter links"): the payload is slimmed
       (every structurally-empty field dropped — uids, empty strings/arrays,
       false flags, default-valued progression fields) then deflate-compressed
       before base64url — a 3-exercise workout goes from ~2700 chars to ~330,
       so chat apps stop mangling it. v1 links (plain base64url JSON) still
       open. No backend, works offline, works for signed-out recipients.
       Opening a share link cold renders the shared workout/program
       full-screen; a link arriving while the app is already open pops the
       same card as a modal over the current screen (user 2026-09-12). Start
       workout (primary for signed-out) and Add to my library act over it.
       Accepting copies the workout/program into the recipient's library (any
       custom exercises it references come along too). */
    const SHARE_VERSION=2, SHARE_LEGACY_VERSION=1;
    function shareEncodeV1(obj){
      return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }
    function shareDecodeV1(str){
      return JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g,'+').replace(/_/g,'/')))));
    }
    function b64urlEncodeBytes(bytes){
      let bin='';const CH=0x8000;
      for(let i=0;i<bytes.length;i+=CH)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+CH));
      return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }
    function b64urlDecodeToBytes(str){
      const bin=atob(str.replace(/-/g,'+').replace(/_/g,'/'));
      const bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      return bytes;
    }
    async function deflateBytes(bytes){
      const rs=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
      return new Uint8Array(await new Response(rs).arrayBuffer());
    }
    async function inflateBytes(bytes){
      const rs=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Uint8Array(await new Response(rs).arrayBuffer());
    }
    /* v2 compact schema (user 2026-09-12: "much shorter links" — v2 never
       shipped, so the schema is free to tighten):
       {v:2,k:'t'|'p',n:name,e:[exercises]|p:{program},c:[custom]?}
       exercise: {i:id,k:tracking?,o:note?,g:tags?,u:supersetId?,p:prog?,e:[sets]}
       set: positional [w,r,seconds,rpe,tags?,targetRpe?], trailing empties trimmed
       (targetRpe is trailing so pre-A7 links decode identically)
       prog: {d:mode?,r:[min,max]?,o:1?,a:1?,t:[timeMin,timeMax]?,
              s:timeStep?,i:[incType,incVal]?,l:1?,c:1?,
              m:scheme?,p:percentOf1RM?,x:trainingMax?,u:tmSource?}
       Everything the decoder re-derives is dropped (uids, empty note/tags,
       false flags, default progression fields). Value-bearing fields are
       always kept — the recipient's own defaults must never leak in. */
    function slimShareSet(s){
      const tr=cleanTargetRpe(s.targetRpe);
      const a=[(s.w!==''&&s.w!=null)?s.w:null,(s.r!==''&&s.r!=null)?s.r:null,
        (s.seconds!==''&&s.seconds!=null)?s.seconds:null,(s.rpe!==''&&s.rpe!=null)?s.rpe:null,
        (s.tags&&s.tags.length)?[...s.tags]:null,tr!==''?tr:null];
      while(a.length&&a[a.length-1]==null)a.pop();
      return a;
    }
    function slimShareProgression(p){
      if(!p)return undefined;
      const o={};
      if(p.mode&&p.mode!=='reps')o.d=p.mode;
      if(p.min!=null||p.max!=null)o.r=[p.min??null,p.max??null];
      if(p.openTop)o.o=1;
      if(p.amrap)o.a=1;
      if((p.timeMin??30)!==30||(p.timeMax??60)!==60)o.t=[p.timeMin??30,p.timeMax??60];
      if(p.timeStep!=null)o.s=p.timeStep;
      if(p.incrementType||p.incrementValue!=null)o.i=[p.incrementType??null,p.incrementValue??null];
      if(p.repsOnly)o.l=1;
      if(p.custom)o.c=1;
      if(p.scheme&&p.scheme!=='rpe')o.m=p.scheme;
      if(p.percentOf1RM!=null)o.p=p.percentOf1RM;
      if(p.trainingMax!=null)o.x=p.trainingMax;
      if(p.tmSource)o.u=p.tmSource;
      return o;
    }
    function slimShareExercise(item){
      const o={i:item.exerciseId};
      if(item.tracking&&item.tracking!=='reps')o.k=item.tracking;
      if(item.note)o.o=item.note;
      if(item.exerciseTags&&item.exerciseTags.length)o.g=[...item.exerciseTags];
      if(item.supersetId)o.u=item.supersetId;
      const p=slimShareProgression(item.progression);
      if(p&&Object.keys(p).length)o.p=p;
      o.e=(item.sets||[]).map(slimShareSet);
      return o;
    }
    /* Shrinks a share payload to the compact v2 wire format (drops uids, empty fields,
       false flags, default-valued progression fields). expandSharePayload must stay its
       exact inverse. */
    function slimSharePayload(payload){
      const slim={v:SHARE_VERSION,k:payload.kind==='template'?'t':'p',n:payload.name};
      if(payload.kind==='template'){
        slim.e=(payload.template?.exercises||[]).map(slimShareExercise);
      }else{
        const src=payload.program||{};
        slim.p={n:src.name,l:src.length??null,s:src.startWeek??null,f:src.focus||null,
          g:src.progression||null,
          w:(src.workouts||[]).map(w=>{const wo={n:w.name,e:(w.template?.exercises||[]).map(slimShareExercise)};
            if(w.template?.name&&w.template.name!==w.name)wo.t=w.template.name;return wo;})};
      }
      if(payload.customExercises&&payload.customExercises.length)slim.c=payload.customExercises;
      return slim;
    }
    function expandShareProgression(p){
      if(!p)return {};
      const o={};
      if(p.d)o.mode=p.d;
      if(p.r){o.min=p.r[0]??null;o.max=p.r[1]??null;}
      if(p.o)o.openTop=true;
      if(p.a)o.amrap=true;
      if(p.t){o.timeMin=p.t[0]??30;o.timeMax=p.t[1]??60;}
      if(p.s!=null)o.timeStep=p.s;
      if(p.i){o.incrementType=p.i[0]??null;o.incrementValue=p.i[1]??null;}
      if(p.l)o.repsOnly=true;
      if(p.c)o.custom=true;
      if(p.m)o.scheme=p.m;
      if(p.p!=null)o.percentOf1RM=p.p;
      if(p.x!=null)o.trainingMax=p.x;
      if(p.u)o.tmSource=p.u;
      return o;
    }
    /* Re-expand a v2 payload to the full shape the import side expects —
       uids regenerated, progression/sets rebuilt through the app's own
       factories so defaults always match the recipient's app version. */
    function expandSharePayload(slim){
      const out={v:SHARE_VERSION,kind:slim.k==='p'?'program':'template',name:slim.n,
        customExercises:slim.c?JSON.parse(JSON.stringify(slim.c)):[]};
      /* Re-expand a v2 payload to the full shape the import side expects —
       uids regenerated, progression/sets rebuilt through the app's own
       factories so defaults always match the recipient's app version.
       Canonical clone (#99 B8). */
      const expandEx=sitem=>cloneExerciseItemFromShare(sitem,p=>defaultExerciseProgression(expandShareProgression(p)));
      if(out.kind==='template'){
        out.template={name:slim.n,exercises:(slim.e||[]).map(expandEx)};
      }else{
        const sp=slim.p||{};
        out.program={name:sp.n||slim.n,length:sp.l??4,startWeek:sp.s??1,
          focus:sp.f||'',progression:sp.g||null,
          workouts:(sp.w||[]).map(w=>({name:w.n,
            template:{name:w.t||w.n,exercises:(w.e||[]).map(expandEx)}}))};
      }
      return out;
    }
    async function shareEncodeV2(payload){
      const bytes=await deflateBytes(new TextEncoder().encode(JSON.stringify(slimSharePayload(payload))));
      return b64urlEncodeBytes(bytes);
    }
    /* Decodes either generation: v2 (deflated) first, v1 (plain JSON) as
       the fallback. Returns the full-shape payload in both cases. */
    async function shareDecodeAny(str){
      try{
        const inflated=await inflateBytes(b64urlDecodeToBytes(str));
        const payload=JSON.parse(new TextDecoder().decode(inflated));
        if(payload&&payload.v===SHARE_VERSION)return expandSharePayload(payload);
      }catch(e){/* not a v2 link */}
      return shareDecodeV1(str);
    }
    /* Custom exercises referenced by template-style exercise rows. */
    function shareCustomExercises(exerciseRows){
      const ids=new Set((exerciseRows||[]).map(row=>row.exerciseId));
      return (state.customExercises||[]).filter(ex=>ids.has(ex.id)).map(ex=>({...ex}));
    }
    /* A shareable workout payload from any template-shaped {name,exercises}
       object — saved templates and program workouts share the same shape
       (user 2026-09-12: a program workout is architecturally a saved
       workout, so it shares exactly the same way). */
    function buildTemplateLikeShare(name,exerciseRows){
      const rows=JSON.parse(JSON.stringify(exerciseRows||[]));
      return {v:SHARE_VERSION,kind:'template',name:name||'Shared workout',
        template:{name:name,exercises:rows},customExercises:shareCustomExercises(rows)};
    }
    /* Encodes a saved-workout template into a shareable link string (v2 compact; v1
       plain-JSON links still decode). */
    function buildTemplateShare(templateId){
      const t=(workoutState.templates||[]).find(x=>x.id===templateId);
      if(!t)return null;
      return buildTemplateLikeShare(t.name,t.exercises||[]);
    }
    function buildProgramShare(){
      const p=workoutState.activeProgram;
      if(!p)return null;
      const program=JSON.parse(JSON.stringify({name:p.name,length:p.length,startWeek:p.startWeek,
        focus:p.focus||'',progression:p.progression||null,
        workouts:(p.workouts||[]).map(w=>({name:w.name,
          template:{name:w.template?.name,exercises:w.template?.exercises||[]}}))}));
      return {v:SHARE_VERSION,kind:'program',name:p.name||'Shared program',
        program,customExercises:shareCustomExercises(program.workouts.flatMap(w=>w.template.exercises))};
    }
    /* ---- Import side ---- */
    /* A10 (#99): incoming share payloads are schema-validated BEFORE
       preview or persistence — shapes, bounded counts, bounded string
       lengths, Number.isFinite on every numeric field. A hand-edited or
       corrupt link fails closed (null) and the caller shows the existing
       "That share link didn't open…" feedback; garbage is never persisted. */
    const SHARE_MAX_EXERCISES=100, SHARE_MAX_SETS=100, SHARE_MAX_WORKOUTS=100,
      SHARE_MAX_NAME=200, SHARE_MAX_NOTE=2000, SHARE_MAX_ID=200,
      SHARE_MAX_TAGS=20, SHARE_MAX_TAG=50;
    function shareStrOk(v,max){return typeof v==='string'&&v.length<=max;}
    function shareNumOk(v){return v===''||v==null||Number.isFinite(Number(v));}
    function shareTagListOk(v){
      return v===undefined||v===null||(Array.isArray(v)&&v.length<=SHARE_MAX_TAGS&&v.every(t=>shareStrOk(t,SHARE_MAX_TAG)));
    }
    function validShareSet(s){
      if(!s||typeof s!=='object')return false;
      for(const k of ['w','r','seconds']){
        const v=s[k];
        if(!shareNumOk(v))return false;
        if(v!==''&&v!=null&&Number(v)<0)return false;
      }
      for(const k of ['rpe','targetRpe']){
        const v=s[k];
        if(v!==''&&v!=null&&(!Number.isFinite(Number(v))||Number(v)<1||Number(v)>10))return false;
      }
      return shareTagListOk(s.tags);
    }
    function validShareProgression(p){
      if(p==null)return true;
      if(typeof p!=='object')return false;
      for(const k of ['min','max','timeMin','timeMax','timeStep','incrementValue','percentOf1RM','trainingMax']){
        if(p[k]!==undefined&&p[k]!==null&&!Number.isFinite(Number(p[k])))return false;
      }
      if(p.mode!==undefined&&p.mode!==null&&p.mode!=='reps'&&p.mode!=='time')return false;
      if(p.scheme!==undefined&&p.scheme!==null&&p.scheme!=='rpe'&&p.scheme!=='linear'&&p.scheme!=='onerm')return false;
      if(p.tmSource!==undefined&&p.tmSource!==null&&p.tmSource!=='manual'&&p.tmSource!=='auto')return false;
      return true;
    }
    function validShareExercise(item){
      if(!item||typeof item!=='object')return false;
      if(!shareStrOk(item.exerciseId,SHARE_MAX_ID)||!item.exerciseId)return false;
      if(item.tracking!==undefined&&item.tracking!==null&&item.tracking!=='reps'&&item.tracking!=='time')return false;
      if(item.note!==undefined&&item.note!==null&&!shareStrOk(item.note,SHARE_MAX_NOTE))return false;
      if(!shareTagListOk(item.exerciseTags))return false;
      if(item.supersetId!==undefined&&item.supersetId!==null&&typeof item.supersetId!=='string')return false;
      if(!validShareProgression(item.progression))return false;
      if(!Array.isArray(item.sets)||item.sets.length>SHARE_MAX_SETS)return false;
      return item.sets.every(validShareSet);
    }
    function validShareExerciseList(list){
      return Array.isArray(list)&&list.length<=SHARE_MAX_EXERCISES&&list.every(validShareExercise);
    }
    function validShareCustomExercises(list){
      if(list==null)return true;
      if(!Array.isArray(list)||list.length>SHARE_MAX_EXERCISES)return false;
      return list.every(ex=>ex&&typeof ex==='object'&&shareStrOk(ex.id,SHARE_MAX_ID)&&!!ex.id
        &&(ex.name===undefined||shareStrOk(String(ex.name),SHARE_MAX_NAME))
        &&(ex.deletedAt===undefined||ex.deletedAt===null||Number.isFinite(Number(ex.deletedAt))));
    }
    function validSharePayload(p){
      if(!p||typeof p!=='object')return false;
      if(p.v!==SHARE_VERSION&&p.v!==SHARE_LEGACY_VERSION)return false;
      if(p.kind!=='template'&&p.kind!=='program')return false;
      if(!shareStrOk(p.name,SHARE_MAX_NAME)||!p.name)return false;
      if(!validShareCustomExercises(p.customExercises))return false;
      if(p.kind==='template'){
        const t=p.template;
        if(!t||typeof t!=='object')return false;
        return validShareExerciseList(t.exercises);
      }
      const pr=p.program;
      if(!pr||typeof pr!=='object')return false;
      if(!Array.isArray(pr.workouts)||pr.workouts.length>SHARE_MAX_WORKOUTS)return false;
      for(const w of pr.workouts){
        if(!w||typeof w!=='object')return false;
        if(w.name!==undefined&&w.name!==null&&!shareStrOk(String(w.name),SHARE_MAX_NAME))return false;
        const t=w.template;
        if(!t||typeof t!=='object'||!validShareExerciseList(t.exercises))return false;
      }
      for(const k of ['length','startWeek']){
        const v=pr[k];
        if(v!==undefined&&v!==null&&!Number.isFinite(Number(v)))return false;
      }
      return true;
    }

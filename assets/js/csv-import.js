/* ===== module: csv-import.js ===== */
/** CSV/XLSX import engine + overlay (extracted 2026-09-12 from the parked
    onboarding gate, #99 B1 — the first-run gate is deleted; #172's first-run
    guidance is held for the user's call, so no new onboarding here).
    The import lives on standalone: Settings → Data → "Import workouts
    (CSV)" calls openCsvImport(). Parses the app's template schema plus Hevy
    native exports and MacroFactor program spreadsheets, matches exercises
    against the live catalog, previews with fuzzy suggestions for unmatched
    names, then writes completed workouts into workoutState.completed and
    new customs into state.customExercises. */
    /* Module map (v1.006) — Key: openCsvImport(), obDispatchImport(), obExecuteCsvImport(), obExecuteMfTemplateImport(), obCsvFuzzy(). Depends on: catalog (exercise matching), workout-editor factories (newSet()), state (obState, completed), persistence (schedulePersist()). */

/* Import overlay state. standaloneImport is always true while the gate is
   gone — kept as documentation of the mode the overlay runs in. */
const obState={csvPlan:null,csvImportDone:null,mfTemplateDone:null,standaloneImport:false,existingMap:{}}; /* #139: csvName -> library id for "Use existing exercise" picks */
function obEl(id){return document.getElementById(id);}
/** Build the overlay shell once and unhide it. */
function obEnsureGate(){
  if(obEl('onboardingGate')){obEl('onboardingGate').hidden=false;return;}
  const gate=document.createElement('div');
  gate.id='onboardingGate';
  gate.setAttribute('role','dialog');
  gate.setAttribute('aria-label','Welcome to Cruciferous Greens Workout');
  gate.innerHTML=`
    <div class="ob-phone">
      <header class="ob-header">
        <button class="ob-back" id="obBack" type="button" aria-label="Back">‹</button>
        <span class="ob-progress" id="obProgress"></span>
      </header>
      <main class="ob-main" id="obMain"></main>
    </div>`;
  document.body.appendChild(gate);
  document.body.classList.add('ob-active');
}
/** Standalone CSV import (Settings → Data). Reuses the gate overlay + import
    engine without the first-run flow. */
function openCsvImport(){
  obEnsureGate();
  obState.standaloneImport=true;
  obState.csvPlan=null;
  obState.csvImportDone=null;
  obState.mfTemplateDone=null;
  obState.existingMap={};
  /* Header: no back button or step progress in standalone mode — a × closes. */
  const back=obEl('obBack');if(back){back.classList.remove('show');back.style.display='none';}
  const prog=obEl('obProgress');if(prog)prog.style.display='none';
  const headerEl=obEl('onboardingGate')?obEl('onboardingGate').querySelector('.ob-header'):null;
  let close=obEl('obClose');
  if(!close&&headerEl){
    close=document.createElement('button');
    close.id='obClose';
    close.className='ob-close';
    close.type='button';
    close.setAttribute('aria-label','Close import');
    close.textContent='×';
    close.addEventListener('click',obCloseStandaloneImport);
    headerEl.appendChild(close);
  }
  if(close)close.hidden=false;
  const main=obEl('obMain');
  if(main){main.innerHTML=obRenderImport();main.scrollTop=0;}
  obWireImport();
  window.scrollTo(0,0);
}
function obCloseStandaloneImport(){
  obState.standaloneImport=false;
  obHideGate();
  if(typeof rerenderCurrentView==='function'){try{rerenderCurrentView();}catch(_){}}
}
function obHideGate(){
  const gate=obEl('onboardingGate');
  if(gate)gate.hidden=true;
  document.body.classList.remove('ob-active');
}
const OB_CSV_BATCH_KEY='workout-app:csv-import-batches';
const OB_CSV_COLUMNS=['date','workout_name','exercise','set','reps','weight_lb','rpe','tags','notes'];
const OB_CSV_DEFAULT_TAGS=['Warmup','Dropset','Full ROM','Slow and controlled','Cheat set','Paused','Assisted','To failure'];
let obCsvNameToId=null, obCsvIdSet=null, obCsvStemToId=null, obCsvAliasToId=null;
function obCsvNorm(s){return (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function obCsvBuildLookup(){
  if(obCsvNameToId)return;
  obCsvNameToId={};obCsvIdSet={};obCsvStemToId={};obCsvAliasToId={};
  for(const ex of exercises){
    if(!ex||!ex.id||!ex.name)continue;
    obCsvIdSet[ex.id]=true;
    obCsvNameToId[obCsvNorm(ex.name)]=ex.id;
    const sk=obFzTokens(ex.name).join('');
    /* User 2026-09-12: a stem shared by several DB entries (duplicate-ish
       variants) auto-maps to the FIRST catalog entry instead of staying
       manual — first write wins. */
    if(sk&&!(sk in obCsvStemToId))obCsvStemToId[sk]=ex.id;
  }
  /* Generic-name aliases (data/exercise-aliases.js): "deadlift"→Barbell
     Deadlift, "ohp"→Barbell Shoulder Press, etc. Normalized the same
     case-/punctuation-insensitive way the file documents; first write wins
     on collisions, and ids missing from this catalog are skipped. */
  if(typeof EXERCISE_ALIASES!=='undefined'&&EXERCISE_ALIASES){
    for(const k in EXERCISE_ALIASES){
      const nk=obCsvNorm(k),aid=EXERCISE_ALIASES[k];
      if(nk&&aid&&obCsvIdSet[aid]&&!(nk in obCsvAliasToId))obCsvAliasToId[nk]=aid;
    }
  }
}
function obCsvExName(id){
  const ex=exercises.find(e=>e&&e.id===id);
  return ex?ex.name:id;
}
function obSplitCsvLine(line){
  const fields=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(inQ){
      if(ch==='"'){if(line[i+1]==='"'){cur+='"';i++;}else inQ=false;}
      else cur+=ch;
    }else if(ch==='"')inQ=true;
    else if(ch===','){fields.push(cur);cur='';}
    else cur+=ch;
  }
  fields.push(cur);
  return fields.map(f=>f.trim());
}
function obDetectCsvFormat(header){
  if(OB_CSV_COLUMNS.every(c=>header.indexOf(c)>=0))return 'native';
  /* MacroFactor workout-history CSV (one row per set). Checked before the
     Hevy variants: no header overlap, but explicit beats lucky. */
  if(header.indexOf('set type')>=0&&header.indexOf('weight (lb)')>=0&&header.indexOf('workout')>=0&&header.indexOf('exercise')>=0)return 'mf-history';
  if(header.indexOf('exercise_title')>=0&&header.indexOf('start_time')>=0)return 'hevy';
  if(header.indexOf('exercise name')>=0&&header.indexOf('workout start')>=0)return 'hevy-title';
  return null;
}
const OB_HEVY_SET_TAGS={'warm up':'Warmup','warmup':'Warmup','failure':'To failure','drop set':'Dropset','dropset':'Dropset'};
const OB_HEVY_MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function obHevyDate(raw){
  const s=String(raw||'').trim();
  let m=s.match(/^(\d{4}-\d{2}-\d{2})/);
  if(m)return m[1];
  m=s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if(m){const mo=OB_HEVY_MONTHS[m[2].slice(0,3).toLowerCase()];if(mo)return m[3]+'-'+('0'+mo).slice(-2)+'-'+('0'+m[1]).slice(-2);}
  m=s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if(m){const mo=OB_HEVY_MONTHS[m[1].slice(0,3).toLowerCase()];if(mo)return m[3]+'-'+('0'+mo).slice(-2)+'-'+('0'+m[2]).slice(-2);}
  return '';
}
function obHevyLbs(kgRaw){
  const kg=parseFloat(String(kgRaw||'').trim());
  return isFinite(kg)?String(Math.round(kg*2.20462*100)/100):'';
}
function obMapHevyRows(rows,fmt){
  return rows.map(row=>{
    const notes=[],r={date:'',workout_name:'',exercise:'',set:'',reps:'',weight_lb:'',rpe:'',tags:'',notes:'',duration_s:''};
    if(fmt==='hevy'){
      r.date=obHevyDate(row['start_time']);r.workout_name=row['title']||'';
      r.exercise=row['exercise_title']||'';r.set=row['set_index']||'';
      r.reps=row['reps']||'';r.weight_lb=row['weight_lbs']||obHevyLbs(row['weight_kg']);
      r.rpe=row['rpe']||'';r.tags=OB_HEVY_SET_TAGS[String(row['set_type']||'').toLowerCase().trim()]||'';
      r.duration_s=row['duration_seconds']||'';
      if(row['exercise_notes'])notes.push(String(row['exercise_notes']).trim());
      if(row['description'])notes.push(String(row['description']).trim());
    }else{
      r.date=obHevyDate(row['workout date'])||obHevyDate(row['workout start']);
      r.workout_name=row['workout name']||'';r.exercise=row['exercise name']||'';
      r.set=row['set order']||'';r.reps=row['reps']||'';
      r.weight_lb=obHevyLbs(row['weight (kg)']);
      r.tags=OB_HEVY_SET_TAGS[String(row['set type']||'').toLowerCase().trim()]||'';
      r.duration_s=row['seconds']||'';
      if(row['exercise comments'])notes.push(String(row['exercise comments']).trim());
      if(row['workout notes'])notes.push(String(row['workout notes']).trim());
    }
    r.notes=notes.filter(Boolean).join(' — ');
    return r;
  });
}
function obParseCsvText(text){
  const lines=String(text||'').split(/\r?\n/).filter(l=>l.trim()!=='');
  if(!lines.length)return {rows:[],errors:['That file is empty.'],format:null};
  const header=obSplitCsvLine(lines[0]).map(h=>h.toLowerCase().trim());
  const format=obDetectCsvFormat(header);
  const errors=[];
  if(!format){
    const missing=OB_CSV_COLUMNS.filter(c=>header.indexOf(c)<0);
    errors.push('Couldn\u2019t find these columns: '+missing.join(', ')+'. One row per set, with a header row. Hevy exports are accepted as-is.');
  }
  let rows=[];
  for(let i=1;i<lines.length;i++){
    const fields=obSplitCsvLine(lines[i]),row={};
    header.forEach((h,idx)=>{row[h]=fields[idx]!==undefined?fields[idx]:'';});
    row.__line=i+1;
    rows.push(row);
  }
  if(format==='hevy'||format==='hevy-title')rows=obMapHevyRows(rows,format);
  else if(format==='mf-history')rows=obMapMfHistoryRows(rows);
  return {rows:rows,errors:errors,format:format};
}
function obCsvHash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h.toString(36);}
function obValidIsoDate(s){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;
  const d=new Date(s+'T12:00:00');
  return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function obCanonicalCsvTag(raw){
  const t=String(raw||'').toLowerCase();
  for(const tag of OB_CSV_DEFAULT_TAGS)if(tag.toLowerCase()===t)return tag;
  return null;
}
function obParseCsvReps(raw,setLabel){
  const s=String(raw==null?'':raw).trim();
  if(!s)return {r:null,note:''};
  const range=s.match(/^(\d+)\s*[–-]\s*(\d+)$/);
  if(range)return {r:null,note:'Set '+setLabel+': '+range[1]+'–'+range[2]+' reps'};
  const num=Number(s);
  return {r:isFinite(num)?num:null,note:''};
}
function obParseCsvNumber(raw){
  const s=String(raw==null?'':raw).trim();
  if(!s)return null;
  const num=Number(s);
  return isFinite(num)?num:null;
}
/* MacroFactor tags superset/circuit members in the exercise name itself
   ("Reverse Nordic Curl ∈ SS1", "Scapular Retraction ∈ C1"). The marker
   carries no exercise identity and kills matching, so strip it before
   grouping/matching/display. */
function obCleanExerciseName(name){
  return String(name||'').trim().replace(/\s*∈\s*(?:SS|C)\d+\s*$/,'').trim();
}
function obCsvAliasCandidates(name){
  const cands=[];
  const m=String(name||'').trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if(m){
    const base=m[1].trim(),equip=m[2].trim();
    if(base&&equip){cands.push(equip+' '+base);cands.push(base);}
  }
  return cands;
}
/* Crude stemmer, applied identically to both sides so over-stemming is
   harmless ("biceps"→"bicep" on both sides still matches). Catches
   plurals like "flyes"→"fly", "rows"→"row", "curls"→"curl". */
function obFzStem(t){
  if(t==='flyes')return 'fly';
  if(t.length>4&&t.slice(-3)==='ies')return t.slice(0,-3)+'y';
  if(t.length>5&&t.slice(-2)==='es'&&/(s|x|z|ch|sh)$/.test(t.slice(0,-2)))return t.slice(0,-2);
  if(t.length>3&&t.slice(-1)==='s'&&t.slice(-2)!=='ss')return t.slice(0,-1);
  return t;
}
function obFzTokens(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean).map(obFzStem);
}
/* Words describing the implement, grip, or body position rather than the
   movement itself. Ignored when testing whether two names mean the same
   exercise — but an equipment MISMATCH still blocks an auto-match. */
const OB_FZ_EQUIP=['barbell','dumbbell','cable','machine','band','kettlebell','bodyweight','body','smith','landmine','sandbag','db','kb','ez'];
const OB_FZ_GRIP=['overhand','underhand','neutral','wide','close','narrow','mixed','pronated','supinated','grip'];
const OB_FZ_POS=['standing','seated','seating','lying','elevated','bent','bentover','alternating','supported','preacher'];
const OB_FZ_IGNORABLE={};
OB_FZ_EQUIP.concat(OB_FZ_GRIP,OB_FZ_POS).forEach(function(t){OB_FZ_IGNORABLE[t]=1;});
function obFzEquipSet(tokens){
  const s={};
  tokens.forEach(function(t){if(OB_FZ_EQUIP.indexOf(t)>=0)s[t]=1;});
  return s;
}
function obFzContent(tokens){
  return tokens.filter(function(t){return !OB_FZ_IGNORABLE[t];});
}
/* F1 token overlap, with two guards: a candidate whose extra words are
   movement-defining (not ignorable position/grip words) scores lower, and
   contradictory equipment ("dumbbell" vs "barbell") is heavily penalized so
   it never presents as a confident match. Returns {score, strongExtra} —
   strongExtra counts the candidate's movement-defining words beyond the
   query, used to rank cleaner matches first. */
function obFzScore(qt,ct){
  const qset={};
  qt.forEach(function(t){qset[t]=1;});
  let inter=0;const seen={};
  ct.forEach(function(t){if(qset[t]&&!seen[t]){inter++;seen[t]=1;}});
  let strongExtra=0;
  ct.forEach(function(t){if(!qset[t]&&!OB_FZ_IGNORABLE[t])strongExtra++;});
  if(!inter)return {score:0,strongExtra:strongExtra};
  let score=2*inter/(qt.length+ct.length);
  if(strongExtra)score*=Math.pow(0.85,strongExtra);
  const qE=obFzEquipSet(qt),cE=obFzEquipSet(ct);
  const qKeys=Object.keys(qE),cKeys=Object.keys(cE);
  if(qKeys.length&&cKeys.length){
    const shared=qKeys.some(function(k){return cE[k];});
    if(!shared)score*=0.45;
  }
  return {score:score,strongExtra:strongExtra};
}
function obFzEligible(qt,ct){
  /* Auto-match candidates only: no equipment contradiction, and the
     content words (minus implement/grip/position) are equal or one side
     is a subset of the other. */
  const qE=obFzEquipSet(qt),cE=obFzEquipSet(ct);
  const qKeys=Object.keys(qE),cKeys=Object.keys(cE);
  if(qKeys.length&&cKeys.length&&!qKeys.some(function(k){return cE[k];}))return false;
  const qc=obFzContent(qt),cc=obFzContent(ct);
  if(!qc.length||!cc.length)return false;
  const qset={},cset={};
  qc.forEach(function(t){qset[t]=1;});cc.forEach(function(t){cset[t]=1;});
  const qSubC=qc.every(function(t){return cset[t];});
  const cSubQ=cc.every(function(t){return qset[t];});
  return qSubC||cSubQ;
}
function obCsvFuzzy(name,limit){
  limit=limit||5;
  const qt=obFzTokens(name);
  if(!qt.length)return [];
  const qcSet={};
  obFzContent(qt).forEach(function(t){qcSet[t]=1;});
  const out=[];
  for(const item of exercises){
    const nm=item&&item.name;
    if(!nm)continue;
    const ct=obFzTokens(nm);
    if(!ct.length)continue;
    const sr=obFzScore(qt,ct);
    const score=sr.score;
    if(score<0.35)continue;
    const cSet={};
    ct.forEach(function(t){cSet[t]=1;});
    let droppedContent=0;
    for(const t in qcSet)if(!cSet[t])droppedContent++;
    out.push({id:item.id,name:nm,score:score,strongExtra:sr.strongExtra,droppedContent:droppedContent,eligible:obFzEligible(qt,ct)});
  }
  /* Best score first; ties broken by fewest dropped content words, then
     fewest movement-defining extras — so "Barbell Deadlift" (implement
     only) outranks "Axle Deadlift" for the query "Deadlift", and the
     dropdown suggestions lead with the cleanest match. */
  out.sort((a,b)=>b.score-a.score||a.droppedContent-b.droppedContent||a.strongExtra-b.strongExtra);
  return out.slice(0,limit);
}
function obCsvObvious(name,fuzzy){
  /* Confident auto-match (#140). The pick is the eligible candidate with
     the fewest movement-defining extra words (implement/grip/position
     words don't count), synonym affinity breaking movement ties
     ("rear delt"→"reverse fly" prefers the Fly over the Row), fuzzy rank
     order last. Token-subset picks — every query word appears in the
     candidate — promote at 0.5 instead of 0.6: "Deadlift"→"Barbell
     Deadlift", "Bicep curl"→"Dumbbell Bicep Curl", "Arnold press"→"Arnold
     Dumbbell Press", "Rear delt"→"Cable Rear Delt Fly".
     Guards that stay: equipment contradiction vetoes via eligibility; a
     token-subset pick below 0.6 that adds a movement word with no synonym
     backing stays manual too ("Press" must not become "Leg Press"). A
     same-band rival the synonyms can't resolve used to stay manual — user
     2026-09-12: those ties now auto-map to the first catalog variant.
     Every auto-match stays reviewable behind the tap-to-review toggle. */
  if(!fuzzy||!fuzzy.length)return null;
  const qt=obFzTokens(name);
  if(!qt.length)return null;
  const qset={};qt.forEach(function(t){qset[t]=1;});
  const moveWords=function(nm){const s={};obFzTokens(nm).forEach(function(t){if(!qset[t]&&!OB_FZ_IGNORABLE[t])s[t]=1;});return s;};
  const mwSubset=function(a,b){for(const t in a)if(!b[t])return false;return true;};
  const isSubset=function(nm){const s={};obFzTokens(nm).forEach(function(t){s[t]=1;});return qt.every(function(t){return s[t];});};
  let synToks=null;
  if(typeof searchSynonyms!=='undefined'&&searchSynonyms){
    const phrases=searchSynonyms[String(name||'').toLowerCase().trim()];
    if(phrases){synToks={};phrases.forEach(function(p){String(p).toLowerCase().split(/[^a-z0-9]+/).forEach(function(t){if(t)synToks[t]=1;});});}
  }
  const affinity=function(f){if(!synToks)return 0;const s={};obFzTokens(f.name).forEach(function(t){s[t]=1;});let n=0;for(const t in synToks)if(s[t])n++;return n;};
  const band=fuzzy.filter(function(f){return f.eligible&&f.score>=0.5;});
  if(!band.length)return null;
  const best=band[0].score,bestDc=band[0].droppedContent;
  const contenders=band.filter(function(f){return best-f.score<0.05&&f.droppedContent<=bestDc;});
  contenders.sort(function(a,b){return a.strongExtra-b.strongExtra||affinity(b)-affinity(a);});
  const top=contenders[0];
  const subset=isSubset(top.name);
  if(top.score<(subset?0.5:0.6))return null;
  if(subset&&top.score<0.6&&top.strongExtra>0&&affinity(top)===0)return null;
  const topMw=moveWords(top.name),topAff=affinity(top);
  let vetoed=false;
  for(let i=1;i<contenders.length;i++){
    const c=contenders[i];
    /* A rival whose movement words aren't a superset of the pick's names a
       genuinely different exercise — it vetoes unless the app's synonym
       map resolves the tie in the pick's favor. Pure implement/grip/
       position differences never veto. */
    if(!mwSubset(topMw,moveWords(c.name))&&!(topAff>affinity(c))){vetoed=true;break;}
  }
  if(vetoed){
    /* User 2026-09-12: a tie across DB variants auto-maps to the FIRST
       catalog variant instead of staying manual — the user picks a
       different one in review if the first wasn't right. */
    const dbRank={};
    (typeof exercises!=='undefined'?exercises:[]).forEach(function(e,i){if(e&&e.id&&!(e.id in dbRank))dbRank[e.id]=i;});
    return contenders.slice().sort(function(a,b){return (dbRank[a.id]??1e9)-(dbRank[b.id]??1e9);})[0];
  }
  return top;
}
function obResolveCsvExercise(name){
  obCsvBuildLookup();
  const raw=obCleanExerciseName(name);
  if(!raw)return {status:'blank'};
  if(obCsvIdSet[raw])return {status:'matched',id:raw,via:'id'};
  const id=obCsvNameToId[obCsvNorm(raw)];
  if(id)return {status:'matched',id:id,via:'name'};
  const stemId=obCsvStemToId[obFzTokens(raw).join('')];
  if(stemId)return {status:'matched',id:stemId,via:'stem'};
  const aliasId=obCsvAliasToId[obCsvNorm(raw)];
  if(aliasId)return {status:'matched',id:aliasId,via:'alias'};
  const cands=obCsvAliasCandidates(raw);
  for(const c of cands){
    const aid=obCsvNameToId[obCsvNorm(c)];
    if(aid)return {status:'matched',id:aid,via:'alias'};
  }
  const fz=obCsvFuzzy(raw,5);
  const obx=obCsvObvious(raw,fz);
  if(obx)return {status:'matched',id:obx.id,via:'fuzzy'};
  return {status:'unmatched'};
}
function obGroupCsvRows(rows){
  const groups=[],gIndex={};
  rows.forEach(row=>{
    const key=row.date+'||'+row.workout_name;
    let group=gIndex[key];
    if(!group){
      group={date:(row.date||'').trim(),name:(row.workout_name||'').trim(),exercises:[],exIndex:{}};
      gIndex[key]=group;groups.push(group);
    }
    const exName=(row.exercise||'').trim();
    if(!exName)return;
    let item=group.exIndex[exName];
    if(!item){item={csvName:exName,rows:[],exerciseNotes:[]};group.exIndex[exName]=item;group.exercises.push(item);}
    const hasSet=['set','reps','weight_lb','rpe','tags','duration_s'].some(c=>String(row[c]||'').trim()!=='');
    if(hasSet)item.rows.push(row);
    else{const n=String(row.notes||'').trim();if(n)item.exerciseNotes.push(n);}
  });
  return groups;
}
function obPlanCsvImport(text){
  const batchId='csv-'+obCsvHash(String(text));
  const parsed=obParseCsvText(text);
  const plan={batchId:batchId,source:parsed.format==='mf-history'?'mf-history':((parsed.format==='hevy'||parsed.format==='hevy-title')?'hevy':'csv'),kind:'history',workouts:[],unmatched:[],errors:parsed.errors.slice(),totalSets:0};
  if(plan.errors.length)return plan;
  const groups=obGroupCsvRows(parsed.rows);
  if(!groups.length){plan.errors.push('No workout rows found.');return plan;}
  const seen={};
  groups.forEach(group=>{
    if(!obValidIsoDate(group.date)){plan.errors.push('Invalid date "'+(group.date||'(blank)')+'". Use YYYY-MM-DD.');return;}
    const workout={date:group.date,name:group.name||('Imported '+group.date),exercises:[]};
    group.exercises.forEach(item=>{
      const res=obResolveCsvExercise(item.csvName);
      if(res.status==='unmatched'&&!seen[item.csvName]){seen[item.csvName]=true;plan.unmatched.push(item.csvName);}
      workout.exercises.push({csvName:item.csvName,rows:item.rows,exerciseNotes:item.exerciseNotes,resolution:res});
      plan.totalSets+=item.rows.length;
    });
    plan.workouts.push(workout);
  });
  plan.autoCount=0;plan.needCount=0;
  plan.workouts.forEach(w=>w.exercises.forEach(item=>{
    if(item.resolution.status==='matched')plan.autoCount++;else plan.needCount++;
  }));
  return plan;
}
function obBuildCsvSet(row,tagState){
  const setRaw=String(row.set||'').trim(),setLabel=setRaw||'?';
  const warmup=/^w\d*$/i.test(setRaw);
  const toFailure=/^\(?f\)?$/i.test(setRaw);
  const dropArrow=setRaw.indexOf('→')>=0||setRaw.indexOf('->')>=0;
  const pr=obParseCsvReps(row.reps,setLabel),tags=[];
  if(warmup&&tags.indexOf('Warmup')<0)tags.push('Warmup');
  if(toFailure){const tf=obCanonicalCsvTag('To failure');if(tf&&tags.indexOf(tf)<0)tags.push(tf);}
  if(dropArrow){const ds=obCanonicalCsvTag('Dropset');if(ds&&tags.indexOf(ds)<0)tags.push(ds);}
  String(row.tags||'').split(';').map(t=>t.trim()).filter(Boolean).forEach(t=>{
    const c=obCanonicalCsvTag(t);
    if(c&&tags.indexOf(c)<0)tags.push(c);
    else if(!c&&tagState.dropped.indexOf(t)<0)tagState.dropped.push(t);
  });
  return {set:{w:obParseCsvNumber(row.weight_lb),r:pr.r,seconds:obParseCsvNumber(row.duration_s),rpe:obParseCsvNumber(row.rpe),tags:tags,complete:true},note:pr.note};
}
function obCsvImportedBatches(){
  try{const raw=localStorage.getItem(OB_CSV_BATCH_KEY);const a=raw?JSON.parse(raw):[];return Array.isArray(a)?a:[];}catch(_){return [];}
}
function obCsvMarkImported(batchId){
  try{const a=obCsvImportedBatches();if(a.indexOf(batchId)<0){a.push(batchId);localStorage.setItem(OB_CSV_BATCH_KEY,JSON.stringify(a));}}catch(_){}
}

function obRenderImport(){
  return `
  <div class="ob-screen">
    <span class="ob-kicker">Import</span>
    <h1 class="ob-h1">Bring your training with you</h1>
    <p class="ob-sub">Upload a workout-history CSV or MacroFactor spreadsheet to import saved workouts.</p>
    <div class="ob-upload" id="obUploadBox" role="button" tabindex="0" aria-label="Upload a workout file">
      <div class="ob-upload-icon">↑</div>
      <div><strong>Tap to choose a file</strong></div>
      <div class="ob-hint">History CSV, or a MacroFactor program (.xlsx)</div>
      <input type="file" id="obCsvFile" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
    </div>
    <button class="ob-btn-link" id="obCsvHelpExpander" type="button" aria-expanded="false">What can I upload?</button>
    <div class="ob-help" id="obCsvHelp" hidden>
      <p><strong>History:</strong> columns <code>date,workout_name,exercise,set,reps,weight_lb,rpe,tags,notes</code> (+ optional <code>duration_s</code> for timed exercises), dates as YYYY-MM-DD. Hevy exports and MacroFactor workout-history CSVs work as-is.</p>
      <p><strong>Saved workouts:</strong> a MacroFactor program/workout spreadsheet (.xlsx) — rep ranges become targets, RIR becomes RPE, warmup sets become Warmup tags.</p>
      <p class="ob-muted">MacroFactor&rsquo;s bulk data export (nutrition, body metrics) isn&rsquo;t supported — export your program or workout history instead.</p>
    </div>
    <p class="ob-note" id="obUploadNote" role="status"></p>
    <div id="obImportPreview"></div>
    <button class="ob-btn-primary" id="obImportNowBtn" type="button" hidden>Import</button>
    <div class="ob-row">
      <button class="ob-btn-secondary" id="obImportContinue" type="button">Continue</button>
      <button class="ob-btn-link" id="obImportSkip" type="button">Skip for now</button>
    </div>
  </div>`;
}
function obWireImportSkips(box){
  box.querySelectorAll('.ob-wskip-cb').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const card=cb.closest('.ob-imp-workout');
      if(card)card.classList.toggle('skipped',cb.checked);
    });
  });
  box.querySelectorAll('.ob-imp-toggle').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const div=btn.nextElementSibling;
      const open=!!div.hidden;
      div.hidden=!open;
      btn.classList.toggle('open',open);
      btn.setAttribute('aria-expanded',String(open));
    });
  });
  obEl('obUploadNote').textContent='';
}
/* Perfect matches need no decision: collapse them behind one toggle per
   workout so review scrolls only through exercises that need attention. */
function obImpAutoBlock(auto,renderRow){
  if(!auto.length)return '';
  return '<button type="button" class="ob-imp-toggle" aria-expanded="false"><span class="ob-imp-tg-chev">›</span> ✓ '+
    auto.length+' auto-matched <span class="ob-muted">tap to review</span></button>'+
    '<div class="ob-imp-auto" hidden>'+auto.map(renderRow).join('')+'</div>';
}
function obImpReviewSummary(needCount,autoCount){
  if(!needCount)return ' Everything auto-matched — nothing needs your review.';
  return ' <strong>'+needCount+'</strong> need'+(needCount===1?'s':'')+' your review, <strong>'+autoCount+'</strong> auto-matched.';
}
function obImportSourceLabel(source){
  return source==='hevy'?'Hevy export':source==='mf-history'?'MacroFactor export':'CSV file';
}
/* Template preview: saved workouts with per-exercise targets instead of
   dated history. Same unmatched-dropdown machinery as the history path. */
function obRenderTemplatePreview(plan,box,btn){
  let html='';
  if(plan.errors.length){
    html='<div class="ob-imp-err">'+plan.errors.map(e=>'⚠ '+escapeHtml(e)).join('<br>')+'</div>';
  }else if(obCsvImportedBatches().indexOf(plan.batchId)>=0){
    html='<div class="ob-imp-err">This exact file was already imported — importing again would change nothing.</div>';
  }else{
    html='<div class="ob-imp-sum"><strong>'+plan.workouts.length+'</strong> saved workout'+(plan.workouts.length===1?'':'s')+', <strong>'+plan.totalSets+'</strong> planned sets found in your MacroFactor spreadsheet.'+obImpReviewSummary(plan.needCount||0,plan.autoCount||0)+'</div>';
    plan.workouts.forEach(w=>{
      html+='<div class="ob-imp-workout"><strong>'+escapeHtml(w.name)+'</strong><label class="ob-wskip"><input type="checkbox" class="ob-wskip-cb"> Skip this workout</label>';
      const need=[],auto=[];
      w.exercises.forEach(item=>{(item.resolution.status==='matched'?auto:need).push(item);});
      need.forEach(item=>{
        const tgt=item.timed?'timed':(item.range?item.range.min+'–'+item.range.max+' reps':'');
        const meta=item.sets.length+' set'+(item.sets.length===1?'':'s')+(tgt?' · '+tgt:'');
        const head='<span class="ob-imp-nm">'+escapeHtml(item.csvName)+' <span class="ob-muted">('+escapeHtml(meta)+')</span></span>';
        html+='<div class="ob-imp-ex">'+head+'<span class="ob-imp-no">unmatched</span><select class="ob-input ob-imp-sel" data-csv-name="'+escapeHtml(item.csvName)+'">'+obImpUnmatchedOptions(item.csvName)+'</select>'+obImpExistingPanel()+'</div>';
        if(item.notes.length)html+='<div class="ob-imp-note">'+escapeHtml(item.notes.join('; '))+'</div>';
      });
      html+=obImpAutoBlock(auto,item=>{
        const tgt=item.timed?'timed':(item.range?item.range.min+'–'+item.range.max+' reps':'');
        const meta=item.sets.length+' set'+(item.sets.length===1?'':'s')+(tgt?' · '+tgt:'');
        const head='<span class="ob-imp-nm">'+escapeHtml(item.csvName)+' <span class="ob-muted">('+escapeHtml(meta)+')</span></span>';
        return '<div class="ob-imp-ex">'+head+'<span class="ob-imp-ok">✓ '+escapeHtml(obCsvExName(item.resolution.id))+'</span></div>'+
          (item.notes.length?'<div class="ob-imp-note">'+escapeHtml(item.notes.join('; '))+'</div>':'');
      });
      html+='</div>';
    });
    btn.hidden=false;
    btn.textContent='Import '+plan.workouts.length+' saved workout'+(plan.workouts.length===1?'':'s');
  }
  box.innerHTML=html;
  obWireImportSkips(box);
  obWireExistingPickers(box);
}
function obRenderImportPreview(){
  const plan=obState.csvPlan,box=obEl('obImportPreview'),btn=obEl('obImportNowBtn');
  btn.hidden=true;
  if(!plan){box.innerHTML='';return;}
  if(plan.kind==='templates'){obRenderTemplatePreview(plan,box,btn);return;}
  let html='';
  if(plan.errors.length){
    html='<div class="ob-imp-err">'+plan.errors.map(e=>'⚠ '+escapeHtml(e)).join('<br>')+'</div>';
  }else if(obCsvImportedBatches().indexOf(plan.batchId)>=0){
    html='<div class="ob-imp-err">This exact file was already imported — importing again would change nothing.</div>';
  }else{
    html='<div class="ob-imp-sum"><strong>'+plan.workouts.length+'</strong> workout'+(plan.workouts.length===1?'':'s')+', <strong>'+plan.totalSets+'</strong> sets found in your '+obImportSourceLabel(plan.source)+'.'+obImpReviewSummary(plan.needCount||0,plan.autoCount||0)+'</div>';
    plan.workouts.forEach(w=>{
      html+='<div class="ob-imp-workout"><strong>'+escapeHtml(w.date)+' — '+escapeHtml(w.name)+'</strong><label class="ob-wskip"><input type="checkbox" class="ob-wskip-cb"> Skip this workout</label>';
      const need=[],auto=[];
      w.exercises.forEach(item=>{(item.resolution.status==='matched'?auto:need).push(item);});
      need.forEach(item=>{
        html+='<div class="ob-imp-ex"><span class="ob-imp-nm">'+escapeHtml(item.csvName)+'</span><span class="ob-imp-no">unmatched</span><select class="ob-input ob-imp-sel" data-csv-name="'+escapeHtml(item.csvName)+'">'+obImpUnmatchedOptions(item.csvName)+'</select>'+obImpExistingPanel()+'</div>';
      });
      html+=obImpAutoBlock(auto,item=>'<div class="ob-imp-ex"><span class="ob-imp-nm">'+escapeHtml(item.csvName)+'</span><span class="ob-imp-ok">✓ '+escapeHtml(obCsvExName(item.resolution.id))+'</span></div>');
      html+='</div>';
    });
    btn.hidden=false;
    btn.textContent='Import '+plan.workouts.length+' workout'+(plan.workouts.length===1?'':'s');
  }
  box.innerHTML=html;
  obWireImportSkips(box);
  obWireExistingPickers(box);
}
/* Unmatched-exercise dropdown options, shared by the history and template
   previews: Create custom (default unless there's an obvious match),
   fuzzy Match suggestions, "Use existing exercise…" (#139: library
   search mapping), Skip. */
function obImpUnmatchedOptions(csvName){
  const fz=obCsvFuzzy(csvName,5);
  const obx=obCsvObvious(csvName,fz);
  let opts='<option value="create"'+(obx?'':' selected')+'>Create custom</option>';
  fz.forEach(f=>{opts+='<option value="lib:'+escapeHtml(f.id)+'"'+(obx&&obx.id===f.id?' selected':'')+'>Match: '+escapeHtml(f.name)+'</option>';});
  opts+='<option value="existing">Use existing exercise…</option>';
  opts+='<option value="skip">Skip</option>';
  return opts;
}
/* #139: inline library search for the "Use existing exercise…" option.
   The chosen mapping is shown in the preview before confirm. */
function obImpExistingPanel(){
  return '<div class="ob-imp-existing" hidden>'+
    '<input type="search" class="ob-input ob-imp-exsearch" placeholder="Search your exercise library…" aria-label="Search your exercise library">'+
    '<div class="ob-imp-exresults" role="listbox"></div></div>'+
    '<div class="ob-imp-exchosen" hidden><span class="ob-imp-ok">→ <span class="ob-imp-exchosen-nm"></span></span> '+
    '<button type="button" class="ob-btn-link ob-imp-exchange">change</button></div>';
}
function obWireExistingPickers(box){
  if(typeof rankedExerciseMatches!=='function')return;
  box.querySelectorAll('.ob-imp-ex').forEach(row=>{
    const sel=row.querySelector('select.ob-imp-sel');
    const panel=row.querySelector('.ob-imp-existing');
    const chosen=row.querySelector('.ob-imp-exchosen');
    if(!sel||!panel||!chosen)return;
    const csvName=sel.getAttribute('data-csv-name');
    const input=panel.querySelector('.ob-imp-exsearch');
    const results=panel.querySelector('.ob-imp-exresults');
    const nameEl=chosen.querySelector('.ob-imp-exchosen-nm');
    if(!input||!results||!nameEl)return;
    const paintChosen=()=>{
      const id=obState.existingMap&&obState.existingMap[csvName];
      if(id){nameEl.textContent=obCsvExName(id);chosen.hidden=false;panel.hidden=true;}
      else chosen.hidden=true;
    };
    const renderResults=q=>{
      results.innerHTML='';
      if(!q){results.innerHTML='<div class="ob-muted">Type to search — the top matches appear here.</div>';return;}
      const hits=rankedExerciseMatches(q,6);
      if(!hits.length){results.innerHTML='<div class="ob-muted">No matches — try fewer words.</div>';return;}
      hits.forEach(ex=>{
        const b=document.createElement('button');
        b.type='button';b.className='ob-imp-exhit';b.setAttribute('role','option');
        b.setAttribute('data-exid',ex.id);
        b.innerHTML='<strong>'+escapeHtml(ex.name)+'</strong>'+(ex.equipment?'<span class="ob-muted"> · '+escapeHtml(ex.equipment)+'</span>':'');
        b.addEventListener('click',()=>{
          obState.existingMap=obState.existingMap||{};
          obState.existingMap[csvName]=ex.id;
          paintChosen();
        });
        results.appendChild(b);
      });
    };
    sel.addEventListener('change',()=>{
      if(sel.value==='existing'){panel.hidden=false;input.value='';renderResults('');input.focus();}
      else panel.hidden=true;
    });
    input.addEventListener('input',()=>renderResults(input.value.trim()));
    const changeBtn=chosen.querySelector('.ob-imp-exchange');
    if(changeBtn)changeBtn.addEventListener('click',()=>{chosen.hidden=true;panel.hidden=false;renderResults(input.value.trim());input.focus();});
    if(sel.value==='existing')paintChosen();
  });
}
/* Routes the reviewed import plan to the right writer: MacroFactor program sheets
   become saved-workout templates, everything else becomes completed workouts. */
function obDispatchImport(){
  const plan=obState.csvPlan;
  if(plan&&plan.kind==='templates')obExecuteMfTemplateImport();
  else obExecuteCsvImport();
}
function obWireImport(){
  const uploadBox=obEl('obUploadBox'),csvFile=obEl('obCsvFile');
  uploadBox.addEventListener('click',()=>csvFile.click());
  uploadBox.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();csvFile.click();}});
  csvFile.addEventListener('change',()=>{
    const file=csvFile.files&&csvFile.files[0];
    csvFile.value='';
    if(!file)return;
    /* .xlsx → MacroFactor program spreadsheet → saved workouts. */
    if(/\.xlsx$/i.test(file.name||'')){
      obEl('obUploadNote').textContent='Reading spreadsheet…';
      const reader=new FileReader();
      reader.onload=async()=>{
        try{
          const sheets=await obReadXlsxWorkbook(reader.result);
          obState.csvPlan=obPlanMfTemplateImport(sheets);obState.existingMap={};
        }catch(err){
          obState.csvPlan={batchId:'bad-'+Date.now(),source:'mf-template',kind:'templates',workouts:[],unmatched:[],errors:['Couldn\u2019t read that spreadsheet'+(err&&err.message?' ('+err.message+')':'')+'.'],totalSets:0};
          obState.existingMap={};
        }
        obRenderImportPreview();
      };
      reader.onerror=()=>{obEl('obUploadNote').textContent='Couldn\u2019t read that file.';};
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{obState.csvPlan=obPlanCsvImport(reader.result);obState.existingMap={};obRenderImportPreview();};
    reader.onerror=()=>{obEl('obUploadNote').textContent='Couldn\u2019t read that file.';};
    reader.readAsText(file);
  });
  obEl('obCsvHelpExpander').addEventListener('click',()=>{
    const help=obEl('obCsvHelp'),open=help.hidden;
    help.hidden=!open;
    obEl('obCsvHelpExpander').setAttribute('aria-expanded',String(open));
  });
  obEl('obImportNowBtn').addEventListener('click',obDispatchImport);
  /* The header × and the Done button both close; there is no next step. */
  const cont=obEl('obImportContinue');
  if(cont){cont.textContent='Done';cont.addEventListener('click',obCloseStandaloneImport);}
  const skip=obEl('obImportSkip');
  if(skip)skip.hidden=true;
}
/** Import the planned CSV straight into the app: customs into
    state.customExercises, workouts into workoutState.completed (newest first). */
/* #99 A16: two CSV/MF names normalizing identically (e.g. "Lat Pulldown"
   vs "lat-pulldown") must not mint the same custom-exercise id — disambiguate
   with a counter suffix while the id already exists in the library. */
function obUniqueCustomId(base){
  let id=base,n=2;
  while(exercises.some(e=>e.id===id)){id=`${base}-${n}`;n++;}
  return id;
}
/** Mint one custom exercise for an import decision and register it. */
function obCreateCustomForImport(csvName){
  const id=obUniqueCustomId(newCustomExerciseId(csvName));
  const customExercise={id:id,name:csvName,force:null,level:null,mechanic:null,equipment:null,tracking:'reps',primary:[],secondary:[],category:null,instructions:[],custom:true};
  exercises=[customExercise,...exercises];
  state.customExercises.unshift(customExercise);
  return id;
}
/* Read the per-exercise import decisions from the preview dropdowns.
   #141: a "Skip" on ANY card for an exercise wins globally. The old
   first-select-wins order let an untouched "Create custom" dropdown on
   another workout card override a Skip the user had tapped, so the
   exercise came through anyway (and minted a custom). Selects on
   skipped workout cards (data-wskip) are excluded before this runs. */
function obReadImportDecisions(){
  const finalId={};
  const sels=[...document.querySelectorAll('#obImportPreview select[data-csv-name]')]
    .filter(sel=>!sel.getAttribute('data-wskip'));
  const skipNames={};
  sels.forEach(sel=>{if(sel.value==='skip')skipNames[sel.getAttribute('data-csv-name')]=true;});
  sels.forEach(sel=>{
    const csvName=sel.getAttribute('data-csv-name');
    if(csvName in finalId)return;
    if(skipNames[csvName]){finalId[csvName]=null;return;}
    const v=sel.value;
    if(v==='skip'){finalId[csvName]=null;}
    else if(v.indexOf('lib:')===0){finalId[csvName]=v.slice(4);}
    else if(v==='existing'){
      /* #139: map onto the library exercise picked in the inline search.
         Nothing picked falls back to Create custom (the default) so no
         data is silently dropped. */
      const xid=obState.existingMap?obState.existingMap[csvName]:null;
      finalId[csvName]=(xid&&exercises.some(e=>e&&e.id===xid))?xid:obCreateCustomForImport(csvName);
    }
    else if(v==='create'){finalId[csvName]=obCreateCustomForImport(csvName);}
  });
  return finalId;
}
/* Writes the reviewed CSV plan into workoutState.completed (plus new customs into
   state.customExercises) and records the batch id so the same file can't be imported
   twice. */
function obExecuteCsvImport(){
  const plan=obState.csvPlan;
  if(!plan||plan.errors.length)return;
  const tagState={dropped:[]};
  const skipWi={};
  const cards=document.querySelectorAll('#obImportPreview .ob-imp-workout');
  cards.forEach((card,ci)=>{
    const cb=card.querySelector('.ob-wskip-cb');
    const skipped=!!(cb&&cb.checked);
    if(skipped)skipWi[ci]=true;
    card.querySelectorAll('select[data-csv-name]').forEach(sel=>{
      if(skipped)sel.setAttribute('data-wskip','1');else sel.removeAttribute('data-wskip');
    });
  });
  const finalId=obReadImportDecisions();
  const built=[];
  plan.workouts.forEach((workout,wi)=>{
    if(skipWi[wi])return;
    const items=[];
    workout.exercises.forEach(item=>{
      const exerciseId=item.resolution.status==='matched'?item.resolution.id:finalId[item.csvName];
      if(!exerciseId)return;
      const notes=item.exerciseNotes.slice();
      const sets=item.rows.map(row=>{
        const b=obBuildCsvSet(row,tagState);
        if(b.note)notes.push(b.note);
        const rn=String(row.notes||'').trim();
        if(rn)notes.push(rn);
        return b.set;
      });
      items.push({exerciseId:exerciseId,tracking:sets.some(s=>s.seconds!=null)?'time':'reps',note:notes.join('; '),exerciseTags:[],supersetId:null,progression:null,sets:sets});
    });
    if(!items.length)return;
    built.push({id:'csvimport-'+plan.batchId+'-'+wi,name:workout.name,date:workout.date,programId:null,programWorkoutUid:null,exercises:items});
  });
  /* Newest first, matching the app's unshift convention. */
  built.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  built.forEach(w=>workoutState.completed.unshift(w));
  workoutState.completed.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  schedulePersist();
  /* Standalone import: fold new customs into the library right away so they
     are pickable without a reload (same guard pattern as pullRemote). */
  if(typeof mergeCustomExercises==='function'){try{mergeCustomExercises();}catch(_){}}
  obCsvMarkImported(plan.batchId);
  const setCount=built.reduce((n,w)=>n+w.exercises.reduce((m,e)=>m+e.sets.length,0),0);
  obState.csvImportDone={workouts:built.length,sets:setCount};
  obState.csvPlan=null;
  obState.existingMap={};
  const dropped=tagState.dropped.length?' <span class="ob-muted">('+tagState.dropped.length+' unknown tag'+(tagState.dropped.length===1?'':'s')+' skipped: '+escapeHtml(tagState.dropped.join(', '))+')</span>':'';
  obEl('obImportPreview').innerHTML='<div class="ob-imp-ok">✓ <strong>'+built.length+' workout'+(built.length===1?'':'s')+', '+setCount+' sets</strong> imported into your history.'+dropped+'</div>';
  obEl('obImportNowBtn').hidden=true;
}

/* ---------- MacroFactor imports ----------
   Two MacroFactor formats, auto-detected by file type + headers:
   1. Program/workout spreadsheet (.xlsx): column A carries workout names,
      B=Exercise, C=Notes, then repeating "Set N Type / Rep Range / RIR /
      Rest" column groups. Imports as SAVED WORKOUTS (targets, not history):
      rep ranges become progression profiles, RIR becomes set RPE
      (RPE = 10 - RIR), warmup sets become Warmup tags.
   2. Workout-history CSV: one row per SET (Date, Workout, Exercise,
      Set Type, Weight (lb), Reps, RIR, Duration, ...). Imports as completed
      workouts through the same pipeline as native/Hevy CSVs.
   MacroFactor's bulk *data export* (~40 sheets of nutrition/body metrics)
   is neither of these and is rejected with a pointer to the right export. */

/* --- Minimal .xlsx reader: no dependencies, no DOM needed (regex XML), so
   the whole path unit-tests in node. Reads via the zip central directory,
   inflates with DecompressionStream, parses shared strings + sheet XML. */
function obXlsxUnescape(s){
  return String(s==null?'':s).replace(/&(amp|lt|gt|quot|apos);/g,function(m,e){return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e];});
}
function obZipEntries(buf){
  const b=new Uint8Array(buf);
  const le=function(o,n){let v=0;for(let i=0;i<n;i++)v|=(b[o+i]<<(8*i));return v>>>0;};
  let eocd=-1;
  for(let i=b.length-22;i>=0&&i>=b.length-22-65558;i--){if(le(i,4)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error('not a zip file');
  const count=le(eocd+10,2),cdOff=le(eocd+16,4),td=new TextDecoder();
  const entries={};let p=cdOff;
  for(let i=0;i<count;i++){
    if(le(p,4)!==0x02014b50)throw new Error('bad zip central directory');
    const method=le(p+10,2),csize=le(p+20,4);
    const nlen=le(p+28,2),elen=le(p+30,2),clen=le(p+32,2);
    const name=td.decode(b.subarray(p+46,p+46+nlen));
    const lho=le(p+42,4);
    p+=46+nlen+elen+clen;
    const lhNlen=le(lho+26,2),lhElen=le(lho+28,2);
    const dataOff=lho+30+lhNlen+lhElen;
    entries[name]={method:method,data:b.subarray(dataOff,dataOff+csize)};
  }
  return entries;
}
async function obInflateRaw(bytes){
  if(typeof DecompressionStream==='undefined')throw new Error('this browser cannot decompress .xlsx files');
  const ds=new DecompressionStream('deflate-raw');
  const reader=ds.readable.getReader();
  const chunks=[];
  /* Pump the readable side BEFORE writing: some browsers apply backpressure
     so write()+close() never settles until decompressed output is being
     consumed. Reading concurrently avoids the deadlock. */
  const pump=(async()=>{for(;;){const r=await reader.read();if(r.done)break;chunks.push(r.value);}})();
  const feed=(async()=>{
    const writer=ds.writable.getWriter();
    try{await writer.write(bytes);await writer.close();}
    finally{writer.releaseLock();}
  })();
  const work=Promise.all([pump,feed]);
  work.catch(()=>{});
  let timer=null;
  try{
    /* Watchdog: a stall must surface as an error, never an eternal spinner. */
    await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('decompression timed out')),20000);})]);
  }finally{if(timer)clearTimeout(timer);}
  const total=chunks.reduce(function(n,c){return n+c.length;},0);
  const out=new Uint8Array(total);let o=0;
  for(const c of chunks){out.set(c,o);o+=c.length;}
  return out;
}
function obXlsxParseShared(ssXml){
  const out=[],re=/<si>([\s\S]*?)<\/si>/g;let m;
  while((m=re.exec(ssXml))){
    const ts=[],tr=/<t[^>]*>([\s\S]*?)<\/t>/g;let tm;
    while((tm=tr.exec(m[1])))ts.push(obXlsxUnescape(tm[1]));
    out.push(ts.join(''));
  }
  return out;
}
/* Grid rows: {r: rowNumber, cells: {A:'', B:'', ...}}. Only the value is
   kept (styles, formulas, merges ignored) — enough for the flat exports. */
function obXlsxParseSheet(sheetXml,shared){
  const grid=[],rowRe=/<row\b[^>]*>([\s\S]*?)<\/row>/g;let rm;
  while((rm=rowRe.exec(sheetXml))){
    const rn=parseInt(((/\br="(\d+)"/.exec(rm[0])||[])[1]||'0'),10);
    const cells={},cellRe=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;let cm;
    while((cm=cellRe.exec(rm[1]))){
      const attrs=cm[1],inner=cm[2]||'';
      const ref=((/\br="([A-Z]+)\d+"/.exec(attrs))||[])[1];
      if(!ref)continue;
      const t=((/\bt="([^"]*)"/.exec(attrs))||[])[1]||'';
      let v='';
      if(t==='s'){
        const vi=parseInt((/<v>(-?\d+)<\/v>/.exec(inner)||[])[1],10);
        v=(isFinite(vi)&&shared[vi]!=null)?shared[vi]:'';
      }else if(t==='inlineStr'){
        const it=/<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
        v=it?obXlsxUnescape(it[1]):'';
      }else{
        const nv=/<v>([\s\S]*?)<\/v>/.exec(inner);
        v=nv?obXlsxUnescape(nv[1]):'';
      }
      cells[ref]=v;
    }
    grid.push({r:rn,cells:cells});
  }
  return grid;
}
async function obReadXlsxWorkbook(arrayBuffer){
  const entries=obZipEntries(arrayBuffer);
  const td=new TextDecoder();
  const get=async function(name){
    const e=entries[name];
    if(!e)throw new Error('missing '+name);
    const raw=e.method===8?await obInflateRaw(e.data):e.data;
    return td.decode(raw);
  };
  const workbookXml=await get('xl/workbook.xml');
  const relsXml=await get('xl/_rels/workbook.xml.rels');
  const shared=entries['xl/sharedStrings.xml']?obXlsxParseShared(await get('xl/sharedStrings.xml')):[];
  const sheets=[],sr=/<sheet\b[^>]*>/g;let sm;
  while((sm=sr.exec(workbookXml))){
    const nm=(/\bname="([^"]*)"/.exec(sm[0])||[])[1];
    const rid=(/\br:id="rId(\d+)"/.exec(sm[0])||[])[1];
    if(nm)sheets.push({name:obXlsxUnescape(nm),rid:rid||null});
  }
  const relMap={},rr=/<Relationship\b[^>]*>/g;let rm;
  while((rm=rr.exec(relsXml))){
    const id=(/\bId="([^"]*)"/.exec(rm[0])||[])[1];
    const tg=(/\bTarget="([^"]*)"/.exec(rm[0])||[])[1];
    if(id&&tg)relMap[id]=tg;
  }
  const out=[];
  for(const sh of sheets){
    const target=sh.rid?relMap['rId'+sh.rid]:null;
    const path=target?(target.indexOf('xl/')===0?target:'xl/'+target):null;
    if(!path||!entries[path])continue;
    out.push({name:sh.name,grid:obXlsxParseSheet(await get(path),shared)});
  }
  if(!out.length)throw new Error('no readable worksheets found');
  return out;
}

/* --- MacroFactor template spreadsheet -> workout blocks --- */
function obParseMfRepRange(raw){
  const s=String(raw==null?'':raw).trim();
  if(!s)return null;
  let m=s.match(/^(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)$/);
  if(m)return {min:parseFloat(m[1]),max:parseFloat(m[2])};
  m=s.match(/^(\d+(?:\.\d+)?)\s*\+$/);
  if(m)return {min:parseFloat(m[1]),max:parseFloat(m[1]),openTop:true};
  m=s.match(/^(\d+(?:\.\d+)?)$/);
  if(m)return {min:parseFloat(m[1]),max:parseFloat(m[1])};
  return null;
}
/* RIR and RPE are the same scale from opposite ends: RPE = 10 - RIR. */
function obMfRirToRpe(raw){
  const s=String(raw==null?'':raw).trim();
  if(!s)return '';
  const rir=parseFloat(s);
  if(!isFinite(rir))return '';
  return String(Math.round((10-rir)*2)/2);
}
function obMfTemplateSetTag(type){
  const t=String(type||'').toLowerCase().trim();
  if(!t||t==='standard set')return {tags:[],note:''};
  if(t==='warmup set'||t==='warm-up set')return {tags:['Warmup'],note:''};
  if(t.indexOf('drop')>=0)return {tags:['Dropset'],note:''};
  if(t.indexOf('failure')>=0)return {tags:['To failure'],note:''};
  return {tags:[],note:'Set type "'+String(type).trim()+'" has no mapping — kept as plain sets'};
}
function obParseMfTemplateSheet(sheet){
  let header=null;
  for(const row of sheet.grid){
    if(String(row.cells['B']||'').trim().toLowerCase()==='exercise'){header=row;break;}
  }
  if(!header)return {error:'not-template'};
  const colIdx=function(c){let n=0;for(const ch of c)n=n*26+(ch.charCodeAt(0)-64);return n;};
  const cols=Object.keys(header.cells).sort(function(a,b){return colIdx(a)-colIdx(b);});
  const groups=[];let cur=null;
  for(const c of cols){
    if(colIdx(c)<=colIdx('C'))continue;
    const m=String(header.cells[c]||'').trim().match(/^set\s+(\d+)\s+(type|rep range|rir|rest)$/i);
    if(!m){cur=null;continue;}
    const n=parseInt(m[1],10),kind=m[2].toLowerCase();
    if(kind==='type'){cur={n:n,type:c,repRange:null,rir:null,rest:null};groups.push(cur);}
    else if(cur&&cur.n===n){
      if(kind==='rep range')cur.repRange=c;
      else if(kind==='rir')cur.rir=c;
      else cur.rest=c;
    }
  }
  if(!groups.length)return {error:'not-template'};
  const workouts=[];let curW=null;
  for(const row of sheet.grid){
    if(row.r<=header.r)continue;
    const a=String(row.cells['A']||'').trim(),b=String(row.cells['B']||'').trim();
    if(a){curW={name:a,exercises:[]};workouts.push(curW);}
    if(!b||!curW)continue;
    const sets=[];
    for(const g of groups){
      const type=String(row.cells[g.type]||'').trim();
      const rr=g.repRange?String(row.cells[g.repRange]||'').trim():'';
      const rir=g.rir?String(row.cells[g.rir]||'').trim():'';
      if(!type&&!rr&&!rir)continue;
      sets.push({type:type||'Standard Set',repRange:rr,rir:rir});
    }
    if(!sets.length)continue;
    curW.exercises.push({name:obCleanExerciseName(b),notes:String(row.cells['C']||'').trim(),sets:sets});
  }
  return {workouts:workouts};
}
/* Plan the template import: same exercise-matching as history, but the
   payload is saved workouts (targets), not completed workouts. */
function obPlanMfTemplateImport(sheets){
  const batchId='mf-t-'+obCsvHash(sheets.map(function(s){return s.name;}).join('|')+'|'+sheets.length);
  const plan={batchId:batchId,source:'mf-template',kind:'templates',workouts:[],unmatched:[],errors:[],totalSets:0,totalExercises:0};
  let parsed=null;
  for(const sh of sheets){const p=obParseMfTemplateSheet(sh);if(!p.error){parsed=p;break;}}
  if(!parsed){
    const dataSmell=sheets.some(function(s){return /calories|macros|micronutrient|expenditure/i.test(s.name);});
    plan.errors.push(dataSmell
      ? 'That looks like a MacroFactor data export (nutrition/body metrics), not a program spreadsheet. In MacroFactor, export your program or workout as a spreadsheet (.xlsx) instead.'
      : 'That spreadsheet doesn\u2019t look like a MacroFactor program/workout export. Expected an Exercise column plus "Set 1 Type / Rep Range / RIR / Rest" groups.');
    return plan;
  }
  if(!parsed.workouts.length){plan.errors.push('No workouts found in that spreadsheet.');return plan;}
  const seen={};
  for(const w of parsed.workouts){
    const workout={name:w.name,exercises:[]};
    for(const ex of w.exercises){
      const res=obResolveCsvExercise(ex.name);
      if(res.status==='unmatched'&&!seen[ex.name]){seen[ex.name]=true;plan.unmatched.push(ex.name);}
      const sets=[],notes=[];
      if(ex.notes)notes.push(ex.notes);
      let range=null,timed=false;
      const unknownTypes=[];
      ex.sets.forEach(function(s){
        const tg=obMfTemplateSetTag(s.type);
        if(tg.note&&unknownTypes.indexOf(tg.note)<0)unknownTypes.push(tg.note);
        const rr=obParseMfRepRange(s.repRange);
        if(!range&&rr)range=rr;
        if(!rr)timed=true;
        sets.push({rpe:obMfRirToRpe(s.rir),tags:tg.tags});
        plan.totalSets++;
      });
      unknownTypes.forEach(function(t){notes.push(t);});
      if(timed)notes.push('No rep range in the file — treated as timed; default 30\u201360s, adjust in the app.');
      workout.exercises.push({csvName:ex.name,resolution:res,sets:sets,range:range,timed:timed,notes:notes});
      plan.totalExercises++;
    }
    if(workout.exercises.length)plan.workouts.push(workout);
  }
  if(!plan.workouts.length)plan.errors.push('No exercises found in that spreadsheet.');
  plan.autoCount=0;plan.needCount=0;
  plan.workouts.forEach(w=>w.exercises.forEach(item=>{
    if(item.resolution.status==='matched')plan.autoCount++;else plan.needCount++;
  }));
  return plan;
}
/* Writes a MacroFactor program spreadsheet as saved-workout templates instead of
   completed history. */
function obExecuteMfTemplateImport(){
  const plan=obState.csvPlan;
  if(!plan||plan.errors.length||plan.kind!=='templates')return;
  const skipWi={};
  document.querySelectorAll('#obImportPreview .ob-imp-workout').forEach(function(card,ci){
    const cb=card.querySelector('.ob-wskip-cb');
    const skipped=!!(cb&&cb.checked);
    if(skipped)skipWi[ci]=true;
    card.querySelectorAll('select[data-csv-name]').forEach(function(sel){
      if(skipped)sel.setAttribute('data-wskip','1');else sel.removeAttribute('data-wskip');
    });
  });
  const finalId=obReadImportDecisions();
  const built=[];
  plan.workouts.forEach(function(workout,wi){
    if(skipWi[wi])return;
    const items=[];
    workout.exercises.forEach(function(item){
      const exerciseId=item.resolution.status==='matched'?item.resolution.id:finalId[item.csvName];
      if(!exerciseId)return;
      const tracking=item.timed?'time':'reps';
      const progression=item.timed
        ? defaultExerciseProgression({mode:'time'})
        : defaultExerciseProgression({mode:'reps',min:item.range?item.range.min:null,max:item.range?item.range.max:null,openTop:!!(item.range&&item.range.openTop)});
      const sets=item.sets.map(function(s){return Object.assign(newSet(),{targetRpe:cleanTargetRpe(s.rpe),tags:s.tags.slice()});}); /* A7 (#99): MacroFactor template RIR→RPE is a prescribed target, not a logged actual. */
      items.push(newExerciseItem({exerciseId:exerciseId,tracking:tracking,note:item.notes.join('; '),exerciseTags:[],supersetId:null,progression:progression,sets:sets}));
    });
    if(!items.length)return;
    built.push({id:newTemplateId(),name:workout.name,exercises:items});
  });
  built.forEach(function(t){workoutState.templates.unshift(t);});
  schedulePersist();
  if(typeof mergeCustomExercises==='function'){try{mergeCustomExercises();}catch(_){}}
  obCsvMarkImported(plan.batchId);
  obState.mfTemplateDone={workouts:built.length,sets:plan.totalSets};
  obState.csvPlan=null;
  obState.existingMap={};
  obEl('obImportPreview').innerHTML='<div class="ob-imp-ok">✓ <strong>'+built.length+' saved workout'+(built.length===1?'':'s')+'</strong> imported. Find them under Workout → Saved workouts.</div>';
  obEl('obImportNowBtn').hidden=true;
}

/* --- MacroFactor workout-history CSV: one row per SET --- */
const OB_MF_SET_TAGS={'standard set':'','warmup set':'Warmup','warm-up set':'Warmup','failure set':'To failure','drop set':'Dropset','drop':'Dropset'};
function obMapMfHistoryRows(rows){
  return rows.map(function(row){
    const r={date:'',workout_name:'',exercise:'',set:'',reps:'',weight_lb:'',rpe:'',tags:'',notes:'',duration_s:''};
    r.date=String(row['date']||'').trim();
    r.workout_name=String(row['workout']||'').trim();
    r.exercise=obCleanExerciseName(row['exercise']);
    r.reps=String(row['reps']||'').trim();
    r.weight_lb=String(row['weight (lb)']||'').trim();
    const rir=String(row['rir']||'').trim();
    r.rpe=rir===''?'':obMfRirToRpe(rir);
    r.duration_s=String(row['duration']||'').trim();
    const notes=[];
    let st=String(row['set type']||'').toLowerCase().trim();
    const sm=st.match(/^(.*)\s+\(([lr])\)$/);
    let side='';
    if(sm){st=sm[1].trim();side=sm[2]==='l'?'left':'right';}
    if(st in OB_MF_SET_TAGS){if(OB_MF_SET_TAGS[st])r.tags=OB_MF_SET_TAGS[st];}
    else if(st)notes.push('Set type "'+String(row['set type']).trim()+'" has no mapping — kept as a plain set');
    if(side)notes.push('Logged as a '+side+'-side set in MacroFactor');
    const mi=String(row['distance long (mi)']||'').trim(),yd=String(row['distance short (yd)']||'').trim();
    if(mi)notes.push('Distance: '+mi+' mi');
    else if(yd)notes.push('Distance: '+yd+' yd');
    r.notes=notes.join('; ');
    return r;
  });
}


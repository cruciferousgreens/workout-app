'use strict';
/* Role: share-codec — link compatibility is a contract with already-sent
   links. Pins v1/v2 round-trips, the v2 slimming budget, uid stripping,
   the short-key expansion map, and a byte-for-byte golden v2 code that
   catches accidental schema drift. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {
  shareEncodeV1, shareDecodeV1, shareEncodeV2, shareDecodeAny,
  slimSharePayload, expandSharePayload, expandShareProgression,
  validSharePayload,
}=loadRole('share-codec');

function payloadFixture(){
  return {v:2,kind:'template',name:'Push Day',template:{name:'Push Day',exercises:[
    {uid:'x1',exerciseId:'bench-press',tracking:'reps',note:'go heavy',
     exerciseTags:['Main lift'],supersetId:null,
     progression:{mode:'reps',min:6,max:12,openTop:false,amrap:false,timeMin:30,
       timeMax:60,timeStep:5,incrementType:'lb',incrementValue:5,repsOnly:false,custom:true},
     sets:[
       {uid:'s1',w:135,r:8,seconds:'',rpe:7,targetRpe:'',tags:['Warmup'],complete:true},
       {uid:'s2',w:185,r:5,seconds:'',rpe:9,targetRpe:'',tags:[],complete:true}]},
    {uid:'x2',exerciseId:'overhead-press',tracking:'reps',note:'',exerciseTags:[],
     supersetId:null,progression:null,
     sets:[{uid:'s3',w:95,r:8,seconds:'',rpe:8,targetRpe:'',tags:[],complete:true}]},
  ]},customExercises:[]};
}
/* Uids regenerate on expand — strip them before comparing round-trips. */
function stripUids(o){
  if(Array.isArray(o))return o.map(stripUids);
  if(o&&typeof o==='object'){
    const c={};for(const k of Object.keys(o))if(k!=='uid')c[k]=stripUids(o[k]);return c;
  }
  return o;
}

/* Golden v2 code for the exact fixture above (name "Push Day", no emoji).
   Deflate is deterministic in Node's zlib — if this ever changes without a
   deliberate schema edit, links already sent may be orphaned. */
const GOLDEN_PAYLOAD_NAME='Push Day';
const GOLDEN_V2='eJw9jrFug0AUBH8FTb0pcHQJfnXaSO5SnF5xdi4GhQACgxQh_j1ykFzvamZWFuwgvjFuiA7jNE918ZZ-ERmLKw3GOXeX-mkY8zQheoxrX9Q5LffbFYu8p6Yr2ubrhosBWxmx-KLy4GLCgu6gSHtGwcUFK7ddEcvnoErd3LZ6VeQjjT_zgLtiWQWFfTm6b9pr-iWPdU6fj6B_yvEBqdw33_4Ay84_tA';

describe('share codec',()=>{
  it('v1 round-trips, incl. unicode/emoji names',()=>{
    const p=payloadFixture(); p.name='Push Day 💪'; p.template.name='Push Day 💪';
    assert.deepEqual(shareDecodeV1(shareEncodeV1(p)),p);
  });
  it('v2 round-trips through shareDecodeAny',async()=>{
    const back=await shareDecodeAny(await shareEncodeV2(payloadFixture()));
    assert.equal(back.kind,'template');
    assert.equal(back.name,'Push Day');
    const ex0=back.template.exercises[0];
    assert.equal(ex0.exerciseId,'bench-press');
    assert.equal(ex0.note,'go heavy');
    assert.deepEqual(ex0.exerciseTags,['Main lift']);
    assert.deepEqual(stripUids(ex0.sets[0]),
      {w:135,r:8,seconds:'',rpe:7,targetRpe:'',tags:['Warmup'],complete:false});
    assert.deepEqual(stripUids(ex0.sets[1]),
      {w:185,r:5,seconds:'',rpe:9,targetRpe:'',tags:[],complete:false});
  });
  it('v1 legacy strings still decode via shareDecodeAny (backward compat)',async()=>{
    const p=payloadFixture();
    assert.deepEqual(await shareDecodeAny(shareEncodeV1(p)),p);
  });
  it('slimming: a 3-exercise workout stays within the ~400-char budget',async()=>{
    const p=payloadFixture();
    p.template.exercises.push(
      {uid:'x3',exerciseId:'deadlift',tracking:'reps',note:'',exerciseTags:[],
       supersetId:null,progression:{mode:'reps',min:1,max:5},
       sets:[{uid:'s4',w:315,r:5,seconds:'',rpe:8,targetRpe:'',tags:[],complete:true}]});
    const code=await shareEncodeV2(p);
    assert.ok(code.length<=400,`v2 code was ${code.length} chars`);
  });
  it('slimSharePayload drops uids and every structurally-empty field',()=>{
    const slimmed=JSON.stringify(slimSharePayload(payloadFixture()));
    assert.ok(!slimmed.includes('"uid"'),'no uids in the slim payload');
    assert.ok(!slimmed.includes('"note":""'),'no empty notes');
  });
  it('expand re-derives dropped fields to the documented defaults',async()=>{
    const back=await shareDecodeAny(await shareEncodeV2(payloadFixture()));
    const prog=back.template.exercises[1].progression; // was null → defaults
    assert.equal(prog.mode,'reps');
    assert.equal(prog.timeMin,30);
    assert.equal(prog.timeMax,60);
    const kept=back.template.exercises[0].progression; // non-defaults kept
    assert.equal(kept.min,6);
    assert.equal(kept.max,12);
    assert.equal(kept.custom,true);
  });
  it('expandShareProgression maps every short key',()=>{
    assert.deepEqual(expandShareProgression(
      {d:'time',r:[6,12],o:1,a:1,t:[30,60],s:5,i:['lb',5],l:1,c:1,
       m:'linear',p:80,x:200,u:'manual'}),
      {mode:'time',min:6,max:12,openTop:true,amrap:true,timeMin:30,timeMax:60,
       timeStep:5,incrementType:'lb',incrementValue:5,repsOnly:true,custom:true,
       scheme:'linear',percentOf1RM:80,trainingMax:200,tmSource:'manual'});
  });
  it('golden v2 code is byte-for-byte stable',async()=>{
    const p=payloadFixture();
    assert.equal(p.name,GOLDEN_PAYLOAD_NAME);
    assert.equal(await shareEncodeV2(p),GOLDEN_V2);
  });
  it('program payloads round-trip (kind, workouts, targetRpe kept)',async()=>{
    const prog={v:2,kind:'program',name:'PPL',program:{name:'PPL',length:6,
      startWeek:1,focus:'',progression:null,workouts:[{name:'Push',
        template:{name:'Push',exercises:[
          {uid:'x1',exerciseId:'bench-press',tracking:'reps',note:'',exerciseTags:[],
           supersetId:null,progression:null,
           sets:[{uid:'s1',w:'',r:'',seconds:'',rpe:'',targetRpe:8,tags:[],
             complete:false}]}]}}]},customExercises:[]};
    const back=await shareDecodeAny(await shareEncodeV2(prog));
    assert.equal(back.kind,'program');
    assert.equal(back.program.name,'PPL');
    assert.equal(back.program.length,6);
    assert.equal(back.program.workouts[0].template.exercises[0].sets[0].targetRpe,'8'); // normalized to string by cleanTargetRpe
  });
  it('validSharePayload gates hand-edited/corrupt links',()=>{
    assert.equal(validSharePayload(payloadFixture()),true);
    assert.equal(validSharePayload({v:99,kind:'template',name:'x'}),false);
    assert.equal(validSharePayload(null),false);
    assert.equal(validSharePayload({...payloadFixture(),name:''}),false);
  });
});

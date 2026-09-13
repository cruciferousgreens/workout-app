'use strict';
/* #207 (user 2026-09-12): sharing requires an account. deliverShareLink is
   the single creation funnel — shareTemplate, shareTemplateLike, and
   shareActiveProgram all flow through it — so the gate lives there: a
   signed-out tap opens the sign-in prompt and mints no link; signed-in
   keeps the existing short-then-long behavior. Recipient-side landing
   (#180) is untouched. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const shareSrc=fs.readFileSync(path.join(ROOT,'assets/js/share.js'),'utf8');

/* Fake DOM: dialogs record showModal/close; the link field records value. */
function makeEl(){
  return {
    open:false,shown:0,closed:0,value:'',textContent:'',hidden:false,focused:0,
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    showModal(){this.open=true;this.shown++;},
    close(){this.open=false;this.closed++;},
    focus(){this.focused++;},
    select(){},
    addEventListener(){},removeEventListener(){},
    setAttribute(){},getAttribute:()=>null,
  };
}
const els={};
function fakeDocument(){
  return {
    querySelector(sel){
      if(!els[sel])els[sel]=makeEl();
      return els[sel];
    },
    querySelectorAll:()=>[],
    getElementById:()=>null,
    addEventListener(){},removeEventListener(){},
    createElement:()=>makeEl(),
    hidden:false,title:'',
  };
}

/* Node's global navigator is getter-only — define it directly instead of via
   the harness's Object.assign path. */
try{Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});}catch(_){}
const role=loadRole('share-signin-gate',{globals:{
  document:fakeDocument(),
  location:{origin:'http://localhost',pathname:'/',search:'',hash:''},
}});
const {deliverShareLink,shareSignedIn}=role;

const PAYLOAD={kind:'template',name:'Test workout',template:{exercises:[]}};

beforeEach(()=>{
  for(const k of Object.keys(els))delete els[k];
  globalThis.lastAuthUid=null;
  delete globalThis.Sync;
});

describe('signed-out share attempts show the sign-in prompt, mint nothing',()=>{
  it('shareSignedIn() is false with no auth',()=>{
    assert.strictEqual(shareSignedIn(),false);
  });
  it('deliverShareLink opens the sign-in prompt and touches no link field',async()=>{
    await deliverShareLink(PAYLOAD);
    assert.strictEqual(els['#shareSignInDialog'].shown,1,'sign-in prompt shown');
    assert.ok(!els['#shareLinkField'],'share link field never touched');
    assert.ok(!els['#shareLinkDialog'],'share link dialog never opened');
  });
  it('the prompt markup exists with sign-in and dismiss actions',()=>{
    assert.ok(html.includes('id="shareSignInDialog"'),'dialog present');
    assert.ok(html.includes('id="goShareSignIn"'),'sign-in button present');
    assert.ok(html.includes('id="cancelShareSignIn"'),'dismiss button present');
    assert.ok(html.includes('id="closeShareSignInDialog"'),'close button present');
    assert.match(html,/id="shareSignInDialog"[\s\S]{0,600}Sign in to share/,'friendly copy present');
  });
});

describe('signed-in sharing keeps the existing behavior',()=>{
  it('shareSignedIn() is true via the global uid shim',()=>{
    globalThis.lastAuthUid='user-123';
    assert.strictEqual(shareSignedIn(),true);
  });
  it('shareSignedIn() is true via Sync.lastAuthUid',()=>{
    globalThis.Sync={lastAuthUid:'user-123'};
    assert.strictEqual(shareSignedIn(),true);
  });
  it('deliverShareLink builds the long link and opens the link dialog',async()=>{
    globalThis.lastAuthUid='user-123';
    await deliverShareLink(PAYLOAD);
    assert.strictEqual(els['#shareSignInDialog']?.shown||0,0,'no sign-in prompt');
    const url=els['#shareLinkField']?.value||'';
    assert.match(url,/^http:\/\/localhost\/#share=/,'long link delivered to the dialog field');
    assert.strictEqual(els['#shareLinkDialog'].shown,1,'share link dialog opened');
  });
  it('the gate sits before any link building in deliverShareLink',()=>{
    const body=shareSrc.match(/async function deliverShareLink\(payload\)\{([\s\S]*?)\n    \}/)[1];
    const gate=body.indexOf('shareSignedIn()');
    const build=body.indexOf('shareCode(payload)');
    assert.ok(gate!==-1&&build!==-1,'gate and build both present');
    assert.ok(gate<build,'sign-in check runs before any link is built');
  });
});

describe('#326 share dialog header copy follows the sign-in state',()=>{
  const {openShareSignInPrompt,shareSignInMintShare}=role;
  it('opening the prompt shows the signed-out copy',()=>{
    openShareSignInPrompt(PAYLOAD);
    assert.strictEqual(els['#shareSignInTitle'].textContent,'Sign in to share');
    assert.strictEqual(els['#shareSignInDesc'].textContent,'Sharing needs an account. It’s free to sign up.');
  });
  it('minting after sign-in switches to the share copy',async()=>{
    globalThis.lastAuthUid='user-123';
    openShareSignInPrompt(PAYLOAD);
    await shareSignInMintShare();
    assert.strictEqual(els['#shareSignInTitle'].textContent,'Share link');
    assert.strictEqual(els['#shareSignInDesc'].textContent,'Send this shared workout with the link below.');
    assert.strictEqual(els['#shareSignInStep3'].hidden,false,'step 3 visible');
  });
  it('reopening the prompt resets to the signed-out copy',async()=>{
    globalThis.lastAuthUid='user-123';
    openShareSignInPrompt(PAYLOAD);
    await shareSignInMintShare();
    globalThis.lastAuthUid=null;
    openShareSignInPrompt(PAYLOAD);
    assert.strictEqual(els['#shareSignInTitle'].textContent,'Sign in to share');
    assert.strictEqual(els['#shareSignInDesc'].textContent,'Sharing needs an account. It’s free to sign up.');
  });
});

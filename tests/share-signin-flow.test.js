'use strict';
/* #215 (user 2026-09-12): the signed-out sign-in prompt is a self-contained
   3-step modal flow — intro → inline sign-in → share info.
   - Step 1: "Sign in" is the FIRST button (primary), "Not now" secondary.
   - Tapping Sign in reveals the sign-in form INLINE (no Settings routing).
   - On successful sign-in the modal mints the share and shows the link
     field (Copy link / Share… / Done) inside the modal. */
const {describe,it,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

/* Fake DOM: dialogs record showModal/close; steps toggle hidden. */
function makeEl(){
  return {
    open:false,shown:0,closed:0,value:'',textContent:'',hidden:false,
    disabled:false,focused:0,
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    showModal(){this.open=true;this.shown++;},
    close(){this.open=false;this.closed++;},
    focus(){this.focused++;},
    select(){},
    addEventListener(){},removeEventListener(){},
    setAttribute(){},getAttribute:()=>null,removeAttribute(){},
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

try{Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});}catch(_){}
/* Short-link minting is stubbed out: the flow must fall back to the long link. */
globalThis.tryShortShareLink=async()=>null;

const syncCalls={request:null,confirm:null};
globalThis.Sync={
  lastAuthUid:null,
  magicLinkCooldownRemaining:()=>0,
  requestSignInCode:async(opts)=>{syncCalls.request=opts;return true;},
  confirmSignInCode:async(opts)=>{
    syncCalls.confirm=opts;
    globalThis.lastAuthUid='user-123'; /* simulate onAuthStateChange landing */
    return true;
  },
};

const role=loadRole('share-signin-flow',{globals:{
  document:fakeDocument(),
  location:{origin:'http://localhost',pathname:'/',search:'',hash:''},
}});
const {openShareSignInPrompt,goShareSignInInline,shareSignInShowStep,
  shareSignInSendCode,shareSignInVerifyCode,shareSignedIn}=role;

const PAYLOAD={kind:'template',name:'Test workout',template:{exercises:[]}};

beforeEach(()=>{
  for(const k of Object.keys(els))delete els[k];
  globalThis.lastAuthUid=null;
  globalThis.Sync.lastAuthUid=null;
  syncCalls.request=null;syncCalls.confirm=null;
});
after(()=>{
  /* goShareSignInInline starts a 1s cooldown ticker — clear it so the test
     process can exit. shareSignInCooldownTimer is module-scoped but visible
     in the global lexical env via the role proxy. */
  try{const t=role.shareSignInCooldownTimer;if(t)clearInterval(t);}catch(_){}
});

describe('#215 step-1 markup: Sign in is the first, primary button',()=>{
  it('Sign in (primary) comes before Not now (secondary) in the DOM',()=>{
    const step=html.match(/<div id="shareSignInStep1">([\s\S]*?)<\/div>\s*<div id="shareSignInStep2"/)[1];
    const signIn=step.indexOf('id="goShareSignIn"');
    const notNow=step.indexOf('id="cancelShareSignIn"');
    assert.ok(signIn!==-1&&notNow!==-1,'both buttons present in step 1');
    assert.ok(signIn<notNow,'Sign in is the first button');
    assert.match(step,/<button[^>]*id="goShareSignIn"[^>]*>/,'Sign in button present');
    assert.match(step,/<button[^>]*class="form-action primary"[^>]*id="goShareSignIn"[^>]*>/,'Sign in is primary');
    assert.match(step,/<button[^>]*class="form-action secondary"[^>]*id="cancelShareSignIn"[^>]*>/,'Not now is secondary');
  });
  it('step 2 holds the inline sign-in form (email + code + verify)',()=>{
    assert.ok(html.includes('id="shareSignInEmail"'),'email input present');
    assert.ok(html.includes('id="shareSignInSendCode"'),'Email me a code button present');
    assert.ok(html.includes('id="shareSignInOtpStep"'),'otp step present');
    assert.ok(html.includes('id="shareSignInOtp"'),'code input present');
    assert.ok(html.includes('id="shareSignInVerify"'),'verify Sign in button present');
    assert.ok(html.includes('id="shareSignInStatus"'),'status line present');
  });
  it('step 3 holds the share-info content (link field + two centered actions)',()=>{
    assert.ok(html.includes('id="shareSignInLinkField"'),'link field present');
    assert.ok(html.includes('id="shareSignInCopyBtn"'),'Copy link present');
    assert.ok(html.includes('id="shareSignInNativeBtn"'),'Share… present');
    /* #244 (user 2026-09-12): no copy and no Done on the share screen. */
    assert.ok(!html.includes('id="shareSignInLinkNote"'),'no link note');
    assert.ok(!html.includes('id="shareSignInDone"'),'no Done button');
  });
  it('#244: step 3 order is Copy link (primary) → Share… (icon), centered',()=>{
    const step3=html.slice(html.indexOf('id="shareSignInStep3"'));
    const actions=step3.slice(0,step3.indexOf('</div>\n     </div>'));
    const iCopy=actions.indexOf('id="shareSignInCopyBtn"');
    const iShare=actions.indexOf('id="shareSignInNativeBtn"');
    assert.ok(iCopy!==-1&&iShare!==-1,'both actions present');
    assert.ok(iCopy<iShare,'order: Copy link, Share…');
    assert.ok(/class="form-action primary"[^>]*id="shareSignInCopyBtn"/.test(actions),'Copy link is primary');
    assert.ok(/id="shareSignInNativeBtn"[^]*?<svg[^>]*viewBox="0 0 24 24"[^]*?<\/svg>/.test(actions),'Share… carries the share glyph');
    assert.ok(actions.includes('form-actions centered'),'actions are centered');
  });
});

describe('#215 flow: intro → inline sign-in → share info',()=>{
  it('opening the prompt shows step 1 and stashes the payload',()=>{
    openShareSignInPrompt(PAYLOAD);
    assert.strictEqual(els['#shareSignInDialog'].shown,1,'modal shown');
    assert.strictEqual(els['#shareSignInStep1'].hidden,false,'step 1 visible');
    assert.strictEqual(els['#shareSignInStep2'].hidden,true,'step 2 hidden');
    assert.strictEqual(els['#shareSignInStep3'].hidden,true,'step 3 hidden');
  });
  it('Sign in reveals the inline form without leaving the modal',()=>{
    openShareSignInPrompt(PAYLOAD);
    goShareSignInInline();
    assert.strictEqual(els['#shareSignInStep1'].hidden,true,'step 1 hidden');
    assert.strictEqual(els['#shareSignInStep2'].hidden,false,'step 2 visible');
    assert.strictEqual(els['#shareSignInEmail'].focused,1,'email focused');
    /* No Settings routing: the Settings account email was never touched and
       no navigation happened (showSettings is not even defined here). */
    assert.ok(!els['#accountEmail'],'Settings account form untouched');
  });
  it('Email me a code reveals the OTP step via the shared auth logic',async()=>{
    openShareSignInPrompt(PAYLOAD);
    goShareSignInInline();
    els['#shareSignInEmail'].value='a@b.co';
    await shareSignInSendCode();
    assert.strictEqual(syncCalls.request.email,'a@b.co','shared requestSignInCode used');
    assert.strictEqual(typeof syncCalls.request.setStatus,'function','modal status writer passed');
    assert.strictEqual(els['#shareSignInOtpStep'].hidden,false,'otp step revealed');
  });
  it('successful sign-in mints the share and shows the link in the modal',async()=>{
    openShareSignInPrompt(PAYLOAD);
    goShareSignInInline();
    els['#shareSignInEmail'].value='a@b.co';
    await shareSignInSendCode();
    els['#shareSignInOtp'].value='123456';
    await shareSignInVerifyCode();
    assert.strictEqual(syncCalls.confirm.token,'123456','shared confirmSignInCode used');
    assert.strictEqual(shareSignedIn(),true,'auth landed');
    assert.strictEqual(els['#shareSignInStep3'].hidden,false,'step 3 visible');
    const url=els['#shareSignInLinkField'].value||'';
    assert.match(url,/^http:\/\/localhost\/#share=/,'long link minted inside the modal');
    assert.strictEqual(els['#shareLinkDialog']?.shown||0,0,'separate link dialog never opened');
    assert.ok(!els['#shareLinkField'],'separate link field never touched');
    assert.strictEqual(els['#shareSignInDialog'].closed,0,'modal still open');
  });
  it('a failed code keeps the user on step 2 with the inline error',async()=>{
    const orig=globalThis.Sync.confirmSignInCode;
    let statusMsg='';
    globalThis.Sync.confirmSignInCode=async(opts)=>{
      opts.setStatus('That code didn\u2019t work \u2014 double-check it against the email and try again.',true);
      return false;
    };
    try{
      openShareSignInPrompt(PAYLOAD);
      goShareSignInInline();
      els['#shareSignInEmail'].value='a@b.co';
      await shareSignInSendCode();
      els['#shareSignInOtp'].value='000000';
      await shareSignInVerifyCode();
      assert.strictEqual(els['#shareSignInStep2'].hidden,false,'still on step 2');
      assert.strictEqual(els['#shareSignInStep3'].hidden,true,'step 3 not shown');
      statusMsg=els['#shareSignInStatus'].textContent;
      assert.match(statusMsg,/didn\u2019t work/,'inline error shown');
    }finally{
      globalThis.Sync.confirmSignInCode=orig;
    }
  });
});

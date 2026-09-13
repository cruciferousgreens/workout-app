'use strict';
/* #286 (user 2026-09-12): post-workout signed-out nudge — finishing a workout
   while signed out shows a dialog explaining sync/backup, with Sign in /
   Dismiss and a persisted "Don't show again". Behavioral test: the account-UI
   module runs in a vm sandbox with stubbed browser globals; markup pins come
   from index.html. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');

function loadAccountUi({signedIn=false,dismissed=false}={}){
  const src=fs.readFileSync(path.join(ROOT,'assets/js/sync-account-ui.js'),'utf8');
  const store=dismissed?{'workout-signin-nudge-dismissed':'1'}:{};
  const shown={modal:false};
  const elements={
    signinNudgeDialog:{showModal(){shown.modal=true;},close(){shown.modal=false;},addEventListener(){}},
    signinNudgeDontShow:{checked:false,addEventListener(){}},
  };
  for(const id of ['closeSigninNudge','signinNudgeDismiss','signinNudgeSignIn']){
    elements[id]={handlers:{},addEventListener(ev,fn){this.handlers[ev]=fn;}};
  }
  const click=id=>elements[id].handlers.click();
  const sandbox={
    window:{},
    localStorage:{
      getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
      setItem(k,v){store[k]=String(v);},
    },
    document:{getElementById(id){return elements[id]||null;}},
    setTimeout(){return 0;},
    clearTimeout(){},
  };
  sandbox.window.Sync=null;
  /* The module reads bare `$` — map it to getElementById. */
  sandbox.$=id=>sandbox.document.getElementById(id.startsWith('#')?id.slice(1):id);
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'sync-account-ui.js'});
  const Sync=sandbox.window.Sync;
  if(signedIn)Sync.lastAuthUid='uid-123';
  Sync.wireAccountUI(); /* wires the nudge buttons */
  return {Sync,shown,store,elements,sandbox,click};
}

describe('maybeShowSigninNudge',()=>{
  it('shows the dialog when signed out and never dismissed',()=>{
    const {Sync,shown}=loadAccountUi();
    Sync.maybeShowSigninNudge();
    assert.equal(shown.modal,true);
  });
  it('stays hidden when signed in',()=>{
    const {Sync,shown}=loadAccountUi({signedIn:true});
    Sync.maybeShowSigninNudge();
    assert.equal(shown.modal,false);
  });
  it('stays hidden once "Don\'t show again" was persisted',()=>{
    const {Sync,shown}=loadAccountUi({dismissed:true});
    Sync.maybeShowSigninNudge();
    assert.equal(shown.modal,false);
  });
});

describe('nudge button wiring',()=>{
  it('Dismiss with "Don\'t show again" checked persists the flag and closes',()=>{
    const {Sync,shown,store,elements,click}=loadAccountUi();
    Sync.maybeShowSigninNudge();
    assert.equal(shown.modal,true);
    elements.signinNudgeDontShow.checked=true;
    click('signinNudgeDismiss');
    assert.equal(shown.modal,false);
    assert.equal(store['workout-signin-nudge-dismissed'],'1');
  });
  it('Dismiss without the checkbox closes but does not persist',()=>{
    const {Sync,shown,store,click}=loadAccountUi();
    Sync.maybeShowSigninNudge();
    click('signinNudgeDismiss');
    assert.equal(shown.modal,false);
    assert.equal(store['workout-signin-nudge-dismissed'],undefined);
  });
  it('the × close path is wired',()=>{
    const {Sync,shown,click}=loadAccountUi();
    Sync.maybeShowSigninNudge();
    click('closeSigninNudge');
    assert.equal(shown.modal,false);
  });
  it('Sign in closes the dialog and routes to Settings',()=>{
    const {Sync,shown,click,sandbox}=loadAccountUi();
    let settingsShown=false;
    sandbox.showSettings=()=>{settingsShown=true;};
    sandbox.document.getElementById=()=>null; /* no account card in the stub */
    Sync.maybeShowSigninNudge();
    click('signinNudgeSignIn');
    assert.equal(shown.modal,false);
    assert.equal(settingsShown,true);
  });
});

describe('signinNudgeDialog markup (index.html)',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const at=html.indexOf('id="signinNudgeDialog"');
  it('the dialog exists with the sync/backup explainer',()=>{
    assert.ok(at!==-1,'dialog present');
    const dlg=html.slice(at,at+1200);
    assert.ok(/signed out/i.test(dlg),'explains the signed-out state');
    assert.ok(/sync/i.test(dlg),'mentions sync');
  });
  it('has Sign in (primary), Dismiss, and a persisted Don\'t show again',()=>{
    const dlg=html.slice(at,at+1200);
    assert.ok(dlg.includes('id="signinNudgeSignIn"'),'Sign in button');
    assert.ok(dlg.includes('id="signinNudgeDismiss"'),'Dismiss button');
    assert.ok(dlg.includes('id="signinNudgeDontShow"'),'Don\'t show again checkbox');
    assert.ok(dlg.includes('primary-button" id="signinNudgeSignIn"'),'Sign in is the primary action');
  });
  it('finishWorkout triggers the nudge',()=>{
    const src=fs.readFileSync(path.join(ROOT,'assets/js/workout-history.js'),'utf8');
    assert.ok(src.includes('Sync.maybeShowSigninNudge()'),'finishWorkout calls the nudge');
  });
});

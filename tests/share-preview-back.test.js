'use strict';
/* #265 (user 2026-09-12): system Back from a share preview must dismiss the
   preview to Home and clear the preview state — never exit the app from a
   cold open, and never leave a stale preview cached. Behavioral test:
   share.js runs in a vm sandbox with stubbed browser globals. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadShareSandbox(){
  const src=fs.readFileSync(path.join(__dirname,'..','assets/js/share.js'),'utf8');
  const entries=[]; /* history entries: {state,url} */
  const sandbox={
    state:{sharePreview:null,savedWorkoutId:null,builderOpen:false,workoutHistoryOpen:false},
    location:{hash:'',pathname:'/',search:''},
    history:{
      get state(){return entries.length?entries[entries.length-1].state:null;},
      pushState(st,title,url){entries.push({state:st,url});},
      replaceState(st,title,url){
        if(entries.length)entries[entries.length-1]={state:st,url};
        else entries.push({state:st,url});
        sandbox.replacedUrl=url;
      },
    },
    shortPathCleared:false,
    clearShortSharePath(){sandbox.shortPathCleared=true;},
    showWorkouts(){},
    $(){
      const el={hidden:true,addEventListener(){},removeEventListener(){},
        querySelector(){return null;},querySelectorAll(){return [];},
        classList:{add(){},remove(){},toggle(){},contains(){return false;}},
        setAttribute(){},removeAttribute(){},click(){},focus(){},close(){},showModal(){}};
      return el;
    },
    window:{scrollTo(){}},
    replacedUrl:null,
  };
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'share.js'});
  return {sandbox,entries};
}

describe('openSharePreviewLoading — #265 cold open pushes a history entry',()=>{
  it('pushes {view:workout, sub:share} so Back fires popstate instead of exiting',()=>{
    const {sandbox,entries}=loadShareSandbox();
    sandbox.openSharePreviewLoading();
    assert.equal(entries.length,1);
    assert.equal(JSON.stringify(entries[0].state),JSON.stringify({view:'workout',sub:'share'}));
  });
  it('does not push twice if a share entry is already on top',()=>{
    const {sandbox,entries}=loadShareSandbox();
    sandbox.openSharePreviewLoading();
    sandbox.openSharePreviewLoading();
    assert.equal(entries.length,1);
  });
});

describe('openSharePreview — #265 one entry per preview',()=>{
  it('skips the push when the loading state already pushed (boot resolve)',()=>{
    const {sandbox,entries}=loadShareSandbox();
    sandbox.openSharePreviewLoading();
    sandbox.openSharePreview({kind:'template',name:'Shared'});
    assert.equal(entries.length,1);
    assert.ok(sandbox.state.sharePreview&&sandbox.state.sharePreview.kind==='template');
  });
  it('pushes when nothing was pushed yet (safety net)',()=>{
    const {sandbox,entries}=loadShareSandbox();
    sandbox.openSharePreview({kind:'template',name:'Shared'});
    assert.equal(entries.length,1);
    assert.equal(JSON.stringify(entries[0].state),JSON.stringify({view:'workout',sub:'share'}));
  });
  it('push:false skips the push (in-app hashchange already pushed)',()=>{
    const {sandbox,entries}=loadShareSandbox();
    sandbox.openSharePreview({kind:'template',name:'Shared'},{push:false});
    assert.equal(entries.length,0);
    assert.ok(sandbox.state.sharePreview);
  });
});

describe('backOutOfSharePreview — #265 Back clears the preview state',()=>{
  it('clears the preview and strips the share hash, returning true',()=>{
    const {sandbox}=loadShareSandbox();
    sandbox.location.hash='#share=abc123';
    sandbox.state.sharePreview={kind:'template',name:'Shared'};
    assert.equal(sandbox.backOutOfSharePreview(),true);
    assert.equal(sandbox.state.sharePreview,null);
    assert.equal(sandbox.replacedUrl,'/');
  });
  it('clears a loading preview too',()=>{
    const {sandbox}=loadShareSandbox();
    sandbox.location.hash='#share=abc123';
    sandbox.state.sharePreview={loading:true};
    assert.equal(sandbox.backOutOfSharePreview(),true);
    assert.equal(sandbox.state.sharePreview,null);
  });
  it('drops the short-link path as well',()=>{
    const {sandbox}=loadShareSandbox();
    sandbox.location.hash='';
    sandbox.state.sharePreview={kind:'template',name:'Shared'};
    sandbox.backOutOfSharePreview();
    assert.equal(sandbox.shortPathCleared,true);
  });
  it('leaves a non-share hash alone',()=>{
    const {sandbox}=loadShareSandbox();
    sandbox.location.hash='#dashboard';
    sandbox.state.sharePreview={kind:'template',name:'Shared'};
    sandbox.backOutOfSharePreview();
    assert.equal(sandbox.replacedUrl,null);
    assert.equal(sandbox.state.sharePreview,null);
  });
  it('returns false and does nothing when no preview is open',()=>{
    const {sandbox}=loadShareSandbox();
    sandbox.location.hash='#share=abc123';
    assert.equal(sandbox.backOutOfSharePreview(),false);
    assert.equal(sandbox.replacedUrl,null);
    assert.equal(sandbox.shortPathCleared,false);
  });
});

describe('popstate wiring — #265',()=>{
  it('the popstate listener calls backOutOfSharePreview before routing',()=>{
    const src=fs.readFileSync(path.join(__dirname,'..','assets/js/app-bootstrap.js'),'utf8');
    const at=src.indexOf("window.addEventListener('popstate'");
    assert.ok(at!==-1,'popstate listener found');
    const handler=src.slice(at,at+600);
    assert.ok(handler.indexOf('backOutOfSharePreview()')!==-1,'backOutOfSharePreview called');
    assert.ok(handler.indexOf('backOutOfSharePreview()')<handler.indexOf('location.hash'),
      'clears the preview before the destination routing reads the hash');
  });
});

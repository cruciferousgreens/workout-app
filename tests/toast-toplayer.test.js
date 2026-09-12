'use strict';
/* v1.021 (#226): the app-wide toast must be visible above open modal dialogs.
   Native <dialog> (showModal) paints in the top layer, above the fixed-
   position #appToast — "Share link copied." was invisible under the share
   modal. toastService now reparents the toast into the topmost open dialog
   while one is open (joining the top layer) and restores it to <body> after. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const catalog=require('./fixtures/catalog');

function makeFakeEl(){
  const el={
    children:[],parentNode:null,textContent:'',hidden:true,_classes:new Set(),
    classList:{
      add(c){el._classes.add(c);},remove(c){el._classes.delete(c);},
      contains(c){return el._classes.has(c);},toggle(){},
    },
    appendChild(child){
      if(child.parentNode&&child.parentNode!==el)child.parentNode.removeChild(child);
      else if(child.parentNode===el)el.children=el.children.filter(c=>c!==child);
      child.parentNode=el;el.children.push(child);return child;
    },
    removeChild(child){el.children=el.children.filter(c=>c!==child);child.parentNode=null;},
  };
  Object.defineProperty(el,'className',{
    get(){return [...el._classes].join(' ');},
    set(v){el._classes=new Set(String(v).split(/\s+/).filter(Boolean));},
  });
  return el;
}

const body=makeFakeEl();
const toast=makeFakeEl();
body.appendChild(toast);
const dialog=makeFakeEl();
dialog.open=false;
body.appendChild(dialog);

globalThis.document={
  getElementById:(id)=>id==='appToast'?toast:null,
  querySelectorAll:(sel)=>sel==='dialog[open]'?(dialog.open?[dialog]:[]):[],
  querySelector:(sel)=>(sel==='dialog[open]'&&dialog.open)?dialog:null,
  body,
};
/* Run rAF callbacks synchronously so the .show class lands deterministically.
   Assigned AFTER loadRole: the harness browser stubs install their own
   document/requestAnimationFrame first. */
const {toastService}=loadRole('utilities',{globals:{exercises:catalog}});
globalThis.document={
  getElementById:(id)=>id==='appToast'?toast:null,
  querySelectorAll:(sel)=>sel==='dialog[open]'?(dialog.open?[dialog]:[]):[],
  querySelector:(sel)=>(sel==='dialog[open]'&&dialog.open)?dialog:null,
  body,
};
globalThis.requestAnimationFrame=(cb)=>{cb();return 1;};

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

describe('toast top-layer behavior (#226)',()=>{
  it('with no dialog open the toast stays in <body>',()=>{
    dialog.open=false;
    toastService('hello',{durationMs:10});
    assert.strictEqual(toast.parentNode,body,'toast parent');
    assert.strictEqual(toast.textContent,'hello','toast text');
    assert.ok(toast.classList.contains('show'),'toast shown');
  });
  it('with a dialog open the toast moves into the dialog (top layer)',()=>{
    dialog.open=true;
    toastService('copied',{durationMs:10});
    assert.strictEqual(toast.parentNode,dialog,'toast reparented into open dialog');
    assert.ok(toast.classList.contains('show'),'toast shown');
  });
  it('after hiding with no dialog open the toast is restored to <body>',async()=>{
    dialog.open=true;
    toastService('temp',{durationMs:10});
    assert.strictEqual(toast.parentNode,dialog,'toast in dialog while open');
    await sleep(60); /* let the hide timer remove .show, then close the dialog */
    dialog.open=false;
    await sleep(400); /* fade timer (300ms) hides + restores */
    assert.strictEqual(toast.hidden,true,'toast hidden after duration');
    assert.strictEqual(toast.parentNode,body,'toast restored to body');
  });
});

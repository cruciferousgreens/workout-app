'use strict';
/* Minimal browser-global stubs for loading app sources in Node.
   Only what the pure logic needs: sources reference document/window/
   localStorage at load or call time but the tested functions never touch
   the real DOM. */
function makeStubs(){
  const store=new Map();
  const localStorage={
    getItem:(k)=>(store.has(String(k))?store.get(String(k)):null),
    setItem:(k,v)=>{store.set(String(k),String(v));},
    removeItem:(k)=>{store.delete(String(k));},
    clear:()=>{store.clear();},
    key:(i)=>[...store.keys()][i]??null,
    get length(){return store.size;},
  };
  /* Fake element: just enough for call-time DOM touches in pure helpers
     (escapeHtml builds a div, sets textContent, reads innerHTML). The
     innerHTML getter emulates browser text serialization (&, <, >). */
  const makeEl=()=>{
    let _text='';
    return {
      setAttribute(){}, getAttribute:()=>null, appendChild(){}, remove(){},
      addEventListener(){}, removeEventListener(){},
      classList:{add(){},remove(){},toggle(){},contains:()=>false},
      style:{}, dataset:{},
      set textContent(v){_text=String(v);},
      get textContent(){return _text;},
      get innerHTML(){
        return _text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      },
      set innerHTML(v){_text=String(v);},
    };
  };
  const documentStub={
    querySelector:()=>null, querySelectorAll:()=>[], getElementById:()=>null,
    getElementsByClassName:()=>[], getElementsByTagName:()=>[],
    createElement:()=>makeEl(), createElementNS:()=>makeEl(),
    createTextNode:(t)=>({textContent:String(t)}),
    addEventListener(){}, removeEventListener(){},
    body:makeEl(), head:makeEl(), documentElement:makeEl(),
    hidden:false, title:'',
  };
  const locationStub={href:'http://localhost/',search:'',pathname:'/',origin:'http://localhost',hash:''};
  const windowStub={
    addEventListener(){}, removeEventListener(){}, scrollTo(){},
    location:locationStub, navigator:{userAgent:'node-test-harness'},
    innerWidth:393, innerHeight:852, devicePixelRatio:1,
  };
  return {
    document:documentStub, window:windowStub, localStorage,
    requestAnimationFrame:()=>0, cancelAnimationFrame(){},
  };
}
module.exports={makeStubs};

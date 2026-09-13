'use strict';
/* Role: share-shortlinks — server short links (#177). Pins slug generation
   and validation, prod short-URL building, /s/<slug> path parsing, the
   Supabase insert path (collision retry, non-unique failure, throw, and
   signed-out short-circuit all fall back to the long link), /s/ resolution
   through the existing v2 decoder, the 404.html handoff helpers, and that
   404.html itself is never service-worker cached. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole,REPO_ROOT}=require('./harness');

const {
  SHARE_SLUG_ALPHABET,
  shareSlugFromBytes, isValidShareSlug, newShareSlug,
  buildShortShareUrl, tryShortShareLink,
  shortSlugFromPath, shortLinkAttemptFromPath, resolveShortShareLink, clearShortSharePath,
  restoreShortSharePath,
  spaBaseForPath, takeSpaRedirectSlug,
  shareEncodeV2,
}=loadRole('share-shortlinks');

const PROD_SHORT='https://app.cruciferousgreens.com/s/Ab3xYz12';

function resetGlobals(){
  delete globalThis.Sync;
  delete globalThis.lastAuthUid;
  delete globalThis.sessionStorage;
  delete globalThis.location;
  delete globalThis.history;
}
beforeEach(resetGlobals);

/* Fake Supabase client: handler(kind, table, arg) -> result or throws. */
function fakeClient(handler){
  const calls=[];
  return {
    calls,
    from(table){
      return {
        insert(row){calls.push({op:'insert',table,row});return handler('insert',table,row);},
        select(cols){return {eq(col,val){return {maybeSingle(){calls.push({op:'select',table,cols,col,val});return handler('select',table,{cols,col,val});}};}};},
      };
    },
  };
}
const okInsert=()=>Promise.resolve({data:[{slug:'x'}],error:null});

describe('slug generation',()=>{
  it('shareSlugFromBytes maps bytes into the a-zA-Z0-9 alphabet',()=>{
    assert.equal(shareSlugFromBytes(new Uint8Array([0,61,62,123,255])),'a9a9h');
    assert.equal(SHARE_SLUG_ALPHABET.length,62);
  });
  it('newShareSlug makes 8-char valid slugs',()=>{
    for(let i=0;i<20;i++){
      const s=newShareSlug();
      assert.ok(isValidShareSlug(s),`bad slug: ${s}`);
    }
  });
  it('isValidShareSlug rejects malformed slugs',()=>{
    for(const bad of ['','short','toolongslug99','with-dash1','under_score','sp ace12','Ab3xYz1!','s/Ab3xYz12',null,undefined,123]){
      assert.equal(isValidShareSlug(bad),false,`accepted: ${JSON.stringify(bad)}`);
    }
    assert.equal(isValidShareSlug('Ab3xYz12'),true);
    assert.equal(isValidShareSlug('00000000'),true);
  });
});

describe('short URL building',()=>{
  it('always uses the prod origin',()=>{
    assert.equal(buildShortShareUrl('Ab3xYz12'),PROD_SHORT);
  });
});

describe('path parsing',()=>{
  it('parses /s/<slug> on prod and QA subpaths',()=>{
    assert.equal(shortSlugFromPath('/s/Ab3xYz12'),'Ab3xYz12');
    assert.equal(shortSlugFromPath('/workout-app-accounts/s/Ab3xYz12'),'Ab3xYz12');
    assert.equal(shortSlugFromPath('/s/Ab3xYz12/'),'Ab3xYz12');
  });
  it('rejects non-short paths',()=>{
    for(const p of ['/','/settings','/s/short','/s/toolongslug99','/s/Ab3xYz12/extra','/share','',null,undefined]){
      assert.equal(shortSlugFromPath(p),null,`parsed: ${p}`);
    }
  });
  it('spaBaseForPath matches the 404.html inline copy',()=>{
    assert.equal(spaBaseForPath('/workout-app-accounts/s/Ab3xYz12'),'/workout-app-accounts/');
    assert.equal(spaBaseForPath('/s/Ab3xYz12'),'/');
    assert.equal(spaBaseForPath('/'),'/');
  });
});

describe('404.html handoff',()=>{
  function makeSessionStorage(){
    const m=new Map();
    return {
      getItem:k=>(m.has(String(k))?m.get(String(k)):null),
      setItem:(k,v)=>{m.set(String(k),String(v));},
      removeItem:k=>{m.delete(String(k));},
      _size:()=>m.size,
    };
  }
  it('takeSpaRedirectSlug consumes the key one-shot and parses slugs',()=>{
    globalThis.sessionStorage=makeSessionStorage();
    globalThis.sessionStorage.setItem('cg-spa-redirect','/workout-app-accounts/s/Ab3xYz12?x=1#y');
    assert.equal(takeSpaRedirectSlug(),'Ab3xYz12');
    assert.equal(globalThis.sessionStorage._size(),0,'key not consumed');
    assert.equal(takeSpaRedirectSlug(),null,'empty store');
  });
  it('takeSpaRedirectSlug ignores non-short stashed paths (key still consumed)',()=>{
    globalThis.sessionStorage=makeSessionStorage();
    globalThis.sessionStorage.setItem('cg-spa-redirect','/settings');
    assert.equal(takeSpaRedirectSlug(),null);
    assert.equal(globalThis.sessionStorage._size(),0,'key not consumed');
  });
  it('404.html exists, hands off via the shared key, and redirects to base',()=>{
    const html=fs.readFileSync(path.join(REPO_ROOT,'404.html'),'utf8');
    assert.ok(html.includes('cg-spa-redirect'),'no sessionStorage handoff key');
    assert.ok(html.includes('location.replace'),'no redirect');
    assert.ok(html.includes('/workout-app-accounts/'),'no QA subpath base');
    assert.ok(html.includes('/s/'),'no mention of the short-link path');
  });
  it('sw.js never caches 404.html',()=>{
    const sw=fs.readFileSync(path.join(REPO_ROOT,'sw.js'),'utf8');
    assert.ok(!sw.includes('404.html'),'404.html leaked into the SW cache list');
  });
});

describe('tryShortShareLink (minting)',()=>{
  const payload={v:2,kind:'template',name:'Push Day'};
  it('signed out: returns null without touching Supabase',async()=>{
    globalThis.lastAuthUid=null;
    const client=fakeClient(okInsert);
    globalThis.Sync={getSupabase:async()=>client};
    assert.equal(await tryShortShareLink(payload,'code123'),null);
    assert.equal(client.calls.length,0,'Supabase was touched while signed out');
  });
  it('no Supabase client: returns null',async()=>{
    globalThis.lastAuthUid='user-1';
    globalThis.Sync={getSupabase:async()=>null};
    assert.equal(await tryShortShareLink(payload,'code123'),null);
  });
  it('success: inserts {slug,kind,payload} and returns the prod short URL',async()=>{
    globalThis.lastAuthUid='user-1';
    const client=fakeClient(okInsert);
    globalThis.Sync={getSupabase:async()=>client};
    const url=await tryShortShareLink(payload,'code123');
    assert.ok(url&&url.startsWith('https://app.cruciferousgreens.com/s/'),`bad url: ${url}`);
    assert.equal(client.calls.length,1);
    const row=client.calls[0].row;
    assert.equal(client.calls[0].table,'share_links');
    assert.ok(isValidShareSlug(row.slug),`bad slug in row: ${row.slug}`);
    assert.equal(row.kind,'workout');
    assert.equal(row.payload,'code123');
  });
  it('program payloads insert kind=program',async()=>{
    globalThis.lastAuthUid='user-1';
    const client=fakeClient(okInsert);
    globalThis.Sync={getSupabase:async()=>client};
    await tryShortShareLink({...payload,kind:'program'},'code999');
    assert.equal(client.calls[0].row.kind,'program');
  });
  it('unique-violation retries with a fresh slug, up to 5 attempts',async()=>{
    globalThis.lastAuthUid='user-1';
    const client=fakeClient(()=>Promise.resolve({data:null,error:{code:'23505',message:'duplicate'}}));
    globalThis.Sync={getSupabase:async()=>client};
    assert.equal(await tryShortShareLink(payload,'code123'),null);
    assert.equal(client.calls.length,5,'expected exactly 5 attempts');
    const slugs=new Set(client.calls.map(c=>c.row.slug));
    assert.equal(slugs.size,5,'retries reused a slug');
  });
  it('non-unique insert error stops after one attempt',async()=>{
    globalThis.lastAuthUid='user-1';
    const client=fakeClient(()=>Promise.resolve({data:null,error:{code:'42501',message:'denied'}}));
    globalThis.Sync={getSupabase:async()=>client};
    assert.equal(await tryShortShareLink(payload,'code123'),null);
    assert.equal(client.calls.length,1);
  });
  it('insert throw returns null (never throws)',async()=>{
    globalThis.lastAuthUid='user-1';
    const client=fakeClient(()=>{throw new Error('network down');});
    globalThis.Sync={getSupabase:async()=>client};
    assert.equal(await tryShortShareLink(payload,'code123'),null);
  });
  it('missing code returns null',async()=>{
    globalThis.lastAuthUid='user-1';
    globalThis.Sync={getSupabase:async()=>{throw new Error('should not be called');}};
    assert.equal(await tryShortShareLink(payload,''),null);
    assert.equal(await tryShortShareLink(payload,null),null);
  });
});

describe('resolveShortShareLink (opening)',()=>{
  const goodPayload={v:2,kind:'template',name:'Push Day',template:{name:'Push Day',exercises:[]},customExercises:[]};
  async function v2code(){return shareEncodeV2(goodPayload);}
  function selectClient(result){
    return fakeClient((op)=>op==='select'?Promise.resolve(result):Promise.resolve({}));
  }
  it('decodes a stored v2 payload through the existing decoder',async()=>{
    const code=await v2code();
    globalThis.Sync={getSupabase:async()=>selectClient({data:{payload:code},error:null})};
    const out=await resolveShortShareLink('Ab3xYz12');
    assert.ok(out,'null payload');
    assert.equal(out.kind,'template');
    assert.equal(out.name,'Push Day');
  });
  it('unknown slug returns null',async()=>{
    globalThis.Sync={getSupabase:async()=>selectClient({data:null,error:null})};
    assert.equal(await resolveShortShareLink('Ab3xYz12'),null);
  });
  it('query error returns null',async()=>{
    globalThis.Sync={getSupabase:async()=>selectClient({data:null,error:{code:'42P01',message:'no table'}})};
    assert.equal(await resolveShortShareLink('Ab3xYz12'),null);
  });
  it('corrupt stored payload returns null',async()=>{
    globalThis.Sync={getSupabase:async()=>selectClient({data:{payload:'!!!not-a-link!!!'},error:null})};
    assert.equal(await resolveShortShareLink('Ab3xYz12'),null);
  });
  it('no Supabase client returns null',async()=>{
    globalThis.Sync={getSupabase:async()=>null};
    assert.equal(await resolveShortShareLink('Ab3xYz12'),null);
  });
  it('malformed slug never hits the network',async()=>{
    const client=selectClient({data:null,error:null});
    globalThis.Sync={getSupabase:async()=>client};
    assert.equal(await resolveShortShareLink('bogus'),null);
    assert.equal(client.calls.length,0);
  });
});

describe('clearShortSharePath',()=>{
  it('strips the /s/<slug> suffix, keeping the app base and query',()=>{
    globalThis.location={pathname:'/workout-app-accounts/s/Ab3xYz12',search:'?a=b',hash:''};
    let replaced=null;
    globalThis.history={replaceState:(s,t,u)=>{replaced=u;}};
    clearShortSharePath();
    assert.equal(replaced,'/workout-app-accounts/?a=b');
  });
  it('prod root collapses to /',()=>{
    globalThis.location={pathname:'/s/Ab3xYz12',search:'',hash:''};
    let replaced=null;
    globalThis.history={replaceState:(s,t,u)=>{replaced=u;}};
    clearShortSharePath();
    assert.equal(replaced,'/');
  });
  it('non-short paths are untouched',()=>{
    globalThis.location={pathname:'/settings',search:'',hash:''};
    let replaced='untouched';
    globalThis.history={replaceState:(s,t,u)=>{replaced=u;}};
    clearShortSharePath();
    assert.equal(replaced,'untouched');
  });
});

describe('shortLinkAttemptFromPath (#177 follow-up: bad slugs still count as attempts)',()=>{
  it('detects malformed /s/ segments, not just valid 8-char slugs',()=>{
    assert.equal(shortLinkAttemptFromPath('/s/doesnotexist1'),'doesnotexist1');
    assert.equal(shortLinkAttemptFromPath('/s/abc12345'),'abc12345');
    assert.equal(shortLinkAttemptFromPath('/workout-app-accounts/s/abc12345'),'abc12345');
  });
  it('ignores paths that are not short-link routes',()=>{
    assert.equal(shortLinkAttemptFromPath('/'),null);
    assert.equal(shortLinkAttemptFromPath('/workout'),null);
    assert.equal(shortLinkAttemptFromPath('/s/'),null);
    assert.equal(shortLinkAttemptFromPath(''),null);
  });
  it('a bad slug is an attempt but not a valid slug, so it takes the invalid-link path',()=>{
    const attempt=shortLinkAttemptFromPath('/s/doesnotexist1');
    assert.ok(attempt,'attempt detected');
    assert.equal(shortSlugFromPath('/s/doesnotexist1'),null,'not a parseable slug');
    assert.equal(isValidShareSlug(attempt),false,'fails slug validation');
  });
});

describe('restoreShortSharePath (#303: keep the /s/<slug> deep link)',()=>{
  it('restores /s/<slug> from the app root via replaceState (no navigation)',()=>{
    globalThis.location={pathname:'/',search:'',hash:''};
    let replaced=null,replacedState='unset';
    globalThis.history={state:{view:'workout',sub:'share'},
      replaceState:(s,t,u)=>{replacedState=s;replaced=u;}};
    restoreShortSharePath('Ab3xYz12');
    assert.equal(replaced,'/s/Ab3xYz12');
    assert.deepEqual(replacedState,{view:'workout',sub:'share'},'history state preserved');
  });
  it('restores under the project base on Pages',()=>{
    globalThis.location={pathname:'/workout-app-accounts/',search:'',hash:''};
    let replaced=null;
    globalThis.history={state:null,replaceState:(s,t,u)=>{replaced=u;}};
    restoreShortSharePath('Ab3xYz12');
    assert.equal(replaced,'/workout-app-accounts/s/Ab3xYz12');
  });
  it('no-op when the path already carries the slug (direct serve)',()=>{
    globalThis.location={pathname:'/s/Ab3xYz12',search:'',hash:''};
    let replaced='untouched';
    globalThis.history={state:null,replaceState:(s,t,u)=>{replaced=u;}};
    restoreShortSharePath('Ab3xYz12');
    assert.equal(replaced,'untouched');
  });
  it('keeps the query string',()=>{
    globalThis.location={pathname:'/',search:'?x=1',hash:''};
    let replaced=null;
    globalThis.history={state:null,replaceState:(s,t,u)=>{replaced=u;}};
    restoreShortSharePath('Ab3xYz12');
    assert.equal(replaced,'/s/Ab3xYz12?x=1');
  });
});

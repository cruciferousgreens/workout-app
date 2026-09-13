/* ===== module: sync-engine.js ===== */
    /** Sync engine: dirty-tracking, push/pull, merge, tombstones (split from sync.js, #99 B15).
     *
     *  Conflict policy (#99 A2/A3 — supersedes the 2026-09-10 "local wins"
     *  union):
     *  - MEMBERSHIP merges by id: items either side lacks are kept. Neither
     *    device's entries are silently lost.
     *  - CONTENT merges per item by per-item revision. The engine stamps
     *    `updatedAt` (ms) on exactly the items whose JSON changed since the
     *    last snapshot (see stampChangedItems), so both devices can compare
     *    genuine per-item revisions. Rule: both stamped → newer wins; exactly
     *    one stamped → the stamped side wins (a stamp is provably newer than
     *    any unstamped, pre-stamp-era edit); neither stamped → deterministic
     *    tiebreak (lexicographically smaller JSON) so all devices converge.
     *    Whole-key timestamps are deliberately NOT used as a per-item proxy:
     *    a key bump from an unrelated item would masquerade as an edit and
     *    resurrect deletes / destroy newer edits.
     *  - DELETES are per-item tombstones: `{deletedAt: <ms timestamp>}` — the
     *    exact shape the custom-exercise soft-delete already uses. A tombstone
     *    beats a live item unless the live item carries a per-item updatedAt
     *    strictly newer than the delete (true last-write-wins); ties and
     *    unknown revisions lose to the delete, deterministically. Tombstones
     *    propagate through union and push and are retained until every side
     *    has seen them; the visible set never contains them.
     *  - Tombstone storage: `completed`, `templates`, `archivedPrograms` keep
     *    tombstones in a sync-owned registry (`syncMeta.tombstones`, persisted
     *    in workout-sync:v1) so the live arrays — read directly by dozens of
     *    feature call sites — never hold tombstone records. The registry is
     *    injected into the push payload as `{id, deletedAt}` stubs and split
     *    back out on pull. `customExercises` keeps its in-array `deletedAt`
     *    records (sibling phase, A8); the merge treats both uniformly.
     *    String lists (tags, exerciseTagPresets, favorites) have no delete
     *    semantics — plain union, documented.
     *  - Scalar keys (activeProgram, progressionSetup, periods, appearance)
     *    stay whole-key last-write-wins by updated_at, with the empty-state
     *    guards (empty never clobbers real data).
     *  - The merge toast reports what actually happened (added / updated to
     *    the newer version / removed as deleted elsewhere) — never "nothing
     *    was lost".
     *
     *  Everything below runs inside one IIFE and talks to the other sync
     *  pieces through the single `Sync` namespace. Global shims at the bottom
     *  keep pre-existing call sites working (markSyncDirty, wipeRemoteData,
     *  noteTombstone, tombstoneAllForSync, pushDeleteAllRemote, isTombstoned,
     *  liveItems).
     */
     /* Module map (v1.006) — Key: scheduleSyncPush(), mergeCollectionKey()/mergeStamp(), stampChangedItems(), noteTombstone()/liveItems(), pushDeleteAllRemote(). Depends on: sync-adapter (Supabase client), persistence SYNCABLE_KEYS, state shapes. */
    var Sync = window.Sync = window.Sync || {};
    (function(){
      'use strict';
      const SYNC_META_KEY='workout-sync:v1';
      const SYNC_PUSH_DEBOUNCE_MS=2500;

      let syncMeta=null; /* {keys:{<key>:{updatedAt,snapshot,dirty,pushedAt}},tombstones:{<key>:{<id>:<deletedAt ms>}},lastSyncAt,everSynced} */
      let syncPushTimer=null;
      let syncBusy=false;

      function ensureSyncMeta(){
        if(syncMeta)return syncMeta;
        let parsed=null;
        try{const raw=localStorage.getItem(SYNC_META_KEY);if(raw)parsed=JSON.parse(raw);}catch(_){}
        syncMeta=(parsed&&typeof parsed==='object')?parsed:{};
        if(!syncMeta.keys||typeof syncMeta.keys!=='object')syncMeta.keys={};
        if(!syncMeta.tombstones||typeof syncMeta.tombstones!=='object')syncMeta.tombstones={};
        return syncMeta;
      }
      /** Drop the in-memory sync metadata (delete-account path: the persisted
          row was already removed, and wipeRemoteData rebuilds from scratch). */
      function resetSyncMeta(){syncMeta=null;}
      function saveSyncMeta(){try{localStorage.setItem(SYNC_META_KEY,JSON.stringify(syncMeta));}catch(_){}}
      function getSyncMeta(){return ensureSyncMeta();}
      function snapshotOf(key){
        try{const s=JSON.stringify(getSyncableValue(key));return typeof s==='string'?s:'null';}
        catch(_){return 'null';}
      }
      /** "Empty" for the adoption guards: never adopt an empty remote over real
          local data, and never push empty local state over real remote data. */
      function isEmptySyncValue(key,value){
        if(value==null)return true;
        if(Array.isArray(value)){
          if(key==='templates')return !value.some(t=>t&&!t.builtIn);
          return value.length===0;
        }
        if(typeof value==='object')return Object.keys(value).length===0;
        return false;
      }
      /* ===== per-item revisions (A2) ===== */
      /** Keys whose items carry per-item `updatedAt` revisions for the content
          merge. String lists need none (string identity is content); scalar
          keys stay whole-key LWW. */
      const REVISIONED_KEYS=new Set(['completed','templates','archivedPrograms','customExercises']);
      /** Stamp `updatedAt=nowMs` on exactly the items whose JSON differs from
          the last snapshot (new, edited, or tombstoned). Unchanged items keep
          their stamps, so a key-level bump caused by an unrelated item never
          masquerades as an edit of this item. Returns true when anything was
          stamped (caller must re-snapshot). */
      function stampChangedItems(key,nowMs){
        const m=syncMeta.keys[key];
        let oldArr=null;
        try{const p=JSON.parse((m&&m.snapshot)||'null');if(Array.isArray(p))oldArr=p;}catch(_){}
        if(!oldArr)return false;
        const oldJson=new Map();
        for(const it of oldArr){
          if(it&&typeof it==='object'&&it.id!=null&&!oldJson.has(String(it.id)))oldJson.set(String(it.id),JSON.stringify(it));
        }
        const arr=getSyncableValue(key);
        if(!Array.isArray(arr))return false;
        let stamped=false;
        for(const it of arr){
          if(!it||typeof it!=='object'||it.id==null)continue;
          if(oldJson.get(String(it.id))!==JSON.stringify(it)){it.updatedAt=nowMs;stamped=true;}
        }
        return stamped;
      }
      /** Numeric per-item revision (ms), or null when the item was never
          stamped (pre-stamp-era data). */
      function itemRevisionMs(item){
        if(!item||typeof item!=='object')return null;
        const u=item.updatedAt;
        if(typeof u==='number'&&isFinite(u))return u;
        if(typeof u==='string'){const t=Date.parse(u);return isNaN(t)?null:t;}
        return null;
      }
      /* ===== tombstones (A3) ===== */
      /** Keys whose tombstones live in the sync registry (syncMeta.tombstones)
          rather than in the array, so live arrays stay clean for every reader.
          customExercises is intentionally NOT here: it keeps in-array
          `deletedAt` records (sibling phase, A8) and the merge normalizes both
          representations. */
      const REGISTRY_KEYS=new Set(['completed','templates','archivedPrograms']);
      /** Tombstone test — the exact shape the custom-exercise soft-delete
          uses: a `deletedAt` millisecond timestamp on the record. */
      function isTombstoned(item){return !!(item&&typeof item==='object'&&item.deletedAt);}
      /** Visible set: the array minus tombstone records. */
      function liveItems(arr){return (Array.isArray(arr)?arr:[]).filter(item=>!isTombstoned(item));}
      /* #292: ids are never re-minted, so the registry only grows. Prune
         tombstones older than 90 days — a device that hasn't synced in 90
         days is treated as gone, and a dropped tombstone can never collide
         with a new item. */
      const TOMBSTONE_MAX_AGE_MS=90*24*60*60*1000;
      function pruneOldTombstones(){
        ensureSyncMeta();
        const cutoff=Date.now()-TOMBSTONE_MAX_AGE_MS;
        let changed=false;
        for(const key of Object.keys(syncMeta.tombstones||{})){
          const raw=syncMeta.tombstones[key]||{};
          for(const id of Object.keys(raw)){
            if(!(Number(raw[id])>cutoff)){delete raw[id];changed=true;}
          }
          if(!Object.keys(raw).length)delete syncMeta.tombstones[key];
        }
        if(changed)saveSyncMeta();
      }
      function getTombstoneMap(key){
        ensureSyncMeta();
        pruneOldTombstones();
        const raw=(syncMeta.tombstones&&syncMeta.tombstones[key])||{};
        const map=new Map();
        for(const id of Object.keys(raw)){const ts=Number(raw[id]);if(ts>0)map.set(id,ts);}
        return map;
      }
      function setTombstoneMap(key,map){
        ensureSyncMeta();
        const obj={};
        for(const [id,ts] of map)if(ts>0)obj[id]=ts;
        /* No-op when unchanged — pullRemote persists the merged set on every
           merge, and most merges learn nothing new. */
        const cur=(syncMeta.tombstones&&syncMeta.tombstones[key])||{};
        const curKeys=Object.keys(cur);
        let same=curKeys.length===map.size;
        if(same)for(const [id,ts] of map)if(Number(cur[id])!==ts){same=false;break;}
        if(same)return;
        if(map.size)syncMeta.tombstones[key]=obj;else delete syncMeta.tombstones[key];
        saveSyncMeta();
      }
      /** Drop every tombstone (adopt-on-login path: the cloud is authoritative
          for that account, so local delete-memory must not survive). */
      function clearTombstoneRegistry(){
        ensureSyncMeta();
        syncMeta.tombstones={};
        saveSyncMeta();
      }
      /** Record a delete for propagation. The caller removes the item from the
          live array first; the tombstone rides the next push as an
          `{id, deletedAt}` stub. Entries older than 90 days are pruned (#292);
          ids are never re-minted, so a tombstone can only ever match the
          item it was made for. */
      function noteTombstone(key,id){
        if(id==null||!REGISTRY_KEYS.has(key))return;
        const map=getTombstoneMap(key), sid=String(id), now=Date.now();
        map.set(sid,Math.max(map.get(sid)||0,now));
        setTombstoneMap(key,map);
      }
      /** "Delete all data": tombstone every item in the registry keys BEFORE
          the local wipe empties the arrays, so the wipe propagates to the
          cloud and an offline device pulls tombstones instead of resurrecting
          the data. */
      function tombstoneAllForSync(){
        ensureSyncMeta();
        const now=Date.now();
        for(const key of REGISTRY_KEYS){
          const arr=getSyncableValue(key);
          if(!Array.isArray(arr))continue;
          const map=getTombstoneMap(key);
          for(const item of arr)if(item&&item.id!=null)map.set(String(item.id),now);
          setTombstoneMap(key,map);
        }
      }
      /** Inject registry tombstones into the push payload as stubs. The row
          value is live items + `{id, deletedAt}` records; pull splits them
          back out, so live arrays never hold them. */
      function injectTombstones(key,value){
        if(!REGISTRY_KEYS.has(key)||!Array.isArray(value))return value;
        const tombs=getTombstoneMap(key);
        if(!tombs.size)return value;
        const ids=new Set();
        for(const it of value)ids.add(it&&it.id!=null?String(it.id):null);
        const stubs=[];
        for(const [id,ts] of tombs)if(!ids.has(id))stubs.push({id:id,deletedAt:ts});
        return stubs.length?value.concat(stubs):value;
      }
      /** Fold remote stub records into the local registry (pull/adopt path). */
      function adoptRemoteTombstones(key,arr){
        const map=getTombstoneMap(key);
        let changed=false;
        for(const item of (Array.isArray(arr)?arr:[])){
          if(isTombstoned(item)&&item.id!=null){
            const id=String(item.id), ts=Number(item.deletedAt)||0;
            if(ts>(map.get(id)||0)){map.set(id,ts);changed=true;}
          }
        }
        if(changed)setTombstoneMap(key,map);
      }
      /* ===== dirty tracking ===== */
      /** Called from persistNow(): mark keys whose value changed since the last
          snapshot as dirty and schedule a debounced background push. Runs even
          signed out / offline — the push itself no-ops until a session exists. */
      function markSyncDirty(){
        ensureSyncMeta();
        const now=new Date().toISOString(), nowMs=Date.now();
        let any=false;
        for(const key of SYNCABLE_KEYS){
          let snap=snapshotOf(key);
          const m=syncMeta.keys[key];
          if(!m){
            /* Fresh key (new device / wiped storage): an empty value was never
               possessed, so it is NOT a delete — record it clean so pullRemote
               adopts a remote row and pushDirtyKeys never DELETEs data this
               device never had. Only a non-empty value is genuinely new. */
            const empty=isEmptySyncValue(key,getSyncableValue(key));
            syncMeta.keys[key]={updatedAt:now,snapshot:snap,dirty:!empty};
            if(!empty)any=true;
            continue;
          }
          if(m.snapshot!==snap){
            /* A2: stamp exactly the changed items before re-snapshotting, so
               the merge compares genuine per-item revisions. */
            if(REVISIONED_KEYS.has(key)&&stampChangedItems(key,nowMs))snap=snapshotOf(key);
            /* Preserve pushedAt across re-marks: the self-heal's "was this ever
               confirmed in the cloud" check depends on it surviving. */
            syncMeta.keys[key]={updatedAt:now,snapshot:snap,dirty:true,pushedAt:m.pushedAt};
            any=true;
          }
        }
        if(any){saveSyncMeta();scheduleSyncPush();}
      }
      /** Did this device ever hold a real (non-empty) value for key? Used to
          tell a genuine local delete apart from a never-possessed key, so a
          fresh device can never DELETE another device's row. */
      function syncKeyWasPossessed(key){
        const m=syncMeta.keys[key]||{};
        if(m.pushedAt)return true;
        try{return !isEmptySyncValue(key,JSON.parse(m.snapshot||'null'));}
        catch(_){return false;}
      }
      function scheduleSyncPush(){
        clearTimeout(syncPushTimer);
        syncPushTimer=setTimeout(()=>{syncCycle().catch(()=>{});},SYNC_PUSH_DEBOUNCE_MS);
      }
      /* ===== push / pull ===== */
      /** Push every dirty key. Returns true when there was nothing to do or the
          push succeeded; false when offline, signed out, or failed. */
      async function pushDirtyKeys(){
        ensureSyncMeta();
        const sb=await Sync.getSupabase();
        if(!sb||!navigator.onLine)return false;
        const user=await Sync.signedInUser();
        if(!user)return false;
        const dirty=SYNCABLE_KEYS.filter(key=>syncMeta.keys[key]&&syncMeta.keys[key].dirty);
        if(!dirty.length)return true;
        for(const key of dirty){
          /* A3: registry tombstones ride along as stub records. */
          const value=injectTombstones(key,getSyncableValue(key));
          /* Never upsert a null value: if a key's accessor isn't ready (e.g. a
             mixed old/new asset load during a service-worker update), skip it —
             it stays dirty and retries on a later cycle once assets converge. */
          if(value===undefined)continue;
          if(value===null){
            /* Null local state (e.g. no active program): delete the remote row
               so a stale value can't resurrect on another device — BUT only if
               this device previously possessed a value for the key. A device
               that never had the key must never DELETE another device's row
               (fresh-device race). The column is NOT NULL, so upserting null
               would abort the whole push. Needs the DELETE RLS policy (same as
               the delete-all wipe). */
            if(!syncKeyWasPossessed(key)){syncMeta.keys[key].dirty=false;continue;}
            const {error:delError}=await sb.from('user_data').delete().eq('user_id',user.id).eq('key',key);
            if(delError){Sync.showSyncError(delError);return false;}
            syncMeta.keys[key].dirty=false;
            continue;
          }
          const row={user_id:user.id,key:key,value:value,updated_at:syncMeta.keys[key].updatedAt};
          const {error}=await sb.from('user_data').upsert(row,{onConflict:'user_id,key'});
          if(error){Sync.showSyncError(error);return false;}
          syncMeta.keys[key].dirty=false;
          /* Confirmed in the cloud. pullRemote uses this to self-heal: a key
             with non-empty local state, no remote row, and no confirmed push
             gets re-uploaded even if its dirty flag was lost. */
          syncMeta.keys[key].pushedAt=new Date().toISOString();
        }
        syncMeta.lastSyncAt=new Date().toISOString();
        saveSyncMeta();Sync.renderAccount();
        return true;
      }
      /** Apply one remote row to local state and record its timestamp/snapshot.
          Registry keys split stub records back out of the payload; when this
          device holds tombstones the remote lacks, the key stays dirty so the
          tombstones propagate on push. Returns true when the key ended dirty. */
      function applyRemoteKey(key,remote){
        let dirty=false;
        if(REGISTRY_KEYS.has(key)&&Array.isArray(remote.value)){
          adoptRemoteTombstones(key,remote.value);
          if(getTombstoneMap(key).size){
            /* A3: local delete-memory exists (e.g. an offline delete-all whose
               tombstones never pushed): merge instead of wholesale-adopting, so
               the deletes survive the adopt and propagate. */
            const res=mergeCollectionKey(key,getSyncableValue(key),remote.value);
            setTombstoneMap(key,res.tombstones);
            setSyncableValue(key,res.array);
            dirty=res.dirty;
          }else{
            setSyncableValue(key,remote.value.filter(item=>!isTombstoned(item)));
          }
        }else{
          setSyncableValue(key,remote.value);
        }
        /* Adopting a remote row confirms the cloud holds this value — record it
           so a later deliberate delete on another device isn't resurrected. */
        syncMeta.keys[key]={updatedAt:remote.updated_at,snapshot:snapshotOf(key),dirty:dirty,pushedAt:remote.updated_at};
        return dirty;
      }
      /* ===== union merge for collection keys (user's call 2026-09-10; A2/A3 rework) ===== */
      /** Keys whose values are collections: membership unions by id, per-item
          content follows per-item last-write-wins, deletes follow tombstones. */
      const MERGE_KEYS=new Set(['completed','templates','tags','exerciseTagPresets','archivedPrograms','customExercises','favorites']);
      /** Identity stamp for union dedupe: object id for id-bearing items,
          case-insensitive string for tag lists (matches mergeTagLists), exact
          string for id lists like favorites. Id-less objects fall back to their
          JSON so identical content dedupes. */
      function mergeStamp(key,item){
        if(item&&typeof item==='object'){
          if(item.id!=null)return 'id:'+String(item.id);
          return 'json:'+JSON.stringify(item);
        }
        const s=String(item);
        return (key==='tags'||key==='exerciseTagPresets')?'str:'+s.toLowerCase():'str:'+s;
      }
      /** Per-item content resolution for one id held by both sides (A2).
          Returns {item, byRemote}. */
      function resolveLiveConflict(localItem,remoteItem){
        if(localItem===remoteItem)return {item:localItem,byRemote:false};
        const lj=JSON.stringify(localItem), rj=JSON.stringify(remoteItem);
        if(lj===rj)return {item:localItem,byRemote:false};
        if(!localItem||!remoteItem||typeof localItem!=='object'||typeof remoteItem!=='object')
          return {item:localItem,byRemote:false}; /* string lists: stable, keep local */
        const lRev=itemRevisionMs(localItem), rRev=itemRevisionMs(remoteItem);
        if(lRev!=null&&rRev!=null){
          if(rRev>lRev)return {item:remoteItem,byRemote:true};
          if(lRev>rRev)return {item:localItem,byRemote:false};
        }else if(lRev!=null){
          /* A stamped edit is provably newer than any unstamped,
             pre-stamp-era edit. */
          return {item:localItem,byRemote:false};
        }else if(rRev!=null){
          return {item:remoteItem,byRemote:true};
        }
        /* Neither side ever stamped: a pre-stamp-era relic. Deterministic
           tiebreak (lexicographically smaller JSON) so every device converges
           on the same copy. */
        return lj<rj?{item:localItem,byRemote:false}:{item:remoteItem,byRemote:true};
      }
      /** Merge one collection key.
          Returns {array, tombstones, stats, dirty} where `array` is what the
          key should hold, `tombstones` the merged tombstone map (registry
          keys), `stats` {added, updated, removed} for the toast, and `dirty`
          whether the merge changed anything needing a push. */
      function mergeCollectionKey(key,localArr,remoteArr){
        const stats={added:0,updated:0,removed:0};
        const useRegistry=REGISTRY_KEYS.has(key);
        const localList=Array.isArray(localArr)?localArr:[];
        const remoteList=Array.isArray(remoteArr)?remoteArr:[];
        /* Normalize: split live items from tombstone records on both sides
           (in-array deletedAt records for customExercises; defensive for
           registry keys, whose live arrays should already be clean). */
        const localTombs=new Map(), localRecs=new Map(), localLive=[];
        const remoteTombs=new Map(), remoteRecs=new Map(), remoteLive=[];
        const split=(list,tombs,recs,live)=>{
          for(const item of list){
            if(isTombstoned(item)&&item.id!=null){
              const id=String(item.id), ts=Number(item.deletedAt)||0;
              if(ts>(tombs.get(id)||0)){tombs.set(id,ts);recs.set(id,item);}
            }else live.push(item);
          }
        };
        split(localList,localTombs,localRecs,localLive);
        split(remoteList,remoteTombs,remoteRecs,remoteLive);
        /* Tombstone union: newer deletedAt wins per id. */
        const mergedTombs=new Map(useRegistry?getTombstoneMap(key):[]);
        const mergedRecs=new Map();
        const take=(tombs,recs)=>{
          for(const [id,ts] of tombs){
            if(ts>(mergedTombs.get(id)||0)){mergedTombs.set(id,ts);mergedRecs.set(id,recs.get(id));}
            else if(!mergedRecs.has(id)&&recs.has(id))mergedRecs.set(id,recs.get(id));
          }
        };
        take(localTombs,localRecs);take(remoteTombs,remoteRecs);
        /* Resolve live items against tombstones (A3): a tombstone beats a live
           item unless the live item carries a per-item updatedAt strictly
           newer than the delete. The newer edit then drops the tombstone
           (true last-write-wins); otherwise the delete stands. */
        const tombIds=new Set(mergedTombs.keys());
        const survives=(item,side)=>{
          const id=item&&item.id!=null?String(item.id):null;
          if(id==null||!tombIds.has(id))return true;
          const liveRev=itemRevisionMs(item), tombTs=mergedTombs.get(id)||0;
          if(liveRev!=null&&liveRev>tombTs){
            mergedTombs.delete(id);mergedRecs.delete(id);tombIds.delete(id);
            return true;
          }
          if(side==='local')stats.removed++;
          return false;
        };
        const lLive=localLive.filter(it=>survives(it,'local'));
        const rLive=remoteLive.filter(it=>survives(it,'remote'));
        /* Membership union + per-item content LWW (A2). Local order is kept;
           remote-only items append. Never array order for conflicts. */
        const byStamp=new Map(), order=[];
        let remoteNeedsUpdate=false;
        for(const it of lLive){const s=mergeStamp(key,it);if(!byStamp.has(s)){byStamp.set(s,it);order.push(s);}}
        for(const it of rLive){
          const s=mergeStamp(key,it);
          if(!byStamp.has(s)){byStamp.set(s,it);order.push(s);stats.added++;}
          else{
            const cur=byStamp.get(s), w=resolveLiveConflict(cur,it);
            if(w.item!==cur){
              byStamp.set(s,w.item);
              if(w.byRemote)stats.updated++;
              /* The merge picked the local copy over a differing remote one:
                 the remote still holds the older copy, so it must learn this
                 version on push — otherwise the two sides never converge. */
              else remoteNeedsUpdate=true;
            }
          }
        }
        const mergedLive=order.map(s=>byStamp.get(s));
        /* Rebuild what the key holds: registry keys keep tombstones out of the
           array; customExercises re-attaches its in-array tombstone records. */
        let array;
        if(useRegistry)array=mergedLive;
        else if(key==='customExercises'){
          const recs=[];
          for(const id of tombIds){const r=mergedRecs.get(id);if(r)recs.push(r);}
          array=mergedLive.concat(recs);
        }else array=mergedLive;
        const before=JSON.stringify(useRegistry?localLive:localList);
        /* Push when the merged tombstone set differs from what the remote sent
           (local tombstones the remote lacks, or a tombstone the merge
           dropped via a newer edit) — otherwise a learned tombstone would
           never propagate. */
        let regDiffers=false;
        if(useRegistry){
          if(mergedTombs.size!==remoteTombs.size)regDiffers=true;
          else for(const [id,ts] of mergedTombs)if(remoteTombs.get(id)!==ts){regDiffers=true;break;}
        }
        return {array:array,tombstones:mergedTombs,stats:stats,dirty:before!==JSON.stringify(array)||regDiffers||remoteNeedsUpdate};
      }
      /** Truthful merge toast (A2): report what the merge actually did. */
      function mergeToastText(r){
        const parts=[];
        if(r.added)parts.push(r.added+' new item'+(r.added===1?'':'s')+' from your other device');
        if(r.updated)parts.push(r.updated+' updated to the newer version'+(r.updated===1?'':'s'));
        if(r.removed)parts.push(r.removed+' removed (deleted on another device)');
        return 'Synced with cloud: '+parts.join('; ')+'.';
      }
      /** Pull all remote rows; adopt newer ones (last-write-wins per key, with
          empty-guards so real data is never clobbered by empty state). First
          sign-in with zero remote rows uploads every non-empty local key
          (migration). Returns true on success. */
      async function pullRemote(){
        ensureSyncMeta();
        const sb=await Sync.getSupabase();
        if(!sb||!navigator.onLine)return false;
        const user=await Sync.signedInUser();
        if(!user)return false;
        const {data:rows,error}=await sb.from('user_data').select('key,value,updated_at').eq('user_id',user.id);
        if(error){Sync.showSyncError(error);return false;}
        const byKey={};
        (rows||[]).forEach(r=>{if(r&&typeof r.key==='string')byKey[r.key]=r;});
        /* First-sync baseline: last-write-wins needs a local timestamp. Seed it
           from the payload's savedAt so long-standing local data beats an older
           remote write instead of losing to it. */
        let baseline=null;
        if(!syncMeta.everSynced){
          try{
            const raw=localStorage.getItem(PERSIST_KEY);
            const d=raw?JSON.parse(raw):null;
            if(d&&d.savedAt)baseline=new Date(d.savedAt).toISOString();
          }catch(_){}
        }
        let changed=false,customChanged=false;
        const report={added:0,updated:0,removed:0};
        for(const key of SYNCABLE_KEYS){
          let m=syncMeta.keys[key];
          const isNew=!m;
          if(!m)m=syncMeta.keys[key]={updatedAt:baseline||new Date(0).toISOString(),snapshot:snapshotOf(key),dirty:false};
          const remote=byKey[key];
          const localVal=getSyncableValue(key);
          const localEmpty=isEmptySyncValue(key,localVal);
          if(!remote){
            /* No remote row: upload non-empty local state (first-sign-in migration).
               The !m.pushedAt check is self-healing: if this device never got a
               confirmed push for the key, the snapshot alone can't prove the
               cloud has it (e.g. the dirty flag was lost while the tab was
               suspended) — so upload it. A deliberately deleted remote row keeps
               its pushedAt, so cross-device deletes still converge instead of
               resurrecting. */
            if(!localEmpty&&(isNew||!m.pushedAt||m.snapshot!==snapshotOf(key))){m.updatedAt=new Date().toISOString();m.snapshot=snapshotOf(key);m.dirty=true;}
            continue;
          }
          const remoteEmpty=isEmptySyncValue(key,remote.value);
          if(remoteEmpty&&!localEmpty){m.updatedAt=new Date().toISOString();m.snapshot=snapshotOf(key);m.dirty=true;continue;}
          if(!remoteEmpty&&localEmpty){
            /* Adopt real remote data over empty local state — unless the empty
               local state is a deliberate delete waiting to push (m.dirty on a
               key this device previously possessed), in which case the delete
               wins and must not be resurrected. A dirty flag on a
               never-possessed key is poison (fresh-device race): adopt anyway —
               applyRemoteKey resets it to clean. Registry tombstones held
               locally (e.g. an offline delete-all) merge instead of adopting,
               so the deletes survive and propagate. */
            if(!m.dirty||!syncKeyWasPossessed(key)){applyRemoteKey(key,remote);changed=true;if(key==='customExercises')customChanged=true;}
            continue;
          }
          if(MERGE_KEYS.has(key)&&!remoteEmpty&&!localEmpty){
            /* Collection keys: membership union + per-item LWW + tombstones
               (A2/A3). Runs whenever both sides hold items — not only when the
               remote key is newer — so deletes and edits converge in both
               directions. Idempotent when nothing differs. */
            const res=mergeCollectionKey(key,localVal,remote.value);
            /* Always persist the merged tombstone set for registry keys — the
               merge may have learned a newer deletedAt for an already-dead id
               without changing the visible array (setTombstoneMap no-ops when
               identical). The dirty flag below only decides the push. */
            if(REGISTRY_KEYS.has(key))setTombstoneMap(key,res.tombstones);
            if(res.dirty){
              setSyncableValue(key,res.array);
              m.updatedAt=new Date().toISOString();
              m.snapshot=snapshotOf(key);
              m.dirty=true;changed=true;
              if(key==='customExercises')customChanged=true;
              report.added+=res.stats.added;report.updated+=res.stats.updated;report.removed+=res.stats.removed;
            }
            continue;
          }
          if(remote.updated_at>m.updatedAt){
            applyRemoteKey(key,remote);changed=true;if(key==='customExercises')customChanged=true;
          }
        }
        saveSyncMeta();
        if(customChanged&&typeof mergeCustomExercises==='function'){try{mergeCustomExercises();}catch(_){}}
        if(report.added||report.updated||report.removed)Sync.syncToast(mergeToastText(report));
        if(changed){
          persistNow();
          rerenderCurrentView();
        }
        syncMeta.lastSyncAt=new Date().toISOString();
        saveSyncMeta();
        return true;
      }
      /** Re-render the visible view after remote changes arrive. Skipped while a
          draft is open so in-progress logging is never disrupted. */
      function rerenderCurrentView(){
        try{
          if(workoutState.draft)return;
          const v=state.activeView;
          if(v==='dashboard'&&typeof renderDashboard==='function')renderDashboard();
          else if(v==='library'&&typeof renderLibrary==='function')renderLibrary();
          else if(v==='workout'&&typeof renderWorkoutScreen==='function')renderWorkoutScreen();
          else if(v==='program'&&typeof renderProgram==='function')renderProgram();
          else if(v==='stats'&&typeof renderStats==='function')renderStats();
          else if(v==='settings'&&typeof renderSettings==='function')renderSettings();
          if(typeof updateLiveWorkoutIndicator==='function')updateLiveWorkoutIndicator();
        }catch(_){}
      }
      /* ===== remote wipe helpers ===== */
      /** Best-effort remote wipe for "Delete account": removes the user's rows
          server-side too. (The "Delete all data" flow uses pushDeleteAllRemote
          instead — it must push tombstones, not delete rows.) Returns true
          when the remote is confirmed empty. */
      async function wipeRemoteData(){
        const sb=await Sync.getSupabase();
        if(!sb||!navigator.onLine)return false;
        try{
          const {data}=await sb.auth.getSession();
          const user=data&&data.session&&data.session.user?data.session.user:null;
          if(!user)return false;
          const {error}=await sb.from('user_data').delete().eq('user_id',user.id);
          if(error)return false;
        }catch(_){return false;}
        /* Converged: remote rows are gone — align local snapshots with the empty state. */
        ensureSyncMeta();
        const now=new Date().toISOString();
        for(const key of SYNCABLE_KEYS)syncMeta.keys[key]={updatedAt:now,snapshot:snapshotOf(key),dirty:false};
        if(syncMeta.tombstones)syncMeta.tombstones={};
        saveSyncMeta();
        return true;
      }
      /** A3: remote half of "Delete all data". Pushes the tombstone state NOW
          (push-then-pull: the local wipe is authoritative) instead of deleting
          rows, so an offline device pulls tombstones and cannot resurrect the
          wiped data. Returns true when the push landed. */
      async function pushDeleteAllRemote(){
        ensureSyncMeta();
        const sb=await Sync.getSupabase();
        if(!sb||!navigator.onLine)return false;
        const user=await Sync.signedInUser();
        if(!user)return false;
        const ok=await pushDirtyKeys();
        if(ok){try{await pullRemote();}catch(_){}}
        return ok;
      }
      /* One pull+push round trip, guarded against concurrent runs. */
      async function syncCycle(){
        if(syncBusy)return false;
        syncBusy=true;
        try{
          ensureSyncMeta();
          const pulled=await pullRemote();
          if(pulled)await pushDirtyKeys();
          if(pulled&&!syncMeta.everSynced){syncMeta.everSynced=true;saveSyncMeta();}
          return pulled;
        }finally{syncBusy=false;}
      }
      /* ===== login-transition adopt-vs-upload (user 2026-09-11) ===== */
      /** Reset one syncable key to its empty/default state for the adopt path
          (existing account → discard local, take the cloud wholesale). View prefs
          (dashboardPeriod, statsPeriod, topExercisesMode, appearance) are device
          display state, not user data — left untouched. workoutState.draft is
          ephemeral and never synced; discarding a mid-logging workout on login
          would be hostile, so it is left alone too. */
      function clearSyncableKey(key){
        switch(key){
          case 'completed':workoutState.completed=[];break;
          case 'templates':workoutState.templates=cloneWorkoutTemplates();break;
          case 'tags':workoutState.tags=mergeTagLists(DEFAULT_SET_TAGS,[]);break;
          case 'exerciseTagPresets':workoutState.exerciseTagPresets=mergeTagLists(DEFAULT_EXERCISE_TAG_PRESETS,[]);break;
          case 'activeProgram':workoutState.activeProgram=null;break;
          case 'archivedPrograms':workoutState.archivedPrograms=[];break;
          case 'customExercises':state.customExercises=[];exercises=exercises.filter(ex=>!ex.custom);break;
          case 'favorites':state.favorites=new Set();break;
          case 'progressionSetup':resetProgressionSetup();break;
        }
      }

      Sync.ensureSyncMeta=ensureSyncMeta;
      Sync.resetSyncMeta=resetSyncMeta;
      Sync.saveSyncMeta=saveSyncMeta;
      Sync.getSyncMeta=getSyncMeta;
      Sync.snapshotOf=snapshotOf;
      Sync.isEmptySyncValue=isEmptySyncValue;
      Sync.syncKeyWasPossessed=syncKeyWasPossessed;
      Sync.markSyncDirty=markSyncDirty;
      Sync.scheduleSyncPush=scheduleSyncPush;
      Sync.pushDirtyKeys=pushDirtyKeys;
      Sync.pullRemote=pullRemote;
      Sync.syncCycle=syncCycle;
      Sync.applyRemoteKey=applyRemoteKey;
      Sync.clearSyncableKey=clearSyncableKey;
      Sync.wipeRemoteData=wipeRemoteData;
      Sync.pushDeleteAllRemote=pushDeleteAllRemote;
      Sync.noteTombstone=noteTombstone;
      Sync.tombstoneAllForSync=tombstoneAllForSync;
      Sync.clearTombstoneRegistry=clearTombstoneRegistry;
      Sync.rerenderCurrentView=rerenderCurrentView;
      Sync.isTombstoned=isTombstoned;
      Sync.liveItems=liveItems;
      Sync.mergeCollectionKey=mergeCollectionKey;
      Sync.MERGE_KEYS=MERGE_KEYS;
      Sync.REGISTRY_KEYS=REGISTRY_KEYS;
    })();
    /* Global shims for pre-existing call sites (persistence.js, app-bootstrap.js,
       workout-history.js, programs.js). New code should use the Sync namespace. */
    function markSyncDirty(){return Sync.markSyncDirty();}
    function wipeRemoteData(){return Sync.wipeRemoteData();}
    function pushDeleteAllRemote(){return Sync.pushDeleteAllRemote();}
    function noteTombstone(key,id){return Sync.noteTombstone(key,id);}
    function tombstoneAllForSync(){return Sync.tombstoneAllForSync();}
    function isTombstoned(item){return Sync.isTombstoned(item);}
    function liveItems(arr){return Sync.liveItems(arr);}

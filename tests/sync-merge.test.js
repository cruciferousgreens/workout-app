'use strict';
/* Role: sync-merge — the A1/A2/A3 correctness core. Tests the conflict
   logic (membership union, per-item newer-wins, tombstones), not the
   transport. Reaches the engine through the Sync namespace; mergeStamp and
   the other IIFE-internal helpers are NOT exported, so they are covered
   indirectly through mergeCollectionKey's observable behavior. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const g=loadRole('sync-merge');
const Sync=g.Sync;

beforeEach(()=>{
  globalThis.localStorage.clear();
  Sync.resetSyncMeta();
  delete globalThis.getSyncableValue;
});

describe('mergeCollectionKey — membership union',()=>{
  it('keeps items either side lacks, local-first order, no duplicates',()=>{
    const r=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A'}],[{id:'a',name:'A'},{id:'b',name:'B'}]);
    assert.deepEqual(r.array.map(x=>x.id),['a','b']);
    assert.equal(r.stats.added,1);
    assert.equal(r.stats.updated,0);
    assert.equal(r.dirty,true);
  });
  it('identical inputs → single copy, not dirty, zero stats',()=>{
    const r=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A'}],[{id:'a',name:'A'}]);
    assert.equal(r.array.length,1);
    assert.equal(r.dirty,false);
    assert.deepEqual(r.stats,{added:0,updated:0,removed:0});
  });
  it('string lists union case-insensitively for tags',()=>{
    const r=Sync.mergeCollectionKey('tags',['Warmup'],['warmup','Dropset']);
    assert.deepEqual(r.array,['Warmup','Dropset']);
    assert.equal(r.stats.added,1);
  });
  it('tolerates non-array inputs',()=>{
    const r=Sync.mergeCollectionKey('tags',null,undefined);
    assert.deepEqual(r.array,[]);
  });
});

describe('mergeCollectionKey — per-item content (A2)',()=>{
  it('both stamped → newer updatedAt wins',()=>{
    const r=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A',updatedAt:100}],
      [{id:'a',name:'B',updatedAt:200}]);
    assert.equal(r.array[0].name,'B');
    assert.equal(r.stats.updated,1);
  });
  it('exactly one stamped → the stamped side wins',()=>{
    const r=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A',updatedAt:100}],
      [{id:'a',name:'B'}]);
    assert.equal(r.array[0].name,'A');
    const r2=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A'}],
      [{id:'a',name:'B',updatedAt:100}]);
    assert.equal(r2.array[0].name,'B');
  });
  it('neither stamped → deterministic tiebreak, both orders converge',()=>{
    const r1=Sync.mergeCollectionKey('completed',[{id:'a',name:'A'}],[{id:'a',name:'B'}]);
    const r2=Sync.mergeCollectionKey('completed',[{id:'a',name:'B'}],[{id:'a',name:'A'}]);
    assert.deepEqual(r1.array,r2.array);
    assert.equal(r1.array[0].name,'A'); // lexicographically smaller JSON wins
  });
});

describe('mergeCollectionKey — tombstones (A3)',()=>{
  it('a tombstone beats a live item; the id leaves the visible array',()=>{
    const r=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A'}],[{id:'a',deletedAt:500}]);
    assert.deepEqual(r.array,[]);
    assert.equal(r.tombstones.get('a'),500);
    assert.equal(r.stats.removed,1);
    assert.equal(r.dirty,true);
  });
  it('a live edit strictly newer than the delete wins (true last-write-wins)',()=>{
    const r=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A2',updatedAt:600}],[{id:'a',deletedAt:500}]);
    assert.deepEqual(r.array.map(x=>x.name),['A2']);
    assert.equal(r.tombstones.size,0);
  });
  it('a same-or-older edit loses to the delete',()=>{
    const r=Sync.mergeCollectionKey('completed',
      [{id:'a',name:'A2',updatedAt:500}],[{id:'a',deletedAt:500}]);
    assert.deepEqual(r.array,[]);
  });
  it('customExercises re-attaches in-array tombstone records',()=>{
    const r=Sync.mergeCollectionKey('customExercises',[],[{id:'c1',deletedAt:500}]);
    assert.equal(r.array.length,1);
    assert.equal(Sync.isTombstoned(r.array[0]),true);
  });
});

describe('sync helpers',()=>{
  it('MERGE_KEYS contains exactly the seven collection keys',()=>{
    assert.deepEqual([...Sync.MERGE_KEYS].sort(),['archivedPrograms','completed',
      'customExercises','exerciseTagPresets','favorites','tags','templates']);
  });
  it('isEmptySyncValue guards: empty never clobbers real data',()=>{
    assert.equal(Sync.isEmptySyncValue('tags',null),true);
    assert.equal(Sync.isEmptySyncValue('tags',[]),true);
    assert.equal(Sync.isEmptySyncValue('activeProgram',{}),true);
    assert.equal(Sync.isEmptySyncValue('templates',[{builtIn:true}]),true);
    assert.equal(Sync.isEmptySyncValue('templates',[{id:'u'}]),false);
    assert.equal(Sync.isEmptySyncValue('tags',['Warmup']),false);
  });
  it('snapshotOf is a stable JSON string for a stubbed key',()=>{
    globalThis.getSyncableValue=(k)=>(k==='tags'?['a','b']:null);
    assert.equal(Sync.snapshotOf('tags'),'["a","b"]');
    assert.equal(Sync.snapshotOf('tags'),Sync.snapshotOf('tags'));
  });
  it('isTombstoned / liveItems',()=>{
    assert.equal(Sync.isTombstoned({deletedAt:123}),true);
    assert.equal(Sync.isTombstoned({id:'a'}),false);
    assert.equal(Sync.liveItems([{id:'a'},{id:'b',deletedAt:2}]).length,1);
  });
});

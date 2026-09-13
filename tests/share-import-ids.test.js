'use strict';
/* #263 (user 2026-09-12): re-accepting a share must produce unique "(shared)"
   suffixes, never repeated identical names.
   #290 (user 2026-09-12): share and MacroFactor template imports must mint
   stable content-derived ids — the same payload accepted on two devices mints
   the same id, so the sync id-union dedups instead of surfacing two copies. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');

function loadUtilities(){
  const src=fs.readFileSync(path.join(ROOT,'assets/js/utilities.js'),'utf8');
  const sandbox={window:{},document:{},localStorage:{getItem:()=>null,setItem(){}}};
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'utilities.js'});
  return sandbox;
}

describe('#263 uniqueSuffixedName',()=>{
  it('keeps the base name when untaken',()=>{
    const u=loadUtilities();
    assert.equal(u.uniqueSuffixedName('Leg Day',['Push Day']),'Leg Day');
  });
  it('appends (shared) on first collision',()=>{
    const u=loadUtilities();
    assert.equal(u.uniqueSuffixedName('Leg Day',['Leg Day']),'Leg Day (shared)');
  });
  it('increments the suffix instead of repeating (shared)',()=>{
    const u=loadUtilities();
    assert.equal(
      u.uniqueSuffixedName('Leg Day',['Leg Day','Leg Day (shared)']),
      'Leg Day (shared 2)');
    assert.equal(
      u.uniqueSuffixedName('Leg Day',['Leg Day','Leg Day (shared)','Leg Day (shared 2)']),
      'Leg Day (shared 3)');
  });
});

describe('#290 stable content ids',()=>{
  it('stableTemplateId is deterministic per content key',()=>{
    const u=loadUtilities();
    const a=u.stableTemplateId('some-key');
    const b=u.stableTemplateId('some-key');
    assert.equal(a,b);
    assert.ok(/^template-import-[0-9a-f]{16}$/.test(a),'keeps the template- kind prefix');
  });
  it('different content keys mint different ids',()=>{
    const u=loadUtilities();
    assert.notEqual(u.stableTemplateId('key-a'),u.stableTemplateId('key-b'));
  });
  it('stableProgramId keeps the program- kind prefix',()=>{
    const u=loadUtilities();
    assert.ok(/^program-import-[0-9a-f]{16}$/.test(u.stableProgramId('k')));
  });
  it('contentHash53 is a pure deterministic function',()=>{
    const u=loadUtilities();
    assert.equal(u.contentHash53('hello'),u.contentHash53('hello'));
    assert.notEqual(u.contentHash53('hello'),u.contentHash53('world'));
  });
});

describe('#263/#290 wiring pins',()=>{
  const shareSrc=fs.readFileSync(path.join(ROOT,'assets/js/share.js'),'utf8');
  const csvSrc=fs.readFileSync(path.join(ROOT,'assets/js/csv-import.js'),'utf8');
  it('share template accept uses a unique suffixed name + stable id, fresh id on re-accept',()=>{
    const at=shareSrc.indexOf('function addSharedTemplateToLibrary');
    assert.ok(at!==-1);
    const fn=shareSrc.slice(at,at+1400);
    assert.ok(fn.includes('uniqueSuffixedName'),'unique name');
    assert.ok(fn.includes('stableTemplateId('),'stable content id');
    assert.ok(fn.includes('?newTemplateId():stableId'),'re-accept mints a fresh id so ids stay unique');
  });
  it('share program accept uses a unique suffixed name + stable id, fresh id on re-accept',()=>{
    const at=shareSrc.indexOf('function addSharedProgramToLibrary');
    assert.ok(at!==-1);
    const fn=shareSrc.slice(at,at+1600);
    assert.ok(fn.includes('uniqueSuffixedName'),'unique name');
    assert.ok(fn.includes('stableProgramId('),'stable content id');
    assert.ok(fn.includes('?newProgramId():stableId'),'re-accept mints a fresh id');
  });
  it('MacroFactor template import uses a stable content-derived id, fresh id if already present',()=>{
    const at=csvSrc.indexOf('function obExecuteMfTemplateImport');
    assert.ok(at!==-1);
    const fn=csvSrc.slice(at,at+2600);
    assert.ok(fn.includes('mfTemplateContentKey(workout)'),'content key from the file');
    assert.ok(fn.includes('stableTemplateId('),'stable content id');
    assert.ok(fn.includes('?newTemplateId():stableId'),'explicit second import keeps ids unique');
  });
  it('the MF content key is keyed on CSV names, not per-device resolved ids',()=>{
    const at=csvSrc.indexOf('function mfTemplateContentKey');
    assert.ok(at!==-1);
    const fn=csvSrc.slice(at,at+600);
    assert.ok(fn.includes('item.csvName'),'CSV name — stable across devices');
    assert.ok(!fn.includes('resolution'),'must not use the per-device resolution ids');
  });
});

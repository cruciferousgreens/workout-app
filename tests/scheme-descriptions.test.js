'use strict';
/* #205 (user 2026-09-12): Settings → Progression defaults shows only the
   selected mode's one-paragraph description under the pills — tapping a
   pill swaps the copy, and the area reserves its height so the swap never
   nudges the scroll position. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');
const {schemeDescription,SCHEME_DESCRIPTIONS}=loadRole('utilities');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/app-bootstrap.js'),'utf8');

describe('schemeDescription renders exactly one mode\'s copy per selection',()=>{
  it('all three mode copies exist and are single paragraphs',()=>{
    for(const scheme of ['rpe','linear','onerm']){
      const copy=schemeDescription(scheme);
      assert.ok(typeof copy==='string'&&copy.length>10,`copy exists for ${scheme}`);
      assert.ok(!copy.includes('\n'),`${scheme} copy is one paragraph`);
    }
  });
  it('the three copies are distinct',()=>{
    const copies=['rpe','linear','onerm'].map(schemeDescription);
    assert.strictEqual(new Set(copies).size,3,'each mode has its own copy');
  });
  it('each copy describes its own mode',()=>{
    assert.match(schemeDescription('rpe'),/RPE-based/);
    assert.match(schemeDescription('linear'),/^Linear/);
    assert.match(schemeDescription('onerm'),/%1RM/);
  });
  it('the map holds exactly the three modes',()=>{
    assert.deepStrictEqual(Object.keys(SCHEME_DESCRIPTIONS).sort(),['linear','onerm','rpe']);
  });
  it('unknown scheme falls back to the RPE-based copy',()=>{
    assert.strictEqual(schemeDescription('bogus'),schemeDescription('rpe'));
  });
});

describe('settings picker wires the description area',()=>{
  it('index.html has exactly one #settingsSchemeDesc, after the settings pills',()=>{
    const pills=html.indexOf('id="settingsSchemePills"');
    const first=html.indexOf('id="settingsSchemeDesc"');
    const last=html.lastIndexOf('id="settingsSchemeDesc"');
    assert.ok(pills!==-1,'settings pills present');
    assert.ok(first!==-1,'#settingsSchemeDesc present');
    assert.strictEqual(first,last,'exactly one #settingsSchemeDesc');
    assert.ok(first>pills,'description sits after the pills');
  });
  it('syncSettingsScheme paints the description from the current scheme',()=>{
    assert.match(
      bootstrap,
      /function syncSettingsScheme\(\)\{[\s\S]*?settingsSchemeDesc[\s\S]*?schemeDescription\(scheme\)/,
      'syncSettingsScheme sets #settingsSchemeDesc via schemeDescription(scheme)'
    );
  });
  it('the description area reserves height so swaps do not scroll-jump',()=>{
    const m=css.match(/#settingsSchemeDesc\s*\{([^}]*)\}/);
    assert.ok(m,'#settingsSchemeDesc rule found in styles.css');
    assert.match(m[1],/min-height\s*:/,'#settingsSchemeDesc reserves min-height');
  });
});

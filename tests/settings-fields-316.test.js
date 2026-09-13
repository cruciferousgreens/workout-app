'use strict';
/* #316 (user 2026-09-13): Settings numeric fields follow the workout-set
   input styling — 44px height, var(--radius-sm), var(--surface-raised),
   16px text, theme-matched caret, accent border + focus ring. Pills,
   switches, and step controls must not pick up the field treatment. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

function ruleBody(selectorRe){
  const m=css.match(selectorRe);
  assert.ok(m,'rule found in styles.css');
  return m[1];
}

describe('#316 Settings fields match set-input styling',()=>{
  const body=()=>ruleBody(/\.rule-field input,\s*\.rule-field select\s*\{([^}]*)\}/);
  it('is 44px tall with 16px text',()=>{
    assert.match(body(),/(^|;)\s*height\s*:\s*44px\s*;/,'height:44px');
    assert.match(body(),/(^|;)\s*font-size\s*:\s*16px\s*;/,'font-size:16px');
  });
  it('uses radius-sm and surface-raised',()=>{
    assert.match(body(),/border-radius\s*:\s*var\(--radius-sm\)/,'border-radius:var(--radius-sm)');
    assert.match(body(),/background\s*:\s*var\(--surface-raised\)/,'background:var(--surface-raised)');
  });
  it('has a theme-matched caret and ink text',()=>{
    assert.match(body(),/caret-color\s*:\s*color-mix\(in srgb,\s*var\(--accent\)/,
      'caret follows the theme accent');
    assert.match(body(),/(^|;)\s*color\s*:\s*var\(--ink\)\s*;/,'color:var(--ink)');
  });
  it('focus shows the accent border + ring, not the default outline',()=>{
    const focus=ruleBody(/\.rule-field input:focus,\s*\.rule-field select:focus\s*\{([^}]*)\}/);
    assert.match(focus,/border-color\s*:\s*var\(--accent\)/,'accent border on focus');
    assert.match(focus,/box-shadow\s*:[^;]*var\(--focus-ring\)/,'focus ring on focus');
    assert.match(body(),/(^|;)\s*outline\s*:\s*none\s*;/,'outline:none (ring replaces it)');
  });
});

describe('#316 Settings view does not override the field styling',()=>{
  /* Regression: v1.040 fixed the base .rule-field rule, but a more specific
     #settingsView override (48px/14px/12px) silently won in the Settings tab,
     so the user saw no change. Both selectors must match. */
  const body=()=>ruleBody(/#settingsView \.rule-field input,\s*#settingsView \.rule-field select\s*\{([^}]*)\}/);
  it('is 44px tall with 16px text in Settings',()=>{
    assert.match(body(),/(^|;)\s*height\s*:\s*44px\s*;/,'height:44px');
    assert.match(body(),/(^|;)\s*font-size\s*:\s*16px\s*;/,'font-size:16px');
  });
  it('uses radius-sm, surface-raised, and the 9px set-input padding',()=>{
    assert.match(body(),/border-radius\s*:\s*var\(--radius-sm\)/,'border-radius:var(--radius-sm)');
    assert.match(body(),/background\s*:\s*var\(--surface-raised\)/,'background:var(--surface-raised)');
    assert.match(body(),/padding\s*:\s*0 9px\s*;/,'padding:0 9px like .log-input');
  });
});

describe('#316 pills, switches, and step controls are untouched',()=>{
  it('step pills keep their pill shape',()=>{
    const m=css.match(/\.step-pills \[data-step\]\s*\{([^}]*)\}/);
    assert.ok(m,'.step-pills [data-step] rule found');
    assert.match(m[1],/border-radius\s*:\s*999px/,'pills stay pills');
  });
  it('rep preset pills keep their pill shape',()=>{
    const m=css.match(/\.rep-preset\s*\{([^}]*)\}/);
    assert.ok(m,'.rep-preset rule found');
    assert.match(m[1],/border-radius\s*:\s*999px/,'preset pills stay pills');
  });
  it('the switch track does not take the text-field background',()=>{
    const m=css.match(/\.switch\s*\{([^}]*)\}/);
    assert.ok(m,'.switch rule found');
    assert.ok(!m[1].includes('var(--surface-raised)'),'switch track untouched (knob keeps it)');
  });
});

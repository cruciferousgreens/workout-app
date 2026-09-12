'use strict';
/* v1.015 layout regression pins (user 2026-09-12):
   #197 saved-workout exercise rows full-width — <button> with display:grid
   and width:auto shrink-wraps to its content in WebKit; .picker-item needs
   an explicit width:100%.
   #202 the exercise-detail Notes card is gone (may return as a future
   feature; per-exercise notes inside workouts are untouched).
   #203 Similar exercises sits below How to on the exercise detail page.
   Dependency-free: reads the stylesheet and markup from disk. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

describe('#197 saved-workout rows are full-width',()=>{
  it('.picker-item carries width:100%',()=>{
    const m=css.match(/\.picker-item\s*\{([^}]*)\}/);
    assert.ok(m,'.picker-item rule found in styles.css');
    assert.match(m[1],/(^|;)\s*width\s*:\s*100%\s*;/,'.picker-item has width:100%');
  });
});

describe('#202 exercise-detail Notes card removed',()=>{
  it('no #noteCard element remains in index.html',()=>{
    assert.ok(!html.includes('id="noteCard"'),'index.html has no #noteCard');
    assert.ok(!html.includes('notesHeading'),'index.html has no notesHeading');
  });
});

describe('#203 Similar exercises below How to',()=>{
  it('the similar block renders after the how-to block',()=>{
    const how=html.indexOf('id="howHeading"');
    const similar=html.indexOf('id="similarGrid"');
    assert.ok(how!==-1,'how-to section present');
    assert.ok(similar!==-1,'similar section present');
    assert.ok(similar>how,'Similar exercises comes after How to');
  });
});

describe('#209 saved-workout editor delete × is danger red',()=>{
  it('.rule-remove uses var(--danger) for color and border',()=>{
    const m=css.match(/\.rule-remove\s*\{([^}]*)\}/);
    assert.ok(m,'.rule-remove rule found in styles.css');
    assert.match(m[1],/(^|;)\s*color\s*:\s*var\(--danger\)\s*;/,'.rule-remove has color:var(--danger)');
    assert.match(m[1],/border[^:;]*:\s*[^;]*var\(--danger\)/,'.rule-remove border uses var(--danger)');
  });
  it('#209 follow-up: .builder-x (set-row delete ×) uses var(--danger) for color and border',()=>{
    const m=css.match(/\.builder-x\s*\{([^}]*)\}/);
    assert.ok(m,'.builder-x rule found in styles.css');
    assert.match(m[1],/(^|;)\s*color\s*:\s*var\(--danger\)\s*;/,'.builder-x has color:var(--danger)');
    assert.match(m[1],/border[^:;]*:\s*[^;]*var\(--danger\)/,'.builder-x border uses var(--danger)');
  });
});

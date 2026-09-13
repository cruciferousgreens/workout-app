'use strict';
/* Phone QA follow-ups, v1.033 round (user 2026-09-12):
   #322 stats muscle map: the set-count chips are gone — the map stands alone.
   #323 "Weight" vocabulary → "Volume" everywhere the metric is volume
         (stats card + all three segmented toggles + Settings default pill).
   #324 saved workouts get the inline × delete (parity with program rows);
         hovering the × tints that part of the card the swipe-rail red.
   #318 refinement: the 1RM/Heaviest toggle centers against the whole
         kicker+headline block, not the kicker row alone.
   Dependency-free: reads the stylesheet, markup, and sources from disk. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const statsJs=fs.readFileSync(path.join(ROOT,'assets/js/dashboard-stats.js'),'utf8');
const savedJs=fs.readFileSync(path.join(ROOT,'assets/js/saved-workouts.js'),'utf8');
const detailJs=fs.readFileSync(path.join(ROOT,'assets/js/exercise-detail.js'),'utf8');
const navJs=fs.readFileSync(path.join(ROOT,'assets/js/navigation.js'),'utf8');

describe('#322 no set-count chips under the stats muscle map',()=>{
  it('#muscleStats never renders the tag-row',()=>{
    const m=statsJs.match(/\$\('#muscleStats'\)\.innerHTML=([^;]*);/);
    assert.ok(m,'#muscleStats assignment found');
    assert.ok(!m[1].includes('tag-row'),'#muscleStats has no tag-row');
    assert.ok(!m[1].includes('musclePill'),'#muscleStats has no muscle pills');
  });
  it('the empty state still guides the user',()=>{
    assert.ok(statsJs.includes('Complete a workout to start building muscle-level stats.'),'empty-state note kept');
  });
});

describe('#323 Volume vocabulary where the metric is volume',()=>{
  it('the card reads "Volume by muscle"',()=>{
    assert.ok(html.includes('<h2>Volume by muscle</h2>'),'Volume by muscle heading present');
    assert.ok(!html.includes('<h2>Weight by muscle</h2>'),'old Weight by muscle heading gone');
  });
  it('all three stats toggles label the volume option "Volume"',()=>{
    for(const attr of ['data-map-mode="volume">Volume<','data-muscle-mode="volume">Volume<','data-top-mode="volume">Volume<']){
      assert.ok(html.includes(attr),`toggle option "${attr}" present`);
    }
    assert.ok(html.includes('aria-label="Volume by muscle metric"'),'by-muscle aria-label updated');
  });
  it('no remaining ">Weight<" toggle/pill labels',()=>{
    assert.ok(!html.includes('>Weight</button>'),'no >Weight</button> left in markup');
    assert.ok(!html.includes('>Weight<'),'no >Weight< label left in markup');
  });
  it('Settings default-tracking-metric pill reads Volume',()=>{
    assert.ok(html.includes('data-stats-default="volume" aria-pressed="true">Volume</button>'),'Settings pill reads Volume');
  });
});

describe('#324 saved-workout inline × delete',()=>{
  it('the × renders when swipe is off, never for built-ins',()=>{
    assert.ok(savedJs.includes('data-del-saved-id'),'× button markup present');
    assert.ok(savedJs.includes('!swipeOn&&!item.builtIn'),'× gated on !swipeOn and non-built-in');
    assert.ok(savedJs.includes('class="saved-workout-del"'),'× uses .saved-workout-del');
  });
  it('the × opens the same confirmation as the swipe rail',()=>{
    assert.ok(savedJs.includes('confirmDeleteSaved'),'shared confirm function present');
    assert.ok(savedJs.includes("querySelectorAll('.delete-saved-row')"),'rail still wired');
    assert.ok(savedJs.includes("querySelectorAll('[data-del-saved-id]')"),'× wired to the same confirm');
    assert.ok(savedJs.includes("$('#deleteTemplateDialog').showModal()"),'confirmation dialog shown');
  });
  it('touch with swipe on hides the ×, like the program rows',()=>{
    assert.ok(css.includes('.is-touch.swipe-sets .saved-workout-del'),'touch hide rule present');
    const m=css.match(/\.is-touch\.swipe-sets \.saved-workout-del\s*\{([^}]*)\}/);
    assert.ok(m&&m[1].includes('display: none'),'× hidden when swipe is on');
  });
  it('hovering the × tints that part of the card the swipe-rail red',()=>{
    for(const sel of ['.program-workout-del:hover','.saved-workout-del:hover']){
      assert.ok(css.includes(sel),`${sel} rule present`);
    }
    const m=css.match(/\.saved-workout-del:hover[^{]*\{([^}]*)\}/);
    assert.ok(m&&m[1].includes('var(--swipe-rail-bg)'),'× hover uses the swipe-rail red');
  });
});

describe('#318 refinement: toggle against the whole header block',()=>{
  it('kicker + headline form one left block beside the toggle',()=>{
    assert.ok(detailJs.includes('chart-head-text'),'chart-head-text wrapper present');
    const m=detailJs.match(/return `<div class="chart-tappable"><div class="chart-head-row">([\s\S]*?)<\/div>\$\{svg\}<\/div>`;/);
    assert.ok(m,'progressChartBlock nests head-row inside chart-tappable');
    assert.ok(m[1].indexOf('chart-head-text')<m[1].indexOf('mini-segmented'),'text block precedes the toggle');
    assert.ok(m[1].includes('chart-headline'),'headline inside the text block');
  });
  it('the old kicker-row-only alignment is gone',()=>{
    assert.ok(!css.includes('.chart-head-row + .chart-tappable'),'stale sibling selector removed');
    assert.ok(css.includes('.chart-head-text'),'chart-head-text rule present');
  });
});

describe('#325 no accent tint on the Workout tab while a draft is live',()=>{
  it('the live-draft tint class is gone from CSS and JS',()=>{
    assert.ok(!css.includes('has-live-draft'),'no has-live-draft rule in styles.css');
    assert.ok(!navJs.includes('has-live-draft'),'no has-live-draft toggle in navigation.js');
  });
  it('the tab still announces an in-progress session',()=>{
    assert.ok(navJs.includes("aria-label', live ? 'Workout — session in progress' : 'Workout'"),'aria-label kept');
  });
  it('only .active gets the accent treatment',()=>{
    const m=css.match(/\.nav-item\.active\s*\{([^}]*)\}/);
    assert.ok(m,'.nav-item.active rule present');
    assert.ok(m[1].includes('var(--accent)'),'.active uses the accent color');
  });
});

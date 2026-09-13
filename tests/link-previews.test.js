'use strict';
/* #211 (user 2026-09-12): link preview fixes — static only.
   - index.html og:title / twitter:title read "Cruciferous Greens Workout —
     800+ exercises, free forever" (the iMessage headline, true to the
     approved share-card copy); the <title> tag and Settings → About line are
     untouched by this change.
   - og:image / twitter:image are the absolute prod share-card URL with the
     standard type/card/description tags present.
   - <meta name="description"> stays in sync with og:description.
   - 404.html (the /s/<slug> bridge) carries share-appropriate OG/Twitter
     tags; its redirect script behavior is unchanged (pinned separately).
   Per-share dynamic titles need a server piece — tracked in the issue, not
   attempted here. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const notFound=fs.readFileSync(path.join(ROOT,'404.html'),'utf8');
const CARD='https://app.cruciferousgreens.com/share-card-home-1200.png';
const HEADLINE='Cruciferous Greens Workout — 800+ exercises, free forever';

function meta(content,name){
  const m=content.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"[^>]*>`));
  assert.ok(m,`${name} meta tag present`);
  return m[1];
}

describe('index.html preview titles',()=>{
  it('og:title is the approved share-card headline',()=>{
    assert.equal(meta(html,'og:title'),HEADLINE);
  });
  it('twitter:title matches og:title',()=>{
    assert.equal(meta(html,'twitter:title'),HEADLINE);
  });
  it('meta name="description" stays in sync with og:description',()=>{
    assert.equal(meta(html,'description'),meta(html,'og:description'));
  });
  it('the browser <title> and About line follow the same brand',()=>{
    assert.match(html,/<title>Cruciferous Greens<\/title>/,'<title> names the brand');
    const js=fs.readFileSync(path.join(ROOT,'assets/js/app-bootstrap.js'),'utf8');
    assert.ok(js.includes('Cruciferous Greens Workout · v${info.appVersion}'),'About line still names the app');
  });
});

describe('index.html preview image tags',()=>{
  it('og:image and twitter:image are the absolute share-card URL',()=>{
    assert.equal(meta(html,'og:image'),CARD);
    assert.equal(meta(html,'twitter:image'),CARD);
  });
  it('og:type, og:description and twitter:card are present',()=>{
    assert.equal(meta(html,'og:type'),'website');
    assert.ok(meta(html,'og:description').length>0,'og:description present');
    assert.equal(meta(html,'twitter:card'),'summary_large_image');
  });
});

describe('404.html short-link preview tags',()=>{
  it('carries share-appropriate OG/Twitter tags',()=>{
    assert.equal(meta(notFound,'og:title'),'Cruciferous Greens');
    assert.equal(meta(notFound,'twitter:title'),'Cruciferous Greens');
    assert.match(meta(notFound,'og:description'),/shared a workout/i,'description names the share');
    assert.equal(meta(notFound,'og:image'),CARD);
    assert.equal(meta(notFound,'twitter:image'),CARD);
  });
  it('the /s/<slug> bridge redirect script is unchanged',()=>{
    assert.ok(notFound.includes("sessionStorage.setItem('cg-spa-redirect'"),'SPA handoff intact');
    assert.ok(notFound.includes('location.replace(base)'),'redirect intact');
  });
});

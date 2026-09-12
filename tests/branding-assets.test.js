'use strict';
/* v1.013: pins the user-approved branding assets — the Ballpark app icon set
   (replacing the old emoji favicon + old icon files) and the home link share
   card with absolute prod og/twitter URLs. Dependency-free: reads files from
   disk and parses PNG IHDR headers directly. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const PROD_CARD='https://app.cruciferousgreens.com/share-card-home-1200.png';

function pngSize(rel){
  const buf=fs.readFileSync(path.join(ROOT,rel));
  assert.equal(buf.slice(0,8).toString('hex'),'89504e470d0a1a0a',`${rel} is not a PNG`);
  assert.equal(buf.slice(12,16).toString('ascii'),'IHDR',`${rel} has no IHDR`);
  return {w:buf.readUInt32BE(16),h:buf.readUInt32BE(20)};
}

describe('app icon set (v1.013)',()=>{
  it('icon files exist at their exact sizes',()=>{
    for(const [rel,w,h] of [
      ['icon-180.png',180,180],
      ['icon-192.png',192,192],
      ['icon-512.png',512,512],
    ]){
      assert.ok(fs.existsSync(path.join(ROOT,rel)),`${rel} missing`);
      const s=pngSize(rel);
      assert.equal(s.w,w,`${rel} width`);
      assert.equal(s.h,h,`${rel} height`);
    }
  });

  it('manifest is valid JSON and every icon src resolves',()=>{
    const raw=fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8');
    const m=JSON.parse(raw);
    assert.ok(Array.isArray(m.icons)&&m.icons.length>0,'manifest has icons');
    const sizes=new Set();
    for(const ic of m.icons){
      assert.ok(ic.src&&ic.type==='image/png',`icon entry well-formed: ${ic.src}`);
      assert.ok(fs.existsSync(path.join(ROOT,ic.src)),`manifest icon resolves: ${ic.src}`);
      sizes.add(ic.sizes);
    }
    for(const need of ['180x180','192x192','512x512'])
      assert.ok(sizes.has(need),`manifest covers ${need}`);
  });

  it('index.html wires the new icon as favicon and apple-touch-icon',()=>{
    const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    assert.match(html,/<link rel="icon"[^>]*href="icon-192\.png"/);
    assert.match(html,/<link rel="apple-touch-icon"[^>]*href="icon-180\.png"/);
    assert.doesNotMatch(html,/data:image\/svg\+xml;base64/,'old inline emoji favicon is gone');
  });
});

describe('home share card (v1.013)',()=>{
  it('card file exists at 1200x630',()=>{
    assert.ok(fs.existsSync(path.join(ROOT,'share-card-home-1200.png')),'card missing');
    const s=pngSize('share-card-home-1200.png');
    assert.equal(s.w,1200,'card width');
    assert.equal(s.h,630,'card height');
  });

  it('og/twitter tags use the absolute prod card URL',()=>{
    const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    assert.match(html,new RegExp(`<meta property="og:image" content="${PROD_CARD.replace(/\//g,'\\/')}" />`));
    assert.match(html,new RegExp(`<meta name="twitter:image" content="${PROD_CARD.replace(/\//g,'\\/')}" />`));
    assert.match(html,/<meta property="og:title" content="[^"]+" \/>/);
    assert.match(html,/<meta property="og:description" content="[^"]+" \/>/);
    assert.match(html,/<meta name="twitter:card" content="summary_large_image" \/>/);
  });

  it('og-card.png is retained (not clobbered)',()=>{
    assert.ok(fs.existsSync(path.join(ROOT,'og-card.png')),'og-card.png must stay in the repo');
  });
});

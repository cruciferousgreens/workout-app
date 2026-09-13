'use strict';
/* Share landing layout pins (user 2026-09-12):
   - Header (all versions): a green Start button (#297) + the bookmark icon
     for "Add to my library" next to the ×. Order follows the #180 action
     order per state (signed-in: Add leads; signed-out: Start leads).
   - Footer (all versions): the full descriptive buttons in the approved
     pattern — big primary pill + green text link + quiet grey note.
   - #213: identical pill + text-link + note treatment on the workout landing
     (both login states) and the program landing.
   - #214: the landing is always the full page — the modal variant is gone;
     a share link arriving mid-session opens the full page over a live draft
     without destroying it (pane-selection pin lives in
     workout-screen-logic.test.js).
   - #296: a cold-opened share link lands directly on the share landing
     (loading state) — the home tab never flashes first. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const shareSrc=fs.readFileSync(path.join(ROOT,'assets/js/share.js'),'utf8');
const bootstrapSrc=fs.readFileSync(path.join(ROOT,'assets/js/app-bootstrap.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

const cardStart=shareSrc.indexOf('function sharePreviewCardHtml(payload){');
assert.ok(cardStart!==-1,'sharePreviewCardHtml found');
const card=shareSrc.slice(cardStart);

describe('header actions (#297: green Start button, not a play icon)',()=>{
  it('header actions row renders the buttons plus the conditional dismiss',()=>{
    const h=card.indexOf('share-header-actions');
    assert.ok(h!==-1,'share-header-actions present');
    assert.ok(card.includes('${headerBtns}${dismissBtn}'),'header renders buttons + dismiss slot');
  });
  it('the dismiss × only renders for signed-in recipients',()=>{
    assert.ok(card.includes('const dismissBtn=signedIn?'),
      '× is signed-in-only — signed-out first-run has no ×');
  });
  it('bookmark wires Add to my library, the Start button wires Start workout',()=>{
    assert.ok(card.includes('class="share-icon-button" data-share-act="add"'),'bookmark icon adds to library');
    assert.ok(card.includes('aria-label="Add to my library"'),'bookmark labeled');
    assert.ok(card.includes('class="primary-button share-start-btn" data-share-act="start"'),'green Start button starts the workout');
    assert.ok(card.includes('>Start</button>'),'Start button labeled');
  });
  it('no bare play icon remains in the header',()=>{
    assert.ok(!card.includes('aria-label="Start workout"><svg'),'no icon-only play button');
  });
  it('order follows the #180 action order per state; signed-out is Start-only',()=>{
    assert.ok(card.includes('signedIn?bookmarkBtn+playBtn:playBtn'),
      'signed-in: bookmark first; signed-out: Start alone (no ribbon by it)');
  });
  it('program landings get the bookmark icon for signed-in only',()=>{
    assert.ok(card.includes("(signedIn?bookmarkBtn:'')"),'program header is signed-in bookmark-only');
  });
});

describe('footer descriptive buttons (#213 pattern)',()=>{
  it('footer carries the pill + text-link + quiet note, after the content',()=>{
    const f=card.indexOf('share-footer-actions');
    assert.ok(f!==-1,'share-footer-actions present');
    assert.ok(f>card.indexOf('Muscles worked'),'footer renders below the muscle map');
    assert.ok(f>card.indexOf("?'Exercises':'Workouts'"),'footer renders below the exercise list');
    const footer=card.slice(f,f+120);
    assert.ok(footer.includes('${actions}'),'footer renders the pill actions');
    assert.ok(footer.includes('${note}'),'footer renders the quiet note');
    assert.ok(card.includes('const actions=`<div class="share-actions">${primaryBtn}</div>`;'),
      'pill actions are the primary-button + text-link stack');
    assert.ok(card.includes('<p class="section-note">'),'quiet note markup present');
  });
  it('signed-in workout: Add pill leads, Start is the text link',()=>{
    const branch=card.indexOf("?`<button class=\"primary-button\" data-share-act=\"add\" type=\"button\">Add to my library</button>");
    assert.ok(branch!==-1,'signed-in branch present');
    assert.ok(card.indexOf('or start the workout</button>',branch)!==-1,'secondary path is the text link');
  });
  it('signed-out workout: Start pill leads, Add is the text link',()=>{
    const branch=card.indexOf(":`<button class=\"primary-button\" data-share-act=\"start\" type=\"button\">Start workout</button>");
    assert.ok(branch!==-1,'signed-out branch present');
    assert.ok(card.indexOf('or just save it to my library</button>',branch)!==-1,'secondary path is the text link');
  });
  it('program landing: Add pill + quiet note, same pattern',()=>{
    assert.ok(card.includes(":`<button class=\"primary-button\" data-share-act=\"add\" type=\"button\">Add to my library</button>`;"),
      'program footer pill present');
    assert.ok(card.includes('Programs save to your library — open one of its workouts to train it.'),
      'program quiet note present');
  });
  it('header icons and footer buttons are all wired',()=>{
    const wire=shareSrc.match(/function wireSharePreviewButtons\(root,payload,onDismiss\)\{([\s\S]*?)\n    \}/)[1];
    for(const act of ['dismiss','start','add'])
      assert.ok(wire.includes(`querySelectorAll('[data-share-act="${act}"]')`),
        `all [data-share-act="${act}"] controls wired`);
  });
});

describe('#214: the landing is always the full page',()=>{
  it('the modal variant is gone from share.js',()=>{
    for(const dead of ['openShareModal','renderShareModal','shareIncomingDialog','shareIncomingBody','isModal'])
      assert.ok(!shareSrc.includes(dead),`no ${dead} remains in share.js`);
  });
  it('the modal dialog is gone from index.html',()=>{
    assert.ok(!html.includes('shareIncomingDialog'),'no modal dialog markup');
    assert.ok(!html.includes('shareIncomingBody'),'no modal body markup');
  });
  it('mid-session share links open the full-page landing',()=>{
    const h=bootstrapSrc.indexOf("window.addEventListener('hashchange'");
    assert.ok(h!==-1,'hashchange handler present');
    const handler=bootstrapSrc.slice(h,h+600);
    assert.ok(handler.includes('if(payload)openSharePreview(payload,{push:false});'),'hashchange opens the full-page landing without a second history push (#265)');
    assert.ok(!handler.includes('openShareModal'),'hashchange never opens the modal');
  });
  it('openSharePreview leaves the live editor flag alone (draft opens underneath)',()=>{
    const fn=shareSrc.match(/function openSharePreview\(payload(?:,opts=\{\})?\)\{([\s\S]*?)\n    \}/)[1];
    assert.ok(!fn.includes('workoutEditorOpen'),'openSharePreview does not touch workoutEditorOpen');
    assert.ok(fn.includes('showWorkouts(false,true)'),'landing renders on the workout tab');
  });
});

describe('share landing styles',()=>{
  it('.share-icon-button and .share-footer-actions rules exist',()=>{
    assert.ok(/\.share-icon-button\s*\{/.test(css),'.share-icon-button styled');
    assert.ok(/\.share-footer-actions\s*\{/.test(css),'.share-footer-actions styled');
  });
  it('.share-start-btn is a compact green button for the header (#297)',()=>{
    assert.ok(/\.share-header-actions \.share-start-btn\s*\{/.test(css),'.share-start-btn styled');
  });
  it('the dead corner-action style is gone',()=>{
    assert.ok(!css.includes('.share-corner-action'),'no .share-corner-action remains');
  });
});

describe('#296: cold-open share links land directly on the landing',()=>{
  it('the boot detects the share route before the initial tab render',()=>{
    const det=bootstrapSrc.indexOf('const bootShareAttempt=');
    assert.ok(det!==-1,'bootShareAttempt detection present');
    const initial=bootstrapSrc.indexOf("const initialId = decodeURIComponent(location.hash.slice(1));");
    assert.ok(initial!==-1&&initial>det,'detection runs before the initial route');
    const boot=bootstrapSrc.slice(det,det+900);
    assert.ok(boot.includes("#share="),'hash links detected');
    assert.ok(boot.includes('shortLinkAttemptFromPath'),'short-link paths detected');
    assert.ok(boot.includes('takeSpaRedirectSlug'),'404-handoff slugs detected');
  });
  it('a detected share renders the loading landing immediately',()=>{
    assert.ok(bootstrapSrc.includes("if(bootShareAttempt&&typeof openSharePreviewLoading==='function')openSharePreviewLoading();"),
      'loading landing renders on a share boot');
    const fn=shareSrc.match(/function openSharePreviewLoading\(\)\{([\s\S]*?)\n    \}/)[1];
    assert.ok(fn.includes('state.sharePreview={loading:true}'),'loading sentinel set');
    assert.ok(fn.includes('showWorkouts(false,true)'),'landing renders on the workout tab');
    assert.ok(!fn.includes('workoutEditorOpen'),'live editor flag untouched');
  });
  it('the loading sentinel renders a skeleton card with no dismiss button',()=>{
    const fn=shareSrc.match(/function renderSharePreview\(\)\{([\s\S]*?)\n    \}/)[1];
    assert.ok(fn.includes('payload.loading'),'loading branch present');
    assert.ok(fn.includes('sharePreviewSkeletonHtml()'),'skeleton renders while loading (#307)');
    assert.ok(!fn.includes('shareLoadingDismiss'),'no dismiss button on the loading skeleton (user 2026-09-13)');
    const skel=shareSrc.match(/function sharePreviewSkeletonHtml\(\)\{([\s\S]*?)\n    \}/)[1];
    assert.ok(!skel.includes('shareLoadingDismiss'),'skeleton markup carries no dismiss control');
    assert.ok(skel.includes('aria-busy'),'skeleton is marked busy for assistive tech');
  });
  it('the normal initial route is skipped on a share boot',()=>{
    const initial=bootstrapSrc.indexOf("const initialId = decodeURIComponent(location.hash.slice(1));");
    const tail=bootstrapSrc.slice(initial,initial+900);
    assert.ok(tail.includes('if (bootShareAttempt)'),'share boot skips the tab render');
  });
  it('a failed share resolve falls back to the home tab',()=>{
    assert.ok(bootstrapSrc.includes("dismissSharePreview();showToast('That share link didn\\u2019t open"),
      'failed hash resolve dismisses the loading landing');
    assert.ok(bootstrapSrc.includes('const shareFailed=()=>{if(bootShareAttempt&&bootShareAttempt.type===\'short\'){dismissSharePreview();showDashboard(false);}'),
      'failed short-link resolve falls back to home');
  });
});

describe('#256: program sharing is out of the build (no short links for programs)',()=>{
  const programsSrc=fs.readFileSync(path.join(ROOT,'assets/js/programs.js'),'utf8');
  it('the program cover renders no Share button',()=>{
    assert.ok(!programsSrc.includes('shareProgramBtn'),'no #shareProgramBtn in the program cover');
    assert.ok(!programsSrc.includes('>Share program<'),'no "Share program" button markup');
  });
  it('shareActiveProgram survives as the #256 restoration point',()=>{
    /* The UI is gone but the builder stays — re-adding program sharing
       post-prod is a UI change, not a rebuild. */
    const codecSrc=fs.readFileSync(path.join(ROOT,'assets/js/share-codec.js'),'utf8');
    assert.ok(shareSrc.includes('function shareActiveProgram('),'shareActiveProgram kept');
    assert.ok(codecSrc.includes('function buildProgramShare('),'buildProgramShare kept');
  });
  it('workout sharing is untouched',()=>{
    assert.ok(shareSrc.includes('function shareTemplate('),'saved-workout share intact');
    assert.ok(shareSrc.includes('function shareTemplateLike('),'program-workout-as-workout share intact');
    assert.ok(programsSrc.includes('shareProgramWorkoutBtn'),'program workout share button intact');
  });
});

describe('#243 superseded by #244: no helper note on the share screen',()=>{
  it('the share-link note element is gone entirely',()=>{
    assert.ok(!html.includes('shareSignInLinkNote'),'note element removed per #244');
    assert.ok(!css.includes('#shareSignInLinkNote'),'dead CSS rule removed');
  });
});

describe('#241: the PR toast background is opaque, not translucent',()=>{
  it('.app-toast.pr-toast mixes gold over the surface (no alpha)',()=>{
    const m=css.match(/\.app-toast\.pr-toast\s*\{[^}]*\}/);
    assert.ok(m,'the PR toast rule exists');
    assert.ok(m[0].includes('color-mix(in srgb, var(--gold) 16%, var(--surface))'),
      'opaque gold-over-surface mix');
    assert.ok(!/rgba?\(/.test(m[0]),'no translucent rgba fill');
  });
});

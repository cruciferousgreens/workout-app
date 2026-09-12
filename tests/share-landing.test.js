'use strict';
/* Share landing layout pins (user 2026-09-12):
   - Header (all versions): compact icon buttons — bookmark for "Add to my
     library", play for "Start workout" — next to the ×. Icon order follows
     the #180 action order per state (signed-in: Add leads; signed-out:
     Start leads).
   - Footer (all versions): the full descriptive buttons in the approved
     pattern — big primary pill + green text link + quiet grey note.
   - #213: identical pill + text-link + note treatment on the workout landing
     (both login states) and the program landing.
   - #214: the landing is always the full page — the modal variant is gone;
     a share link arriving mid-session opens the full page over a live draft
     without destroying it (pane-selection pin lives in
     workout-screen-logic.test.js). */
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

describe('header icon buttons',()=>{
  it('bookmark + play icons sit next to the dismiss ×',()=>{
    const h=card.indexOf('share-header-actions');
    assert.ok(h!==-1,'share-header-actions present');
    const dismiss=card.indexOf('data-share-act="dismiss"',h);
    assert.ok(dismiss!==-1&&dismiss<h+2000,'× follows the icon buttons in the header');
  });
  it('bookmark wires Add to my library, play wires Start workout',()=>{
    assert.ok(card.includes('class="share-icon-button" data-share-act="add"'),'bookmark icon adds to library');
    assert.ok(card.includes('aria-label="Add to my library"'),'bookmark labeled');
    assert.ok(card.includes('class="share-icon-button" data-share-act="start"'),'play icon starts the workout');
    assert.ok(card.includes('aria-label="Start workout"'),'play labeled');
  });
  it('icon order follows the #180 action order per state',()=>{
    assert.ok(card.includes('signedIn?bookmarkBtn+playBtn:playBtn+bookmarkBtn'),
      'signed-in: bookmark first; signed-out: play first');
  });
  it('program landings get the bookmark icon (no start action)',()=>{
    assert.ok(card.includes(':bookmarkBtn;'),'program header is bookmark-only');
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
    assert.ok(handler.includes('if(payload)openSharePreview(payload);'),'hashchange opens the full-page landing');
    assert.ok(!handler.includes('openShareModal'),'hashchange never opens the modal');
  });
  it('openSharePreview leaves the live editor flag alone (draft opens underneath)',()=>{
    const fn=shareSrc.match(/function openSharePreview\(payload\)\{([\s\S]*?)\n    \}/)[1];
    assert.ok(!fn.includes('workoutEditorOpen'),'openSharePreview does not touch workoutEditorOpen');
    assert.ok(fn.includes('showWorkouts(false,true)'),'landing renders on the workout tab');
  });
});

describe('share landing styles',()=>{
  it('.share-icon-button and .share-footer-actions rules exist',()=>{
    assert.ok(/\.share-icon-button\s*\{/.test(css),'.share-icon-button styled');
    assert.ok(/\.share-footer-actions\s*\{/.test(css),'.share-footer-actions styled');
  });
  it('the dead corner-action style is gone',()=>{
    assert.ok(!css.includes('.share-corner-action'),'no .share-corner-action remains');
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

describe('#243: the share-modal sign-in helper note is muted, not red',()=>{
  it('#shareSignInLinkNote uses --muted',()=>{
    assert.ok(css.includes('#shareSignInLinkNote'),'the helper note has a rule');
    assert.ok(/#shareSignInLinkNote\s*\{\s*color:\s*var\(--muted\)/.test(css),
      'helper copy is muted — under Rosé the accent reads red');
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

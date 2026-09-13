'use strict';
/* Phone QA 2026-09-12 (user) batch 4:
   - #254 follow-up: the continue card's shadow still read as a blue glow
     under Rosé — it must be accent-tinted too.
   - Sign-out now actually signs out: wipeLocalUserData runs in
     signOutAccount (the cloud copy re-adopts on next sign-in).
   - #244 (user's pick): no copy on the share screen, no Done button, two
     centered buttons; sign-in prompt reads "Sharing needs an account.
     It’s free to sign up."
   - #232 follow-up: the "clearing the search" link is plain text (regular
     color, not bold, not underlined); clearing scrolls the list into view
     instead of jumping.
   - Filter "Clear all" drops the modal, then scrolls (one-shot modal
     actions dismiss the modal).
   - #238 sub-issue: the PROGRAM chip row needs breathing room below the
     muscle chips. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const css=fs.readFileSync(path.join(__dirname,'..','assets','styles.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const shareJs=fs.readFileSync(path.join(__dirname,'..','assets','js','share.js'),'utf8');
const syncAuthJs=fs.readFileSync(path.join(__dirname,'..','assets','js','sync-auth.js'),'utf8');

/* Fake document for the clear-filters behavior test. */
function fakeClearDocument(){
  const section={scrolled:null,scrollIntoView(opts){this.scrolled=opts;}};
  const dialog={closed:false,close(){this.closed=true;},showModal(){}};
  const list={innerHTML:'',closest(){return section;},querySelector(){return null;},querySelectorAll(){return[];},addEventListener(){}};
  const els={
    '#savedSearch':{value:'bench'},
    '#savedWorkoutList':list,
    '#savedFilterDialog':dialog,
    '#savedMuscleOptions':{innerHTML:'',querySelectorAll(){return[];}},
    '#clearSavedMuscles':{hidden:false},
    '#savedInProgramToggle':{setAttribute(){}},
  };
  return {section,dialog,querySelector(s){return els[s]||null;}};
}
const fakeDoc=fakeClearDocument();

const role=loadRole('saved-workout-template',{globals:{
  document:fakeDoc,
  schedulePersist(){},
  /* workout-editor.js is not in this role. */
  attachSwipeDelete(){},
}});
const {clearSavedSearchAndFilters,savedFilterState,workoutState}=role;

beforeEach(()=>{
  workoutState.templates.length=0;
  workoutState.activeProgram=null;
  const f=savedFilterState();
  f.muscles=['chest'];f.inProgram=true;
  fakeDoc.querySelector('#savedSearch').value='bench';
  fakeDoc.dialog.closed=false;
  fakeDoc.section.scrolled=null;
});

describe('clearSavedSearchAndFilters (user 2026-09-12)',()=>{
  it('clears filter state and the search field',()=>{
    clearSavedSearchAndFilters(false);
    const f=savedFilterState();
    assert.deepEqual(f.muscles,[]);
    assert.equal(f.inProgram,false);
    assert.equal(fakeDoc.querySelector('#savedSearch').value,'');
  });
  it('scrolls the section into view with a smooth scroll (no jump)',()=>{
    clearSavedSearchAndFilters(false);
    assert.deepEqual(fakeDoc.section.scrolled,{behavior:'smooth',block:'start'});
  });
  it('drops the filter modal when asked (Clear all)',()=>{
    clearSavedSearchAndFilters(true);
    assert.equal(fakeDoc.dialog.closed,true);
    assert.deepEqual(fakeDoc.section.scrolled,{behavior:'smooth',block:'start'});
  });
  it('leaves the modal alone for the inline clear-search link',()=>{
    clearSavedSearchAndFilters(false);
    assert.equal(fakeDoc.dialog.closed,false);
  });
});

describe('#254 follow-up: continue-card shadow follows the Rosé accent',()=>{
  it('rosepine .program-next-main uses an accent-tinted box-shadow',()=>{
    const m=css.match(/\[data-theme="rosepine"\]\s*\.program-next-main\s*{[^}]*box-shadow:[^}]*}/);
    assert.ok(m,'rosepine program-next-main box-shadow rule exists');
    assert.ok(m[0].includes('--accent'),'shadow is accent-tinted, not lavender-gray');
  });
});

describe('sign-out wipes local data (user 2026-09-12, major bug)',()=>{
  it('signOutAccount runs wipeLocalUserData',()=>{
    const m=syncAuthJs.match(/async function signOutAccount\(\)\{[\s\S]*?\n      \}/);
    assert.ok(m,'signOutAccount body found');
    assert.ok(m[0].includes('wipeLocalUserData'),'sign-out wipes local data');
  });
  it('no longer promises the data stays on the device',()=>{
    assert.ok(!syncAuthJs.includes('Your data stays on this device'),
      'the keep-data message is gone');
  });
});

describe('#244: share modal per the user\'s pick',()=>{
  it('sign-in prompt uses the chosen copy',()=>{
    assert.ok(html.includes('Sharing needs an account. It’s free to sign up.'));
    assert.ok(!html.includes('sign in and your links stay tied to you on any device'),
      'old second-half copy is gone');
  });
  it('no copy paragraph on either share-link screen',()=>{
    assert.ok(!html.includes('id="shareLinkNote"'));
    assert.ok(!html.includes('id="shareSignInLinkNote"'));
    assert.ok(!shareJs.includes("Send this link to a friend"),'share.js sets no link note');
  });
  it('no Done buttons — the × closes the dialogs',()=>{
    assert.ok(!html.includes('id="closeShareLinkDone"'));
    assert.ok(!html.includes('id="shareSignInDone"'));
    assert.ok(!shareJs.includes('closeShareLinkDone'));
    assert.ok(!shareJs.includes('shareSignInDone'));
  });
  it('both link screens use two centered buttons',()=>{
    const centered=(html.match(/form-actions centered/g)||[]).length;
    assert.ok(centered>=2,'share dialogs use the centered actions layout');
    assert.ok(css.includes('.form-actions.centered'),'centered actions style exists');
  });
});

describe('#232 follow-up: clear-search link is plain text',()=>{
  it('dialog-empty-link is regular color, not bold, not underlined',()=>{
    const m=css.match(/\.dialog-empty \.dialog-empty-link\s*{[^}]*}/);
    assert.ok(m,'dialog-empty-link rule exists');
    assert.ok(m[0].includes('var(--ink)'),'regular text color');
    assert.ok(!m[0].includes('underline'),'not underlined');
    assert.ok(!/font-weight:\s*700/.test(m[0]),'not bold');
  });
});

describe('#238 sub-issue: PROGRAM chip row spacing',()=>{
  it('the label row after the muscle chips has top margin',()=>{
    const m=css.match(/\.muscle-options \+ \.filter-label-row\s*{[^}]*}/);
    assert.ok(m,'spacing rule exists');
    assert.ok(/margin-top:\s*14px/.test(m[0]));
  });
});

describe('boot perf (user 2026-09-12)',()=>{
  it('boot does not renderStats() — showStats re-renders on every visit',()=>{
    const boot=fs.readFileSync(path.join(__dirname,'..','assets','js','app-bootstrap.js'),'utf8');
    const m=boot.match(/populateFilters\(\); renderLibrary\(\); renderDashboard\(\);([^\n]*)/);
    assert.ok(m,'boot render line found');
    assert.ok(!m[1].includes('renderStats()'),'no wasted stats render at boot');
  });
  it('signed-out share landing has no bookmark ribbon and no ×',()=>{
    const share=fs.readFileSync(path.join(__dirname,'..','assets','js','share.js'),'utf8');
    assert.ok(share.includes('signedIn?bookmarkBtn+playBtn:playBtn'),
      'signed-out workout header is Start-only');
    assert.ok(share.includes('const dismissBtn=signedIn?'),
      'dismiss × is signed-in-only');
  });
});

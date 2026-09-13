'use strict';
/* #317 (user 2026-09-13): swipe-to-delete regression — the row slides back
   instead of staying open. Two expert diagnoses (2026-09-13) converged:
   (a) the mid-gesture blur() (v1.041 lock-time, v1.042 pointerdown) dismissed
   the keyboard, iOS resized the viewport mid-touch, and WebKit answered with
   pointercancel — v1.042's earlier blur making it WORSE is the dose-response
   proof; (b) iOS Safari's caret-drag/text-interaction recognizer reclaims
   horizontal drags that begin on a focused input (~10px in), firing
   pointercancel before the 24px commit — preventDefault() on the
   PointerEvent does not stop it on iOS, only a touch-level preventDefault().
   The fix: no blur anywhere near the gesture + a non-passive touchmove
   claim layer that mirrors the lock predicate + a tightened vertical-abort
   predicate + setSwipeOpen clearing leaked inline styles on open too +
   an F1 guard so a swipe ending over the rail can't instant-delete.
   The ?swipediag=1 diagnostic overlay (v1.040-v1.045) never worked on the
   user's phone, so it was deleted outright — no diag code remains. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const editor=fs.readFileSync(path.join(ROOT,'assets/js/workout-editor.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

/* The pure predicate is eval'd from the source by its markers. */
function loadShouldLock(){
  const m=editor.match(/#317 BEGIN swipeGestureShouldLock \(pure[\s\S]*?#317 END swipeGestureShouldLock \*\//);
  assert.ok(m,'swipeGestureShouldLock block found');
  const fnSrc=m[0].replace(/#317 BEGIN swipeGestureShouldLock \(pure[^\n]*\n/,'').replace(/\n\s*\/\* #317 END swipeGestureShouldLock \*\//,'');
  return new Function(fnSrc+'; return swipeGestureShouldLock;')();
}

describe('#317 no blur anywhere near the swipe gesture',()=>{
  it('no blur() call remains in attachSwipeDelete',()=>{
    const body=editor.slice(editor.indexOf('function attachSwipeDelete'),editor.indexOf('function backfillDraftUids'));
    assert.ok(!body.includes('.blur()'),'no blur in the gesture code — focus is never mutated mid-touch');
  });
  it('no touch-down blur either (v1.042 is not coming back)',()=>{
    assert.ok(!editor.includes("event.pointerType !== 'mouse' && document.activeElement"),
      'the v1.042 touch-down blur is gone');
  });
});

describe('#317 iOS claim layer',()=>{
  it('registers non-passive touchmove listeners on the swipe content',()=>{
    const body=editor.slice(editor.indexOf('function attachSwipeDelete'),editor.indexOf('function backfillDraftUids'));
    assert.ok(body.includes("addEventListener('touchmove', claimSwipeTouch, { passive: false })"),
      'claim layer registered non-passive');
    assert.ok(body.includes("addEventListener('touchmove', holdSwipeTouch, { passive: false })"),
      'hold layer registered non-passive');
  });
  it('the claim layer mirrors the lock predicate and never claims taps or vertical scrolls',()=>{
    const body=editor.slice(editor.indexOf('function attachSwipeDelete'),editor.indexOf('function backfillDraftUids'));
    assert.ok(body.includes('swipeGestureShouldLock(Math.abs(t.clientX - startX), Math.abs(t.clientY - startY))'),
      'claim uses the same predicate as the lock');
    assert.ok(body.includes('interactiveStart'),
      'claim layer still exempts interactive starts');
  });
  it('a drag starting on the checkbox never slides the row (v1.045 rule, filed for later)',()=>{
    // The v1.046 attempt (let the row slide from the checkbox like prod)
    // didn't fix the user's report, so the v1.045 checkbox rule is restored
    // and the prod-parity work is filed for a later release.
    const body=editor.slice(editor.indexOf('function attachSwipeDelete'),editor.indexOf('function backfillDraftUids'));
    assert.ok(body.includes("if (!tracking || event.pointerId !== pointerId || interactiveStart || startedOnCheckbox) return;"),
      'pointermove gates on startedOnCheckbox again');
    assert.ok(body.includes('if (!tracking || horizontal || interactiveStart || startedOnCheckbox) return;'),
      'claim layer exempts checkbox starts again');
    assert.ok(body.includes("if (startedOnCheckbox) { resetDrag(); return; }"),'finish() still forces checkbox-start to a tap');
  });
});

describe('#317 swipeGestureShouldLock truth table',()=>{
  const shouldLock=loadShouldLock();
  it('dead zone: undecided samples never lock',()=>{
    assert.equal(shouldLock(0,0),false);
    assert.equal(shouldLock(3,4),false);
    assert.equal(shouldLock(6.9,6.9),false);
  });
  it('vertical wins: vertical-dominant moves abort (the v1.044 hole is closed)',()=>{
    assert.equal(shouldLock(3,8),false,'was wrongly locking in v1.044');
    assert.equal(shouldLock(5,11),false,'was wrongly locking in v1.044');
    assert.equal(shouldLock(9,13),false);
    assert.equal(shouldLock(0,20),false);
  });
  it('horizontal locks, with arc tolerance for real swipes',()=>{
    assert.equal(shouldLock(20,0),true);
    assert.equal(shouldLock(8,9),true,'slight arc still locks');
    assert.equal(shouldLock(8,3),true);
    assert.equal(shouldLock(7,7),true,'45-degree diagonal locks');
  });
});

describe('#317 setSwipeOpen owns the snap on open too',()=>{
  it('clears leaked inline drag styles on both paths',()=>{
    const body=editor.slice(editor.indexOf('function setSwipeOpen'),editor.indexOf('function installSwipeOutsideCloser'));
    assert.ok(!body.includes('if (!open)'),'no close-only guard anymore');
    assert.ok(body.includes("content.style.transition = ''; content.style.transform = '';"),
      'inline styles cleared so the .is-open rule snaps to -72px with the CSS transition');
  });
});

describe('#317 F1: a swipe ending over the rail cannot instant-delete',()=>{
  it('the delete button swallows the swipe-ending click',()=>{
    const body=editor.slice(editor.indexOf('function attachSwipeDelete'),editor.indexOf('function backfillDraftUids'));
    assert.ok(body.includes("delBtn.addEventListener('click'"),'button-level capture guard present');
    assert.ok(body.includes('stopImmediatePropagation'),'swallowed before the bubble delete handler');
  });
  it('a genuine tap still deletes (button pointerdown clears the flag)',()=>{
    const body=editor.slice(editor.indexOf('function attachSwipeDelete'),editor.indexOf('function backfillDraftUids'));
    assert.ok(body.includes("delBtn.addEventListener('pointerdown'"),'button pointerdown arms genuine taps');
  });
});

describe('#317 v1.044 revert state is preserved',()=>{
  it('the set number slides with the row (no pinning)',()=>{
    const html=editor.slice(editor.indexOf('liveSetRowHtml'),editor.indexOf('liveSetRowHtml')+12000);
    const numIdx=html.indexOf('<button class="log-set-number');
    const contentIdx=html.indexOf('<div class="log-set swipe-content');
    assert.ok(numIdx!==-1&&contentIdx!==-1&&numIdx>contentIdx,
      'number button renders inside the sliding content div');
    assert.ok(!css.includes('.set-swipe { display: grid'),
      'the .set-swipe pinning grid rules are gone');
  });
  it('the 24px commit threshold is untouched',()=>{
    assert.ok(editor.includes('>= 24'),'tap-vs-swipe still decided at 24px of travel');
  });
});

describe('#317 deleting a middle set renumbers the survivors',()=>{
  it('the renumber loop writes 1..N in DOM order',()=>{
    assert.ok(editor.includes('btn.textContent=String(i+1)'),
      'survivors are renumbered in place');
  });
  it('a DOM/data mismatch falls back to a full render',()=>{
    assert.ok(editor.includes("[data-set-swipe]').length!==item.sets.length"),
      'count check guards the surgical path');
  });
});

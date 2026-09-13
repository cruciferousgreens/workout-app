'use strict';
/* Role: saved-workout-template — pins #232 (user 2026-09-12): the filtered
   empty state renders "clearing the search" as a tappable link, and tapping
   it clears both the search box and the filters. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* Fake host: captures innerHTML, and querySelector finds the clear-link
   when the markup contains it. */
function makeHost(){
  let html='';
  const listeners={};
  const clearBtn={
    _listeners:{},
    addEventListener(t,f){this._listeners[t]=f;},
    click(){if(this._listeners.click)this._listeners.click();},
  };
  return {
    listeners,
    clearBtn,
    set innerHTML(v){html=String(v);},
    get innerHTML(){return html;},
    querySelector(sel){
      if(sel==='[data-clear-saved-search]'&&html.includes('data-clear-saved-search'))return clearBtn;
      return null;
    },
    querySelectorAll(){return [];},
    closest(){scrolledSection.scrolled=true;return scrolledSection;},
  };
}
const scrolledSection={scrolled:false,scrollIntoView(){}};
const host=makeHost();
const searchInput={value:''};
const els={
  '#savedWorkoutList':host,
  '#savedSearch':searchInput,
  '#addSavedWorkoutButton':null,
  '#savedFilterCount':null,
  '#savedFilterBtn':null,
};
const fakeDocument={
  querySelector:sel=>els[sel]??null,
  querySelectorAll:()=>[],
  getElementById:()=>null,
  createElement:()=>({addEventListener(){},setAttribute(){}}),
};

const role=loadRole('saved-workout-template',{globals:{
  document:fakeDocument,
  attachSwipeDelete(){},
  schedulePersist(){},
  renderSavedFilterDialog(){},
  openSavedWorkoutEditor(){},
  openProgramWorkoutPage(){},
  startSavedBuilder(){},
  exercises:[], /* savedItemMuscles looks up exercise rows; none here */
}});
const {renderWorkoutTemplateList,workoutState,state}=role;

beforeEach(()=>{
  workoutState.templates.length=0;
  state.savedFilter={muscles:[],inProgram:false};
  searchInput.value='';
  host.innerHTML='';
  host.clearBtn._listeners={};
});

describe('renderWorkoutTemplateList — #232 tappable "clearing the search"',()=>{
  it('filtered empty state renders a tappable clear-search link',()=>{
    searchInput.value='zzz-no-match';
    renderWorkoutTemplateList();
    assert.ok(host.innerHTML.includes('data-clear-saved-search'),
      'empty state carries the clear link: '+host.innerHTML);
    assert.ok(host.innerHTML.includes('No saved workouts match.'),'match empty state shown');
    assert.equal(typeof host.clearBtn._listeners.click,'function','the link is wired');
  });
  it('tapping the link clears the search box and the filters',()=>{
    searchInput.value='zzz-no-match';
    state.savedFilter={muscles:['chest'],inProgram:true};
    renderWorkoutTemplateList();
    host.clearBtn.click();
    assert.equal(searchInput.value,'','search box cleared');
    assert.deepEqual(state.savedFilter,{muscles:[],inProgram:false},'filters cleared');
  });
  it('unfiltered empty state has no clear link',()=>{
    renderWorkoutTemplateList();
    assert.ok(!host.innerHTML.includes('data-clear-saved-search'),'no link when not filtering');
    assert.ok(host.innerHTML.includes('No saved workouts yet.'),'plain empty state shown');
  });
  it('#271: unfiltered empty state uses the corrected wording',()=>{
    renderWorkoutTemplateList();
    assert.ok(host.innerHTML.includes('Save as template on a completed workout'),
      'corrected #271 wording: '+host.innerHTML);
  });
});

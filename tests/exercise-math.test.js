'use strict';
/* Role: exercise-math — estimate1RM (Epley + RIR) and the chart helpers.
   Dependency-free. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {estimate1RM, chartTicks, chartXLabels, isProgressMetric, flipProgressMetric}=loadRole('exercise-math');

function closeTo(actual,expected,eps=1e-9){
  assert.ok(Math.abs(actual-expected)<=eps,`expected ${actual} ≈ ${expected}`);
}

describe('estimate1RM',()=>{
  it('Epley + RIR: w×(1+(r+rir)/30)',()=>{
    closeTo(estimate1RM({w:100,r:5,rpe:8}),100*(1+7/30)); // rir 2
    closeTo(estimate1RM({w:100,r:5}),100*(1+5/30));       // no RPE → rir 0
  });
  it('zero/invalid weight → 0',()=>{
    assert.equal(estimate1RM({w:0,r:5}),0);
    assert.equal(estimate1RM({w:'x',r:5}),0);
    assert.equal(estimate1RM({w:-10,r:5}),0);
  });
});

describe('chartTicks',()=>{
  it('nice-number steps covering the range',()=>{
    assert.deepEqual(chartTicks(0,100),[0,20,40,60,80,100]);
  });
  it('flat data does not collapse (pads instead)',()=>{
    const t=chartTicks(50,50);
    assert.ok(t.length>1,'more than one tick');
    assert.ok(t[0]<50&&t[t.length-1]>50,'covers the value');
    for(let i=1;i<t.length;i++)assert.ok(t[i]>t[i-1],'monotonic');
  });
  it('ticks are monotonic and cover [min,max]',()=>{
    const t=chartTicks(3,97);
    assert.ok(t[0]<=3&&t[t.length-1]>=97);
    for(let i=1;i<t.length;i++)assert.ok(t[i]>t[i-1]);
  });
});

describe('chartXLabels',()=>{
  const coords=(n)=>Array.from({length:n},(_,i)=>({x:i*10,shortLabel:'L'+i}));
  it('long series get at most ~4 labels',()=>{
    const labels=(chartXLabels(coords(10)).match(/<text/g)||[]).length;
    assert.equal(labels,4);
  });
  it('short series label every point',()=>{
    const labels=(chartXLabels(coords(3)).match(/<text/g)||[]).length;
    assert.equal(labels,3);
  });
});

describe('progress metric toggle state (#200: 1RM | Heaviest)',()=>{
  it('flip alternates between the two modes',()=>{
    assert.equal(flipProgressMetric('e1rm'),'heaviest');
    assert.equal(flipProgressMetric('heaviest'),'e1rm');
  });
  it('only the two known modes are accepted',()=>{
    assert.equal(isProgressMetric('e1rm'),true);
    assert.equal(isProgressMetric('heaviest'),true);
    assert.equal(isProgressMetric('bogus'),false);
    assert.equal(isProgressMetric(undefined),false);
    assert.equal(isProgressMetric(''),false);
  });
});

'use strict';
/* v1.021 (#222): regression test for the dead Rosé theme. A #99 B20 edit
   deleted the [data-theme="dark"] block but left its closing brace behind;
   the stray `}` sat immediately before the [data-theme="rosepine"] rule and
   the whole rose palette silently stopped applying. Dependency-free: strips
   comments and strings, then scans braces — depth must never go negative
   (a stray closer) and must end at 0 (an unclosed block). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');

function stripCommentsAndStrings(src){
  let out='',i=0;
  const n=src.length;
  while(i<n){
    const c=src[i],next=src[i+1];
    if(c==='/'&&next==='*'){ // block comment
      const end=src.indexOf('*/',i+2);
      assert.ok(end!==-1,'unterminated block comment in styles.css');
      i=end+2;
    }else if(c==='"'||c==="'"){ // string (url("..."), content:'...')
      let j=i+1;
      while(j<n&&src[j]!==c){
        if(src[j]==='\\')j++; // escaped char
        j++;
      }
      assert.ok(j<n,'unterminated string in styles.css');
      out+='""'; // keep a placeholder so positions stay sane
      i=j+1;
    }else{
      out+=c;
      i++;
    }
  }
  return out;
}

function braceDepthAtWorst(src){
  const clean=stripCommentsAndStrings(src);
  let depth=0,min=0;
  for(let i=0;i<clean.length;i++){
    if(clean[i]==='{')depth++;
    else if(clean[i]==='}'){
      depth--;
      if(depth<min)min=depth;
    }
  }
  return {min,final:depth};
}

describe('styles.css brace balance (#222)',()=>{
  const css=fs.readFileSync(path.join(ROOT,'assets','styles.css'),'utf8');
  it('never goes negative (no stray closing brace)',()=>{
    const {min}=braceDepthAtWorst(css);
    assert.equal(min,0,`brace depth went negative (${min}) — a stray } would silently kill the rule after it, as it did to [data-theme="rosepine"]`);
  });
  it('ends at zero (no unclosed block)',()=>{
    const {final}=braceDepthAtWorst(css);
    assert.equal(final,0,`brace depth ended at ${final}, expected 0`);
  });
  it('the rosepine theme block is intact',()=>{
    assert.ok(/\[data-theme="rosepine"\]\s*\{[^}]*--accent:\s*#b4637a/.test(css),
      '[data-theme="rosepine"] block with --accent #b4637a missing');
  });
});

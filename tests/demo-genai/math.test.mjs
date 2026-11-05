import assert from 'node:assert/strict';
import { distribution, ranked, sample, entropy } from '../../public/materials/demo-genai/math.js';
const logits=Float64Array.from({length:151936},(_,i)=>Math.sin(i*31)*4-i/10000);
for(const temperature of [.2,.8,1,1.8]){
  const p=distribution(logits,temperature);
  assert.ok(Math.abs(p.reduce((sum,x)=>sum+x,0)-1)<1e-11);
  assert.ok(p.every(x=>x>=0&&Number.isFinite(x)));
  const top=ranked(p);
  assert.equal(top.length,5);
  assert.ok(top.slice(1).every((x,i)=>x.probability<=top[i].probability));
  const remaining=1-top.reduce((sum,x)=>sum+x.probability,0);
  assert.ok(remaining>=0 && remaining<=1);
}
const low=distribution([1,2,4,3],.2),high=distribution([1,2,4,3],1.8);
assert.equal(ranked(low)[0].id,ranked(high)[0].id);
assert.ok(entropy(high)>entropy(low));
assert.ok(ranked(low)[0].probability>ranked(high)[0].probability);
assert.deepEqual(Array.from(distribution([1001,1002],1)),Array.from(distribution([1,2],1)));
assert.equal(sample([.2,.3,.5],0),0);
assert.equal(sample([.2,.3,.5],.2),1);
assert.equal(sample([.2,.3,.5],.999),2);
assert.throws(()=>distribution([1,2],0),RangeError);
assert.throws(()=>distribution([NaN],1),RangeError);
console.log('Probability checks passed: full vocabulary normalization, numerical stability, ranking, entropy, sampling boundaries.');

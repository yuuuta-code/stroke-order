import test from 'node:test';
import assert from 'node:assert/strict';
import { resample, scoreAttempt, rankFor } from '../scoring.js';
import { loadRecords, recordAttempt, RECORD_KEY } from '../records.js';

const reference = [[[10, 20], [90, 20]], [[50, 5], [50, 95]], [[12, 85], [90, 85]]];
const transform = fn => reference.map(line => line.map(fn));

test('arc-length resampling is independent of input speed and repeated samples', () => {
  const slow = [[10,20],[10,20],[11,20],[20,20],[89,20],[90,20]];
  const actual = resample(slow), expected = resample(reference[0]);
  actual.forEach((p,i) => p.forEach((value,axis) => assert.ok(Math.abs(value - expected[i][axis]) < 1e-10)));
  assert.equal(scoreAttempt([slow, ...reference.slice(1)], reference).score, 100);
});

test('perfect ordered strokes earn gold; reversals and reordered strokes cannot pass', () => {
  const perfect = scoreAttempt(reference, reference);
  assert.equal(perfect.score, 100); assert.equal(perfect.rank, 'gold'); assert.ok(perfect.passed);
  for (const input of [reference.map(line => [...line].reverse()), [reference[1],reference[0],reference[2]]]) {
    const result = scoreAttempt(input, reference);
    assert.equal(result.passed, false); assert.ok(result.score < 80);
    assert.match(result.feedback, /順番・方向/);
  }
});

test('nearby parallel strokes swapped in order also fail', () => {
  const close = [[[10,10],[90,10]], [[10,14],[90,14]]];
  assert.equal(scoreAttempt([...close].reverse(), close).passed, false);
});

test('missing/extra strokes, blank and dots cannot pass', () => {
  for (const input of [[], reference.slice(1), [...reference, reference[0]], reference.map(line => [line[0]])]) {
    const result = scoreAttempt(input, reference);
    assert.ok(Number.isFinite(result.score)); assert.equal(result.passed, false); assert.ok(result.score < 80);
  }
  assert.equal(scoreAttempt([],reference).score, 0);
});

test('position, scale and scribbles affect scores without automatic alignment', () => {
  assert.ok(scoreAttempt(transform(([x,y]) => [x+3,y+2]), reference).passed);
  for (const input of [transform(([x,y]) => [x+20,y]), transform(([x,y]) => [54.5+(x-54.5)*.4,54.5+(y-54.5)*.4]), reference.map(() => [[0,0],[109,109],[0,109],[109,0]])]) {
    assert.equal(scoreAttempt(input, reference).passed, false);
  }
});

test('one bad stroke cannot be hidden by the score from many correct strokes', () => {
  const many = Array.from({length:20},(_,i) => [[0,i*4],[80,i*4]]);
  const bad = structuredClone(many); bad[0] = [[0,15],[80,15]];
  assert.equal(scoreAttempt(bad,many).passed,false);
  const backwards = structuredClone(many); backwards[0].reverse();
  assert.equal(scoreAttempt(backwards,many).passed,false);
});

test('medal thresholds are explicit', () => {
  for (const [score,rank] of [[79,'none'],[80,'bronze'],[89,'bronze'],[90,'silver'],[94,'silver'],[95,'gold'],[100,'gold']]) assert.equal(rankFor(score),rank);
  assert.equal(rankFor(100,false),'none');
});

test('records preserve the best result while counting worse attempts', () => {
  const values = new Map(); const storage = {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const records = {};
  assert.equal(recordAttempt(records,'山',{score:95},storage).improved,true);
  const result = recordAttempt(records,'山',{score:60},storage);
  assert.equal(result.improved,false); assert.equal(result.previous,95);
  assert.deepEqual(loadRecords(storage,['山']),{山:{bestScore:95,bestRank:'gold',attempts:2}});
  assert.equal(values.has('kanji-practice-v1'),false);
});

test('unavailable or corrupt storage never prevents in-memory play', () => {
  const blocked = {getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.deepEqual(loadRecords(blocked,['山']),{});
  const records = {}; assert.equal(recordAttempt(records,'山',{score:90},blocked).saved,false);
  assert.equal(records.山.bestScore,90);
  for (const value of ['null','[]','not-json','{"山":{"bestScore":99,"bestRank":"none","attempts":1}}']) {
    assert.deepEqual(loadRecords({getItem:()=>value},['山']),{});
  }
  assert.equal(RECORD_KEY,'kanji-challenge-v1');
});

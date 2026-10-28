import assert from 'node:assert/strict';
import { auctionOutcome } from '../src/game/constants';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

test('success earns bid x 200 for the leading team', () => {
  const r = auctionOutcome({ bid: 5, success: true, winnerScore: 3000, rivalScore: 1000 });
  assert.deepEqual(r, { delta: 1000, base: 1000, multiplier: 1 });
});

test('success is doubled when the winner is strictly behind', () => {
  const r = auctionOutcome({ bid: 5, success: true, winnerScore: 1000, rivalScore: 3000 });
  assert.deepEqual(r, { delta: 2000, base: 1000, multiplier: 2 });
});

test('a tie doubles nobody', () => {
  const r = auctionOutcome({ bid: 4, success: true, winnerScore: 2000, rivalScore: 2000 });
  assert.equal(r.multiplier, 1);
  assert.equal(r.delta, 800);
});

test('failure loses only the bid amount, never doubled, even when trailing', () => {
  const r = auctionOutcome({ bid: 5, success: false, winnerScore: 1000, rivalScore: 9000 });
  assert.deepEqual(r, { delta: -1000, base: 1000, multiplier: 1 });
});

test('failure never drives the score below zero', () => {
  const r = auctionOutcome({ bid: 10, success: false, winnerScore: 300, rivalScore: 0 });
  assert.equal(r.delta, -300);
});

console.log(`\nAll ${passed} auction rule tests passed.`);

import { AUCTION_TOPICS } from '../src/data/questions';

test('every auction topic caps bids at its real number of valid answers', () => {
  for (const topic of AUCTION_TOPICS) {
    const unique = new Set(topic.validItems.map((item: string) => item.trim()));
    assert.equal(unique.size, topic.validItems.length, `${topic.id}: duplicate valid items`);
    assert.equal(topic.maxPossible, topic.validItems.length, `${topic.id}: maxPossible must equal validItems.length`);
    assert.ok(topic.minBid <= topic.maxPossible, `${topic.id}: minBid above the cap`);
  }
});

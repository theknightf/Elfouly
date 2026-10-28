import assert from 'node:assert/strict';
// @ts-expect-error plain JS engine used by the server
import { triviaEngine } from '../services/triviaEngine.js';
import { drawLocalRandomQuestion, getServedIds, markServed } from '../src/utils/localQuestionEngine';
import bank from '../data/questions_bank.json';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const countByMode = (mode: string) => (bank as any[]).filter(q => q.mode === mode).length;

test('server: a whole pool is served with no repeats', () => {
  const room = 'one-time-server';
  const mode = 'edini_fi_seri';
  const seen = new Set<string>();
  const pool = countByMode(mode);
  for (let i = 0; i < pool; i += 1) {
    const q = triviaEngine.getQuestionBySlot({ roomId: room, characterId: 'fares_elfouly', mode, slotType: 'random' });
    assert.ok(q, `question ${i + 1}/${pool} should exist`);
    assert.equal(seen.has(q.id), false, `repeat: ${q.question_text}`);
    seen.add(q.id);
  }
  assert.equal(seen.size, pool);
});

test('server: a used-up pool starts a fresh pass instead of returning nothing', () => {
  const room = 'one-time-server';
  const q = triviaEngine.getQuestionBySlot({ roomId: room, characterId: 'fares_elfouly', mode: 'edini_fi_seri', slotType: 'random' });
  assert.ok(q, 'the game must not freeze when every question has been used once');
});

test('server: rooms do not share served questions', () => {
  const mode = 'meen_yezawwed';
  const a = triviaEngine.getQuestionBySlot({ roomId: 'room-a', characterId: 'fares_elfouly', mode, slotType: 'random' });
  const ids = new Set<string>([a.id]);
  for (let i = 1; i < countByMode(mode); i += 1) {
    ids.add(triviaEngine.getQuestionBySlot({ roomId: 'room-a', characterId: 'fares_elfouly', mode, slotType: 'random' }).id);
  }
  // room-b has used nothing yet, so it can serve any of them again
  const b = triviaEngine.getQuestionBySlot({ roomId: 'room-b', characterId: 'fares_elfouly', mode, slotType: 'random' });
  assert.ok(b && ids.has(b.id));
});

test('offline/Supabase: ids served on another device are never served here', () => {
  const room = 'one-time-local';
  const mode = 'edini_fi_seri';
  const all = (bank as any[]).filter(q => q.mode === mode).map(q => q.id);
  const servedElsewhere = all.slice(0, all.length - 3); // leave only 3 questions
  markServed(room, servedElsewhere);
  const drawn = new Set<string>();
  for (let i = 0; i < 3; i += 1) {
    const q: any = drawLocalRandomQuestion(mode, room);
    assert.ok(q);
    assert.equal(servedElsewhere.includes(q.id), false, 'served an id another device already used');
    assert.equal(drawn.has(q.id), false, 'repeat inside the same pass');
    drawn.add(q.id);
  }
  assert.equal(drawn.size, 3);
  assert.ok(getServedIds(room).length >= servedElsewhere.length + 3, 'served ids must be reported for syncing');
});

test('offline: a used-up pool starts a fresh pass', () => {
  const room = 'one-time-local';
  const q = drawLocalRandomQuestion('edini_fi_seri', room);
  assert.ok(q, 'offline game must not freeze when the pool is used up');
});

console.log(`\nAll ${passed} one-time-only question tests passed.`);

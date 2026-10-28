import assert from 'node:assert/strict';
import { isShootoutOver, needsFinalTieBreak, suddenDeathWinner } from '../src/game/constants';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const teams = (a: number, b: number) => ({ team_a: { score: a }, team_b: { score: b } });

test('level scores after Round 4 trigger the tie-break once', () => {
  assert.equal(needsFinalTieBreak(teams(3000, 3000), 'round4', {}), true);
  assert.equal(needsFinalTieBreak(teams(3000, 3000), 'round4', { finalTieBreak: true }), false);
});

test('no tie-break when scores differ or outside Round 4', () => {
  assert.equal(needsFinalTieBreak(teams(3000, 2000), 'round4', {}), false);
  assert.equal(needsFinalTieBreak(teams(0, 0), 'round3', {}), false);
});

test('sudden death keeps shooting after kick 10 (regulation over only when not in sudden death)', () => {
  assert.equal(isShootoutOver({ turnIndex: 10, isSuddenDeath: false }), true);
  assert.equal(isShootoutOver({ turnIndex: 10, isSuddenDeath: true }), false);
  assert.equal(isShootoutOver({ turnIndex: 12, isSuddenDeath: true, isComplete: true }), true);
  assert.equal(isShootoutOver({ turnIndex: 4 }), false);
});

test('normal sudden death compares the kick pair', () => {
  const win = suddenDeathWinner({ lastTwoShots: [{ team: 'team_a', result: 'goal' }, { team: 'team_b', result: 'missed' }] });
  assert.equal(win, 'team_a');
  const level = suddenDeathWinner({ lastTwoShots: [{ team: 'team_a', result: 'goal' }, { team: 'team_b', result: 'goal' }] });
  assert.equal(level, null);
});

test('final tie-break is decided by total score, never by the pair alone', () => {
  assert.equal(suddenDeathWinner({ finalTieBreak: true, scoreA: 4000, scoreB: 3000 }), 'team_a');
  assert.equal(suddenDeathWinner({ finalTieBreak: true, scoreA: 3000, scoreB: 3000 }), null);
});

console.log(`\nAll ${passed} final tie-break tests passed.`);

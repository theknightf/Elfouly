import assert from 'node:assert/strict';
import {
  POWERS,
  applyFirewall,
  applyPower,
  applyTurbo,
  bidLockedMs,
  canUsePower,
  resetPowers,
  takeShield
} from '../src/game/powers';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const player = (id: string, team: string, characterId: string) => ({ id, team, name: id, character: { id: characterId } });

const makeRoom = (status: string, extra: any = {}) => {
  const room: any = {
    status,
    players: [
      player('foly', 'team_a', 'fares_elfouly'),
      player('touny', 'team_a', 'abdelrahman_eltouny'),
      player('barbakh', 'team_b', 'khaled_elbarbakh'),
      player('fondoqy', 'team_b', 'ziad_elfondoqy'),
      player('eyad', 'team_a', 'eyad_amr'),
      player('mazen', 'team_b', 'mazen_elgamer'),
      player('ali', 'team_a', 'ali_ahmed')
    ],
    round1: { activeTeam: 'team_a', answeringPlayerId: 'foly', currentQuestion: { question: 'q' }, actionToken: 't', steal: null },
    round2: { currentWord: { target: 'x' }, isComplete: false, activeClueGiverA: 'fondoqy', activeClueGiverB: 'touny', timer: 45, endTime: 1_000_000 },
    round3: { phase: 'shootout', currentKickerId: 'foly', currentGoalieId: 'barbakh', currentQuestion: { question: 'q' }, interceptBuzzedBy: null, pendingAnswer: null },
    round4: { phase: 'bidding' },
    ...extra
  };
  resetPowers(room);
  return room;
};

test('every character has exactly one power', () => {
  assert.equal(Object.keys(POWERS).length, 7);
  assert.equal(new Set(Object.values(POWERS).map(p => p.id)).size, 7);
});

test('a power works only in its own rounds', () => {
  assert.equal(canUsePower(makeRoom('round2'), 'touny').ok, false); // shield is Round 1 only
  assert.equal(canUsePower(makeRoom('round1'), 'touny').ok, true);
  assert.equal(canUsePower(makeRoom('lobby'), 'touny').ok, false);
});

test('powers are single use per match and reset for a new match', () => {
  const room = makeRoom('round1');
  assert.equal(applyPower(room, 'touny').ok, true);
  assert.equal(canUsePower(room, 'touny').ok, false);
  resetPowers(room);
  assert.equal(canUsePower(room, 'touny').ok, true);
});

test('Foly re-roll needs the answering player and a successful redraw', () => {
  const room = makeRoom('round1');
  assert.equal(applyPower(room, 'foly', { rerollR1: () => false }).ok, false);
  assert.equal(room.players[0].powerUsed, false, 'a failed re-roll must not burn the power');
  assert.equal(applyPower(room, 'foly', { rerollR1: () => true }).ok, true);
  assert.equal(room.players[0].powerUsed, true);
  room.round1.answeringPlayerId = 'touny';
  const second = makeRoom('round1', { round1: { ...room.round1, answeringPlayerId: 'touny' } });
  assert.equal(canUsePower(second, 'foly').ok, false);
});

test('Touny shield absorbs exactly one wrong answer for his team', () => {
  const room = makeRoom('round1');
  assert.equal(applyPower(room, 'touny').ok, true);
  assert.equal(takeShield(room, 'team_b'), false);
  assert.equal(takeShield(room, 'team_a'), true);
  assert.equal(takeShield(room, 'team_a'), false);
});

test('Barbakh intercepts instantly, but only as the current goalie (Round 3)', () => {
  const room = makeRoom('round3');
  assert.equal(canUsePower(room, 'touny').ok, false);
  const r = applyPower(room, 'barbakh', {}, 5000);
  assert.equal(r.ok, true);
  assert.equal(room.round3.interceptBuzzedBy, 'barbakh');
  assert.equal(room.round3.interceptAt, 5000);
});

test('Fondoqy freeze adds 10 s to timer and deadline, clue-givers only', () => {
  const room = makeRoom('round2');
  assert.equal(applyPower(room, 'fondoqy').ok, true);
  assert.equal(room.round2.timer, 55);
  assert.equal(room.round2.endTime, 1_010_000);
  const other = makeRoom('round2', { round2: { ...room.round2, activeClueGiverA: 'x', activeClueGiverB: 'y' } });
  assert.equal(canUsePower(other, 'fondoqy').ok, false);
});

test('Eyad firewall cancels exactly one point loss for his team', () => {
  const room = makeRoom('round4');
  assert.equal(applyPower(room, 'eyad').ok, true);
  assert.equal(applyFirewall(room, 'team_b', 300), 300, 'other team is not protected');
  assert.equal(applyFirewall(room, 'team_a', 300), 0);
  assert.equal(applyFirewall(room, 'team_a', 300), 300, 'only once');
});

test('Mazen locks the opposing team out of bidding for 10 s', () => {
  const room = makeRoom('round4');
  assert.equal(applyPower(room, 'mazen', {}, 1000).ok, true);
  assert.equal(bidLockedMs(room, 'team_a', 1000), 10000);
  assert.equal(bidLockedMs(room, 'team_b', 1000), 0);
  assert.equal(bidLockedMs(room, 'team_a', 12000), 0);
  assert.equal(canUsePower(makeRoom('round1'), 'mazen').ok, false);
});

test('Ali turbo pays x1.5 once, only for his team', () => {
  const room = makeRoom('round2');
  assert.equal(applyPower(room, 'ali').ok, true);
  assert.equal(applyTurbo(room, 'team_b', 600), 600);
  assert.equal(applyTurbo(room, 'team_a', 600), 900);
  assert.equal(applyTurbo(room, 'team_a', 600), 600);
});

console.log(`\nAll ${passed} power tests passed.`);

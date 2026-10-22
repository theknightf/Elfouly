/**
 * tests/gameEngine.test.ts
 *
 * Locks down the four match mechanics that were requested:
 * 1. Non-exclusive character selection in the lobby.
 * 2. One judge per active session + blocking role alerts.
 * 3. Strict within-team alternation and opponent-only Bank / Continue.
 * 4. Penalty shootout: shooter selection, judge Goal/Miss, out-of-specialty bonus.
 */

import assert from 'node:assert/strict';
import {
  createGameState,
  reduce,
  getRoles,
  getAlerts,
  getBankTurnSnapshot,
  PHASES,
  TEAM_A,
  TEAM_B
} from '../src/game/index.js';

const tests: { name: string; fn: () => void }[] = [];
function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

const characters = {
  faris: { id: 'faris', name: 'Faris', attributes: ['football_post_2010', 'general_knowledge'] },
  touny: { id: 'touny', name: 'Touny', attributes: ['islamic_studies', 'general_knowledge'] },
  barbakh: { id: 'barbakh', name: 'Barbakh', attributes: ['pc_hardware_gaming'] },
  ziad: { id: 'ziad', name: 'Ziad', attributes: ['popular_foreign_series'] }
};

function players() {
  return [
    { id: 'a1', name: 'A1', team: TEAM_A, character: characters.faris, isHost: true },
    { id: 'a2', name: 'A2', team: TEAM_A, character: characters.touny },
    { id: 'b1', name: 'B1', team: TEAM_B, character: characters.barbakh },
    { id: 'b2', name: 'B2', team: TEAM_B, character: characters.ziad }
  ];
}

function startedBank() {
  const state = createGameState({ players: players() });
  const result = reduce(state, { type: 'START_BANK' });
  assert.equal(result.error, null);
  return result.state;
}

function gradeBank(state: any, correct = true) {
  const withQuestion = reduce(state, {
    type: 'BANK_PRESENT_QUESTION',
    question: { id: `q-${state.bank.totalAnswered}`, question: 'Q?', answer: 'A', category: 'general_knowledge' }
  });
  assert.equal(withQuestion.error, null);
  const graded = reduce(withQuestion.state, { type: 'BANK_GRADE', correct });
  assert.equal(graded.error, null);
  return graded.state;
}

test('character selection is non-exclusive', () => {
  let state = createGameState({
    players: [
      { id: 'p1', name: 'P1', team: TEAM_A, character: characters.faris },
      { id: 'p2', name: 'P2', team: TEAM_B, character: characters.touny }
    ]
  });
  state = reduce(state, {
    type: 'LOBBY_SELECT_CHARACTER',
    playerId: 'p2',
    character: characters.faris
  }).state;
  const p1 = state.players.find((p: any) => p.id === 'p1');
  const p2 = state.players.find((p: any) => p.id === 'p2');
  assert.equal(p1.characterId, p2.characterId);
});

test('bank starts with exactly one judge from the defending team', () => {
  const state = startedBank();
  assert.equal(state.phase, PHASES.BANK);
  assert.equal(state.bank.activeTeam, TEAM_A);
  assert.equal(state.bank.judgeId, 'b1');
  assert.equal(state.bank.answererId, 'a1');
  assert.equal(state.bank.bankControllerTeam, TEAM_B);
  assert.equal(
    state.players.filter((p: any) => p.id === state.bank.judgeId).length,
    1
  );
});

test('answerer and answering team cannot press Bank, opponent can', () => {
  const state = startedBank();
  const answererRoles = getRoles(state, 'a1');
  assert.equal(answererRoles.isAnswerer, true);
  assert.equal(answererRoles.canBank, false);
  assert.equal(answererRoles.bankButtonVisible, false);

  const teammateRoles = getRoles(state, 'a2');
  assert.equal(teammateRoles.canBank, false);
  assert.equal(teammateRoles.canContinue, false);

  const opponentRoles = getRoles(state, 'b1');
  assert.equal(opponentRoles.canBank, false); // nothing on the line yet
  assert.equal(opponentRoles.canContinue, true);

  const withPoints = gradeBank(state, true);
  assert.equal(getRoles(withPoints, 'b2').canBank, true);
  assert.equal(getRoles(withPoints, 'a1').canBank, false);

  const rejected = reduce(withPoints, { type: 'BANK_PRESS_BANK', playerId: 'a1' });
  assert.equal(rejected.error, 'bank_decision_forbidden');

  const banked = reduce(withPoints, { type: 'BANK_PRESS_BANK', playerId: 'b2' });
  assert.equal(banked.error, null);
  assert.equal(banked.state.teams[TEAM_A].bank, 100);
  assert.equal(banked.state.bank.pendingPoints, 0);
});

test('Bank Continue is opponent-only and keeps the pot on the line', () => {
  const state = gradeBank(startedBank(), true);
  const continued = reduce(state, { type: 'BANK_PRESS_CONTINUE', playerId: 'b2' });
  assert.equal(continued.error, null);
  assert.equal(continued.state.bank.pendingPoints, 100);
  assert.equal(continued.state.bank.lastDecision, 'continue');

  const rejected = reduce(state, { type: 'BANK_PRESS_CONTINUE', playerId: 'a2' });
  assert.equal(rejected.error, 'bank_decision_forbidden');
});

test('answering players alternate strictly on every question', () => {
  let state = startedBank();
  const seen: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    seen.push(state.bank.answererId);
    state = gradeBank(state, true);
  }
  assert.deepEqual(seen, ['a1', 'a2', 'a1', 'a2', 'a1', 'a2', 'a1', 'a2', 'a1', 'a2', 'a1', 'a2']);
  // After 12 questions the turn changes to Team B and a new opponent judge is set.
  assert.equal(state.bank.activeTeam, TEAM_B);
  assert.equal(state.bank.answererId, 'b1');
  assert.equal(state.bank.judgeId, 'a1');
  assert.equal(getBankTurnSnapshot(state).roundIndex, 0);
});

test('two bank rounds produce exactly 48 questions (12 per team per round)', () => {
  let state = startedBank();
  for (let i = 0; i < 48; i += 1) {
    state = gradeBank(state, true);
  }
  assert.equal(state.bank.totalAnswered, 48);
  assert.equal(state.bank.isComplete, true);
  assert.equal(state.phase, PHASES.COMPLETE);
});

test('bank role alerts are blocking and can be acknowledged', () => {
  const state = startedBank();
  const withQuestion = reduce(state, {
    type: 'BANK_PRESENT_QUESTION',
    question: { id: 'q1', question: 'Q?', answer: 'A', category: 'general_knowledge' }
  }).state;

  const answererAlerts = getAlerts(withQuestion, 'a1');
  assert.equal(answererAlerts.length, 1);
  assert.equal(answererAlerts[0].title, "It's your turn to answer!");
  assert.equal(answererAlerts[0].blocking, true);

  const judgeAlerts = getAlerts(withQuestion, 'b1');
  assert.equal(judgeAlerts.length, 1);
  assert.equal(judgeAlerts[0].title, 'You are the judge for this round.');

  const acked = reduce(withQuestion, {
    type: 'ACK_ALERT',
    playerId: 'a1',
    alertId: answererAlerts[0].id
  });
  assert.equal(getAlerts(acked.state, 'a1').length, 0);
  assert.equal(getAlerts(acked.state, 'b1').length, 1);
});

test('penalty: representative selects the shooter, judge decides goal/miss', () => {
  let state = createGameState({ players: players() });
  state = reduce(state, {
    type: 'START_PENALTY',
    categories: [{ id: 'dentistry', name: 'Dentistry' }],
    rng: () => 0
  }).state;

  assert.equal(state.phase, PHASES.PENALTY);
  assert.equal(state.penalty.activeTeam, TEAM_A);
  assert.equal(state.penalty.judgeId, 'b1');
  assert.equal(state.penalty.representatives[TEAM_A], 'a1');

  const forbidden = reduce(state, { type: 'PENALTY_SELECT_SHOOTER', actorId: 'a2', shooterId: 'a1' });
  assert.equal(forbidden.error, 'only_team_representative_can_select');

  state = reduce(state, { type: 'PENALTY_SELECT_SHOOTER', actorId: 'a1', shooterId: 'a1' }).state;
  state = reduce(state, {
    type: 'PENALTY_PRESENT_QUESTION',
    question: { id: 'p1', question: 'Q?', answer: 'A', category: 'dentistry' }
  }).state;

  const nonJudge = reduce(state, { type: 'PENALTY_JUDGE', judgeId: 'a2', result: 'goal' });
  assert.equal(nonJudge.error, 'only_assigned_judge_can_decide');

  const shooterAlerts = getAlerts(state, 'a1');
  assert.equal(shooterAlerts[0].title, 'You are shooting!');
  const judgeAlerts = getAlerts(state, 'b1');
  assert.equal(judgeAlerts[0].kind, 'penalty_judge');

  const scored = reduce(state, { type: 'PENALTY_JUDGE', judgeId: 'b1', result: 'goal' });
  assert.equal(scored.error, null);
  // Off-specialty goal => +1 goal +1 bonus.
  assert.equal(scored.state.penalty.score[TEAM_A], 1);
  assert.equal(scored.state.penalty.bonusPoints[TEAM_A], 1);
  assert.equal(scored.state.penalty.shots[0].bonusAwarded, true);
  assert.equal(scored.state.penalty.activeTeam, TEAM_B);
});

test('penalty: general-category goal never earns a bonus', () => {
  let state = createGameState({ players: players() });
  state = reduce(state, {
    type: 'START_PENALTY',
    categories: [{ id: 'general_knowledge', name: 'General' }],
    rng: () => 0
  }).state;
  state = reduce(state, { type: 'PENALTY_SELECT_SHOOTER', actorId: 'a1', shooterId: 'a1' }).state;
  state = reduce(state, {
    type: 'PENALTY_PRESENT_QUESTION',
    question: { id: 'p1', question: 'Q?', answer: 'A', category: 'general_knowledge' }
  }).state;
  state = reduce(state, { type: 'PENALTY_JUDGE', judgeId: 'b1', result: 'goal' }).state;
  assert.equal(state.penalty.bonusPoints[TEAM_A], 0);
  assert.equal(state.penalty.shots[0].bonusAwarded, false);
});

test('penalty: tie after 10 kicks enters sudden death and resolves after a pair', () => {
  let state = createGameState({ players: players() });
  state = reduce(state, {
    type: 'START_PENALTY',
    categories: [{ id: 'general_knowledge', name: 'General' }],
    rng: () => 0
  }).state;

  const shoot = (state: any, result: string) => {
    const rep = state.penalty.representatives[state.penalty.activeTeam];
    const shooter = rep;
    const selected = reduce(state, { type: 'PENALTY_SELECT_SHOOTER', actorId: rep, shooterId: shooter });
    assert.equal(selected.error, null);
    const presented = reduce(selected.state, {
      type: 'PENALTY_PRESENT_QUESTION',
      question: { id: `q-${selected.state.penalty.turnIndex}`, question: 'Q?', answer: 'A', category: 'general_knowledge' }
    });
    assert.equal(presented.error, null);
    const judged = reduce(presented.state, {
      type: 'PENALTY_JUDGE',
      judgeId: presented.state.penalty.judgeId,
      result
    });
    assert.equal(judged.error, null);
    return judged.state;
  };

  for (let i = 0; i < 10; i += 1) {
    state = shoot(state, 'miss');
  }
  assert.equal(state.penalty.suddenDeath, true);

  state = shoot(state, 'goal'); // Team A scores in sudden death
  assert.equal(state.penalty.isComplete, false);

  state = shoot(state, 'miss'); // Team B misses: pair decided
  assert.equal(state.penalty.isComplete, true);
  assert.equal(state.phase, PHASES.COMPLETE);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} game engine test(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${tests.length} game engine tests passed.`);

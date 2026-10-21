/**
 * tests/penaltyEngine.test.ts
 * Pure engine tests for the Penalty Shootout quiz game.
 * Run with: npm run test:penalty
 */

import assert from 'node:assert/strict';
import {
  createMatch,
  transition,
  getCurrentKick,
  getAllKicks,
  prepareQuestionDeck,
  QuestionPoolExhaustedError
} from '../src/penalty/engine/index';
import type {
  KickOutcome,
  Match,
  Question,
  Team
} from '../src/penalty/engine/types';

const CONFIG = {
  regulationRounds: 5,
  questionTimeLimitMs: 15_000,
  minQuestionPool: 20
};

const ALL_SPECIALTY_ATTRIBUTES = ['sports', 'science', 'history', 'tech', 'geography', 'arts', 'food', 'cars', 'religion'];


function makeTeams(
  aAttributes: string[] = ['test'],
  bAttributes: string[] = ['test']
): { A: Pick<Team, 'name' | 'players'>; B: Pick<Team, 'name' | 'players'> } {
  const player = (teamId: 'A' | 'B', index: number, attributes: string[]) => ({
    id: `${teamId.toLowerCase()}${index}`,
    teamId,
    name: `${teamId}-player-${index}`,
    attributes
  });

  return {
    A: {
      name: 'Team A',
      players: [
        player('A', 1, aAttributes),
        player('A', 2, aAttributes),
        player('A', 3, aAttributes)
      ]
    },
    B: {
      name: 'Team B',
      players: [
        player('B', 1, bAttributes),
        player('B', 2, bAttributes),
        player('B', 3, bAttributes)
      ]
    }
  };
}

function makeQuestions(count = 40): Question[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `q-${index + 1}`,
    prompt: `Question ${index + 1}`,
    options: ['correct', 'wrong-1', 'wrong-2', 'wrong-3'],
    correctIndex: 0,
    category: index % 2 === 0 ? 'general' : 'test',
    categoryLabel: index % 2 === 0 ? 'General' : 'Test'
  }));
}

function specialtyQuestion(id: string, category = 'sports'): Question {
  return {
    id,
    prompt: `Specialty question ${id}`,
    options: ['correct', 'wrong-1', 'wrong-2', 'wrong-3'],
    correctIndex: 0,
    category,
    categoryLabel: category
  };
}

function generalQuestion(id: string): Question {
  return {
    id,
    prompt: `General question ${id}`,
    options: ['correct', 'wrong-1', 'wrong-2', 'wrong-3'],
    correctIndex: 0,
    category: 'general',
    categoryLabel: 'General'
  };
}

function newMatch(options: {
  seed?: number | string;
  count?: number;
  teams?: ReturnType<typeof makeTeams>;
} = {}): Match {
  const created = createMatch({
    id: 'match-test',
    teams: options.teams ?? makeTeams(),
    questions: makeQuestions(options.count ?? 40),
    config: CONFIG,
    seed: options.seed ?? 12345,
    now: 0
  });

  return transition(created, { type: 'START_MATCH', now: 100 });
}

function newCraftedMatch(
  deck: Question[],
  teams: ReturnType<typeof makeTeams> = makeTeams()
): Match {
  const created = createMatch({
    id: 'match-crafted',
    teams,
    questions: makeQuestions(40),
    config: CONFIG,
    seed: 999,
    now: 0
  });

  created.questionDeck = deck;
  created.questionCursor = 0;
  created.usedQuestionIds = [];

  return transition(created, { type: 'START_MATCH', now: 100 });
}

function replaceDeck(match: Match, deck: Question[]): Match {
  return {
    ...match,
    questionDeck: deck,
    questionCursor: 0,
    usedQuestionIds: []
  };
}

function chooseFirstKeeper(match: Match, now = 200): Match {
  const kick = getCurrentKick(match);
  assert.ok(kick, 'current kick must exist');
  const keeper = match.teams[kick.defendingTeamId].players[0];
  return transition(match, {
    type: 'CHOOSE_GOALKEEPER',
    playerId: keeper.id,
    now
  });
}

function answerCorrect(match: Match, now = 1_000): Match {
  assert.ok(match.activeQuestion, 'active question must exist');
  return transition(match, {
    type: 'ANSWER',
    optionIndex: match.activeQuestion.question.correctIndex,
    now
  });
}

function answerWrong(match: Match, now = 1_000): Match {
  assert.ok(match.activeQuestion, 'active question must exist');
  const wrongIndex =
    (match.activeQuestion.question.correctIndex + 1) %
    match.activeQuestion.question.options.length;
  return transition(match, {
    type: 'ANSWER',
    optionIndex: wrongIndex,
    now
  });
}

function continueMatch(match: Match, now = 2_000): Match {
  return transition(match, { type: 'CONTINUE', now });
}

function playKick(match: Match, outcome: KickOutcome, now = 300): Match {
  let next = chooseFirstKeeper(match, now);
  assert.ok(next.activeQuestion, 'attacker question must start');

  if (outcome === 'goal') {
    next = answerCorrect(next, now + 100);
    return continueMatch(next, now + 200);
  }

  next = answerWrong(next, now + 100);
  assert.equal(next.phase, 'GOALKEEPER_QUESTION');

  if (outcome === 'save') {
    next = answerCorrect(next, now + 200);
  } else {
    next = answerWrong(next, now + 200);
  }

  return continueMatch(next, now + 300);
}

const tests: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void): void {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// Setup and transitions
// ---------------------------------------------------------------------------

test('createMatch starts in MATCH_START and START_MATCH boots round 1', () => {
  const created = createMatch({
    id: 'm1',
    teams: makeTeams(),
    questions: makeQuestions(),
    config: CONFIG,
    seed: 7,
    now: 0
  });

  assert.equal(created.phase, 'MATCH_START');
  assert.equal(created.rounds.length, 0);
  assert.equal(created.questionDeck.length, 40);

  const started = transition(created, { type: 'START_MATCH', now: 100 });
  assert.equal(started.phase, 'SELECT_PLAYERS');
  assert.equal(started.startedAt, 100);
  assert.equal(started.rounds.length, 1);
  assert.equal(started.rounds[0].number, 1);
  assert.equal(started.rounds[0].kicks.length, 1);
  assert.equal(started.currentRoundNumber, 1);

  const kick = getCurrentKick(started);
  assert.ok(kick);
  assert.equal(kick.indexInRound, 0);
  assert.equal(kick.attackingTeamId, 'A');
  assert.equal(kick.defendingTeamId, 'B');
  assert.equal(kick.goalkeeperId, null);
  assert.ok(started.teams.A.players.some(player => player.id === kick.attackerId));
  assert.equal(started.teams.A.points, 0);
  assert.equal(started.teams.B.points, 0);
});

test('goalkeeper must belong to the defending team', () => {
  const match = newMatch();
  const kick = getCurrentKick(match)!;
  const attackerTeamPlayer = match.teams[kick.attackingTeamId].players[0];

  const rejected = transition(match, {
    type: 'CHOOSE_GOALKEEPER',
    playerId: attackerTeamPlayer.id,
    now: 200
  });
  assert.equal(rejected, match);

  const unknown = transition(match, {
    type: 'CHOOSE_GOALKEEPER',
    playerId: 'not-a-player',
    now: 200
  });
  assert.equal(unknown, match);

  const accepted = chooseFirstKeeper(match);
  assert.equal(accepted.phase, 'ATTACKER_QUESTION');
  assert.ok(accepted.activeQuestion);
  assert.equal(accepted.activeQuestion.phase, 'attacker');
  assert.ok(
    accepted.teams.B.players.some(
      player => player.id === getCurrentKick(accepted)!.goalkeeperId
    )
  );
});

// ---------------------------------------------------------------------------
// Shooting and saving outcomes
// ---------------------------------------------------------------------------

test('a correct attacker answer scores a goal and skips the goalkeeper question', () => {
  const match = chooseFirstKeeper(newMatch());
  const answered = answerCorrect(match);

  assert.equal(answered.phase, 'GOAL');
  assert.equal(answered.teams.A.points, 1);
  assert.equal(answered.teams.B.points, 0);
  assert.equal(answered.lastOutcome, 'goal');
  assert.equal(answered.activeQuestion, null);

  const kick = getCurrentKick(answered)!;
  assert.equal(kick.outcome, 'goal');
  assert.equal(kick.scoredByTeamId, 'A');
  assert.equal(kick.pointsAwarded, 1);
  assert.equal(kick.attackerAttempt?.result, 'correct');
  assert.equal(kick.goalkeeperAttempt, null);
  assert.equal(answered.rounds[0].points.A, 1);
  assert.equal(answered.usedQuestionIds.length, 1);
});

test('a wrong attacker answer opens a different goalkeeper question; save awards defender', () => {
  const match = chooseFirstKeeper(newMatch());
  const attackerQuestionId = match.activeQuestion!.question.id;
  const afterWrong = answerWrong(match);

  assert.equal(afterWrong.phase, 'GOALKEEPER_QUESTION');
  assert.ok(afterWrong.activeQuestion);
  assert.equal(afterWrong.activeQuestion.phase, 'goalkeeper');
  assert.notEqual(afterWrong.activeQuestion.question.id, attackerQuestionId);
  assert.equal(afterWrong.usedQuestionIds.length, 2);

  const afterSave = answerCorrect(afterWrong);
  assert.equal(afterSave.phase, 'SAVE');
  assert.equal(afterSave.teams.A.points, 0);
  assert.equal(afterSave.teams.B.points, 1);

  const kick = getCurrentKick(afterSave)!;
  assert.equal(kick.outcome, 'save');
  assert.equal(kick.scoredByTeamId, 'B');
  assert.equal(kick.pointsAwarded, 1);
  assert.equal(kick.attackerAttempt?.result, 'wrong');
  assert.equal(kick.goalkeeperAttempt?.result, 'correct');
});

test('a wrong goalkeeper answer is a miss and awards nobody', () => {
  const match = chooseFirstKeeper(newMatch());
  const afterWrong = answerWrong(match);
  const afterMiss = answerWrong(afterWrong);

  assert.equal(afterMiss.phase, 'MISS');
  assert.equal(afterMiss.teams.A.points, 0);
  assert.equal(afterMiss.teams.B.points, 0);

  const kick = getCurrentKick(afterMiss)!;
  assert.equal(kick.outcome, 'miss');
  assert.equal(kick.scoredByTeamId, null);
  assert.equal(kick.pointsAwarded, 0);
  assert.equal(kick.goalkeeperAttempt?.result, 'wrong');
});

test('after a result, the other team shoots immediately in the same round', () => {
  const match = chooseFirstKeeper(newMatch());
  const afterGoal = answerCorrect(match);
  const next = continueMatch(afterGoal);

  assert.equal(next.phase, 'SELECT_PLAYERS');
  assert.equal(next.rounds.length, 1);
  assert.equal(next.rounds[0].kicks.length, 2);

  const kick = getCurrentKick(next)!;
  assert.equal(kick.indexInRound, 1);
  assert.equal(kick.attackingTeamId, 'B');
  assert.equal(kick.defendingTeamId, 'A');
  assert.ok(next.teams.B.players.some(player => player.id === kick.attackerId));
});

// ---------------------------------------------------------------------------
// Timer behaviour
// ---------------------------------------------------------------------------

test('timeout in the shooting phase passes the chance to the goalkeeper', () => {
  const match = chooseFirstKeeper(newMatch());
  const deadline = match.activeQuestion!.deadlineAt;
  const timedOut = transition(match, { type: 'TIMEOUT', now: deadline });

  assert.equal(timedOut.phase, 'GOALKEEPER_QUESTION');
  const kick = getCurrentKick(timedOut)!;
  assert.equal(kick.attackerAttempt?.result, 'timeout');
  assert.equal(kick.attackerAttempt?.answeredAt, deadline);
  assert.equal(kick.attackerAttempt?.answerIndex, null);
  assert.ok(timedOut.activeQuestion);
  assert.equal(timedOut.activeQuestion.phase, 'goalkeeper');
});

test('timeout in the goalkeeping phase is a miss', () => {
  const match = chooseFirstKeeper(newMatch());
  const afterWrong = answerWrong(match);
  const deadline = afterWrong.activeQuestion!.deadlineAt;
  const timedOut = transition(afterWrong, { type: 'TIMEOUT', now: deadline });

  assert.equal(timedOut.phase, 'MISS');
  assert.equal(timedOut.teams.A.points, 0);
  assert.equal(timedOut.teams.B.points, 0);
  assert.equal(getCurrentKick(timedOut)!.goalkeeperAttempt?.result, 'timeout');
});

test('an answer at or after the deadline is treated as a timeout', () => {
  const match = chooseFirstKeeper(newMatch());
  const question = match.activeQuestion!;
  const late = transition(match, {
    type: 'ANSWER',
    optionIndex: question.question.correctIndex,
    now: question.deadlineAt
  });

  assert.equal(late.phase, 'GOALKEEPER_QUESTION');
  assert.equal(getCurrentKick(late)!.attackerAttempt?.result, 'timeout');
});

test('TIMEOUT before the deadline is ignored', () => {
  const match = chooseFirstKeeper(newMatch());
  const early = transition(match, {
    type: 'TIMEOUT',
    now: match.activeQuestion!.deadlineAt - 1
  });
  assert.equal(early, match);
});

test('a per-question time limit overrides the default', () => {
  const questions = makeQuestions(20).map(question => ({
    ...question,
    timeLimitMs: 5_000
  }));
  const created = createMatch({
    id: 'm-short',
    teams: makeTeams(),
    questions,
    config: CONFIG,
    seed: 4,
    now: 0
  });
  const started = transition(created, { type: 'START_MATCH', now: 0 });
  const selected = chooseFirstKeeper(started, 10_000);

  assert.equal(selected.activeQuestion!.deadlineAt, 15_000);
  assert.equal(getCurrentKick(selected)!.attackerAttempt?.timeLimitMs, 5_000);
});

// ---------------------------------------------------------------------------
// Match routing, scoreboard and immutability
// ---------------------------------------------------------------------------

test('all five rounds are played even when one team has already clinched', () => {
  let match = newMatch();

  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    assert.equal(getCurrentKick(match)!.attackingTeamId, 'B');
    match = playKick(match, 'miss', 1_100 + round * 10_000);
  }

  assert.equal(match.phase, 'MATCH_END');
  assert.equal(match.teams.A.points, 5);
  assert.equal(match.teams.B.points, 0);
  assert.equal(match.winnerTeamId, 'A');
  assert.equal(match.decision, 'regulation');
  assert.equal(match.rounds.length, 5);
  assert.equal(getAllKicks(match).length, 10);

  for (const round of match.rounds) {
    assert.equal(round.kicks.length, 2);
    assert.equal(round.kicks[0].attackingTeamId, 'A');
    assert.equal(round.kicks[1].attackingTeamId, 'B');
  }
});

test('a defending team can score a point during the opponent kick', () => {
  let match = newMatch();

  // A attacks and misses, then B attacks and A's goalkeeper saves.
  match = playKick(match, 'miss', 1_000);
  match = playKick(match, 'save', 2_000);

  assert.equal(match.phase, 'SELECT_PLAYERS');
  assert.equal(match.teams.A.points, 1);
  assert.equal(match.teams.B.points, 0);
  assert.equal(match.rounds[0].points.A, 1);
  assert.equal(match.rounds[0].points.B, 0);

  const bKick = getCurrentKick(match)!;
  assert.equal(bKick.indexInRound, 0);
  assert.equal(bKick.attackingTeamId, 'A');
});

test('a team can earn two points in one round (goal + save)', () => {
  let match = newMatch();
  match = playKick(match, 'goal', 1_000);

  // A defends B's kick; B fails and A's keeper saves.
  const kick = getCurrentKick(match)!;
  assert.equal(kick.defendingTeamId, 'A');
  match = playKick(match, 'save', 2_000);

  assert.equal(match.rounds[0].points.A, 2);
  assert.equal(match.rounds[0].points.B, 0);
  assert.equal(match.teams.A.points, 2);
});

test('the reducer never mutates the previous state', () => {
  const match = newMatch();
  const snapshot = structuredClone(match);
  const after = transition(match, {
    type: 'CHOOSE_GOALKEEPER',
    playerId: match.teams.B.players[0].id,
    now: 500
  });

  assert.notEqual(after, match);
  assert.deepEqual(match, snapshot);
});

test('random attackers always come from the attacking team', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    let match = newMatch({ seed });
    let kick = getCurrentKick(match)!;
    assert.ok(match.teams.A.players.some(player => player.id === kick.attackerId));

    match = playKick(match, 'goal', 1_000);
    kick = getCurrentKick(match)!;
    assert.equal(kick.attackingTeamId, 'B');
    assert.ok(match.teams.B.players.some(player => player.id === kick.attackerId));
  }
});

test('question IDs are never reused during a complete match', () => {
  let match = newMatch({ count: 60 });
  const used: string[] = [];

  for (let kickIndex = 0; kickIndex < 10; kickIndex += 1) {
    match = chooseFirstKeeper(match, 1_000 + kickIndex * 10_000);
    const attackerQuestion = match.activeQuestion!.question.id;
    used.push(attackerQuestion);
    match = answerWrong(match, 1_100 + kickIndex * 10_000);
    const keeperQuestion = match.activeQuestion!.question.id;
    used.push(keeperQuestion);
    assert.notEqual(keeperQuestion, attackerQuestion);
    match = answerWrong(match, 1_200 + kickIndex * 10_000);
    match = continueMatch(match, 1_300 + kickIndex * 10_000);
  }

  assert.equal(used.length, 20);
  assert.equal(new Set(used).size, used.length);
  assert.equal(new Set(match.usedQuestionIds).size, match.usedQuestionIds.length);
  assert.deepEqual([...match.usedQuestionIds].sort(), [...used].sort());
});

// ---------------------------------------------------------------------------
// Sudden death and winner logic
// ---------------------------------------------------------------------------

test('a regulation tie enters sudden death instead of ending the match', () => {
  let match = newMatch();

  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    match = playKick(match, 'goal', 1_100 + round * 10_000);
  }

  assert.equal(match.phase, 'SUDDEN_DEATH');
  assert.equal(match.suddenDeath, true);
  assert.equal(match.winnerTeamId, null);
  assert.equal(match.teams.A.points, 5);
  assert.equal(match.teams.B.points, 5);
  assert.equal(getAllKicks(match).length, 10);
});

test('a sudden-death round decided after both kicks crowns the higher round scorer', () => {
  let match = newMatch();

  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    match = playKick(match, 'goal', 1_100 + round * 10_000);
  }

  match = transition(match, { type: 'START_SUDDEN_DEATH_ROUND', now: 60_000 });
  assert.equal(match.rounds.length, 6);
  assert.equal(match.rounds[5].isSuddenDeath, true);
  assert.equal(match.rounds[5].kicks[0].attackingTeamId, 'A');

  match = playKick(match, 'goal', 60_100); // A scores
  assert.equal(match.phase, 'SELECT_PLAYERS');
  assert.equal(match.winnerTeamId, null);

  match = playKick(match, 'miss', 60_200); // B does not score
  assert.equal(match.phase, 'MATCH_END');
  assert.equal(match.winnerTeamId, 'A');
  assert.equal(match.decision, 'sudden_death');
  assert.equal(match.teams.A.points, 6);
  assert.equal(match.teams.B.points, 5);
});

test('a tied sudden-death round starts another sudden-death round', () => {
  let match = newMatch();

  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    match = playKick(match, 'goal', 1_100 + round * 10_000);
  }

  match = transition(match, { type: 'START_SUDDEN_DEATH_ROUND', now: 60_000 });
  match = playKick(match, 'goal', 60_100);
  match = playKick(match, 'goal', 60_200);

  assert.equal(match.phase, 'SUDDEN_DEATH');
  assert.equal(match.winnerTeamId, null);
  assert.equal(match.teams.A.points, 6);
  assert.equal(match.teams.B.points, 6);

  match = transition(match, { type: 'START_SUDDEN_DEATH_ROUND', now: 70_000 });
  assert.equal(match.rounds.length, 7);
  assert.equal(match.rounds[6].isSuddenDeath, true);

  // A misses, B scores: B wins the second sudden-death round.
  match = playKick(match, 'miss', 70_100);
  match = playKick(match, 'goal', 70_200);

  assert.equal(match.phase, 'MATCH_END');
  assert.equal(match.winnerTeamId, 'B');
  assert.equal(match.decision, 'sudden_death');
});

test('a save on the second sudden-death kick can decide the round for the defender', () => {
  let match = newMatch();

  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    match = playKick(match, 'goal', 1_100 + round * 10_000);
  }

  match = transition(match, { type: 'START_SUDDEN_DEATH_ROUND', now: 60_000 });
  match = playKick(match, 'miss', 60_100); // A misses
  match = playKick(match, 'save', 60_200); // B fails, A keeper saves → A gets the point

  assert.equal(match.phase, 'MATCH_END');
  assert.equal(match.winnerTeamId, 'A');
  assert.equal(match.rounds[6 - 1].points.A, 1);
  assert.equal(match.rounds[6 - 1].points.B, 0);
});

test('the match ends only after the full sudden-death round', () => {
  let match = newMatch();

  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    match = playKick(match, 'goal', 1_100 + round * 10_000);
  }

  match = transition(match, { type: 'START_SUDDEN_DEATH_ROUND', now: 60_000 });
  match = playKick(match, 'goal', 60_100);
  assert.equal(match.phase, 'SELECT_PLAYERS');
  assert.equal(match.winnerTeamId, null);
});

// ---------------------------------------------------------------------------
// General-question mix and specialty bonuses
// ---------------------------------------------------------------------------

test('every deck prefix keeps at least 50% General questions across many seeds', () => {
  const questions = makeQuestions(120);

  for (let seed = 1; seed <= 100; seed += 1) {
    const { deck } = prepareQuestionDeck(questions, seed);
    assert.equal(deck.length, 120);
    assert.equal(deck[0].category, 'general');

    let generalCount = 0;
    deck.forEach((question, index) => {
      if (question.category === 'general') {
        generalCount += 1;
      }
      assert.ok(
        generalCount * 2 >= index + 1,
        `seed ${seed}: General ratio dropped below 50% at draw ${index + 1}`
      );
    });
  }
});

test('many complete matches never draw fewer than 50% General questions', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    let match = newMatch({
      seed,
      count: 80,
      teams: makeTeams(
        [...ALL_SPECIALTY_ATTRIBUTES, 'test'],
        [...ALL_SPECIALTY_ATTRIBUTES, 'test']
      )
    });
    const categoryById = new Map(
      match.questionDeck.map(question => [question.id, question.category])
    );

    const assertMix = (label: string) => {
      let generalCount = 0;
      match.usedQuestionIds.forEach((id, index) => {
        if (categoryById.get(id) === 'general') {
          generalCount += 1;
        }
        assert.ok(
          generalCount * 2 >= index + 1,
          `seed ${seed} (${label}): General ratio below 50% at draw ${index + 1}`
        );
      });
    };

    assertMix('start');

    for (let round = 0; round < 5; round += 1) {
      match = playKick(match, 'goal', 1_000 + round * 10_000);
      assertMix(`regulation A round ${round + 1}`);
      match = playKick(match, 'goal', 1_100 + round * 10_000);
      assertMix(`regulation B round ${round + 1}`);
    }

    assert.equal(match.phase, 'SUDDEN_DEATH');
    match = transition(match, { type: 'START_SUDDEN_DEATH_ROUND', now: 60_000 });
    assertMix('sudden death start');
    match = playKick(match, 'goal', 60_100);
    assertMix('sudden death A');
    match = playKick(match, 'miss', 60_200);
    assertMix('sudden death B');
    assert.equal(match.phase, 'MATCH_END');

    const total = match.usedQuestionIds.length;
    const general = match.usedQuestionIds.filter(
      id => categoryById.get(id) === 'general'
    ).length;
    assert.ok(general * 2 >= total);
  }
});

test('a correct out-of-specialty attacker answer earns a bonus point', () => {
  const teams = makeTeams(['science'], ['sports']);
  let match = newCraftedMatch([specialtyQuestion('bonus-a', 'sports')], teams);

  match = chooseFirstKeeper(match);
  match = answerCorrect(match);

  assert.equal(match.phase, 'GOAL');
  assert.equal(match.teams.A.points, 2);
  assert.equal(match.teams.A.bonusPoints, 1);
  assert.equal(match.teams.B.points, 0);

  const kick = getCurrentKick(match)!;
  assert.equal(kick.pointsAwarded, 1);
  assert.equal(kick.bonusAwarded, true);
  assert.equal(kick.bonusTeamId, 'A');
  assert.equal(kick.totalPointsAwarded, 2);
  assert.equal(match.rounds[0].points.A, 2);
  assert.equal(match.rounds[0].outcomePoints.A, 1);
  assert.equal(match.rounds[0].bonusPoints.A, 1);
});

test('a correct in-specialty attacker answer receives no bonus', () => {
  let match = newCraftedMatch(
    [specialtyQuestion('in-specialty-a', 'sports')],
    makeTeams(['sports'], ['sports'])
  );

  match = chooseFirstKeeper(match);
  match = answerCorrect(match);

  assert.equal(match.phase, 'GOAL');
  assert.equal(match.teams.A.points, 1);
  assert.equal(match.teams.A.bonusPoints, 0);
  const kick = getCurrentKick(match)!;
  assert.equal(kick.bonusAwarded, false);
  assert.equal(kick.totalPointsAwarded, 1);
});

test('a General question never earns a bonus', () => {
  let match = newCraftedMatch(
    [generalQuestion('general-a')],
    makeTeams([], [])
  );

  match = chooseFirstKeeper(match);
  match = answerCorrect(match);

  assert.equal(match.phase, 'GOAL');
  assert.equal(match.teams.A.points, 1);
  assert.equal(match.teams.A.bonusPoints, 0);
  const kick = getCurrentKick(match)!;
  assert.equal(kick.bonusAwarded, false);
});

test('wrong answers and timeouts never earn a bonus', () => {
  let match = newCraftedMatch(
    [specialtyQuestion('wrong-a', 'sports'), specialtyQuestion('timeout-b', 'science')],
    makeTeams([], [])
  );

  match = chooseFirstKeeper(match);
  match = answerWrong(match);

  const deadline = match.activeQuestion!.deadlineAt;
  match = transition(match, { type: 'TIMEOUT', now: deadline });

  assert.equal(match.phase, 'MISS');
  assert.equal(match.teams.A.points, 0);
  assert.equal(match.teams.B.points, 0);
  assert.equal(match.teams.A.bonusPoints, 0);
  assert.equal(match.teams.B.bonusPoints, 0);

  const kick = getCurrentKick(match)!;
  assert.equal(kick.bonusAwarded, false);
  assert.equal(kick.totalPointsAwarded, 0);
  assert.equal(kick.attackerAttempt?.result, 'wrong');
  assert.equal(kick.goalkeeperAttempt?.result, 'timeout');
});

test('a correct out-of-specialty goalkeeper answer earns a save plus a bonus', () => {
  let match = newCraftedMatch(
    [generalQuestion('gk-general'), specialtyQuestion('gk-bonus', 'science')],
    makeTeams(['sports'], ['sports'])
  );

  match = chooseFirstKeeper(match);
  match = answerWrong(match);
  assert.equal(match.phase, 'GOALKEEPER_QUESTION');
  match = answerCorrect(match);

  assert.equal(match.phase, 'SAVE');
  assert.equal(match.teams.A.points, 0);
  assert.equal(match.teams.B.points, 2);
  assert.equal(match.teams.B.bonusPoints, 1);

  const kick = getCurrentKick(match)!;
  assert.equal(kick.outcome, 'save');
  assert.equal(kick.pointsAwarded, 1);
  assert.equal(kick.bonusAwarded, true);
  assert.equal(kick.bonusTeamId, 'B');
  assert.equal(kick.totalPointsAwarded, 2);
  assert.equal(match.rounds[0].points.B, 2);
  assert.equal(match.rounds[0].outcomePoints.B, 1);
  assert.equal(match.rounds[0].bonusPoints.B, 1);
});

test('a correct General goalkeeper answer gets only the save point', () => {
  let match = newCraftedMatch(
    [specialtyQuestion('gk-wrong', 'sports'), generalQuestion('gk-general-no-bonus')],
    makeTeams([], [])
  );

  match = chooseFirstKeeper(match);
  match = answerWrong(match);
  match = answerCorrect(match);

  assert.equal(match.phase, 'SAVE');
  assert.equal(match.teams.B.points, 1);
  assert.equal(match.teams.B.bonusPoints, 0);
  const kick = getCurrentKick(match)!;
  assert.equal(kick.bonusAwarded, false);
  assert.equal(kick.totalPointsAwarded, 1);
});

test('a bonus point cannot decide a sudden-death round', () => {
  const regulationDeck: Question[] = [
    ...Array.from({ length: 10 }, (_, index) => generalQuestion(`sd-reg-${index + 1}`)),
    specialtyQuestion('sd-a', 'sports'),
    specialtyQuestion('sd-b', 'sports')
  ];

  let match = newCraftedMatch(
    regulationDeck,
    makeTeams([], ['sports'])
  );

  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    match = playKick(match, 'goal', 1_100 + round * 10_000);
  }

  assert.equal(match.phase, 'SUDDEN_DEATH');
  assert.equal(match.teams.A.points, 5);
  assert.equal(match.teams.B.points, 5);

  match = transition(match, { type: 'START_SUDDEN_DEATH_ROUND', now: 60_000 });
  match = playKick(match, 'goal', 60_100); // A: sports question, out of specialty, goal + bonus
  match = playKick(match, 'goal', 60_200); // B: sports question, in specialty, goal only

  const round = match.rounds[5];
  assert.equal(round.points.A, 2);
  assert.equal(round.points.B, 1);
  assert.equal(round.outcomePoints.A, 1);
  assert.equal(round.outcomePoints.B, 1);

  // The round totals differ because of the bonus, but the goal/save result is
  // tied, so sudden death must continue instead of handing A the win.
  assert.equal(match.phase, 'SUDDEN_DEATH');
  assert.equal(match.winnerTeamId, null);
  assert.equal(match.teams.A.points, 7);
  assert.equal(match.teams.B.points, 6);
});



test('createMatch rejects an insufficient question pool', () => {
  assert.throws(
    () =>
      createMatch({
        id: 'small',
        teams: makeTeams(),
        questions: makeQuestions(19),
        config: CONFIG,
        seed: 1,
        now: 0
      }),
    /مخزون الأسئلة/
  );
});

test('starting sudden death with an exhausted pool never repeats a question', () => {
  let match = newMatch({ count: 20 });

  for (let kickIndex = 0; kickIndex < 10; kickIndex += 1) {
    match = playKick(match, 'miss', 1_000 + kickIndex * 10_000);
  }

  assert.equal(match.phase, 'SUDDEN_DEATH');
  assert.equal(match.usedQuestionIds.length, 20);
  assert.equal(new Set(match.usedQuestionIds).size, 20);

  const suddenDeath = transition(match, {
    type: 'START_SUDDEN_DEATH_ROUND',
    now: 60_000
  });
  assert.equal(suddenDeath.phase, 'SELECT_PLAYERS');
  assert.throws(
    () => chooseFirstKeeper(suddenDeath, 60_100),
    QuestionPoolExhaustedError
  );
});

test('REMATCH creates a fresh 0-0 match with the same rosters', () => {
  let match = newMatch();
  for (let round = 0; round < 5; round += 1) {
    match = playKick(match, 'goal', 1_000 + round * 10_000);
    match = playKick(match, 'miss', 1_100 + round * 10_000);
  }
  assert.equal(match.phase, 'MATCH_END');

  const rematch = transition(match, { type: 'REMATCH', seed: 999, now: 100_000 });
  assert.equal(rematch.phase, 'SELECT_PLAYERS');
  assert.equal(rematch.teams.A.points, 0);
  assert.equal(rematch.teams.B.points, 0);
  assert.equal(rematch.rounds.length, 1);
  assert.equal(rematch.usedQuestionIds.length, 0);
  assert.equal(rematch.suddenDeath, false);
});

// ---------------------------------------------------------------------------

function run(): void {
  let failures = 0;
  console.log('\n============================================================');
  console.log('PENALTY SHOOTOUT - Pure Engine Test Suite');
  console.log('============================================================\n');

  for (const entry of tests) {
    try {
      entry.fn();
      console.log(`  PASS  ${entry.name}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(`  FAIL  ${entry.name}\n${message}\n`);
    }
  }

  console.log('\n------------------------------------------------------------');
  console.log(`${tests.length - failures}/${tests.length} tests passed`);
  console.log('------------------------------------------------------------\n');

  if (failures > 0) {
    process.exitCode = 1;
  }
}

run();

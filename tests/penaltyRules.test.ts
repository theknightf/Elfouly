/**
 * tests/penaltyRules.test.ts
 *
 * Unit tests for the adapted Penalty Shootout rules:
 * 1. Alternation & Match Structure (5 regulation rounds, 10 kicks, alternating A -> B).
 * 2. Scoring & Kick Mechanics (goal skips goalie, save awards defender, 2 pts possible per round).
 * 3. 50% General questions requirement.
 * 4. Specialty Attributes & Bonus Points (+1 for out-of-specialty, 0 for general or in-specialty).
 * 5. Sudden Death (tie at round 5 triggers sudden death, resolved after both kicks).
 */

import assert from 'node:assert/strict';
import {
  isGeneralCategory,
  calculateBonus,
  getKickingTeamForIndex,
  isRegulationComplete,
  preparePenaltyDeck,
  evaluateSuddenDeathRound,
  resolveAttackerAnswer,
  resolveGoalkeeperDefense,
  type PenaltyQuestion,
  type PlayerAttributesCarrier
} from '../src/utils/penaltyRules';

const tests: { name: string; fn: () => void }[] = [];
function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

// Mock players
const kickerA: PlayerAttributesCarrier = {
  id: 'p1',
  name: 'Faris (Team A)',
  team: 'team_a',
  attributes: ['football_post_2010', 'capitals_and_flags']
};

const goalieB: PlayerAttributesCarrier = {
  id: 'p2',
  name: 'El-Barbakh (Team B)',
  team: 'team_b',
  attributes: ['pc_hardware_gaming', 'series_breaking_bad']
};

const kickerB: PlayerAttributesCarrier = {
  id: 'p3',
  name: 'El-Touny (Team B)',
  team: 'team_b',
  attributes: ['veterinary_biology', 'gelato_sweets']
};

const goalieA: PlayerAttributesCarrier = {
  id: 'p4',
  name: 'Ziad (Team A)',
  team: 'team_a',
  attributes: ['popular_foreign_series']
};

const generalQ: PenaltyQuestion = {
  id: 'q-gen-1',
  category: 'general_knowledge',
  question: 'ما هي عاصمة مصر؟',
  options: ['القاهرة', 'الإسكندرية', 'المنيا', 'أسوان'],
  correct_answer: 'القاهرة'
};

const sportsQ: PenaltyQuestion = {
  id: 'q-sp-1',
  category: 'football_post_2010',
  question: 'من بطل دوري أبطال أوروبا 2015؟',
  options: ['برشلونة', 'يوفنتوس', 'ريال مدريد', 'بايرن ميونخ'],
  correct_answer: 'برشلونة'
};

const gamingQ: PenaltyQuestion = {
  id: 'q-gm-1',
  category: 'pc_hardware_gaming',
  question: 'ما هو كرت الشاشة الأقوى؟',
  options: ['RTX 4090', 'RTX 3060', 'GTX 1050', 'RX 580'],
  correct_answer: 'RTX 4090'
};

const biologyQ: PenaltyQuestion = {
  id: 'q-bio-1',
  category: 'veterinary_biology',
  question: 'ما هو أكبر عضو في جسم الكائن الحي؟',
  options: ['الجلد', 'الكبد', 'القلب', 'الرئة'],
  correct_answer: 'الجلد'
};

// ==================== SECTION 1: MATCH STRUCTURE & ALTERNATION ====================
test('alternation strictly switches between Team A and Team B across all 10 kicks', () => {
  for (let i = 0; i < 10; i++) {
    const expectedTeam = i % 2 === 0 ? 'team_a' : 'team_b';
    assert.equal(getKickingTeamForIndex(i), expectedTeam, `Kick ${i} must belong to ${expectedTeam}`);
  }
});

test('regulation comprises exactly 10 kicks (5 rounds)', () => {
  assert.equal(isRegulationComplete(9), false, 'Kick 9 is not regulation complete');
  assert.equal(isRegulationComplete(10), true, '10 kicks completes regulation');
  assert.equal(isRegulationComplete(12), true, 'Over 10 kicks is complete/in sudden death');
});

// ==================== SECTION 2: KICK MECHANICS & SCORING ====================
test('attacker correct answer results in Goal (+1 point) and skips goalkeeper question', () => {
  const res = resolveAttackerAnswer({
    kickIndex: 0,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    question: sportsQ,
    isCorrect: true
  });

  assert.equal(res.isGoal, true);
  assert.ok(res.outcome);
  assert.equal(res.outcome.outcome, 'goal');
  assert.equal(res.outcome.awardedTeam, 'team_a');
  assert.equal(res.outcome.pointsAwarded, 1);
  assert.equal(res.outcome.goalkeeperQuestion, undefined, 'Goalkeeper question must be skipped on Goal');
});

test('attacker wrong answer opens goalkeeper question; correct defense awards Save (+1 to defender)', () => {
  const attackerRes = resolveAttackerAnswer({
    kickIndex: 0,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    question: sportsQ,
    isCorrect: false
  });

  assert.equal(attackerRes.isGoal, false, 'Goal must not be scored when attacker misses');

  const goalieRes = resolveGoalkeeperDefense({
    kickIndex: 0,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    attackerQuestion: sportsQ,
    goalkeeperQuestion: gamingQ,
    isCorrect: true
  });

  assert.equal(goalieRes.outcome, 'saved');
  assert.equal(goalieRes.awardedTeam, 'team_b', 'Save awards point to defending team');
  assert.equal(goalieRes.pointsAwarded, 1);
});

test('attacker wrong and goalkeeper wrong results in Miss (0 points awarded to either team)', () => {
  const goalieRes = resolveGoalkeeperDefense({
    kickIndex: 0,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    attackerQuestion: sportsQ,
    goalkeeperQuestion: gamingQ,
    isCorrect: false,
    isTimedOut: true
  });

  assert.equal(goalieRes.outcome, 'miss');
  assert.equal(goalieRes.awardedTeam, null);
  assert.equal(goalieRes.pointsAwarded, 0);
});

test('defending team can score during opponent kick (teams can earn 2 points in 1 round)', () => {
  // Kick 0 (Team A attacking): Goalie B saves -> Team B gets 1 pt
  const kick0 = resolveGoalkeeperDefense({
    kickIndex: 0,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    attackerQuestion: sportsQ,
    goalkeeperQuestion: gamingQ,
    isCorrect: true
  });
  assert.equal(kick0.awardedTeam, 'team_b');

  // Kick 1 (Team B attacking): Kicker B scores goal -> Team B gets 1 pt
  const kick1 = resolveAttackerAnswer({
    kickIndex: 1,
    kickingTeam: 'team_b',
    kicker: kickerB,
    goalie: goalieA,
    question: biologyQ,
    isCorrect: true
  });
  assert.equal(kick1.outcome?.awardedTeam, 'team_b');

  // In this single round, Team B earned 2 points (1 on defense + 1 on offense)
  const totalBPoints = kick0.pointsAwarded + (kick1.outcome?.pointsAwarded ?? 0);
  assert.equal(totalBPoints, 2);
});

// ==================== SECTION 3: 50% GENERAL QUESTIONS RULE ====================
test('isGeneralCategory identifies General knowledge categories', () => {
  assert.equal(isGeneralCategory('general'), true);
  assert.equal(isGeneralCategory('general_knowledge'), true);
  assert.equal(isGeneralCategory('معلومات عامة'), true);
  assert.equal(isGeneralCategory('football_post_2010'), false);
  assert.equal(isGeneralCategory('pc_hardware_gaming'), false);
});

test('preparePenaltyDeck guarantees at least 50% General questions in any drawn slice', () => {
  const pool: PenaltyQuestion[] = [
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `gen-${i}`,
      category: 'general_knowledge',
      question: `Gen Q ${i}`,
      options: ['A', 'B'],
      correct_answer: 'A'
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `spec-${i}`,
      category: 'sports',
      question: `Spec Q ${i}`,
      options: ['A', 'B'],
      correct_answer: 'A'
    }))
  ];

  const deck = preparePenaltyDeck(pool, 40);
  assert.equal(deck.length, 40);

  // Check every prefix from 2 to 40
  for (let k = 2; k <= 40; k += 2) {
    const slice = deck.slice(0, k);
    const genCount = slice.filter(q => isGeneralCategory(q.category)).length;
    assert.ok(
      genCount >= k * 0.5,
      `Prefix of length ${k} has ${genCount} General questions, which is less than 50%`
    );
  }
});

// ==================== SECTION 4: SPECIALTY ATTRIBUTES & BONUS POINTS ====================
test('attacker answering in-specialty earns standard points and NO bonus', () => {
  // kickerA has 'football_post_2010' in attributes
  const bonus = calculateBonus(kickerA.attributes, 'football_post_2010', true);
  assert.equal(bonus.bonusAwarded, false);
  assert.equal(bonus.bonusPoints, 0);
});

test('attacker answering out-of-specialty earns +1 BONUS point', () => {
  // kickerA does NOT have 'pc_hardware_gaming' in attributes
  const bonus = calculateBonus(kickerA.attributes, 'pc_hardware_gaming', true);
  assert.equal(bonus.bonusAwarded, true);
  assert.equal(bonus.bonusPoints, 1);
});

test('General questions NEVER earn a bonus, even if answered correctly', () => {
  const bonus1 = calculateBonus(kickerA.attributes, 'general_knowledge', true);
  assert.equal(bonus1.bonusAwarded, false);
  assert.equal(bonus1.bonusPoints, 0);

  const bonus2 = calculateBonus([], 'general', true);
  assert.equal(bonus2.bonusAwarded, false);
  assert.equal(bonus2.bonusPoints, 0);
});

test('wrong answers and timeouts NEVER earn a bonus', () => {
  const bonus = calculateBonus(kickerA.attributes, 'pc_hardware_gaming', false);
  assert.equal(bonus.bonusAwarded, false);
  assert.equal(bonus.bonusPoints, 0);
});

test('goalkeeper answering out-of-specialty earns Save plus +1 BONUS', () => {
  // goalieB does NOT have 'veterinary_biology' in attributes
  const goalieRes = resolveGoalkeeperDefense({
    kickIndex: 0,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    attackerQuestion: sportsQ,
    goalkeeperQuestion: biologyQ,
    isCorrect: true
  });

  assert.equal(goalieRes.outcome, 'saved');
  assert.equal(goalieRes.awardedTeam, 'team_b');
  assert.equal(goalieRes.pointsAwarded, 1);
  assert.equal(goalieRes.bonusAwarded, true);
  assert.equal(goalieRes.bonusPoints, 1);
  assert.equal(goalieRes.bonusPlayerId, goalieB.id);
});

// ==================== SECTION 5: WINNER & SUDDEN DEATH ====================
test('sudden death round ends with winner when one team scores more in that round', () => {
  // Team A scores Goal (1 pt)
  const teamAShot = resolveAttackerAnswer({
    kickIndex: 10,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    question: sportsQ,
    isCorrect: true,
    isSuddenDeath: true,
    suddenDeathRound: 1
  }).outcome!;

  // Team B misses (0 pts)
  const teamBShot = resolveGoalkeeperDefense({
    kickIndex: 11,
    kickingTeam: 'team_b',
    kicker: kickerB,
    goalie: goalieA,
    attackerQuestion: biologyQ,
    goalkeeperQuestion: generalQ,
    isCorrect: false,
    isTimedOut: true,
    isSuddenDeath: true,
    suddenDeathRound: 1
  });

  const evaluation = evaluateSuddenDeathRound(teamAShot, teamBShot);
  assert.equal(evaluation.isDecided, true);
  assert.equal(evaluation.winnerTeam, 'team_a');
  assert.equal(evaluation.roundPointsA, 1);
  assert.equal(evaluation.roundPointsB, 0);
});

test('sudden death round continues if scores in that round remain tied', () => {
  // Both teams score a Goal (1 pt each)
  const teamAShot = resolveAttackerAnswer({
    kickIndex: 10,
    kickingTeam: 'team_a',
    kicker: kickerA,
    goalie: goalieB,
    question: sportsQ,
    isCorrect: true,
    isSuddenDeath: true,
    suddenDeathRound: 1
  }).outcome!;

  const teamBShot = resolveAttackerAnswer({
    kickIndex: 11,
    kickingTeam: 'team_b',
    kicker: kickerB,
    goalie: goalieA,
    question: biologyQ,
    isCorrect: true,
    isSuddenDeath: true,
    suddenDeathRound: 1
  }).outcome!;

  const evaluation = evaluateSuddenDeathRound(teamAShot, teamBShot);
  assert.equal(evaluation.isDecided, false, 'Tied sudden death round must not decide match');
  assert.equal(evaluation.winnerTeam, null);
});

// ==================== RUN SUITE ====================
let passed = 0;
let failed = 0;

console.log('\n================================================================================');
console.log('⚽ QUIZ ARENA - PENALTY SHOOTOUT ADAPTED RULES UNIT TESTS');
console.log('================================================================================\n');

for (const t of tests) {
  try {
    t.fn();
    console.log(`  ✅ PASS: ${t.name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${t.name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

console.log('\n--------------------------------------------------------------------------------');
console.log(`📊 PENALTY RULES SUITE: ${passed}/${tests.length} passed (${failed} failed)`);
console.log('--------------------------------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}

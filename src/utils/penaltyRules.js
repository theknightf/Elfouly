/**
 * src/utils/penaltyRules.js
 *
 * Core domain rules for Round 3 ("حط في قريبي" / "في المقص" - Penalty Shootouts):
 * 1. Match Structure:
 *    - 5 regulation rounds (total 10 kicks, strictly alternating Team A -> Team B).
 *    - All 5 regulation rounds are played even when one team has already clinched.
 * 2. Kick Mechanics:
 *    - Attacker belonging to attacking team faces goalkeeper chosen from defending team.
 *    - Attacker answers question. If correct: Goal! (+1 point), goalkeeper question skipped.
 *    - If attacker misses / times out: Goalkeeper receives a different question.
 *    - If goalkeeper answers correctly: Save! (+1 point for defending team).
 *    - If goalkeeper misses / times out: Miss! (0 points).
 *    - Defending team can score during opponent kick (teams can earn 2 points in 1 full round).
 * 3. Winner & Sudden Death:
 *    - If scores are tied after 5 regulation rounds (10 kicks), match enters Sudden Death.
 *    - Each sudden death round consists of both kicks (Team A kick and Team B kick).
 *    - Match ends only after the full sudden death round if one team scores more in that round.
 *    - Tied sudden-death rounds repeat until a round is won.
 * 4. 50% General Questions Rule:
 *    - At least 50% of questions drawn in the penalty deck must be from the 'general' category.
 * 5. Specialty Attributes & Bonus Point:
 *    - Out-of-specialty correct answer (category not in player's attributes, not general) earns +1 bonus point.
 *    - General questions never earn a bonus.
 *    - In-specialty questions earn normal points (no bonus).
 *    - Wrong answers and timeouts never earn a bonus.
 */

/**
 * Check if category is classified as General
 * @param {string} [category]
 * @returns {boolean}
 */
export function isGeneralCategory(category) {
  if (!category) return false;
  const normalized = String(category).toLowerCase().trim();
  return (
    normalized === 'general' ||
    normalized === 'general_knowledge' ||
    normalized === 'معلومات عامة' ||
    normalized === 'معلومات عامة ومنوعات'
  );
}

/**
 * Determine if a correct answer earns an out-of-specialty bonus point (+1).
 * Rules:
 * - Must be correct.
 * - General questions NEVER earn a bonus.
 * - If category matches player's attributes -> In-specialty, NO bonus.
 * - If category NOT in player's attributes -> Out-of-specialty, +1 bonus!
 * @param {string[]} [playerAttributes]
 * @param {string} questionCategory
 * @param {boolean} isCorrect
 * @returns {{ bonusAwarded: boolean, bonusPoints: number }}
 */
export function calculateBonus(playerAttributes, questionCategory, isCorrect) {
  if (!isCorrect) {
    return { bonusAwarded: false, bonusPoints: 0 };
  }

  if (isGeneralCategory(questionCategory)) {
    return { bonusAwarded: false, bonusPoints: 0 };
  }

  const attrs = (playerAttributes || []).map(a => String(a).toLowerCase().trim());
  const cat = String(questionCategory).toLowerCase().trim();

  const isSpecialty = attrs.includes(cat);
  if (isSpecialty) {
    return { bonusAwarded: false, bonusPoints: 0 };
  }

  // Out of specialty and answered correctly: +1 Bonus Point!
  return { bonusAwarded: true, bonusPoints: 1 };
}

/**
 * Determine kicking team by alternating strictly:
 * kick 0 -> team_a
 * kick 1 -> team_b
 * kick 2 -> team_a
 * kick 3 -> team_b
 * ...
 * @param {number} kickIndex
 * @returns {'team_a' | 'team_b'}
 */
export function getKickingTeamForIndex(kickIndex) {
  return kickIndex % 2 === 0 ? 'team_a' : 'team_b';
}

/**
 * Check if the 5 regulation rounds (10 kicks total) are complete.
 * @param {number} totalKicksPlayed
 * @returns {boolean}
 */
export function isRegulationComplete(totalKicksPlayed) {
  return totalKicksPlayed >= 10;
}

/**
 * Prepare a question deck ensuring that at least 50% of the questions
 * are from the 'general' category across any drawn slice.
 * @param {Array<any>} questions
 * @param {number} [desiredCount=40]
 * @param {() => number} [rng=Math.random]
 * @returns {Array<any>}
 */
export function preparePenaltyDeck(questions, desiredCount = 40, rng = Math.random) {
  const generalQuestions = questions.filter(q => isGeneralCategory(q.category));
  const specialtyQuestions = questions.filter(q => !isGeneralCategory(q.category));

  const shuffledGeneral = [...generalQuestions].sort(() => rng() - 0.5);
  const shuffledSpecialty = [...specialtyQuestions].sort(() => rng() - 0.5);

  const deck = [];
  let gIndex = 0;
  let sIndex = 0;

  for (let i = 0; i < desiredCount; i++) {
    // If every even slot is General, General questions are always >= 50% of any prefix
    const needGeneral = i % 2 === 0 || sIndex >= shuffledSpecialty.length;
    if (needGeneral && gIndex < shuffledGeneral.length) {
      deck.push(shuffledGeneral[gIndex++]);
    } else if (sIndex < shuffledSpecialty.length) {
      deck.push(shuffledSpecialty[sIndex++]);
    } else if (gIndex < shuffledGeneral.length) {
      deck.push(shuffledGeneral[gIndex++]);
    } else {
      break;
    }
  }

  return deck;
}

/**
 * Evaluate the outcome of a full sudden-death round (Team A kick + Team B kick).
 * Match ends only if scores in this round are not tied.
 * @param {any} teamAShot
 * @param {any} teamBShot
 * @returns {{ isDecided: boolean, winnerTeam: 'team_a' | 'team_b' | null, roundPointsA: number, roundPointsB: number }}
 */
export function evaluateSuddenDeathRound(teamAShot, teamBShot) {
  let roundPointsA = 0;
  let roundPointsB = 0;

  if (teamAShot.awardedTeam === 'team_a') roundPointsA += teamAShot.pointsAwarded;
  if (teamAShot.awardedTeam === 'team_b') roundPointsB += teamAShot.pointsAwarded;

  if (teamBShot.awardedTeam === 'team_a') roundPointsA += teamBShot.pointsAwarded;
  if (teamBShot.awardedTeam === 'team_b') roundPointsB += teamBShot.pointsAwarded;

  // Add bonus points if any
  if (teamAShot.bonusAwarded && teamAShot.bonusPlayerId) {
    if (teamAShot.awardedTeam === 'team_a' || teamAShot.kickingTeam === 'team_a') {
      roundPointsA += teamAShot.bonusPoints;
    } else {
      roundPointsB += teamAShot.bonusPoints;
    }
  }
  if (teamBShot.bonusAwarded && teamBShot.bonusPlayerId) {
    if (teamBShot.awardedTeam === 'team_b' || teamBShot.kickingTeam === 'team_b') {
      roundPointsB += teamBShot.bonusPoints;
    } else {
      roundPointsA += teamBShot.bonusPoints;
    }
  }

  if (roundPointsA > roundPointsB) {
    return { isDecided: true, winnerTeam: 'team_a', roundPointsA, roundPointsB };
  } else if (roundPointsB > roundPointsA) {
    return { isDecided: true, winnerTeam: 'team_b', roundPointsA, roundPointsB };
  }

  return { isDecided: false, winnerTeam: null, roundPointsA, roundPointsB };
}

/**
 * Pure transition resolving an attacker's action.
 */
export function resolveAttackerAnswer(params) {
  const {
    kickIndex,
    kickingTeam,
    kicker,
    goalie,
    question,
    isCorrect,
    isTimedOut = false,
    isSuddenDeath = false,
    suddenDeathRound
  } = params;

  const defendingTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';
  const roundNumber = Math.floor(kickIndex / 2) + 1;

  if (isCorrect && !isTimedOut) {
    // Goal scored!
    const { bonusAwarded, bonusPoints } = calculateBonus(kicker.attributes, question.category, true);
    const outcome = {
      kickIndex,
      roundNumber,
      kickingTeam,
      defendingTeam,
      kickerId: kicker.id,
      goalieId: goalie.id,
      isSuddenDeath,
      suddenDeathRound,
      attackerQuestion: question,
      attackerCorrect: true,
      attackerTimedOut: false,
      outcome: 'goal',
      awardedTeam: kickingTeam,
      pointsAwarded: 1,
      bonusAwarded,
      bonusPoints,
      bonusPlayerId: bonusAwarded ? kicker.id : undefined
    };

    return { isGoal: true, outcome };
  }

  // Attacker missed or timed out -> triggers Goalkeeper defense phase
  return { isGoal: false };
}

/**
 * Pure transition resolving a goalkeeper's defense action (when attacker missed).
 */
export function resolveGoalkeeperDefense(params) {
  const {
    kickIndex,
    kickingTeam,
    kicker,
    goalie,
    attackerQuestion,
    goalkeeperQuestion,
    isCorrect,
    isTimedOut = false,
    isSuddenDeath = false,
    suddenDeathRound
  } = params;

  const defendingTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';
  const roundNumber = Math.floor(kickIndex / 2) + 1;

  if (isCorrect && !isTimedOut) {
    // Goalkeeper saved! Defending team scores +1
    const { bonusAwarded, bonusPoints } = calculateBonus(goalie.attributes, goalkeeperQuestion.category, true);
    return {
      kickIndex,
      roundNumber,
      kickingTeam,
      defendingTeam,
      kickerId: kicker.id,
      goalieId: goalie.id,
      isSuddenDeath,
      suddenDeathRound,
      attackerQuestion,
      attackerCorrect: false,
      attackerTimedOut: false,
      goalkeeperQuestion,
      goalkeeperCorrect: true,
      goalkeeperTimedOut: false,
      outcome: 'saved',
      awardedTeam: defendingTeam,
      pointsAwarded: 1,
      bonusAwarded,
      bonusPoints,
      bonusPlayerId: bonusAwarded ? goalie.id : undefined
    };
  }

  // Both missed: 0 points awarded
  return {
    kickIndex,
    roundNumber,
    kickingTeam,
    defendingTeam,
    kickerId: kicker.id,
    goalieId: goalie.id,
    isSuddenDeath,
    suddenDeathRound,
    attackerQuestion,
    attackerCorrect: false,
    attackerTimedOut: false,
    goalkeeperQuestion,
    goalkeeperCorrect: false,
    goalkeeperTimedOut: isTimedOut,
    outcome: 'miss',
    awardedTeam: null,
    pointsAwarded: 0,
    bonusAwarded: false,
    bonusPoints: 0
  };
}

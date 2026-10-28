/**
 * src/game/constants.js
 *
 * Shared constants for the match state machine. Kept framework-free so the
 * exact same rules can run in the browser and in the Node/Socket.IO server.
 */

export const TEAM_A = 'team_a';
export const TEAM_B = 'team_b';
export const TEAMS = [TEAM_A, TEAM_B];

export const ROLES = Object.freeze({
  ANSWERER: 'answerer',
  JUDGE: 'judge',
  BANKER: 'banker',
  SHOOTER: 'shooter'
});

export const PHASES = Object.freeze({
  LOBBY: 'lobby',
  BANK: 'bank',
  PENALTY: 'penalty',
  COMPLETE: 'complete'
});

export const BANK_RULES = Object.freeze({
  ROUNDS: 2,
  QUESTIONS_PER_TEAM: 12,
  QUESTIONS_PER_ROUND: 24,
  TOTAL_QUESTIONS: 48,
  QUESTION_TIME_SECONDS: 30,
  STREAK_LADDER: [0, 100, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 5000]
});

export const PENALTY_RULES = Object.freeze({
  REGULATION_SHOTS: 10,
  SHOTS_PER_TEAM: 5,
  BONUS_POINTS: 1,
  BONUS_SCORE_MULTIPLIER: 500,
  GOAL_SCORE: 1000,
  // The keeper may only press Intercept this many seconds into a shot.
  INTERCEPT_DELAY_SECONDS: 10
});

export const isInterceptUnlocked = (shotStartedAt, now = Date.now()) =>
  !!shotStartedAt && now - shotStartedAt >= PENALTY_RULES.INTERCEPT_DELAY_SECONDS * 1000;

export const ROUND_TIMERS = Object.freeze({
  bankSeconds: BANK_RULES.QUESTION_TIME_SECONDS,
  passwordSeconds: 45,
  penaltySeconds: 20,
  mazatSeconds: 60,
  passwordCards: 6,
  mazatTopics: 4
});

export const ALERT_KINDS = Object.freeze({
  ANSWER_TURN: 'answer_turn',
  JUDGE_ROUND: 'judge_round',
  PENALTY_SHOOTER: 'penalty_shooter',
  PENALTY_JUDGE: 'penalty_judge'
});

export const otherTeam = (team) => (team === TEAM_A ? TEAM_B : TEAM_A);

export const PASSWORD_RULES = Object.freeze({
  MAX_POINTS: 1000,
  MIN_POINTS: 200,
  FOUL_PENALTY: 300,
  CARDS: 6, // 3 per team, clue-givers alternate card by card
  CARDS_PER_TEAM: 3
});

/**
 * Speed-based card score: MAX_POINTS at the start of the card, falling
 * linearly to MIN_POINTS when time runs out. Rounded to the nearest 10.
 */
export const passwordCardPoints = (endTime, totalSeconds, now = Date.now()) => {
  const totalMs = Math.max(1, (totalSeconds || ROUND_TIMERS.passwordSeconds) * 1000);
  const remaining = Math.min(1, Math.max(0, ((endTime || now) - now) / totalMs));
  const { MAX_POINTS, MIN_POINTS } = PASSWORD_RULES;
  return Math.round((MIN_POINTS + (MAX_POINTS - MIN_POINTS) * remaining) / 10) * 10;
};

/** Regulation is over (and no sudden death is running) -> no more kicks. */
export const isShootoutOver = (r3) =>
  !!r3?.isComplete || ((r3?.turnIndex || 0) >= PENALTY_RULES.REGULATION_SHOTS && !r3?.isSuddenDeath);

/**
 * After Round 4: a tie on total score sends the match to one sudden-death
 * penalty each (repeated until the total score differs). Only once per match.
 */
export const needsFinalTieBreak = (teams, status, r3) =>
  status === 'round4' && !r3?.finalTieBreak && (teams?.team_a?.score || 0) === (teams?.team_b?.score || 0);

/**
 * Winner of a finished 2-kick sudden-death pair, or null if still level.
 * Normal shootout: compares the pair (goal = 1, save = 1 for the keeper's team).
 * Final tie-break: the match total score decides, so it can never end level.
 */
export const suddenDeathWinner = ({ lastTwoShots = [], finalTieBreak = false, scoreA = 0, scoreB = 0 }) => {
  if (finalTieBreak) {
    if (scoreA === scoreB) return null;
    return scoreA > scoreB ? 'team_a' : 'team_b';
  }
  const shotA = lastTwoShots.find(s => s.team === 'team_a');
  const shotB = lastTwoShots.find(s => s.team === 'team_b');
  const ptsA = (shotA?.result === 'goal' ? 1 : 0) + (shotB?.result === 'saved' ? 1 : 0);
  const ptsB = (shotB?.result === 'goal' ? 1 : 0) + (shotA?.result === 'saved' ? 1 : 0);
  if (ptsA === ptsB) return null;
  return ptsA > ptsB ? 'team_a' : 'team_b';
};

export const AUCTION_RULES = Object.freeze({
  POINTS_PER_ITEM: 200,
  TRAILING_MULTIPLIER: 2
});

/**
 * Round 4 settlement. Success earns bid x 200, doubled when the winning
 * bidder is strictly behind on total score (a tie doubles nobody). Failure
 * costs bid x 200 (never doubled, never below zero); the rival gains nothing.
 */
export const auctionOutcome = ({ bid, success, winnerScore, rivalScore }) => {
  const base = (bid || 0) * AUCTION_RULES.POINTS_PER_ITEM;
  if (!success) {
    return { delta: -Math.min(base, Math.max(0, winnerScore || 0)), base, multiplier: 1 };
  }
  const multiplier = (winnerScore || 0) < (rivalScore || 0) ? AUCTION_RULES.TRAILING_MULTIPLIER : 1;
  return { delta: base * multiplier, base, multiplier };
};

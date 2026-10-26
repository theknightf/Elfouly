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
  STREAK_LADDER: [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000]
});

export const PENALTY_RULES = Object.freeze({
  REGULATION_SHOTS: 10,
  SHOTS_PER_TEAM: 5,
  BONUS_POINTS: 1,
  BONUS_SCORE_MULTIPLIER: 500,
  GOAL_SCORE: 1000
});

export const ROUND_TIMERS = Object.freeze({
  bankSeconds: BANK_RULES.QUESTION_TIME_SECONDS,
  passwordSeconds: 45,
  penaltySeconds: 20,
  mazatSeconds: 60,
  passwordCards: 5,
  mazatTopics: 4
});

export const ALERT_KINDS = Object.freeze({
  ANSWER_TURN: 'answer_turn',
  JUDGE_ROUND: 'judge_round',
  PENALTY_SHOOTER: 'penalty_shooter',
  PENALTY_JUDGE: 'penalty_judge'
});

export const otherTeam = (team) => (team === TEAM_A ? TEAM_B : TEAM_A);

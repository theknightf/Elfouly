export type TeamId = 'A' | 'B';
export type PlayerId = string;
export type QuestionId = string;

export type MatchPhase =
  | 'MATCH_START'
  | 'ROUND_START'
  | 'SELECT_PLAYERS'
  | 'ATTACKER_QUESTION'
  | 'GOALKEEPER_QUESTION'
  | 'GOAL'
  | 'SAVE'
  | 'MISS'
  | 'NEXT_KICK'
  | 'SUDDEN_DEATH'
  | 'MATCH_END';

export type PhaseResult = 'correct' | 'wrong' | 'timeout';
export type KickOutcome = 'goal' | 'save' | 'miss';
export type MatchDecision = 'regulation' | 'sudden_death';

export interface Player {
  id: PlayerId;
  teamId: TeamId;
  name: string;
  number?: number;
  /** Specialty categories. A correct non-General question outside this list earns a bonus. */
  attributes: string[];
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
  /** Total points, including normal goals/saves and bonus points. */
  points: number;
  /** Bonus points tracked separately from goals/saves. */
  bonusPoints: number;
}

export interface Question {
  id: QuestionId;
  prompt: string;
  options: string[];
  correctIndex: number;
  /** Canonical category. `general` is the non-bonus General category. */
  category: string;
  categoryLabel?: string;
  timeLimitMs?: number;
}

export interface QuestionAttempt {
  questionId: QuestionId;
  phase: 'attacker' | 'goalkeeper';
  startedAt: number;
  deadlineAt: number;
  timeLimitMs: number;
  answeredAt: number | null;
  answerIndex: number | null;
  result: PhaseResult | null;
}

export interface Kick {
  id: string;
  kickIndex: number;
  roundNumber: number;
  indexInRound: 0 | 1;
  isSuddenDeath: boolean;
  attackingTeamId: TeamId;
  defendingTeamId: TeamId;
  attackerId: PlayerId;
  goalkeeperId: PlayerId | null;
  attackerAttempt: QuestionAttempt | null;
  goalkeeperAttempt: QuestionAttempt | null;
  outcome: KickOutcome | null;
  scoredByTeamId: TeamId | null;
  /** The normal goal/save point (0 or 1), excluding the bonus. */
  pointsAwarded: 0 | 1;
  /** A correct out-of-specialty (non-General) answer earns one extra point. */
  bonusAwarded: boolean;
  bonusTeamId: TeamId | null;
  /** Normal point + bonus point: 0, 1 or 2. */
  totalPointsAwarded: 0 | 1 | 2;
  completedAt: number | null;
}

export interface Round {
  number: number;
  isSuddenDeath: boolean;
  kicks: Kick[];
  /** Total points in the round, including bonuses (used by the scoreboard). */
  points: Record<TeamId, number>;
  /** Goal/save points only. Sudden death is decided by these, never by bonuses. */
  outcomePoints: Record<TeamId, number>;
  bonusPoints: Record<TeamId, number>;
}

export interface ActiveQuestion {
  kickId: string;
  phase: 'attacker' | 'goalkeeper';
  question: Question;
  startedAt: number;
  deadlineAt: number;
}

export interface MatchConfig {
  regulationRounds: number;
  questionTimeLimitMs: number;
  minQuestionPool: number;
}

export interface Match {
  id: string;
  config: MatchConfig;
  phase: MatchPhase;

  teams: Record<TeamId, Team>;
  rounds: Round[];

  currentRoundNumber: number;
  currentKickId: string | null;
  activeQuestion: ActiveQuestion | null;

  suddenDeath: boolean;
  questionDeck: Question[];
  usedQuestionIds: QuestionId[];
  questionCursor: number;

  winnerTeamId: TeamId | null;
  decision: MatchDecision | null;
  lastOutcome: KickOutcome | null;

  rngState: number;
  startedAt: number;
  endedAt: number | null;
}

export type MatchEvent =
  | { type: 'START_MATCH'; now: number }
  | { type: 'CHOOSE_GOALKEEPER'; playerId: PlayerId; now: number }
  | { type: 'ANSWER'; optionIndex: number; now: number }
  | { type: 'TIMEOUT'; now: number }
  | { type: 'CONTINUE'; now: number }
  | { type: 'START_SUDDEN_DEATH_ROUND'; now: number }
  | { type: 'REMATCH'; seed: number | string; now: number };

export interface CreateMatchInput {
  id: string;
  teams: {
    A: Pick<Team, 'name' | 'players'>;
    B: Pick<Team, 'name' | 'players'>;
  };
  questions: Question[];
  config?: Partial<MatchConfig>;
  seed: number | string;
  now: number;
}

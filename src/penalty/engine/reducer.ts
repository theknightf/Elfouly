import type {
  ActiveQuestion,
  CreateMatchInput,
  Kick,
  Match,
  MatchConfig,
  MatchDecision,
  MatchEvent,
  MatchPhase,
  Player,
  Question,
  QuestionAttempt,
  Round,
  Team,
  TeamId
} from './types';
import { normalizeSeed, randomInt } from './rng';
import { isGeneralCategory } from './categories';
import { prepareQuestionDeck } from './questions';

const DEFAULT_CONFIG: MatchConfig = {
  regulationRounds: 5,
  questionTimeLimitMs: 15_000,
  minQuestionPool: 20
};

const MAX_AUTO_TRANSITIONS = 32;

export class QuestionPoolExhaustedError extends Error {
  constructor() {
    super('مخزون الأسئلة خلص. المباراة لازم تتوقف بدل تكرار سؤال.');
    this.name = 'QuestionPoolExhaustedError';
  }
}

function cloneMatch(match: Match): Match {
  if (typeof structuredClone === 'function') {
    return structuredClone(match);
  }
  return JSON.parse(JSON.stringify(match)) as Match;
}

function otherTeam(teamId: TeamId): TeamId {
  return teamId === 'A' ? 'B' : 'A';
}

function normalizeTeam(
  input: Pick<Team, 'name' | 'players'>,
  id: TeamId
): Team {
  const name = String(input.name || '').trim();
  if (!name) {
    throw new Error(`اسم الفريق ${id} مطلوب.`);
  }
  if (!Array.isArray(input.players) || input.players.length === 0) {
    throw new Error(`الفريق ${id} لازم يكون فيه لاعب واحد على الأقل.`);
  }

  const players: Player[] = input.players.map((player, index) => {
    const playerName = String(player.name || '').trim();
    if (!playerName) {
      throw new Error(`اسم اللاعب رقم ${index + 1} في الفريق ${id} مطلوب.`);
    }
    return {
      id: String(player.id || `${id.toLowerCase()}-${index + 1}`),
      teamId: id,
      name: playerName,
      number: player.number,
      attributes: Array.isArray(player.attributes)
        ? Array.from(
            new Set(
              player.attributes
                .map(attribute => String(attribute || '').trim().toLowerCase())
                .filter(Boolean)
            )
          )
        : []
    };
  });

  return { id, name, players, points: 0, bonusPoints: 0 };
}

function validateConfig(config: MatchConfig): void {
  if (!Number.isInteger(config.regulationRounds) || config.regulationRounds < 1) {
    throw new Error('عدد جولات المباراة لازم يكون رقم صحيح أكبر من صفر.');
  }
  if (!Number.isFinite(config.questionTimeLimitMs) || config.questionTimeLimitMs <= 0) {
    throw new Error('مدة السؤال لازم تكون أكبر من صفر.');
  }
  if (!Number.isInteger(config.minQuestionPool) || config.minQuestionPool < 1) {
    throw new Error('الحد الأدنى لمخزون الأسئلة غير صالح.');
  }
}

function validatePlayerIds(teams: Record<TeamId, Team>): void {
  const seen = new Set<string>();
  for (const team of [teams.A, teams.B]) {
    for (const player of team.players) {
      if (seen.has(player.id)) {
        throw new Error(`معرّف اللاعب ${player.id} مكرر بين الفريقين.`);
      }
      seen.add(player.id);
    }
  }
}

export function createMatch(input: CreateMatchInput): Match {
  const config: MatchConfig = {
    ...DEFAULT_CONFIG,
    ...(input.config || {})
  };
  validateConfig(config);

  const teamA = normalizeTeam(input.teams.A, 'A');
  const teamB = normalizeTeam(input.teams.B, 'B');
  const teams = { A: teamA, B: teamB };
  validatePlayerIds(teams);

  const { deck, rngState } = prepareQuestionDeck(
    input.questions,
    normalizeSeed(input.seed)
  );

  const requiredForRegulation = config.regulationRounds * 2;
  if (deck.length < requiredForRegulation) {
    throw new Error(
      `مخزون الأسئلة لا يكفي مع قاعدة 50% أسئلة عامة: محتاج ${requiredForRegulation} سؤال على الأقل للمباراة.`
    );
  }
  if (deck.length < config.minQuestionPool) {
    throw new Error(
      `مخزون الأسئلة لا يكفي: محتاج ${config.minQuestionPool} سؤال على الأقل.`
    );
  }

  const generalCountInDeck = deck.filter(question =>
    isGeneralCategory(question.category)
  ).length;
  if (generalCountInDeck * 2 < requiredForRegulation) {
    throw new Error(
      'مخزون الأسئلة لا يحقق قاعدة 50% أسئلة عامة. أضف أسئلة عامة للمخزون.'
    );
  }

  return {
    id: input.id,
    config,
    phase: 'MATCH_START',
    teams,
    rounds: [],
    currentRoundNumber: 0,
    currentKickId: null,
    activeQuestion: null,
    suddenDeath: false,
    questionDeck: deck,
    usedQuestionIds: [],
    questionCursor: 0,
    winnerTeamId: null,
    decision: null,
    lastOutcome: null,
    rngState,
    startedAt: 0,
    endedAt: null
  };
}

function currentRound(match: Match): Round {
  const round = match.rounds[match.rounds.length - 1];
  if (!round) {
    throw new Error('مفيش جولة حالية.');
  }
  return round;
}

function currentKick(match: Match): Kick {
  const kick = match.rounds
    .flatMap(round => round.kicks)
    .find(entry => entry.id === match.currentKickId);
  if (!kick) {
    throw new Error('مفيش ركلة حالية.');
  }
  return kick;
}

function pickAttacker(match: Match, teamId: TeamId): Player {
  const team = match.teams[teamId];
  if (!team.players.length) {
    throw new Error(`الفريق ${teamId} ليس فيه لاعبين.`);
  }
  const picked = randomInt(match.rngState, team.players.length);
  match.rngState = picked.state;
  return team.players[picked.value];
}

function kickCount(match: Match): number {
  return match.rounds.reduce((total, round) => total + round.kicks.length, 0);
}

function buildKick(
  match: Match,
  round: Round,
  indexInRound: 0 | 1,
  now: number
): Kick {
  const attackingTeamId: TeamId = indexInRound === 0 ? 'A' : 'B';
  const defendingTeamId = otherTeam(attackingTeamId);
  const attacker = pickAttacker(match, attackingTeamId);
  const ordinal = kickCount(match) + 1;

  return {
    id: `kick-${ordinal}`,
    kickIndex: ordinal - 1,
    roundNumber: round.number,
    indexInRound,
    isSuddenDeath: round.isSuddenDeath,
    attackingTeamId,
    defendingTeamId,
    attackerId: attacker.id,
    goalkeeperId: null,
    attackerAttempt: null,
    goalkeeperAttempt: null,
    outcome: null,
    scoredByTeamId: null,
    pointsAwarded: 0,
    bonusAwarded: false,
    bonusTeamId: null,
    totalPointsAwarded: 0,
    completedAt: null
  };
}

function beginKick(
  match: Match,
  round: Round,
  indexInRound: 0 | 1,
  _now: number
): void {
  const kick = buildKick(match, round, indexInRound, _now);
  round.kicks.push(kick);
  match.currentKickId = kick.id;
  match.lastOutcome = null;
  match.activeQuestion = null;
  match.phase = 'SELECT_PLAYERS';
}

function beginRound(match: Match, now: number): void {
  const number = match.rounds.length + 1;
  const round: Round = {
    number,
    isSuddenDeath: match.suddenDeath,
    kicks: [],
    points: { A: 0, B: 0 },
    outcomePoints: { A: 0, B: 0 },
    bonusPoints: { A: 0, B: 0 }
  };

  match.rounds.push(round);
  match.currentRoundNumber = number;
  beginKick(match, round, 0, now);
}

function startQuestion(
  match: Match,
  phase: 'attacker' | 'goalkeeper',
  now: number
): void {
  const kick = currentKick(match);

  if (match.questionCursor >= match.questionDeck.length) {
    throw new QuestionPoolExhaustedError();
  }

  const question = match.questionDeck[match.questionCursor];
  match.questionCursor += 1;
  match.usedQuestionIds.push(question.id);

  const limit = question.timeLimitMs ?? match.config.questionTimeLimitMs;
  const startedAt = now;
  const deadlineAt = startedAt + limit;

  const attempt: QuestionAttempt = {
    questionId: question.id,
    phase,
    startedAt,
    deadlineAt,
    timeLimitMs: limit,
    answeredAt: null,
    answerIndex: null,
    result: null
  };

  if (phase === 'attacker') {
    kick.attackerAttempt = attempt;
  } else {
    kick.goalkeeperAttempt = attempt;
  }

  const active: ActiveQuestion = {
    kickId: kick.id,
    phase,
    question,
    startedAt,
    deadlineAt
  };

  match.activeQuestion = active;
  match.lastOutcome = null;
  match.phase = phase === 'attacker' ? 'ATTACKER_QUESTION' : 'GOALKEEPER_QUESTION';
}

function completeKick(
  match: Match,
  kick: Kick,
  outcome: 'goal' | 'save' | 'miss',
  scoredByTeamId: TeamId | null,
  now: number,
  bonusTeamId: TeamId | null = null
): void {
  const validBonusTeamId =
    scoredByTeamId && bonusTeamId === scoredByTeamId ? bonusTeamId : null;

  kick.outcome = outcome;
  kick.scoredByTeamId = scoredByTeamId;
  kick.pointsAwarded = scoredByTeamId ? 1 : 0;
  kick.bonusAwarded = Boolean(validBonusTeamId);
  kick.bonusTeamId = validBonusTeamId;
  kick.totalPointsAwarded = (kick.pointsAwarded +
    (validBonusTeamId ? 1 : 0)) as 0 | 1 | 2;
  kick.completedAt = now;

  if (scoredByTeamId) {
    match.teams[scoredByTeamId].points += 1;
    currentRound(match).points[scoredByTeamId] += 1;
    currentRound(match).outcomePoints[scoredByTeamId] += 1;
  }

  if (validBonusTeamId) {
    match.teams[validBonusTeamId].points += 1;
    match.teams[validBonusTeamId].bonusPoints += 1;
    currentRound(match).points[validBonusTeamId] += 1;
    currentRound(match).bonusPoints[validBonusTeamId] += 1;
  }

  match.activeQuestion = null;
  match.lastOutcome = outcome;
  match.phase = outcome === 'goal' ? 'GOAL' : outcome === 'save' ? 'SAVE' : 'MISS';
}

function bonusTeamForCorrectAnswer(
  match: Match,
  kick: Kick,
  phase: 'attacker' | 'goalkeeper',
  category: string | undefined
): TeamId | null {
  if (isGeneralCategory(category)) {
    return null;
  }

  const playerId = phase === 'attacker' ? kick.attackerId : kick.goalkeeperId;
  if (!playerId) {
    return null;
  }

  const team =
    phase === 'attacker'
      ? match.teams[kick.attackingTeamId]
      : match.teams[kick.defendingTeamId];
  const player = team.players.find(entry => entry.id === playerId);

  if (!player) {
    return null;
  }

  const categoryId = String(category).trim().toLowerCase();
  return player.attributes.includes(categoryId) ? null : player.teamId;
}

function resolveTimeout(match: Match, now: number): void {
  const active = match.activeQuestion;
  if (!active) {
    return;
  }  const kick = currentKick(match);
  const attempt =
    active.phase === 'attacker'
      ? kick.attackerAttempt
      : kick.goalkeeperAttempt;

  if (!attempt) {
    return;
  }

  attempt.result = 'timeout';
  attempt.answeredAt = now;
  attempt.answerIndex = null;
  match.activeQuestion = null;

  if (active.phase === 'attacker') {
    startQuestion(match, 'goalkeeper', now);
    return;
  }

  completeKick(match, kick, 'miss', null, now);
}

function resolveAnswer(
  match: Match,
  optionIndex: number,
  now: number
): void {
  const active = match.activeQuestion;
  if (!active) {
    return;
  }
  if (now >= active.deadlineAt) {
    resolveTimeout(match, now);
    return;
  }
  if (
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    optionIndex >= active.question.options.length
  ) {
    return;
  }

  const kick = currentKick(match);
  const attempt =
    active.phase === 'attacker'
      ? kick.attackerAttempt
      : kick.goalkeeperAttempt;

  if (!attempt) {
    return;
  }

  const correct = optionIndex === active.question.correctIndex;
  attempt.result = correct ? 'correct' : 'wrong';
  attempt.answeredAt = now;
  attempt.answerIndex = optionIndex;
  match.activeQuestion = null;

  if (active.phase === 'attacker') {
    if (correct) {
      const bonusTeamId = bonusTeamForCorrectAnswer(
        match,
        kick,
        'attacker',
        active.question.category
      );
      completeKick(
        match,
        kick,
        'goal',
        kick.attackingTeamId,
        now,
        bonusTeamId
      );
      return;
    }
    startQuestion(match, 'goalkeeper', now);
    return;
  }

  if (correct) {
    const bonusTeamId = bonusTeamForCorrectAnswer(
      match,
      kick,
      'goalkeeper',
      active.question.category
    );
    completeKick(
      match,
      kick,
      'save',
      kick.defendingTeamId,
      now,
      bonusTeamId
    );
    return;
  }

  completeKick(match, kick, 'miss', null, now);
}

function endMatch(
  match: Match,
  decision: MatchDecision,
  now: number,
  winnerOverride: TeamId | null | undefined = undefined
): void {
  const { A, B } = match.teams;
  match.winnerTeamId =
    winnerOverride !== undefined
      ? winnerOverride
      : A.points > B.points
        ? 'A'
        : B.points > A.points
          ? 'B'
          : null;
  match.decision = decision;
  match.phase = 'MATCH_END';
  match.activeQuestion = null;
  match.endedAt = now;
}

function routeNextKick(match: Match, now: number): void {
  const round = currentRound(match);
  const kick = round.kicks[round.kicks.length - 1];

  if (!kick || kick.outcome === null) {
    throw new Error('مش ممكن ننتقل لركلة جديدة قبل ما الركلة الحالية تخلص.');
  }

  // The first kick of a round is A's. After it, B shoots in the same round.
  if (kick.indexInRound === 0) {
    beginKick(match, round, 1, now);
    return;
  }

  if (!match.suddenDeath) {
    if (round.number < match.config.regulationRounds) {
      match.phase = 'ROUND_START';
      return;
    }

    if (match.teams.A.points !== match.teams.B.points) {
      const winner: TeamId =
        match.teams.A.points > match.teams.B.points ? 'A' : 'B';
      endMatch(match, 'regulation', now, winner);
      return;
    }

    match.suddenDeath = true;
    match.phase = 'SUDDEN_DEATH';
    return;
  }

  // A sudden-death round is decided by goal/save points only. Bonus points
  // are tracked in round.points but must never decide a sudden-death round.
  if (round.outcomePoints.A !== round.outcomePoints.B) {
    const winner: TeamId = round.outcomePoints.A > round.outcomePoints.B ? 'A' : 'B';
    endMatch(match, 'sudden_death', now, winner);
    return;
  }

  match.phase = 'SUDDEN_DEATH';
}

function advanceAutomaticStates(match: Match, now: number): void {
  for (let step = 0; step < MAX_AUTO_TRANSITIONS; step += 1) {
    if (match.phase === 'ROUND_START') {
      beginRound(match, now);
      return;
    }
    if (match.phase === 'NEXT_KICK') {
      routeNextKick(match, now);
      continue;
    }
    return;
  }

  throw new Error('حلقة انتقالات غير متوقعة في محرك اللعبة.');
}

function startNewMatchFrom(match: Match, seed: number | string, now: number): Match {
  const fresh = createMatch({
    id: `${match.id}-rematch`,
    teams: {
      A: { name: match.teams.A.name, players: match.teams.A.players },
      B: { name: match.teams.B.name, players: match.teams.B.players }
    },
    questions: match.questionDeck,
    config: match.config,
    seed,
    now
  });
  return transition(fresh, { type: 'START_MATCH', now });
}

export function transition(match: Match, event: MatchEvent): Match {
  switch (event.type) {
    case 'START_MATCH': {
      if (match.phase !== 'MATCH_START') {
        return match;
      }
      const draft = cloneMatch(match);
      draft.startedAt = event.now;
      draft.phase = 'ROUND_START';
      advanceAutomaticStates(draft, event.now);
      return draft;
    }

    case 'CHOOSE_GOALKEEPER': {
      if (match.phase !== 'SELECT_PLAYERS') {
        return match;
      }
      const draft = cloneMatch(match);
      const kick = currentKick(draft);
      const defendingTeam = draft.teams[kick.defendingTeamId];
      const goalkeeper = defendingTeam.players.find(
        player => player.id === event.playerId
      );

      if (!goalkeeper || kick.goalkeeperId) {
        return match;
      }

      kick.goalkeeperId = goalkeeper.id;
      startQuestion(draft, 'attacker', event.now);
      return draft;
    }

    case 'ANSWER': {
      if (
        match.phase !== 'ATTACKER_QUESTION' &&
        match.phase !== 'GOALKEEPER_QUESTION'
      ) {
        return match;
      }
      const draft = cloneMatch(match);
      resolveAnswer(draft, event.optionIndex, event.now);
      return draft;
    }

    case 'TIMEOUT': {
      if (
        match.phase !== 'ATTACKER_QUESTION' &&
        match.phase !== 'GOALKEEPER_QUESTION'
      ) {
        return match;
      }
      if (!match.activeQuestion || event.now < match.activeQuestion.deadlineAt) {
        return match;
      }
      const draft = cloneMatch(match);
      resolveTimeout(draft, event.now);
      return draft;
    }

    case 'CONTINUE': {
      if (
        match.phase !== 'GOAL' &&
        match.phase !== 'SAVE' &&
        match.phase !== 'MISS'
      ) {
        return match;
      }
      const draft = cloneMatch(match);
      draft.phase = 'NEXT_KICK';
      advanceAutomaticStates(draft, event.now);
      return draft;
    }

    case 'START_SUDDEN_DEATH_ROUND': {
      if (match.phase !== 'SUDDEN_DEATH') {
        return match;
      }
      const draft = cloneMatch(match);
      draft.phase = 'ROUND_START';
      advanceAutomaticStates(draft, event.now);
      return draft;
    }

    case 'REMATCH': {
      if (match.phase !== 'MATCH_END') {
        return match;
      }
      return startNewMatchFrom(match, event.seed, event.now);
    }

    default:
      return match;
  }
}

export function isQuestionPhase(phase: MatchPhase): boolean {
  return phase === 'ATTACKER_QUESTION' || phase === 'GOALKEEPER_QUESTION';
}

export function isResultPhase(phase: MatchPhase): boolean {
  return phase === 'GOAL' || phase === 'SAVE' || phase === 'MISS';
}

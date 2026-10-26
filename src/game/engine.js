/**
 * src/game/engine.js
 *
 * Pure, framework-free rules engine for Quiz Arena.
 *
 * The engine is the single source of truth for the four mechanics that are
 * shared by every transport (Socket.IO server, Supabase provider and the
 * offline/local client):
 *
 *   1. Lobby  - players join, pick a team and pick any character. Character
 *               selection is deliberately NON-EXCLUSIVE.
 *   2. Roles  - exactly one judge per active session. The judge never answers,
 *               and every question change produces blocking role alerts.
 *   3. Bank   - two bank rounds x (12 questions per team) = 48 questions.
 *               Members of the answering team alternate strictly question by
 *               question. ONLY the opposing team may press Bank / Continue.
 *   4. Penalty- alternating 5-kick shootout, random category, a team
 *               representative picks the shooter, one judge records Goal or
 *               Miss, and an out-of-specialty goal awards a bonus point.
 *
 * Reduce with `reduce(state, action)`. It returns
 * `{ state, events, error }` and never mutates the input state.
 */

import { calculateBonus, isGeneralCategory } from '../utils/penaltyRules.js';
import {
  BANK_RULES,
  PENALTY_RULES,
  PHASES,
  TEAM_A,
  TEAM_B,
  TEAMS,
  otherTeam
} from './constants.js';

const MAX_PLAYERS = 4;
const MAX_TEAM_PLAYERS = 2;

const DEFAULT_CATEGORIES = [
  { id: 'general_knowledge', name: 'General Knowledge' }
];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function clone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON cloning for non-cloneable values.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizePlayer(player) {
  if (!player || !player.id) return null;
  const character = player.character || null;
  const attributes = player.attributes
    || character?.attributes
    || (Array.isArray(player.characterAttributes) ? player.characterAttributes : []);
  return {
    ...player,
    name: String(player.name || 'Player').slice(0, 24),
    team: player.team === TEAM_B ? TEAM_B : TEAM_A,
    characterId: player.characterId || character?.id || null,
    attributes: Array.isArray(attributes) ? [...attributes] : [],
    connected: player.connected !== false,
    isHost: !!player.isHost
  };
}

function normalizeQuestion(question) {
  if (!question) return null;
  return {
    ...question,
    id: question.id || question.questionId || null
  };
}

function playersOf(state, team) {
  return state.players.filter(player => player.team === team);
}

function findPlayer(state, playerId) {
  return state.players.find(player => player.id === playerId) || null;
}

function getQuestionCategoryId(question, fallback) {
  if (!question) return fallback?.id || fallback || null;
  return question.categoryId
    || question.category
    || question.categoryName
    || fallback?.id
    || fallback
    || null;
}

function pickFirstAvailable(players) {
  return players.find(player => player.connected) || players[0] || null;
}

function pickRandomCategory(categories = DEFAULT_CATEGORIES, rng = Math.random) {
  const pool = Array.isArray(categories) && categories.length > 0
    ? categories
    : DEFAULT_CATEGORIES;
  return pool[Math.floor(rng() * pool.length)] || pool[0];
}

function createTeams() {
  return {
    [TEAM_A]: { id: TEAM_A, score: 0, bank: 0, penaltyScore: 0, bonusPoints: 0 },
    [TEAM_B]: { id: TEAM_B, score: 0, bank: 0, penaltyScore: 0, bonusPoints: 0 }
  };
}

function createBankState() {
  return {
    segmentIndex: 0,
    rounds: BANK_RULES.ROUNDS,
    questionsPerTeam: BANK_RULES.QUESTIONS_PER_TEAM,
    totalQuestions: BANK_RULES.TOTAL_QUESTIONS,
    questionInTeamTurn: 0,
    totalAnswered: 0,
    activeTeam: TEAM_A,
    answererId: null,
    judgeId: null,
    pendingPoints: 0,
    streak: 0,
    streakLadder: [...BANK_RULES.STREAK_LADDER],
    currentQuestion: null,
    currentQuestionIndex: 0,
    bankControllerTeam: TEAM_B,
    lastDecision: null,
    alertNonce: 0,
    history: [],
    isComplete: false
  };
}

function createPenaltyState() {
  return {
    turnIndex: 0,
    regulationShots: PENALTY_RULES.REGULATION_SHOTS,
    activeTeam: TEAM_A,
    judgeId: null,
    shooterId: null,
    representatives: { [TEAM_A]: null, [TEAM_B]: null },
    category: null,
    categories: [...DEFAULT_CATEGORIES],
    currentQuestion: null,
    phase: 'idle',
    shots: [],
    score: { [TEAM_A]: 0, [TEAM_B]: 0 },
    bonusPoints: { [TEAM_A]: 0, [TEAM_B]: 0 },
    suddenDeath: false,
    suddenDeathRound: 0,
    alertNonce: 0,
    isComplete: false
  };
}

/* ------------------------------------------------------------------ */
/* Public state factory                                                */
/* ------------------------------------------------------------------ */

export function createGameState({ players = [], hostId = null } = {}) {
  return {
    phase: PHASES.LOBBY,
    hostId: hostId || players[0]?.id || null,
    players: players.map(normalizePlayer).filter(Boolean).slice(0, MAX_PLAYERS),
    teams: createTeams(),
    judgeId: null,
    bank: createBankState(),
    penalty: createPenaltyState(),
    acknowledgedAlerts: [],
    lastError: null,
    version: 0
  };
}

/* ------------------------------------------------------------------ */
/* Lobby transitions                                                   */
/* ------------------------------------------------------------------ */

function lobbyJoin(state, { player }) {
  const normalized = normalizePlayer(player);
  if (!normalized) return { error: 'invalid_player' };
  if (state.players.some(existing => existing.id === normalized.id)) {
    return { error: 'player_already_joined' };
  }
  if (state.players.length >= MAX_PLAYERS) {
    return { error: 'room_full' };
  }
  if (playersOf(state, normalized.team).length >= MAX_TEAM_PLAYERS) {
    normalized.team = otherTeam(normalized.team);
  }
  const next = clone(state);
  next.players.push(normalized);
  next.hostId = next.hostId || normalized.id;
  return { state: next, events: [{ type: 'player_joined', playerId: normalized.id }] };
}

/**
 * Character selection is NON-EXCLUSIVE: multiple players may use the exact
 * same character. Only ownership of the player record is checked.
 */
function lobbySelectCharacter(state, { playerId, character }) {
  const player = findPlayer(state, playerId);
  if (!player) return { error: 'player_not_found' };
  if (!character?.id) return { error: 'invalid_character' };
  const next = clone(state);
  const target = findPlayer(next, playerId);
  target.character = { ...character };
  target.characterId = character.id;
  target.attributes = Array.isArray(character.attributes) ? [...character.attributes] : target.attributes;
  return { state: next, events: [{ type: 'character_selected', playerId, characterId: character.id }] };
}

function lobbySelectTeam(state, { playerId, team }) {
  if (!TEAMS.includes(team)) return { error: 'invalid_team' };
  const player = findPlayer(state, playerId);
  if (!player) return { error: 'player_not_found' };
  if (player.team === team) return { state };
  const targetTeamCount = playersOf(state, team).length;
  if (targetTeamCount >= MAX_TEAM_PLAYERS) return { error: 'team_full' };
  const next = clone(state);
  findPlayer(next, playerId).team = team;
  return { state: next, events: [{ type: 'team_selected', playerId, team }] };
}

function lobbyUpdateTeamNames(state, { names }) {
  if (!names || typeof names !== 'object') return { error: 'invalid_names' };
  const next = clone(state);
  if (names[TEAM_A]) next.teams[TEAM_A].name = String(names[TEAM_A]).slice(0, 30);
  if (names[TEAM_B]) next.teams[TEAM_B].name = String(names[TEAM_B]).slice(0, 30);
  return { state: next, events: [{ type: 'team_names_updated', names }] };
}

function lobbyReassignPlayerTeam(state, { playerId, team }) {
  if (!TEAMS.includes(team)) return { error: 'invalid_team' };
  const player = findPlayer(state, playerId);
  if (!player) return { error: 'player_not_found' };
  if (player.team === team) return { state };
  const targetTeamCount = playersOf(state, team).length;
  if (targetTeamCount >= MAX_TEAM_PLAYERS) return { error: 'team_full' };
  const next = clone(state);
  findPlayer(next, playerId).team = team;
  return { state: next, events: [{ type: 'player_reassigned', playerId, team }] };
}

function lobbyReorderTeamPlayers(state, { team, fromIndex, toIndex }) {
  if (!TEAMS.includes(team)) return { error: 'invalid_team' };
  const next = clone(state);
  const teamPlayerIndices = [];
  next.players.forEach((p, idx) => {
    if (p.team === team) teamPlayerIndices.push(idx);
  });
  if (fromIndex < 0 || fromIndex >= teamPlayerIndices.length || toIndex < 0 || toIndex >= teamPlayerIndices.length) {
    return { error: 'invalid_indices' };
  }
  const idxA = teamPlayerIndices[fromIndex];
  const idxB = teamPlayerIndices[toIndex];
  const temp = next.players[idxA];
  next.players[idxA] = next.players[idxB];
  next.players[idxB] = temp;
  return { state: next, events: [{ type: 'team_reordered', team }] };
}

function lobbySwapTeams(state) {
  const next = clone(state);
  next.players.forEach(p => {
    p.team = otherTeam(p.team);
  });
  return { state: next, events: [{ type: 'teams_swapped' }] };
}

function lobbySetJudge(state, { judgeId }) {
  const player = findPlayer(state, judgeId);
  if (!player && judgeId !== null) return { error: 'player_not_found' };
  const next = clone(state);
  next.judgeId = judgeId;
  return { state: next, events: [{ type: 'judge_set', judgeId }] };
}


/* ------------------------------------------------------------------ */
/* Bank round transitions                                              */
/* ------------------------------------------------------------------ */

function pickBankJudge(state, activeTeam, excludeIds = []) {
  const defending = playersOf(state, otherTeam(activeTeam))
    .filter(player => !excludeIds.includes(player.id));
  const candidate = pickFirstAvailable(defending)
    || pickFirstAvailable(state.players.filter(player => !excludeIds.includes(player.id)));
  return candidate?.id || null;
}

function firstAnswerer(state, activeTeam, judgeId) {
  return pickFirstAvailable(
    playersOf(state, activeTeam).filter(player => player.id !== judgeId)
  )?.id || null;
}

function startBank(state) {
  const next = clone(state);
  next.phase = PHASES.BANK;
  next.bank = {
    ...createBankState(),
    activeTeam: TEAM_A,
    bankControllerTeam: TEAM_B
  };
  next.bank.judgeId = pickBankJudge(next, next.bank.activeTeam);
  next.bank.answererId = firstAnswerer(next, next.bank.activeTeam, next.bank.judgeId);
  next.judgeId = next.bank.judgeId;
  return {
    state: next,
    events: [
      { type: 'bank_started' },
      { type: 'question_required', round: 'bank' },
      {
        type: 'role_alerts_required',
        answererId: next.bank.answererId,
        judgeId: next.bank.judgeId
      }
    ]
  };
}

function bankPresentQuestion(state, { question }) {
  const normalized = normalizeQuestion(question);
  if (!normalized) return { error: 'invalid_question' };
  if (state.phase !== PHASES.BANK || state.bank.isComplete) {
    return { error: 'bank_inactive' };
  }
  if (state.bank.currentQuestion) return { error: 'question_already_active' };

  const next = clone(state);
  const bank = next.bank;
  bank.currentQuestion = normalized;
  bank.currentQuestionIndex += 1;
  bank.alertNonce += 1;
  return {
    state: next,
    events: [
      {
        type: 'question_revealed',
        round: 'bank',
        questionId: normalized.id,
        answererId: bank.answererId,
        judgeId: bank.judgeId
      }
    ]
  };
}

function rotateBankAnswerer(state) {
  const bank = state.bank;
  const eligible = playersOf(state, bank.activeTeam)
    .filter(player => player.id !== bank.judgeId);
  if (eligible.length === 0) {
    bank.answererId = null;
    return;
  }
  const index = eligible.findIndex(player => player.id === bank.answererId);
  bank.answererId = eligible[(index + 1) % eligible.length].id;
}

function bankGrade(state, { correct }) {
  if (state.phase !== PHASES.BANK || !state.bank.currentQuestion) {
    return { error: 'no_active_bank_question' };
  }

  const next = clone(state);
  const bank = next.bank;
  const events = [];

  if (correct) {
    bank.streak = Math.min(bank.streak + 1, bank.streakLadder.length - 1);
    bank.pendingPoints = bank.streakLadder[bank.streak];
    events.push({ type: 'bank_correct', streak: bank.streak, pendingPoints: bank.pendingPoints });
  } else {
    bank.streak = 0;
    bank.pendingPoints = 0;
    events.push({ type: 'bank_wrong' });
  }

  bank.history.push({
    questionId: bank.currentQuestion.id,
    answererId: bank.answererId,
    team: bank.activeTeam,
    correct: !!correct,
    pendingPoints: bank.pendingPoints,
    at: bank.totalAnswered
  });

  bank.currentQuestion = null;
  bank.totalAnswered += 1;
  bank.questionInTeamTurn += 1;
  bank.lastDecision = null;

  if (bank.totalAnswered >= bank.totalQuestions) {
    if (bank.pendingPoints > 0) {
      next.teams[bank.activeTeam].bank += bank.pendingPoints;
      next.teams[bank.activeTeam].score += bank.pendingPoints;
      events.push({
        type: 'auto_banked',
        team: bank.activeTeam,
        amount: bank.pendingPoints
      });
      bank.pendingPoints = 0;
    }
    bank.isComplete = true;
    bank.judgeId = null;
    next.phase = PHASES.COMPLETE;
    next.judgeId = null;
    events.push({ type: 'bank_completed' });
    return { state: next, events };
  }

  if (bank.questionInTeamTurn >= bank.questionsPerTeam) {
    // End of this team's 12 questions. Lock in whatever is still on the line
    // so points are never silently lost when the turn changes.
    if (bank.pendingPoints > 0) {
      next.teams[bank.activeTeam].bank += bank.pendingPoints;
      next.teams[bank.activeTeam].score += bank.pendingPoints;
      events.push({
        type: 'auto_banked',
        team: bank.activeTeam,
        amount: bank.pendingPoints
      });
    }

    bank.segmentIndex += 1;
    bank.questionInTeamTurn = 0;
    bank.pendingPoints = 0;
    bank.streak = 0;
    bank.activeTeam = bank.segmentIndex % 2 === 0 ? TEAM_A : TEAM_B;
    bank.bankControllerTeam = otherTeam(bank.activeTeam);
    bank.judgeId = pickBankJudge(next, bank.activeTeam);
    bank.answererId = firstAnswerer(next, bank.activeTeam, bank.judgeId);
    bank.alertNonce += 1;
    next.judgeId = bank.judgeId;

    events.push({
      type: 'team_turn_changed',
      activeTeam: bank.activeTeam,
      answererId: bank.answererId,
      judgeId: bank.judgeId
    });
    events.push({ type: 'question_required', round: 'bank' });
    events.push({
      type: 'role_alerts_required',
      answererId: bank.answererId,
      judgeId: bank.judgeId
    });
    return { state: next, events };
  }

  // Strict within-team alternation: every single question rotates the
  // answering player (P1 -> P2 -> P1 -> P2 ...).
  rotateBankAnswerer(next);
  bank.alertNonce += 1;
  events.push({
    type: 'answerer_changed',
    activeTeam: bank.activeTeam,
    answererId: bank.answererId,
    judgeId: bank.judgeId
  });
  events.push({ type: 'question_required', round: 'bank' });
  events.push({
    type: 'role_alerts_required',
    answererId: bank.answererId,
    judgeId: bank.judgeId
  });
  return { state: next, events };
}

/**
 * The Bank / Continue decision belongs ONLY to the opposing team. The active
 * answering player (and every member of the answering team) is rejected.
 */
function bankPress(state, { playerId, decision }) {
  if (state.phase !== PHASES.BANK || state.bank.isComplete) {
    return { error: 'bank_inactive' };
  }
  if (decision !== 'bank' && decision !== 'continue') {
    return { error: 'invalid_decision' };
  }

  const player = findPlayer(state, playerId);
  if (!player) return { error: 'player_not_found' };

  const bank = state.bank;
  if (player.team !== bank.bankControllerTeam || player.team === bank.activeTeam) {
    return { error: 'bank_decision_forbidden' };
  }
  if (player.id === bank.answererId) {
    return { error: 'answerer_cannot_bank' };
  }

  const next = clone(state);
  const nextBank = next.bank;
  const events = [];

  if (decision === 'bank') {
    if (nextBank.pendingPoints <= 0) {
      return { error: 'nothing_to_bank' };
    }
    const amount = nextBank.pendingPoints;
    next.teams[nextBank.activeTeam].bank += amount;
    next.teams[nextBank.activeTeam].score += amount;
    nextBank.history.push({
      type: 'banked',
      team: nextBank.activeTeam,
      amount,
      byPlayerId: playerId,
      at: nextBank.totalAnswered
    });
    nextBank.pendingPoints = 0;
    nextBank.streak = 0;
    nextBank.lastDecision = 'bank';
    events.push({ type: 'points_banked', team: nextBank.activeTeam, amount });
  } else {
    nextBank.lastDecision = 'continue';
    events.push({ type: 'turn_continued', team: nextBank.activeTeam, answererId: nextBank.answererId });
  }

  return { state: next, events };
}

/* ------------------------------------------------------------------ */
/* Penalty shootout transitions                                        */
/* ------------------------------------------------------------------ */

function pickPenaltyJudge(state, activeTeam) {
  const neutral = playersOf(state, otherTeam(activeTeam));
  const candidate = pickFirstAvailable(neutral) || pickFirstAvailable(state.players);
  return candidate?.id || null;
}

function pickRepresentative(state, team, judgeId) {
  return pickFirstAvailable(
    playersOf(state, team).filter(player => player.id !== judgeId)
  )?.id || null;
}

function startPenalty(state, { categories, rng = Math.random } = {}) {
  const next = clone(state);
  next.phase = PHASES.PENALTY;
  next.penalty = createPenaltyState();
  next.penalty.categories = Array.isArray(categories) && categories.length > 0
    ? [...categories]
    : [...DEFAULT_CATEGORIES];
  next.penalty.activeTeam = TEAM_A;
  next.penalty.judgeId = pickPenaltyJudge(next, TEAM_A);
  next.penalty.representatives = {
    [TEAM_A]: pickRepresentative(next, TEAM_A, next.penalty.judgeId),
    [TEAM_B]: pickRepresentative(next, TEAM_B, next.penalty.judgeId)
  };
  next.penalty.category = pickRandomCategory(categories, rng);
  next.penalty.phase = 'select_shooter';
  next.penalty.alertNonce += 1;
  next.judgeId = next.penalty.judgeId;

  return {
    state: next,
    events: [
      { type: 'penalty_started' },
      {
        type: 'shooter_selection_required',
        activeTeam: TEAM_A,
        representativeId: next.penalty.representatives[TEAM_A],
        category: next.penalty.category
      }
    ]
  };
}

function penaltySelectShooter(state, { actorId, shooterId }) {
  const penalty = state.penalty;
  if (state.phase !== PHASES.PENALTY || penalty.isComplete) {
    return { error: 'penalty_inactive' };
  }
  if (penalty.phase !== 'select_shooter') {
    return { error: 'not_selecting_shooter' };
  }

  const representativeId = penalty.representatives[penalty.activeTeam];
  if (!representativeId || actorId !== representativeId) {
    return { error: 'only_team_representative_can_select' };
  }

  const shooter = findPlayer(state, shooterId);
  if (!shooter || shooter.team !== penalty.activeTeam) {
    return { error: 'shooter_must_be_on_active_team' };
  }
  if (shooter.id === penalty.judgeId) {
    return { error: 'judge_cannot_shoot' };
  }

  const next = clone(state);
  next.penalty.shooterId = shooterId;
  next.penalty.phase = 'awaiting_question';
  next.penalty.alertNonce += 1;
  return {
    state: next,
    events: [
      {
        type: 'shooter_selected',
        activeTeam: next.penalty.activeTeam,
        shooterId,
        selectedBy: actorId
      },
      { type: 'question_required', round: 'penalty' }
    ]
  };
}

function penaltyPresentQuestion(state, { question }) {
  const normalized = normalizeQuestion(question);
  if (!normalized) return { error: 'invalid_question' };
  if (state.phase !== PHASES.PENALTY || state.penalty.isComplete) {
    return { error: 'penalty_inactive' };
  }
  if (state.penalty.phase !== 'awaiting_question' || !state.penalty.shooterId) {
    return { error: 'shooter_not_selected' };
  }

  const next = clone(state);
  next.penalty.currentQuestion = normalized;
  next.penalty.phase = 'question';
  next.penalty.alertNonce += 1;
  return {
    state: next,
    events: [
      {
        type: 'penalty_question_revealed',
        shooterId: next.penalty.shooterId,
        judgeId: next.penalty.judgeId,
        category: next.penalty.category
      }
    ]
  };
}

function isSuddenDeathDecided(penalty) {
  if (!penalty.suddenDeath) return false;
  if (penalty.turnIndex % 2 !== 0) return false;
  return getPenaltyTotal(penalty, TEAM_A) !== getPenaltyTotal(penalty, TEAM_B);
}

function getPenaltyTotal(penalty, team) {
  return (penalty.score[team] || 0) + (penalty.bonusPoints[team] || 0);
}

function penaltyJudge(state, { judgeId, result }) {
  const penalty = state.penalty;
  if (state.phase !== PHASES.PENALTY || penalty.isComplete) {
    return { error: 'penalty_inactive' };
  }
  if (penalty.phase !== 'question') {
    return { error: 'no_active_penalty_question' };
  }
  if (!penalty.judgeId || judgeId !== penalty.judgeId) {
    return { error: 'only_assigned_judge_can_decide' };
  }
  if (result !== 'goal' && result !== 'miss' && result !== 'missed') {
    return { error: 'invalid_result' };
  }

  const next = clone(state);
  const p = next.penalty;
  const shooter = findPlayer(next, p.shooterId);
  const activeTeam = p.activeTeam;
  const defendingTeam = otherTeam(activeTeam);
  const isGoal = result === 'goal';
  const categoryId = getQuestionCategoryId(p.currentQuestion, p.category);
  const bonus = isGoal
    ? calculateBonus(shooter?.attributes, categoryId, true)
    : { bonusAwarded: false, bonusPoints: 0 };

  if (isGoal) {
    p.score[activeTeam] += 1;
    next.teams[activeTeam].penaltyScore = (next.teams[activeTeam].penaltyScore || 0) + 1;
    next.teams[activeTeam].score += PENALTY_RULES.GOAL_SCORE;
    if (bonus.bonusAwarded) {
      p.bonusPoints[activeTeam] += bonus.bonusPoints;
      next.teams[activeTeam].bonusPoints = (next.teams[activeTeam].bonusPoints || 0) + bonus.bonusPoints;
      next.teams[activeTeam].score += bonus.bonusPoints * PENALTY_RULES.BONUS_SCORE_MULTIPLIER;
    }
  }

  p.shots.push({
    shotIndex: p.turnIndex,
    team: activeTeam,
    defendingTeam,
    shooterId: p.shooterId,
    judgeId,
    category: categoryId,
    result: isGoal ? 'goal' : 'miss',
    bonusAwarded: bonus.bonusAwarded,
    bonusPoints: bonus.bonusPoints,
    isSuddenDeath: p.suddenDeath,
    suddenDeathRound: p.suddenDeathRound
  });

  const events = [{
    type: isGoal ? 'penalty_goal' : 'penalty_miss',
    team: activeTeam,
    shooterId: p.shooterId,
    bonusAwarded: bonus.bonusAwarded,
    bonusPoints: bonus.bonusPoints
  }];

  p.turnIndex += 1;
  p.currentQuestion = null;
  p.shooterId = null;

  const regulationDone = !p.suddenDeath && p.turnIndex >= p.regulationShots;

  if (regulationDone) {
    if (getPenaltyTotal(p, TEAM_A) === getPenaltyTotal(p, TEAM_B)) {
      p.suddenDeath = true;
      p.suddenDeathRound = 1;
      events.push({ type: 'penalty_sudden_death' });
    } else {
      p.isComplete = true;
      p.phase = 'complete';
      next.phase = PHASES.COMPLETE;
      next.judgeId = null;
      events.push({
        type: 'penalty_completed',
        winner: getPenaltyTotal(p, TEAM_A) > getPenaltyTotal(p, TEAM_B) ? TEAM_A : TEAM_B
      });
      return { state: next, events };
    }
  } else if (p.suddenDeath && isSuddenDeathDecided(p)) {
    p.isComplete = true;
    p.phase = 'complete';
    next.phase = PHASES.COMPLETE;
    next.judgeId = null;
    events.push({
      type: 'penalty_completed',
      winner: getPenaltyTotal(p, TEAM_A) > getPenaltyTotal(p, TEAM_B) ? TEAM_A : TEAM_B
    });
    return { state: next, events };
  } else if (p.suddenDeath && p.turnIndex % 2 === 0) {
    p.suddenDeathRound += 1;
  }

  p.activeTeam = p.activeTeam === TEAM_A ? TEAM_B : TEAM_A;
  p.phase = 'select_shooter';
  p.category = pickRandomCategory(p.categories, Math.random);

  const rep = p.representatives[p.activeTeam];
  events.push({
    type: 'shooter_selection_required',
    activeTeam: p.activeTeam,
    representativeId: rep,
    category: p.category
  });
  events.push({ type: 'role_alerts_required', judgeId: p.judgeId });

  return { state: next, events };
}

function acknowledgeAlert(state, { playerId, alertId }) {
  if (!playerId || !alertId) return { error: 'invalid_alert_ack' };
  const next = clone(state);
  next.acknowledgedAlerts = [...next.acknowledgedAlerts, `${playerId}:${alertId}`].slice(-40);
  return { state: next, events: [{ type: 'alert_acknowledged', playerId, alertId }] };
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export function reduce(state, action = {}) {
  let result;
  switch (action.type) {
    case 'LOBBY_JOIN':
      result = lobbyJoin(state, action);
      break;
    case 'LOBBY_SELECT_CHARACTER':
      result = lobbySelectCharacter(state, action);
      break;
    case 'LOBBY_SELECT_TEAM':
      result = lobbySelectTeam(state, action);
      break;
    case 'LOBBY_UPDATE_TEAM_NAMES':
      result = lobbyUpdateTeamNames(state, action);
      break;
    case 'LOBBY_REASSIGN_PLAYER_TEAM':
      result = lobbyReassignPlayerTeam(state, action);
      break;
    case 'LOBBY_REORDER_TEAM_PLAYERS':
      result = lobbyReorderTeamPlayers(state, action);
      break;
    case 'LOBBY_SWAP_TEAMS':
      result = lobbySwapTeams(state);
      break;
    case 'LOBBY_SET_JUDGE':
      result = lobbySetJudge(state, action);
      break;
    case 'START_BANK':
      result = startBank(state);
      break;
    case 'BANK_PRESENT_QUESTION':
      result = bankPresentQuestion(state, action);
      break;
    case 'BANK_GRADE':
      result = bankGrade(state, action);
      break;
    case 'BANK_PRESS_BANK':
      result = bankPress(state, { ...action, decision: 'bank' });
      break;
    case 'BANK_PRESS_CONTINUE':
      result = bankPress(state, { ...action, decision: 'continue' });
      break;
    case 'START_PENALTY':
      result = startPenalty(state, action);
      break;
    case 'PENALTY_SELECT_SHOOTER':
      result = penaltySelectShooter(state, action);
      break;
    case 'PENALTY_PRESENT_QUESTION':
      result = penaltyPresentQuestion(state, action);
      break;
    case 'PENALTY_JUDGE':
      result = penaltyJudge(state, action);
      break;
    case 'ACK_ALERT':
      result = acknowledgeAlert(state, action);
      break;
    default:
      return { state, events: [], error: 'unknown_action' };
  }

  if (result.error) {
    return { state, events: [], error: result.error };
  }

  if (result.state) {
    result.state.lastError = null;
    result.state.version = (state.version || 0) + 1;
  }
  return { state: result.state || state, events: result.events || [], error: null };
}

export { isGeneralCategory };

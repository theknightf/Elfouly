/**
 * src/game/selectors.js
 *
 * Role and alert selectors. The UI must use these helpers instead of
 * re-deriving permissions, so the client contract can never drift from the
 * rules engine.
 */

import { ALERT_KINDS, PHASES, TEAM_A, TEAM_B, otherTeam } from './constants.js';

export function getPlayer(state, playerId) {
  return state?.players?.find(player => player.id === playerId) || null;
}

export function getTeamPlayers(state, team) {
  return state?.players?.filter(player => player.team === team) || [];
}

export function getActiveBankQuestion(state) {
  return state?.phase === PHASES.BANK ? state.bank?.currentQuestion || null : null;
}

export function getBankTurnSnapshot(state) {
  const bank = state?.bank || {};
  return {
    activeTeam: bank.activeTeam,
    bankControllerTeam: bank.bankControllerTeam,
    answererId: bank.answererId,
    judgeId: bank.judgeId,
    questionInTeamTurn: bank.questionInTeamTurn,
    questionsPerTeam: bank.questionsPerTeam,
    roundIndex: Math.floor((bank.segmentIndex || 0) / 2),
    totalAnswered: bank.totalAnswered,
    totalQuestions: bank.totalQuestions,
    pendingPoints: bank.pendingPoints,
    streak: bank.streak,
    hasQuestion: !!bank.currentQuestion,
    isComplete: !!bank.isComplete
  };
}

export function getPenaltySnapshot(state) {
  const penalty = state?.penalty || {};
  const scoreA = (penalty.score?.[TEAM_A] || 0) + (penalty.bonusPoints?.[TEAM_A] || 0);
  const scoreB = (penalty.score?.[TEAM_B] || 0) + (penalty.bonusPoints?.[TEAM_B] || 0);
  return {
    phase: penalty.phase,
    activeTeam: penalty.activeTeam,
    shooterId: penalty.shooterId,
    judgeId: penalty.judgeId,
    representativeId: penalty.representatives?.[penalty.activeTeam] || null,
    category: penalty.category,
    turnIndex: penalty.turnIndex,
    regulationShots: penalty.regulationShots,
    suddenDeath: penalty.suddenDeath,
    suddenDeathRound: penalty.suddenDeathRound,
    scoreTeamA: scoreA,
    scoreTeamB: scoreB,
    isComplete: penalty.isComplete
  };
}

/**
 * Everything a single player is allowed to do right now.
 *
 * `canBank` / `canContinue` are intentionally false for every member of the
 * answering team. The Bank button is therefore rendered for the opponent ONLY
 * and can never be shown to the active answerer.
 */
export function getRoles(state, playerId) {
  const player = getPlayer(state, playerId);
  const base = {
    playerId,
    phase: state?.phase || PHASES.LOBBY,
    isPlayer: !!player,
    isAnswerer: false,
    isJudge: false,
    isShooter: false,
    isBankController: false,
    canSelectCharacter: false,
    canSelectTeam: false,
    canAnswer: false,
    canGrade: false,
    canBank: false,
    canContinue: false,
    canSelectShooter: false,
    canJudgePenalty: false
  };
  if (!player) return base;

  if (state.phase === PHASES.LOBBY) {
    return {
      ...base,
      canSelectCharacter: true,
      canSelectTeam: true
    };
  }

  if (state.phase === PHASES.BANK) {
    const bank = state.bank;
    const isAnswerer = bank.answererId === playerId;
    const isJudge = bank.judgeId === playerId;
    const isBankController = player.team === bank.bankControllerTeam
      && player.team !== bank.activeTeam
      && !isAnswerer;
    return {
      ...base,
      isAnswerer,
      isJudge,
      isBankController,
      canAnswer: isAnswerer && !!bank.currentQuestion,
      canGrade: isJudge && !!bank.currentQuestion,
      // Strictly opponent-only. Never rendered for the answering team.
      canBank: isBankController && bank.pendingPoints > 0,
      canContinue: isBankController,
      bankButtonVisible: isBankController
    };
  }

  if (state.phase === PHASES.PENALTY) {
    const penalty = state.penalty;
    const isJudge = penalty.judgeId === playerId;
    const isShooter = penalty.shooterId === playerId;
    const isRepresentative = penalty.representatives?.[penalty.activeTeam] === playerId;
    return {
      ...base,
      isJudge,
      isShooter,
      canSelectShooter: isRepresentative && penalty.phase === 'select_shooter',
      canJudgePenalty: isJudge && penalty.phase === 'question',
      canAnswer: isShooter && penalty.phase === 'question'
    };
  }

  return base;
}

function alertForPlayer(state, playerId, alert) {
  const key = `${playerId}:${alert.id}`;
  return state.acknowledgedAlerts?.includes(key) ? null : alert;
}

export function getAlerts(state, playerId) {
  const roles = getRoles(state, playerId);
  const alerts = [];

  if (state.phase === PHASES.BANK && state.bank.currentQuestion) {
    const nonce = state.bank.alertNonce || 0;
    if (roles.isAnswerer) {
      alerts.push({
        id: `bank-answer-${nonce}`,
        kind: ALERT_KINDS.ANSWER_TURN,
        round: 'bank',
        blocking: true,
        title: "It's your turn to answer!",
        message: 'دورك تجاوب دلوقتي — كل أدوات اللاعبين التانيين متقفلة.'
      });
    }
    if (roles.isJudge) {
      alerts.push({
        id: `bank-judge-${nonce}`,
        kind: ALERT_KINDS.JUDGE_ROUND,
        round: 'bank',
        blocking: true,
        title: 'You are the judge for this round.',
        message: 'أنت الحكم الوحيد في الجولة دي — صح / غلط / التايمر بقوا متاحين ليك.'
      });
    }
  }

  if (state.phase === PHASES.PENALTY && state.penalty.phase === 'question') {
    const nonce = state.penalty.alertNonce || 0;
    if (roles.isShooter) {
      alerts.push({
        id: `penalty-shooter-${nonce}`,
        kind: ALERT_KINDS.PENALTY_SHOOTER,
        round: 'penalty',
        blocking: true,
        title: 'You are shooting!',
        message: `أنت المسدد في ركلة ${(state.penalty.turnIndex || 0) + 1} — جاوب قبل الحكم ما يحسم.`
      });
    }
    if (roles.isJudge) {
      alerts.push({
        id: `penalty-judge-${nonce}`,
        kind: ALERT_KINDS.PENALTY_JUDGE,
        round: 'penalty',
        blocking: true,
        title: 'You are the judge for this round.',
        message: 'احكم على الركلة: Goal أو Miss. البونص بيتحسب تلقائياً خارج التخصص.'
      });
    }
  }

  return alerts
    .map(alert => alertForPlayer(state, playerId, alert))
    .filter(Boolean);
}

export function getRequiredAlert(state, playerId) {
  const alerts = getAlerts(state, playerId);
  return alerts[0] || null;
}

export function canStartMatch(state) {
  const teamA = getTeamPlayers(state, TEAM_A);
  const teamB = getTeamPlayers(state, TEAM_B);
  return state.players.length === 4
    && teamA.length === 2
    && teamB.length === 2
    && state.players.every(player => player.isBot || player.connected !== false);
}

export function getBankControllerTeam(state) {
  return otherTeam(state?.bank?.activeTeam || TEAM_A);
}

import type {
  Kick,
  Match,
  MatchDecision,
  MatchPhase,
  Player,
  Round,
  Team,
  TeamId
} from './types';

export function getTeam(match: Match, teamId: TeamId): Team {
  return match.teams[teamId];
}

export function getPlayer(match: Match, playerId: string | null): Player | null {
  if (!playerId) {
    return null;
  }
  return (
    match.teams.A.players.find(player => player.id === playerId) ||
    match.teams.B.players.find(player => player.id === playerId) ||
    null
  );
}

export function getCurrentRound(match: Match): Round | null {
  return match.rounds[match.rounds.length - 1] || null;
}

export function getCurrentKick(match: Match): Kick | null {
  if (!match.currentKickId) {
    return null;
  }
  return (
    match.rounds
      .flatMap(round => round.kicks)
      .find(kick => kick.id === match.currentKickId) || null
  );
}

export function getAllKicks(match: Match): Kick[] {
  return match.rounds.flatMap(round => round.kicks);
}

export function getScore(match: Match): Record<TeamId, number> {
  return {
    A: match.teams.A.points,
    B: match.teams.B.points
  };
}

export function getWinner(match: Match): Team | null {
  return match.winnerTeamId ? match.teams[match.winnerTeamId] : null;
}

export function getDecisionLabel(decision: MatchDecision | null): string {
  if (decision === 'sudden_death') {
    return 'الموت المفاجئ';
  }
  if (decision === 'regulation') {
    return 'الوقت الأصلي';
  }
  return '';
}

export function getPhaseLabel(phase: MatchPhase): string {
  const labels: Record<MatchPhase, string> = {
    MATCH_START: 'بداية المباراة',
    ROUND_START: 'بداية الجولة',
    SELECT_PLAYERS: 'اختيار الحارس',
    ATTACKER_QUESTION: 'سؤال المسدد',
    GOALKEEPER_QUESTION: 'سؤال الحارس',
    GOAL: 'هدف',
    SAVE: 'تصدي',
    MISS: 'ضاعت',
    NEXT_KICK: 'الركلة التالية',
    SUDDEN_DEATH: 'الموت المفاجئ',
    MATCH_END: 'نهاية المباراة'
  };
  return labels[phase];
}

export function getRoundScore(round: Round): Record<TeamId, number> {
  return { A: round.points.A, B: round.points.B };
}

export function getRoundOutcomeScore(round: Round): Record<TeamId, number> {
  return { A: round.outcomePoints.A, B: round.outcomePoints.B };
}

export function getStats(match: Match): Record<
  TeamId,
  { goals: number; saves: number; misses: number; bonusPoints: number; points: number }
> {
  const stats = {
    A: {
      goals: 0,
      saves: 0,
      misses: 0,
      bonusPoints: match.teams.A.bonusPoints,
      points: match.teams.A.points
    },
    B: {
      goals: 0,
      saves: 0,
      misses: 0,
      bonusPoints: match.teams.B.bonusPoints,
      points: match.teams.B.points
    }
  };

  for (const kick of getAllKicks(match)) {
    if (!kick.outcome) {
      continue;
    }
    if (kick.outcome === 'goal' && kick.scoredByTeamId) {
      stats[kick.scoredByTeamId].goals += 1;
    }
    if (kick.outcome === 'save' && kick.scoredByTeamId) {
      stats[kick.scoredByTeamId].saves += 1;
    }
  }

  for (const kick of getAllKicks(match)) {
    if (kick.outcome === 'miss') {
      stats[kick.attackingTeamId].misses += 1;
    }
  }

  return stats;
}

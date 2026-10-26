/** Shared turn and team rotation logic for multiplayer rounds. */
export class TurnManager {
  static nextGiverIndex(currentGiverIndex, players = []) {
    if (!players.length) return 0;
    return (Math.max(0, currentGiverIndex || 0) + 1) % players.length;
  }

  static nextTeam(team) {
    return team === 'team_a' ? 'team_b' : 'team_a';
  }

  static swapGiverAndGuesser(players = [], giverId) {
    const giver = players.find(player => player.id === giverId);
    if (!giver) return null;
    return players.find(player => player.team === giver.team && player.id !== giverId)?.id || giverId;
  }

  static swapClueGivers(players = [], giverAId, giverBId, currentIndex = 0) {
    const teamA = players.filter(player => player.team === 'team_a');
    const teamB = players.filter(player => player.team === 'team_b');
    const swapWithinTeam = (roster, giverId) => {
      if (!roster.length) return null;
      const current = roster.findIndex(player => player.id === giverId);
      return roster[(Math.max(0, current) + 1) % roster.length].id;
    };
    const nextA = swapWithinTeam(teamA, giverAId);
    const nextB = swapWithinTeam(teamB, giverBId);
    return {
      activeClueGiverA: nextA,
      activeClueGiverB: nextB,
      currentGiverIndex: currentIndex + 1
    };
  }

  static rotateTeamGivers(players = [], currentIndex = 0) {
    const teams = ['team_a', 'team_b'];
    const next = {};
    for (const team of teams) {
      const roster = players.filter(player => player.team === team);
      next[team] = roster.length ? roster[(Math.max(0, currentIndex) + 1) % roster.length].id : null;
    }
    return next;
  }
}


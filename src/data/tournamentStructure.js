export const TOURNAMENT_CONFIG = {
  round1_bank: {
    name: '1 تو (Bank)',
    totalQuestions: 48,
    perTeamTotal: 24,
    // 4 major turns: Team A (12) -> Team B (12) -> Team A (12) -> Team B (12)
    // Inside each 12-question turn: sub-cycles of (6 + 6) questions
    turns: [
      { teamId: 'A', team: 'team_a', questionsCount: 12, questions: 12, subSplits: [6, 6], split: [6, 6] },
      { teamId: 'B', team: 'team_b', questionsCount: 12, questions: 12, subSplits: [6, 6], split: [6, 6] },
      { teamId: 'A', team: 'team_a', questionsCount: 12, questions: 12, subSplits: [6, 6], split: [6, 6] },
      { teamId: 'B', team: 'team_b', questionsCount: 12, questions: 12, subSplits: [6, 6], split: [6, 6] },
    ]
  },
  round2_password: {
    name: 'اديني في سري (Password)',
    totalQuestions: 5,
    structure: '5 secret cards; 2 opposing clue-givers + dynamic neutral host'
  },
  round3_penalty: {
    name: 'حط في قريبي (Penalty Shootouts)',
    totalQuestions: 10, // 5 penalties per team
    totalShots: 10,
    structure: 'Random category generated first -> Teams select their duelists -> 1v1 speed shootout'
  },
  round4_auction: {
    name: 'مين يزوّد؟ (Blind Auction)',
    totalQuestions: 4,
    structure: '60s open bidding -> Highest bidding team plays -> Opposing team verifies and enters points'
  }
};

export const TOURNAMENT_STRUCTURE = TOURNAMENT_CONFIG;

export interface TurnSegment {
  segment: number;
  team: string;
  teamName: string;
  questions: number;
  split: [number, number];
}

export interface TournamentStructure {
  round1_bank: {
    name: string;
    totalQuestions: number;
    perTeamTotal: number;
    turns: TurnSegment[];
  };
  round2_password: {
    name: string;
    totalQuestions: number;
    structure: string;
  };
  round3_penalty: {
    name: string;
    totalShots: number;
    structure: string;
  };
  round4_auction: {
    name: string;
    structure: string;
  };
}

export const TOURNAMENT_STRUCTURE: TournamentStructure = {
  round1_bank: {
    name: '1 تو (Bank)',
    totalQuestions: 48,
    perTeamTotal: 24,
    // Structure: 4 segments total (Team A -> Team B -> Team A -> Team B)
    // Each team gets 2 turns of 12 questions (split as 6 and 6 sub-batches)
    turns: [
      { segment: 1, team: 'team_a', teamName: 'Team A', questions: 12, split: [6, 6] },
      { segment: 2, team: 'team_b', teamName: 'Team B', questions: 12, split: [6, 6] },
      { segment: 3, team: 'team_a', teamName: 'Team A', questions: 12, split: [6, 6] },
      { segment: 4, team: 'team_b', teamName: 'Team B', questions: 12, split: [6, 6] },
    ]
  },
  round2_password: {
    name: 'اديني في سري (Password)',
    totalQuestions: 5,
    structure: '5 secret cards; 2 competing clue-givers with dynamic neutral host referee'
  },
  round3_penalty: {
    name: 'حط في قريبي (Penalty)',
    totalShots: 10, // 5 per team alternating
    structure: '1v1 shootout with goalie intercept buzzer'
  },
  round4_auction: {
    name: 'مين يزوّد؟ (Auction)',
    structure: 'Tie-breaker/bonus bidding cycle with 60s timer and referee verification checklist'
  }
};

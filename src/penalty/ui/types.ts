export interface SetupPlayer {
  id: string;
  name: string;
  /** Canonical specialty ids from SPECIALTY_CATEGORIES. */
  attributes: string[];
}

export interface SetupTeam {
  name: string;
  players: SetupPlayer[];
}

export interface SetupTeams {
  A: SetupTeam;
  B: SetupTeam;
}

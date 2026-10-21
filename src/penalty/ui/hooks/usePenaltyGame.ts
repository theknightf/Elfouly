import { useCallback, useRef, useState } from 'react';
import {
  createMatch,
  transition
} from '../../engine';
import type { Match, MatchConfig, MatchEvent } from '../../engine/types';
import { PENALTY_QUESTION_BANK } from '../../data/penaltyQuestions';
import type { SetupTeams } from '../types';
import { sounds } from '../../../utils/soundEffects';

const CONFIG: MatchConfig = {
  regulationRounds: 5,
  questionTimeLimitMs: 15_000,
  minQuestionPool: 20
};

function makeSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

function newMatchId(): string {
  return `penalty-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function toEngineTeams(teams: SetupTeams) {
  return {
    A: {
      name: teams.A.name,
      players: teams.A.players.map((player, index) => ({
        id: player.id || `a-${index + 1}`,
        name: player.name,
        teamId: 'A' as const,
        attributes: player.attributes
      }))
    },
    B: {
      name: teams.B.name,
      players: teams.B.players.map((player, index) => ({
        id: player.id || `b-${index + 1}`,
        name: player.name,
        teamId: 'B' as const,
        attributes: player.attributes
      }))
    }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'حصل خطأ غير متوقع.';
}

export function usePenaltyGame() {
  const [match, setMatchState] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() =>
    Boolean((sounds as any)?.isMuted)
  );
  const matchRef = useRef<Match | null>(null);

  const setMatch = useCallback((next: Match | null) => {
    matchRef.current = next;
    setMatchState(next);
  }, []);

  const startMatch = useCallback(
    (teams: SetupTeams) => {
      setError(null);
      try {
        const now = Date.now();
        const created = createMatch({
          id: newMatchId(),
          teams: toEngineTeams(teams),
          questions: PENALTY_QUESTION_BANK,
          config: CONFIG,
          seed: makeSeed(),
          now
        });
        setMatch(transition(created, { type: 'START_MATCH', now }));
        sounds?.playWhistle?.();
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [setMatch]
  );

  const dispatch = useCallback(
    (event: Omit<MatchEvent, 'now'>) => {
      const current = matchRef.current;
      if (!current) {
        return;
      }
      try {
        const next = transition(current, { ...event, now: Date.now() } as MatchEvent);
        setMatch(next);
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [setMatch]
  );

  const chooseGoalkeeper = useCallback(
    (playerId: string) => {
      sounds?.playTap?.();
      dispatch({ type: 'CHOOSE_GOALKEEPER', playerId });
    },
    [dispatch]
  );

  const answer = useCallback(
    (optionIndex: number) => {
      dispatch({ type: 'ANSWER', optionIndex });
    },
    [dispatch]
  );

  const timeout = useCallback(() => {
    dispatch({ type: 'TIMEOUT' });
  }, [dispatch]);

  const continueKick = useCallback(() => {
    dispatch({ type: 'CONTINUE' });
  }, [dispatch]);

  const startSuddenDeathRound = useCallback(() => {
    dispatch({ type: 'START_SUDDEN_DEATH_ROUND' });
  }, [dispatch]);

  const rematch = useCallback(() => {
    const current = matchRef.current;
    if (!current) {
      return;
    }
    setError(null);
    try {
      const now = Date.now();
      const created = createMatch({
        id: newMatchId(),
        teams: {
          A: { name: current.teams.A.name, players: current.teams.A.players },
          B: { name: current.teams.B.name, players: current.teams.B.players }
        },
        questions: PENALTY_QUESTION_BANK,
        config: CONFIG,
        seed: makeSeed(),
        now
      });
      setMatch(transition(created, { type: 'START_MATCH', now }));
      sounds?.playWhistle?.();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [setMatch]);

  const backToSetup = useCallback(() => {
    setError(null);
    setMatch(null);
  }, [setMatch]);

  const toggleMute = useCallback(() => {
    const muted = (sounds as any)?.toggleMute?.();
    setIsMuted(typeof muted === 'boolean' ? muted : !isMuted);
  }, [isMuted]);

  return {
    match,
    error,
    isMuted,
    startMatch,
    chooseGoalkeeper,
    answer,
    timeout,
    continueKick,
    startSuddenDeathRound,
    rematch,
    backToSetup,
    toggleMute,
    clearError: () => setError(null)
  };
}

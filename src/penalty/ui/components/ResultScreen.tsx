import { useEffect, useRef } from 'react';
import { categoryLabel, specialtyIcon } from '../../engine/categories';
import { getCurrentKick, getPlayer } from '../../engine/selectors';
import type { Match } from '../../engine/types';
import { sounds } from '../../../utils/soundEffects';
import { teamTheme } from '../theme';
import { PlayerBadge } from './PlayerBadge';

interface ResultScreenProps {
  match: Match;
  onContinue: () => void;
}

const RESULT_COPY = {
  GOAL: {
    title: 'هدف! ⚽',
    subtitle: 'الكرة في الشبكة، والفريق أضاف نقطة.',
    emoji: '⚽',
    accent: '#00E676'
  },
  SAVE: {
    title: 'تصدي! 🧤',
    subtitle: 'الحارس أنقذ فريقه، وأضاف نقطة.',
    emoji: '🧤',
    accent: '#00F2FE'
  },
  MISS: {
    title: 'ضاعت! 💨',
    subtitle: 'الركلة خرجت بدون نقاط.',
    emoji: '💨',
    accent: '#9CA3AF'
  }
} as const;

export function ResultScreen({ match, onContinue }: ResultScreenProps) {
  const phase = match.phase;
  if (phase !== 'GOAL' && phase !== 'SAVE' && phase !== 'MISS') {
    return null;
  }

  const kick = getCurrentKick(match);
  if (!kick) {
    return null;
  }

  const copy = RESULT_COPY[phase];
  const scoredTeamId = kick.scoredByTeamId;
  const focusTeamId = scoredTeamId ?? kick.attackingTeamId;
  const theme = teamTheme(focusTeamId);
  const focusTeam = match.teams[focusTeamId];
  const actorId =
    phase === 'SAVE' ? kick.goalkeeperId : kick.attackerId;
  const actor = getPlayer(match, actorId);
  const actorRole = phase === 'SAVE' ? 'goalkeeper' : 'attacker';
  const questionId =
    phase === 'SAVE'
      ? kick.goalkeeperAttempt?.questionId
      : kick.attackerAttempt?.questionId;
  const question = match.questionDeck.find(entry => entry.id === questionId);
  const round = match.rounds[match.rounds.length - 1];

  const playedRef = useRef<string | null>(null);
  useEffect(() => {
    if (playedRef.current === kick.id) {
      return;
    }
    playedRef.current = kick.id;

    if (phase === 'GOAL') {
      sounds?.playGoal?.();
    } else if (phase === 'SAVE') {
      sounds?.playSave?.();
    } else {
      sounds?.playBuzzer?.();
    }

    if (kick.bonusAwarded) {
      window.setTimeout(() => sounds?.playTap?.(), 350);
    }
  }, [kick.id, kick.bonusAwarded, phase]);

  return (
    <section className="pk-fade-up space-y-3">
      <div
        className={`pk-result-card pk-result-${phase.toLowerCase()} relative overflow-hidden rounded-3xl border-2 p-5 text-center sm:p-7`}
        style={{
          borderColor: `${copy.accent}66`,
          background: `radial-gradient(circle at 50% 0%, ${copy.accent}22, rgba(9,10,23,0.95) 60%)`
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-35 pk-result-rays" />
        <div className="relative">
          <div className="text-6xl drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] sm:text-7xl">
            {copy.emoji}
          </div>
          <h2
            className="mt-2 text-4xl font-black tracking-tight sm:text-5xl"
            style={{ color: copy.accent }}
          >
            {copy.title}
          </h2>
          <p className="mt-2 text-sm font-bold text-gray-300">
            {phase === 'MISS'
              ? copy.subtitle
              : `${focusTeam.name}: ${copy.subtitle}`}
          </p>

          <div className="mx-auto mt-4 max-w-sm">
            <PlayerBadge
              player={actor}
              teamId={focusTeamId}
              role={actorRole}
            />
          </div>

          {kick.bonusAwarded && (
            <div className="pk-bonus-pop mt-4 inline-flex items-center gap-2 rounded-full border-2 border-arena-yellow bg-arena-yellow px-4 py-1.5 text-sm font-black text-black shadow-[0_6px_0_#9b7d00]">
              <span>✨</span>
              <span>BONUS +1</span>
              <span>✨</span>
            </div>
          )}

          <div className="mx-auto mt-4 flex max-w-sm items-stretch justify-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 py-2">
              <div className="text-[8px] font-bold text-gray-500">نقاط الركلة</div>
              <div className="font-mono text-2xl font-black text-white">
                {kick.totalPointsAwarded > 0 ? `+${kick.totalPointsAwarded}` : '0'}
              </div>
            </div>
            <div className="flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 py-2">
              <div className="text-[8px] font-bold text-gray-500">هدف / تصدي</div>
              <div className="font-mono text-2xl font-black text-arena-green">
                {kick.pointsAwarded > 0 ? '+1' : '0'}
              </div>
            </div>
            <div className="flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 py-2">
              <div className="text-[8px] font-bold text-gray-500">بونص</div>
              <div className="font-mono text-2xl font-black text-arena-yellow">
                {kick.bonusAwarded ? '+1' : '0'}
              </div>
            </div>
          </div>

          {question && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-gray-300">
                {question.category === 'general'
                  ? '🌐'
                  : specialtyIcon(question.category)}{' '}
                {question.categoryLabel || categoryLabel(question.category)}
              </span>
              {kick.bonusAwarded && (
                <span className="rounded-full border border-arena-yellow/40 bg-arena-yellow/10 px-2 py-0.5 text-[9px] font-black text-arena-yellow">
                  إجابة خارج التخصص
                </span>
              )}
            </div>
          )}

          {match.suddenDeath && kick.bonusAwarded && (
            <p className="mx-auto mt-3 max-w-md rounded-xl border border-arena-yellow/20 bg-arena-yellow/5 px-2.5 py-1.5 text-[9px] font-bold text-arena-yellow/90">
              البونص مضاف لإجمالي النقاط، لكن جولة الموت المفاجئ بتتحسم
              بالهدف/التصدي فقط.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-2xl border-2 ${teamTheme('A').border} ${teamTheme('A').softBackground} px-3 py-2 text-center`}>
          <div className={`truncate text-[9px] font-black ${teamTheme('A').text}`}>
            {match.teams.A.name}
          </div>
          <div className={`font-mono text-2xl font-black ${teamTheme('A').text}`}>
            {match.teams.A.points}
          </div>
          <div className="text-[8px] font-bold text-gray-500">
            بونص +{match.teams.A.bonusPoints}
          </div>
        </div>
        <div className={`rounded-2xl border-2 ${teamTheme('B').border} ${teamTheme('B').softBackground} px-3 py-2 text-center`}>
          <div className={`truncate text-[9px] font-black ${teamTheme('B').text}`}>
            {match.teams.B.name}
          </div>
          <div className={`font-mono text-2xl font-black ${teamTheme('B').text}`}>
            {match.teams.B.points}
          </div>
          <div className="text-[8px] font-bold text-gray-500">
            بونص +{match.teams.B.bonusPoints}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="btn-arcade-cyan w-full rounded-2xl px-5 py-3 text-base font-black active:translate-y-1"
      >
        استمر ⏩
      </button>

      {round && (
        <p className="text-center text-[9px] font-bold text-gray-500">
          نقاط الجولة: {round.points.A} - {round.points.B}
          {match.suddenDeath ? ' (الموت المفاجئ بالهدف/التصدي فقط)' : ''}
        </p>
      )}
    </section>
  );
}

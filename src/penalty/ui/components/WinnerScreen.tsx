import { useEffect } from 'react';
import { getStats } from '../../engine/selectors';
import type { Match } from '../../engine/types';
import { teamTheme } from '../theme';

interface WinnerScreenProps {
  match: Match;
  onRematch: () => void;
  onBackToSetup: () => void;
}

export function WinnerScreen({
  match,
  onRematch,
  onBackToSetup
}: WinnerScreenProps) {
  const winnerId = match.winnerTeamId;
  const winner = winnerId ? match.teams[winnerId] : null;
  const theme = winnerId ? teamTheme(winnerId) : null;
  const stats = getStats(match);

  useEffect(() => {
    if (!winnerId) {
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    import('canvas-confetti')
      .then(module => {
        if (cancelled) {
          return;
        }
        const fire =
          (module as any).default || (module as any).confetti || module;
        if (typeof fire !== 'function') {
          return;
        }

        const colors = [theme?.hex || '#FFD200', '#FFD200', '#FFFFFF', '#00F2FE'];
        fire({
          particleCount: 90,
          spread: 70,
          startVelocity: 38,
          origin: { y: 0.65 },
          colors
        });
        timers.push(
          window.setTimeout(
            () =>
              fire({
                particleCount: 60,
                spread: 100,
                startVelocity: 28,
                origin: { x: 0.15, y: 0.55 },
                colors
              }),
            280
          )
        );
        timers.push(
          window.setTimeout(
            () =>
              fire({
                particleCount: 60,
                spread: 100,
                startVelocity: 28,
                origin: { x: 0.85, y: 0.55 },
                colors
              }),
            460
          )
        );
      })
      .catch(() => {
        // Confetti is decorative; the win screen works without it.
      });

    return () => {
      cancelled = true;
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [winnerId, theme?.hex]);

  return (
    <section className="pk-fade-up space-y-3">
      <div
        className="pk-winner-card relative overflow-hidden rounded-3xl border-2 p-5 text-center sm:p-8"
        style={{
          borderColor: theme ? `${theme.hex}77` : 'rgba(255,255,255,0.15)',
          background: theme
            ? `radial-gradient(circle at 50% 0%, ${theme.hex}25, rgba(9,10,23,0.97) 62%)`
            : 'rgba(9,10,23,0.97)'
        }}
      >
        <div className="pointer-events-none absolute inset-0 pk-result-rays opacity-30" />
        <div className="relative">
          <div className="text-6xl drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)] sm:text-7xl">
            🏆
          </div>
          <div className="mt-1 font-pixel text-[9px] tracking-[0.32em] text-arena-yellow">
            MATCH WINNER
          </div>
          <h2 className="mt-2 text-4xl font-black text-white sm:text-5xl">
            {winner ? winner.name : 'تعادل'}
          </h2>
          <p className="mt-2 text-xs font-bold text-gray-300 sm:text-sm">
            {winner
              ? match.decision === 'sudden_death'
                ? 'فاز في الموت المفاجئ بعد جولة فاصلة ⚡'
                : 'فاز بعد الخمس جولات الرسمية 🏁'
              : 'المباراة انتهت بالتعادل.'}
          </p>

          <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-3">
            <div className={`flex-1 rounded-2xl border-2 ${teamTheme('A').border} ${teamTheme('A').softBackground} px-3 py-2`}>
              <div className={`truncate text-[9px] font-black ${teamTheme('A').text}`}>
                {match.teams.A.name}
              </div>
              <div className={`font-mono text-3xl font-black ${teamTheme('A').text}`}>
                {match.teams.A.points}
              </div>
              <div className="text-[8px] font-bold text-gray-500">
                بونص +{match.teams.A.bonusPoints}
              </div>
            </div>
            <div className="font-pixel text-[10px] text-arena-yellow">VS</div>
            <div className={`flex-1 rounded-2xl border-2 ${teamTheme('B').border} ${teamTheme('B').softBackground} px-3 py-2`}>
              <div className={`truncate text-[9px] font-black ${teamTheme('B').text}`}>
                {match.teams.B.name}
              </div>
              <div className={`font-mono text-3xl font-black ${teamTheme('B').text}`}>
                {match.teams.B.points}
              </div>
              <div className="text-[8px] font-bold text-gray-500">
                بونص +{match.teams.B.bonusPoints}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2">
            {(['A', 'B'] as const).map(teamId => (
              <div
                key={teamId}
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-right"
              >
                <div className="mb-1 truncate text-[9px] font-black text-gray-400">
                  {match.teams[teamId].name}
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div>
                    <div className="font-mono text-sm font-black text-arena-green">
                      {stats[teamId].goals}
                    </div>
                    <div className="text-[7px] font-bold text-gray-500">أهداف</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-black text-arena-cyan">
                      {stats[teamId].saves}
                    </div>
                    <div className="text-[7px] font-bold text-gray-500">تصديات</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-black text-arena-yellow">
                      {stats[teamId].bonusPoints}
                    </div>
                    <div className="text-[7px] font-bold text-gray-500">بونص</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-black text-gray-400">
                      {stats[teamId].misses}
                    </div>
                    <div className="text-[7px] font-bold text-gray-500">ضاعت</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-4 max-w-md">
            <div className="mb-1.5 text-[9px] font-black text-gray-400">
              سجل الجولات
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {match.rounds.map(round => {
                const showOutcome = round.isSuddenDeath;
                const a = showOutcome ? round.outcomePoints.A : round.points.A;
                const b = showOutcome ? round.outcomePoints.B : round.points.B;
                const hasBonus = round.bonusPoints.A + round.bonusPoints.B > 0;
                return (
                  <div
                    key={round.number}
                    className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${
                      round.isSuddenDeath
                        ? 'border-arena-yellow/30 bg-arena-yellow/5'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <span className="text-gray-500">
                      {round.isSuddenDeath
                        ? `ف${round.number - match.config.regulationRounds}`
                        : `ج${round.number}`}
                    </span>{' '}
                    <span className="text-arena-cyan">{a}</span>
                    <span className="text-gray-600">/</span>
                    <span className="text-arena-red">{b}</span>
                    {hasBonus && <span className="mr-1 text-arena-yellow">✦</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 text-[8px] font-bold text-gray-600">
              ✦ = فيه نقاط بونص في الجولة (البونص لا يحسم الموت المفاجئ)
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRematch}
          className="btn-arcade-yellow rounded-2xl px-4 py-3 text-sm font-black active:translate-y-1"
        >
          مباراة جديدة 🔁
        </button>
        <button
          type="button"
          onClick={onBackToSetup}
          className="btn-arcade-dark rounded-2xl px-4 py-3 text-sm font-black active:translate-y-1"
        >
          تعديل الفرق ⚙️
        </button>
      </div>

      <a
        href="#arena"
        className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-center text-[10px] font-bold text-gray-400 transition hover:border-white/25 hover:text-white"
      >
        العودة لساحة كنز الفولي ←
      </a>
    </section>
  );
}

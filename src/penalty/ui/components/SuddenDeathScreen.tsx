import type { Match } from '../../engine/types';
import { teamTheme } from '../theme';

interface SuddenDeathScreenProps {
  match: Match;
  onStart: () => void;
}

export function SuddenDeathScreen({ match, onStart }: SuddenDeathScreenProps) {
  const themeA = teamTheme('A');
  const themeB = teamTheme('B');
  const completedRounds = match.rounds.filter(
    round =>
      round.isSuddenDeath &&
      round.kicks.length === 2 &&
      round.kicks.every(kick => kick.outcome !== null)
  );
  const nextNumber = completedRounds.length + 1;

  return (
    <section className="pk-fade-up space-y-3">
      <div className="pk-sudden-card relative overflow-hidden rounded-3xl border-2 border-arena-yellow/70 bg-[radial-gradient(circle_at_50%_0%,rgba(255,210,0,0.18),rgba(9,10,23,0.96)_62%)] p-5 text-center sm:p-7">
        <div className="pointer-events-none absolute inset-0 pk-sudden-rays opacity-40" />
        <div className="relative">
          <div className="text-5xl">⚡</div>
          <div className="mt-1 font-pixel text-[9px] tracking-[0.3em] text-arena-yellow">
            SUDDEN DEATH
          </div>
          <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            الموت المفاجئ
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs font-bold leading-relaxed text-gray-300 sm:text-sm">
            الخمس جولات خلصت بالتعادل. من دلوقتي كل جولة بتتلعب بنفس الترتيب:
            ركلة للفريق A ثم ركلة للفريق B. الجولة بتتحسم بعدد الأهداف/التصديات
            فقط، مش بالبونص.
          </p>

          <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-3">
            <div className={`flex-1 rounded-2xl border-2 ${themeA.border} ${themeA.softBackground} px-3 py-2`}>
              <div className={`truncate text-[9px] font-black ${themeA.text}`}>
                {match.teams.A.name}
              </div>
              <div className={`font-mono text-3xl font-black ${themeA.text}`}>
                {match.teams.A.points}
              </div>
              <div className="text-[8px] font-bold text-gray-500">
                بونص +{match.teams.A.bonusPoints}
              </div>
            </div>
            <div className="font-pixel text-[10px] text-arena-yellow">VS</div>
            <div className={`flex-1 rounded-2xl border-2 ${themeB.border} ${themeB.softBackground} px-3 py-2`}>
              <div className={`truncate text-[9px] font-black ${themeB.text}`}>
                {match.teams.B.name}
              </div>
              <div className={`font-mono text-3xl font-black ${themeB.text}`}>
                {match.teams.B.points}
              </div>
              <div className="text-[8px] font-bold text-gray-500">
                بونص +{match.teams.B.bonusPoints}
              </div>
            </div>
          </div>

          {completedRounds.length > 0 && (
            <div className="mx-auto mt-4 max-w-md rounded-2xl border border-white/10 bg-black/25 p-2.5">
              <div className="mb-1.5 text-[9px] font-black text-gray-400">
                جولات الموت المفاجئ (هدف/تصدي فقط)
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {completedRounds.map(round => (
                  <div
                    key={round.number}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold text-gray-300"
                  >
                    جولة {round.number - match.config.regulationRounds}:{' '}
                    <span className="text-arena-cyan">
                      {round.outcomePoints.A}
                    </span>{' '}
                    /{' '}
                    <span className="text-arena-red">
                      {round.outcomePoints.B}
                    </span>
                    {round.bonusPoints.A + round.bonusPoints.B > 0 && (
                      <span className="mr-1 text-arena-yellow">✦</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-arena-yellow/25 bg-arena-yellow/5 px-3 py-2 text-[9px] font-bold text-arena-yellow/90">
            الجولة الفاصلة القادمة: {nextNumber} • البونص بيضاف للمجموع فقط
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="btn-arcade-yellow w-full rounded-2xl px-5 py-3.5 text-base font-black active:translate-y-1"
      >
        ابدأ جولة الموت المفاجئ ⚡
      </button>
    </section>
  );
}

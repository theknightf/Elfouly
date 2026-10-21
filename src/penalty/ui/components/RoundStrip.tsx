import type { Match } from '../../engine/types';

interface RoundStripProps {
  match: Match;
}

export function RoundStrip({ match }: RoundStripProps) {
  const includeUpcomingSuddenDeath =
    match.phase === 'SUDDEN_DEATH' ? 1 : 0;
  const regulationRounds = match.config.regulationRounds;
  const slotCount = Math.max(
    regulationRounds,
    match.rounds.length + includeUpcomingSuddenDeath
  );

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold text-gray-400">
        <span>سجل نقاط الجولات</span>
        <span className="flex items-center gap-2">
          <span className="text-arena-cyan">A</span>
          <span className="text-arena-red">B</span>
          <span className="text-arena-yellow">✦ بونص</span>
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${slotCount}, minmax(42px, 1fr))`
          }}
        >
          {Array.from({ length: slotCount }, (_, index) => {
            const roundNumber = index + 1;
            const round = match.rounds[index];
            const isCurrent =
              roundNumber === match.currentRoundNumber ||
              (match.phase === 'SUDDEN_DEATH' &&
                roundNumber === match.rounds.length + 1);
            const isSudden = roundNumber > regulationRounds;
            const isSuddenRound = Boolean(round?.isSuddenDeath);
            const a = round
              ? isSuddenRound
                ? round.outcomePoints.A
                : round.points.A
              : null;
            const b = round
              ? isSuddenRound
                ? round.outcomePoints.B
                : round.points.B
              : null;
            const hasBonus = Boolean(
              round && round.bonusPoints.A + round.bonusPoints.B > 0
            );

            return (
              <div
                key={roundNumber}
                className={`relative rounded-lg border px-1 py-1 text-center transition-colors ${
                  isCurrent
                    ? 'border-arena-yellow/80 bg-arena-yellow/10'
                    : round
                      ? 'border-white/10 bg-white/5'
                      : 'border-dashed border-white/10 bg-transparent'
                }`}
              >
                <div
                  className={`text-[8px] font-black ${
                    isSudden ? 'text-arena-yellow' : 'text-gray-400'
                  }`}
                >
                  {isSudden ? `ف${roundNumber - regulationRounds}` : `ج${roundNumber}`}
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-[10px] font-black">
                  <span className={a ? 'text-arena-cyan' : 'text-gray-600'}>
                    {a ?? '·'}
                  </span>
                  <span className="text-gray-700">/</span>
                  <span className={b ? 'text-arena-red' : 'text-gray-600'}>
                    {b ?? '·'}
                  </span>
                </div>
                {hasBonus && (
                  <span className="absolute left-1 top-0.5 text-[7px] text-arena-yellow">
                    ✦
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {match.suddenDeath && (
        <div className="mt-1 text-[8px] font-bold text-arena-yellow/70">
          جولات الموت المفاجئ معروضة بالهدف/التصدي فقط، بدون بونص.
        </div>
      )}
    </div>
  );
}

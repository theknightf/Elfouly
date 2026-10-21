import { getCurrentKick } from '../../engine/selectors';
import type { Match } from '../../engine/types';
import { teamTheme } from '../theme';
import { RoundStrip } from './RoundStrip';

interface ScoreboardProps {
  match: Match;
}

function phaseText(match: Match): string {
  switch (match.phase) {
    case 'SELECT_PLAYERS':
      return 'اختيار الحارس';
    case 'ATTACKER_QUESTION':
      return 'سؤال المسدد';
    case 'GOALKEEPER_QUESTION':
      return 'سؤال الحارس';
    case 'GOAL':
      return 'هدف!';
    case 'SAVE':
      return 'تصدي!';
    case 'MISS':
      return 'ضاعت!';
    case 'SUDDEN_DEATH':
      return 'استعد للجولة الفاصلة';
    case 'MATCH_END':
      return 'نهاية المباراة';
    default:
      return 'ضربات الجزاء';
  }
}

export function Scoreboard({ match }: ScoreboardProps) {
  const kick = getCurrentKick(match);
  const themeA = teamTheme('A');
  const themeB = teamTheme('B');
  const isSudden = match.suddenDeath;
  const suddenRound = Math.max(
    1,
    match.currentRoundNumber - match.config.regulationRounds + 1
  );

  const roundLabel = isSudden
    ? match.phase === 'SUDDEN_DEATH'
      ? 'الموت المفاجئ'
      : `جولة فاصلة ${suddenRound}`
    : `الجولة ${Math.max(1, match.currentRoundNumber)} من ${match.config.regulationRounds}`;

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-white/10 bg-[#0d1028]/90 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3 sm:p-4">
        <div className={`rounded-2xl border-2 ${themeA.border} ${themeA.softBackground} px-3 py-2`}>
          <div className={`truncate text-[10px] font-black ${themeA.text}`}>{match.teams.A.name}</div>
          <div className="flex items-end justify-between gap-2">
            <span className="text-[9px] font-bold text-gray-400">نقاط</span>
            <span className={`font-mono text-3xl font-black leading-none ${themeA.text}`}>
              {match.teams.A.points}
            </span>
          </div>
          <div className="mt-1 text-left text-[8px] font-bold text-gray-500">
            بونص +{match.teams.A.bonusPoints}
          </div>
        </div>

        <div className="min-w-[112px] px-1 text-center sm:min-w-[150px]">
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-arena-yellow" />
            <span className="text-[10px] font-black text-arena-yellow">{roundLabel}</span>
            <span className="h-1 w-1 rounded-full bg-arena-yellow" />
          </div>
          <div className="mt-1 text-[9px] font-bold text-gray-400">{phaseText(match)}</div>
          {kick && match.phase !== 'MATCH_END' && (
            <div className="mt-1 inline-flex rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[8px] font-bold text-gray-300">
              الركلة {kick.indexInRound + 1} من 2
            </div>
          )}
          {isSudden && (
            <div className="mt-1 animate-pulse text-[9px] font-black tracking-wider text-arena-yellow">
              SUDDEN DEATH ⚡
            </div>
          )}
        </div>

        <div className={`rounded-2xl border-2 ${themeB.border} ${themeB.softBackground} px-3 py-2`}>
          <div className={`truncate text-[10px] font-black ${themeB.text}`}>{match.teams.B.name}</div>
          <div className="flex items-end justify-between gap-2">
            <span className={`font-mono text-3xl font-black leading-none ${themeB.text}`}>
              {match.teams.B.points}
            </span>
            <span className="text-[9px] font-bold text-gray-400">نقاط</span>
          </div>
          <div className="mt-1 text-right text-[8px] font-bold text-gray-500">
            بونص +{match.teams.B.bonusPoints}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-3 pb-3 sm:px-4">
        <RoundStrip match={match} />
      </div>
    </section>
  );
}

import { categoryLabel } from '../../engine/categories';
import { getCurrentKick, getPlayer } from '../../engine/selectors';
import type { Match } from '../../engine/types';
import { teamTheme } from '../theme';
import { PlayerBadge } from './PlayerBadge';

interface GoalkeeperSelectProps {
  match: Match;
  onChoose: (playerId: string) => void;
}

export function GoalkeeperSelect({ match, onChoose }: GoalkeeperSelectProps) {
  const kick = getCurrentKick(match);
  if (!kick) {
    return null;
  }

  const attackingTeam = match.teams[kick.attackingTeamId];
  const defendingTeam = match.teams[kick.defendingTeamId];
  const attacker = getPlayer(match, kick.attackerId);
  const attackerTheme = teamTheme(kick.attackingTeamId);
  const defenderTheme = teamTheme(kick.defendingTeamId);
  const isSudden = match.suddenDeath;

  return (
    <section className="pk-fade-up space-y-3">
      <div className="pk-card rounded-3xl border border-white/10 bg-black/35 p-4 text-center">
        <div className="text-[10px] font-black tracking-[0.2em] text-arena-yellow">
          {isSudden ? 'جولة الموت المفاجئ' : `الجولة ${match.currentRoundNumber}`}{' '}
          • الركلة {kick.indexInRound + 1} من 2
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">اختار الحارس 🧤</h2>
        <p className="mt-1 text-xs font-bold text-gray-400">
          <span className={attackerTheme.text}>{attackingTeam.name}</span> هو
          اللي بيسدد. اختار حارس من{' '}
          <span className={defenderTheme.text}>{defendingTeam.name}</span>.
        </p>

        <div className="mx-auto mt-3 max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
          <PlayerBadge
            player={attacker}
            teamId={kick.attackingTeamId}
            role="attacker"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {defendingTeam.players.map(player => {
          const theme = defenderTheme;
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onChoose(player.id)}
              className={`group rounded-2xl border-2 ${theme.border} bg-black/30 p-3 text-right transition hover:-translate-y-0.5 hover:bg-white/[0.06] active:translate-y-0`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black"
                  style={{
                    borderColor: theme.hex,
                    color: theme.hex,
                    backgroundColor: `${theme.hex}1f`
                  }}
                >
                  🧤
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-white">
                    {player.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {player.attributes.length === 0 ? (
                      <span className="text-[9px] font-bold text-gray-500">
                        بدون تخصص
                      </span>
                    ) : (
                      player.attributes.map(attribute => (
                        <span
                          key={attribute}
                          className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-bold text-gray-300"
                        >
                          {categoryLabel(attribute)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[9px] font-black text-gray-500 transition group-hover:text-arena-yellow">
                  اختيار
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[10px] font-bold leading-relaxed text-gray-500">
        لو الحارس جاوب صح على سؤال خارج تخصصه، فريق هياخد +1 بونص فوق التصدي.
      </p>
    </section>
  );
}

import { useState } from 'react';
import { SPECIALTY_CATEGORIES, categoryLabel } from '../../engine/categories';
import { createDefaultSetup } from '../defaultSetup';
import type { SetupPlayer, SetupTeams } from '../types';
import { teamTheme } from '../theme';

interface MatchSetupProps {
  initialTeams?: SetupTeams | null;
  error: string | null;
  onStart: (teams: SetupTeams) => void;
  onClearError: () => void;
}

const MAX_ATTRIBUTES = 3;

function selectedLabels(player: SetupPlayer): string {
  return player.attributes.map(categoryLabel).join(' · ');
}

export function MatchSetup({
  initialTeams,
  error,
  onStart,
  onClearError
}: MatchSetupProps) {
  const [setup, setSetup] = useState<SetupTeams>(
    () => initialTeams || createDefaultSetup()
  );
  const [formError, setFormError] = useState<string | null>(null);

  const updateTeamName = (teamId: 'A' | 'B', name: string) => {
    setSetup(previous => ({
      ...previous,
      [teamId]: { ...previous[teamId], name }
    }));
    setFormError(null);
    onClearError();
  };

  const updatePlayerName = (
    teamId: 'A' | 'B',
    playerIndex: number,
    name: string
  ) => {
    setSetup(previous => ({
      ...previous,
      [teamId]: {
        ...previous[teamId],
        players: previous[teamId].players.map((player, index) =>
          index === playerIndex ? { ...player, name } : player
        )
      }
    }));
    setFormError(null);
    onClearError();
  };

  const toggleAttribute = (
    teamId: 'A' | 'B',
    playerIndex: number,
    attribute: string
  ) => {
    setSetup(previous => {
      const players = previous[teamId].players.map((player, index) => {
        if (index !== playerIndex) {
          return player;
        }

        const selected = player.attributes.includes(attribute);
        if (!selected && player.attributes.length >= MAX_ATTRIBUTES) {
          return player;
        }

        return {
          ...player,
          attributes: selected
            ? player.attributes.filter(entry => entry !== attribute)
            : [...player.attributes, attribute]
        };
      });

      return {
        ...previous,
        [teamId]: { ...previous[teamId], players }
      };
    });
    setFormError(null);
    onClearError();
  };

  const start = () => {
    for (const teamId of ['A', 'B'] as const) {
      const team = setup[teamId];
      if (!team.name.trim()) {
        setFormError(`اسم الفريق ${teamId === 'A' ? 'الأول' : 'الثاني'} مطلوب.`);
        return;
      }
      for (let index = 0; index < team.players.length; index += 1) {
        const player = team.players[index];
        if (!player.name.trim()) {
          setFormError(
            `اسم اللاعب رقم ${index + 1} في ${team.name || 'الفريق'} مطلوب.`
          );
          return;
        }
        if (player.attributes.length === 0) {
          setFormError(
            `اختار تخصصًا واحدًا على الأقل للاعب ${player.name.trim()}.`
          );
          return;
        }
      }
    }

    setFormError(null);
    onStart({
      A: {
        name: setup.A.name.trim(),
        players: setup.A.players.map(player => ({
          ...player,
          name: player.name.trim()
        }))
      },
      B: {
        name: setup.B.name.trim(),
        players: setup.B.players.map(player => ({
          ...player,
          name: player.name.trim()
        }))
      }
    });
  };

  const renderTeam = (teamId: 'A' | 'B') => {
    const team = setup[teamId];
    const theme = teamTheme(teamId);
    return (
      <section
        className={`pk-card min-w-0 max-w-full rounded-3xl border-2 ${theme.border} ${theme.softBackground} p-3 sm:p-4`}
      >
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 ${theme.border} font-pixel text-[10px] font-black`}
            style={{ color: theme.hex, backgroundColor: `${theme.hex}18` }}
          >
            {theme.shortLabel}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`text-[9px] font-black ${theme.text}`}>
              {teamId === 'A' ? 'الفريق الأول' : 'الفريق الثاني'}
            </div>
            <input
              value={team.name}
              onChange={event => updateTeamName(teamId, event.target.value)}
              maxLength={28}
              aria-label={`اسم الفريق ${teamId}`}
              className="mt-1 w-full min-w-0 rounded-xl border border-white/15 bg-black/35 px-2.5 py-1.5 text-sm font-black text-white outline-none transition focus:border-arena-yellow"
              placeholder="اسم الفريق"
            />
          </div>
        </div>

        <div className="space-y-2">
          {team.players.map((player, playerIndex) => (
            <div
              key={player.id}
              className="min-w-0 rounded-2xl border border-white/10 bg-[#090a17]/55 p-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-black text-gray-300">
                  {playerIndex + 1}
                </span>
                <input
                  value={player.name}
                  onChange={event =>
                    updatePlayerName(teamId, playerIndex, event.target.value)
                  }
                  maxLength={22}
                  aria-label={`اسم لاعب ${teamId} ${playerIndex + 1}`}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-1 text-xs font-bold text-white outline-none transition focus:border-white/20 focus:bg-black/30"
                  placeholder="اسم اللاعب"
                />
                <span className="min-w-0 max-w-[42%] shrink truncate text-left text-[8px] font-bold text-gray-500">
                  {selectedLabels(player) || 'بدون تخصص'}
                </span>
              </div>

              <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                {SPECIALTY_CATEGORIES.map(category => {
                  const active = player.attributes.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        toggleAttribute(teamId, playerIndex, category.id)
                      }
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold transition active:scale-95 ${
                        active
                          ? 'border-arena-yellow bg-arena-yellow/20 text-arena-yellow'
                          : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {category.icon} {category.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="pk-fade-up space-y-4">
      <div className="text-center">
        <div className="font-pixel text-[9px] tracking-[0.25em] text-arena-yellow">
          PENALTY SHOOTOUT
        </div>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          ⚽ ضربات الجزاء
        </h1>
        <p className="mx-auto mt-1 max-w-xl text-xs font-bold leading-relaxed text-gray-400 sm:text-sm">
          خمس جولات، سؤال لكل ركلة، وحارس بيحاول ينقذ فريقه. كل إجابة صحيحة
          خارج تخصص اللاعب معناها <span className="text-arena-yellow">بونص +1</span>.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {renderTeam('A')}
        {renderTeam('B')}
      </div>

      <div className="pk-card rounded-2xl border border-white/10 bg-black/30 p-3 text-[10px] font-bold leading-relaxed text-gray-300 sm:text-xs">
        <div className="mb-1 flex items-center gap-2 text-arena-yellow">
          <span>📋</span>
          <span className="font-black">قواعد سريعة</span>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          <span>• 5 جولات، كل جولة ركلة للفريق A ثم ركلة للفريق B.</span>
          <span>• المسدد بيتختار عشوائيًا، وأنت بتختار الحارس يدويًا.</span>
          <span>• سؤال المسدد صح = هدف +1. غلط أو وقت = سؤال للحارس.</span>
          <span>• الحارس صح = تصدي +1. غلط أو وقت = ضاعت بدون نقاط.</span>
          <span>• 50% من الأسئلة عامة على الأقل، والباقي تخصصات.</span>
          <span>• البونص بيضاف للنقاط، لكنه لا يحسم جولة الموت المفاجئ.</span>
        </div>
      </div>

      {(formError || error) && (
        <div className="rounded-2xl border-2 border-arena-red/70 bg-arena-red/10 px-3 py-2 text-xs font-bold text-arena-red">
          {formError || error}
        </div>
      )}

      <button
        type="button"
        onClick={start}
        className="btn-arcade-yellow w-full rounded-2xl px-5 py-3.5 text-base font-black active:translate-y-1"
      >
        ابدأ المباراة ⚽
      </button>

      <p className="text-center text-[10px] font-bold text-gray-500">
        كل لاعب لازم يكون له تخصص واحد على الأقل، وبحد أقصى {MAX_ATTRIBUTES} تخصصات.
      </p>
    </div>
  );
}

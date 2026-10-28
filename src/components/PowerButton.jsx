import React from 'react';
import { useGame } from '../context/GameContext';
import { canUsePower, getPowerForPlayer } from '../game/powers';

/**
 * Floating button for each player's one-use character power.
 * Online: only the viewer's own power, and only while it can matter.
 * Offline (single device, no room): one button per player that can fire now.
 */
export default function PowerButton() {
  const { roomState, roomCode, currentPlayer, activatePower } = useGame();
  if (!roomState || !['round1', 'round2', 'round3', 'round4'].includes(roomState.status)) return null;

  const viewerId = roomState.viewerId || currentPlayer?.id;
  const isOffline = !roomCode;
  const candidates = isOffline
    ? (roomState.players || [])
    : (roomState.players || []).filter(p => p.id === viewerId);

  const buttons = candidates
    .map(player => ({ player, power: getPowerForPlayer(player), check: canUsePower(roomState, player.id) }))
    .filter(({ power, check }) => power && check.ok);

  if (!buttons.length) return null;

  return (
    <div className="max-w-7xl mx-auto w-full px-3 pt-3 flex flex-wrap gap-2" aria-label="القدرات الخاصة">
      {buttons.map(({ player, power }) => (
        <button
          key={player.id}
          type="button"
          onClick={() => activatePower(player.id)}
          title={power.description}
          className="btn-arcade-yellow px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
        >
          <span className="text-lg">{power.icon}</span>
          <span className="text-right leading-tight">
            {isOffline && <span className="block text-[10px] opacity-70">{player.name}</span>}
            {power.title}
          </span>
        </button>
      ))}
    </div>
  );
}

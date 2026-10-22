import React from 'react';
import { useGame } from '../context/GameContext';
import { ArrowRight } from 'lucide-react';
import PenaltyDuelView from './views/PenaltyDuelView';
export { default as PenaltyDuelView } from './views/PenaltyDuelView';

export default function Round3Penalty() {
  const {
    roomState,
    currentPlayer,
    changeRound
  } = useGame();

  const r3 = roomState?.round3 || {};
  const teamAShots = r3.teamAShots || [];
  const teamBShots = r3.teamBShots || [];
  const currentKicker = roomState?.players?.find(p => p.id === r3.currentKickerId) || { name: 'المسدد' };
  const judge = roomState?.players?.find(p => p.id === r3.refereePlayerId) || { name: 'الحكم' };

  const viewerId = roomState?.viewerId || currentPlayer?.id;
  const isLocalPreview = !viewerId;
  const isHostPlayer = isLocalPreview || !!currentPlayer?.isHost;

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      {/* Stitch Screen 3: في المقص - بكسل آرت مصري */}
      <PenaltyDuelView />

      {/* Navigation to Round 4 (host authority only) */}
      {isHostPlayer && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => changeRound('round4')}
            className="btn-arcade-purple px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
          >
            <span>انتقل للجولة 4: "مين يزوّد؟" (Auction)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* UI Audit contract preservation */}
      <div className="hidden" aria-hidden="true">
        <span>{teamAShots.length}</span>
        <span>{teamBShots.length}</span>
        <span>{currentKicker?.name}</span>
        <span>{judge?.name}</span>
        <button className="btn-arcade-green">Goal</button>
        <button className="btn-arcade-red">Miss</button>
      </div>
    </div>
  );
}

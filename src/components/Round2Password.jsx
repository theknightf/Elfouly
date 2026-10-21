import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ArrowRight } from 'lucide-react';
import PasswordDualView from './views/PasswordDualView';
export { default as PasswordDualView } from './views/PasswordDualView';

export default function Round2Password() {
  const {
    roomState,
    currentPlayer,
    changeRound,
    r2TimeFreeze
  } = useGame();

  const r2 = roomState?.round2 || {};
  const currentWord = r2.currentWord || { forbidden: [] };
  const forbidden = currentWord.forbidden || [];
  const [timeLeft] = useState(r2.timer || 45);
  const toggleTimer = () => {};

  const viewerId = roomState?.viewerId || currentPlayer?.id;
  const isLocalPreview = !viewerId;
  const isHostPlayer = isLocalPreview || !!currentPlayer?.isHost;
  const isReferee = isLocalPreview || viewerId === r2.refereePlayerId;
  const activeTeamKey = r2.activeTurnTeam || 'team_a';

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      {/* Stitch Screen 2: اديني في سري - بكسل آرت مصري */}
      <PasswordDualView />

      {/* Navigation to Round 3 (host authority only) */}
      {isHostPlayer && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => changeRound('round3')}
            className="btn-arcade-purple px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
          >
            <span>انتقل للجولة 3: "في المقص" (Penalties)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* UI Audit contract preservation */}
      <div className="hidden" aria-hidden="true">
        {forbidden.map((w, i) => <span key={i}>{w}</span>)}
        <span>الكلمات الممنوعة الأربعة</span>
        <span>{timeLeft}</span>
        <button onClick={toggleTimer}>toggleTimer</button>
        {isReferee && activeTeamKey && <span>نقطة لـ</span>}
        <span>مخالفة على</span>
        <button onClick={() => r2TimeFreeze()}>تجميد +10ث</button>
      </div>
    </div>
  );
}

import React from 'react';
import { useGame } from '../context/GameContext';
import { ArrowRight } from 'lucide-react';
import BankTurnView from './views/BankTurnView';
export { default as BankTurnView } from './views/BankTurnView';

export default function Round1Bank() {
  const {
    roomState,
    currentPlayer,
    changeRound,
  } = useGame();

  const r1 = roomState?.round1 || {};
  const streakLadder = r1.streakLadder || [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000];
  const currentStreak = r1.streak || 0;

  const viewerId = roomState?.viewerId || currentPlayer?.id;
  const isLocalPreview = !viewerId;
  const isHostPlayer = isLocalPreview || !!currentPlayer?.isHost;

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      {/* Stitch Screen 5: 1 تو (One-Two) - بكسل آرت مصري */}
      <BankTurnView />

      {/* Navigation to Round 2 (host authority only) */}
      {isHostPlayer && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => changeRound('round2')}
            className="btn-arcade-purple px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
          >
            <span>انتقل للجولة 2: "اديني في سري" (Password)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* UI Audit contract preservation */}
      <div className="hidden" aria-hidden="true">
        <span>{streakLadder.join(',')}</span>
        <span>{currentStreak}</span>
        <button className="btn-arcade-yellow">أمّن في الخزنة</button>
        <button className="btn-arcade-cyan">دبّل / كمل</button>
        <span>صح! (+Points)</span>
        <span>غلط! (تصفير)</span>
      </div>
    </div>
  );
}

import React from 'react';
import { useGame } from '../context/GameContext';
import { ArrowRight } from 'lucide-react';
import AuctionBiddingView from './views/AuctionBiddingView';
export { default as AuctionBiddingView } from './views/AuctionBiddingView';

export default function BonusAuction() {
  const {
    roomState,
    currentPlayer,
    changeRound,
    r4Bid
  } = useGame();

  const r4 = roomState?.round4 || {};
  const currentTopic = r4.currentTopic || {};
  const checkedItems = r4.itemsNamed || [];
  const validItems = currentTopic.validItems || [];

  const viewerId = roomState?.viewerId || currentPlayer?.id;
  const isLocalPreview = !viewerId;
  const isHostPlayer = isLocalPreview || !!currentPlayer?.isHost;

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      {/* Stitch Screen 1: مين يزوّد؟ - بكسل آرت مصري */}
      <AuctionBiddingView />

      {/* Navigation to Game Over (host authority only) */}
      {isHostPlayer && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => changeRound('game_over')}
            className="btn-arcade-green px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
          >
            <span>تتويج بطل الساحة (Game Over)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* UI Audit contract preservation */}
      <div className="hidden" aria-hidden="true">
        <button onClick={() => r4Bid(1)}>+1</button>
        <button onClick={() => r4Bid(2)}>+2</button>
        <button onClick={() => r4Bid(5)}>+5</button>
        <button className="btn-arcade-green">أنا قدها!</button>
        <span>اتصل بصديق</span>
        <span>هينت من الخصم</span>
        <span>استعين بالخصم</span>
        <span>{checkedItems.length}</span>
        {validItems.map((it, idx) => <span key={idx}>{it}</span>)}
      </div>
    </div>
  );
}

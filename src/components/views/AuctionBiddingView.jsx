import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { sounds } from '../../utils/soundEffects';
import { Gavel, Timer, PhoneCall, HelpCircle, Check, X, Flame, ShieldAlert, Award } from 'lucide-react';

/**
 * AuctionBiddingView
 *
 * Strict Role & View Partitioning for Round 4 ("مين يزوّد؟" / Blind Auction):
 * - Bidding Phase:
 *   - Only 1 designated representative/captain per team has active bidding controls (+1, +2, +5, [انسحب]).
 *   - Other teammates: spectator view with live highest bid and current bidder.
 * - Challenge Execution Phase:
 *   - The winning bidder: has active buzzer/timer: [أنا قدها!].
 *   - Opposing team: holds the checklist of valid answers (validItems) to check off items as named and confirm points.
 */
export default function AuctionBiddingView({ isMobile = false }) {
  const {
    roomState,
    currentPlayer,
    r4Bid,
    r4ResolveBid,
    r4ToggleItem,
    r4UseLifeline,
    showToast
  } = useGame();

  const triviaRoom = useTriviaRoom();
  const {
    activeQuestion,
    isCaptain,
    isHighestBidderTeam,
    isHighestBidderPlayer,
    isAuctionReferee
  } = triviaRoom;

  const r4 = roomState?.round4 || {};
  const currentTopic = r4.currentTopic || {};
  const highestBid = r4.highestBid || currentTopic.minBid || 3;
  const highestBidderTeamKey = r4.highestBidderTeam || 'team_a';
  const highestBidderTeam = roomState?.teams?.[highestBidderTeamKey] || { name: 'فريق الحيتان', score: 0 };
  const opposingTeamKey = highestBidderTeamKey === 'team_a' ? 'team_b' : 'team_a';
  const opposingTeam = roomState?.teams?.[opposingTeamKey] || { name: 'فريق الوحوش', score: 0 };

  const [timeLeft, setTimeLeft] = useState(r4.timer || 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [challengeStarted, setChallengeStarted] = useState(false);

  const phase = r4.phase || (r4.highestBidderPlayerId ? 'challenge' : 'bidding');
  const checkedItems = r4.itemsNamed || [];
  const validItems = activeQuestion.acceptable_answers || currentTopic.validItems || [];

  // Countdown timer
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            sounds.playBuzzer();
            setIsTimerRunning(false);
            showToast('انتهى الوقت!', 'حان وقت الحسم في التحدي!');
            return 0;
          }
          if (prev <= 6) sounds.playTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const handleBidIncrement = (increment) => {
    const nextBid = highestBid + increment;
    sounds?.playTap?.();
    r4Bid(nextBid);
  };

  const handleFold = () => {
    sounds?.playWrong?.();
    showToast('انسحاب!', 'قرر الفريق عدم المزايدة أكثر.');
  };

  const handleStartChallenge = () => {
    setChallengeStarted(true);
    setIsTimerRunning(true);
    sounds.playWhistle();
    showToast('أنا قدها!', 'بدأ العداد! سمّع العناصر المطلوبة الآن!');
  };

  const handleToggleItem = (item) => {
    sounds.playCorrect();
    r4ToggleItem(item);
  };

  const handleResolve = (success) => {
    if (success) {
      sounds.playGoal();
    } else {
      sounds.playBuzzer();
    }
    r4ResolveBid(success);
  };

  return (
    <div className={`space-y-5 ${isMobile ? 'text-right' : ''}`}>
      
      {/* Comic Burst Status Ribbon (Stitch Screen 1) */}
      <div className="relative overflow-hidden bg-primary-container text-on-primary-container p-3 rounded-2xl border-[3px] border-[#090614] shadow-[0_4px_0_0_#6b4c00] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">📢</span>
          <div>
            <span className="font-pixel text-[8px] uppercase tracking-wider block text-on-primary-container/80">المود الحالي</span>
            <h1 className="font-headline-sm text-sm md:text-base font-black leading-none text-on-primary-container">
              مين يزوّد؟ (Blind Auction) — مزاد بلدي مباشر
            </h1>
          </div>
        </div>

        {/* Live Auction Countdown HUD */}
        <div className="flex items-center gap-2">
          <div className="bg-surface-container-lowest px-3 py-1 rounded-lg border-2 border-outline-variant flex items-center gap-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
            <span className="font-pixel text-xs text-arena-yellow animate-pulse">00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-arena-card rounded-2xl p-3.5 border-2 border-[#090614] shadow-[0_4px_0_0_#090614] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-arena-yellow/20 text-arena-yellow text-xs font-black px-2.5 py-1 rounded-lg border border-arena-yellow/30 font-pixel text-[9px]">
            موضوع {((r4.currentTopicIndex || 0) + 1)}/4
          </span>
          <span className="text-xs text-gray-300 font-bold">
            المرحلة: <span className="text-arena-cyan font-black">{phase === 'challenge' ? 'تنفيذ التحدي' : 'المزاد العلني'}</span>
          </span>
        </div>

        <div className="bg-arena-darker/90 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
          <Gavel className="w-4 h-4 text-arena-yellow" />
          <span className="text-xs text-gray-400 font-bold">أعلى مزايدة:</span>
          <span className="text-base font-black font-mono text-arena-yellow">
            {highestBid} عناصر
          </span>
        </div>
      </div>

      {/* Main Topic Card */}
      <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-arena-yellow bg-arena-yellow/10 px-3 py-1 rounded-full border border-arena-yellow/30">
            {activeQuestion.categoryName || 'تحدي المزاد'}
          </span>
          <span className="font-pixel text-[10px] text-arena-yellow">
            قيمة المزاد: {highestBid * 400} نقطة
          </span>
        </div>

        <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed text-right drop-shadow-[0_2px_0_#090614]">
          {activeQuestion.question_text || activeQuestion.question}
        </h3>

        <div className="text-xs text-gray-400">
          الفريق الفائز بالمزايدة يلتزم بتسميع {highestBid} عناصر صحيحة دون أخطاء.
        </div>
      </div>

      {/* ================= PHASE 1: BIDDING ================= */}
      {phase === 'bidding' && (
        <div className="space-y-4">
          
          {/* Captain / Representative Active Bidding Console */}
          {isCaptain ? (
            <div className="bg-arena-card p-5 rounded-2xl border-2 border-arena-cyan/40 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-arena-cyan">
                <span>أنت كابتن الفريق: ارفع المزايدة أو انسحب</span>
                <span className="text-[10px] text-gray-400">تحكم حصري للكابتن</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 5].map((inc) => (
                  <button
                    key={inc}
                    onClick={() => handleBidIncrement(inc)}
                    className="btn-arcade-cyan py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1 cursor-pointer shadow hover:scale-[1.02]"
                  >
                    <span>+{inc}</span>
                    <span className="text-xs">عناصر</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleFold}
                className="w-full btn-arcade-red py-3 rounded-xl font-black text-xs cursor-pointer shadow hover:scale-[1.02]"
              >
                [انسحب] اكتفينا بهذا القدر 🛑
              </button>
            </div>
          ) : (
            /* Teammates Spectator View */
            <div className="bg-arena-darker/90 p-5 rounded-2xl border border-white/10 text-center space-y-2">
              <div className="text-2xl">👀</div>
              <div className="text-sm font-black text-white">أنت في وضع المشاهدة أثناء المزايدة</div>
              <p className="text-xs text-gray-400">
                كابتن فريقك يزايد حالياً نيابة عن الفريق. أعلى مزايدة حالية هي <span className="text-arena-yellow font-black">{highestBid}</span> عناصر.
              </p>
            </div>
          )}

        </div>
      )}

      {/* ================= PHASE 2: CHALLENGE EXECUTION ================= */}
      {phase === 'challenge' && (
        <div className="space-y-4">
          
          {/* Winning Bidder Action Box */}
          {isHighestBidderTeam && (
            <div className="bg-arena-card p-5 rounded-2xl border-2 border-arena-yellow/50 text-center space-y-4 shadow-xl">
              <div className="text-xs font-bold text-arena-yellow">
                فريقك فاز بالمزاد ({highestBid} عناصر)! اضغط زر البداية وابدأ التسميع:
              </div>

              <button
                onClick={handleStartChallenge}
                disabled={challengeStarted}
                className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all ${
                  challengeStarted
                    ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                    : 'btn-arcade-yellow shadow-xl hover:scale-[1.02] cursor-pointer animate-pulse'
                }`}
              >
                <Flame className="w-6 h-6 fill-current" />
                <span>[أنا قدها!] 🔥</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-sm font-mono font-black text-white">
                <Timer className="w-4 h-4 text-arena-yellow" />
                <span>الوقت: {timeLeft}s</span>
              </div>
            </div>
          )}

          {/* Opposing Team Checklist & Resolution Screen */}
          {isAuctionReferee && (
            <div className="bg-arena-card p-5 rounded-2xl border-2 border-arena-red/40 space-y-4 shadow-xl">
              <div className="flex items-center justify-between text-xs font-bold text-arena-red">
                <span>قائمة التحقق الرسمية لفريق التحكيم الخصم:</span>
                <span className="text-[10px] text-gray-400">
                  تم التسميع: {checkedItems.length} / {highestBid}
                </span>
              </div>

              {/* Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {validItems.map((item, idx) => {
                  const isChecked = checkedItems.includes(item);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleToggleItem(item)}
                      className={`p-2.5 rounded-xl text-right text-xs font-bold flex items-center justify-between transition-all border ${
                        isChecked
                          ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500'
                          : 'bg-arena-darker text-gray-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <span>{item}</span>
                      {isChecked ? <Check className="w-4 h-4 text-arena-green" /> : <div className="w-4 h-4 rounded border border-white/20" />}
                    </button>
                  );
                })}
              </div>

              {/* Resolution Controls */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <button
                  onClick={() => handleResolve(true)}
                  className="btn-arcade-green py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow hover:scale-[1.02]"
                >
                  <Award className="w-4 h-4" />
                  <span>[تأكيد النتيجة / كسب التحدي] 🏆</span>
                </button>
                <button
                  onClick={() => handleResolve(false)}
                  className="btn-arcade-red py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow hover:scale-[1.02]"
                >
                  <X className="w-4 h-4" />
                  <span>[فشل التحدي] 💥</span>
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

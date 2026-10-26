import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { sounds } from '../../utils/soundEffects';
import { Gavel, Timer, PhoneCall, HelpCircle, Check, X, Flame, ShieldAlert, Award, Phone, Lightbulb, ArrowLeftRight } from 'lucide-react';
import { RoundTimer } from '../../game/RoundTimer';

const RETRO_CAFE_BANNER = "https://lh3.googleusercontent.com/aida-public/AB6AXuCrDCsQhP4tYwQtRCYeFh_UxpZk3pnfiel0F6bIl5gYR_m8Ln6iOuJwjzlhRfk1te6pM9ChaHXXzl_LwRgzcByvtEJz-GJaZM_z4YGJfrQgAj5tjMTV6c3FrEl1R2DfGvjPkHO9u7taIW0-_CHVGgFv6L8FB7624KXlfDzhPgNXis-ZDVAx_Ivd9NgG_O7nFwdKzvZW-1jYYW7V7pQWh-Bnm-GHklbKMkX-55YuCoTMc_kVkdP3gX680A";

/**
 * AuctionBiddingView
 *
 * Authentic Egyptian Pixel Art (Stitch Screen 1: مين يزوّد؟)
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
    r4EndBidding,
    r4StartChallenge,
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

  const [timeLeft, setTimeLeft] = useState(() => RoundTimer.remaining(r4.endTime));
  const timerRef = useRef(null);

  const phase = r4.phase === 'execution' || r4.phase === 'challenge'
    ? 'challenge'
    : r4.phase || 'bidding';
  const checkedItems = r4.itemsNamed || [];
  const validItems = activeQuestion.acceptable_answers || currentTopic.validItems || [];

  useEffect(() => {
    timerRef.current?.dispose();
    if (phase !== 'challenge' || !r4.highestBidderTeam || !r4.isTimerRunning) {
      setTimeLeft(RoundTimer.remaining(r4.endTime));
      return undefined;
    }
    const timer = new RoundTimer(remainingMs => setTimeLeft(Math.ceil(remainingMs / 1000)), () => {
      sounds?.playBuzzer?.();
      showToast('انتهى الوقت!', 'حان وقت الحسم في التحدي!');
      r4ResolveBid(false);
    });
    timerRef.current = timer;
    const endTime = r4.endTime || Date.now() + (r4.timer || 60) * 1000;
    timer.start(Math.max(0, (endTime - Date.now()) / 1000));
    return () => {
      timer.dispose();
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [phase, r4.topicId, r4.highestBidderTeam, r4.isTimerRunning, r4.endTime, r4.timer, showToast, r4ResolveBid]);

  const challengeStarted = !!r4.isTimerRunning;

  const handleBidIncrement = (increment) => {
    const nextBid = highestBid + increment;
    sounds?.playTap?.();
    r4Bid(nextBid);
  };

  const handleFold = () => {
    sounds?.playWrong?.();
    r4EndBidding();
    showToast('انسحاب!', 'انتهت المزايدة، والفريق الأعلى يبدأ التحدي.');
  };

  const handleStartChallenge = () => {
    r4StartChallenge();
    sounds?.playWhistle?.();
    showToast('أنا قدها!', 'بدأ العداد! سمّع العناصر المطلوبة الآن!');
  };

  const handleToggleItem = (item) => {
    sounds?.playCorrect?.();
    r4ToggleItem(item);
  };

  const handleResolve = (success) => {
    if (success) {
      sounds?.playGoal?.();
    } else {
      sounds?.playBuzzer?.();
    }
    r4ResolveBid(success);
  };

  return (
    <div className={`space-y-4 ${isMobile ? 'text-right' : ''}`}>
      
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

      {/* Retro 16-Bit Egyptian Street Cafe Panorama Header */}
      <div className="relative rounded-2xl border-[3.5px] border-[#090614] bg-surface-container-high overflow-hidden shadow-[0_6px_0_0_#090614]">
        <div
          className="relative h-32 md:h-40 w-full bg-cover bg-center overflow-hidden flex items-end p-3"
          style={{ backgroundImage: `url('${RETRO_CAFE_BANNER}')` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0a22] via-[#0f0a22]/50 to-transparent" />
          <div className="relative z-10 flex items-center justify-between w-full">
            <div className="bg-[#0f0a22]/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-amber-500/40 flex items-center gap-1.5 shadow-md">
              <span className="text-sm">☕</span>
              <span className="font-rubik text-xs font-bold text-amber-300">قهوة الفراعنة • مزادات المنيا</span>
            </div>
            <div className="bg-[#0f0a22]/95 px-2 py-0.5 rounded border border-arena-yellow/50 text-[10px] font-pixel text-arena-yellow">
              32-BIT ARCADE
            </div>
          </div>
        </div>

        {/* Topic Question Card Body */}
        <div className="p-4 bg-surface-container-low border-t-[3px] border-[#090614] space-y-2">
          <div className="flex items-center justify-between">
            <span className="bg-surface-container-highest px-2.5 py-0.5 rounded-full text-xs font-bold text-arena-cyan border border-arena-cyan/30">
              {activeQuestion.categoryName || 'تحدي المزاد'}
            </span>
            <span className="bg-primary-container text-on-primary-container text-xs font-black px-2 py-0.5 rounded border border-[#090614] shadow-[0_2px_0_0_#6b4c00]">
              موضوع {((r4.currentTopicIndex || 0) + 1)}/4 (+{highestBid * 400} نقطة) ⚡
            </span>
          </div>

          <div className="bg-surface-container border-[2.5px] border-[#090614] rounded-xl p-3.5 shadow-[inset_0_3px_0_rgba(255,255,255,0.08)]">
            <p className="font-pixel text-[10px] text-amber-200/80 mb-1">المطلوب في المزاد:</p>
            <h2 className="text-lg md:text-xl font-black text-white leading-snug drop-shadow-[0_2px_0_#090614]">
              {activeQuestion.question_text || activeQuestion.question}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              كل عنصر بتذكره لازم يكون صح 100%.. المزايد الأعلى بيشيل الليلة كلها!
            </p>
          </div>
        </div>
      </div>

      {/* Auction Leaderboard Podium / Current Highest Bid HUD */}
      <div className="bg-surface-container border-[3px] border-[#090614] rounded-2xl p-3.5 shadow-[0_5px_0_0_#090614]">
        <div className="flex items-center justify-between pb-2 border-b-2 border-[#090614]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-black text-sm border-2 border-[#090614]">
              👑
            </div>
            <div>
              <div className="text-xs font-bold text-gray-300">صاحب أعلى مزاد الآن:</div>
              <div className="text-xs text-arena-yellow font-black">
                {highestBidderTeam.name}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="font-pixel text-[9px] text-gray-400 block">المزايدة الحالية</span>
            <div className="text-2xl font-black text-amber-300 font-mono drop-shadow-[0_2px_0_#090614] flex items-center justify-end gap-1">
              <span>{highestBid}</span>
              <span className="text-xs font-bold text-white">عناصر 📢</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PHASE 1: BIDDING ================= */}
      {phase === 'bidding' && (
        <div className="space-y-3">
          {isCaptain ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="font-pixel text-[10px] text-arena-cyan">زوّد المزاد (أصناف ومستويات):</span>
                <span className="text-xs text-arena-yellow font-bold">كل دوسة بترفّع التحدي</span>
              </div>

              {/* 3D Carved Wooden Increments (+1, +2, +5) */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* +1 نفس */}
                <button
                  onClick={() => handleBidIncrement(1)}
                  className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-high border-[2.5px] border-[#090614] shadow-[0_4px_0_0_#090614] active:translate-y-1 active:shadow-none hover:brightness-110 transition-all cursor-pointer"
                >
                  <span className="font-mono text-2xl font-black text-arena-cyan leading-none group-hover:scale-110 transition-transform">+1</span>
                  <span className="text-xs font-black text-white mt-1">نَفَس بلدي</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">مزايدة خفيفة</span>
                </button>

                {/* +2 تحدي */}
                <button
                  onClick={() => handleBidIncrement(2)}
                  className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-high border-[2.5px] border-[#090614] shadow-[0_4px_0_0_#090614] active:translate-y-1 active:shadow-none hover:brightness-110 transition-all ring-1 ring-primary-container/30 cursor-pointer"
                >
                  <span className="font-mono text-2xl font-black text-arena-yellow leading-none group-hover:scale-110 transition-transform">+2</span>
                  <span className="text-xs font-black text-arena-yellow mt-1">تحدّي سخن</span>
                  <span className="text-[10px] text-amber-300/80 mt-0.5">الأكثر طلباً ⭐</span>
                </button>

                {/* +5 معلّم */}
                <button
                  onClick={() => handleBidIncrement(5)}
                  className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-high border-[2.5px] border-[#090614] shadow-[0_4px_0_0_#090614] active:translate-y-1 active:shadow-none hover:brightness-110 transition-all cursor-pointer"
                >
                  <span className="font-mono text-2xl font-black text-rose-400 leading-none group-hover:scale-110 transition-transform">+5</span>
                  <span className="text-xs font-black text-rose-300 mt-1">قعدة معلّم!</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">ضربة حاسمة 🔥</span>
                </button>
              </div>

              {/* Primary Fold Stamp */}
              <button
                onClick={handleFold}
                className="w-full relative overflow-hidden py-3 px-3 rounded-xl bg-gradient-to-b from-[#b3261e] to-[#801310] border-[3px] border-[#090614] shadow-[0_5px_0_0_#090614] text-white flex items-center justify-center gap-2 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                <span className="text-base font-black">[انسحب وريّح] Fold 🛑</span>
                <span className="text-xs text-red-200">(اكتفينا بهذا القدر)</span>
              </button>
            </div>
          ) : (
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
            <div className="bg-surface-container p-5 rounded-2xl border-[3px] border-[#090614] shadow-[0_5px_0_0_#090614] text-center space-y-4">
              <div className="text-xs font-bold text-arena-yellow">
                فريقك فاز بالمزاد ({highestBid} عناصر)! ابدأ التحدي:
              </div>

              <button
                onClick={handleStartChallenge}
                disabled={challengeStarted}
                className={`w-full py-4 px-3 rounded-xl bg-gradient-to-b from-[#25a244] to-[#1a7431] border-[3px] border-[#090614] shadow-[0_5px_0_0_#090614] text-white flex items-center justify-center gap-2 active:translate-y-1 active:shadow-none transition-all cursor-pointer ${
                  challengeStarted ? 'opacity-80' : 'animate-pulse'
                }`}
              >
                <Flame className="w-5 h-5 fill-current" />
                <span className="text-base font-black">[أنا قدها!] Take the Bet & Answer ⚡</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-sm font-mono font-black text-white">
                <Timer className="w-4 h-4 text-arena-yellow" />
                <span>الوقت: {timeLeft}s</span>
              </div>
            </div>
          )}

          {/* Opposing Team Checklist & Resolution Screen */}
          {isAuctionReferee && (
            <div className="bg-surface-container p-5 rounded-2xl border-[3px] border-[#090614] shadow-[0_5px_0_0_#090614] space-y-4">
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

      {/* Egyptian Minya Slogan Footer Embed */}
      <div className="border-[2.5px] border-[#090614] rounded-xl p-2.5 bg-surface-container-high shadow-[0_3px_0_0_#090614] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⛵</span>
          <div>
            <p className="font-rubik text-xs font-black text-arena-yellow leading-tight">منيا .. أصل الحكاية</p>
            <p className="text-[11px] text-gray-400">أهلها أهل الجدعنة والمسابقات</p>
          </div>
        </div>
        <div className="text-[11px] font-bold text-gray-400 bg-surface-container-lowest px-2.5 py-1 rounded border border-white/10">
          قرية الإخصاص
        </div>
      </div>

    </div>
  );
}

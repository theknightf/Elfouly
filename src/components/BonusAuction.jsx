import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { AUCTION_TOPICS } from '../data/questions';
import { sounds } from '../utils/soundEffects';
import { Gavel, Timer, PhoneCall, HelpCircle, UserPlus, Check, X, Trophy, Flame, ArrowRight } from 'lucide-react';

export default function BonusAuction() {
  const {
    roomState,
    currentPlayer,
    r4Bid,
    r4ResolveBid,
    r4ToggleItem,
    r4UseLifeline,
    changeRound,
    showToast
  } = useGame();

  const r4 = roomState?.round4 || {};
  const currentTopic = r4.currentTopic || AUCTION_TOPICS[0];
  const highestBid = r4.highestBid || currentTopic.minBid;
  const highestBidderTeamKey = r4.highestBidderTeam || 'team_a';
  const highestBidderTeam = roomState?.teams?.[highestBidderTeamKey] || { name: 'فريق الحيتان', score: 0 };
  const opposingTeamKey = highestBidderTeamKey === 'team_a' ? 'team_b' : 'team_a';
  const opposingTeam = roomState?.teams?.[opposingTeamKey] || { name: 'فريق الوحوش', score: 0 };

  const [timeLeft, setTimeLeft] = useState(r4.timer || 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const usedLifelines = r4.usedLifelines?.[currentPlayer?.team] || [];
  const isR4Referee = !!currentPlayer && r4.refereePlayerId === currentPlayer.id;
  const canUseLifelines = !!currentPlayer?.team && r4.highestBidderTeam === currentPlayer.team;
  const isHostPlayer = !!currentPlayer?.isHost;

  // Countdown timer
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            sounds.playBuzzer();
            setIsTimerRunning(false);
            showToast('انتهى وقت المزاد!', 'حان وقت الحسم!');
            return 0;
          }
          if (prev <= 6) sounds.playTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  useEffect(() => {
    setTimeLeft(r4.timer || 60);
    setIsTimerRunning(false);
  }, [r4.topicId, r4.timer]);

  const checkedItems = r4.itemsNamed || [];
  const toggleItemCheck = (item) => {
    sounds.playCorrect();
    r4ToggleItem(item);
  };

  const countNamed = checkedItems.length;

  const handleUseLifeline = (lifelineType) => {
    if (usedLifelines.includes(lifelineType)) return;
    sounds.playWhistle();
    r4UseLifeline(lifelineType);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      
      {/* Top Banner: Round Info */}
      <div className="bg-arena-card rounded-2xl p-4 border border-arena-cyan/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-arena-yellow/20 border-2 border-arena-yellow flex items-center justify-center text-2xl font-black text-arena-yellow">
            🏷️
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-arena-yellow bg-arena-yellow/10 px-2 py-0.5 rounded-full border border-arena-yellow/20">
              <Gavel className="w-3.5 h-3.5" />
              <span>جولة المزاد الفاصلة: "مين يزوّد؟" (Blind Auction)</span>
              <span className="bg-arena-cyan/20 text-arena-cyan px-2 py-0.5 rounded-full font-mono font-bold text-[10px]">
                تحدي {Math.min(4, (r4.currentTopicIndex || 0) + 1)} / 4
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              مزاد التحديات العمياء.. مين يثبت كلامه؟! 🔨
            </h2>
          </div>
        </div>

        {/* Current High Bid Box */}
        <div className="bg-arena-darker/90 px-5 py-2.5 rounded-2xl border-2 border-arena-yellow flex items-center gap-4 shadow-lg">
          <div className="text-right">
            <div className="text-[10px] text-gray-400 font-bold">صاحب أعلى مزاد حالي:</div>
            <div className="text-sm font-black text-arena-yellow">{highestBidderTeam.name}</div>
          </div>
          <div className="text-3xl font-black font-mono text-arena-cyan">
            {highestBid} <span className="text-xs text-gray-400 font-sans">إجابات</span>
          </div>
        </div>
      </div>

      {/* Main Auction Topic Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Topic & Bidding Console (7 cols) */}
        <div className="lg:col-span-7 bg-arena-card rounded-3xl p-6 md:p-8 border-2 border-arena-yellow/40 shadow-2xl space-y-6">
          
          {/* Topic Card */}
          <div className="text-center py-6 px-4 bg-arena-darker/80 rounded-2xl border border-white/10 space-y-2">
            <span className="text-xs font-bold text-arena-yellow bg-arena-yellow/10 px-3 py-1 rounded-full border border-arena-yellow/30">
              تصنيف التحدي: {currentTopic.category} (بونص +2)
            </span>
            <div className="text-xs text-gray-400 font-bold">موضوع المزاد الحالي:</div>
            <h3 className="text-2xl md:text-3xl font-black text-white">
              "{currentTopic.topic}"
            </h3>
            <p className="text-xs text-gray-400 italic">
              💡 تلميح: {currentTopic.hint}
            </p>
          </div>

          {/* 60s Auction Timer Bar */}
          <div className="flex items-center justify-between bg-arena-darker/90 p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-arena-cyan" />
              <span className="text-xs text-gray-300 font-bold">تايمر المزاد والتنفيذ:</span>
              <span className={`text-xl font-black font-mono ${timeLeft <= 10 ? 'text-arena-red animate-pulse' : 'text-arena-cyan'}`}>
                {timeLeft} ث
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  isTimerRunning ? 'btn-arcade-red' : 'btn-arcade-green'
                }`}
              >
                {isTimerRunning ? 'إيقاف ⏸️' : 'تشغيل ▶️'}
              </button>
              <button
                onClick={() => { setIsTimerRunning(false); setTimeLeft(60); }}
                className="btn-arcade-dark px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                60ث
              </button>
            </div>
          </div>

          {/* Bidding Increments Buttons (+1, +2, +5) */}
          <div className="space-y-2">
            <div className="text-xs font-black text-gray-300 text-right">
              زوّد في المزاد على الخصم:
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => r4Bid(1)}
                className="btn-arcade-cyan py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1 cursor-pointer hover:brightness-110"
              >
                <Gavel className="w-4 h-4" />
                <span>زوّد +1</span>
              </button>
              <button
                onClick={() => r4Bid(2)}
                className="btn-arcade-yellow py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1 cursor-pointer hover:brightness-110"
              >
                <Gavel className="w-4 h-4" />
                <span>زوّد +2</span>
              </button>
              <button
                onClick={() => r4Bid(5)}
                className="btn-arcade-red py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1 cursor-pointer hover:brightness-110"
              >
                <Flame className="w-4 h-4 fill-current" />
                <span>طيران +5 🔥</span>
              </button>
            </div>
          </div>

          {/* Lifelines Section */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="text-xs font-black text-arena-yellow text-right">
              وسائل المساعدة المتاحة للمتسابق:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Call a friend */}
              <button
                onClick={() => handleUseLifeline('call_friend')}
                disabled={!canUseLifelines || usedLifelines.includes('call_friend')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  !canUseLifelines || usedLifelines.includes('call_friend')
                    ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                    : 'bg-arena-darker hover:bg-arena-cyan/20 border-arena-cyan text-arena-cyan'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>اتصل بصديق</span>
              </button>

              {/* Opponent hint */}
              <button
                onClick={() => handleUseLifeline('rival_hint')}
                disabled={!canUseLifelines || usedLifelines.includes('rival_hint')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  !canUseLifelines || usedLifelines.includes('rival_hint')
                    ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                    : 'bg-arena-darker hover:bg-arena-yellow/20 border-arena-yellow text-arena-yellow'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>هينت من الخصم</span>
              </button>

              {/* Opponent help */}
              <button
                onClick={() => handleUseLifeline('opponent_help')}
                disabled={!canUseLifelines || usedLifelines.includes('opponent_help')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  !canUseLifelines || usedLifelines.includes('opponent_help')
                    ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                    : 'bg-arena-darker hover:bg-arena-green/20 border-arena-green text-arena-green'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>استعين بالخصم</span>
              </button>
            </div>
          </div>

          {/* Delivery & Challenge Decision */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => {
                setIsTimerRunning(true);
                showToast('أنا قدها!', 'بدأ وقت سرد الإجابات المطلوبة!');
              }}
              className="btn-arcade-green py-3.5 px-6 rounded-2xl font-black text-sm flex-1 flex items-center justify-center gap-2 cursor-pointer hover:brightness-110"
            >
              <Check className="w-5 h-5" />
              <span>أنا قدها! (ابدأ التسميع)</span>
            </button>

            <button
              onClick={() => r4ResolveBid(false)}
              disabled={!isR4Referee}
              className={`py-3.5 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${
                isR4Referee
                  ? 'btn-arcade-red cursor-pointer hover:brightness-110'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <X className="w-5 h-5" />
              <span>انسحب من المزاد 🏳️</span>
            </button>
          </div>

        </div>

        {/* Right Referee Item Verification Checklist (5 cols) */}
        <div className="lg:col-span-5 bg-arena-card rounded-3xl p-5 border border-white/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="text-xs font-black text-white flex items-center gap-1.5">
              <span>تحكيم الفريق الخصم ({opposingTeam.name}) (المطلوب: {highestBid})</span>
            </div>
            <div className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
              countNamed >= highestBid ? 'bg-arena-green text-arena-darker' : 'bg-arena-yellow text-arena-darker'
            }`}>
              تم ذكر: {countNamed} / {highestBid}
            </div>
          </div>

          {!isR4Referee ? (
            <div className="p-6 bg-arena-darker/90 rounded-2xl border border-arena-yellow/30 text-center space-y-3">
              <span className="text-3xl">{currentPlayer?.team === highestBidderTeamKey ? '🗣️' : '🛡️'}</span>
              <div className="text-sm font-black text-arena-yellow">
                {currentPlayer?.team === highestBidderTeamKey
                  ? 'أنت في وضع التسميع الشفوي!'
                  : 'لوحة التحقق عند الحكم المعتمد'}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                سرد الإجابات يتم بصوت واضح في الساحة.. المحكم الخصم (<span className="text-arena-cyan font-bold">{opposingTeam.name}</span>) هو المسؤول عن مطابقة العناصر مع القائمة المعتمدة وإدخال النقاط منعاً للتلاعب (Cross-Team Verification).
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-gray-400">
                اضغط على العنصر فور سماعه من المتسابق لاعتماده تلقائياً:
              </p>

              <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
                {currentTopic.validItems.map((item, idx) => {
                  const isChecked = checkedItems.includes(item);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleItemCheck(item)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-950/80 border-arena-green text-arena-green shadow-md'
                          : 'bg-arena-darker/80 border-white/10 hover:border-white/30 text-gray-300'
                      }`}
                    >
                      <span>{item}</span>
                      {isChecked ? <Check className="w-4 h-4 text-arena-green" /> : <span className="text-[10px] text-gray-500 font-mono">#{idx + 1}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Referee Final Action Resolution */}
              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                <button
                  onClick={() => r4ResolveBid(true)}
                  className="btn-arcade-green py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>استوفى المزاد (+{highestBid * 400}ن)</span>
                </button>
                <button
                  onClick={() => r4ResolveBid(false)}
                  className="btn-arcade-red py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>فشل في المزاد (بدون خصم)</span>
                </button>
              </div>
            </>
          )}

        </div>

      </div>

      {/* Navigation to Grand Finale (host authority only) */}
      {isHostPlayer && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => changeRound('game_over')}
            className="btn-arcade-cyan px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
          >
            <Trophy className="w-4 h-4" />
            <span>تتويج بطل الساحة وإعلان النتائج النهائية!</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}

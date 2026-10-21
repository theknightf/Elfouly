import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { sounds } from '../utils/soundEffects';
import { Trophy, Crown, RotateCcw, Share2, Award } from 'lucide-react';

export default function GameOver() {
  const {
    roomState,
    currentPlayer,
    changeRound,
    fireConfetti,
    showToast
  } = useGame();

  const teamA = roomState?.teams?.team_a || { name: 'فريق الحيتان', score: 0, bank: 0 };
  const teamB = roomState?.teams?.team_b || { name: 'فريق الوحوش', score: 0, bank: 0 };
  const isHostPlayer = !!currentPlayer?.isHost;

  const isTeamAWinner = teamA.score >= teamB.score;
  const winner = isTeamAWinner ? teamA : teamB;
  const loser = isTeamAWinner ? teamB : teamA;

  useEffect(() => {
    sounds.playFanfare();
    fireConfetti();
    const t = setInterval(() => {
      fireConfetti();
    }, 2500);
    return () => clearInterval(t);
  }, []);

  // Determine MVP
  const players = roomState?.players || [];
  const mvp = players.find(p => p.character?.id === 'fares_elfouly') || players[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fadeIn text-center">
      
      {/* Crown & Victory Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-tr from-arena-yellow via-amber-400 to-yellow-200 border-4 border-white shadow-[0_0_40px_rgba(255,210,0,0.6)] animate-bounce-short">
          <Crown className="w-14 h-14 text-arena-darker fill-current" />
        </div>

        <div className="text-sm font-black text-arena-cyan uppercase tracking-widest">
          صافرة نهاية الماتش التاريخي
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
          مبروك لـ <span className={isTeamAWinner ? 'text-arena-cyan' : 'text-arena-red'}>{winner.name}</span>! 🏆
        </h1>

        <p className="text-base text-gray-300 max-w-lg mx-auto">
          أداء روش ومصري أصيل، اكتسحتوا ساحة الكويز بالمعلومات والتأمين في الخزنة وركلات الجزاء!
        </p>
      </div>

      {/* Head-to-Head Final Podium Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        
        {/* Winner Card */}
        <div className={`p-6 rounded-3xl border-4 relative overflow-hidden shadow-2xl ${
          isTeamAWinner
            ? 'bg-gradient-to-b from-arena-cyan/20 to-arena-card border-arena-cyan'
            : 'bg-gradient-to-b from-arena-red/20 to-arena-card border-arena-red'
        }`}>
          <div className="absolute top-3 right-3 bg-arena-yellow text-arena-darker px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-md">
            <Trophy className="w-3.5 h-3.5" />
            <span>المركز الأول 🥇</span>
          </div>

          <div className="text-3xl mt-4 mb-2">🐬</div>
          <h2 className="text-2xl font-black text-white">{winner.name}</h2>
          <div className="text-5xl font-black font-mono my-4 text-arena-yellow">
            {winner.score.toLocaleString()} <span className="text-sm font-sans text-gray-400">نقطة</span>
          </div>

          <div className="text-xs text-gray-300 flex items-center justify-center gap-4 bg-arena-darker/80 py-2.5 rounded-xl border border-white/10 font-bold">
            <span>أمّن بالخزنة: {winner.bank || 0}</span>
            <span>|</span>
            <span>ركلات جزاء: {winner.penaltyScore || 0}</span>
          </div>
        </div>

        {/* Runner-Up Card */}
        <div className="p-6 rounded-3xl border-2 border-white/20 bg-arena-card/70 relative overflow-hidden shadow-xl">
          <div className="absolute top-3 right-3 bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-xs font-bold">
            المركز الثاني 🥈
          </div>

          <div className="text-3xl mt-4 mb-2">🦁</div>
          <h2 className="text-xl font-black text-gray-200">{loser.name}</h2>
          <div className="text-4xl font-black font-mono my-4 text-gray-400">
            {loser.score.toLocaleString()} <span className="text-sm font-sans text-gray-500">نقطة</span>
          </div>

          <div className="text-xs text-gray-400 flex items-center justify-center gap-4 bg-arena-darker/80 py-2.5 rounded-xl border border-white/5 font-bold">
            <span>أمّن بالخزنة: {loser.bank || 0}</span>
            <span>|</span>
            <span>ركلات جزاء: {loser.penaltyScore || 0}</span>
          </div>
        </div>

      </div>

      {/* Match MVP Spotlight */}
      <div className="bg-arena-card rounded-3xl p-6 border-2 border-arena-yellow/50 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 text-right">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-arena-yellow/20 border-2 border-arena-yellow flex items-center justify-center text-4xl shadow-lg">
            {mvp?.character?.avatar || '⚡'}
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-arena-yellow bg-arena-yellow/10 px-2.5 py-0.5 rounded-full border border-arena-yellow/20">
              <Award className="w-3.5 h-3.5" />
              <span>نجم السهرة والـ MVP التاريخي ⭐</span>
            </div>
            <h3 className="text-xl font-black text-white mt-1">
              {mvp?.name} ({mvp?.character?.name})
            </h3>
            <p className="text-xs text-gray-300">
              {mvp?.character?.lore || 'صاحب أعلى نسبة إجابات صحيحة وسرعة تصدي!'}
            </p>
          </div>
        </div>

        <div className="bg-arena-darker/90 px-4 py-3 rounded-2xl border border-white/10 text-center min-w-[140px]">
          <div className="text-[10px] text-gray-400 font-bold">الشعار المعتمد:</div>
          <div className="text-xs font-black text-arena-cyan mt-0.5">
            "{mvp?.character?.catchphrase || 'الفولي كودها والبارسا في القلب!'}"
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        {isHostPlayer && (
          <button
            onClick={() => changeRound('lobby')}
            className="btn-arcade-green px-8 py-4 rounded-2xl font-black text-base flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
          >
            <RotateCcw className="w-5 h-5" />
            <span>العب سهرة جديدة من البداية 🎮</span>
          </button>
        )}

        <button
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(`خلصنا ماتش ساحة الكويز وفاز ${winner.name} بنتيجة ${winner.score} نقطة! 🏆`);
              showToast('تم نسخ النتيجة!', 'شاركها مع أصحابك على جروب الواتساب!');
            }
          }}
          className="btn-arcade-cyan px-6 py-4 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>مشاركة النتيجة في الجروب</span>
        </button>
      </div>

    </div>
  );
}

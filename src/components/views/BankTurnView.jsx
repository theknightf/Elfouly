import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { Vault, Flame, CheckCircle, XCircle, RotateCcw, Eye, EyeOff, ShieldCheck } from 'lucide-react';

/**
 * BankTurnView
 *
 * Strict Role & View Partitioning for Round 1 ("1 تو" / Bank Mode):
 * - 12 questions per team turn.
 * - Alternates strictly question by question between the 2 active team players.
 * - Answering side: Question text ONLY (NO answer key, NO evaluation buttons) + [BANK! / أمّن] + [دبّل / كمل].
 * - Defending side: Question text + Correct answer + Grading buttons [صح / (+Points)] + [غلط / Break Streak].
 * - Defending team cannot see or trigger bank buttons.
 */
export default function BankTurnView({ isMobile = false }) {
  const {
    roomState,
    currentPlayer,
    r1Score,
    r1Break,
    r1Bank,
    r1PassTurn,
    showToast
  } = useGame();

  const triviaRoom = useTriviaRoom();
  const {
    activeQuestion,
    currentTurnQNumber,
    designatedAnsweringPlayer,
    designatedReaderPlayer,
    isAnswering,
    isAnsweringTeam,
    isDefendingTeam,
    isR1Referee,
    activeTeam,
    defendingTeam
  } = triviaRoom;

  const [revealSecret, setRevealSecret] = useState(false);

  const r1 = roomState?.round1 || {};
  const currentStreak = r1.streak || 0;
  const pendingPoints = r1.pendingPoints || 0;
  const streakLadder = r1.streakLadder || [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000];
  const nextStreak = Math.min(currentStreak + 1, 10);
  const nextValue = streakLadder[nextStreak];

  const handleScore = () => {
    setRevealSecret(false);
    r1Score();
  };

  const handleBreak = () => {
    setRevealSecret(false);
    r1Break();
  };

  const handleBank = () => {
    r1Bank();
  };

  const handleDouble = () => {
    showToast('دبّل وكمل! 🔥', 'واصل صعود سلم النقاط واكسب الضعف!');
  };

  return (
    <div className={`space-y-4 ${isMobile ? 'text-right' : ''}`}>
      
      {/* Turn & Player Alternation Banner */}
      <div className="bg-arena-card rounded-2xl p-4 border border-white/10 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-arena-yellow/20 text-arena-yellow font-black text-xs px-2.5 py-1 rounded-lg border border-arena-yellow/30">
            السؤال {currentTurnQNumber} من 12 (فقرة {activeTeam.name.split('(')[0]})
          </span>
          <span className="text-xs text-gray-400 font-bold">
            إجمالي الجولة: {r1.totalQuestionsAnswered || 0}/48
          </span>
        </div>

        {/* Dynamic Answering vs Referee indicators */}
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-arena-cyan/10 border border-arena-cyan/40 px-3 py-1 rounded-xl text-arena-cyan font-bold flex items-center gap-1.5">
            <span>المجيب:</span>
            <span className="font-black text-white">{designatedAnsweringPlayer?.name || 'لاعب الإجابة'}</span>
          </div>
          <div className="bg-arena-red/10 border border-arena-red/40 px-3 py-1 rounded-xl text-arena-red font-bold flex items-center gap-1.5">
            <span>الحكم:</span>
            <span className="font-black text-white">{designatedReaderPlayer?.name || 'حكم الخصم'}</span>
          </div>
        </div>
      </div>

      {/* Main Question Surface */}
      <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-2 border-arena-cyan/40 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/30">
            {activeQuestion.categoryName || activeQuestion.category || 'عام'}
          </span>
          <span className="text-xs font-mono font-bold text-gray-400">
            القيمة القادمة: +{nextValue.toLocaleString()} نقطة
          </span>
        </div>

        {/* Question Text (Visible to ALL participants) */}
        <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed text-right min-h-[60px]">
          {activeQuestion.question_text || activeQuestion.question}
        </h3>

        {/* Referee Answer Key (STRICTLY HIDDEN from the answering team) */}
        {isR1Referee && (
          <div className="mt-5 pt-4 border-t border-white/10 bg-emerald-950/40 p-3 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-arena-green" />
              <span className="text-xs font-bold text-gray-300">مفتاح إجابة الحكم:</span>
              <span className="text-sm font-black text-arena-green">
                {activeQuestion.correct_answer || activeQuestion.answer}
              </span>
            </div>
            <span className="text-[10px] text-gray-400">خاص بفريق التحكيم الخصم 🛡️</span>
          </div>
        )}

        {isAnsweringTeam && (
          <div className="mt-4 pt-3 border-t border-white/10 text-center text-xs text-gray-400 font-bold">
            🔒 الإجابة مخفية ومتاحة لحكم الخصم فقط — أجب بصوت عالٍ!
          </div>
        )}
      </div>

      {/* Vault Status Box */}
      <div className="bg-arena-darker/90 p-4 rounded-2xl border border-arena-yellow/30 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-gray-400 font-bold">النقاط المعلقة في الخزنة:</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-arena-yellow">
            {pendingPoints.toLocaleString()} <span className="text-xs font-bold text-gray-300">نقطة</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-gray-400 font-bold">الستريك الحالي:</div>
          <div className="text-xl font-black font-mono text-arena-cyan">
            ×{currentStreak}
          </div>
        </div>
      </div>

      {/* Role-Specific Interactive Controls */}
      <div className="pt-2">
        
        {/* VIEW 1: ACTIVE ANSWERING TEAM (Answering Player or Teammate) */}
        {isAnsweringTeam && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* [BANK! / أمّن] Button */}
              <button
                onClick={handleBank}
                disabled={pendingPoints === 0}
                className={`py-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
                  pendingPoints === 0
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                    : 'btn-arcade-yellow cursor-pointer shadow-xl hover:scale-[1.02]'
                }`}
              >
                <Vault className="w-5 h-5 fill-current" />
                <span>[BANK! / أمّن في الخزنة] 🔒</span>
              </button>

              {/* [دبّل / كمل] Button */}
              <button
                onClick={handleDouble}
                className="btn-arcade-cyan py-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:scale-[1.02]"
              >
                <Flame className="w-5 h-5 fill-current" />
                <span>[دبّل / كمل للمضاعف] 🔥</span>
              </button>
            </div>

            {isAnswering ? (
              <div className="bg-arena-cyan/10 border border-arena-cyan/30 p-2.5 rounded-xl text-center text-xs font-bold text-arena-cyan">
                ⚡ أنت اللاعب المجيب لهذا السؤال ({designatedAnsweringPlayer?.name}) — جاوب قبل الحكم!
              </div>
            ) : (
              <div className="bg-arena-card p-2.5 rounded-xl text-center text-xs text-gray-300">
                📢 دور زميلك في الإجابة الآن — يمكنك تذكيره بتأمين النقاط إذا كان الرصيد كافياً!
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: ASSIGNED REFEREE (Exclusive Grading Triggers) */}
        {isR1Referee && (
          <div className="space-y-3 bg-arena-card p-4 rounded-2xl border-2 border-arena-red/50 shadow-xl">
            <div className="flex items-center justify-between text-xs font-bold text-arena-red">
              <span>أدوات التحكيم الحصرية لفريقك:</span>
              <span className="bg-arena-red/20 px-2 py-0.5 rounded text-[10px]">الحكم الخصم 🛡️</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* [صح / (+Points)] Button */}
              <button
                onClick={handleScore}
                className="btn-arcade-green py-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:scale-[1.02]"
              >
                <CheckCircle className="w-5 h-5" />
                <span>[صح / (+Points)] 🎯</span>
              </button>

              {/* [غلط / Break Streak] Button */}
              <button
                onClick={handleBreak}
                className="btn-arcade-red py-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:scale-[1.02]"
              >
                <XCircle className="w-5 h-5" />
                <span>[غلط / Break Streak] 💥</span>
              </button>
            </div>

            <p className="text-[11px] text-gray-400 text-center">
              تحقق من نطق الخصم للإجابة بدقة قبل الضغط على القرار.
            </p>
          </div>
        )}

        {/* Local Preview / Spectator fallback */}
        {!isAnsweringTeam && !isDefendingTeam && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleScore}
              className="btn-arcade-green py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>صح (+Points)</span>
            </button>
            <button
              onClick={handleBreak}
              className="btn-arcade-red py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>غلط (تصفير)</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

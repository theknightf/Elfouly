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
    <div className={`space-y-4 pixel-grid-pattern ${isMobile ? 'text-right' : ''}`}>
      
      {/* Egyptian Arcade Header Banner (Stitch Screen 5) */}
      <div className="relative bg-surface-container-low border-[3px] border-[#090614] rounded-2xl p-3 shadow-[0_4px_0_0_#090614] overflow-hidden flex items-center justify-between">
        <div className="flex items-center gap-2.5 z-10">
          <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center border-2 border-[#090614] shadow-[0_2px_0_#090614]">
            <span className="text-lg">🏺</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-sm md:text-base text-arena-yellow font-black leading-tight">
              1 تو (Double or Bank) — حلبة الصعيد
            </h2>
            <p className="text-[11px] text-on-surface-variant font-bold">
              قرية الإخصاص.. منيا عروس الصعيد
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] bg-surface-container-highest px-2 py-1 rounded-lg text-arena-cyan border border-[#090614]">
            سؤال {currentTurnQNumber}/12
          </span>
          <span className="font-pixel text-[9px] bg-arena-yellow/20 text-arena-yellow px-2 py-1 rounded-lg border border-arena-yellow/40">
            ×{currentStreak}
          </span>
        </div>
      </div>

      {/* Turn & Player Alternation Banner */}
      <div className="bg-arena-card rounded-2xl p-3.5 border-2 border-[#090614] shadow-[0_4px_0_0_#090614] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-arena-yellow/20 text-arena-yellow font-black text-xs px-2.5 py-1 rounded-lg border border-arena-yellow/30 font-pixel text-[10px]">
            فقرة {activeTeam.name.split('(')[0]}
          </span>
          <span className="text-xs text-gray-400 font-bold">
            إجمالي الجولة: {r1.totalQuestionsAnswered || 0}/48
          </span>
        </div>

        {/* Dynamic Answering vs Referee indicators */}
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-arena-cyan/15 border-2 border-[#090614] px-3 py-1 rounded-xl text-arena-cyan font-bold flex items-center gap-1.5 shadow-[0_2px_0_#090614]">
            <span>المجيب:</span>
            <span className="font-black text-white">{designatedAnsweringPlayer?.name || 'لاعب الإجابة'}</span>
          </div>
          <div className="bg-arena-red/15 border-2 border-[#090614] px-3 py-1 rounded-xl text-arena-red font-bold flex items-center gap-1.5 shadow-[0_2px_0_#090614]">
            <span>الحكم:</span>
            <span className="font-black text-white">{designatedReaderPlayer?.name || 'حكم الخصم'}</span>
          </div>
        </div>
      </div>

      {/* Main Papyrus Sandstone Question Surface */}
      <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] relative overflow-hidden">
        {/* Sandstone Egyptian Corner Motifs */}
        <div className="absolute top-2 right-3 font-pixel text-[8px] text-arena-yellow/30 select-none">𓉐 𓉑 𓉒</div>
        <div className="absolute top-2 left-3 font-pixel text-[8px] text-arena-yellow/30 select-none">𓋹 𓊪 𓈖</div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/30 flex items-center gap-1">
            <span>🌍</span>
            <span>{activeQuestion.categoryName || activeQuestion.category || 'عام'}</span>
          </span>
          <span className="font-pixel text-[10px] text-arena-yellow">
            القيمة: +{nextValue.toLocaleString()} نقطة
          </span>
        </div>

        {/* Question Text (Visible to ALL participants) */}
        <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed text-right min-h-[60px] drop-shadow-[0_2px_0_#090614]">
          {activeQuestion.question_text || activeQuestion.question}
        </h3>

        {/* Referee Answer Key (STRICTLY HIDDEN from the answering team) */}
        {isR1Referee && (
          <div className="mt-5 pt-4 border-t-2 border-dashed border-emerald-500/40 bg-emerald-950/40 p-3.5 rounded-2xl border-2 border-[#090614] flex items-center justify-between shadow-[0_3px_0_#090614]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-arena-green" />
              <span className="text-xs font-bold text-gray-300">مفتاح إجابة الحكم:</span>
              <span className="text-sm md:text-base font-black text-arena-green">
                {activeQuestion.correct_answer || activeQuestion.answer}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-pixel text-[8px]">خاص بالحكم 🛡️</span>
          </div>
        )}

        {isAnsweringTeam && (
          <div className="mt-4 pt-3 border-t border-white/10 text-center text-xs text-gray-400 font-bold">
            🔒 الإجابة مخفية ومتاحة لحكم الخصم فقط — أجب بصوت عالٍ!
          </div>
        )}
      </div>

      {/* POT & Vault Status Display (Stitch Screen 5 Style) */}
      <div className="bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-high p-4 rounded-2xl border-[3px] border-[#090614] shadow-[0_4px_0_0_#090614] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-container/20 border-2 border-arena-yellow flex items-center justify-center animate-bounce text-xl">
            🔥
          </div>
          <div>
            <div className="font-headline-sm text-sm md:text-base text-arena-yellow font-black flex items-center gap-1.5">
              <span>سلسلة الحظ (Streak)</span>
              <span className="font-pixel text-xs text-arena-cyan">×{currentStreak}</span>
            </div>
            <span className="text-[11px] text-gray-400 font-bold">
              {currentStreak === 0 ? 'ابدأ السلسلة بإجابة صحيحة' : 'لو غلطت هتصفّر العداد كله!'}
            </span>
          </div>
        </div>
        <div className="text-left bg-surface-container-lowest px-3.5 py-1.5 rounded-xl border-2 border-arena-yellow shadow-[0_2px_0_0_#6b4c00]">
          <span className="block font-pixel text-[8px] text-arena-yellow uppercase tracking-wider">على المحك (POT)</span>
          <span className="font-pixel text-base md:text-lg text-arena-yellow">+{pendingPoints.toLocaleString()}</span>
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

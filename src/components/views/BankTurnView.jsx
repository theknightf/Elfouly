import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { RoundTimer } from '../../game/RoundTimer';
import { BANK_RULES } from '../../game/constants';
import { categoryLabel } from '../../utils/categoryLabels';
import { Vault, Flame, CheckCircle, XCircle, RotateCcw, Eye, EyeOff, ShieldCheck, Lock, Zap } from 'lucide-react';

/**
 * BankTurnView
 *
 * Authentic Egyptian Pixel Art (Stitch Screen 5: 1 تو - One-Two)
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
    r1NextQuestion,
    isHost,
    showToast
  } = useGame();

  const triviaRoom = useTriviaRoom();
  const {
    activeQuestion,
    nextQuestion,
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

  const r1 = roomState?.round1 || {};
  const [revealSecret, setRevealSecret] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    if (r1.questionState === 'active') {
      setIsAdvancing(false);
    }
  }, [r1.questionState, r1.currentQuestionIndex]);

  const handleNextQuestion = () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    r1NextQuestion();
  };

  const currentStreak = r1.streak || 0;
  const pendingPoints = r1.pendingPoints || 0;
  const streakLadder = r1.streakLadder || BANK_RULES.STREAK_LADDER;
  const nextStreak = Math.min(currentStreak + 1, 10);
  const nextValue = streakLadder[nextStreak];
  const hasLiveQuestion = !!r1.currentQuestion;
  const [timeLeft, setTimeLeft] = useState(() => RoundTimer.remaining(r1.endTime));
  const timerRef = useRef(null);
  const timeoutHandledRef = useRef(null);

  useEffect(() => {
    timerRef.current?.dispose();
    if (!hasLiveQuestion || !r1.isTimerRunning || !r1.endTime) {
      setTimeLeft(0);
      return undefined;
    }
    const token = r1.actionToken || r1.currentQuestionIndex;
    const timer = new RoundTimer(remaining => setTimeLeft(Math.ceil(remaining / 1000)), () => {
      if (timeoutHandledRef.current === token) return;
      timeoutHandledRef.current = token;
      if (isHost) r1NextQuestion();
    });
    timerRef.current = timer;
    timer.start(Math.max(0, (r1.endTime - Date.now()) / 1000));
    return () => {
      timer.dispose();
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [hasLiveQuestion, r1.isTimerRunning, r1.endTime, r1.actionToken, r1.currentQuestionIndex, isHost, r1NextQuestion]);

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
    <div className={`flex flex-col gap-4 ${isMobile ? 'text-right' : ''}`}>
      
      {/* Egyptian Arcade Header Banner (Stitch Screen 5) */}
      <div className="max-md:order-last relative bg-surface-container-low border-[3px] border-[#090614] rounded-2xl p-3 shadow-[0_4px_0_0_#090614] overflow-hidden flex items-center justify-between">
        <div className="flex items-center gap-2.5 z-10">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border-2 border-[#090614] shadow-[0_2px_0_#090614]">
            <span className="text-xl">🏺</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-sm md:text-base text-arena-yellow font-black leading-tight">
              1 تو (Double or Bank) — حلبة الصعيد
            </h2>
            <p className="text-[11px] text-gray-300 font-bold">
              قرية الإخصاص.. منيا عروس الصعيد 🕹️
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

      {/* Teams Scoreboard & In-Bank Safety Gauge */}
      <div className="max-md:order-last grid grid-cols-2 gap-3">
        {/* Active Answering Team (Blue) */}
        <div className="bg-surface-container border-[3px] border-[#090614] rounded-2xl p-3 shadow-[0_4px_0_0_#090614] relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-arena-cyan" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-arena-cyan">{activeTeam.name.split('(')[0].trim()}</span>
            <span className="font-pixel text-[8px] text-arena-cyan bg-surface-container-lowest px-1.5 py-0.5 rounded border border-arena-cyan/40">
              دورهم الآن
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xs text-gray-400">الخزنة المأمنة:</span>
            <span className="font-pixel text-lg text-arena-cyan">{activeTeam.score || 0}</span>
          </div>
        </div>

        {/* Defending Team (Red) */}
        <div className="bg-surface-container border-[3px] border-[#090614] rounded-2xl p-3 shadow-[0_4px_0_0_#090614] relative opacity-90">
          <div className="absolute top-0 right-0 left-0 h-1 bg-arena-red" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-arena-red">{defendingTeam.name.split('(')[0].trim()}</span>
            <span className="font-pixel text-[8px] text-gray-400 bg-surface-container-lowest px-1.5 py-0.5 rounded">
              ينتظر
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xs text-gray-400">الخزنة المأمنة:</span>
            <span className="font-pixel text-lg text-rose-300">{defendingTeam.score || 0}</span>
          </div>
        </div>
      </div>

      {r1.steal && (
        <div className="bg-arena-red/15 border-2 border-arena-red rounded-2xl p-3 text-center font-black text-arena-yellow" role="status">
          🥷 فرصة سرقة! نفس السؤال راح للفريق التاني — إجابة صحيحة بتديهم ×1 (+{streakLadder[1]} نقطة)
        </div>
      )}

      {/* Current Unbanked Pot & Streak Display */}
      <div className="bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-high border-[3px] border-[#090614] rounded-2xl p-3.5 shadow-[0_4px_0_0_#090614] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-container/20 border-2 border-primary-container flex items-center justify-center animate-bounce">
            <Flame className="w-6 h-6 text-arena-yellow fill-current" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-200 flex items-center gap-1">
              <span>سلسلة الـ 1 تو</span>
              <span className="font-pixel text-[10px] text-arena-yellow">×{currentStreak} 🔥</span>
            </div>
            <span className="text-[11px] text-gray-400">لو غلطت هتصفّر كل النقاط المعلقة!</span>
          </div>
        </div>

        {/* Floating Risk Pot */}
        <div className="text-left bg-surface-container-lowest px-3 py-1.5 rounded-xl border-2 border-primary-container shadow-[0_2px_0_0_#6b4c00]">
          <span className="block font-pixel text-[8px] text-amber-300 uppercase tracking-wider">على المحك (POT)</span>
          <span className="font-pixel text-base text-arena-yellow">+{pendingPoints} نقطة</span>
        </div>
      </div>

      {/* Papyrus Stone Question Card */}
      <div className="bg-surface-container-high border-[3.5px] border-[#090614] rounded-3xl p-6 md:p-7 shadow-[0_6px_0_0_#090614] space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/30">
            {categoryLabel(activeQuestion.categoryName, 'سؤال عام')}
          </span>
          <span className="font-pixel text-[10px] text-arena-yellow">
            السؤال التالي: +{nextValue} نقطة
          </span>
        </div>

        <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed text-right drop-shadow-[0_2px_0_#090614]">
          {activeQuestion.question_text || activeQuestion.question}
        </h3>
        {hasLiveQuestion && <div className="text-center font-mono text-xl font-black text-arena-yellow" role="timer">⏱ {timeLeft}s</div>}

        {/* Answer Holder / Defending Referee Secret View */}
        {isR1Referee && (
          <div className="mt-4 p-3.5 bg-surface-container-lowest rounded-2xl border-2 border-arena-yellow/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-arena-yellow font-black flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-arena-yellow" />
                <span>لوحة تحكيم الخصم (الإجابة النموذجية):</span>
              </span>
              <button
                onClick={() => setRevealSecret(!revealSecret)}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {revealSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{revealSecret ? 'إخفاء' : 'إظهار'}</span>
              </button>
            </div>

            {revealSecret ? (
              <div className="text-base font-black text-arena-green bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-500/40 text-center">
                {activeQuestion.answer || activeQuestion.correct_answer}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic text-center py-1">
                اضغط إظهار لرؤية الإجابة الصحيحة وتأكيد النتيجة بعد سماع إجابة المسدد
              </div>
            )}

            {/* Referee Quick Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleScore}
                className="btn-arcade-green py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow hover:scale-[1.02]"
              >
                <CheckCircle className="w-4 h-4" />
                <span>صح (+{nextValue})</span>
              </button>
              <button
                onClick={handleBreak}
                className="btn-arcade-red py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow hover:scale-[1.02]"
              >
                <XCircle className="w-4 h-4" />
                <span>غلط (تصفير)</span>
              </button>
            </div>
          </div>
        )}

        {/* Question Resolution Outcome (No Auto-Advancement & Zero-delay next) */}
        {r1.questionState === 'resolved' && (
          <div className={`mt-4 p-4 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-3 animate-fadeIn ${
            r1.lastResult?.correct
              ? 'bg-emerald-950/70 border-arena-green shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : 'bg-rose-950/70 border-arena-red shadow-[0_0_20px_rgba(239,68,68,0.3)]'
          }`}>
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {r1.lastResult?.correct ? '🎯' : '💥'}
              </div>
              <div className="text-right">
                <div className={`text-base font-black ${r1.lastResult?.correct ? 'text-arena-green' : 'text-arena-red'}`}>
                  {r1.lastResult?.correct
                    ? `إجابة صحيحة! (+${(r1.lastResult?.pointsEarned || 0).toLocaleString()} نقطة)`
                    : 'إجابة خاطئة! تم تصفير الستريك'}
                </div>
                <div className="text-xs text-gray-300 font-bold">
                  {r1.lastResult?.correct
                    ? `وصلت السلسلة إلى ×${r1.lastResult?.streak || 0} في بنك النقاط`
                    : 'يمكن للفريق الخصم التأمين أو الاستمرار في الأدوار القادمة'}
                </div>
              </div>
            </div>

            {/* Host / Referee Manual Progression Trigger with double-click guard */}
            {(isHost || isR1Referee) && (
              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={isAdvancing}
                className={`btn-arcade-yellow px-6 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 cursor-pointer shadow-lg hover:scale-[1.02] transition-all ${
                  isAdvancing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <span>السؤال التالي ➡️</span>
              </button>
            )}
          </div>
        )}

        {/* Preloaded next question rendered hidden for 0ms font & layout delay */}
        {nextQuestion && (
          <div className="hidden" aria-hidden="true">
            {nextQuestion.question_text || nextQuestion.question}
          </div>
        )}
      </div>

      {/* ================= THE CORE '1 تو' ACTION HUBS: BANK vs DOUBLE ================= */}
      {isDefendingTeam && !isAnswering && !r1.steal && (
        <div className="space-y-2.5">
          <div className="text-center">
            <p className="font-pixel text-[9px] text-arena-yellow uppercase tracking-wider">
              ⚡ قرار الخزنة بإيد الفريق الخصم ⚡
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. GIANT SAFE VAULT BUTTON: BANK! (أمّن) */}
            <button
              onClick={handleBank}
              disabled={pendingPoints === 0}
              className={`press-button-anim relative group overflow-hidden bg-gradient-to-b from-[#2dd4bf] to-[#0f766e] text-surface-container-lowest p-4 rounded-2xl border-[3.5px] border-[#090614] shadow-[0_5px_0_0_#090614] flex flex-col items-center justify-center gap-1 transition-all ${
                pendingPoints === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110 active:translate-y-1'
              }`}
            >
              <div className="flex items-center gap-2">
                <Vault className="w-6 h-6 text-white font-bold" />
                <span className="text-xl md:text-2xl font-black text-white tracking-tight drop-shadow-[0_1px_0_rgba(0,0,0,0.5)]">
                  أمّـن! (BANK)
                </span>
              </div>
              <span className="text-xs text-emerald-100 font-bold">
                حط الـ (+{pendingPoints}) في الخزنة واقفل الدور! 🛡️
              </span>
            </button>

            {/* 2. FIERY RED/ORANGE BUTTON: DOUBLE OR BANK (دبّل / كمل) */}
            <button
              onClick={handleDouble}
              className="press-button-anim relative group overflow-hidden bg-gradient-to-b from-primary-container to-[#ea580c] text-on-primary-container p-4 rounded-2xl border-[3.5px] border-[#090614] shadow-[0_5px_0_0_#6b4c00] flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110 active:translate-y-1 transition-all"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-on-primary-container fill-current" />
                <span className="text-xl md:text-2xl font-black text-on-primary-container tracking-tight">
                  دبّل / كمّل!
                </span>
              </div>
              <span className="text-xs text-amber-950 font-bold">
                خاطر عشان السؤال اللي بعده (+{nextValue})! 🔥
              </span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

import React from 'react';
import { PASSWORD_RULES } from '../game/constants';
import { useGame } from '../context/GameContext';
import {
  ChevronRight,
  Trophy,
  PlayCircle,
  PauseCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

/**
 * GameProgressionControls
 *
 * Dedicated Manual Progression Trigger & Admin Controller:
 * - No Auto-Advancement: Displays resolution state and keeps question on screen until host triggers next.
 * - "Next Question": Manually loads the next question once current one is resolved.
 * - "Next Round": Appears ONLY when the current round's questions are exhausted.
 * - Displays Single Judge verification badge.
 */
export default function GameProgressionControls() {
  const {
    roomState,
    isHost,
    currentPlayer,
    nextQuestion,
    nextRound,
    r1NextQuestion,
    r2NextCard,
    r3NextShot
  } = useGame();

  const status = roomState?.status || 'lobby';
  if (['lobby', 'waiting', 'game_over'].includes(status)) return null;

  // Determine round-specific state
  const r1 = roomState?.round1 || {};
  const r2 = roomState?.round2 || {};
  const r3 = roomState?.round3 || {};

  const isR1 = status === 'round1';
  const isR2 = status === 'round2';
  const isR3 = status === 'round3';

  // Check if question/shot is currently resolved
  const isR1Resolved = isR1 && r1.questionState === 'resolved';
  const isR2Resolved = isR2 && (r2.cardState === 'resolved' || r2.isResolved || !!r2.lastCardResult);
  const isR3Resolved = isR3 && (r3.shotState === 'resolved' || r3.phase === 'shot_resolved');
  const isResolved = isR1 ? isR1Resolved : (isR2 ? isR2Resolved : (isR3 ? isR3Resolved : false));

  // Check if round questions are exhausted
  const isR1Exhausted = isR1 && (r1.totalQuestionsAnswered >= 48 || r1.isComplete);
  const isR2Exhausted = isR2 && (r2.isComplete || (r2.currentWordIndex >= PASSWORD_RULES.CARDS));
  const isR3Exhausted = isR3 && (r3.isComplete || (r3.turnIndex >= 10 && !r3.isSuddenDeath && (r3.phase === 'complete' || r3.shotState === 'complete')));
  const isExhausted = isR1 ? isR1Exhausted : (isR2 ? isR2Exhausted : (isR3 ? isR3Exhausted : false));

  // Role permissions: Host or designated Judge can manually advance
  const judgeId = roomState?.singleJudgeId || (isR1 ? r1.refereePlayerId : (isR2 ? r2.refereePlayerId : (isR3 ? r3.refereePlayerId : null)));
  const isJudge = !!currentPlayer && currentPlayer.id === judgeId;
  const canControl = isHost || isJudge;

  // Get single judge name
  const judgePlayer = roomState?.players?.find(p => p.id === judgeId) || { name: 'حكم الجولة' };

  const handleNextQuestion = () => {
    if (isR1) r1NextQuestion();
    else if (isR2) r2NextCard();
    else if (isR3) r3NextShot();
    else nextQuestion();
  };

  const handleNextRound = () => {
    nextRound();
  };

  const roundName = isR1
    ? 'جولة 1 تو (Bank Mode)'
    : isR2
      ? 'جولة اديني في سري (Password)'
      : isR3
        ? 'جولة ركلات الجزاء (Shootout)'
        : 'الجولة الحالية';

  return (
    <aside aria-label="شريط التحكم والتقدم اليدوي" className="bg-arena-card/95 border-2 border-white/10 rounded-2xl p-3 md:p-4 shadow-xl backdrop-blur-md">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Progression Status & Single Judge Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Indicator */}
          {isExhausted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-arena-green/20 border border-arena-green/50 text-arena-green text-xs font-black animate-pulse">
              <Trophy className="w-3.5 h-3.5" />
              <span>اكتملت جميع أسئلة {roundName}! 🏁</span>
            </span>
          ) : isResolved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-arena-yellow/20 border border-arena-yellow/50 text-arena-yellow text-xs font-black">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم حسم السؤال — في انتظار الانتقال اليدوي ⏸️</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-arena-cyan/15 border border-arena-cyan/40 text-arena-cyan text-xs font-black">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>السؤال جاري — أجب قبل انتهاء الوقت ⚡</span>
            </span>
          )}

          {/* Single Judge Badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-300 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>الحكم الوحيد: {judgePlayer.name} (ممنوع من الإجابة)</span>
          </span>
        </div>

        {/* Right: Manual Progression Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* "Next Round" Button: Appears ONLY when current round's questions are exhausted */}
          {isExhausted ? (
            canControl ? (
              <button
                type="button"
                onClick={handleNextRound}
                className="btn-arcade-green px-5 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 shadow-lg cursor-pointer hover:scale-[1.02] animate-bounce-short"
              >
                <span>الانتقال للجولة التالية (Next Round)</span>
                <Trophy className="w-4 h-4" />
              </button>
            ) : (
              <div className="text-xs font-bold text-gray-400">
                في انتظار الهوست للانتقال للجولة التالية…
              </div>
            )
          ) : (
            /* "Next Question" Button: Manually loads next question once current is resolved */
            canControl ? (
              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={!isResolved}
                className={`px-5 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 transition-all shadow-md ${
                  isResolved
                    ? 'btn-arcade-yellow cursor-pointer hover:scale-[1.02] animate-pulse'
                    : 'bg-gray-800 text-gray-500 border border-white/5 cursor-not-allowed opacity-60'
                }`}
                title={isResolved ? 'تحميل السؤال التالي يدويًا' : 'يجب حسم السؤال الحالي أولاً'}
              >
                <span>السؤال التالي (Next Question)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="text-[11px] text-gray-400 font-bold">
                {isResolved ? 'في انتظار الهوست/الحكم لطلب السؤال التالي…' : 'الإجابة قيد التنفيذ…'}
              </div>
            )
          )}
        </div>
      </div>
    </aside>
  );
}

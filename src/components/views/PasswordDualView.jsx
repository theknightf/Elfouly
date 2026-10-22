import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { sounds } from '../../utils/soundEffects';
import {
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Timer,
  Award,
  Snowflake,
  ShieldAlert,
  ChevronRight,
  SkipForward,
  Trophy,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

/**
 * PasswordDualView
 *
 * Strict Role & View Partitioning for Round 2 ("اديني في سري" / Password Mode):
 * - 2 Clue-Givers (1 from Team A, 1 from Team B): see Target Word + 4 Forbidden Words.
 * - Team A clue-giver grades Team B ([نقطة لتيم ب], [مخالفة على تيم ب]).
 * - Team B clue-giver grades Team A ([نقطة لتيم أ], [مخالفة على تيم أ]).
 * - Guessers (remaining teammates): strictly blocked from seeing Target and Forbidden words.
 *   Sees "استمع للتلميح وخمن" + Live Timer + Guesses Log.
 * - Dedicated functional "Next Card" and "Next Round" progression.
 */
export default function PasswordDualView({ isMobile = false }) {
  const {
    roomState,
    currentPlayer,
    isHost,
    r2AwardPoint,
    r2Foul,
    r2SkipCard,
    r2NextCard,
    r2TimeFreeze,
    nextRound,
    showToast
  } = useGame();

  const triviaRoom = useTriviaRoom();
  const {
    activeQuestion,
    isClueGiver,
    isClueGiverA,
    isClueGiverB,
    isGuesser,
    isR2Referee,
    r2ActiveTurnTeam
  } = triviaRoom;

  const r2 = roomState?.round2 || {};
  const [timeLeft, setTimeLeft] = useState(r2.timer || 45);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const teamA = roomState?.teams?.team_a || { name: 'فريق الحيتان', score: 0 };
  const teamB = roomState?.teams?.team_b || { name: 'فريق الوحوش', score: 0 };

  const clueGiverA = roomState?.players?.find(p => p.id === r2.activeClueGiverA);
  const clueGiverB = roomState?.players?.find(p => p.id === r2.activeClueGiverB);

  // Reset timer on card change
  useEffect(() => {
    setTimeLeft(r2.timer || 45);
    setIsTimerRunning(false);
  }, [r2.currentWordIndex]);

  // Timer tick
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            sounds.playBuzzer();
            setIsTimerRunning(false);
            showToast('انتهى الوقت!', 'انتهى وقت تخمين كلمة السر!');
            return 0;
          }
          if (prev <= 6) sounds.playTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    sounds.playWhistle();
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleFreeze = () => {
    r2TimeFreeze();
    sounds?.playPowerup?.();
  };

  const handleAwardA = () => {
    sounds?.playCorrect?.();
    r2AwardPoint('team_a');
  };

  const handleAwardB = () => {
    sounds?.playCorrect?.();
    r2AwardPoint('team_b');
  };

  const handleFoulA = () => {
    sounds?.playWrong?.();
    r2Foul('team_a');
  };

  const handleFoulB = () => {
    sounds?.playWrong?.();
    r2Foul('team_b');
  };

  const isRoundComplete = r2.isComplete || (r2.currentWordIndex >= 5);
  const isCardResolved = r2.cardState === 'resolved' || !!r2.lastCardResult || timeLeft === 0;

  return (
    <div className={`space-y-5 arcade-pattern ${isMobile ? 'text-right' : ''}`}>
      
      {/* Egyptian Arcade Header (Stitch Screen 2) */}
      <div className="relative bg-surface-container rounded-2xl p-3.5 border-[3px] border-[#090614] shadow-[0_4px_0_0_#090614] flex flex-wrap items-center justify-between gap-3 overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-container border-2 border-[#090614] shadow-[0_2px_0_0_#090614] flex items-center justify-center text-xl">
            🤫
          </div>
          <div>
            <div className="font-pixel text-[9px] text-arena-cyan tracking-wider">طور التحدي المصري</div>
            <h2 className="font-headline-sm text-sm md:text-base text-arena-yellow font-black leading-tight">
              اديني في سري (Password)
            </h2>
          </div>
        </div>

        {/* Center Arcade Countdown Timer */}
        <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-full border-2 border-arena-yellow shadow-[0_0_10px_rgba(255,184,0,0.25)]">
          <Timer className={`w-4 h-4 ${timeLeft <= 10 ? 'text-arena-red animate-pulse' : 'text-arena-yellow'}`} />
          <span className={`font-pixel text-sm md:text-base ${timeLeft <= 10 ? 'text-arena-red' : 'text-arena-yellow'}`}>
            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
          </span>
          {isTimerRunning ? (
            <button
              onClick={handlePauseTimer}
              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] hover:bg-amber-500/30 cursor-pointer"
            >
              إيقاف
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] hover:bg-emerald-500/30 cursor-pointer"
            >
              تشغيل
            </button>
          )}
        </div>

        <span className="font-pixel text-[9px] bg-surface-container-highest px-2 py-1 rounded-lg text-white border border-[#090614]">
          بطاقة {Math.min(5, ((r2.currentWordIndex || 0) + 1))}/5
        </span>
      </div>

      {/* ROUND COMPLETE BANNER */}
      {isRoundComplete ? (
        <div className="bg-arena-card rounded-3xl p-8 border-2 border-arena-yellow text-center space-y-6 shadow-2xl animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-arena-yellow/20 border-2 border-arena-yellow mx-auto flex items-center justify-center text-3xl">
            🏆
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-arena-yellow">
              اكتملت جولة "اديني في سري" (5 بطاقات)! 🏁
            </h3>
            <p className="text-sm text-gray-300 max-w-md mx-auto">
              تم إنجاز كافة البطاقات الخمسة بنجاح. رصيد الفريقين الآن:
            </p>
            <div className="flex justify-center gap-6 pt-2">
              <span className="text-base font-black text-arena-cyan">
                {teamA.name}: {teamA.score} نقطة
              </span>
              <span className="text-base font-black text-arena-red">
                {teamB.name}: {teamB.score} نقطة
              </span>
            </div>
          </div>
          {(isHost || isClueGiver) && (
            <div className="pt-4">
              <button
                type="button"
                onClick={nextRound}
                className="btn-arcade-green px-8 py-3.5 rounded-2xl font-black text-base inline-flex items-center gap-2 cursor-pointer shadow-xl hover:scale-[1.02] animate-bounce-short"
              >
                <span>الانتقال للجولة 3: ركلات الجزاء (Next Round) ⚽</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      ) : isClueGiver ? (
        <div className="space-y-4">
          
          {/* Secret Word & Forbidden Words Card */}
          <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-arena-yellow bg-arena-yellow/10 px-3 py-1 rounded-full border border-arena-yellow/30">
                {activeQuestion.categoryName || 'كلمة السر'}
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-pixel text-[8px]">
                مشتركة للملقنين فقط 🔒
              </span>
            </div>

            <div className="text-center py-4 space-y-1">
              <div className="text-xs text-gray-400 font-bold">الكلمة المستهدفة (Target Word):</div>
              <div className="text-3xl md:text-4xl font-black text-arena-yellow tracking-wide drop-shadow-[0_2px_0_#090614]">
                {activeQuestion.question_text || activeQuestion.question}
              </div>
            </div>

            {/* 4 Forbidden Words */}
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <div className="text-xs font-bold text-arena-red flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>الكلمات الممنوعة (Forbidden Words) — يمنع نطقها أو مشتقاتها:</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                {(activeQuestion.forbidden_words || ['ممنوع 1', 'ممنوع 2', 'ممنوع 3', 'ممنوع 4']).map((word, idx) => (
                  <div
                    key={idx}
                    className="bg-red-950/50 border border-red-500/40 text-red-200 px-3 py-2 rounded-xl text-center text-xs md:text-sm font-black"
                  >
                    🚫 {word}
                  </div>
                ))}
              </div>
            </div>

            {/* Card Resolution Banner & Functional Next Button */}
            {isCardResolved && (
              <div className="mt-5 p-4 rounded-2xl bg-arena-darker/95 border-2 border-arena-yellow shadow-[0_0_20px_rgba(255,184,0,0.3)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">
                    {r2.lastCardResult?.scoreAdded ? '🎯' : '⏱️'}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-arena-yellow">
                      {r2.lastCardResult?.scoreAdded
                        ? `تم احتساب +500 نقطة لصالح ${r2.lastCardResult?.team === 'team_a' ? teamA.name : teamB.name}! 🎉`
                        : timeLeft === 0
                          ? 'انتهى وقت التخمين لهذه البطاقة! ⏱️'
                          : 'تم حسم هذه البطاقة.'}
                    </div>
                    <div className="text-xs text-gray-300 font-bold">
                      جاهزون للانتقال للبطاقة التالية؟ اضغط التالي للمتابعة.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={r2NextCard}
                  className="btn-arcade-yellow px-6 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 cursor-pointer shadow-lg hover:scale-[1.02] animate-pulse whitespace-nowrap"
                >
                  <span>البطاقة التالية (Next Question)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mutual Grading Anti-Cheat Controls */}
          <div className="bg-arena-darker/90 rounded-2xl p-5 border border-white/10 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Award className="w-4 h-4 text-arena-cyan" />
                <span>تحكيم متبادل لمنع الغش (Mutual Anti-Cheat Grading):</span>
              </h4>
              <span className="text-[10px] text-gray-400">كل ملقّن يحكّم للخصم</span>
            </div>

            {/* Grading Buttons split by Team */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Grading for Team A */}
              <div className="bg-arena-card/80 p-3.5 rounded-xl border border-arena-cyan/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-arena-cyan">
                  <span>تحكيم {teamA.name}:</span>
                  <span className="text-[10px] text-gray-400">بواسطة ملقن {teamB.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleAwardA}
                    className="btn-arcade-green py-2.5 rounded-xl font-black text-xs cursor-pointer shadow hover:scale-[1.02]"
                  >
                    [نقطة لـ {teamA.name}] +500 🎯
                  </button>
                  <button
                    onClick={handleFoulA}
                    className="btn-arcade-red py-2.5 rounded-xl font-black text-xs cursor-pointer shadow hover:scale-[1.02]"
                  >
                    [مخالفة على {teamA.name}] -200 ⚠️
                  </button>
                </div>
              </div>

              {/* Grading for Team B */}
              <div className="bg-arena-card/80 p-3.5 rounded-xl border border-arena-red/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-arena-red">
                  <span>تحكيم {teamB.name}:</span>
                  <span className="text-[10px] text-gray-400">بواسطة ملقن {teamA.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleAwardB}
                    className="btn-arcade-green py-2.5 rounded-xl font-black text-xs cursor-pointer shadow hover:scale-[1.02]"
                  >
                    [نقطة لـ {teamB.name}] +500 🎯
                  </button>
                  <button
                    onClick={handleFoulB}
                    className="btn-arcade-red py-2.5 rounded-xl font-black text-xs cursor-pointer shadow hover:scale-[1.02]"
                  >
                    [مخالفة على {teamB.name}] -200 ⚠️
                  </button>
                </div>
              </div>

            </div>

            {/* Actions Bar: Next Card, Skip, Time Freeze */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={r2NextCard}
                className="btn-arcade-yellow px-5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.02]"
              >
                <ChevronRight className="w-4 h-4" />
                <span>البطاقة التالية (Next Card)</span>
              </button>

              <button
                type="button"
                onClick={r2SkipCard}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>تخطي البطاقة (Skip)</span>
              </button>

              <button
                onClick={handleFreeze}
                disabled={r2.timeFreezeUsed}
                className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 ${
                  r2.timeFreezeUsed
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-cyan-950/80 border border-cyan-400 text-cyan-300 hover:bg-cyan-900 cursor-pointer'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span>تجميد الوقت (+10ث)</span>
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* GUESSERS SCREEN (STRICTLY REDACTED) */
        <div className="bg-arena-card rounded-3xl p-8 border-2 border-arena-cyan/30 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-arena-cyan/10 border-2 border-arena-cyan mx-auto flex items-center justify-center text-3xl">
            🔒
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white">
              استمع للتلميح وخمن! 🎧
            </h3>
            <p className="text-sm text-gray-300 max-w-md mx-auto">
              الملقنون يشاهدون كلمة السر والكلمات الممنوعة الآن. استمع جيداً للتلميحات وتوقع الكلمة بصوت واضح!
            </p>
          </div>

          <div className="bg-arena-darker/90 p-4 rounded-2xl border border-white/10 max-w-sm mx-auto flex items-center justify-center gap-3">
            <Timer className="w-5 h-5 text-arena-yellow animate-spin" />
            <span className="text-xl font-mono font-black text-white">
              الوقت المتبقي: {timeLeft}s
            </span>
          </div>

          {isCardResolved && (
            <div className="p-3 bg-arena-yellow/15 border border-arena-yellow/40 rounded-xl text-arena-yellow text-xs font-black animate-pulse max-w-md mx-auto">
              تم حسم هذه البطاقة أو انتهى وقتها — في انتظار الملقن أو الحكم لفتح البطاقة التالية ⏸️
            </div>
          )}

          <div className="text-xs text-gray-500 font-bold">
            🚫 الكلمة المستهدفة والكلمات الممنوعة محجوبة بالكامل لحماية نزاهة الجولة.
          </div>
        </div>
      )}

    </div>
  );
}

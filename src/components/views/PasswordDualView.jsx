import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { sounds } from '../../utils/soundEffects';
import { Lock, Eye, EyeOff, AlertTriangle, Timer, Award, Snowflake, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { RoundTimer } from '../../game/RoundTimer';

/**
 * PasswordDualView
 *
 * Authentic Egyptian Pixel Art (Stitch Screen 2: اديني في سري)
 * Strict Role & View Partitioning for Round 2 ("اديني في سري" / Password Mode):
 * - 2 Clue-Givers (1 from Team A, 1 from Team B): see Target Word + 4 Forbidden Words.
 * - Team A clue-giver grades Team B ([نقطة لتيم ب], [مخالفة على تيم ب]).
 * - Team B clue-giver grades Team A ([نقطة لتيم أ], [مخالفة على تيم أ]).
 * - Guessers (remaining teammates): strictly blocked from seeing Target and Forbidden words.
 *   Sees "استمع للتلميح وخمن" + Live Timer + Guesses Log.
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
  const [timeLeft, setTimeLeft] = useState(() => RoundTimer.remaining(r2.endTime));
  const [isAdvancing, setIsAdvancing] = useState(false);
  const timerRef = useRef(null);
  const expiryHandledRef = useRef(null);
  const cardToken = r2.actionToken || r2.currentWordIndex;

  useEffect(() => {
    if (r2.cardState === 'active') {
      setIsAdvancing(false);
    }
  }, [r2.cardState, r2.currentWordIndex]);

  const handleNextCard = () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    r2NextCard();
  };

  const teamA = roomState?.teams?.team_a || { name: 'فريق الحيتان', score: 0 };
  const teamB = roomState?.teams?.team_b || { name: 'فريق الوحوش', score: 0 };

  const clueGiverA = roomState?.players?.find(p => p.id === r2.activeClueGiverA);
  const clueGiverB = roomState?.players?.find(p => p.id === r2.activeClueGiverB);

  useEffect(() => {
    timerRef.current?.dispose();
    if (!r2.currentWord || r2.isComplete || !r2.isTimerRunning || !r2.endTime) return undefined;
    const timer = new RoundTimer(remainingMs => setTimeLeft(Math.ceil(remainingMs / 1000)), () => {
      if (expiryHandledRef.current === cardToken) return;
      expiryHandledRef.current = cardToken;
      sounds?.playBuzzer?.();
      showToast('انتهى الوقت!', 'انتهى وقت تخمين كلمة السر!');
      if (r2.actionToken && (isR2Referee || isHost)) r2SkipCard();
    });
    timerRef.current = timer;
    const endTime = r2.endTime || Date.now() + (r2.timer || 45) * 1000;
    timer.start(Math.max(0, (endTime - Date.now()) / 1000));
    return () => {
      timer.dispose();
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [cardToken, r2.currentWord, r2.endTime, r2.timer, r2.isComplete, r2.isTimerRunning, r2.actionToken, isR2Referee, isHost, showToast, r2SkipCard]);

  const isTimerRunning = !!r2.isTimerRunning && timeLeft > 0;

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

  const forbiddenWords = activeQuestion?.forbidden_words || activeQuestion?.forbidden || [
    'ممنوعة 1', 'ممنوعة 2', 'ممنوعة 3', 'ممنوعة 4'
  ];

  return (
    <div className={`space-y-4 ${isMobile ? 'text-right' : ''}`}>
      
      {/* Top Banner Ribbon (Stitch Screen 2) */}
      <div className="relative overflow-hidden bg-surface-container rounded-2xl p-3 border-[3px] border-[#090614] shadow-[0_4px_0_0_#090614] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-container border-2 border-[#090614] shadow-[0_2px_0_0_#090614] flex items-center justify-center">
            <span className="text-xl">🤫</span>
          </div>
          <div className="flex flex-col">
            <span className="font-pixel text-[8px] text-arena-cyan tracking-wider">طور التحدي السري</span>
            <span className="font-headline-sm text-sm md:text-base font-black text-arena-yellow leading-tight">اديني في سري (Password Duel)</span>
          </div>
        </div>

        {/* Center Countdown Timer Pill */}
        <div className="flex items-center gap-2">
          <div className="bg-surface-container-lowest px-3 py-1 rounded-full border-2 border-primary-container shadow-[0_0_10px_rgba(255,184,0,0.3)] flex items-center gap-1.5 animate-pulse">
            <Timer className="w-3.5 h-3.5 text-arena-yellow" />
            <span className="font-pixel text-xs text-arena-yellow font-black">
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </span>
          </div>
          <span className="font-pixel text-[9px] bg-surface-container-highest px-2 py-1 rounded-lg text-gray-300 border border-[#090614]">
            كرت {((r2.cardIndex || 0) + 1)}/5
          </span>
        </div>
      </div>

      {/* Clue-Givers Rotation Pill Header */}
      <div className="bg-surface-container rounded-2xl p-3 border-[2.5px] border-[#090614] shadow-[0_4px_0_0_#090614] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-arena-cyan font-bold">المتكلم (أ):</span>
          <span className="font-black text-white bg-arena-cyan/20 px-2 py-0.5 rounded border border-arena-cyan/40">
            {clueGiverA?.name || 'فارس'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-rose-400 font-bold">المتكلم (ب):</span>
          <span className="font-black text-white bg-rose-500/20 px-2 py-0.5 rounded border border-rose-400/40">
            {clueGiverB?.name || 'زيزو'}
          </span>
        </div>
      </div>

      {/* ================= CLUE-GIVERS VIEW (SECRET TABOO TABLET) ================= */}
      {isClueGiver ? (
        <div className="relative bg-surface-container-low rounded-3xl border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] overflow-hidden space-y-4">
          
          {/* Header strip */}
          <div className="bg-surface-container-high px-4 py-2 flex items-center justify-between border-b-[2.5px] border-[#090614]">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-arena-yellow" />
              <span className="font-pixel text-[10px] text-amber-200">لوحة المتكلم السرية (ممنوع يشوفها المخمن)</span>
            </div>
            <span className="bg-rose-950 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500">
              ممنوع نطق الممنوعات!
            </span>
          </div>

          <div className="p-5 md:p-6 space-y-5">
            {/* Target Secret Word */}
            <div className="text-center">
              <span className="font-pixel text-[9px] text-gray-400 block mb-1">الكلمة السرية المطلوب شرحها:</span>
              <div className="inline-block bg-surface-container-lowest px-8 py-3 rounded-2xl border-[3px] border-primary-container shadow-[0_4px_0_0_#6b4c00]">
                <h1 className="text-2xl md:text-3xl font-black text-arena-yellow tracking-wide drop-shadow-[0_2px_0_#090614] flex items-center justify-center gap-2">
                  <span>{activeQuestion.target_word || activeQuestion.word || 'برج القاهرة'}</span>
                  <span>✨</span>
                </h1>
              </div>
            </div>

            {/* Forbidden Words */}
            <div className="pt-2 border-t-2 border-dashed border-white/10">
              <div className="flex items-center justify-center gap-1 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-black text-rose-300">الكلمات الممنوعة (لو نطقتها هتتخصم منك نقطة):</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {forbiddenWords.map((word, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-rose-950/60 border-2 border-rose-500/60 text-center font-black text-rose-200 text-sm shadow-[0_2px_0_0_#40000c] flex items-center justify-center gap-1.5"
                  >
                    <span>🚫</span>
                    <span>{word}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reciprocal Grading Controls */}
            {isR2Referee && <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="text-xs font-bold text-gray-300 flex items-center justify-between">
                <span>تحكيم الدور المتبادل:</span>
                <span className="text-[10px] text-arena-cyan font-bold">
                  {isClueGiverA ? `أنت مرشد ${teamA.name} وبتحكم على ${teamB.name}` : `أنت مرشد ${teamB.name} وبتحكم على ${teamA.name}`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={isClueGiverA ? handleAwardB : handleAwardA}
                  className="btn-arcade-green py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow hover:scale-[1.02]"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>[صح +نقطة] خمن صح! 🎉</span>
                </button>
                <button
                  onClick={isClueGiverA ? handleFoulB : handleFoulA}
                  className="btn-arcade-red py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow hover:scale-[1.02]"
                >
                  <XCircle className="w-4 h-4" />
                  <span>[مخالفة كلمة ممنوعة -1] ⚠️</span>
                </button>
              </div>
            </div>}


            {/* Resolution outcome and next card trigger */}
            {r2.cardState === 'resolved' && (
              <div className="p-3 bg-arena-card border border-arena-yellow/40 rounded-xl text-center space-y-2">
                <span className="text-xs font-bold text-arena-yellow">
                  تم حسم هذه البطاقة بنجاح!
                </span>
                {(isHost || isR2Referee) && (
                  <div>
                    <button
                      type="button"
                      onClick={handleNextCard}
                      disabled={isAdvancing}
                      className={`btn-arcade-yellow px-5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow hover:scale-105 ${
                        isAdvancing ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <span>البطاقة التالية (Next Card) ➡️</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Timer controls */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="px-4 py-2 rounded-xl bg-surface-container-high border-2 border-[#090614] text-xs font-bold text-white shadow">
                {isTimerRunning ? '⏱️ العداد شغال تلقائي' : '⏱️ انتهى الوقت'}
              </span>
              <button
                onClick={handleFreeze}
                className="px-4 py-2 rounded-xl bg-sky-950 border-2 border-sky-500 text-xs font-bold text-sky-200 shadow hover:scale-105 cursor-pointer flex items-center gap-1"
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span>تجميد الوقت ❄️</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= GUESSERS VIEW (BLIND SPECTATOR) ================= */
        <div className="bg-surface-container rounded-3xl p-6 md:p-8 border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest border-2 border-[#090614] mx-auto flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8 text-arena-yellow animate-pulse" />
          </div>

          <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
            استمع لتلميح زميلك وخمن الكلمة السرية!
          </h2>

          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            الكلمة السرية والممنوعات محجوبة تماماً عنك عشان النزاهة. اسمع تلميح زميلك كويس وقدم تخميناتك!
          </p>

          <div className="bg-surface-container-lowest p-4 rounded-2xl border-2 border-white/10 max-w-xs mx-auto">
            <span className="font-pixel text-xs text-arena-cyan">الوقت المتبقي للتخمين:</span>
            <div className="text-3xl font-mono font-black text-arena-yellow mt-1">
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

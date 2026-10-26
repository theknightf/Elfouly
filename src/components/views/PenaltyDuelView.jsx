import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { sounds } from '../../utils/soundEffects';
import { Shield, Radio, CheckCircle, XCircle, Eye, EyeOff, Zap, Trophy, Flame } from 'lucide-react';
import { calculateBonus, isGeneralCategory } from '../../utils/penaltyRules';
import { RoundTimer } from '../../game/RoundTimer';

/**
 * PenaltyDuelView
 *
 * Strict Role & View Partitioning for Round 3 ("حط في قريبي" / Penalty Shootouts):
 * - Duelists (Kicker & Goalie):
 *   - Kicker: Question Text + Multiple Choice Options (NO answer indicators).
 *   - Goalie: Question Text + Glowing [صد! / Intercept] buzzer (NO answers revealed).
 * - Referees/Spectators (The other 2 players):
 *   - Question Text + Correct Answer Key.
 *   - Adjudication Buttons: [هدف] / [اتصدت / ضاعت].
 * - Penalty Rules:
 *   - 5 Regulation Rounds (10 kicks total) + Sudden Death if tied.
 *   - Specialty Attributes & Bonus Points (+1 for out-of-specialty, 0 for general).
 *   - At least 50% General questions.
 */
export default function PenaltyDuelView({ isMobile = false }) {
  const {
    roomState,
    currentPlayer,
    r3InterceptBuzz,
    r3RecordShot,
    r3SubmitAnswer,
    showToast
  } = useGame();

  const triviaRoom = useTriviaRoom();
  const {
    activeQuestion,
    isKicker,
    isGoalie,
    isDuelist,
    isPenaltyReferee
  } = triviaRoom;

  const r3 = roomState?.round3 || {};
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showKey, setShowKey] = useState(false);

  const kickerTeamKey = r3.kickerTeam || 'team_a';
  const kickerTeam = roomState?.teams?.[kickerTeamKey] || { name: 'فريق الحيتان', score: 0 };
  const goalieTeamKey = kickerTeamKey === 'team_a' ? 'team_b' : 'team_a';
  const goalieTeam = roomState?.teams?.[goalieTeamKey] || { name: 'فريق الوحوش', score: 0 };

  const currentKicker = roomState?.players?.find(p => p.id === r3.currentKickerId) || { name: 'المسدد' };
  const currentGoalie = roomState?.players?.find(p => p.id === r3.currentGoalieId) || { name: 'الحارس' };

  const isIntercepted = !!r3.interceptBuzzedBy;

  useEffect(() => {
    if (r3.answerFeedback) {
      setAnswerFeedback({ option: r3.answerFeedback.option, correct: r3.answerFeedback.isCorrect });
    }
  }, [r3.answerFeedback]);

  useEffect(() => {
    setSelectedOption(null);
    setAnswerFeedback(null);
  }, [r3.turnIndex, r3.phase]);

  useEffect(() => {
    if (r3.phase !== 'shootout' || !r3.shotStartedAt || r3.isComplete) {
      setTimeLeft(0);
      return undefined;
    }
    const endTime = r3.endTime || r3.shotStartedAt + (r3.timer || 20) * 1000;
    const timer = new RoundTimer(remainingMs => setTimeLeft(Math.ceil(remainingMs / 1000)), () => {
      setAnswerFeedback({ correct: false, timeout: true });
      r3RecordShot(isIntercepted ? 'saved' : 'missed');
    });
    timer.start(Math.max(0, (endTime - Date.now()) / 1000));
    return () => timer.dispose();
  }, [r3.phase, r3.shotStartedAt, r3.endTime, r3.timer, r3.turnIndex, r3.isComplete, isIntercepted, r3RecordShot]);

  const categoryId = activeQuestion?.categoryName || activeQuestion?.category;
  const isGeneral = isGeneralCategory(categoryId);
  const kickerAttrs = currentKicker?.attributes || currentKicker?.character?.attributes;
  const kickerBonusApplies = !isGeneral && calculateBonus(kickerAttrs, categoryId, true).bonusAwarded;
  const goalieAttrs = currentGoalie?.attributes || currentGoalie?.character?.attributes;
  const goalieBonusApplies = !isGeneral && calculateBonus(goalieAttrs, categoryId, true).bonusAwarded;

  const handleKickerOptionClick = (option) => {
    if (isIntercepted) {
      showToast('تم الصد!', 'الحارس ضغط زر الصد قبلك!');
      return;
    }
    setSelectedOption(option);
    setAnswerFeedback({ option, pending: true });
    sounds?.playTap?.();
    r3SubmitAnswer(option);
  };

  const handleGoalieBuzz = () => {
    sounds?.playBuzzer?.();
    r3InterceptBuzz();
  };

  const handleRefereeRecord = (result) => {
    if (result === 'goal') {
      sounds.playGoal();
    } else {
      sounds.playSave();
    }
    r3RecordShot(result);
  };

  return (
    <div className={`space-y-5 sandstone-pattern ${isMobile ? 'text-right' : ''}`}>
      
      {/* Top Match Banner (Stitch Screen 3 Style) */}
      <div className="bg-surface-container rounded-2xl p-3.5 border-[3px] border-[#090614] shadow-[0_4px_0_0_#090614] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-container border-2 border-[#090614] shadow-[0_2px_0_0_#090614] flex items-center justify-center text-xl">
            ⚽
          </div>
          <div>
            <div className="font-pixel text-[9px] text-arena-cyan tracking-wider">
              {r3.isSuddenDeath ? '⚡ المنيا لايف — شوط الموت المفاجئ' : 'المنيا لايف — ضربات الجزاء'}
            </div>
            <h2 className="font-headline-sm text-sm md:text-base text-arena-yellow font-black leading-tight flex items-center gap-2">
              <span>في المقص (Penalty Duel)</span>
              {r3.isSuddenDeath && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                  الموت المفاجئ (Sudden Death)
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Duelists Spotlight */}
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-arena-cyan/15 border-2 border-[#090614] px-2.5 py-1 rounded-xl text-arena-cyan font-bold flex items-center gap-1 shadow-[0_2px_0_#090614]">
            <span>⚽ المسدد:</span>
            <span className="font-black text-white">{currentKicker.name}</span>
          </div>
          <div className="bg-arena-yellow/15 border-2 border-[#090614] px-2.5 py-1 rounded-xl text-arena-yellow font-bold flex items-center gap-1 shadow-[0_2px_0_#090614]">
            <span>🧤 الحارس:</span>
            <span className="font-black text-white">{currentGoalie.name}</span>
          </div>
        </div>
      </div>

      {/* Main Question Card (Visible to all) */}
      <div className="bg-arena-card rounded-3xl p-4 sm:p-6 md:p-8 border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/30">
              {activeQuestion.categoryName || activeQuestion.category || 'كرة قدم بعد 2010'}
            </span>
            {isGeneral ? (
              <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-400/40">
                🌐 سؤال عام
              </span>
            ) : kickerBonusApplies ? (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/40 animate-pulse">
                🎯 فرصة بونص للمسدد (+1 نقطة خارج التخصص)
              </span>
            ) : null}
          </div>

          <span className="font-pixel text-[10px] text-arena-yellow">
            {r3.isSuddenDeath
              ? `ركلة ${((r3.turnIndex || 0) + 1)} (الموت المفاجئ)`
              : `ركلة ${((r3.turnIndex || 0) + 1)}/10 (+1000 نقطة)`}
          </span>
        </div>

        <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed text-right min-h-[60px] drop-shadow-[0_2px_0_#090614]">
          {activeQuestion.question_text || activeQuestion.question}
        </h3>
        {r3.phase === 'shootout' && <div className="mt-3 text-center font-mono text-2xl font-black text-arena-yellow" role="timer">{timeLeft}s</div>}
        {r3.phase === 'shootout' && <div className="mt-3 inline-flex rounded-full bg-arena-darker px-3 py-1 font-mono text-arena-yellow" role="timer">⏱ {timeLeft}s</div>}
        {answerFeedback && <div className={`mt-3 rounded-xl p-3 text-center font-black ${answerFeedback.timeout ? 'bg-red-700/40 text-red-200' : 'bg-amber-700/40 text-amber-100'}`} role="status">{answerFeedback.timeout ? 'انتهى الوقت — الإجابة اتحسمت' : 'تم استلام إجابتك — جاري حسم الركلة فورًا'}</div>}

        {/* Intercept Alert */}
        {isIntercepted && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 text-center font-black text-sm animate-pulse flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 fill-current" />
            <span>الحارس ضغط زر الصد! مطلوب منه تسميع الإجابة شفهياً الآن!</span>
          </div>
        )}
      </div>

      {/* ================= VIEW A: KICKER (MC Options) ================= */}
      {isKicker && (
        <div className="space-y-3 bg-arena-card p-5 rounded-2xl border-2 border-arena-cyan/40 shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-arena-cyan">
            <span>أنت المسدد (Kicker): اختر إجابتك لتسديد الكرة</span>
            <span className="text-[10px] text-gray-400">بدون كشف الحل</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {(activeQuestion.options || ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4']).map((opt, idx) => {
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={idx}
                  onClick={() => handleKickerOptionClick(opt)}
                  disabled={isIntercepted || selectedOption !== null || !!answerFeedback}
                  className={`p-4 rounded-xl text-right font-black text-sm transition-all border ${
                    isSelected
                      ? 'bg-arena-cyan text-arena-darker border-white shadow-lg scale-102'
                      : 'bg-arena-darker/80 text-white border-white/10 hover:border-arena-cyan hover:bg-arena-darker'
                  } ${isIntercepted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt}</span>
                    <Radio className={`w-4 h-4 ${isSelected ? 'text-arena-darker' : 'text-gray-500'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= VIEW B: GOALIE (Intercept Glowing Buzzer) ================= */}
      {isGoalie && (
        <div className="space-y-3 bg-arena-card p-5 rounded-2xl border-2 border-arena-yellow/50 shadow-xl text-center">
          <div className="text-xs font-bold text-arena-yellow">
            أنت حارس المرمى (Goalie): هل تعرف الإجابة قبل أن يسدد الخصم؟
          </div>

          <button
            onClick={handleGoalieBuzz}
            disabled={isIntercepted}
            className={`w-full py-6 rounded-3xl font-black text-lg md:text-xl flex items-center justify-center gap-3 transition-all ${
              isIntercepted
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'btn-arcade-yellow shadow-2xl shadow-arena-yellow/30 hover:scale-[1.02] cursor-pointer animate-pulse'
            }`}
          >
            <Shield className="w-7 h-7 fill-current" />
            <span>[صد! / Intercept] 🧤</span>
          </button>

          <p className="text-[11px] text-gray-400">
            اضغط زر الصد إذا كنت تعرف الإجابة الصحيحة لخطف الركلة ومنع المسدد من اختيار الخيارات!
          </p>
        </div>
      )}

      {/* ================= VIEW C: REFEREES / SPECTATORS (Answer Key & Adjudication) ================= */}
      {isPenaltyReferee && (
        <div className="space-y-4 bg-arena-card p-5 rounded-2xl border-2 border-emerald-500/40 shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
            <span>لوحة تحكيم الركلة (Referees Screen):</span>
            <span className="text-[10px] text-gray-400">الحكام والمشاهدون فقط 🛡️</span>
          </div>

          {/* Correct Answer Key */}
          <div className="bg-emerald-950/60 p-3.5 rounded-xl border border-emerald-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300">الإجابة الصحيحة:</span>
              <span className="text-base font-black text-arena-green">
                {activeQuestion.correct_answer || activeQuestion.answer || 'تشيلسي'}
              </span>
            </div>
            <span className="text-[10px] text-gray-400">مفتاح رسمي 🔒</span>
          </div>

          {/* Adjudication Buttons */}
          <div className="space-y-2 pt-1">
            <div className="text-xs text-gray-400 font-bold text-center">
              تأكيد نتيجة الركلة (Goal / Saved):
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleRefereeRecord('goal')}
                className="btn-arcade-green py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow hover:scale-[1.02]"
              >
                <CheckCircle className="w-5 h-5" />
                <span>[هدف] Goal! ⚽ {kickerBonusApplies ? '(+1 بونص 🎯)' : ''}</span>
              </button>
              <button
                onClick={() => handleRefereeRecord('saved')}
                className="btn-arcade-red py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow hover:scale-[1.02]"
              >
                <XCircle className="w-5 h-5" />
                <span>[اتصدت / ضاعت] Saved! 🧤 {goalieBonusApplies ? '(+1 بونص 🎯)' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

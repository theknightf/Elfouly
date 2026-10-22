import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useTriviaRoom } from '../../hooks/useTriviaRoom';
import { sounds } from '../../utils/soundEffects';
import { CheckCircle, XCircle, Radio, ShieldCheck, Target, ChevronRight, Trophy, Sparkles } from 'lucide-react';
import { calculateBonus, isGeneralCategory } from '../../utils/penaltyRules';

/**
 * PenaltyDuelView
 *
 * Round 3 ("حط في قريبي" / Penalty Shootout):
 * - Turn-based shootout alternating Team A -> Team B up to 5 kicks per team (10 total, sudden death if tied).
 * - Step 1: System selects random category.
 * - Step 2: Active team captain chooses shooter.
 * - Step 3: Chosen shooter receives on-screen alert.
 * - Step 4: Question displayed, single judge evaluates Goal / Miss.
 * - Attribute Bonus Point: Correct answer outside native attributes earns +1 Bonus Point!
 * - No Auto-Advancement: Manual progression trigger ("Next Question" / "Next Shot") once resolved.
 */
export default function PenaltyDuelView({ isMobile = false }) {
  const {
    roomState,
    currentPlayer,
    isHost,
    r3RecordShot,
    r3SubmitAnswer,
    r3SelectDuelists,
    r3StartShootout,
    r3NextShot,
    nextRound
  } = useGame();

  const triviaRoom = useTriviaRoom();
  const { activeQuestion, isKicker, isPenaltyReferee } = triviaRoom;

  const r3 = roomState?.round3 || {};
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedShooterId, setSelectedShooterId] = useState(r3.currentKickerId || null);

  const kickerTeamKey = r3.kickerTeam || 'team_a';
  const defendingTeamKey = kickerTeamKey === 'team_a' ? 'team_b' : 'team_a';
  const kickerTeam = roomState?.teams?.[kickerTeamKey] || { name: 'فريق الحيتان', score: 0 };

  const kickingPlayers = (roomState?.players || []).filter(p => p.team === kickerTeamKey);
  const defendingPlayers = (roomState?.players || []).filter(p => p.team === defendingTeamKey);
  const teamRepresentative = kickingPlayers[0];
  const isRepresentative = !!currentPlayer && teamRepresentative?.id === currentPlayer.id;

  const currentKicker = roomState?.players?.find(p => p.id === r3.currentKickerId) || { name: 'المسدد' };
  const judge = roomState?.players?.find(p => p.id === r3.refereePlayerId) || { name: 'الحكم' };

  const categoryId = activeQuestion?.categoryName || activeQuestion?.category;
  const isGeneral = isGeneralCategory(categoryId);
  const kickerAttrs = currentKicker?.attributes || currentKicker?.character?.attributes;
  const kickerBonusApplies = !isGeneral && calculateBonus(kickerAttrs, categoryId, true).bonusAwarded;

  const hasPendingAnswer = !!r3.pendingAnswer;
  const isDuelistSelection = (r3.phase || 'duelist_selection') === 'duelist_selection';
  const activeShooterId = selectedShooterId || r3.currentKickerId;

  useEffect(() => {
    if (r3.currentKickerId) setSelectedShooterId(r3.currentKickerId);
  }, [r3.currentKickerId]);

  useEffect(() => {
    setSelectedOption(null);
  }, [r3.currentQuestion?.id, r3.turnIndex]);

  const handleKickerOptionClick = (option) => {
    if (hasPendingAnswer) return;
    setSelectedOption(option);
    sounds?.playTap?.();
    r3SubmitAnswer(option);
  };

  const handleJudgeDecision = (result) => {
    if (result === 'goal') sounds.playGoal();
    else sounds.playSave();
    r3RecordShot(result);
  };

  const handlePickShooter = (playerId) => {
    setSelectedShooterId(playerId);
    // The legacy transport still expects a goalie id; it is never used by the
    // judge-based rules, so we simply pass the first defending player.
    r3SelectDuelists(playerId, r3.currentGoalieId || defendingPlayers[0]?.id || null);
  };

  const handleStartShot = () => {
    if (!activeShooterId) return;
    r3StartShootout();
  };

  return (
    <div className={`space-y-5 sandstone-pattern ${isMobile ? 'text-right' : ''}`}>
      {/* Top Match Banner */}
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

        <div className="flex items-center gap-2 text-xs">
          <div className="bg-arena-cyan/15 border-2 border-[#090614] px-2.5 py-1 rounded-xl text-arena-cyan font-bold flex items-center gap-1 shadow-[0_2px_0_#090614]">
            <span>⚽ المسدد:</span>
            <span className="font-black text-white">{currentKicker.name}</span>
          </div>
          <div className="bg-arena-red/15 border-2 border-[#090614] px-2.5 py-1 rounded-xl text-arena-red font-bold flex items-center gap-1 shadow-[0_2px_0_#090614]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>الحكم:</span>
            <span className="font-black text-white">{judge.name}</span>
          </div>
        </div>
      </div>

      {/* Shootout Completed Screen */}
      {r3.isComplete ? (
        <div className="bg-arena-card rounded-3xl p-8 border-2 border-arena-yellow text-center space-y-5 shadow-2xl animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-arena-yellow/20 border-2 border-arena-yellow mx-auto flex items-center justify-center text-3xl">
            🏆
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-arena-yellow">
              اكتملت ركلات الجزاء الترجيحية! 🏁
            </h3>
            <p className="text-sm text-gray-300 max-w-md mx-auto">
              تم حسم الركلات بالكامل. جاهزون للانتقال للجولة الرابعة (المزاد الفاصل).
            </p>
            <div className="flex justify-center gap-6 pt-2">
              <span className="text-base font-black text-arena-cyan">
                {roomState?.teams?.team_a?.name || 'فريق A'}: {roomState?.teams?.team_a?.penaltyScore || 0} ركلة
              </span>
              <span className="text-base font-black text-arena-red">
                {roomState?.teams?.team_b?.name || 'فريق B'}: {roomState?.teams?.team_b?.penaltyScore || 0} ركلة
              </span>
            </div>
          </div>
          {(isHost || isPenaltyReferee) && (
            <div className="pt-3">
              <button
                type="button"
                onClick={nextRound}
                className="btn-arcade-green px-8 py-3.5 rounded-2xl font-black text-base inline-flex items-center gap-2 cursor-pointer shadow-xl hover:scale-[1.02] animate-bounce-short"
              >
                <span>الانتقال للجولة 4: "مين يزوّد؟" (Next Round) 🏷️</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      ) : isDuelistSelection ? (
        <div className="bg-arena-card rounded-3xl p-6 border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] space-y-4">
          {/* Step 1: System selected category */}
          <div className="bg-arena-darker/80 rounded-2xl p-3 border border-arena-cyan/30 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">الخطوة 1: التصنيف المختار عشوائياً 🎲</span>
            <span className="text-xs font-black text-arena-cyan bg-arena-cyan/15 px-3 py-1 rounded-full border border-arena-cyan/40">
              {r3.currentCategory?.name || 'كرة قدم بعد 2010'}
            </span>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-black text-arena-yellow">
              الخطوة 2: كابتن {kickerTeam.name} يختار المسدد 🎯
            </h3>
            <p className="text-xs text-gray-400 font-bold mt-1">
              ممثل الفريق ({teamRepresentative?.name || 'كابتن الفريق'}) يحدد من سيسدد هذه الركلة.
            </p>
          </div>

          {isRepresentative ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {kickingPlayers.map((player) => {
                  const isSelected = activeShooterId === player.id;
                  return (
                    <button
                      key={player.id}
                      onClick={() => handlePickShooter(player.id)}
                      className={`p-4 rounded-2xl border-2 font-black text-sm flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-arena-cyan text-arena-darker border-white shadow-lg'
                          : 'bg-arena-darker/80 text-white border-white/10 hover:border-arena-cyan'
                      }`}
                    >
                      <span>{player.character?.avatar || '🎮'} {player.name}</span>
                      <Target className={`w-5 h-5 ${isSelected ? 'text-arena-darker' : 'text-gray-500'}`} />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleStartShot}
                disabled={!activeShooterId}
                className={`w-full py-4 rounded-2xl font-black text-sm md:text-base shadow-xl ${
                  activeShooterId ? 'btn-arcade-yellow hover:scale-[1.01] cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                ابدأ الركلة ⚽
              </button>
            </>
          ) : (
            <div className="text-center text-xs font-bold text-gray-400 bg-arena-darker/60 rounded-2xl p-4">
              مستنيين ممثل {kickerTeam.name} يختار المسدد…
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Question (visible to all) */}
          <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-[3.5px] border-[#090614] shadow-[0_6px_0_0_#090614] relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/30">
                  {activeQuestion.categoryName || activeQuestion.category || 'كرة قدم بعد 2010'}
                </span>
                {isGeneral ? (
                  <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-400/40">
                    🌐 سؤال عام — بدون بونص
                  </span>
                ) : kickerBonusApplies ? (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/40 animate-pulse">
                    🎯 بونص خارج التخصص (+1)
                  </span>
                ) : null}
              </div>

              <span className="font-pixel text-[10px] text-arena-yellow">
                {r3.isSuddenDeath
                  ? `ركلة ${((r3.turnIndex || 0) + 1)} (الموت المفاجئ)`
                  : `ركلة ${((r3.turnIndex || 0) + 1)}/10`}
              </span>
            </div>

            <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed text-right min-h-[60px] drop-shadow-[0_2px_0_#090614]">
              {activeQuestion.question_text || activeQuestion.question}
            </h3>

            {hasPendingAnswer && (
              <div className="mt-4 p-3 rounded-2xl bg-arena-cyan/15 border-2 border-arena-cyan/50 text-arena-cyan text-center font-black text-sm">
                🔒 تم تسجيل إجابة المسدد — في انتظار قرار الحكم (Goal / Miss).
              </div>
            )}

            {/* Resolution Outcome Banner (No Auto-Advancement) */}
            {(r3.shotState === 'resolved' || r3.lastShotResult) && (
              <div className={`mt-5 p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn ${
                (r3.lastShotResult?.result === 'goal' || r3.shotsHistory?.slice(-1)[0]?.result === 'goal')
                  ? 'bg-emerald-950/80 border-arena-green shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                  : 'bg-rose-950/80 border-arena-red shadow-[0_0_25px_rgba(239,68,68,0.35)]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="text-4xl">
                    {(r3.lastShotResult?.result === 'goal' || r3.shotsHistory?.slice(-1)[0]?.result === 'goal') ? '⚽' : '❌'}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-white flex items-center gap-2">
                      <span>
                        {(r3.lastShotResult?.result === 'goal' || r3.shotsHistory?.slice(-1)[0]?.result === 'goal')
                          ? 'هدف رسمي! Goal! ⚽'
                          : 'ضربة ضائعة! Miss ❌'}
                      </span>
                      {(r3.lastShotResult?.bonusAwarded || r3.shotsHistory?.slice(-1)[0]?.bonusAwarded) && (
                        <span className="text-xs bg-amber-400 text-arena-darker px-2 py-0.5 rounded-full font-black animate-bounce">
                          🎯 بونص خارج التخصص (+1)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-300 font-bold mt-0.5">
                      حكم المباراة اعتمد النتيجة. في انتظار صافرة الركلة التالية.
                    </div>
                  </div>
                </div>

                {(isHost || isPenaltyReferee) && (
                  <button
                    type="button"
                    onClick={r3NextShot}
                    className="btn-arcade-yellow px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:scale-[1.02] animate-pulse whitespace-nowrap"
                  >
                    <span>الركلة التالية (Next Question)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Shooter view */}
          {isKicker && (
            <div className="space-y-3 bg-arena-card p-5 rounded-2xl border-2 border-arena-cyan/40 shadow-xl">
              <div className="flex items-center justify-between text-xs font-bold text-arena-cyan">
                <span>أنت المسدد: اختر إجابتك</span>
                <span className="text-[10px] text-gray-400">بدون كشف الحل</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {(activeQuestion.options && activeQuestion.options.length
                  ? activeQuestion.options
                  : ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4']
                ).map((opt, idx) => {
                  const isSelected = selectedOption === opt;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleKickerOptionClick(opt)}
                      disabled={hasPendingAnswer}
                      className={`p-4 rounded-xl text-right font-black text-sm transition-all border ${
                        isSelected
                          ? 'bg-arena-cyan text-arena-darker border-white shadow-lg'
                          : 'bg-arena-darker/80 text-white border-white/10 hover:border-arena-cyan'
                      } ${hasPendingAnswer ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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

          {/* Judge view (single judge, opponent team) */}
          {isPenaltyReferee && (
            <div className="space-y-4 bg-arena-card p-5 rounded-2xl border-2 border-arena-red/50 shadow-xl">
              <div className="flex items-center justify-between text-xs font-bold text-arena-red">
                <span>أنت الحكم الوحيد لهذه الركلة:</span>
                <span className="text-[10px] text-gray-400">Goal / Miss</span>
              </div>

              <div className="bg-emerald-950/60 p-3.5 rounded-xl border border-emerald-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-300">الإجابة الصحيحة:</span>
                  <span className="text-base font-black text-arena-green">
                    {activeQuestion.correct_answer || activeQuestion.answer || '—'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">مفتاح رسمي 🔒</span>
              </div>

              {r3.shotState === 'resolved' ? (
                <div className="p-3 bg-arena-darker/80 border border-white/10 rounded-xl text-center space-y-2">
                  <div className="text-xs font-bold text-gray-300">
                    تم حسم هذه الركلة بنجاح. اضغط على زر "الركلة التالية" لتحميل الركلة القادمة.
                  </div>
                  <button
                    type="button"
                    onClick={r3NextShot}
                    className="btn-arcade-yellow px-6 py-2.5 rounded-xl font-black text-xs md:text-sm inline-flex items-center gap-2 cursor-pointer shadow-lg hover:scale-[1.02]"
                  >
                    <span>الركلة التالية (Next Shot) ➡️</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleJudgeDecision('goal')}
                    className="btn-arcade-green py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow hover:scale-[1.02]"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>[هدف] Goal! ⚽ {kickerBonusApplies ? '(+1 🎯)' : ''}</span>
                  </button>
                  <button
                    onClick={() => handleJudgeDecision('missed')}
                    className="btn-arcade-red py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow hover:scale-[1.02]"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>[ضاعت] Miss ❌</span>
                  </button>
                </div>
              )}

              <p className="text-[11px] text-gray-400 text-center">
                أنت الحكم الوحيد — قرارك هو النتيجة النهائية للركلة.
              </p>
            </div>
          )}

          {/* Defending team non-judge helper */}
          {!isPenaltyReferee && !isKicker && (
            <div className="text-center text-xs font-bold text-gray-400 bg-arena-card rounded-2xl p-3 border border-white/10">
              👀 متفرج — القرار عند المسدد والحكم فقط.
            </div>
          )}
        </>
      )}
    </div>
  );
}

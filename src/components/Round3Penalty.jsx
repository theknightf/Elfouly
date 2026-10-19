import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { PENALTY_QUESTIONS } from '../data/questions';
import { sounds } from '../utils/soundEffects';
import { Shield, Flame, Trophy, ArrowRight, Eye, EyeOff, Radio, CheckCircle, XCircle } from 'lucide-react';

export default function Round3Penalty() {
  const {
    roomState,
    r3InterceptBuzz,
    r3RecordShot,
    r3SelectDuelists,
    r3StartShootout,
    changeRound,
    showToast
  } = useGame();

  const [showAnswer, setShowAnswer] = useState(false);

  const r3 = roomState?.round3 || {};
  const turnIndex = r3.turnIndex || 0;
  const currentCategory = r3.currentCategory || { name: 'برشلونة وأوروبا (بعد 2010)', icon: '⚽', hint: 'تخصص كروي' };
  const isDuelistSelection = r3.phase === 'duelist_selection';

  const currentQ = r3.currentQuestion || PENALTY_QUESTIONS[0] || {
    question: 'ما هو اسم الملعب الأسطوري لنادي برشلونة؟',
    answer: 'كامب نو',
    options: ['كامب نو', 'سانتياغو برنابيو', 'المستايا', 'أنفيلد'],
    kickerHint: 'برشلونة وأوروبا'
  };
  const kickingTeamKey = r3.kickerTeam || 'team_a';
  const defendingTeamKey = kickingTeamKey === 'team_a' ? 'team_b' : 'team_a';

  const teamA = roomState?.teams?.team_a || { name: 'فريق الحيتان', score: 0 };
  const teamB = roomState?.teams?.team_b || { name: 'فريق الوحوش', score: 0 };

  const kickingTeam = roomState?.teams?.[kickingTeamKey] || teamA;
  const defendingTeam = roomState?.teams?.[defendingTeamKey] || teamB;

  const teamAPlayers = roomState?.players?.filter(p => p.team === 'team_a') || [];
  const teamBPlayers = roomState?.players?.filter(p => p.team === 'team_b') || [];
  const kickingTeamPlayers = kickingTeamKey === 'team_a' ? teamAPlayers : teamBPlayers;
  const defendingTeamPlayers = kickingTeamKey === 'team_a' ? teamBPlayers : teamAPlayers;

  const currentKicker = roomState?.players?.find(p => p.id === r3.currentKickerId) || kickingTeamPlayers[0] || roomState?.players?.[0];
  const currentGoalie = roomState?.players?.find(p => p.id === r3.currentGoalieId) || defendingTeamPlayers[0] || roomState?.players?.[1] || roomState?.players?.[0];

  const shotsHistory = r3.shotsHistory || [];
  const teamAShots = shotsHistory.filter(s => s && s.team === 'team_a');
  const teamBShots = shotsHistory.filter(s => s && s.team === 'team_b');

  const isIntercepted = !!r3.interceptBuzzedBy;

  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null); // { option, isCorrect }

  const handleInterceptClick = () => {
    r3InterceptBuzz();
  };

  const handleRecord = (result) => {
    setShowAnswer(false);
    setSelectedOption(null);
    setFeedback(null);
    r3RecordShot(result);
  };

  const handleOptionSelect = (opt) => {
    if (selectedOption) return; // prevent duplicate clicks while resolving
    setSelectedOption(opt);

    const normOpt = String(opt || '').trim().toLowerCase();
    const normAns = String(currentQ?.answer || '').trim().toLowerCase();
    const isCorrect = normOpt === normAns || (normAns && normOpt && (normAns.includes(normOpt) || normOpt.includes(normAns)));

    setFeedback({ option: opt, isCorrect });

    setTimeout(() => {
      if (isIntercepted) {
        sounds.playSave();
        showToast('🧤 تصدي حارس المرمى!', `${currentGoalie?.name || 'حارس المرمى'} تصدى للتسديدة وخطف النقطة! (+800ن)`);
        handleRecord('saved');
      } else if (isCorrect) {
        sounds.playGoalRoar();
        showToast('⚽ هدف في المقص!', `${currentKicker?.name || 'المسدد'} أحرز هدفاً رائعاً في الشباك! (+1000ن)`);
        handleRecord('goal');
      } else {
        sounds.playBuzzer();
        showToast('❌ ضاعت الركلة!', `${currentKicker?.name || 'المسدد'} أضاع التسديدة في العارضة!`);
        handleRecord('missed');
      }
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      
      {/* Top Banner: Round Info */}
      <div className="bg-arena-card rounded-2xl p-4 border border-arena-cyan/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-arena-red/20 border-2 border-arena-red flex items-center justify-center text-2xl font-black text-arena-red">
            ⚽
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-arena-red bg-arena-red/10 px-2 py-0.5 rounded-full border border-arena-red/20">
              <Flame className="w-3.5 h-3.5" />
              <span>جولة 3: "حط في قريبي" (Penalty Shootouts)</span>
              <span className="bg-arena-yellow/20 text-arena-yellow px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
                ركلة {Math.min(10, (r3.turnIndex || 0) + 1)} / 10
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              ركلات الجزاء التهديفية والتصدي الحاسم! 🥅
            </h2>
          </div>
        </div>

        {/* 1v1 Matchup Spotlight */}
        <div className="flex items-center gap-3 bg-arena-darker/90 px-4 py-2 rounded-2xl border border-white/10">
          {/* Kicker */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentKicker?.character?.avatar || '⚡'}</span>
            <div className="text-right">
              <div className="text-[10px] text-gray-400">المسدد (Shooter):</div>
              <div className="text-xs font-black text-arena-cyan">{currentKicker?.name || 'المسدد'}</div>
            </div>
          </div>

          <span className="text-arena-yellow font-black text-sm italic px-1">VS</span>

          {/* Goalie / Interceptor */}
          <div className="flex items-center gap-2">
            <div className="text-left">
              <div className="text-[10px] text-gray-400">حارس المرمى (Goalie):</div>
              <div className="text-xs font-black text-arena-red">{currentGoalie?.name || 'حارس المرمى'}</div>
            </div>
            <span className="text-2xl">{currentGoalie?.character?.avatar || '🛡️'}</span>
          </div>
          
          {currentGoalie?.character?.id === 'khaled_elbarbakh' && (
            <span className="text-[10px] bg-arena-red/30 text-arena-red px-2 py-1 rounded-lg font-black border border-arena-red/50 animate-pulse">
              حائط صد البربخ! 🛡️
            </span>
          )}
        </div>
      </div>

      {/* Penalty Shootout Scoreboard (5 kicks per team) */}
      <div className="bg-arena-card rounded-3xl p-5 border-2 border-arena-cyan/30 shadow-2xl">
        <div className="text-xs font-bold text-gray-400 mb-3 text-center">
          سجل ضربات الجزاء الترجيحية (5 تسديدات لكل فريق)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Team A Penalty Record */}
          <div className="bg-arena-darker/80 p-4 rounded-2xl border border-arena-cyan/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-arena-cyan">{teamA.name || 'فريق الحيتان'}</span>
              <span className="text-xs font-mono font-bold text-white">
                أهداف: {teamAShots.filter(s => s.result === 'goal').length} / 5
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3, 4].map(idx => {
                const shot = teamAShots[idx];
                return (
                  <div
                    key={idx}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2 transition-all ${
                      shot?.result === 'goal'
                        ? 'bg-emerald-950 border-arena-green text-arena-green shadow-[0_0_10px_#00E676]'
                        : shot?.result === 'saved'
                        ? 'bg-amber-950 border-arena-yellow text-arena-yellow shadow-[0_0_10px_#FFD200]'
                        : shot?.result === 'missed'
                        ? 'bg-rose-950 border-arena-red text-arena-red'
                        : 'bg-arena-darker border-white/20 text-gray-600'
                    }`}
                  >
                    {shot?.result === 'goal' ? '⚽' : shot?.result === 'saved' ? '🧤' : shot?.result === 'missed' ? '❌' : idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team B Penalty Record */}
          <div className="bg-arena-darker/80 p-4 rounded-2xl border border-arena-red/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-arena-red">{teamB.name || 'فريق الوحوش'}</span>
              <span className="text-xs font-mono font-bold text-white">
                أهداف: {teamBShots.filter(s => s.result === 'goal').length} / 5
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3, 4].map(idx => {
                const shot = teamBShots[idx];
                return (
                  <div
                    key={idx}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2 transition-all ${
                      shot?.result === 'goal'
                        ? 'bg-emerald-950 border-arena-green text-arena-green shadow-[0_0_10px_#00E676]'
                        : shot?.result === 'saved'
                        ? 'bg-amber-950 border-arena-yellow text-arena-yellow shadow-[0_0_10px_#FFD200]'
                        : shot?.result === 'missed'
                        ? 'bg-rose-950 border-arena-red text-arena-red'
                        : 'bg-arena-darker border-white/20 text-gray-600'
                    }`}
                  >
                    {shot?.result === 'goal' ? '⚽' : shot?.result === 'saved' ? '🧤' : shot?.result === 'missed' ? '❌' : idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Duelist Selection Phase vs Active Shootout Phase */}
      {isDuelistSelection ? (
        <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-2 border-arena-yellow/50 shadow-2xl space-y-6 animate-fadeIn">
          {/* Random Category Reveal Announcement */}
          <div className="text-center space-y-2 bg-arena-darker/80 p-5 rounded-2xl border border-arena-yellow/30">
            <span className="text-xs font-black text-arena-yellow bg-arena-yellow/10 px-3 py-1 rounded-full border border-arena-yellow/30">
              🎲 الخطوة 1: كشف التصنيف المختار عشوائياً لركلة الجزاء
            </span>
            <div className="flex items-center justify-center gap-3 py-2">
              <span className="text-4xl">{currentCategory.icon || '⚽'}</span>
              <h3 className="text-2xl md:text-3xl font-black text-white">
                "{currentCategory.name}"
              </h3>
            </div>
            <p className="text-xs text-gray-300">
              💡 {currentCategory.hint || 'اختر لاعباً يمتلك تخصصاً مطابقاً للاستفادة من قوة معلوماته وسرعة بديهته!'}
            </p>
          </div>

          {/* Duelist Roster Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Kicking Team Selector */}
            <div className="bg-arena-darker/90 p-5 rounded-2xl border border-arena-cyan/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-arena-cyan flex items-center gap-1.5">
                  <span>🎯 مسدد {kickingTeam.name} (Shooter):</span>
                </span>
                <span className="text-[10px] text-gray-400">انقر لتحديد المسدد</span>
              </div>

              <div className="space-y-2">
                {kickingTeamPlayers.map(p => {
                  const isSelected = p.id === currentKicker?.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => r3SelectDuelists(p.id, null)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-arena-cyan/20 border-arena-cyan text-white shadow-[0_0_15px_rgba(0,242,254,0.3)] scale-[1.01]'
                          : 'bg-arena-card hover:bg-arena-card/80 border-white/10 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.character?.avatar || '⚡'}</span>
                        <div className="text-right">
                          <div className="text-xs font-black">{p.name}</div>
                          <div className="text-[10px] text-gray-400">{p.character?.badge}</div>
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-black text-arena-cyan bg-arena-cyan/20 px-2 py-0.5 rounded-full border border-arena-cyan/30">
                          المسدد المعتمد ⚽
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-bold">اختيار</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Defending Team Selector */}
            <div className="bg-arena-darker/90 p-5 rounded-2xl border border-arena-red/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-arena-red flex items-center gap-1.5">
                  <span>🧤 حارس {defendingTeam.name} (Goalie):</span>
                </span>
                <span className="text-[10px] text-gray-400">انقر لتحديد الحارس</span>
              </div>

              <div className="space-y-2">
                {defendingTeamPlayers.map(p => {
                  const isSelected = p.id === currentGoalie?.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => r3SelectDuelists(null, p.id)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-arena-red/20 border-arena-red text-white shadow-[0_0_15px_rgba(255,75,75,0.3)] scale-[1.01]'
                          : 'bg-arena-card hover:bg-arena-card/80 border-white/10 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.character?.avatar || '🛡️'}</span>
                        <div className="text-right">
                          <div className="text-xs font-black">{p.name}</div>
                          <div className="text-[10px] text-gray-400">{p.character?.badge}</div>
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-black text-arena-red bg-arena-red/20 px-2 py-0.5 rounded-full border border-arena-red/30">
                          حامي العرين 🧤
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-bold">اختيار</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Action confirmation button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={r3StartShootout}
              className="btn-arcade-green py-4 px-8 rounded-2xl font-black text-base flex items-center gap-2 shadow-2xl hover:brightness-110 cursor-pointer w-full sm:w-auto justify-center"
            >
              <span>تأكيد المبارزين والانطلاق للتسديد 1v1! ⚽</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* Main Kicking Arena & Intercept Console */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Kicker's Question Card (8 cols) */}
          <div className="lg:col-span-8 bg-arena-card rounded-3xl p-6 md:p-8 border-2 border-arena-cyan/40 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/20">
                تخصص التسديد: {currentCategory?.name || currentQ.kickerHint}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => r3SelectDuelists(null, null)}
                  className="text-[11px] text-gray-400 hover:text-white underline"
                  title="تغيير المبارزين لهذه الركلة"
                >
                  تغيير المبارزين 🔄
                </button>
                <span className="text-xs font-mono font-bold text-gray-400">
                  الضربة رقم {turnIndex + 1} من 10
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">
                سؤال التسديدة لـ <span className="text-arena-cyan font-bold">{currentKicker?.name}</span>:
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed">
                {currentQ.question}
              </h3>
            </div>

            {/* Intercept Alert Banner */}
            {isIntercepted && (
              <div className="bg-arena-red/20 border-2 border-arena-red p-3 rounded-2xl flex items-center gap-3 animate-pulse">
                <Shield className="w-5 h-5 text-arena-red fill-current" />
                <div className="text-right text-xs">
                  <span className="font-black text-arena-red">تحذير! الحارس ضغط على بزر الصد: </span>
                  <span className="text-gray-200">أي إجابة غير دقيقة ستُحتسب تصدي مباشر لحارس المرمى!</span>
                </div>
              </div>
            )}

            {/* Multiple options for fast play - Interactive Clickable Buttons */}
            {currentQ.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === opt;
                  const isCorrect = feedback && feedback.option === opt && feedback.isCorrect;
                  const isWrong = feedback && feedback.option === opt && !feedback.isCorrect;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(opt)}
                      disabled={!!selectedOption}
                      className={`p-4 rounded-2xl border-2 text-right transition-all flex items-center justify-between cursor-pointer shadow-md ${
                        isCorrect
                          ? 'bg-emerald-950/90 border-arena-green text-arena-green scale-[1.02] shadow-[0_0_15px_#00E676]'
                          : isWrong
                          ? 'bg-rose-950/90 border-arena-red text-arena-red scale-[0.98]'
                          : isSelected
                          ? 'bg-arena-cyan/20 border-arena-cyan text-white'
                          : 'bg-arena-darker/90 hover:bg-arena-card border-white/10 hover:border-arena-cyan text-gray-200'
                      }`}
                    >
                      <span className="text-xs md:text-sm font-bold">{opt}</span>
                      <span className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center font-mono text-arena-cyan font-black text-xs">
                        {idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Answer section */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-arena-darker border border-white/10 hover:border-arena-cyan text-xs font-bold text-gray-300 transition-all"
              >
                {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-arena-yellow" />}
                <span>{showAnswer ? 'إخفاء الإجابة' : 'كشف إجابة السؤال للحكم'}</span>
              </button>
              {showAnswer && (
                <span className="text-sm font-black text-arena-green bg-emerald-950 px-3 py-1 rounded-lg border border-arena-green/50">
                  الإجابة الصحيحة: {currentQ.answer}
                </span>
              )}
            </div>
          </div>

          {/* Goalie Intercept Buzzer & Referee Judgment (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Goalie Intercept Buzzer */}
            <div className="bg-arena-card rounded-2xl p-5 border-2 border-arena-red/50 shadow-xl text-center space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-xs font-black text-arena-red">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>بزر حارس المرمى ({currentGoalie?.name || 'الحارس'})</span>
              </div>

              <p className="text-[11px] text-gray-400">
                لو المسدد تردد أو معرفش، اضغط على بزر الصد لخطف النقطة!
              </p>

              <button
                onClick={handleInterceptClick}
                disabled={isIntercepted}
                className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isIntercepted
                    ? 'bg-arena-red/40 text-gray-400 border border-gray-600'
                    : 'btn-arcade-red animate-buzzer'
                }`}
              >
                <Shield className="w-6 h-6 fill-current" />
                <span>{isIntercepted ? 'تم الضغط على الصد! 🛡️' : 'صد يا بربخ! (Intercept)'}</span>
              </button>
            </div>

            {/* Referee Shot Result Validation */}
            <div className="bg-arena-card/90 rounded-2xl p-4 border border-white/20 shadow-xl space-y-3">
              <div className="text-xs font-black text-white text-right">
                حكم الضربة (اعتماد النتيجة):
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* GOAL */}
                <button
                  onClick={() => handleRecord('goal')}
                  className="btn-arcade-green py-3 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>هدف! ⚽</span>
                  <span className="text-[9px] font-mono">+1000ن</span>
                </button>

                {/* SAVED */}
                <button
                  onClick={() => handleRecord('saved')}
                  className="btn-arcade-yellow py-3 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                >
                  <Shield className="w-4 h-4" />
                  <span>اتصدت! 🧤</span>
                  <span className="text-[9px] font-mono">+800ن حارس</span>
                </button>

                {/* MISSED */}
                <button
                  onClick={() => handleRecord('missed')}
                  className="btn-arcade-red py-3 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                >
                  <XCircle className="w-4 h-4" />
                  <span>ضاعت! ❌</span>
                  <span className="text-[9px] font-mono">0 نقطة</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Navigation to Round 4 */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => changeRound('round4')}
          className="btn-arcade-purple px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
        >
          <span>انتقل للجولة الفاصلة: "مين يزوّد؟" (Blind Auction)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}

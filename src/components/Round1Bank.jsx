import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Vault, Flame, CheckCircle, XCircle, ArrowRight, ShieldCheck, Eye, EyeOff, RotateCcw } from 'lucide-react';
export { default as BankTurnView } from './views/BankTurnView';

export default function Round1Bank() {
  const {
    roomState,
    currentPlayer,
    r1Score,
    r1Break,
    r1Bank,
    r1PassTurn,
    changeRound,
    showToast
  } = useGame();

  const [showAnswer, setShowAnswer] = useState(false);

  const r1 = roomState?.round1 || {};
  const currentQ = r1.currentQuestion || {
    question: 'ما هو التعقيد الزمني لـ Binary Search؟',
    answer: 'O(log n)',
    categoryName: 'علوم الحاسب والبرمجة',
    funFact: 'البحث الثنائي يقلص نطاق البحث إلى النصف في كل خطوة!'
  };

  const streakLadder = r1.streakLadder || [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000];
  const activeTeamKey = r1.activeTeam || 'team_a';
  const activeTeam = roomState?.teams?.[activeTeamKey] || { name: 'فريق الحيتان', score: 0, bank: 0 };
  const opposingTeamKey = activeTeamKey === 'team_a' ? 'team_b' : 'team_a';
  const opposingTeam = roomState?.teams?.[opposingTeamKey] || { name: 'فريق الوحوش', score: 0, bank: 0 };

  const answeringPlayer = roomState?.players?.find(p => p.id === r1.answeringPlayerId) || roomState?.players?.[0];
  const readerPlayer = roomState?.players?.find(p => p.id === r1.readerPlayerId) || roomState?.players?.[1];

  // The server is the only authority: grading, banking and turn changes are
  // restricted to the assigned referee, the answering team and the host.
  const viewerId = roomState?.viewerId || currentPlayer?.id;
  const isLocalPreview = !viewerId;
  const isR1Referee = isLocalPreview || viewerId === r1.refereePlayerId;
  const isActiveTeamMember = isLocalPreview || currentPlayer?.team === activeTeamKey;
  const isHostPlayer = isLocalPreview || !!currentPlayer?.isHost;

  const currentStreak = r1.streak || 0;
  const pendingPoints = r1.pendingPoints || 0;

  // Next potential points if answered correctly
  const nextStreak = Math.min(currentStreak + 1, 10);
  const nextValue = streakLadder[nextStreak];

  const handleScoreClick = () => {
    setShowAnswer(false);
    r1Score();
  };

  const handleBreakClick = () => {
    setShowAnswer(false);
    r1Break();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      
      {/* Top Banner: Round Info & Roles */}
      <div className="bg-arena-card rounded-2xl p-4 border border-arena-cyan/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-arena-yellow/20 border-2 border-arena-yellow flex items-center justify-center text-2xl font-black text-arena-yellow">
            1-2
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-arena-yellow bg-arena-yellow/10 px-2 py-0.5 rounded-full border border-arena-yellow/20">
              <Vault className="w-3.5 h-3.5" />
              <span>جولة 1: "1 تو" (Bank Mode)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              سلّم النقاط ومخاطرة الخزنة! 🏦
            </h2>
          </div>
        </div>

        {/* Roles Allocation Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Answering Player & Team */}
          <div className="bg-arena-darker/90 px-3 py-2 rounded-xl border border-arena-cyan/50 flex items-center gap-2.5">
            <span className="text-2xl">{answeringPlayer?.character?.avatar || '⚡'}</span>
            <div>
              <div className="text-[10px] text-gray-400 font-bold">الفريق المجيب:</div>
              <div className="text-xs font-black text-arena-cyan truncate max-w-[120px]">
                {answeringPlayer?.name || 'لاعب الإجابة'} ({activeTeam.name.split('(')[0]})
              </div>
            </div>
            {answeringPlayer?.character?.id === 'abdelrahman_eltouny' && (
              <span className="text-[10px] bg-arena-yellow/20 text-arena-yellow px-1.5 py-0.5 rounded font-bold" title="درع بيلافيتا">
                درع 🛡️
              </span>
            )}
          </div>

          {/* Reader / Referee Player */}
          <div className="bg-arena-darker/90 px-3 py-2 rounded-xl border border-arena-red/50 flex items-center gap-2.5">
            <span className="text-2xl">{readerPlayer?.character?.avatar || '🛡️'}</span>
            <div>
              <div className="text-[10px] text-gray-400 font-bold">الحكم / القارئ من الخصم:</div>
              <div className="text-xs font-black text-arena-red truncate max-w-[120px]">
                {readerPlayer?.name || 'الحكم الخصم'} ({opposingTeam.name.split('(')[0]})
              </div>
            </div>
          </div>

          {/* Switch Turn Button (host authority only) */}
          {isHostPlayer && (
            <button
              onClick={r1PassTurn}
              className="btn-arcade-dark px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
              title="تبديل الدور للفريق الآخر"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بدّل الدور</span>
            </button>
          )}
        </div>
      </div>

      {/* Tournament Quota & Sub-turn Progress Engine Bar */}
      <div className="bg-arena-darker/90 rounded-2xl p-4 border border-white/10 shadow-lg space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-white bg-arena-card px-2.5 py-1 rounded-lg border border-white/10">
              فقرة {(r1.segmentIndex || 0) + 1} من 4 ({activeTeam.name.split('(')[0]})
            </span>
            <span className="font-bold text-arena-cyan bg-arena-cyan/10 px-2 py-1 rounded-lg border border-arena-cyan/20">
              المرحلة الفرعية: {(r1.subBatchIndex || 0) + 1} من 2 (سؤال {(r1.subBatchQuestionsAnswered || 0) + 1} / 6)
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono font-bold text-xs text-gray-300">
            <span>إجمالي أسئلة الجولة:</span>
            <span className="text-arena-yellow font-black text-sm">
              {r1.totalQuestionsAnswered || 0} / 48
            </span>
          </div>
        </div>

        {/* Visual 6 Sub-batch Progress Dots */}
        <div className="flex items-center gap-1.5 pt-1">
          {[0, 1, 2, 3, 4, 5].map((qIdx) => {
            const isCompleted = (r1.subBatchQuestionsAnswered || 0) > qIdx;
            const isCurrent = (r1.subBatchQuestionsAnswered || 0) === qIdx;
            return (
              <div
                key={qIdx}
                className={`flex-1 h-2 rounded-full transition-all ${
                  isCompleted
                    ? 'bg-arena-green shadow-sm'
                    : isCurrent
                    ? 'bg-arena-yellow animate-pulse shadow-md'
                    : 'bg-white/10'
                }`}
                title={`سؤال ${qIdx + 1} من 6`}
              />
            );
          })}
        </div>

        {/* Overall 48 Quota Progress Bar */}
        <div className="w-full bg-arena-card h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-arena-cyan to-arena-yellow transition-all duration-300"
            style={{ width: `${Math.min(100, (((r1.totalQuestionsAnswered || 0) / 48) * 100))}%` }}
          />
        </div>
      </div>

      {/* Main Play Arena: Left Streak Ladder, Right Action & Question Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Streak Ladder (Left 4 cols) */}
        <div className="lg:col-span-4 bg-arena-card rounded-2xl p-4 border border-white/10 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="font-black text-white text-sm flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-arena-yellow" />
              <span>سلّم الستريك والمضاعفات</span>
            </h3>
            <span className="text-xs font-mono font-bold text-arena-cyan">
              مستوى: ×{currentStreak}
            </span>
          </div>

          <div className="space-y-1.5">
            {streakLadder.slice(1).map((val, idx) => {
              const step = 10 - idx; // from 10 down to 1
              const isActive = currentStreak === step;
              const isPast = currentStreak > step;
              const stepPoints = streakLadder[step];

              return (
                <div
                  key={step}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl font-mono text-xs transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-arena-yellow to-amber-500 text-arena-darker font-black shadow-lg scale-105 border-2 border-white'
                      : isPast
                      ? 'bg-arena-green/20 text-arena-green font-bold border border-arena-green/30'
                      : 'bg-arena-darker/70 text-gray-400 border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 font-black text-center">×{step}</span>
                    {isActive && <span className="text-xs">🔥 الحالي</span>}
                    {isPast && <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <span className="font-black text-sm">{stepPoints.toLocaleString()} نقطة</span>
                </div>
              );
            })}
          </div>

          {/* Pending Vault Summary */}
          <div className="bg-arena-darker/90 p-3.5 rounded-xl border border-arena-yellow/30 text-center space-y-1">
            <div className="text-[11px] text-gray-400 font-bold">النقاط المعلقة في الهواء:</div>
            <div className="text-3xl font-black font-mono text-arena-yellow tracking-wider animate-pulse">
              {pendingPoints.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400">
              أمّنها في الخزنة قبل ما تجاوب غلط وتطير كلها!
            </div>
          </div>
        </div>

        {/* Question & Interactive Console (Right 8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Question Card */}
          <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-2 border-arena-cyan/40 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/30">
                {currentQ.categoryName}
              </span>
              <span className="text-xs font-mono font-bold text-gray-400">
                السؤال القادم: +{nextValue} نقطة
              </span>
            </div>

            {/* Question Text */}
            <h3 className="text-xl md:text-2xl font-black text-white leading-relaxed text-right min-h-[70px]">
              {currentQ.question}
            </h3>

            {/* Answer Display Section */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-arena-darker/60 p-4 rounded-2xl">
              <div className="flex items-center gap-2">
                {isR1Referee ? (
                  <>
                    <button
                      onClick={() => setShowAnswer(!showAnswer)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-arena-darker border border-white/10 hover:border-arena-cyan text-xs font-bold text-gray-300 transition-all cursor-pointer"
                    >
                      {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-arena-yellow" />}
                      <span>{showAnswer ? 'إخفاء الإجابة' : 'كشف الإجابة (للحكم)'}</span>
                    </button>
                    {showAnswer && (
                      <span className="text-sm font-black text-arena-green bg-emerald-950/80 px-3 py-1 rounded-lg border border-arena-green/50">
                        الإجابة: {currentQ.answer}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-gray-500 font-bold">
                    🔒 الإجابة مخفية إلا عن الحكم المكلّف
                  </span>
                )}
              </div>
              
              {currentQ.funFact && (
                <div className="text-[11px] text-gray-400 italic text-right max-w-sm">
                  💡 {currentQ.funFact}
                </div>
              )}
            </div>
          </div>

          {/* Dual Action Controls: Bank vs Double, and Referee Judgment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Team Player Console: Bank or Double */}
            <div className="bg-arena-card/90 rounded-2xl p-5 border border-arena-yellow/30 space-y-3 shadow-lg">
              <div className="text-xs font-black text-arena-yellow flex items-center gap-1.5">
                <Vault className="w-4 h-4" />
                <span>قرار الفريق المجيب ({activeTeam.name.split('(')[0]}):</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={r1Bank}
                  disabled={pendingPoints === 0 || !isActiveTeamMember}
                  title={isActiveTeamMember ? 'تأمين النقاط المعلقة' : 'الأمان في الخزنة متاح للفريق المجيب فقط'}
                  className={`btn-arcade-yellow py-3.5 px-4 rounded-2xl text-sm font-black flex flex-col items-center justify-center gap-1 ${
                    pendingPoints === 0 || !isActiveTeamMember ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'
                  }`}
                >
                  <Vault className="w-5 h-5 fill-current" />
                  <span>أمّن في الخزنة! 🔒</span>
                  <span className="text-[10px] font-mono">({pendingPoints} نقطة)</span>
                </button>

                <button
                  onClick={() => showToast('دبّل وكمل!', 'الفريق قرر يغامر ويكمل صعود السلّم!')}
                  className="btn-arcade-cyan py-3.5 px-4 rounded-2xl text-sm font-black flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                >
                  <Flame className="w-5 h-5 fill-current" />
                  <span>دبّل / كمل! 🔥</span>
                  <span className="text-[10px] font-mono">نحو ×{nextStreak}</span>
                </button>
              </div>
            </div>

            {/* Opposing Referee Console: Score or Break */}
            <div className="bg-arena-card/90 rounded-2xl p-5 border border-white/20 space-y-3 shadow-lg">
              <div className="text-xs font-black text-gray-300 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-arena-red" />
                  <span>لوحة تحكم الحكم الخصم ({readerPlayer?.name || 'الحكم'}):</span>
                </div>
                <span className="text-[10px] text-arena-yellow font-mono">Zero Self-Grading 🛡️</span>
              </div>

              {isR1Referee ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleScoreClick}
                    className="btn-arcade-green py-3.5 px-4 rounded-2xl text-sm font-black flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                  >
                    <CheckCircle className="w-5 h-5 fill-current" />
                    <span>صح! (+Points) 🎯</span>
                    <span className="text-[10px] font-mono">اصعد درجة</span>
                  </button>

                  <button
                    onClick={handleBreakClick}
                    className="btn-arcade-red py-3.5 px-4 rounded-2xl text-sm font-black flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                  >
                    <XCircle className="w-5 h-5 fill-current" />
                    <span>غلط! (تصفير) ❌</span>
                    <span className="text-[10px] font-mono">اكسر الستريك</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-arena-darker/80 rounded-xl text-center space-y-1.5 border border-white/10">
                  <span className="text-2xl">🚫</span>
                  <div className="text-xs font-black text-arena-red">قفل منع التقييم الذاتي (Anti-Cheat)</div>
                  <p className="text-[11px] text-gray-400">
                    {currentPlayer?.team === activeTeamKey
                      ? `أنت في الفريق المجيب! اعتماد الإجابة وصعود السلّم محصور بجهاز الحكم الخصم (${readerPlayer?.name || 'الحكم'}) فقط.`
                      : `لوحة التحكيم محصورة بجهاز الحكم المكلّف (${readerPlayer?.name || 'الحكم'}) — انتظر قراره.`}
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Navigation to Round 2 (host authority only) */}
          {isHostPlayer && (
            <div className="flex justify-end pt-2">
              <button
                onClick={() => changeRound('round2')}
                className="btn-arcade-purple px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
              >
                <span>انتقل للجولة 2: "اديني في سري" (Password)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

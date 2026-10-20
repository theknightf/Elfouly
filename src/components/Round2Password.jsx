import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { sounds } from '../utils/soundEffects';
import { Lock, Eye, EyeOff, AlertTriangle, Timer, Award, ArrowRight, Snowflake, ShieldAlert } from 'lucide-react';

export default function Round2Password() {
  const {
    roomState,
    currentPlayer,
    r2AwardPoint,
    r2Foul,
    r2TimeFreeze,
    changeRound,
    showToast
  } = useGame();

  const r2 = roomState?.round2 || {};
  const currentWord = r2.currentWord || {
    target: '—',
    forbidden: [],
    category: '—',
    clueIdea: '',
    redacted: true
  };
  const [timeLeft, setTimeLeft] = useState(r2.timer || 45);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [hideSecretOnScreen, setHideSecretOnScreen] = useState(false);

  const teamA = roomState?.teams?.team_a || { name: 'فريق الحيتان', score: 0 };
  const teamB = roomState?.teams?.team_b || { name: 'فريق الوحوش', score: 0 };

  const viewerId = roomState?.viewerId || currentPlayer?.id;
  const clueGiverA = roomState?.players?.find(p => p.id === r2.activeClueGiverA);
  const clueGiverB = roomState?.players?.find(p => p.id === r2.activeClueGiverB);
  const isLocalPreview = !viewerId;
  const isClueGiver = isLocalPreview || viewerId === r2.activeClueGiverA || viewerId === r2.activeClueGiverB;
  const isReferee = isLocalPreview || viewerId === r2.refereePlayerId;
  const activeTeamKey = r2.activeTurnTeam === 'team_b' ? 'team_b' : 'team_a';
  const activeTeam = activeTeamKey === 'team_a' ? teamA : teamB;
  const activeClueGiver = activeTeamKey === 'team_a' ? clueGiverA : clueGiverB;
  const referee = roomState?.players?.find(p => p.id === r2.refereePlayerId);

  // Timer countdown
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

  // Sync external timer freeze
  useEffect(() => {
    if (r2.timer && r2.timer !== timeLeft) {
      setTimeLeft(r2.timer);
    }
  }, [r2.timer]);

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
    if (!isTimerRunning) sounds.playWhistle();
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(45);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 space-y-6 animate-fadeIn">
      
      {/* Top Banner: Round Info */}
      <div className="bg-arena-card rounded-2xl p-4 border border-arena-cyan/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-arena-cyan/20 border-2 border-arena-cyan flex items-center justify-center text-2xl font-black text-arena-cyan">
            🤫
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-arena-cyan bg-arena-cyan/10 px-2 py-0.5 rounded-full border border-arena-cyan/20">
              <Lock className="w-3.5 h-3.5" />
              <span>جولة 2: "اديني في سري" (Password Mode)</span>
              <span className="bg-arena-yellow/20 text-arena-yellow px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
                بطاقة {(r2.currentWordIndex || 0) + 1} / 5
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              كلمة السر في الودن والممنوعات الأربعة! 🤐
            </h2>
          </div>
        </div>

        {/* Clue Givers Roles */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-arena-darker/90 px-3 py-2 rounded-xl border border-arena-cyan/40 flex items-center gap-2">
            <span className="text-xl">{clueGiverA?.character?.avatar || '⚡'}</span>
            <div className="text-right">
              <div className="text-[10px] text-gray-400">مرشد فريق أ:</div>
              <div className="text-xs font-black text-arena-cyan">{clueGiverA?.name || 'مرشد أ'}</div>
            </div>
          </div>

          <div className="bg-arena-darker/90 px-3 py-2 rounded-xl border border-arena-red/40 flex items-center gap-2">
            <span className="text-xl">{clueGiverB?.character?.avatar || '🦁'}</span>
            <div className="text-right">
              <div className="text-[10px] text-gray-400">مرشد فريق ب:</div>
              <div className="text-xs font-black text-arena-red">{clueGiverB?.name || 'مرشد ب'}</div>
            </div>
          </div>

          {/* Privacy Toggle: hide words if players are watching same screen */}
          <button
            onClick={() => setHideSecretOnScreen(!hideSecretOnScreen)}
            className="btn-arcade-dark px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
            title="إخفاء الكلمة السرية عن باقي الشاشة"
          >
            {hideSecretOnScreen ? <Eye className="w-3.5 h-3.5 text-arena-yellow" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{hideSecretOnScreen ? 'كشف الكلمات' : 'إخفاء سري'}</span>
          </button>
        </div>
      </div>

      {/* Active turn + judge */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-arena-cyan/10 border border-arena-cyan/30 rounded-xl px-4 py-2 text-center">
          <div className="text-[10px] text-gray-400 font-bold">الفريق اللي بيلمّح دلوقتي</div>
          <div className="text-sm font-black text-arena-cyan">{activeTeam.name}</div>
        </div>
        <div className="bg-arena-darker border border-white/10 rounded-xl px-4 py-2 text-center">
          <div className="text-[10px] text-gray-400 font-bold">المرشد صاحب الدور</div>
          <div className="text-sm font-black text-white">{activeClueGiver?.name || 'في انتظار المرشد'}</div>
        </div>
        <div className="bg-arena-purple/10 border border-arena-purple/30 rounded-xl px-4 py-2 text-center">
          <div className="text-[10px] text-gray-400 font-bold">الحكم (مرشد الفريق المنافس)</div>
          <div className="text-sm font-black text-arena-purple">{referee?.name || 'غير معيّن'}</div>
        </div>
      </div>

      {/* Main Secret Card */}
      <div className="bg-arena-card rounded-3xl p-6 md:p-8 border-2 border-arena-yellow/40 shadow-2xl space-y-6">
        
        {/* Timer Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-arena-darker/80 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <Timer className={`w-6 h-6 ${timeLeft <= 10 ? 'text-arena-red animate-bounce' : 'text-arena-yellow'}`} />
            <div>
              <div className="text-xs text-gray-400 font-bold">الوقت المتبقي للجولة:</div>
              <div className={`text-2xl font-black font-mono ${timeLeft <= 10 ? 'text-arena-red' : 'text-arena-yellow'}`}>
                {timeLeft} ثانية
              </div>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTimer}
              className={`px-4 py-2 rounded-xl text-xs font-black ${
                isTimerRunning ? 'btn-arcade-red' : 'btn-arcade-green'
              }`}
            >
              {isTimerRunning ? 'إيقاف مؤقت ⏸️' : 'بدء التايمر ▶️'}
            </button>
            <button
              onClick={resetTimer}
              className="btn-arcade-dark px-3 py-2 rounded-xl text-xs font-bold"
            >
              إعادة ضبط 45ث
            </button>
            <button
              onClick={r2TimeFreeze}
              disabled={!isReferee}
              className={`btn-arcade-purple px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md ${!isReferee ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={isReferee ? 'تجميد الوقت +10 ثواني (خاصية زياد الفندقي)' : 'متاح للحكم فقط'}
            >
              <Snowflake className="w-3.5 h-3.5 animate-spin" />
              <span>تجميد +10ث</span>
            </button>
          </div>
        </div>

        {/* Secret Word Display */}
        {!isClueGiver || currentWord.redacted ? (
          <div className="p-12 text-center bg-arena-darker/90 rounded-2xl border-2 border-dashed border-gray-600">
            <div className="text-4xl mb-2">🤫</div>
            <div className="text-lg font-black text-gray-300">الكلمة السرية محجوبة عن جهازك</div>
            <p className="text-xs text-gray-500 mt-1">مرشدو الفريقين فقط هما اللي بيشوفوا الكلمة والممنوعات الأربعة.</p>
          </div>
        ) : hideSecretOnScreen ? (
          <div className="p-12 text-center bg-arena-darker/90 rounded-2xl border-2 border-dashed border-gray-600">
            <div className="text-4xl mb-2">🙈</div>
            <div className="text-lg font-black text-gray-400">الكلمة السرية مخفية الآن</div>
            <p className="text-xs text-gray-500 mt-1">اضغط "كشف الكلمات" بالأعلى للمرشدين فقط</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Target Word */}
            <div className="text-center py-6 px-4 bg-gradient-to-r from-arena-darker via-[#161838] to-arena-darker rounded-3xl border-2 border-arena-cyan/60 shadow-xl">
              <span className="text-xs font-bold text-arena-cyan bg-arena-cyan/10 px-3 py-1 rounded-full border border-arena-cyan/20">
                التصنيف: {currentWord.category}
              </span>
              <div className="text-xs text-gray-400 mt-2 font-bold">الكلمة السرية المستهدفة (Secret Word):</div>
              <h3 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-arena-cyan via-white to-arena-yellow py-3 tracking-wide">
                {currentWord.target}
              </h3>
              <div className="text-xs text-gray-400 italic mt-1">
                💡 فكرة تلميح: "{currentWord.clueIdea}"
              </div>
            </div>

            {/* Forbidden Words (ممنوع تقول) */}
            <div className="bg-arena-red/10 rounded-2xl p-5 border-2 border-arena-red/50">
              <div className="flex items-center gap-2 text-arena-red font-black text-sm mb-3">
                <ShieldAlert className="w-4 h-4" />
                <span>الكلمات الممنوعة الأربعة (ممنوع تنطقها أو تشتق منها!):</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {currentWord.forbidden.map((forbid, idx) => (
                  <div
                    key={idx}
                    className="bg-arena-darker/90 border border-arena-red/60 text-white font-black text-center py-3 px-2 rounded-xl text-sm shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span className="text-arena-red text-xs">🚫</span>
                    <span>{forbid}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Referee Control Console */}
      <div className="bg-arena-card/90 rounded-2xl p-5 border border-white/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="text-sm font-black text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-arena-yellow" />
            <span>لوحة تحكم الحكم (Referee Console)</span>
          </div>
          <span className="text-xs text-gray-400">
            الحكم هو مرشد الفريق المنافس للفريق اللي بيلمّح دلوقتي
          </span>
        </div>

        {isReferee ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => r2AwardPoint(activeTeamKey)}
              className={`${activeTeamKey === 'team_a' ? 'btn-arcade-cyan' : 'btn-arcade-red'} py-3.5 px-4 rounded-xl font-black text-sm flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-110`}
            >
              <span>نقطة لـ {activeTeam.name} (+500) 🎯</span>
              <span className="text-[10px] font-bold opacity-80">تأكيد إن {activeClueGiver?.name || 'المرشد'} وصّل الكلمة صح</span>
            </button>

            <button
              onClick={() => r2Foul(activeTeamKey)}
              className="btn-arcade-dark py-3.5 px-4 rounded-xl font-black text-sm text-arena-yellow hover:text-white border-arena-yellow/40 flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-arena-red" />
                <span>مخالفة على {activeTeam.name} (-200) ⚠️</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">نطق كلمة ممنوعة</span>
            </button>
          </div>
        ) : (
          <div className="bg-arena-darker/80 rounded-xl border border-dashed border-gray-600 p-5 text-center space-y-1">
            <div className="text-2xl">🔒</div>
            <div className="text-sm font-black text-gray-300">لوحة التحكيم مقفولة على جهازك</div>
            <p className="text-xs text-gray-500">
              الحكم الحالي: {referee?.name || 'غير معيّن'} — مرشد الفريق المنافس فقط هو اللي يقدر يحسب النقطة أو المخالفة.
            </p>
          </div>
        )}
      </div>

      {/* Navigation to Round 3 */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => changeRound('round3')}
          className="btn-arcade-purple px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl hover:brightness-110"
        >
          <span>انتقل للجولة 3: "حط في قريبي" (Penalty Shootouts)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}

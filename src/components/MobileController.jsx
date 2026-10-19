import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CHARACTERS } from '../data/characters';
import { 
  Smartphone, Zap, Shield, Vault, Flame, Check, X, 
  Gavel, Radio, RotateCcw, PhoneCall, Lightbulb, CheckSquare, Square,
  HelpCircle, Eye, EyeOff
} from 'lucide-react';

export default function MobileController() {
  const {
    roomState,
    r1Score,
    r1Break,
    r1Bank,
    r1PassTurn,
    r2AwardPoint,
    r2SkipCard,
    r2Foul,
    r2TimeFreeze,
    r3InterceptBuzz,
    r3RecordShot,
    r4Bid,
    r4UseLifeline,
    r4ToggleItem,
    r4ResolveBid,
    sendTaunt,
    showToast
  } = useGame();

  const [simulatedPlayerId, setSimulatedPlayerId] = useState(roomState?.players?.[0]?.id || 'p1');
  const [showSecretInR1, setShowSecretInR1] = useState(false);

  const player = roomState?.players?.find(p => p.id === simulatedPlayerId) || roomState?.players?.[0];
  const char = player?.character || CHARACTERS[0];
  const round = roomState?.status || 'lobby';

  // Round 1 Roles
  const r1 = roomState?.round1 || {};
  const isAnsweringInR1 = r1.answeringPlayerId === player?.id;
  const isReaderInR1 = r1.readerPlayerId === player?.id;
  const isTeammateInR1 = player?.team === r1.activeTeam && !isAnsweringInR1;
  const isOpponentInR1 = player?.team !== r1.activeTeam && !isReaderInR1;

  // Round 2 Roles
  const r2 = roomState?.round2 || {};
  const isClueGiverInR2 = r2.activeClueGiverA === player?.id || r2.activeClueGiverB === player?.id;
  const isRefereeInR2 = player?.isHost || r2.hostRefereeId === player?.id;

  // Round 3 Roles
  const r3 = roomState?.round3 || {};
  const isKickerInR3 = r3.currentKickerId === player?.id;
  const isGoalieInR3 = r3.currentGoalieId === player?.id;

  // Round 4 Roles
  const r4 = roomState?.round4 || {};
  const teamLifelines = r4.usedLifelines?.[player?.team] || [];

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4 animate-fadeIn">
      
      {/* Simulation Bar (lets user test phone experience as any character) */}
      <div className="bg-arena-card/90 p-3 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-gray-300">
          <Smartphone className="w-4 h-4 text-arena-cyan" />
          <span>محاكاة شاشة الموبايل كـ:</span>
        </div>
        <select
          value={simulatedPlayerId}
          onChange={(e) => setSimulatedPlayerId(e.target.value)}
          className="bg-arena-darker px-2 py-1 rounded-lg border border-white/20 text-white font-bold text-xs outline-none"
        >
          {roomState?.players?.map(p => (
            <option key={p.id} value={p.id}>
              {p.character?.avatar} {p.name} ({p.character?.name})
            </option>
          ))}
        </select>
      </div>

      {/* Mobile Device Frame */}
      <div className="bg-arena-darker border-4 border-arena-cyan/50 rounded-[38px] p-5 shadow-2xl space-y-5 text-right relative overflow-hidden">
        
        {/* Notch / Speaker Bar */}
        <div className="w-28 h-4 bg-arena-card rounded-full mx-auto border border-white/10 mb-2" />

        {/* Player Profile Header on Mobile */}
        <div className="flex items-center justify-between bg-arena-card/90 p-3 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl border-2"
              style={{ backgroundColor: `${char.color}20`, borderColor: char.color }}
            >
              {char.avatar}
            </div>
            <div>
              <div className="text-[10px] text-gray-400 font-bold">{char.badge}</div>
              <div className="text-sm font-black text-white" style={{ color: char.color }}>
                {player?.name}
              </div>
            </div>
          </div>

          <div
            className={`text-[10px] font-black px-2 py-1 rounded-full ${
              player?.team === 'team_a' ? 'bg-arena-cyan/20 text-arena-cyan' : 'bg-arena-red/20 text-arena-red'
            }`}
          >
            {player?.team === 'team_a' ? 'الحيتان A' : 'الوحوش B'}
          </div>
        </div>

        {/* Active Character Bonus Card on Phone */}
        <div className="bg-arena-card/60 p-2.5 rounded-xl border border-arena-yellow/20 flex items-center gap-2">
          <Zap className="w-4 h-4 text-arena-yellow fill-current" />
          <div className="text-[10px] text-gray-300">
            <span className="font-black text-arena-yellow">{char.bonus?.title}: </span>
            <span>{char.bonus?.description}</span>
          </div>
        </div>

        {/* Dynamic In-Round Controller Surface */}
        {round === 'lobby' && (
          <div className="py-12 text-center space-y-3">
            <div className="text-4xl animate-bounce">⏳</div>
            <div className="text-base font-black text-white">أنت في صالة الانتظار</div>
            <p className="text-xs text-gray-400">
              الحكم بيجهز الجولة الأولى.. خليك مستعد على البزر!
            </p>
          </div>
        )}

        {/* ======================= ROUND 1: 1 تو (Bank) ======================= */}
        {round === 'round1' && (
          <div className="space-y-4">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
              <span className="font-bold text-arena-yellow">جولة 1: "1 تو" (Bank)</span>
              <span className="font-mono text-[10px] text-gray-400">
                سؤال {(r1.subBatchQuestionsAnswered || 0) + 1}/6 (إجمالي {r1.totalQuestionsAnswered || 0}/48)
              </span>
            </div>

            {/* Role 1: Reader Referee */}
            {isReaderInR1 && (
              <div className="space-y-3 bg-arena-card p-4 rounded-2xl border-2 border-arena-red/50">
                <div className="flex items-center justify-between text-[11px] font-bold text-arena-red">
                  <span>أنت قارئ السؤال والحكم:</span>
                  <span className="bg-arena-red/20 px-2 py-0.5 rounded text-[10px]">حكم الخصم 🛡️</span>
                </div>

                <div className="text-sm font-black text-white leading-relaxed">
                  {r1.currentQuestion?.question}
                </div>

                <div className="text-xs text-arena-green font-bold bg-black/50 p-2.5 rounded-xl border border-arena-green/30">
                  الإجابة الصحيحة: {r1.currentQuestion?.answer}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={r1Score} className="btn-arcade-green py-3 rounded-xl font-black text-xs">
                    صح (+Points) 🎯
                  </button>
                  <button onClick={r1Break} className="btn-arcade-red py-3 rounded-xl font-black text-xs">
                    غلط (تصفير) ❌
                  </button>
                </div>
              </div>
            )}

            {/* Role 2: Active Answering Player */}
            {isAnsweringInR1 && (
              <div className="space-y-3">
                <div className="bg-arena-cyan/10 border border-arena-cyan/40 p-3 rounded-2xl text-center">
                  <div className="text-[11px] font-bold text-arena-cyan">أنت في بؤرة الإجابة الآن! ⚡</div>
                  <div className="text-[10px] text-gray-300">القارئ يقرأ لك السؤال بصوت عالي.. اتخذ قرارك:</div>
                </div>

                <div className="bg-arena-card p-3 rounded-2xl text-center space-y-1">
                  <div className="text-[10px] text-gray-400 font-bold">النقاط المعلقة لفريقك:</div>
                  <div className="text-3xl font-black font-mono text-arena-yellow animate-pulse">
                    {(r1.pendingPoints || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    الستريك الحالي: ×{r1.streak || 0}
                  </div>
                </div>

                <button
                  onClick={r1Bank}
                  disabled={(r1.pendingPoints || 0) === 0}
                  className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 ${
                    (r1.pendingPoints || 0) === 0
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'btn-arcade-yellow cursor-pointer'
                  }`}
                >
                  <Vault className="w-5 h-5 fill-current" />
                  <span>أمّن في الخزنة BANK! 🔒</span>
                </button>

                <button
                  onClick={() => showToast('دبّل وكمل!', 'قررت المغامرة ومواصلة صعود السلّم!')}
                  className="w-full btn-arcade-cyan py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flame className="w-4 h-4 fill-current" />
                  <span>دبّل / كمّل للمضاعف التالي 🔥</span>
                </button>
              </div>
            )}

            {/* Role 3: Teammate Supporting */}
            {isTeammateInR1 && (
              <div className="bg-arena-card p-4 rounded-2xl border border-white/10 text-center space-y-3">
                <div className="text-3xl">📣</div>
                <div className="text-sm font-black text-arena-cyan">فريقك في وضع الهجوم!</div>
                <p className="text-xs text-gray-300">
                  زميلك يجيب على الـ 6 أسئلة الخاصة بهذه الفقرة. شجعه وقول له يأمن في الخزنة لو النقاط تستاهل!
                </p>
                <div className="bg-arena-darker p-2.5 rounded-xl font-mono text-arena-yellow font-black text-lg">
                  {(r1.pendingPoints || 0).toLocaleString()} نقطة معلقة
                </div>
              </div>
            )}

            {/* Role 4: Opponent Observing */}
            {isOpponentInR1 && (
              <div className="bg-arena-card p-4 rounded-2xl border border-white/10 text-center space-y-3">
                <div className="text-3xl">👀</div>
                <div className="text-sm font-black text-arena-red">فريق الخصم يجيب الآن</div>
                <p className="text-xs text-gray-300">
                  زميلك في الفريق يقرأ لهم الأسئلة ويحكم. استعد لتبديل الدور بعد انتهاء فقرتهم!
                </p>
              </div>
            )}

          </div>
        )}

        {/* ======================= ROUND 2: اديني في سري (Password) ======================= */}
        {round === 'round2' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
              <span className="font-bold text-arena-cyan">جولة 2: "اديني في سري" (Password)</span>
              <span className="font-mono text-[10px] text-gray-400">
                بطاقة {(r2.currentWordIndex || 0) + 1} من 5
              </span>
            </div>

            {/* Secret Card for Clue Giver or Host */}
            {(isClueGiverInR2 || isRefereeInR2) && (
              <div className="bg-arena-card p-4 rounded-2xl border-2 border-arena-cyan/40 text-center space-y-2">
                <div className="text-[10px] text-gray-400">الكلمة السرية المطلوب تخمينها:</div>
                <div className="text-2xl font-black text-arena-cyan">
                  {r2.currentWord?.target || 'الكلمة السرية'}
                </div>
                <div className="text-[10px] text-arena-red font-bold bg-arena-red/10 p-2 rounded-xl border border-arena-red/20">
                  الممنوعات الأربعة: {r2.currentWord?.forbidden?.join(' - ') || 'ممنوع 1 - ممنوع 2 - ممنوع 3 - ممنوع 4'}
                </div>
              </div>
            )}

            {!isClueGiverInR2 && !isRefereeInR2 && (
              <div className="bg-arena-card p-6 rounded-2xl border border-white/10 text-center space-y-2">
                <div className="text-3xl">👂</div>
                <div className="text-sm font-black text-white">استمع للملمح وخمّن الكلمة!</div>
                <p className="text-xs text-gray-400">
                  الكلمة محجوبة عنك عشان الإثارة.. انطق تخمينك بصوت واضح!
                </p>
              </div>
            )}

            {/* Referee Judgments */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => r2AwardPoint('team_a')} className="btn-arcade-cyan py-3 rounded-xl font-black text-xs">
                نقطة للحيتان A (+500)
              </button>
              <button onClick={() => r2AwardPoint('team_b')} className="btn-arcade-red py-3 rounded-xl font-black text-xs">
                نقطة للوحوش B (+500)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => r2Foul('team_a')} className="btn-arcade-dark py-2.5 rounded-xl font-bold text-xs text-arena-red border border-arena-red/30">
                مخالفة الحيتان (-200)
              </button>
              <button onClick={() => r2Foul('team_b')} className="btn-arcade-dark py-2.5 rounded-xl font-bold text-xs text-arena-red border border-arena-red/30">
                مخالفة الوحوش (-200)
              </button>
            </div>

            <button onClick={r2TimeFreeze} className="w-full btn-arcade-yellow py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>تجميد الوقت الفندقي (+10 ثواني) 🛎️</span>
            </button>
          </div>
        )}

        {/* ======================= ROUND 3: حط في قريبي (Penalty) ======================= */}
        {round === 'round3' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
              <span className="font-bold text-arena-red">جولة 3: "حط في قريبي" (Penalty)</span>
              <span className="font-mono text-[10px] text-gray-400">
                تسديدة {(r3.turnIndex || 0) + 1} من 10 (ما بعد 2010 فقط)
              </span>
            </div>

            {/* Kicker Question */}
            <div className="bg-arena-card p-3 rounded-2xl border border-white/10 space-y-2">
              <div className="text-[10px] text-arena-cyan font-bold">
                {isKickerInR3 ? '🎯 أنت المسدد الآن:' : 'سؤال ركلة الجزاء:'}
              </div>
              <div className="text-xs font-black text-white">
                {r3.currentQuestion?.question}
              </div>
              {r3.currentQuestion?.options && (
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  {r3.currentQuestion.options.map((opt, i) => (
                    <div key={i} className="bg-arena-darker p-2 rounded-lg font-bold text-gray-300 border border-white/5">
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Giant Intercept Buzzer for Goalie */}
            <div className="space-y-2 text-center">
              <div className="text-xs text-gray-400">
                {isGoalieInR3 ? '🧤 أنت حارس المرمى! اضغط على البزر للصد:' : 'بزر الصد المباشر:'}
              </div>
              <button
                onClick={r3InterceptBuzz}
                className="w-full py-8 rounded-3xl btn-arcade-red font-black text-xl flex flex-col items-center justify-center gap-2 animate-buzzer cursor-pointer"
              >
                <Shield className="w-8 h-8 fill-current" />
                <span>صد يا بربخ! (Intercept) 🛡️</span>
              </button>
            </div>

            {/* Validation quick buttons for referee/host */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => r3RecordShot('goal')} className="btn-arcade-green py-2.5 rounded-xl font-black text-xs">
                هدف ⚽
              </button>
              <button onClick={() => r3RecordShot('saved')} className="btn-arcade-yellow py-2.5 rounded-xl font-black text-xs">
                اتصدت 🧤
              </button>
              <button onClick={() => r3RecordShot('missed')} className="btn-arcade-red py-2.5 rounded-xl font-black text-xs">
                ضاعت ❌
              </button>
            </div>
          </div>
        )}

        {/* ======================= ROUND 4: مين يزوّد؟ (Auction) ======================= */}
        {round === 'round4' && (
          <div className="space-y-4">
            <div className="text-center font-bold text-xs text-arena-yellow">
              جولة المزاد: "مين يزوّد؟" (Blind Auction)
            </div>

            <div className="text-center bg-arena-card p-3 rounded-xl border border-arena-yellow/30">
              <div className="text-xs text-gray-400">المزاد الحالي:</div>
              <div className="text-3xl font-black text-arena-yellow font-mono">
                {r4.highestBid || 0} إجابات
              </div>
              <div className="text-[10px] text-gray-400 font-bold">
                صاحب المزاد: {roomState?.teams?.[r4.highestBidderTeam]?.name || 'في انتظار المزايدة'}
              </div>
            </div>

            {/* Bid increments */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => r4Bid(1)} className="btn-arcade-cyan py-3 rounded-xl font-black text-xs">
                +1
              </button>
              <button onClick={() => r4Bid(2)} className="btn-arcade-yellow py-3 rounded-xl font-black text-xs">
                +2
              </button>
              <button onClick={() => r4Bid(5)} className="btn-arcade-red py-3 rounded-xl font-black text-xs">
                +5 🔥
              </button>
            </div>

            {/* Lifelines Bar for Auction */}
            <div className="bg-arena-card/80 p-2.5 rounded-xl border border-white/10 space-y-1.5">
              <div className="text-[10px] font-bold text-gray-400">وسائل المساعدة (Lifelines):</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => r4UseLifeline('call_friend')}
                  disabled={teamLifelines.includes('call_friend')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                    teamLifelines.includes('call_friend')
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'btn-arcade-dark text-arena-yellow border border-arena-yellow/30 hover:border-arena-yellow'
                  }`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>اتصل بصديق (+20s)</span>
                </button>

                <button
                  onClick={() => r4UseLifeline('rival_hint')}
                  disabled={teamLifelines.includes('rival_hint')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                    teamLifelines.includes('rival_hint')
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'btn-arcade-dark text-arena-cyan border border-arena-cyan/30 hover:border-arena-cyan'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>هينت من الخصم 💡</span>
                </button>
              </div>
            </div>

            {/* Referee Checklist Items */}
            {r4.currentTopic?.validItems && (
              <div className="bg-arena-darker p-3 rounded-xl border border-white/10 space-y-1.5 text-right">
                <div className="text-[10px] font-bold text-gray-400">قائمة التحقق من الإجابات:</div>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {r4.currentTopic.validItems.map((item, idx) => {
                    const isChecked = r4.itemsNamed?.includes(item);
                    return (
                      <button
                        key={idx}
                        onClick={() => r4ToggleItem(item)}
                        className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs font-bold transition-all ${
                          isChecked ? 'bg-arena-green/20 text-arena-green border border-arena-green/40' : 'bg-arena-card text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>{item}</span>
                        {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-40" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resolution buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => r4ResolveBid(true)} className="btn-arcade-green py-3 rounded-xl font-black text-xs">
                أنا قدها ونص! 🏆
              </button>
              <button onClick={() => r4ResolveBid(false)} className="btn-arcade-red py-3 rounded-xl font-black text-xs">
                فشل في الوفاء ❌
              </button>
            </div>
          </div>
        )}

        {/* Bottom Quick Egyptian Taunts Drawer */}
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="text-[10px] font-bold text-gray-400">إفيهات وقفشات سريعة:</div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {['يا عيني على الروقان!', 'أمّن يا عم قبل ما تطير!', 'البربخ حيطة سد!', 'الفولي كودها خلاص!', 'بيلا فيتا يا باشا!'].map((taunt, idx) => (
              <button
                key={idx}
                onClick={() => sendTaunt(taunt)}
                className="bg-arena-card hover:bg-arena-cyan/20 px-2 py-1 rounded-lg text-[10px] font-bold text-gray-300 hover:text-arena-cyan border border-white/10 transition-all cursor-pointer"
              >
                {taunt}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

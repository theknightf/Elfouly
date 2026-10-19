import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CHARACTERS } from '../data/characters';
import { Smartphone, Zap, Shield, Vault, Flame, Check, X, Gavel, Radio, RotateCcw } from 'lucide-react';

export default function MobileController() {
  const {
    roomState,
    r1Score,
    r1Break,
    r1Bank,
    r2AwardPoint,
    r2Foul,
    r3InterceptBuzz,
    r3RecordShot,
    r4Bid,
    r4ResolveBid,
    sendTaunt,
    showToast
  } = useGame();

  const [simulatedPlayerId, setSimulatedPlayerId] = useState(roomState?.players?.[0]?.id || 'p1');

  const player = roomState?.players?.find(p => p.id === simulatedPlayerId) || roomState?.players?.[0];
  const char = player?.character || CHARACTERS[0];
  const round = roomState?.status || 'lobby';

  const isAnsweringInR1 = roomState?.round1?.answeringPlayerId === player?.id || player?.team === roomState?.round1?.activeTeam;
  const isReaderInR1 = roomState?.round1?.readerPlayerId === player?.id;

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

        {round === 'round1' && (
          <div className="space-y-4">
            <div className="text-center font-bold text-xs text-arena-yellow">
              جولة 1: "1 تو" - سلّم الستريك والخزنة
            </div>

            {/* If reader */}
            {isReaderInR1 && (
              <div className="space-y-3 bg-arena-card p-4 rounded-2xl border border-white/10">
                <div className="text-[11px] font-bold text-arena-red">أنت قارئ السؤال والحكم:</div>
                <div className="text-sm font-black text-white">
                  {roomState.round1?.currentQuestion?.question}
                </div>
                <div className="text-xs text-arena-green font-bold bg-black/40 p-2 rounded-lg">
                  الإجابة: {roomState.round1?.currentQuestion?.answer}
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

            {/* If answering team */}
            <div className="space-y-3">
              <div className="bg-arena-card p-3 rounded-2xl text-center space-y-1">
                <div className="text-[10px] text-gray-400 font-bold">النقاط المعلقة لفريقك:</div>
                <div className="text-2xl font-black font-mono text-arena-yellow">
                  {roomState.round1?.pendingPoints || 0}
                </div>
              </div>

              <button
                onClick={r1Bank}
                disabled={(roomState.round1?.pendingPoints || 0) === 0}
                className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 ${
                  (roomState.round1?.pendingPoints || 0) === 0
                    ? 'bg-gray-800 text-gray-500'
                    : 'btn-arcade-yellow'
                }`}
              >
                <Vault className="w-5 h-5 fill-current" />
                <span>أمّن في الخزنة BANK! 🔒</span>
              </button>

              <button
                onClick={() => showToast('دبّل وكمل!', 'تم تأكيد المخاطرة!')}
                className="w-full btn-arcade-cyan py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4 fill-current" />
                <span>دبّل / كمّل للمضاعف التالي 🔥</span>
              </button>
            </div>
          </div>
        )}

        {round === 'round2' && (
          <div className="space-y-4">
            <div className="text-center font-bold text-xs text-arena-cyan">
              جولة 2: "اديني في سري" (Password)
            </div>

            <div className="bg-arena-card p-4 rounded-2xl border border-arena-yellow/40 text-center space-y-2">
              <div className="text-[10px] text-gray-400">الكلمة السرية على شاشتك:</div>
              <div className="text-2xl font-black text-arena-cyan">
                {roomState.round2?.currentWord?.target}
              </div>
              <div className="text-[10px] text-arena-red font-bold">
                الممنوع: {roomState.round2?.currentWord?.forbidden?.join(' - ')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => r2AwardPoint('team_a')} className="btn-arcade-cyan py-3 rounded-xl font-black text-xs">
                نقطة لفريق أ (+500)
              </button>
              <button onClick={() => r2AwardPoint('team_b')} className="btn-arcade-red py-3 rounded-xl font-black text-xs">
                نقطة لفريق ب (+500)
              </button>
            </div>
          </div>
        )}

        {round === 'round3' && (
          <div className="space-y-4">
            <div className="text-center font-bold text-xs text-arena-red">
              جولة 3: "حط في قريبي" (Penalty Shootouts)
            </div>

            {/* Giant Intercept Buzzer */}
            <div className="space-y-2 text-center">
              <div className="text-xs text-gray-400">بزر الصد المباشر على الموبايل:</div>
              <button
                onClick={r3InterceptBuzz}
                className="w-full py-8 rounded-3xl btn-arcade-red font-black text-xl flex flex-col items-center justify-center gap-2 animate-buzzer"
              >
                <Shield className="w-8 h-8 fill-current" />
                <span>صد يا بربخ! (Intercept) 🛡️</span>
              </button>
            </div>

            {/* Validation quick buttons */}
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

        {round === 'round4' && (
          <div className="space-y-4">
            <div className="text-center font-bold text-xs text-arena-yellow">
              جولة المزاد: "مين يزوّد؟" (Blind Auction)
            </div>

            <div className="text-center bg-arena-card p-3 rounded-xl">
              <div className="text-xs text-gray-400">المزاد الحالي:</div>
              <div className="text-3xl font-black text-arena-yellow font-mono">
                {roomState.round4?.highestBid} إجابات
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => r4ResolveBid(true)} className="btn-arcade-green py-3 rounded-xl font-black text-xs">
                أنا قدها ونص!
              </button>
              <button onClick={() => r4ResolveBid(false)} className="btn-arcade-red py-3 rounded-xl font-black text-xs">
                انسحب 🏳️
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
                className="bg-arena-card hover:bg-arena-cyan/20 px-2 py-1 rounded-lg text-[10px] font-bold text-gray-300 hover:text-arena-cyan border border-white/10 transition-all"
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

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { canFreezeNow } from '../game/powers';
import { CHARACTERS } from '../data/characters';
import {
  Smartphone, Zap, Vault, Flame, PhoneCall, Lightbulb, CheckSquare, Square, UserPlus
} from 'lucide-react';

export default function MobileController() {
  const {
    roomState,
    r1Score,
    r1Break,
    r1Bank,
    r1Continue,
    r2AwardPoint,
    r2SkipCard,
    r2Foul,
    r2TimeFreeze,
    r3RecordShot,
    r3SubmitAnswer,
    r3SelectDuelists,
    r3StartShootout,
    r4Bid,
    r4UseLifeline,
    r4ToggleItem,
    r4ResolveBid,
    sendTaunt,
    showToast,
    roomCode
  } = useGame();

  // Online: the controller is ALWAYS the viewer's own seat. The "simulate as" picker is an
  // offline single-device testing aid only (otherwise you would see another player's controls).
  const isOnline = !!roomCode && !!roomState?.viewerId;
  const [simulatedPlayerId, setSimulatedPlayerId] = useState(roomState?.viewerId || roomState?.players?.[0]?.id || 'p1');
  const activePlayerId = isOnline ? roomState.viewerId : simulatedPlayerId;

  const player = roomState?.players?.find(p => p.id === activePlayerId) || roomState?.players?.[0];
  const char = player?.character || CHARACTERS[0];
  const round = roomState?.status || 'lobby';

  // Round 1 Roles
  const r1 = roomState?.round1 || {};
  const isAnsweringInR1 = r1.answeringPlayerId === player?.id;
  const isReaderInR1 = (r1.refereePlayerId || r1.readerPlayerId) === player?.id;
  const isTeammateInR1 = player?.team === r1.activeTeam && !isAnsweringInR1;
  const isOpponentInR1 = player?.team !== r1.activeTeam && !isReaderInR1;
  const hasLiveR1Question = !!r1.currentQuestion;

  // Round 2 Roles
  const r2 = roomState?.round2 || {};
  const isClueGiverInR2 = r2.activeClueGiverA === player?.id || r2.activeClueGiverB === player?.id;
  const isRefereeInR2 = r2.refereePlayerId === player?.id;
  const activeTurnTeamInR2 = r2.activeTurnTeam === 'team_b' ? 'team_b' : 'team_a';
  const activeTeamNameInR2 = activeTurnTeamInR2 === 'team_a'
    ? (roomState?.teams?.team_a?.name || 'فريق الحيتان')
    : (roomState?.teams?.team_b?.name || 'فريق الوحوش');
  const activeClueGiverInR2 = roomState?.players?.find(p =>
    p.id === (activeTurnTeamInR2 === 'team_a' ? r2.activeClueGiverA : r2.activeClueGiverB)
  );
  const refereeInR2 = roomState?.players?.find(p => p.id === r2.refereePlayerId);

  // Round 3 Roles
  const r3 = roomState?.round3 || {};
  const isKickerInR3 = r3.currentKickerId === player?.id;
  const isGoalieInR3 = r3.currentGoalieId === player?.id;
  const isRefereeInR3 = r3.refereePlayerId === player?.id;
  const isDuelistSelectionInR3 = r3.phase === 'duelist_selection';
  const kickingTeamKeyInR3 = r3.kickerTeam || 'team_a';
  const kickingTeamPlayersInR3 = (roomState?.players || []).filter(p => p.team === kickingTeamKeyInR3);
  const isKickingTeamInR3 = player?.team === kickingTeamKeyInR3;
  const defendingTeamKeyInR3 = kickingTeamKeyInR3 === 'team_a' ? 'team_b' : 'team_a';
  const defendingTeamPlayersInR3 = (roomState?.players || []).filter(p => p.team === defendingTeamKeyInR3);
  const isDefendingTeamInR3 = player?.team === defendingTeamKeyInR3;
  // Each team picks its own duelist: kicking team the shooter, the other team the keeper.
  const canPickShooterInR3 = isKickingTeamInR3;
  const canPickGoalieInR3 = isDefendingTeamInR3;
  const canStartR3 = !!player && !!r3.currentKickerId && !!r3.currentGoalieId && isKickingTeamInR3;
  const currentCategoryInR3 = r3.currentCategory || { name: 'برشلونة وأوروبا (بعد 2010)', icon: '⚽', hint: 'تخصص كروي' };

  // Round 4 Roles
  const r4 = roomState?.round4 || {};
  const teamLifelines = r4.usedLifelines?.[player?.team] || [];
  const isHighestBidderTeamInR4 = r4.highestBidderTeam === player?.team;
  const isRefereeInR4 = !!player && r4.refereePlayerId === player.id;
  const canUseLifelinesInR4 = !!player?.team && r4.highestBidderTeam === player.team;

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 animate-fadeIn">
      
      {/* Simulation Bar (lets user test phone experience as any character) */}
      {!isOnline && (
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
      )}

      {/* Mobile Device Frame */}
      <div className="bg-arena-darker sm:border-4 sm:border-arena-cyan/50 sm:rounded-[38px] sm:p-5 sm:shadow-2xl space-y-5 text-right relative overflow-hidden">
        
        {/* Notch / Speaker Bar */}
        <div className="hidden sm:block w-28 h-4 bg-arena-card rounded-full mx-auto border border-white/10 mb-2" />

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
            {player?.team === 'team_a' 
              ? (roomState?.teams?.team_a?.name || 'فريق أ') 
              : (roomState?.teams?.team_b?.name || 'فريق ب')}
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
        {(round === 'lobby' || round === 'waiting') && (
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
                سؤال {(r1.segmentQuestionsAnswered || 0) + 1}/12 (إجمالي {r1.totalQuestionsAnswered || 0}/48)
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

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={r1Bank}
                    disabled={!hasLiveR1Question || (r1.pendingPoints || 0) === 0}
                    className={`py-2.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 ${
                      hasLiveR1Question && (r1.pendingPoints || 0) > 0
                        ? 'btn-arcade-yellow cursor-pointer'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Vault className="w-4 h-4" />
                    <span>BANK! أمّن 🔒</span>
                  </button>
                  <button
                    onClick={r1Continue}
                    disabled={!hasLiveR1Question}
                    className={`py-2.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 ${
                      hasLiveR1Question ? 'btn-arcade-cyan cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    <span>CONTINUE كمل 🔥</span>
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

                <div className="bg-arena-card p-3 rounded-2xl text-center border border-white/10">
                  <p className="text-xs font-bold text-gray-300">
                    🔒 قرار الخزنة (Bank / Continue) من حق الفريق الخصم فقط.
                  </p>
                </div>
              </div>
            )}

            {/* Role 3: Teammate Supporting */}
            {isTeammateInR1 && (
              <div className="bg-arena-card p-4 rounded-2xl border border-white/10 text-center space-y-3">
                <div className="text-3xl">📣</div>
                <div className="text-sm font-black text-arena-cyan">فريقك في وضع الهجوم!</div>
                <p className="text-xs text-gray-300">
                  زميلك يجيب بالتبادل على أسئلة فقرة الـ 12. قرار الخزنة عند الفريق الخصم فقط.
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
                  فريقك هو الخصم — قرار الخزنة (Bank / Continue) من حقكم أنتم فقط.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={r1Bank}
                    disabled={!hasLiveR1Question || (r1.pendingPoints || 0) === 0}
                    className={`py-2.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 ${
                      hasLiveR1Question && (r1.pendingPoints || 0) > 0
                        ? 'btn-arcade-yellow cursor-pointer'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Vault className="w-4 h-4" />
                    <span>BANK! أمّن 🔒</span>
                  </button>
                  <button
                    onClick={r1Continue}
                    disabled={!hasLiveR1Question}
                    className={`py-2.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 ${
                      hasLiveR1Question ? 'btn-arcade-cyan cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    <span>CONTINUE كمل 🔥</span>
                  </button>
                </div>
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

            <div className="bg-arena-darker/80 rounded-xl border border-white/10 px-3 py-2 text-[10px] text-center space-y-0.5">
              <div className="font-black text-arena-cyan">دور {activeTeamNameInR2} — المرشد: {activeClueGiverInR2?.name || 'غير معيّن'}</div>
              <div className="text-gray-400">الحكم: {refereeInR2?.name || 'غير معيّن'} (مرشد الفريق المنافس)</div>
            </div>

            {/* Secret Card: clue-givers only */}
            {isClueGiverInR2 && r2.currentWord?.redacted !== true && (
              <div className="bg-arena-card p-4 rounded-2xl border-2 border-arena-cyan/40 text-center space-y-2">
                <div className="text-[10px] text-gray-400">الكلمة السرية المطلوب تخمينها:</div>
                <div className="text-2xl font-black text-arena-cyan">
                  {r2.currentWord?.target || '—'}
                </div>
                <div className="text-[10px] text-arena-red font-bold bg-arena-red/10 p-2 rounded-xl border border-arena-red/20">
                  الممنوعات الأربعة: {r2.currentWord?.forbidden?.join(' - ') || '—'}
                </div>
              </div>
            )}

            {!isClueGiverInR2 && (
              <div className="bg-arena-card p-6 rounded-2xl border border-white/10 text-center space-y-2">
                <div className="text-3xl">👂</div>
                <div className="text-sm font-black text-white">استمع للملمح وخمّن الكلمة!</div>
                <p className="text-xs text-gray-400">
                  الكلمة محجوبة عنك عشان الإثارة.. انطق تخمينك بصوت واضح!
                </p>
              </div>
            )}

            {isRefereeInR2 && (
              <div className="space-y-2">
                <div className="text-xs font-black text-arena-yellow text-center">
                  أنت الحكم الآن — احسم محاولة {activeTeamNameInR2} فقط
                </div>
                <button onClick={() => r2AwardPoint(activeTurnTeamInR2)} className="w-full btn-arcade-green py-3 rounded-xl font-black text-xs">
                  نقطة لـ {activeTeamNameInR2} (حسب السرعة) 🎯
                </button>
                <button onClick={() => r2Foul(activeTurnTeamInR2)} className="w-full btn-arcade-dark py-2.5 rounded-xl font-bold text-xs text-arena-red border border-arena-red/30">
                  مخالفة على {activeTeamNameInR2} (-300 وتنتهي البطاقة)
                </button>
                {canFreezeNow(roomState, player?.id) && (
                  <button onClick={r2TimeFreeze} className="w-full btn-arcade-yellow py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>تجميد الوقت الفندقي (+10 ثواني، مرة واحدة) 🛎️</span>
                  </button>
                )}
                <button onClick={r2SkipCard} className="w-full btn-arcade-dark py-2.5 rounded-xl font-bold text-xs text-gray-300">
                  تخطي البطاقة الحالية
                </button>
              </div>
            )}

            {!isRefereeInR2 && isClueGiverInR2 && (
              <div className="bg-arena-darker/80 rounded-xl border border-dashed border-gray-600 p-3 text-center text-[10px] text-gray-400">
                أنت مرشد الآن — الحكم هو مرشد الفريق المنافس فقط.
              </div>
            )}
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

            {isDuelistSelectionInR3 ? (
              <div className="space-y-4">
                {/* Random Category Announcement */}
                <div className="bg-arena-card p-3 rounded-2xl border-2 border-arena-yellow/50 text-center space-y-1">
                  <div className="text-[10px] font-black text-arena-yellow">🎲 التصنيف المختار للركلة:</div>
                  <div className="text-base font-black text-white flex items-center justify-center gap-2">
                    <span>{currentCategoryInR3.icon}</span>
                    <span>{currentCategoryInR3.name}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">{currentCategoryInR3.hint}</div>
                </div>

                {/* Shooter picker: the kicking team chooses */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-gray-300">
                    {canPickShooterInR3
                      ? '🎯 فريقك بيشوط — اختار المسدد:'
                      : `🎯 ${roomState?.teams?.[kickingTeamKeyInR3]?.name || 'الفريق الضارب'} بيختار المسدد.`}
                  </div>
                  {canPickShooterInR3 && (
                    <div className="space-y-1.5">
                      {kickingTeamPlayersInR3.map(p => {
                        const isSelected = p.id === r3.currentKickerId;
                        return (
                          <button
                            key={p.id}
                            onClick={() => r3SelectDuelists(p.id, null)}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-arena-cyan/20 border-arena-cyan text-white shadow-sm'
                                : 'bg-arena-card border-white/10 text-gray-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{p.character?.avatar}</span>
                              <span>{p.name}</span>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] text-arena-yellow font-black">المسدد ✔️</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!canPickShooterInR3 && r3.currentKickerId && (
                    <div className="text-[11px] font-black text-white">المختار: {(roomState?.players || []).find(p => p.id === r3.currentKickerId)?.name}</div>
                  )}
                </div>

                {/* Goalie picker: the defending team chooses */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-gray-300">
                    {canPickGoalieInR3
                      ? '🧤 فريقك بيدافع — اختار الحارس:'
                      : `🧤 ${roomState?.teams?.[defendingTeamKeyInR3]?.name || 'فريق الحارس'} بيختار الحارس.`}
                  </div>
                  {canPickGoalieInR3 && (
                    <div className="space-y-1.5">
                      {defendingTeamPlayersInR3.map(p => {
                        const isSelected = p.id === r3.currentGoalieId;
                        return (
                          <button
                            key={p.id}
                            onClick={() => r3SelectDuelists(null, p.id)}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-arena-cyan/20 border-arena-cyan text-white shadow-sm'
                                : 'bg-arena-card border-white/10 text-gray-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{p.character?.avatar}</span>
                              <span>{p.name}</span>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] text-arena-yellow font-black">الحارس ✔️</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!canPickGoalieInR3 && r3.currentGoalieId && (
                    <div className="text-[11px] font-black text-white">المختار: {(roomState?.players || []).find(p => p.id === r3.currentGoalieId)?.name}</div>
                  )}
                </div>

                <button
                  onClick={r3StartShootout}
                  disabled={!canStartR3}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg ${
                    canStartR3
                      ? 'btn-arcade-green cursor-pointer'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <span>بدء ركلة الجزاء ⚔️</span>
                </button>
              </div>
            ) : (
              <>
                {/* Kicker Question */}
                <div className="bg-arena-card p-3 rounded-2xl border border-white/10 space-y-2">
                  <div className="text-[10px] text-arena-cyan font-bold">
                    {isKickerInR3 ? '🎯 أنت المسدد الآن:' : 'سؤال ركلة الجزاء:'}
                  </div>
                  {!isKickerInR3 && !isGoalieInR3 && <div className="text-xs font-black text-white">{r3.currentQuestion?.question}</div>}
                  {isKickerInR3 && <div className="text-xs text-gray-300">اختار إجابتك من غير ما تشوف السؤال، واسمعه من الحكم.</div>}
                  {isGoalieInR3 && <div className="text-xs text-gray-300">استنى قراءة الحكم للسؤال، وبعدها قرر تضغط زر الصد.</div>}
                  {isKickerInR3 && r3.currentQuestion?.options && (
                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      {r3.currentQuestion.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (!isKickerInR3 || r3.pendingAnswer) return;
                            showToast('تم تسجيل إجابتك 🔒', 'الحكم الوحيد هو من يعتمد النتيجة الآن.');
                            r3SubmitAnswer(opt);
                          }}
                          disabled={!isKickerInR3 || !!r3.pendingAnswer}
                          className={`p-3 rounded-xl font-bold text-gray-200 border border-white/10 transition-all text-right flex items-center justify-between shadow-sm ${
                            isKickerInR3 && !r3.pendingAnswer
                              ? 'bg-arena-darker hover:bg-arena-cyan/20 hover:border-arena-cyan cursor-pointer active:scale-95'
                              : 'bg-arena-darker/50 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <span className="truncate">{opt}</span>
                          <span className="text-arena-cyan font-mono font-black text-[10px]">.{i + 1}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {r3.pendingAnswer && (
                    <div className="text-[10px] text-arena-cyan font-bold text-center">
                      🔒 تم تسجيل الإجابة — في انتظار قرار الحكم.
                    </div>
                  )}
                </div>

                {/* Single judge decides Goal / Miss */}
                {isRefereeInR3 && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-arena-red font-black text-center">
                      أنت الحكم الوحيد لهذه الركلة — اعتمد النتيجة:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => r3RecordShot('goal')} className="btn-arcade-green py-3 rounded-xl font-black text-sm">
                        هدف ⚽
                      </button>
                      <button onClick={() => r3RecordShot('missed')} className="btn-arcade-red py-3 rounded-xl font-black text-sm">
                        ضاعت ❌
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
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
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => r4UseLifeline('call_friend')}
                  disabled={!canUseLifelinesInR4 || teamLifelines.includes('call_friend')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                    !canUseLifelinesInR4 || teamLifelines.includes('call_friend')
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'btn-arcade-dark text-arena-yellow border border-arena-yellow/30 hover:border-arena-yellow'
                  }`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>اتصل بصديق (+20s)</span>
                </button>

                <button
                  onClick={() => r4UseLifeline('rival_hint')}
                  disabled={!canUseLifelinesInR4 || teamLifelines.includes('rival_hint')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                    !canUseLifelinesInR4 || teamLifelines.includes('rival_hint')
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'btn-arcade-dark text-arena-cyan border border-arena-cyan/30 hover:border-arena-cyan'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>هينت من الخصم 💡</span>
                </button>

                <button
                  onClick={() => r4UseLifeline('opponent_help')}
                  disabled={!canUseLifelinesInR4 || teamLifelines.includes('opponent_help')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                    !canUseLifelinesInR4 || teamLifelines.includes('opponent_help')
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'btn-arcade-dark text-arena-green border border-arena-green/30 hover:border-arena-green'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>استعين بالخصم</span>
                </button>
              </div>
            </div>

            {/* Only the designated referee can verify or resolve the auction. */}
            {!isRefereeInR4 ? (
              <div className="bg-arena-card/90 p-4 rounded-xl border border-arena-yellow/40 text-center space-y-2">
                <div className="text-xs font-black text-arena-yellow flex items-center justify-center gap-1.5">
                  <span>{isHighestBidderTeamInR4 ? 'قفل منع التقييم الذاتي 🚫' : 'لوحة التحقق عند الحكم 🛡️'}</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  {isHighestBidderTeamInR4
                    ? `أنت وفريقك أصحاب المزاد الأعلى (${r4.highestBid || 0} إجابات)! اذكر إجاباتك بصوت واضح، وحكم الفريق الخصم هو المسؤول عن تدقيق العناصر واعتماد النتيجة.`
                    : 'انتظر حكم الفريق الخصم لاعتماد العناصر المذكورة، ثم يعتمد نتيجة المزاد من جهازه.'}
                </p>
                <div className="text-[10px] text-arena-cyan font-bold bg-arena-darker/60 p-2 rounded-lg">
                  العناصر التي تم التحقق منها حتى الآن: {r4.itemsNamed?.length || 0} / {r4.highestBid || 0}
                </div>
              </div>
            ) : (
              <>
                {/* Referee Checklist Items */}
                {r4.currentTopic?.validItems && (
                  <div className="bg-arena-darker p-3 rounded-xl border border-white/10 space-y-1.5 text-right">
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
                      <span>قائمة التحقق من الإجابات:</span>
                      <span className="text-arena-green">حكم التدقيق 🛡️</span>
                    </div>
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
                    نجح في التحدي! 🏆
                  </button>
                  <button onClick={() => r4ResolveBid(false)} className="btn-arcade-red py-3 rounded-xl font-black text-xs">
                    فشل في الوفاء ❌
                  </button>
                </div>
              </>
            )}
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

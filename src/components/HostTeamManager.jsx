import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  Shield,
  Users,
  Edit3,
  Check,
  ArrowUpDown,
  ArrowRightLeft,
  Crown,
  Gavel,
  ChevronUp,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { TEAM_PRESETS } from '../data/characters';


/**
 * HostTeamManager
 *
 * Dedicated Host Control Panel for Pre-Game Team Management:
 * 1. Freely edit team names at any time before starting.
 * 2. Reassign players across teams (Team A <-> Team B) respecting team caps.
 * 3. Reorder intra-team player sequence (Player 1 vs Player 2) to control turn alternation.
 * 4. Swap entire team rosters with one tap.
 * 5. Designate the Single Judge for the match session.
 */
export default function HostTeamManager() {
  const {
    roomState,
    isHost,
    updateTeamNames,
    reassignPlayerTeam,
    reorderTeamPlayers,
    swapTeams,
    setMatchJudge
  } = useGame();

  const teams = roomState?.teams || {};
  const teamA = teams.team_a || { name: 'فريق الحيتان', score: 0 };
  const teamB = teams.team_b || { name: 'فريق الوحوش', score: 0 };
  const players = roomState?.players || [];
  const singleJudgeId = roomState?.singleJudgeId || roomState?.matchJudgeId || null;

  const [isEditingNames, setIsEditingNames] = useState(false);
  const [nameA, setNameA] = useState(teamA.name);
  const [nameB, setNameB] = useState(teamB.name);

  if (!isHost) return null;

  const handleSelectPreset = (preset) => {
    setNameA(preset.nameA);
    setNameB(preset.nameB);
    updateTeamNames({
      team_a: preset.nameA,
      team_b: preset.nameB
    });
  };

  const handleSaveNames = (e) => {
    e?.preventDefault();
    updateTeamNames({
      team_a: nameA.trim() || 'فريق الحيتان',
      team_b: nameB.trim() || 'فريق الوحوش'
    });
    setIsEditingNames(false);
  };

  const teamAPlayers = players.filter(p => p.team === 'team_a');
  const teamBPlayers = players.filter(p => p.team === 'team_b');

  return (
    <div className="rounded-3xl bg-arena-card/90 border-2 border-arena-yellow/50 p-4 md:p-6 shadow-2xl space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-arena-yellow/20 border-2 border-arena-yellow flex items-center justify-center text-arena-yellow shadow-[0_0_15px_rgba(255,210,0,0.3)]">
            <Crown className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2">
              <span>لوحة الهوست: إدارة الفرق والتشكيلة</span>
              <span className="text-[10px] bg-arena-yellow text-arena-darker px-2 py-0.5 rounded-full font-black">
                خاص بالمسؤول
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              تحكم بأسماء الفرق، ترتيب اللاعبين، وتوزيع المقاعد قبل صافرة البداية.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={swapTeams}
            className="btn-arcade-dark px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/15 hover:border-arena-cyan cursor-pointer transition-all"
            title="تبديل أماكن الفريقين بالكامل"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-arena-cyan" />
            <span>تبديل الفريقين 🔄</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingNames(!isEditingNames)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
              isEditingNames
                ? 'bg-arena-yellow text-arena-darker border-arena-yellow shadow-lg'
                : 'bg-arena-darker text-arena-yellow border-arena-yellow/40 hover:border-arena-yellow'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingNames ? 'إلغاء التعديل' : 'تعديل أسماء الفرق ✏️'}</span>
          </button>
        </div>
      </div>

      {/* Team Names Editing Form */}
      {isEditingNames && (
        <form onSubmit={handleSaveNames} className="bg-arena-darker/90 rounded-2xl p-4 border border-arena-yellow/40 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-arena-yellow flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>تعديل مسميات الفرق للمباراة أو اختيار ثنائي جاهز:</span>
            </div>
            <span className="text-[10px] text-gray-400">انقر على أي ثنائي للتطبيق الفوري ⚡</span>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap gap-1.5">
            {TEAM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-surface-container border border-white/10 hover:border-arena-yellow hover:text-arena-yellow transition-all cursor-pointer text-gray-200"
              >
                {preset.label}: {preset.nameA} vs {preset.nameB}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-arena-cyan mb-1">اسم الفريق الأول (Team A):</label>
              <input
                type="text"
                value={nameA}
                onChange={(e) => setNameA(e.target.value)}
                maxLength={28}
                className="w-full bg-arena-card border-2 border-arena-cyan/50 focus:border-arena-cyan rounded-xl px-3 py-2 text-sm text-white font-black outline-none transition-all text-right"
                placeholder="اسم الفريق الأول..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-arena-red mb-1">اسم الفريق الثاني (Team B):</label>
              <input
                type="text"
                value={nameB}
                onChange={(e) => setNameB(e.target.value)}
                maxLength={28}
                className="w-full bg-arena-card border-2 border-arena-red/50 focus:border-arena-red rounded-xl px-3 py-2 text-sm text-white font-black outline-none transition-all text-right"
                placeholder="اسم الفريق الثاني..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="btn-arcade-green px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>حفظ المسميات الجديدة ✅</span>
            </button>
          </div>
        </form>
      )}

      {/* Two-Column Team Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team A Roster */}
        <TeamCard
          teamKey="team_a"
          teamName={teamA.name}
          players={teamAPlayers}
          accentColor="cyan"
          singleJudgeId={singleJudgeId}
          onReassign={(pId) => reassignPlayerTeam(pId, 'team_b')}
          onMoveUp={(idx) => reorderTeamPlayers('team_a', idx, idx - 1)}
          onMoveDown={(idx) => reorderTeamPlayers('team_a', idx, idx + 1)}
          onToggleJudge={(pId) => setMatchJudge(singleJudgeId === pId ? null : pId)}
        />

        {/* Team B Roster */}
        <TeamCard
          teamKey="team_b"
          teamName={teamB.name}
          players={teamBPlayers}
          accentColor="red"
          singleJudgeId={singleJudgeId}
          onReassign={(pId) => reassignPlayerTeam(pId, 'team_a')}
          onMoveUp={(idx) => reorderTeamPlayers('team_b', idx, idx - 1)}
          onMoveDown={(idx) => reorderTeamPlayers('team_b', idx, idx + 1)}
          onToggleJudge={(pId) => setMatchJudge(singleJudgeId === pId ? null : pId)}
        />
      </div>

      {/* Single Judge Rule Notice */}
      <div className="bg-arena-darker/60 rounded-2xl p-3.5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
            <Gavel className="w-4 h-4" />
          </div>
          <div>
            <div className="font-black text-white">نظام الحكم الوحيد للمباراة (Single Judge Rule)</div>
            <div className="text-[11px] text-gray-400">
              حكم واحد فقط يتولى التحكيم ويُستثنى تماماً من الإجابة. في حالة عدم التعيين، يتولى ممثل الفريق الخصم التحكيم تلقائياً.
            </div>
          </div>
        </div>

        {singleJudgeId ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-black whitespace-nowrap">
            <span>الحكم المحدد: {players.find(p => p.id === singleJudgeId)?.name || 'اللاعب'}</span>
            <button
              type="button"
              onClick={() => setMatchJudge(null)}
              className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer ml-1"
            >
              إلغاء التخصيص
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-gray-500 font-bold whitespace-nowrap">
            التحكيم بنظام المداورة التلقائية للخصم 🛡️
          </span>
        )}
      </div>
    </div>
  );
}

function TeamCard({
  teamKey,
  teamName,
  players,
  accentColor,
  singleJudgeId,
  onReassign,
  onMoveUp,
  onMoveDown,
  onToggleJudge
}) {
  const isCyan = accentColor === 'cyan';
  const borderClasses = isCyan ? 'border-arena-cyan/40 bg-arena-cyan/5' : 'border-arena-red/40 bg-arena-red/5';
  const badgeClasses = isCyan ? 'bg-arena-cyan/20 text-arena-cyan border-arena-cyan/50' : 'bg-arena-red/20 text-arena-red border-arena-red/50';

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 ${borderClasses}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${isCyan ? 'text-arena-cyan' : 'text-arena-red'}`} />
          <h3 className="font-black text-sm md:text-base text-white truncate max-w-[200px]">
            {teamName}
          </h3>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeClasses}`}>
          {players.length}/2 لاعبين
        </span>
      </div>

      {players.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
          لا يوجد لاعبين في هذا الفريق بعد
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((player, idx) => {
            const character = player.character || { name: 'شخصية', avatar: '🎮', color: '#00F2FE' };
            const isJudge = singleJudgeId === player.id;

            return (
              <div
                key={player.id || idx}
                className="bg-arena-card/90 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border shrink-0"
                    style={{ backgroundColor: `${character.color}20`, borderColor: character.color }}
                  >
                    {character.avatar}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="text-xs font-black text-white flex items-center gap-1.5 truncate">
                      <span>{player.name}</span>
                      {player.isHost && (
                        <span className="text-[9px] text-arena-yellow font-black">👑 هوست</span>
                      )}
                      {isJudge && (
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 rounded-md font-bold">
                          حكم 🛡️
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold truncate">
                      لاعب #{idx + 1} في الترتيب (الدور {idx % 2 === 0 ? 'الأول' : 'الثاني'})
                    </div>
                  </div>
                </div>

                {/* Host Control Actions per Player */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Up / Down reordering within team */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveUp(idx)}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="تقديم في الترتيب"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === players.length - 1}
                      onClick={() => onMoveDown(idx)}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="تأخير في الترتيب"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Move to other team */}
                  <button
                    type="button"
                    onClick={() => onReassign(player.id)}
                    className="p-1.5 rounded-lg bg-arena-darker hover:bg-white/10 text-arena-yellow text-[10px] font-bold border border-white/10 cursor-pointer transition-all"
                    title="نقل للفريق الآخر"
                  >
                    ⇄ نقل
                  </button>

                  {/* Single judge assign toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleJudge(player.id)}
                    className={`p-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                      isJudge
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-arena-darker text-gray-400 hover:text-purple-300 border-white/10'
                    }`}
                    title="تعيين/إلغاء كحكم للمباراة"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CHARACTERS, TEAMS } from '../data/characters';
import { 
  Shield, Zap, Sparkles, Trophy, Users, Play, ArrowRight, Smartphone, 
  CheckCircle, Flame, Crown, Copy, Share2, Clock, UserPlus, Lock, RefreshCw
} from 'lucide-react';

export default function Lobby() {
  const {
    roomState,
    setRoomState,
    changeRound,
    countdown,
    startMatchCountdown,
    createRoom,
    joinRoom,
    addDemoPlayer,
    socket,
    isConnected,
    currentPlayer,
    setCurrentPlayer,
    isHost,
    showToast,
    fireConfetti
  } = useGame();

  const [selectedCharId, setSelectedCharId] = useState(CHARACTERS[0].id);
  const [selectedTeam, setSelectedTeam] = useState('team_a');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);

  const selectedChar = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
  const players = roomState?.players || [];
  const currentCode = roomState?.code || 'QZ-7842';

  // Check if current user is Host
  const isUserHost = isHost || 
    players.find(p => p.id === socket?.id)?.isHost || 
    (players[0]?.id === (currentPlayer?.id || socket?.id)) ||
    players.length === 1;

  const handleSelectCharacter = (char) => {
    setSelectedCharId(char.id);
  };

  const handleSaveProfile = () => {
    const name = playerNameInput.trim() || selectedChar.name;
    const playerObj = {
      id: socket?.id || currentPlayer?.id || 'local_user',
      name: name,
      character: selectedChar,
      team: selectedTeam,
      isHost: isUserHost,
      scoreContribution: 0
    };
    setCurrentPlayer(playerObj);

    if (socket && isConnected && currentCode) {
      socket.emit('update_player_profile', {
        roomCode: currentCode,
        characterId: selectedChar.id,
        team: selectedTeam
      });
    } else {
      setRoomState(prev => {
        const existingIdx = (prev.players || []).findIndex(p => p.id === playerObj.id);
        let updatedPlayers = [...(prev.players || [])];
        if (existingIdx >= 0) {
          updatedPlayers[existingIdx] = playerObj;
        } else {
          updatedPlayers.unshift(playerObj);
        }
        return { ...prev, players: updatedPlayers };
      });
    }

    fireConfetti();
    showToast('تم تثبيت الشخصية! ⚡', `اخترت: ${selectedChar.name} في ${selectedTeam === 'team_a' ? 'فريق الحيتان' : 'فريق الوحوش'}`);
  };

  const handleCreateRoomClick = () => {
    createRoom(playerNameInput.trim() || selectedChar.name, selectedChar.id);
  };

  const handleJoinRoomClick = () => {
    if (!joinCodeInput.trim()) {
      showToast('تنبيه', 'من فضلك اكتب كود الغرفة');
      return;
    }
    joinRoom(joinCodeInput.trim(), playerNameInput.trim() || selectedChar.name, selectedChar.id, selectedTeam);
    setShowJoinModal(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(currentCode);
    showToast('تم نسخ الكود! 📋', `كود الغرفة: ${currentCode}`);
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}/?view=controller&room=${currentCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'ساحة الكويز (Quiz Arena)',
        text: `انضم إلى سهرة ساحة الكويز بكود: ${currentCode}`,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      showToast('تم نسخ الرابط! 🔗', 'شارك الرابط مع اللاعبين للدخول المباشر كتحكم موبايل!');
    }
  };

  // 4 Player Slots calculation
  const slots = [0, 1, 2, 3].map(idx => {
    const p = players[idx];
    return {
      index: idx,
      isHostSlot: idx === 0,
      player: p,
      isFilled: !!p
    };
  });

  const filledCount = players.length;
  const isThresholdMet = filledCount >= 4;

  let counterText = '';
  if (filledCount === 1) counterText = '(1/4) في الانتظار... (متبقي 3 لاعبين)';
  else if (filledCount === 2) counterText = '(2/4) في الانتظار... (متبقي لاعبين)';
  else if (filledCount === 3) counterText = '(3/4) في الانتظار... (متبقي لاعب واحد)';
  else counterText = `(${filledCount}/4) اكتمل العدد! جاهزون للانطلاق 🚀`;

  return (
    <div className="max-w-7xl mx-auto px-3 py-6 space-y-8 animate-fadeIn">
      
      {/* Synchronized 3-Second Match Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-arena-darker/95 backdrop-blur-md p-4 animate-fadeIn">
          <div className="relative text-center space-y-4 max-w-md w-full">
            <div className="inline-block text-sm font-black text-arena-yellow uppercase tracking-widest bg-arena-yellow/10 px-4 py-1.5 rounded-full border border-arena-yellow/30 animate-pulse">
              {countdown === 3 && 'جاهز يا كابتن؟ ⚡'}
              {countdown === 2 && 'اربط الحزام! 🔥'}
              {countdown === 1 && 'يا ساتر يا رب! 🎯'}
              {countdown === 0 && 'انطلق! صااااافرة البداية! ⚽'}
            </div>

            <div className="text-8xl md:text-9xl font-black font-mono text-arena-cyan animate-bounce-short drop-shadow-[0_0_35px_#00F2FE]">
              {countdown === 0 ? '🚀' : countdown}
            </div>

            <div className="text-lg md:text-2xl font-black text-white">
              {countdown === 0 ? 'بدء جولة 1 تو (Bank Mode)!' : 'الجميع ينتقل للساحة بعد قليل...'}
            </div>
            
            <p className="text-xs text-gray-400">
              يتم توجيه جميع الهواتف والشاشات المتصلة تلقائياً في نفس اللحظة!
            </p>
          </div>
        </div>
      )}

      {/* Prominent Waiting Room Header & Code Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-arena-darker via-arena-card to-arena-darker border-2 border-arena-cyan/40 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-arena-cyan/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-arena-red/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="text-center lg:text-right space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arena-yellow/20 border border-arena-yellow text-arena-yellow text-xs font-black">
              <Flame className="w-4 h-4 animate-bounce" />
              <span>صالة انتظار الساحة الرسمية (Lobby Waiting Room)</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              ساحة الكويز <span className="text-arena-cyan">روش ومصري</span> 🎮
            </h1>
            
            <p className="text-gray-300 text-sm md:text-base leading-relaxed">
              شارك كود الساحة مع أصحابك للدخول من هواتفهم. يلزم اكتمال 4 لاعبين في الخانات لتفعيل زر انطلاق الماتش من جهاز الهوست!
            </p>

            {/* Threshold Counter Pill */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
              <span className={`text-xs font-black px-3.5 py-1.5 rounded-full border flex items-center gap-1.5 ${
                isThresholdMet 
                  ? 'bg-emerald-500/20 text-arena-green border-arena-green/50 shadow-[0_0_15px_rgba(0,230,118,0.3)] animate-pulse' 
                  : 'bg-arena-yellow/10 text-arena-yellow border-arena-yellow/30'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{counterText}</span>
              </span>
            </div>
          </div>

          {/* Prominent Room ID Card */}
          <div className="bg-arena-darker/95 p-5 rounded-3xl border-2 border-arena-yellow/40 text-center space-y-3 min-w-[280px] sm:min-w-[320px] shadow-2xl">
            <div className="text-xs text-arena-yellow font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
              <span>كود الغرفة المعتمد (Room ID)</span>
            </div>
            
            <div className="text-4xl md:text-5xl font-black font-mono text-arena-yellow tracking-widest bg-black/60 py-3 rounded-2xl border border-arena-yellow/50 shadow-inner select-all">
              {currentCode}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleCopyCode}
                className="btn-arcade-dark py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:border-arena-cyan"
              >
                <Copy className="w-3.5 h-3.5 text-arena-cyan" />
                <span>نسخ الكود</span>
              </button>
              <button
                onClick={handleShareLink}
                className="btn-arcade-cyan py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة الرابط</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
              <button
                onClick={handleCreateRoomClick}
                className="text-gray-400 hover:text-arena-yellow flex items-center gap-1 cursor-pointer font-bold transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>إنشاء كود جديد</span>
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="text-gray-400 hover:text-arena-cyan flex items-center gap-1 cursor-pointer font-bold transition-colors"
              >
                <Smartphone className="w-3 h-3" />
                <span>دخول بكود آخر</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Real-time Waiting Screen: 4 Interactive Player Slots (4-Player Threshold) */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-arena-cyan" />
            <h2 className="text-xl md:text-2xl font-black text-white">
              خانات اللاعبين في الساحة (نصاب 4 لاعبين)
            </h2>
          </div>

          {/* Quick solo testing button */}
          {!isThresholdMet && (
            <button
              onClick={addDemoPlayer}
              className="btn-arcade-dark px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-arena-yellow border border-arena-yellow/30 hover:border-arena-yellow cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ إضافة لاعب تجريبي (محاكاة 4/4)</span>
            </button>
          )}
        </div>

        {/* 4 Interactive Player Slots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map(slot => {
            const isFilled = slot.isFilled;
            const p = slot.player;
            const isHostSlot = slot.isHostSlot;

            if (isFilled) {
              const char = p.character || CHARACTERS[0];
              return (
                <div
                  key={slot.index}
                  className={`relative rounded-3xl p-5 border-2 transition-all duration-300 shadow-xl bg-arena-card text-right flex flex-col justify-between ${
                    isHostSlot 
                      ? 'border-arena-yellow/80 shadow-[0_0_20px_rgba(255,210,0,0.2)]' 
                      : 'border-arena-cyan/40 hover:border-arena-cyan'
                  }`}
                >
                  {/* Top Badge: Host Crown vs Player Number */}
                  <div className="flex items-center justify-between mb-3">
                    {isHostSlot ? (
                      <span className="inline-flex items-center gap-1.5 bg-arena-yellow/20 text-arena-yellow border border-arena-yellow/40 px-2.5 py-0.5 rounded-full text-[11px] font-black">
                        <Crown className="w-3.5 h-3.5 fill-current animate-bounce" />
                        <span>الهوست (كابتن الساحة 👑)</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-gray-400">
                        خانة #{slot.index + 1}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 text-[10px] text-arena-green font-bold bg-arena-green/10 px-2 py-0.5 rounded-full border border-arena-green/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-arena-green animate-ping" />
                      <span>متصل ومستعد</span>
                    </span>
                  </div>

                  {/* Character Avatar & Info */}
                  <div className="flex items-center gap-3 my-2">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md border-2"
                      style={{ backgroundColor: `${char.color}20`, borderColor: char.color }}
                    >
                      {char.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-white truncate">{p.name}</div>
                      <div className="text-xs font-bold truncate" style={{ color: char.color }}>
                        {char.name}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{char.badge}</div>
                    </div>
                  </div>

                  {/* Team Tag Pill */}
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-gray-400 font-bold">الفريق:</span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        p.team === 'team_a'
                          ? 'bg-arena-cyan/20 text-arena-cyan border border-arena-cyan/30'
                          : 'bg-arena-red/20 text-arena-red border border-arena-red/30'
                      }`}
                    >
                      {p.team === 'team_a' ? 'الحيتان (A) 🐬' : 'الوحوش (B) 🦁'}
                    </span>
                  </div>
                </div>
              );
            }

            // Inactive / Empty Slot Waiting for Player
            return (
              <div
                key={slot.index}
                className="relative rounded-3xl p-6 border-2 border-dashed border-white/20 bg-arena-card/30 text-center flex flex-col items-center justify-center gap-3 transition-all min-h-[190px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-arena-darker/80 border border-white/10 flex items-center justify-center text-2xl text-gray-500 animate-pulse">
                  ⏳
                </div>
                <div>
                  <div className="text-sm font-black text-gray-300">
                    خانة لاعب #{slot.index + 1}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    في انتظار الانضمام بكود الساحة...
                  </div>
                </div>

                <button
                  onClick={addDemoPlayer}
                  className="btn-arcade-dark px-3 py-1 rounded-xl text-[11px] font-bold text-gray-400 hover:text-white border border-white/10 cursor-pointer mt-1"
                >
                  + إضافة لاعب محاكي
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Game Launch Section: Strict Host Authority & Status Banner */}
      {/* ===================================================================== */}
      <div className="bg-arena-darker/90 rounded-3xl p-6 border-2 border-white/10 text-center space-y-4 shadow-2xl">
        {isUserHost ? (
          <div className="space-y-3 max-w-xl mx-auto">
            <div className="flex items-center justify-center gap-2 text-xs font-black text-arena-yellow">
              <Crown className="w-4 h-4 fill-current" />
              <span>صلاحية إطلاق الماتش (لوحة تحكم الهوست 👑)</span>
            </div>

            {isThresholdMet ? (
              <div className="space-y-2">
                <button
                  onClick={startMatchCountdown}
                  className="w-full btn-arcade-green py-4 rounded-2xl text-lg font-black flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(0,230,118,0.4)] animate-pulse cursor-pointer hover:brightness-110"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>ابدأ الجيم! (انطلاق المباراة الآن) 🚀</span>
                </button>
                <p className="text-xs text-arena-green font-bold">
                  اكتمل نصاب الـ 4 لاعبين! الضغط سيبدأ عداً تنازلياً مدته 3 ثوانٍ على جميع الأجهزة بالتزامن.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full bg-gray-800 text-gray-500 py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 border border-white/10 cursor-not-allowed shadow-none"
                >
                  <Lock className="w-5 h-5" />
                  <span>في انتظار اكتمال 4 لاعبين لبدء المباراة ({filledCount}/4)... 🔒</span>
                </button>
                <p className="text-xs text-gray-400">
                  الزر مغلق تلقائياً حتى يكتمل عدد اللاعبين الـ 4 في الساحة. يمكنك استخدام زر "إضافة لاعب تجريبي" أعلاه للتجربة الفورية.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Non-host player waiting banner */
          <div className="p-4 rounded-2xl bg-arena-card/80 border border-arena-cyan/30 text-center space-y-2 max-w-lg mx-auto">
            <div className="flex items-center justify-center gap-2 text-arena-cyan font-black text-base animate-pulse">
              <Clock className="w-5 h-5" />
              <span>في انتظار الهوست لبدء المباراة...</span>
            </div>
            <p className="text-xs text-gray-300">
              أنت متصل بالساحة كلاعب. كابتن الغرفة (الهوست 👑) سيعطي إشارة الانطلاق بمجرد اكتمال النصاب!
            </p>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* Character Roster Grid (All 7 Egyptian Characters with Lore & Attributes) */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-arena-yellow" />
              <span>تشكيلة النجوم وقدرات اللاعبين</span>
            </h2>
            <p className="text-xs md:text-sm text-gray-400">
              كل شخصية لها تخصصات معينة وبونص سحري ينقذك أو يضاعف نقطك في الماتش!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CHARACTERS.map((char) => {
            const isSelected = selectedCharId === char.id;
            return (
              <div
                key={char.id}
                onClick={() => handleSelectCharacter(char)}
                className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-200 border-2 ${
                  isSelected
                    ? 'bg-arena-card shadow-2xl scale-[1.02]'
                    : 'bg-arena-card/60 hover:bg-arena-card/90 border-white/10 hover:border-white/30'
                }`}
                style={{ borderColor: isSelected ? char.color : undefined }}
              >
                {/* Header: Avatar, Name & Nickname */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md border-2"
                    style={{ backgroundColor: `${char.color}20`, borderColor: char.color }}
                  >
                    {char.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-400">{char.realName}</div>
                    <h3 className="text-lg font-black text-white truncate" style={{ color: char.color }}>
                      {char.name}
                    </h3>
                    <div className="inline-block text-[11px] font-bold text-arena-yellow bg-arena-yellow/10 px-2 py-0.5 rounded-full border border-arena-yellow/20">
                      {char.badge}
                    </div>
                  </div>
                </div>

                {/* Catchphrase */}
                <div className="mt-3 text-xs italic text-gray-300 bg-arena-darker/70 p-2.5 rounded-xl border border-white/5">
                  "{char.catchphrase}"
                </div>

                {/* Attributes Tags */}
                <div className="mt-3 space-y-1.5">
                  <div className="text-[11px] font-bold text-gray-400">المجالات والتخصصات:</div>
                  <div className="flex flex-wrap gap-1">
                    {char.attributesDisplay.map((attr, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold bg-arena-darker px-2 py-0.5 rounded-lg border border-white/10 text-gray-300"
                      >
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bonus Badge */}
                <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-arena-darker to-arena-card border border-arena-yellow/30">
                  <div className="flex items-center gap-1.5 text-xs font-black text-arena-yellow">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>{char.bonus.title}</span>
                  </div>
                  <div className="text-[11px] text-gray-300 mt-0.5 leading-tight">
                    {char.bonus.description}
                  </div>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div
                    className="absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: char.color }}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Character Customization & Team Assignment */}
      <div className="bg-arena-card rounded-3xl p-6 border-2 border-arena-cyan/30 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-xl border-2"
              style={{ backgroundColor: `${selectedChar.color}20`, borderColor: selectedChar.color }}
            >
              {selectedChar.avatar}
            </div>
            <div>
              <div className="text-xs text-gray-400">الشخصية المختارة حالياً:</div>
              <h3 className="text-xl md:text-2xl font-black text-white" style={{ color: selectedChar.color }}>
                {selectedChar.name} ({selectedChar.realName})
              </h3>
              <p className="text-xs text-gray-300 max-w-md">{selectedChar.lore}</p>
            </div>
          </div>

          {/* Player Name and Team Select */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="اسمك في الماتش (اختياري)"
              value={playerNameInput}
              onChange={(e) => setPlayerNameInput(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-arena-darker border border-white/20 text-white placeholder-gray-500 text-sm focus:border-arena-cyan outline-none w-full sm:w-48"
            />

            {/* Team Selector */}
            <div className="flex items-center bg-arena-darker p-1 rounded-xl border border-white/10 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => setSelectedTeam('team_a')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  selectedTeam === 'team_a'
                    ? 'bg-arena-cyan text-arena-darker shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                فريق الحيتان (A) 🐬
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeam('team_b')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  selectedTeam === 'team_b'
                    ? 'bg-arena-red text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                فريق الوحوش (B) 🦁
              </button>
            </div>

            <button
              onClick={handleSaveProfile}
              className="btn-arcade-yellow px-5 py-2.5 rounded-xl text-sm font-black whitespace-nowrap w-full sm:w-auto cursor-pointer"
            >
              تثبيت الاختيار ✨
            </button>
          </div>
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-arena-card border-2 border-arena-cyan rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-bounce-short">
            <h3 className="text-lg font-black text-white text-center">ادخل كود الساحة 📱</h3>
            <p className="text-xs text-gray-300 text-center">
              اطلب كود الغرفة المكون من 6 خانات (مثال: QZ-7842) وادخل فوراً!
            </p>
            <input
              type="text"
              placeholder="مثال: QZ-7842"
              maxLength={10}
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              className="w-full text-center text-2xl font-black font-mono tracking-widest py-3 rounded-xl bg-arena-darker border-2 border-arena-cyan text-arena-cyan uppercase outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleJoinRoomClick}
                className="btn-arcade-green flex-1 py-2.5 rounded-xl font-black text-sm cursor-pointer"
              >
                دخول الساحة
              </button>
              <button
                onClick={() => setShowJoinModal(false)}
                className="btn-arcade-dark px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

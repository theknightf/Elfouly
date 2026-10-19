import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CHARACTERS, TEAMS } from '../data/characters';
import { Shield, Zap, Sparkles, Trophy, Users, Play, ArrowRight, Smartphone, CheckCircle, Flame } from 'lucide-react';

export default function Lobby() {
  const {
    roomState,
    setRoomState,
    changeRound,
    socket,
    isConnected,
    currentPlayer,
    setCurrentPlayer,
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

  const handleSelectCharacter = (char) => {
    setSelectedCharId(char.id);
  };

  const handleSaveProfile = () => {
    const name = playerNameInput.trim() || selectedChar.name;
    const playerObj = {
      id: socket?.id || 'local_user',
      name: name,
      character: selectedChar,
      team: selectedTeam,
      isHost: true,
      scoreContribution: 0
    };
    setCurrentPlayer(playerObj);

    if (socket && isConnected && roomState.code) {
      socket.emit('update_player_profile', {
        roomCode: roomState.code,
        characterId: selectedChar.id,
        team: selectedTeam
      });
    } else {
      // Local update
      setRoomState(prev => {
        const existingIdx = prev.players.findIndex(p => p.id === playerObj.id);
        let updatedPlayers = [...prev.players];
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

  const handleStartGame = () => {
    changeRound('round1');
  };

  const handleCreateRoom = () => {
    if (socket && isConnected) {
      socket.emit('create_room', {
        playerName: playerNameInput.trim() || selectedChar.name,
        characterId: selectedChar.id
      });
    } else {
      showToast('أنت بالوضع المباشر', 'يمكنك بدء اللعب فوراً بدون سيرفر!');
    }
  };

  const handleJoinRoom = () => {
    if (!joinCodeInput.trim()) {
      showToast('تنبيه', 'من فضلك اكتب كود الغرفة');
      return;
    }
    if (socket && isConnected) {
      socket.emit('join_room', {
        roomCode: joinCodeInput.trim(),
        playerName: playerNameInput.trim() || selectedChar.name,
        characterId: selectedChar.id,
        teamPreference: selectedTeam
      });
      setShowJoinModal(false);
    } else {
      showToast('تنبيه السيرفر', 'تأكد من تشغيل سيرفر اللعبة للانضمام عبر الشبكة');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 py-6 space-y-8 animate-fadeIn">
      
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-arena-darker via-arena-card to-arena-darker border-2 border-arena-cyan/40 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-arena-cyan/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-arena-red/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="text-center lg:text-right space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arena-yellow/20 border border-arena-yellow text-arena-yellow text-xs font-black">
              <Flame className="w-4 h-4 animate-bounce" />
              <span>لعبة السهرات والتحديات التافهة والمحترفة!</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              ساحة الكويز <span className="text-arena-cyan">روش ومصري</span> 🎮
            </h1>
            
            <p className="text-gray-300 text-sm md:text-base leading-relaxed">
              اختر شخصيتك، كوّن فريقك، واستعد لـ 3 جولات طحن: بنك الستريك "1 تو"، كلمة السر في الودن "اديني في سري"، وركلات ترجيح "حط في قريبي" مع مزاد مين يزوّد!
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={handleStartGame}
                className="btn-arcade-green px-6 py-3 rounded-2xl text-base font-black flex items-center gap-2 shadow-lg hover:brightness-110 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>ابدأ الماتش الآن (انطلق!)</span>
              </button>

              <button
                onClick={() => setShowJoinModal(true)}
                className="btn-arcade-cyan px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>دخول بكود الغرفة</span>
              </button>
            </div>
          </div>

          {/* Quick Room Share Box */}
          <div className="bg-arena-darker/90 p-5 rounded-2xl border border-white/10 text-center space-y-3 min-w-[280px] shadow-xl">
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">كود الساحة الحالي</div>
            <div className="text-4xl font-black font-mono text-arena-yellow tracking-widest bg-black/40 py-2 rounded-xl border border-arena-yellow/30">
              {roomState.code || 'ARENA'}
            </div>
            <div className="text-[11px] text-gray-400">
              يقدر أي لاعب يدخل من موبايله بنفس الكود عبر متصفح الشبكة!
            </div>
          </div>
        </div>
      </div>

      {/* Character Roster Grid */}
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
              className="btn-arcade-yellow px-5 py-2.5 rounded-xl text-sm font-black whitespace-nowrap w-full sm:w-auto"
            >
              تثبيت الاختيار ✨
            </button>
          </div>
        </div>
      </div>

      {/* Active Room Roster Preview */}
      <div className="bg-arena-darker/80 rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-arena-cyan" />
            <h3 className="font-black text-white text-base">
              اللاعبون المتواجدون بالساحة ({players.length})
            </h3>
          </div>
          <span className="text-xs text-gray-400">جاهزون لانطلاق صافرة الحكم!</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {players.map((p, idx) => (
            <div
              key={p.id || idx}
              className="bg-arena-card/80 p-3 rounded-xl border border-white/10 text-center space-y-1 relative"
            >
              <div className="text-2xl">{p.character?.avatar || '⚡'}</div>
              <div className="text-xs font-black text-white truncate">{p.name}</div>
              <div className="text-[10px] text-gray-400 truncate">{p.character?.name}</div>
              <div
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block ${
                  p.team === 'team_a' ? 'bg-arena-cyan/20 text-arena-cyan' : 'bg-arena-red/20 text-arena-red'
                }`}
              >
                {p.team === 'team_a' ? 'الحيتان A' : 'الوحوش B'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-arena-card border-2 border-arena-cyan rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-bounce-short">
            <h3 className="text-lg font-black text-white text-center">ادخل كود الساحة 📱</h3>
            <p className="text-xs text-gray-300 text-center">
              اطلب الكود المكون من 4 حروف من صاحب الغرفة وادخل فوراً!
            </p>
            <input
              type="text"
              placeholder="مثال: ARENA"
              maxLength={6}
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              className="w-full text-center text-2xl font-black font-mono tracking-widest py-3 rounded-xl bg-arena-darker border-2 border-arena-cyan text-arena-cyan uppercase outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleJoinRoom}
                className="btn-arcade-green flex-1 py-2.5 rounded-xl font-black text-sm"
              >
                دخول الساحة
              </button>
              <button
                onClick={() => setShowJoinModal(false)}
                className="btn-arcade-dark px-4 py-2.5 rounded-xl font-bold text-sm"
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

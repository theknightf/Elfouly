import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { CHARACTERS, TEAM_PRESETS } from '../data/characters';
import HostTeamManager from './HostTeamManager';
import CharacterEditor from './CharacterEditor';
import { MAX_SPECIALTIES } from '../game/characterBuilder';
import {
  CheckCircle,
  Clock,
  Copy,
  Crown,
  Lock,
  Play,
  Share2,
  Sparkles,
  Users,
  Zap,
  Loader2,
  WifiOff,
  AlertTriangle,
  Edit3,
  LogOut
} from 'lucide-react';

export default function Lobby() {
  const {
    roomState,
    roomCode,
    currentPlayer,
    socket,
    isConnected,
    connectionStatus,
    connectionStatusMessage,
    reconnect,
    isHost,
    leaveRoom,
    countdown,
    startMatchCountdown,
    cancelMatchCountdown,
    updatePlayerProfile,
    updateTeamNames,
    actionError,
    showToast
  } = useGame();

  const players = roomState?.players || [];
  const currentCode = roomState?.code || roomCode || '';
  const me = players.find(player => player.id === socket?.id) || currentPlayer;

  const [selectedCharId, setSelectedCharId] = useState(me?.character?.id || '');
  const [selectedTeam, setSelectedTeam] = useState(me?.team || '');

  // Draft of "the categories I know" and "my own character" (saved with the button below).
  const DEFAULT_CATCHPHRASE = 'أنا هنا عشان أكسب!';
  const defaultCustom = { name: '', avatar: '🦅', color: '#4CC9F0', powerId: 'shield', catchphrase: '' };
  const customFromCharacter = (character) => (character?.isCustom
    ? {
        name: character.name,
        avatar: character.avatar,
        color: character.color,
        powerId: character.powerId,
        catchphrase: character.catchphrase === DEFAULT_CATCHPHRASE ? '' : (character.catchphrase || '')
      }
    : defaultCustom);
  const [isCustom, setIsCustom] = useState(Boolean(me?.character?.isCustom));
  const [specialties, setSpecialties] = useState(me?.character?.attributes || []);
  const [custom, setCustom] = useState(customFromCharacter(me?.character));
  const savedCharacterKey = JSON.stringify([me?.character?.id, me?.character?.attributes, me?.character?.name, me?.character?.powerId]);
  useEffect(() => {
    setIsCustom(Boolean(me?.character?.isCustom));
    setSpecialties(me?.character?.attributes || []);
    setCustom(customFromCharacter(me?.character));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCharacterKey]);

  useEffect(() => {
    if (me?.character?.id) setSelectedCharId(me.character.id);
  }, [me?.character?.id]);

  useEffect(() => {
    if (me?.team) setSelectedTeam(me.team);
  }, [me?.team]);

  const teamACount = players.filter(player => player.team === 'team_a').length;
  const teamBCount = players.filter(player => player.team === 'team_b').length;
  const isUserHost = Boolean(isHost || me?.isHost);
  const selectedChar = CHARACTERS.find(character => character.id === selectedCharId) || CHARACTERS[0];

  const isTeamFull = (team) => {
    if (me?.team === team) return false;
    return (team === 'team_a' ? teamACount : teamBCount) >= 2;
  };

  const savedSignature = me?.character
    ? JSON.stringify(me.character.isCustom
      ? ['c', me.character.name, me.character.avatar, me.character.color, me.character.powerId,
        me.character.catchphrase === DEFAULT_CATCHPHRASE ? '' : (me.character.catchphrase || ''), me.character.attributes]
      : ['b', me.character.id, me.character.attributes])
    : '';
  const draftSignature = JSON.stringify(isCustom
    ? ['c', custom.name.trim(), custom.avatar, custom.color, custom.powerId, custom.catchphrase.trim(), specialties]
    : ['b', selectedCharId, specialties]);
  const isDirty = draftSignature !== savedSignature || selectedTeam !== me?.team;
  const draftValid = specialties.length >= 1 && (!isCustom || (custom.name.trim().length > 0 && Boolean(custom.powerId)));

  const canSave = isConnected && isDirty && draftValid && Boolean(selectedTeam);

  const toggleSpecialty = (id) => setSpecialties(previous => (
    previous.includes(id)
      ? previous.filter(item => item !== id)
      : previous.length >= MAX_SPECIALTIES ? previous : [...previous, id]
  ));
  const allHumansConnected = players.every(player => player.isBot || player.connected !== false);
  const canStart = isConnected && players.length === 4 && teamACount === 2 && teamBCount === 2 && allHumansConnected;

  const handleSelectCharacter = (character) => {
    setSelectedCharId(character.id);
    setIsCustom(false);
    setSpecialties([...character.attributes]);
  };

  const handleSaveProfile = () => {
    if (!canSave) return;
    const extras = isCustom
      ? { customCharacter: { ...custom, name: custom.name.trim(), catchphrase: custom.catchphrase.trim(), specialties } }
      : { specialties };
    updatePlayerProfile(isCustom ? undefined : selectedCharId, selectedTeam, extras);
  };

  const handleCopyCode = () => {
    if (!currentCode) return;
    navigator.clipboard?.writeText(currentCode);
    showToast('تم نسخ الكود! 📋', `كود الغرفة: ${currentCode}`);
  };

  const handleShareLink = () => {
    if (!currentCode) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(currentCode)}`;
    if (navigator.share) {
      navigator.share({
        title: 'كنز الفولي (Kenz Elfoly)',
        text: `انضم إلى سهرة كنز الفولي بكود: ${currentCode}`,
        url
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      showToast('تم نسخ اللينك! 🔗', 'ابعته لأصحابك عشان يدخلوا الغرفة على طول.');
    }
  };

  const slots = Array.from({ length: 4 }, (_, index) => players[index] || null);

  const characterError = actionError?.field === 'character' ? actionError.message : null;
  const teamError = actionError?.field === 'team' ? actionError.message : null;
  const generalError = actionError && !['character', 'team'].includes(actionError.field)
    ? actionError.message
    : null;

  return (
    <div className="max-w-6xl mx-auto px-3 py-5 md:py-8 space-y-6 animate-fadeIn">
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

            {isHost && countdown > 0 && (
              <button
                type="button"
                onClick={cancelMatchCountdown}
                className="mt-2 rounded-xl border border-white/20 px-5 py-2 text-sm font-black text-gray-200 hover:border-arena-red hover:text-arena-red transition-colors cursor-pointer"
              >
                إلغاء البدء
              </button>
            )}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold text-center ${
          connectionStatus === 'failed' || connectionStatus === 'misconfigured'
            ? 'border-arena-red/50 bg-arena-red/10 text-arena-red'
            : 'border-arena-yellow/40 bg-arena-yellow/10 text-arena-yellow'
        }`}>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connecting' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
            {connectionStatus === 'waking_up' && <Clock className="w-4 h-4 animate-pulse shrink-0" />}
            {connectionStatus === 'failed' && <WifiOff className="w-4 h-4 shrink-0" />}
            {connectionStatus === 'misconfigured' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{connectionStatusMessage}</span>
          </div>
          {connectionStatus === 'failed' && (
            <button
              type="button"
              onClick={reconnect}
              className="mt-1 sm:mt-0 px-3 py-1 rounded-xl bg-arena-red/20 hover:bg-arena-red/40 text-white text-xs font-black border border-arena-red/50 transition-colors cursor-pointer"
            >
              حاول تاني
            </button>
          )}
        </div>
      )}

      {/* Room header: slot counter + code copy/share */}
      <div className="rounded-3xl bg-gradient-to-r from-arena-darker via-arena-card to-arena-darker border-2 border-arena-cyan/40 p-4 md:p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="text-center lg:text-right space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arena-yellow/15 border border-arena-yellow/50 text-arena-yellow text-xs font-black">
              <Sparkles className="w-4 h-4" />
              <span>صالة الانتظار (Lobby)</span>
            </div>

            <h1 className="text-2xl md:text-4xl font-black text-white">
              كنز الفولي <span className="text-arena-cyan">(Kenz Elfoly)</span> 🎮
            </h1>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-arena-cyan/15 border border-arena-cyan/40 text-arena-cyan text-xs font-black">
                <Users className="w-3.5 h-3.5" />
                <span>اللاعبين: {players.length}/4</span>
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black ${
                teamACount === 2 && teamBCount === 2
                  ? 'bg-arena-green/15 border-arena-green/40 text-arena-green'
                  : 'bg-arena-yellow/10 border-arena-yellow/30 text-arena-yellow'
              }`}>
                <ShieldBars teamACount={teamACount} teamBCount={teamBCount} />
              </span>
            </div>
          </div>

          <div className="bg-arena-darker/95 p-4 rounded-3xl border-2 border-arena-yellow/40 text-center space-y-3 w-full lg:w-auto lg:min-w-[320px] shadow-2xl">
            <div className="text-[11px] text-arena-yellow font-black uppercase tracking-wider">
              كود الغرفة (Room ID)
            </div>

            <div className="text-3xl md:text-5xl font-black font-mono text-arena-yellow tracking-widest bg-black/60 py-2.5 rounded-2xl border border-arena-yellow/50 shadow-inner select-all">
              {currentCode}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="btn-arcade-dark py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:border-arena-cyan"
              >
                <Copy className="w-3.5 h-3.5 text-arena-cyan" />
                <span>نسخ الكود</span>
              </button>
              <button
                type="button"
                onClick={handleShareLink}
                className="btn-arcade-cyan py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة اللينك</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('تخرج من الغرفة؟')) leaveRoom();
              }}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer text-gray-300 border border-white/10 hover:border-arena-red hover:text-arena-red transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج من الغرفة</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Player slots */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {slots.map((player, index) => {
          if (!player) {
            return (
              <div
                key={`empty-${index}`}
                className="rounded-2xl border-2 border-dashed border-white/15 bg-arena-card/30 p-4 min-h-[140px] flex flex-col items-center justify-center gap-2 text-center"
              >
                <div className="text-2xl text-gray-600 animate-pulse">⏳</div>
                <div className="text-xs font-black text-gray-400">خانة #{index + 1}</div>
                <div className="text-[10px] text-gray-500">مستنية لاعب ينضم بالكود</div>
              </div>
            );
          }

          const character = player.character || CHARACTERS[0];
          const isOffline = player.connected === false && !player.isBot;

          return (
            <div
              key={player.id || `player-${index}`}
              className={`rounded-2xl border-2 bg-arena-card p-4 min-h-[140px] space-y-2 ${
                player.isHost ? 'border-arena-yellow/70' : 'border-arena-cyan/30'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                {player.isHost ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-arena-yellow bg-arena-yellow/10 border border-arena-yellow/30 px-2 py-0.5 rounded-full">
                    <Crown className="w-3 h-3 fill-current" />
                    <span>هوست</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-500">#{index + 1}</span>
                )}
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  isOffline
                    ? 'bg-arena-red/15 text-arena-red border border-arena-red/30'
                    : 'bg-arena-green/15 text-arena-green border border-arena-green/30'
                }`}>
                  {isOffline ? 'بنستناه يرجع' : 'متصل'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border shrink-0"
                  style={{ backgroundColor: `${character.color}20`, borderColor: character.color }}
                >
                  {character.avatar}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-xs font-black text-white truncate">{player.name}</div>
                  <div className="text-[10px] font-bold truncate" style={{ color: character.color }}>
                    {character.name}
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-black text-center rounded-lg py-1 border border-white/10 bg-arena-darker/80">
                {player.team === 'team_a'
                  ? (roomState?.teams?.team_a?.name || 'فريق A 🐬')
                  : (roomState?.teams?.team_b?.name || 'فريق B 🦁')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Host Team Management Panel (Host Only) */}
      <HostTeamManager />

      {/* Character + team selection */}
      <div className="rounded-3xl bg-arena-card border-2 border-arena-cyan/30 p-4 md:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-arena-yellow" />
              <span>اختار شخصيتك وفريقك</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              يمكن أكتر من لاعب يختاروا نفس الشخصية. كل فريق حد أقصى لاعبين (2/2).
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-arena-darker border border-white/10 px-3 py-2">
            <span className="text-[10px] text-gray-400 font-bold">اختيارك:</span>
            <span className="text-xs font-black" style={{ color: isCustom ? custom.color : selectedChar.color }}>
              {isCustom ? custom.avatar : selectedChar.avatar} {isCustom ? (custom.name || 'شخصيتك الجديدة') : selectedChar.name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {CHARACTERS.map((char) => {
            const isSelected = selectedCharId === char.id;

            return (
              <button
                key={char.id}
                type="button"
                onClick={() => handleSelectCharacter(char)}
                className={`relative text-right rounded-2xl p-3 border-2 transition-all duration-200 ${
                  isSelected
                    ? 'bg-arena-card shadow-xl scale-[1.01] cursor-pointer'
                    : 'bg-arena-card/60 border-white/10 hover:border-white/30 cursor-pointer'
                }`}
                style={{ borderColor: isSelected ? char.color : undefined }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border shrink-0"
                    style={{ backgroundColor: `${char.color}20`, borderColor: char.color }}
                  >
                    {char.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-white truncate">{char.name}</div>
                    <div className="text-[10px] text-arena-yellow font-bold truncate">{char.badge}</div>
                  </div>
                  {isSelected && (
                    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: char.color }} />
                  )}
                </div>

                <p className="mt-2 text-[10px] text-gray-400 line-clamp-2 leading-relaxed">
                  {char.catchphrase}
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {char.attributesDisplay.slice(0, 3).map((attribute, index) => (
                    <span
                      key={`${char.id}-${index}`}
                      className="text-[9px] font-semibold bg-arena-darker px-1.5 py-0.5 rounded border border-white/10 text-gray-300"
                    >
                      {attribute}
                    </span>
                  ))}
                </div>

              </button>
            );
          })}
        </div>

        <CharacterEditor
          specialties={specialties}
          onToggleSpecialty={toggleSpecialty}
          isCustom={isCustom}
          onToggleCustom={() => setIsCustom(previous => !previous)}
          custom={custom}
          onCustomChange={patch => setCustom(previous => ({ ...previous, ...patch }))}
        />

        {!draftValid && (
          <p className="text-xs font-bold text-arena-yellow">
            {specialties.length < 1 ? 'اختار مجال واحد على الأقل (لحد 3).' : 'اكتب اسم لشخصيتك واختار قدرتها.'}
          </p>
        )}

        {characterError && (
          <p className="text-xs font-bold text-arena-red">{characterError}</p>
        )}

        {/* Dynamic Team Presets & Custom Selection */}
        <div className="bg-arena-darker/60 rounded-2xl p-3 border border-white/10 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold text-gray-300">
            <span className="flex items-center gap-1.5 text-arena-yellow font-black">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تخصيص ثنائي الفرق (اختر اسماً جاهزاً للمباراة):</span>
            </span>
            <span className="text-[10px] text-gray-400">انقر للتطبيق المباشر ⚡</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TEAM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  updateTeamNames({ team_a: preset.nameA, team_b: preset.nameB });
                  showToast('تم تحديث أسماء الفرق! 🏷️', `${preset.nameA} ضد ${preset.nameB}`);
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-surface-container border border-white/10 hover:border-arena-cyan hover:text-arena-cyan transition-all cursor-pointer text-gray-200"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <button
              type="button"
              onClick={() => setSelectedTeam('team_a')}
              disabled={isTeamFull('team_a')}
              className={`flex-1 rounded-2xl border-2 px-3 py-3 text-sm font-black transition-all ${
                selectedTeam === 'team_a'
                  ? 'bg-arena-cyan text-arena-darker border-arena-cyan'
                  : isTeamFull('team_a')
                    ? 'bg-arena-darker/40 text-gray-500 border-white/5 cursor-not-allowed'
                    : 'bg-arena-darker text-arena-cyan border-arena-cyan/30 hover:border-arena-cyan'
              }`}
            >
              {roomState?.teams?.team_a?.name || 'فريق الحيتان (A) 🐬'}
              <span className="block text-[10px] mt-0.5 opacity-80">
                {teamACount}/2 {isTeamFull('team_a') ? '— مكتمل' : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTeam('team_b')}
              disabled={isTeamFull('team_b')}
              className={`flex-1 rounded-2xl border-2 px-3 py-3 text-sm font-black transition-all ${
                selectedTeam === 'team_b'
                  ? 'bg-arena-red text-white border-arena-red'
                  : isTeamFull('team_b')
                    ? 'bg-arena-darker/40 text-gray-500 border-white/5 cursor-not-allowed'
                    : 'bg-arena-darker text-arena-red border-arena-red/30 hover:border-arena-red'
              }`}
            >
              {roomState?.teams?.team_b?.name || 'فريق الوحوش (B) 🦁'}
              <span className="block text-[10px] mt-0.5 opacity-80">
                {teamBCount}/2 {isTeamFull('team_b') ? '— مكتمل' : ''}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={!canSave}
            className="btn-arcade-yellow px-5 py-3 rounded-2xl text-sm font-black whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
          >
            {isDirty ? 'تثبيت الاختيار ✨' : 'اختياراتك متثبتة'}
          </button>
        </div>

        {teamError && (
          <p className="text-xs font-bold text-arena-red">{teamError}</p>
        )}

        {generalError && (
          <div className="rounded-xl border border-arena-red/40 bg-arena-red/10 px-3 py-2 text-xs font-bold text-arena-red">
            {generalError}
          </div>
        )}
      </div>

      {/* Start match: host only */}
      <div className="rounded-3xl bg-arena-darker/90 border-2 border-white/10 p-4 md:p-6 text-center shadow-2xl">
        {isUserHost ? (
          <div className="max-w-xl mx-auto space-y-2">
            <button
              type="button"
              onClick={startMatchCountdown}
              disabled={!canStart}
              className={`w-full py-4 rounded-2xl text-base md:text-lg font-black flex items-center justify-center gap-2 ${
                canStart
                  ? 'btn-arcade-green animate-pulse cursor-pointer'
                  : 'bg-gray-800 text-gray-500 border border-white/10 cursor-not-allowed'
              }`}
            >
              {canStart ? <Play className="w-6 h-6 fill-current" /> : <Lock className="w-5 h-5" />}
              <span>
                {canStart
                  ? 'ابدأ الماتش! 🚀'
                  : `الانطلاق مقفول (${players.length}/4 — ${teamACount} ضد ${teamBCount})`}
              </span>
            </button>
            <p className="text-[11px] text-gray-400">
              لازم 4 لاعبين، توزيع 2 ضد 2، وكل اللاعبين متصلين. العد التنازلي 3 ثوانٍ لكل الأجهزة.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm font-black text-arena-cyan animate-pulse">
            <Clock className="w-5 h-5" />
            <span>في انتظار الهوست يبدأ الماتش…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ShieldBars({ teamACount, teamBCount }) {
  const isReady = teamACount === 2 && teamBCount === 2;
  return (
    <>
      {isReady ? <Zap className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
      <span>{isReady ? 'التوزيع جاهز 2 ضد 2' : `التوزيع: ${teamACount} ضد ${teamBCount}`}</span>
    </>
  );
}

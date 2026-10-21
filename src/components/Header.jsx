import React from 'react';
import { useGame } from '../context/GameContext';
import { Volume2, VolumeX, Wifi, WifiOff, Tv, Smartphone, Copy, Check, Loader2, Clock, AlertTriangle } from 'lucide-react';

export default function Header() {
  const {
    roomState,
    connectionStatus,
    reconnect,
    isAudioMuted,
    setIsAudioMuted,
    activeTabMode,
    setActiveTabMode,
    showToast
  } = useGame();

  const [copied, setCopied] = React.useState(false);

  const currentCode = roomState?.code || '';
  const teamA = roomState?.teams?.team_a || { name: 'فريق الحيتان', score: 0, bank: 0 };
  const teamB = roomState?.teams?.team_b || { name: 'فريق الوحوش', score: 0, bank: 0 };

  const getRoundLabel = (status) => {
    switch (status) {
      case 'lobby': return 'صالة الانتظار والتشكيلة 🎮';
      case 'round1': return 'جولة 1: 1 تو (Bank Mode) 🏦';
      case 'round2': return 'جولة 2: اديني في سري (Password) 🤫';
      case 'round3': return 'جولة 3: حط في قريبي (Penalties) ⚽';
      case 'round4': return 'جولة 4: مين يزوّد؟ (Auction) 🏷️';
      case 'game_over': return 'تتويج بطل الساحة 👑';
      default: return status;
    }
  };

  const copyRoomCode = () => {
    if (!currentCode) return;
    navigator.clipboard?.writeText(currentCode);
    setCopied(true);
    showToast('تم نسخ الكود!', `شارك الكود ${currentCode} مع أصحابك للدخول من الموبايل!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-50 bg-arena-card/95 backdrop-blur-md border-b-2 border-arena-cyan/30 px-3 py-2 md:px-6 md:py-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Round Badge */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-arena-cyan to-arena-purple flex items-center justify-center font-black text-arena-darker text-xl shadow-lg ring-2 ring-arena-cyan/50">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg md:text-xl tracking-tight text-white flex items-center gap-1.5">
                  <span className="text-arena-cyan">KENZ</span>
                  <span className="text-arena-yellow">ELFOLY</span>
                  <span className="text-xs bg-arena-red/90 text-white px-2 py-0.5 rounded-full font-bold">كنز الفولي</span>
                </h1>
              </div>
              <div className="text-xs text-gray-300 font-semibold flex items-center gap-1">
                <span>{getRoundLabel(roomState?.status || 'lobby')}</span>
              </div>
            </div>
          </div>

          {/* Quick Room Code Pill */}
          {currentCode && (
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-arena-darker/90 border border-arena-cyan/40 hover:border-arena-cyan text-arena-cyan text-xs font-mono font-bold transition-all"
              title="انسخ كود الغرفة"
            >
              <span className="text-gray-400">غرفة:</span>
              <span className="text-sm font-black text-white">{currentCode}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-arena-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Live Head-to-Head Arena Scoreboard */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 w-full md:w-auto">
          {/* Team A */}
          <div className="flex items-center gap-2 bg-arena-darker/90 px-3 py-1.5 rounded-xl border-2 border-arena-cyan/60 shadow-lg min-w-[130px] justify-between">
            <div className="text-right">
              <div className="text-[10px] text-arena-cyan font-bold tracking-wider truncate max-w-[80px]">
                {teamA.name.split('(')[0]}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span>خزنة:</span>
                <span className="text-arena-yellow font-bold">{teamA.bank || 0}</span>
              </div>
            </div>
            <div className="text-lg md:text-xl font-black text-arena-cyan font-mono">
              {teamA.score}
            </div>
          </div>

          {/* VS Divider */}
          <div className="font-black text-arena-yellow text-sm italic px-1 animate-pulse">
            VS
          </div>

          {/* Team B */}
          <div className="flex items-center gap-2 bg-arena-darker/90 px-3 py-1.5 rounded-xl border-2 border-arena-red/60 shadow-lg min-w-[130px] justify-between">
            <div className="text-lg md:text-xl font-black text-arena-red font-mono">
              {teamB.score}
            </div>
            <div className="text-left">
              <div className="text-[10px] text-arena-red font-bold tracking-wider truncate max-w-[80px]">
                {teamB.name.split('(')[0]}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span>خزنة:</span>
                <span className="text-arena-yellow font-bold">{teamB.bank || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & View Mode */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* View Mode Toggle: TV Arena vs Mobile Controller */}
          <div className="flex items-center bg-arena-darker/90 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTabMode('arena')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTabMode === 'arena'
                  ? 'bg-arena-cyan text-arena-darker font-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>شاشة الساحة</span>
            </button>
            <button
              onClick={() => setActiveTabMode('mobile_controller')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTabMode === 'mobile_controller'
                  ? 'bg-arena-yellow text-arena-darker font-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تحكم الموبايل</span>
            </button>
          </div>

          {/* Sound Mute Toggle */}
          <button
            onClick={setIsAudioMuted}
            className="p-2 rounded-xl bg-arena-darker border border-white/10 hover:border-arena-cyan text-gray-300 hover:text-white transition-all"
            title={isAudioMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم الصوت'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-arena-red" /> : <Volume2 className="w-4 h-4 text-arena-green" />}
          </button>

          {/* Connection Status Indicator */}
          {connectionStatus === 'connected' && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
              title="متصل بالسيرفر الحي"
            >
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
              <span>لايف</span>
            </div>
          )}

          {connectionStatus === 'connecting' && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
              title="بنتصل بالسيرفر…"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>بنتصل بالسيرفر…</span>
            </div>
          )}

          {connectionStatus === 'waking_up' && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border bg-amber-950/60 border-amber-500/40 text-amber-300"
              title="السيرفر بيصحى، استنى لحد دقيقة"
            >
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>السيرفر بيصحى، استنى لحد دقيقة</span>
            </div>
          )}

          {connectionStatus === 'failed' && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border bg-rose-950/70 border-rose-500/50 text-rose-300"
              title="مش قادرين نوصل للسيرفر"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>مش قادرين نوصل للسيرفر</span>
              <button
                type="button"
                onClick={reconnect}
                className="mr-1 px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-white text-[10px] font-black border border-rose-500/40 transition-colors cursor-pointer"
              >
                حاول تاني
              </button>
            </div>
          )}

          {connectionStatus === 'misconfigured' && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border bg-red-950/70 border-red-500/50 text-red-300"
              title="السيرفر مش متظبط. صاحب اللعبة لازم يضبط VITE_SERVER_URL"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="max-w-[200px] truncate sm:max-w-none">السيرفر مش متظبط. صاحب اللعبة لازم يضبط VITE_SERVER_URL</span>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

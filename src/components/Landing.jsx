import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { CHARACTERS } from '../data/characters';
import { sounds } from '../utils/soundEffects';
import {
  ClipboardPaste,
  Crown,
  Loader2,
  LogIn,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  ScrollText,
  Shield,
  HelpCircle,
  Play
} from 'lucide-react';

const ROOM_BODY_LENGTH = 6;
const PIXEL_ART_BG = "https://lh3.googleusercontent.com/aida-public/AB6AXuAcaQl_g0dkRzM5iLmCvCWVZwoMUSS--Mogk7_MIAwTSfG329zGrLNqE1icHdfA_wfTm2avdfIXHh9VGGUFVn0XILo-_FtM92pGnBj1csJ3sKjh-_pWYwWv1LhK80cqIQGdP7DKfz7AO6-Q31QwR88SiRD4CkHU89iw_W3Z_CoJejfZ_VRTuvGGb4nmTu2AMUjTw4vCTsyAUOlCLjK0lelBue4iFDnE5INCS5lTfI7fhWKD_LKRJG3uyzM3gjZzMuIufvY";

function toRoomBody(value) {
  let raw = String(value || '').replace(/\D/g, '');
  return raw.slice(0, ROOM_BODY_LENGTH);
}

export default function Landing() {
  const {
    createRoom,
    joinRoom,
    isConnected,
    connectionStatus,
    connectionStatusMessage,
    reconnect,
    actionError,
    clearActionError
  } = useGame();

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [formError, setFormError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'join' | 'info' | 'characters' | null
  const [isCreating, setIsCreating] = useState(false);
  const [selectedHero, setSelectedHero] = useState(CHARACTERS[0].id);

  const nameInputRef = useRef(null);
  const joinButtonRef = useRef(null);
  const codeInputRef = useRef(null);

  useEffect(() => {
    try {
      const roomParam = new URLSearchParams(window.location.search).get('room');
      if (roomParam) {
        setJoinCode(toRoomBody(roomParam));
        setActiveModal('join');
        setTimeout(() => joinButtonRef.current?.focus(), 150);
      }
    } catch (e) {
      // ignore malformed URLs
    }
  }, []);

  useEffect(() => {
    if (actionError) {
      setIsCreating(false);
    }
  }, [actionError]);

  const fieldError = (field) => {
    if (formError?.field === field) return formError.message;
    if (actionError?.field === field) return actionError.message;
    return null;
  };

  const generalError = actionError && !['playerName', 'roomCode'].includes(actionError.field)
    ? actionError.message
    : null;

  const validateName = (nameToValidate) => {
    const candidate = typeof nameToValidate === 'string' ? nameToValidate : playerName;
    const cleanName = candidate.trim();
    if (!cleanName) {
      setFormError({ field: 'playerName', message: 'اكتب اسمك الأول يا كابتن.. الاسم مطلوب!' });
      return null;
    }
    return cleanName.slice(0, 20);
  };

  const handleCreate = (nameOverride) => {
    const rawCandidate = typeof nameOverride === 'string' ? nameOverride : playerName;
    const trimmed = rawCandidate.trim();
    const heroName = CHARACTERS.find(c => c.id === selectedHero)?.name.split(' ')[0] || 'فولي';
    const cleanName = (trimmed || `كابتن ${heroName} 🦁`).slice(0, 20);

    setFormError(null);
    clearActionError();
    sounds?.playTap?.();
    setIsCreating(true);

    // Failsafe timeout to prevent blocked UI state
    setTimeout(() => {
      setIsCreating(false);
    }, 5000);

    createRoom(cleanName, selectedHero);
  };

  const handleJoin = () => {
    const cleanName = validateName();
    if (!cleanName) return;

    if (joinCode.length !== ROOM_BODY_LENGTH) {
      setFormError({ field: 'roomCode', message: 'كود الغرفة لازم يكون 6 خانات بالظبط.' });
      codeInputRef.current?.focus();
      return;
    }

    setFormError(null);
    clearActionError();
    sounds?.playTap?.();
    joinRoom(`QZ-${joinCode}`, cleanName, selectedHero);
  };

  const handlePasteCode = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const body = toRoomBody(clipboardText);
      if (body) {
        setJoinCode(body);
        setFormError(null);
        clearActionError();
        joinButtonRef.current?.focus();
      } else {
        setFormError({ field: 'roomCode', message: 'مفيش كود واضح في الكليبورد. جرب تلصق يدوياً.' });
        codeInputRef.current?.focus();
      }
    } catch (e) {
      setFormError({ field: 'roomCode', message: 'مقدرتش أقرأ من الكليبورد. الصق الكود يدوياً.' });
      codeInputRef.current?.focus();
    }
  };

  const handleCodeChange = (event) => {
    const digits = event.target.value.replace(/\D/g, '');
    setJoinCode(digits.slice(0, ROOM_BODY_LENGTH));
    setFormError(null);
    clearActionError();
  };

  const handleNameChange = (event) => {
    setPlayerName(event.target.value.slice(0, 20));
    setFormError(null);
    clearActionError();
  };

  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
    sounds?.playTap?.();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 md:p-6 font-arabic selection:bg-arena-yellow selection:text-black">
      
      {/* ========================================================================= */}
      {/* 16-BIT RETRO EGYPTIAN ARCADE CABINET FRAME (STITCH SCREEN 4)              */}
      {/* ========================================================================= */}
      <div className="relative w-full max-w-4xl min-h-[640px] md:min-h-[720px] rounded-[24px] md:rounded-[32px] overflow-hidden border-[4px] md:border-[6px] border-[#090614] shadow-[0_16px_48px_rgba(0,0,0,0.9)] bg-slate-950 flex flex-col justify-between">
        
        {/* Authentic Pixel Art Recreation Scene Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            alt="Minya Lotus University and El Ekhsas Roundabout pixel art scene"
            className="w-full h-full object-cover object-center pixelated-bg opacity-75 md:opacity-85 scale-[1.02]"
            src={PIXEL_ART_BG}
          />
          {/* Subtle scanline and atmospheric vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/75" />
          <div className="absolute inset-0 pixel-grid-pattern opacity-30 pointer-events-none" />
        </div>

        {/* Top Header Bar */}
        <header className="relative z-10 w-full pt-4 px-4 sm:px-6 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleSound}
              aria-label="تبديل الصوت"
              className="w-10 h-10 rounded-xl bg-black/80 border-2 border-amber-500/80 text-amber-300 flex items-center justify-center backdrop-blur-md active:scale-95 shadow-md transition-transform cursor-pointer hover:border-amber-400"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-amber-300" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
            </button>
            <div className="flex flex-col text-right">
              <span className="font-pixel text-[9px] text-arena-cyan tracking-wider">KENZ ELFOLY</span>
              <span className="text-[11px] font-bold text-amber-200">سهرة الصعيد 🕹️</span>
            </div>
          </div>

          <div className="bg-black/80 border-2 border-amber-400/80 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-200 tracking-wider flex items-center gap-2 shadow-lg backdrop-blur-md">
            <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-rubik font-black text-xs sm:text-sm">عروس الصعيد - ساحة المنيا</span>
          </div>
        </header>

        {/* Hero Title & Arcade Central Hub */}
        <div className="relative z-10 px-4 sm:px-8 py-4 sm:py-6 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/70 border border-arena-yellow/60 text-arena-yellow text-xs font-black backdrop-blur-sm shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-arena-yellow" />
            <span>بكسل آرت مصري أصيل 🕹️ دوري المحافظات</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white drop-shadow-[0_5px_0_#090614] font-rubik leading-tight">
            كنز <span className="text-arena-cyan">الفولي</span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-amber-100/90 font-bold max-w-lg mx-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            حلبة المنيا للأذكياء والصيع: 4 جولات ملحمية بين فريقين (2 ضد 2).
          </p>

          {/* Connection Status Ribbon if disconnected */}
          {!isConnected && (
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold mt-2 ${
              connectionStatus === 'failed' || connectionStatus === 'misconfigured'
                ? 'border-arena-red bg-arena-red/20 text-arena-red'
                : 'border-arena-yellow bg-arena-yellow/20 text-arena-yellow'
            }`}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{connectionStatusMessage}</span>
              {connectionStatus === 'failed' && (
                <button
                  type="button"
                  onClick={reconnect}
                  className="px-2 py-0.5 rounded bg-arena-red text-white text-[10px] font-black"
                >
                  حاول تاني
                </button>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE ACTION HUB (BALANCED DUAL-COLUMN FOR DESKTOP & MOBILE)        */}
        {/* ========================================================================= */}
        <div className="relative z-10 px-4 sm:px-8 pb-8 flex flex-col md:flex-row items-stretch md:items-end justify-between gap-5 max-w-3xl mx-auto w-full">
          
          {/* Quick Start Card / Nickname Form */}
          <div className="flex-1 bg-black/80 backdrop-blur-md border-[3px] border-[#090614] rounded-2xl p-4 sm:p-5 shadow-[0_8px_0_0_#090614] space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="player-name" className="block text-xs font-black text-arena-yellow mb-1.5 flex items-center justify-between">
                  <span>اسمك في الساحة</span>
                  <span className="font-mono text-[10px] text-gray-400">{playerName.length}/20</span>
                </label>
                <input
                  id="player-name"
                  ref={nameInputRef}
                  type="text"
                  value={playerName}
                  onChange={handleNameChange}
                  maxLength={20}
                  autoComplete="nickname"
                  placeholder="اكتب اسمك (مثال: كابتن فولي 🦁)"
                  className={`w-full rounded-xl bg-slate-900/90 border-2 px-3.5 py-2.5 text-sm font-bold text-white placeholder-gray-500 outline-none transition-colors ${
                    fieldError('playerName') ? 'border-arena-red' : 'border-amber-500/40 focus:border-arena-cyan'
                  }`}
                />
                {fieldError('playerName') && (
                  <p className="mt-1 text-xs font-bold text-arena-red">{fieldError('playerName')}</p>
                )}
                {generalError && (
                  <p className="mt-1 text-xs font-bold text-arena-yellow bg-arena-yellow/10 p-1.5 rounded-lg border border-arena-yellow/30">{generalError}</p>
                )}
              </div>

              {/* Quick Action Buttons inside Card */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="menu-btn btn-green h-12 cursor-pointer active:scale-95 transition-transform"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 text-amber-200 animate-spin" />
                      <span className="font-rubik font-black text-xs text-amber-100">جاري البدء...</span>
                    </>
                  ) : (
                    <>
                      <span className="font-rubik font-black text-sm text-amber-100">عمل غرفة</span>
                      <Crown className="w-5 h-5 text-amber-300" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('join')}
                  className="menu-btn btn-blue h-12 cursor-pointer active:scale-95 transition-transform"
                >
                  <span className="font-rubik font-black text-sm text-amber-100">دخول بكود</span>
                  <LogIn className="w-5 h-5 text-amber-200" />
                </button>
              </div>
            </form>
          </div>

          {/* Right-Hand Arcade Action Column (Stitch Screen 4 Vertical Palette) */}
          <div className="w-full md:w-56 flex flex-col gap-2.5 shrink-0" data-purpose="arcade-buttons-stack">
            {/* Button 1: Play / Create */}
            <button
              onClick={() => handleCreate()}
              disabled={isCreating}
              aria-label="العب"
              className="menu-btn btn-green cursor-pointer active:scale-95 transition-transform"
            >
              <span className="font-rubik font-black text-base text-[#ede2c9] drop-shadow-[0_2px_0_#111]">
                {isCreating ? 'جاري الإنشاء...' : 'العب (هوست)'}
              </span>
              <span className="text-xl">🏆</span>
            </button>

            {/* Button 2: Room (Join) */}
            <button
              onClick={() => setActiveModal('join')}
              aria-label="غرفة"
              className="menu-btn btn-blue cursor-pointer active:scale-95 transition-transform"
            >
              <span className="font-rubik font-black text-base text-[#ede2c9] drop-shadow-[0_2px_0_#111]">انضم لغرفة</span>
              <span className="text-xl">👥</span>
            </button>

            {/* Button 3: Leaderboard / Rules */}
            <button
              onClick={() => setActiveModal('info')}
              aria-label="الترتيب"
              className="menu-btn btn-purple cursor-pointer active:scale-95 transition-transform"
            >
              <span className="font-rubik font-black text-base text-[#ede2c9] drop-shadow-[0_2px_0_#111]">قوانين الساحة</span>
              <span className="text-xl">📜</span>
            </button>

            {/* Button 4: Settings / Characters */}
            <button
              onClick={() => setActiveModal('characters')}
              aria-label="الشخصيات"
              className="menu-btn btn-brown cursor-pointer active:scale-95 transition-transform"
            >
              <span className="font-rubik font-black text-base text-[#ede2c9] drop-shadow-[0_2px_0_#111]">أبطال الصعيد</span>
              <span className="text-xl">🛡️</span>
            </button>

            {/* Button 5: Standalone Penalty Shootout */}
            <a
              href="#penalty"
              aria-label="ضربات الجزاء"
              className="menu-btn btn-crimson cursor-pointer active:scale-95 transition-transform"
            >
              <span className="font-rubik font-black text-base text-[#ede2c9] drop-shadow-[0_2px_0_#111]">ضربات الجزاء</span>
              <span className="text-xl">⚽</span>
            </a>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 0: CREATE ROOM DIALOG (RETRO ARCADE STYLE)                          */}
      {/* ========================================================================= */}
      {activeModal === 'create' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border-[3.5px] border-[#090614] rounded-2xl p-5 shadow-[0_8px_0_0_#090614] relative space-y-4">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-3 left-3 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-3xl">👑</span>
              <h2 className="font-rubik font-black text-lg text-arena-yellow">إنشاء غرفة في كنز الفولي (هوست)</h2>
              <p className="text-xs text-gray-300">أدخل اسمك وابدأ الغرفة وشارك الكود مع أصحابك</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1 flex items-center justify-between">
                  <span>اسمك في الساحة</span>
                  <span className="text-[10px] text-gray-500">{playerName.length}/20</span>
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={handleNameChange}
                  autoFocus
                  required
                  placeholder="مثال: كابتن فولي 🦁"
                  className="w-full rounded-xl bg-black/60 border border-white/20 px-3 py-2 text-sm text-white font-bold placeholder-gray-500 focus:border-arena-yellow outline-none"
                />
                {fieldError('playerName') && (
                  <p className="mt-1 text-xs font-bold text-arena-red">{fieldError('playerName')}</p>
                )}
              </div>

              {/* Character quick pick */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">اختار بطلك المفضل</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CHARACTERS.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedHero(c.id)}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        selectedHero === c.id
                          ? 'border-arena-yellow bg-arena-yellow/20 scale-105'
                          : 'border-white/10 bg-black/40 hover:border-white/30'
                      }`}
                    >
                      <span className="text-xl">{c.avatar}</span>
                      <span className="text-[9px] font-bold text-white truncate max-w-full">{c.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="menu-btn btn-green h-12 w-full justify-center gap-2 mt-2 cursor-pointer active:scale-95 transition-transform"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 text-amber-200 animate-spin" />
                    <span className="font-rubik font-black text-sm text-amber-100">جاري إنشاء الغرفة...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 text-amber-200" />
                    <span className="font-rubik font-black text-sm text-amber-100">أنشئ الساحة والعب الآن 🚀</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: JOIN ROOM DIALOG (RETRO ARCADE STYLE)                            */}
      {/* ========================================================================= */}
      {activeModal === 'join' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border-[3.5px] border-[#090614] rounded-2xl p-5 shadow-[0_8px_0_0_#090614] relative space-y-4">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-3 left-3 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-2xl">🔑</span>
              <h2 className="font-rubik font-black text-lg text-arena-yellow">ادخل بكود الغرفة</h2>
              <p className="text-xs text-gray-300">كود الغرفة مكوّن من 6 أرقام</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">اسمك</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={handleNameChange}
                  placeholder="اكتب اسمك..."
                  className="w-full rounded-xl bg-black/60 border border-white/20 px-3 py-2 text-sm text-white font-bold"
                />
                {fieldError('playerName') && (
                  <p className="mt-1 text-xs font-bold text-arena-red">{fieldError('playerName')}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">كود الغرفة</label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-arena-cyan">
                      QZ-
                    </span>
                    <input
                      ref={codeInputRef}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={joinCode}
                      onChange={handleCodeChange}
                      maxLength={ROOM_BODY_LENGTH}
                      placeholder="123456"
                      className="w-full rounded-xl bg-black/60 border border-white/20 pl-11 pr-3 py-2 text-sm text-white font-mono font-bold uppercase tracking-widest text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePasteCode}
                    className="p-2.5 rounded-xl bg-slate-800 border border-white/20 text-gray-300 hover:text-white cursor-pointer"
                    title="لصق من الحافظة"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                  </button>
                </div>
                {fieldError('roomCode') && (
                  <p className="mt-1 text-xs font-bold text-arena-red">{fieldError('roomCode')}</p>
                )}
              </div>

              <button
                ref={joinButtonRef}
                type="button"
                onClick={handleJoin}
                className="menu-btn btn-blue h-12 w-full justify-center gap-2 mt-2 cursor-pointer active:scale-95 transition-transform"
              >
                <LogIn className="w-5 h-5 text-amber-200" />
                <span className="font-rubik font-black text-sm text-amber-100">انضمام للساحة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GAMEPLAY RULES INFO                                              */}
      {/* ========================================================================= */}
      {activeModal === 'info' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border-[3.5px] border-[#090614] rounded-2xl p-5 shadow-[0_8px_0_0_#090614] relative space-y-3 max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-3 left-3 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-2xl">📜</span>
              <h2 className="font-rubik font-black text-lg text-arena-yellow">قواعد كنز الفولي (Kenz Elfoly)</h2>
              <p className="text-xs text-gray-300">ماتش 2 ضد 2.. 4 جولات ملحمية لا مجال فيها للتعادل</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-black/50 p-3 rounded-xl border border-white/10">
                <span className="font-bold text-arena-yellow block">1️⃣ جولة "1 تو" (Bank Mode):</span>
                <span>12 سؤال لكل فريق، اللاعبين بيتبادلوا الإجابة سؤال بسؤال. أمّن النقاط في الخزنة قبل ما تغلط وتصفر!</span>
              </div>
              <div className="bg-black/50 p-3 rounded-xl border border-white/10">
                <span className="font-bold text-arena-cyan block">2️⃣ جولة "اديني في سري" (Password):</span>
                <span>5 كلمات سر لكل فريق، ملقيين التلميحات بيشوفوا الكلمة والـ 4 كلمات الممنوعة مع تحكيم متبادل ضد الغش.</span>
              </div>
              <div className="bg-black/50 p-3 rounded-xl border border-white/10">
                <span className="font-bold text-emerald-400 block">3️⃣ جولة "في المقص" (Penalty Shootout):</span>
                <span>10 ركلات جزاء كرة قدم بعد 2010. مواجهة 1 ضد 1 بين المسدد وحارس المرمى مع زر الصد المتوهج!</span>
              </div>
              <div className="bg-black/50 p-3 rounded-xl border border-white/10">
                <span className="font-bold text-purple-400 block">4️⃣ جولة "مين يزوّد؟" (Blind Auction):</span>
                <span>مزاد علني بين الكباتن على موضوعات تافهة وعامة. أعلى مزايدة بينزل ينفذ التحدي أمام الخصم!</span>
              </div>
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-arena-yellow font-rubik font-black text-sm text-black cursor-pointer hover:brightness-110 active:scale-95 transition-transform"
            >
              فهمت يا كابتن 👍
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CHARACTERS ROSTER PREVIEW                                        */}
      {/* ========================================================================= */}
      {activeModal === 'characters' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border-[3.5px] border-[#090614] rounded-2xl p-5 shadow-[0_8px_0_0_#090614] relative space-y-3 max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-3 left-3 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-2xl">🛡️</span>
              <h2 className="font-rubik font-black text-lg text-arena-yellow">أبطال الصعيد (7 شخصيات)</h2>
              <p className="text-xs text-gray-300">لكل بطل تخصصه وقفشته الخاصة</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {CHARACTERS.map(char => (
                <div key={char.id} className="bg-black/60 p-2.5 rounded-xl border border-white/10 flex items-center gap-2.5">
                  <span className="text-2xl">{char.avatar}</span>
                  <div>
                    <div className="font-bold text-white">{char.name}</div>
                    <div className="text-[10px] text-arena-cyan font-bold">{char.badge}</div>
                    <div className="text-[10px] text-gray-400 italic">"{char.catchphrase}"</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-arena-cyan font-rubik font-black text-sm text-black cursor-pointer hover:brightness-110 active:scale-95 transition-transform"
            >
              تمام يا ريس
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

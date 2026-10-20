import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { CHARACTERS } from '../data/characters';
import {
  ClipboardPaste,
  Crown,
  Loader2,
  LogIn,
  PlusCircle,
  Sparkles,
  Users,
  WifiOff,
  Clock,
  AlertTriangle
} from 'lucide-react';

const ROOM_BODY_LENGTH = 6;

function toRoomBody(value, { stripPrefix = true } = {}) {
  let raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (stripPrefix && raw.startsWith('QZ') && raw.length > ROOM_BODY_LENGTH) {
    raw = raw.slice(2);
  }
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
  const nameInputRef = useRef(null);
  const joinButtonRef = useRef(null);
  const codeInputRef = useRef(null);

  useEffect(() => {
    try {
      const roomParam = new URLSearchParams(window.location.search).get('room');
      if (roomParam) {
        setJoinCode(toRoomBody(roomParam));
        setTimeout(() => joinButtonRef.current?.focus(), 150);
      }
    } catch (e) {
      // ignore malformed URLs
    }
  }, []);

  const fieldError = (field) => {
    if (formError?.field === field) return formError.message;
    if (actionError?.field === field) return actionError.message;
    return null;
  };

  const generalError = actionError && !['playerName', 'roomCode'].includes(actionError.field)
    ? actionError.message
    : null;

  const validateName = () => {
    const cleanName = playerName.trim();
    if (!cleanName) {
      setFormError({ field: 'playerName', message: 'اكتب اسمك الأول يا كابتن.. الاسم مطلوب!' });
      nameInputRef.current?.focus();
      return null;
    }
    return cleanName.slice(0, 20);
  };

  const handleCreate = () => {
    const cleanName = validateName();
    if (!cleanName) return;
    setFormError(null);
    clearActionError();
    createRoom(cleanName);
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
    joinRoom(`QZ-${joinCode}`, cleanName);
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
    const raw = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const body = raw.startsWith('QZ') && raw.length > ROOM_BODY_LENGTH ? raw.slice(2) : raw;
    setJoinCode(body.slice(0, ROOM_BODY_LENGTH));
    setFormError(null);
    clearActionError();
  };

  const handleNameChange = (event) => {
    setPlayerName(event.target.value.slice(0, 20));
    setFormError(null);
    clearActionError();
  };

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 md:py-10 animate-fadeIn">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-arena-darker via-arena-card to-arena-darker border-2 border-arena-cyan/40 p-5 md:p-10 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-arena-cyan/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-arena-red/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-7">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arena-yellow/15 border border-arena-yellow/50 text-arena-yellow text-[11px] md:text-xs font-black">
              <Sparkles className="w-4 h-4" />
              <span>سهرة الكويز المصرية.. روش ومصري 🎮</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              ساحة <span className="text-arena-cyan">الكويز</span>
            </h1>

            <p className="text-sm md:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
              اعمل غرفة أو ادخل بكود من أصحابك، واختار شخصيتك وفريقك جوه صالة الانتظار. لازم 4 لاعبين
              بتوزيع 2 ضد 2 عشان الماتش يبدأ!
            </p>
          </div>

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

          <div className="max-w-xl mx-auto">
            <label htmlFor="player-name" className="block text-xs font-black text-arena-yellow mb-2">
              اسمك في الساحة (مطلوب)
            </label>
            <div className="relative">
              <input
                id="player-name"
                ref={nameInputRef}
                type="text"
                value={playerName}
                onChange={handleNameChange}
                maxLength={20}
                required
                autoComplete="nickname"
                placeholder="مثال: كابتن فولي"
                className={`w-full rounded-2xl bg-arena-darker border-2 px-4 py-3.5 text-base font-bold text-white placeholder-gray-500 outline-none transition-colors ${
                  fieldError('playerName') ? 'border-arena-red' : 'border-white/15 focus:border-arena-cyan'
                }`}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-500">
                {playerName.length}/20
              </span>
            </div>
            {fieldError('playerName') && (
              <p className="mt-2 text-xs font-bold text-arena-red">{fieldError('playerName')}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-3xl border-2 border-arena-cyan/40 bg-arena-darker/80 p-4 md:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-arena-cyan/15 border border-arena-cyan/40 flex items-center justify-center">
                  <PlusCircle className="w-6 h-6 text-arena-cyan" />
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-white">اعمل غرفة جديدة</h2>
                  <p className="text-[11px] text-gray-400">هتكون كابتن الساحة والهوست 👑</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={!isConnected}
                className="btn-arcade-cyan w-full py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
              >
                <Crown className="w-5 h-5" />
                <span>إنشاء غرفة</span>
              </button>
            </div>

            <div className="rounded-3xl border-2 border-arena-yellow/40 bg-arena-darker/80 p-4 md:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-arena-yellow/15 border border-arena-yellow/40 flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-arena-yellow" />
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-white">ادخل بكود الغرفة</h2>
                  <p className="text-[11px] text-gray-400">6 خانات، تقدر تلصق الكود كامل بـ QZ-</p>
                </div>
              </div>

              <div>
                <div
                  dir="ltr"
                  className={`flex items-center gap-1 rounded-2xl bg-black/40 border-2 px-3 py-2 ${
                    fieldError('roomCode') ? 'border-arena-red' : 'border-arena-yellow/40 focus-within:border-arena-yellow'
                  }`}
                >
                  <span className="text-sm font-black font-mono text-arena-yellow select-none">QZ-</span>
                  <input
                    ref={codeInputRef}
                    type="text"
                    inputMode="text"
                    value={joinCode}
                    onChange={handleCodeChange}
                    maxLength={9}
                    placeholder="ABC234"
                    aria-label="كود الغرفة"
                    className="flex-1 min-w-0 bg-transparent text-center text-xl font-black font-mono tracking-[0.25em] text-white uppercase placeholder-gray-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePasteCode}
                    title="لصق الكود من الكليبورد"
                    className="p-2 rounded-xl bg-arena-yellow/10 hover:bg-arena-yellow/20 border border-arena-yellow/30 text-arena-yellow transition-colors"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                  </button>
                </div>
                {fieldError('roomCode') && (
                  <p className="mt-2 text-xs font-bold text-arena-red">{fieldError('roomCode')}</p>
                )}
              </div>

              <button
                ref={joinButtonRef}
                type="button"
                onClick={handleJoin}
                disabled={!isConnected}
                className="btn-arcade-yellow w-full py-4 rounded-2xl text-base font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
              >
                <Users className="w-5 h-5" />
                <span>دخول بالكود</span>
              </button>
            </div>
          </div>

          {generalError && (
            <div className="max-w-xl mx-auto rounded-2xl border border-arena-red/50 bg-arena-red/10 px-4 py-3 text-center text-sm font-bold text-arena-red">
              {generalError}
            </div>
          )}

          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-gray-400">
              <WifiOff className="w-3.5 h-3.5 text-arena-cyan" />
              <span>الشخصية والفريق بيتحددوا جوه اللوبي بعد الدخول</span>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {CHARACTERS.map(character => (
                <div
                  key={character.id}
                  title={character.name}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-md"
                  style={{ backgroundColor: `${character.color}20`, borderColor: character.color }}
                >
                  {character.avatar}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

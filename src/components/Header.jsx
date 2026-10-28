import React from 'react';
import { useGame } from '../context/GameContext';
import { Volume2, VolumeX, Tv, Smartphone, Copy, Check, Loader2, Clock, AlertTriangle, WifiOff, ScrollText } from 'lucide-react';
import RulesModal from './RulesModal';

const ROUNDS = [
  { key: 'round1', short: '1 تو', full: 'جولة 1: 1 تو 🏦' },
  { key: 'round2', short: 'في سري', full: 'جولة 2: اديني في سري 🤫' },
  { key: 'round3', short: 'ركلات', full: 'جولة 3: حط في قريبي ⚽' },
  { key: 'round4', short: 'المزاد', full: 'جولة 4: مين يزوّد؟ 🏷️' }
];

const STATUS_LABELS = {
  lobby: { short: 'الصالة', full: 'صالة الانتظار 🎮' },
  waiting: { short: 'الصالة', full: 'صالة الانتظار 🎮' },
  game_over: { short: 'التتويج', full: 'تتويج بطل الساحة 👑' }
};

const shortName = (name) => String(name || '').split('(')[0].trim();

function TeamScore({ team, tone }) {
  const isCyan = tone === 'cyan';
  return (
    <div
      className={`min-w-0 rounded-2xl border px-3 py-1.5 flex items-center justify-between gap-2 ${
        isCyan ? 'border-arena-cyan/40 bg-arena-cyan/[0.07]' : 'border-arena-red/40 bg-arena-red/[0.07]'
      }`}
    >
      <div className="min-w-0">
        <div className={`truncate text-[11px] font-black ${isCyan ? 'text-arena-cyan' : 'text-arena-red'}`}>{shortName(team.name)}</div>
        <div className="text-[10px] text-gray-400 font-bold">خزنة <span className="text-arena-yellow">{team.bank || 0}</span></div>
      </div>
      <div className="text-xl sm:text-2xl font-black tabular-nums text-white leading-none">{team.score || 0}</div>
    </div>
  );
}

function ConnectionPill({ status, reconnect }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-arena-green/40 bg-arena-green/10 px-2.5 py-1 text-[11px] font-black text-arena-green" title="متصل بالسيرفر">
        <span className="h-2 w-2 rounded-full bg-arena-green animate-pulse" />
        <span className="hidden sm:inline">لايف</span>
      </span>
    );
  }
  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-arena-cyan/40 bg-arena-cyan/10 px-2.5 py-1 text-[11px] font-black text-arena-cyan" title="بنتصل بالسيرفر…">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">بنتصل…</span>
      </span>
    );
  }
  if (status === 'waking_up') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-arena-yellow/40 bg-arena-yellow/10 px-2.5 py-1 text-[11px] font-black text-arena-yellow" title="السيرفر بيصحى، استنى لحد دقيقة">
        <Clock className="h-3.5 w-3.5 animate-pulse" />
        <span className="hidden sm:inline">السيرفر بيصحى…</span>
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={reconnect}
        className="inline-flex items-center gap-1.5 rounded-full border border-arena-red/50 bg-arena-red/10 px-2.5 py-1 text-[11px] font-black text-arena-red cursor-pointer"
        title="مش قادرين نوصل للسيرفر"
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span>حاول تاني</span>
      </button>
    );
  }
  return null;
}

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
  const [showRules, setShowRules] = React.useState(false);

  const status = roomState?.status || 'lobby';
  const currentCode = roomState?.code || '';
  const teamA = roomState?.teams?.team_a || { name: 'فريق الحيتان', score: 0, bank: 0 };
  const teamB = roomState?.teams?.team_b || { name: 'فريق الوحوش', score: 0, bank: 0 };

  const inMatch = ROUNDS.some(round => round.key === status) || status === 'game_over';
  const roundIndex = ROUNDS.findIndex(round => round.key === status);
  const label = ROUNDS[roundIndex] ? { short: ROUNDS[roundIndex].short, full: ROUNDS[roundIndex].full } : (STATUS_LABELS[status] || { short: status, full: status });

  // Lead bar: share of the points held by Team A (50/50 while nobody has scored).
  const scoreA = Math.max(0, teamA.score || 0);
  const scoreB = Math.max(0, teamB.score || 0);
  const shareA = scoreA + scoreB === 0 ? 50 : Math.round((scoreA / (scoreA + scoreB)) * 100);
  const leader = scoreA === scoreB ? null : (scoreA > scoreB ? 'team_a' : 'team_b');

  const copyRoomCode = () => {
    if (!currentCode) return;
    navigator.clipboard?.writeText(currentCode);
    setCopied(true);
    showToast('تم نسخ الكود!', `شارك الكود ${currentCode} مع أصحابك للدخول من الموبايل!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(7,11,24,0.82)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 md:px-6">
        {/* ============ identity + actions ============ */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-arena-yellow to-arena-cyan text-lg shadow-lg">⚡</div>
            <div className="min-w-0 leading-tight">
              <div className="hidden sm:block text-[10px] font-black tracking-[0.2em] text-arena-cyan">KENZ ELFOLY</div>
              <div className="truncate text-sm font-black text-white">
                <span className="sm:hidden">{label.short}</span>
                <span className="hidden sm:inline">{label.full}</span>
              </div>
              {inMatch && roundIndex >= 0 && (
                <div className="mt-0.5 flex items-center gap-1" aria-label={`الجولة ${roundIndex + 1} من 4`}>
                  {ROUNDS.map((round, index) => (
                    <span
                      key={round.key}
                      className={`h-1.5 rounded-full transition-all ${
                        index === roundIndex ? 'w-6 bg-arena-yellow' : index < roundIndex ? 'w-3 bg-arena-green/70' : 'w-3 bg-white/15'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1" />

          {currentCode && (
            <button
              type="button"
              onClick={copyRoomCode}
              title="انسخ كود الغرفة"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-black text-white transition-colors hover:border-arena-cyan/60 cursor-pointer"
            >
              <span className="hidden sm:inline text-gray-400 font-bold">غرفة</span>
              <span className="font-mono tracking-wide">{currentCode}</span>
              {copied ? <Check className="h-3.5 w-3.5 text-arena-green" /> : <Copy className="h-3.5 w-3.5 text-arena-cyan" />}
            </button>
          )}

          <div className="flex items-center rounded-xl border border-white/12 bg-white/[0.06] p-0.5" role="group" aria-label="طريقة العرض">
            <button
              type="button"
              onClick={() => setActiveTabMode('arena')}
              aria-pressed={activeTabMode === 'arena'}
              title="شاشة الساحة"
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black transition-all cursor-pointer ${
                activeTabMode === 'arena' ? 'bg-arena-cyan text-arena-darker' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Tv className="h-4 w-4" />
              <span className="hidden md:inline">الساحة</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('mobile_controller')}
              aria-pressed={activeTabMode === 'mobile_controller'}
              title="تحكم الموبايل"
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black transition-all cursor-pointer ${
                activeTabMode === 'mobile_controller' ? 'bg-arena-yellow text-arena-darker' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span className="hidden md:inline">تحكّم</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRules(true)}
            title="قواعد اللعبة"
            aria-label="قواعد اللعبة"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06] text-gray-300 transition-colors hover:border-arena-yellow/60 cursor-pointer"
          >
            <ScrollText className="h-4 w-4 text-arena-yellow" />
          </button>

          <button
            type="button"
            onClick={setIsAudioMuted}
            title={isAudioMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم الصوت'}
            aria-label={isAudioMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم الصوت'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06] text-gray-300 transition-colors hover:border-arena-cyan/60 cursor-pointer"
          >
            {isAudioMuted ? <VolumeX className="h-4 w-4 text-arena-red" /> : <Volume2 className="h-4 w-4 text-arena-green" />}
          </button>

          <ConnectionPill status={connectionStatus} reconnect={reconnect} />
        </div>

        {connectionStatus === 'misconfigured' && (
          <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-arena-red/50 bg-arena-red/10 px-3 py-1.5 text-[11px] font-bold text-arena-red">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>اللعب أونلاين مش متظبط. صاحب اللعبة لازم يضبط مفاتيح Supabase أو VITE_SERVER_URL.</span>
          </div>
        )}

        {/* ============ scoreboard (only once there is something to score) ============ */}
        {inMatch && (
          <div className="pb-2.5">
            <div className="grid grid-cols-2 gap-2">
              <TeamScore team={teamA} tone="cyan" />
              <TeamScore team={teamB} tone="red" />
            </div>
            <div className="mt-2 flex items-center gap-2" aria-label="ميزان النقاط">
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" dir="rtl">
                <div className="h-full bg-arena-cyan transition-all duration-500" style={{ width: `${shareA}%` }} />
                <div className="h-full flex-1 bg-arena-red" />
              </div>
              <span className="shrink-0 text-[10px] font-black text-gray-400">
                {leader ? `${shortName((leader === 'team_a' ? teamA : teamB).name)} متقدم 🔥` : 'تعادل ⚖️'}
              </span>
            </div>
          </div>
        )}
      </div>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </header>
  );
}

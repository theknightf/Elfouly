import { usePenaltyGame } from './hooks/usePenaltyGame';
import { MatchSetup } from './components/MatchSetup';
import { GoalkeeperSelect } from './components/GoalkeeperSelect';
import { QuestionScreen } from './components/QuestionScreen';
import { ResultScreen } from './components/ResultScreen';
import { SuddenDeathScreen } from './components/SuddenDeathScreen';
import { WinnerScreen } from './components/WinnerScreen';
import { Scoreboard } from './components/Scoreboard';
import './penalty.css';

function WaitingScreen({ label }: { label: string }) {
  return (
    <div className="pk-card rounded-3xl border border-white/10 bg-black/35 p-8 text-center">
      <div className="animate-bounce text-4xl">⏳</div>
      <div className="mt-3 text-sm font-black text-white">{label}</div>
      <div className="mt-1 text-[10px] font-bold text-gray-500">
        جاري تجهيز الركلة...
      </div>
    </div>
  );
}

export default function PenaltyShootout() {
  const {
    match,
    error,
    isMuted,
    startMatch,
    chooseGoalkeeper,
    answer,
    timeout,
    continueKick,
    startSuddenDeathRound,
    rematch,
    backToSetup,
    toggleMute,
    clearError
  } = usePenaltyGame();

  const renderMatchScreen = () => {
    if (!match) {
      return null;
    }

    switch (match.phase) {
      case 'SELECT_PLAYERS':
        return (
          <GoalkeeperSelect match={match} onChoose={chooseGoalkeeper} />
        );
      case 'ATTACKER_QUESTION':
      case 'GOALKEEPER_QUESTION':
        return (
          <QuestionScreen
            match={match}
            onAnswer={answer}
            onTimeout={timeout}
          />
        );
      case 'GOAL':
      case 'SAVE':
      case 'MISS':
        return <ResultScreen match={match} onContinue={continueKick} />;
      case 'SUDDEN_DEATH':
        return (
          <SuddenDeathScreen
            match={match}
            onStart={startSuddenDeathRound}
          />
        );
      case 'MATCH_END':
        return (
          <WinnerScreen
            match={match}
            onRematch={rematch}
            onBackToSetup={backToSetup}
          />
        );
      case 'ROUND_START':
      case 'NEXT_KICK':
        return <WaitingScreen label="الركلة الجاية" />;
      case 'MATCH_START':
        return <WaitingScreen label="بداية المباراة" />;
      default:
        return null;
    }
  };

  return (
    <div
      dir="rtl"
      className="pk-shell relative min-h-screen overflow-x-hidden font-arabic text-white"
    >
      <div className="pointer-events-none fixed inset-0 z-0 pk-pitch-lines opacity-40" />
      <div className="pointer-events-none fixed inset-0 z-0 pk-vignette" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-3 pt-4 sm:px-5">
        <a
          href="#arena"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-black/35 px-2.5 text-[10px] font-bold text-gray-300 transition hover:border-white/30 hover:text-white"
        >
          <span>←</span>
          <span>الساحة</span>
        </a>

        <div className="text-center">
          <div className="font-pixel text-[8px] tracking-[0.24em] text-arena-yellow">
            KENZ ELFOLY
          </div>
          <div className="mt-0.5 text-sm font-black text-white sm:text-base">
            ⚽ ضربات الجزاء
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-sm transition hover:border-white/30 active:scale-95"
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-3 pb-12 pt-4 sm:px-5">
        {match && (
          <div className="mb-3">
            <Scoreboard match={match} />
          </div>
        )}

        {match && error && (
          <div className="mb-3 flex items-start justify-between gap-2 rounded-2xl border-2 border-arena-red/70 bg-arena-red/10 px-3 py-2 text-xs font-bold text-arena-red">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="shrink-0 text-sm text-arena-red/80 hover:text-white"
              aria-label="إغلاق الخطأ"
            >
              ×
            </button>
          </div>
        )}

        {match ? (
          renderMatchScreen()
        ) : (
          <MatchSetup
            error={error}
            onStart={startMatch}
            onClearError={clearError}
          />
        )}

        <footer className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-[9px] font-bold text-gray-600">
          <span>لعبة محلية بنظام اللعب الحر</span>
          <span>•</span>
          <span>5 جولات + موت مفاجئ</span>
          <span>•</span>
          <span>بونص للتخصصات</span>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full border border-white/10 px-2 py-0.5 text-gray-500 transition hover:text-white"
          >
            صوت: {isMuted ? 'مكتوم' : 'مفتوح'}
          </button>
        </footer>
      </main>
    </div>
  );
}

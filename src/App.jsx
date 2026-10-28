import React, { Suspense, lazy } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Header from './components/Header';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
// Each round screen loads on demand so the first paint (landing + lobby) stays light.
const Round1Bank = lazy(() => import('./components/Round1Bank'));
const Round2Password = lazy(() => import('./components/Round2Password'));
const Round3Penalty = lazy(() => import('./components/Round3Penalty'));
const BonusAuction = lazy(() => import('./components/BonusAuction'));
const GameOver = lazy(() => import('./components/GameOver'));
const MobileController = lazy(() => import('./components/MobileController'));
import TauntChat from './components/TauntChat';
import RoleAlertModal from './components/RoleAlertModal';
import GameProgressionControls from './components/GameProgressionControls';
import PowerButton from './components/PowerButton';
import ErrorBoundary from './components/ErrorBoundary';
import { PlayCircle, Lock, Shield, Gavel, Trophy, Sparkles } from 'lucide-react';

function GameScreen() {
  const { roomState, changeRound, activeTabMode, toast, roomCode, isHost } = useGame();

  const currentStatus = roomState?.status || 'lobby';
  const isMatchInProgress = ['round1', 'round2', 'round3', 'round4', 'game_over'].includes(currentStatus);
  const showLanding = !roomCode && !isMatchInProgress;

  // One tap on the host bar must not wipe a round by accident.
  const jumpToRound = (target) => {
    if (target === currentStatus) return;
    const inRound = ['round1', 'round2', 'round3', 'round4'].includes(currentStatus);
    if (inRound && !window.confirm('تنتقل لجولة تانية؟ التقدم في الجولة الحالية مش هيترجع.')) return;
    changeRound(target);
  };

  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] bg-arena-darker arcade-grid-bg text-white flex flex-col font-arabic"
      style={{ '--fab-bottom': isHost && roomCode ? '4.5rem' : '1rem' }}
    >
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-arena-card border-2 border-arena-yellow rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-bounce-short max-w-sm">
          <div className="text-2xl">⚡</div>
          <div className="text-right">
            <div className="text-xs font-black text-arena-yellow">{toast.title}</div>
            <div className="text-xs text-white">{toast.message}</div>
          </div>
        </div>
      )}

      {/* Top Header (rendered during active match & room) */}
      {!showLanding && <Header />}

      {/* Main Content Area */}
      <main className={`flex-1 ${showLanding ? '' : 'pb-40'}`}>
        <ErrorBoundary>
          <Suspense fallback={<div className="py-20 text-center text-sm font-bold text-gray-400">جاري التحميل…</div>}>
          {showLanding ? (
            <Landing />
          ) : activeTabMode === 'mobile_controller' ? (
            <MobileController />
          ) : (
            <>
              <PowerButton />
              {['round1', 'round2', 'round3', 'round4'].includes(currentStatus) && (
                <div className="max-w-7xl mx-auto px-3 pt-3">
                  <GameProgressionControls />
                </div>
              )}
              {(currentStatus === 'lobby' || currentStatus === 'waiting') && <Lobby />}
              {currentStatus === 'round1' && <Round1Bank />}
              {currentStatus === 'round2' && <Round2Password />}
              {currentStatus === 'round3' && <Round3Penalty />}
              {currentStatus === 'round4' && <BonusAuction />}
              {currentStatus === 'game_over' && <GameOver />}
            </>
          )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Host Quick Round Navigation Bar at Bottom (host only) */}
      {isHost && roomCode && (
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-arena-card/95 backdrop-blur-md border-t border-white/10 px-2 pt-2 safe-bottom">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="text-[11px] font-bold text-gray-400 whitespace-nowrap hidden md:block">
              تحكم سريع بالحكم:
            </div>

            <div className="flex flex-nowrap items-center gap-1.5 mx-auto w-max">
              <button
                onClick={() => jumpToRound('lobby')}
                className={`px-3 py-2 shrink-0 whitespace-nowrap rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  (currentStatus === 'lobby' || currentStatus === 'waiting') ? 'bg-arena-cyan text-arena-darker font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>التشكيلة</span>
              </button>

              <button
                onClick={() => jumpToRound('round1')}
                className={`px-3 py-2 shrink-0 whitespace-nowrap rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  currentStatus === 'round1' ? 'bg-arena-yellow text-arena-darker font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span><span className="sm:hidden">1 تو</span><span className="hidden sm:inline">جولة 1: 1 تو</span></span>
              </button>

              <button
                onClick={() => jumpToRound('round2')}
                className={`px-3 py-2 shrink-0 whitespace-nowrap rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  currentStatus === 'round2' ? 'bg-arena-cyan text-arena-darker font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span><span className="sm:hidden">في سري</span><span className="hidden sm:inline">جولة 2: في سري</span></span>
              </button>

              <button
                onClick={() => jumpToRound('round3')}
                className={`px-3 py-2 shrink-0 whitespace-nowrap rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  currentStatus === 'round3' ? 'bg-arena-red text-white font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span><span className="sm:hidden">ركلات</span><span className="hidden sm:inline">جولة 3: ركلات جزاء</span></span>
              </button>

              <button
                onClick={() => jumpToRound('round4')}
                className={`px-3 py-2 shrink-0 whitespace-nowrap rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  currentStatus === 'round4' ? 'bg-arena-purple text-white font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Gavel className="w-3.5 h-3.5" />
                <span><span className="sm:hidden">المزاد</span><span className="hidden sm:inline">المزاد الفاصل</span></span>
              </button>

              <button
                onClick={() => jumpToRound('game_over')}
                className={`px-3 py-2 shrink-0 whitespace-nowrap rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  currentStatus === 'game_over' ? 'bg-arena-green text-arena-darker font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>التتويج</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Floating Street Taunt Drawer */}
      {!showLanding && <TauntChat />}

      {/* Blocking role alerts (answerer / judge / penalty shooter) */}
      <RoleAlertModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <GameScreen />
      </GameProvider>
    </ErrorBoundary>
  );
}

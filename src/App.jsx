import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Header from './components/Header';
import Lobby from './components/Lobby';
import Round1Bank from './components/Round1Bank';
import Round2Password from './components/Round2Password';
import Round3Penalty from './components/Round3Penalty';
import BonusAuction from './components/BonusAuction';
import GameOver from './components/GameOver';
import MobileController from './components/MobileController';
import TauntChat from './components/TauntChat';
import ErrorBoundary from './components/ErrorBoundary';
import { Layers, PlayCircle, Lock, Shield, Gavel, Trophy, Sparkles } from 'lucide-react';

function GameScreen() {
  const { roomState, changeRound, activeTabMode, toast } = useGame();

  const currentStatus = roomState?.status || 'lobby';

  return (
    <div className="min-h-screen bg-arena-darker arcade-grid-bg text-white flex flex-col font-arabic">
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

      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 pb-20">
        <ErrorBoundary>
          {activeTabMode === 'mobile_controller' ? (
            <MobileController />
          ) : (
            <>
              {currentStatus === 'lobby' && <Lobby />}
              {currentStatus === 'round1' && <Round1Bank />}
              {currentStatus === 'round2' && <Round2Password />}
              {currentStatus === 'round3' && <Round3Penalty />}
              {currentStatus === 'round4' && <BonusAuction />}
              {currentStatus === 'game_over' && <GameOver />}
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* Host Quick Round Navigation Bar at Bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-arena-card/95 backdrop-blur-md border-t border-white/10 px-3 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
          <div className="text-[11px] font-bold text-gray-400 whitespace-nowrap hidden md:block">
            تحكم سريع بالحكم:
          </div>

          <div className="flex items-center gap-1.5 mx-auto">
            <button
              onClick={() => changeRound('lobby')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                currentStatus === 'lobby' ? 'bg-arena-cyan text-arena-darker font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>التشكيلة</span>
            </button>

            <button
              onClick={() => changeRound('round1')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                currentStatus === 'round1' ? 'bg-arena-yellow text-arena-darker font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>جولة 1: 1 تو</span>
            </button>

            <button
              onClick={() => changeRound('round2')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                currentStatus === 'round2' ? 'bg-arena-cyan text-arena-darker font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>جولة 2: في سري</span>
            </button>

            <button
              onClick={() => changeRound('round3')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                currentStatus === 'round3' ? 'bg-arena-red text-white font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>جولة 3: ركلات جزاء</span>
            </button>

            <button
              onClick={() => changeRound('round4')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                currentStatus === 'round4' ? 'bg-arena-purple text-white font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Gavel className="w-3.5 h-3.5" />
              <span>المزاد الفاصل</span>
            </button>

            <button
              onClick={() => changeRound('game_over')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                currentStatus === 'game_over' ? 'bg-arena-green text-arena-darker font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>التتويج</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Street Taunt Drawer */}
      <TauntChat />
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

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { CHARACTERS } from '../data/characters';
import { TRIVIA_BANK, PASSWORD_WORDS, PENALTY_QUESTIONS, AUCTION_TOPICS } from '../data/questions';
import { sounds } from '../utils/soundEffects';

const GameContext = createContext();

export function GameProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isHost, setIsHost] = useState(true);
  const [activeTabMode, setActiveTabMode] = useState('arena'); // 'arena' (TV/host view) | 'mobile_controller'

  // Notification toast
  const [toast, setToast] = useState(null);

  // Fallback / Offline local game state (so the entire app is 100% playable standalone or synced)
  const [roomState, setRoomState] = useState({
    code: 'ARENA',
    status: 'lobby',
    players: [
      { id: 'p1', name: 'فارس الفولي', character: CHARACTERS[0], team: 'team_a', isHost: true, scoreContribution: 0 },
      { id: 'p2', name: 'عبد الرحمن التوني', character: CHARACTERS[1], team: 'team_a', isHost: false, scoreContribution: 0 },
      { id: 'p3', name: 'خالد البربخ', character: CHARACTERS[2], team: 'team_b', isHost: false, scoreContribution: 0 },
      { id: 'p4', name: 'زياد الفندقي', character: CHARACTERS[3], team: 'team_b', isHost: false, scoreContribution: 0 },
      { id: 'p5', name: 'إياد الأسد', character: CHARACTERS[4], team: 'team_a', isHost: false, scoreContribution: 0 },
      { id: 'p6', name: 'مازن الجيمر', character: CHARACTERS[5], team: 'team_b', isHost: false, scoreContribution: 0 },
      { id: 'p7', name: 'علي التوربو', character: CHARACTERS[6], team: 'team_a', isHost: false, scoreContribution: 0 }
    ],
    teams: {
      team_a: { id: 'team_a', name: 'فريق الحيتان (Team A)', score: 0, bank: 0, penaltyScore: 0 },
      team_b: { id: 'team_b', name: 'فريق الوحوش (Team B)', score: 0, bank: 0, penaltyScore: 0 }
    },
    round1: {
      activeTeam: 'team_a',
      answeringPlayerId: 'p1',
      readerPlayerId: 'p3',
      currentQuestionIndex: 0,
      streak: 0,
      pendingPoints: 0,
      streakLadder: [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000],
      currentQuestion: TRIVIA_BANK[0],
      timer: 30,
      isTimerRunning: false,
      history: []
    },
    round2: {
      activeClueGiverA: 'p1',
      activeClueGiverB: 'p3',
      hostRefereeId: 'p1',
      currentWordIndex: 0,
      currentWord: PASSWORD_WORDS[0],
      timer: 45,
      isTimerRunning: false,
      fouls: { team_a: 0, team_b: 0 }
    },
    round3: {
      turnIndex: 0,
      currentKickerId: 'p1',
      currentGoalieId: 'p3',
      kickerTeam: 'team_a',
      currentQuestion: PENALTY_QUESTIONS[0],
      timer: 20,
      isTimerRunning: false,
      interceptBuzzedBy: null,
      shotsHistory: []
    },
    round4: {
      currentTopicIndex: 0,
      currentTopic: AUCTION_TOPICS[0],
      highestBid: 3,
      highestBidderTeam: 'team_a',
      highestBidderPlayerId: 'p1',
      timer: 60,
      isTimerRunning: false,
      phase: 'bidding',
      itemsNamed: [],
      usedLifelines: { team_a: [], team_b: [] }
    },
    messages: []
  });

  // Socket setup
  useEffect(() => {
    // Try connecting to local game server
    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : `http://${window.location.hostname}:3001`;

    const s = io(serverUrl, {
      reconnectionAttempts: 5,
      timeout: 3000
    });

    s.on('connect', () => {
      console.log('Connected to Quiz Arena server!');
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      console.log('Disconnected from Quiz Arena server');
      setIsConnected(false);
    });

    s.on('room_state_updated', (updatedRoom) => {
      setRoomState(updatedRoom);
    });

    s.on('room_created', ({ roomCode, player, room }) => {
      setRoomCode(roomCode);
      setCurrentPlayer(player);
      setIsHost(true);
      setRoomState(room);
      showToast('تم إنشاء الساحة!', `كود الغرفة: ${roomCode}`);
    });

    s.on('joined_room', ({ roomCode, player, room }) => {
      setRoomCode(roomCode);
      setCurrentPlayer(player);
      setIsHost(player.isHost);
      setRoomState(room);
      showToast('نورت الساحة يا كابتن!', `دخلت كود: ${roomCode}`);
    });

    s.on('sound_trigger', ({ sound, streak }) => {
      if (sound === 'whistle') sounds.playWhistle();
      else if (sound === 'bank_safe') sounds.playBankSafe();
      else if (sound === 'goal_roar') sounds.playGoalRoar();
      else if (sound === 'buzzer') sounds.playBuzzer();
      else if (sound === 'correct') {
        if (streak) sounds.playStreakUp(streak);
        else sounds.playCorrect();
      }
      else if (sound === 'save') sounds.playSave();
      else if (sound === 'bid') sounds.playBid();
    });

    s.on('confetti_trigger', () => {
      fireConfetti();
    });

    s.on('notification', ({ title, message }) => {
      showToast(title, message);
    });

    s.on('chat_received', (msg) => {
      setRoomState(prev => ({
        ...prev,
        messages: [...(prev.messages || []), msg]
      }));
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const showToast = (title, message) => {
    setToast({ title, message });
    setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  const fireConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00F2FE', '#FF4B4B', '#FFD200', '#00E676', '#8B5CF6']
    });
  };

  // Socket or local fallback dispatchers
  const changeRound = (targetRound) => {
    if (socket && isConnected && roomCode) {
      socket.emit('change_round', { roomCode, targetRound });
    } else {
      // Local execution
      sounds.playWhistle();
      setRoomState(prev => {
        const next = { ...prev, status: targetRound };
        if (targetRound === 'round1') {
          next.round1.activeTeam = 'team_a';
          next.round1.streak = 0;
          next.round1.pendingPoints = 0;
          next.round1.currentQuestionIndex = 0;
          next.round1.currentQuestion = TRIVIA_BANK[0];
        } else if (targetRound === 'round2') {
          next.round2.currentWordIndex = 0;
          next.round2.currentWord = PASSWORD_WORDS[0];
          next.round2.timer = 45;
        } else if (targetRound === 'round3') {
          next.round3.turnIndex = 0;
          next.round3.kickerTeam = 'team_a';
          next.round3.currentQuestion = PENALTY_QUESTIONS[0];
          next.round3.interceptBuzzedBy = null;
          next.round3.shotsHistory = [];
        } else if (targetRound === 'round4') {
          next.round4.currentTopicIndex = 0;
          next.round4.currentTopic = AUCTION_TOPICS[0];
          next.round4.highestBid = AUCTION_TOPICS[0].minBid;
          next.round4.phase = 'bidding';
          next.round4.timer = 60;
          next.round4.itemsNamed = [];
        }
        return next;
      });
      showToast('انتقال الجولة', `بدأت جولة: ${targetRound}`);
    }
  };

  // Round 1 Handlers
  const r1Score = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_action_score', { roomCode });
    } else {
      setRoomState(prev => {
        const r1 = { ...prev.round1 };
        const nextStreak = Math.min(r1.streak + 1, 10);
        r1.streak = nextStreak;
        let points = r1.streakLadder[nextStreak];
        const answeringPlayer = prev.players.find(p => p.id === r1.answeringPlayerId);
        if (answeringPlayer?.character?.id === 'fares_elfouly') {
          points = Math.round(points * 1.2);
        }
        r1.pendingPoints = points;
        const nextIdx = (r1.currentQuestionIndex + 1) % TRIVIA_BANK.length;
        r1.currentQuestionIndex = nextIdx;
        r1.currentQuestion = TRIVIA_BANK[nextIdx];
        sounds.playStreakUp(nextStreak);
        return { ...prev, round1: r1 };
      });
    }
  };

  const r1Break = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_action_break', { roomCode });
    } else {
      sounds.playBuzzer();
      setRoomState(prev => {
        const r1 = { ...prev.round1 };
        const answeringPlayer = prev.players.find(p => p.id === r1.answeringPlayerId);
        if (answeringPlayer?.character?.id === 'abdelrahman_eltouny' && r1.streak > 1) {
          showToast('درع التوني بيلافيتا! 🍦', 'تم حماية الستريك وإنقاذ النقاط!');
          r1.streak = Math.max(1, r1.streak - 1);
          r1.pendingPoints = r1.streakLadder[r1.streak];
        } else {
          r1.streak = 0;
          r1.pendingPoints = 0;
        }
        const nextIdx = (r1.currentQuestionIndex + 1) % TRIVIA_BANK.length;
        r1.currentQuestionIndex = nextIdx;
        r1.currentQuestion = TRIVIA_BANK[nextIdx];
        return { ...prev, round1: r1 };
      });
    }
  };

  const r1Bank = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_action_bank', { roomCode });
    } else {
      setRoomState(prev => {
        const r1 = { ...prev.round1 };
        const teamKey = r1.activeTeam;
        const amount = r1.pendingPoints;
        if (amount > 0) {
          sounds.playBankSafe();
          fireConfetti();
          const teams = { ...prev.teams };
          teams[teamKey] = {
            ...teams[teamKey],
            bank: teams[teamKey].bank + amount,
            score: teams[teamKey].score + amount
          };
          r1.pendingPoints = 0;
          r1.streak = 0;
          return { ...prev, teams, round1: r1 };
        }
        return prev;
      });
    }
  };

  const r1PassTurn = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_pass_turn', { roomCode });
    } else {
      sounds.playWhistle();
      setRoomState(prev => {
        const r1 = { ...prev.round1 };
        r1.pendingPoints = 0;
        r1.streak = 0;
        r1.activeTeam = r1.activeTeam === 'team_a' ? 'team_b' : 'team_a';
        return { ...prev, round1: r1 };
      });
    }
  };

  // Round 2 Handlers
  const r2AwardPoint = (team) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_award_point', { roomCode, team });
    } else {
      sounds.playCorrect();
      setRoomState(prev => {
        const r2 = { ...prev.round2 };
        const teams = { ...prev.teams };
        teams[team] = { ...teams[team], score: teams[team].score + 500 };
        const nextIdx = (r2.currentWordIndex + 1) % PASSWORD_WORDS.length;
        r2.currentWordIndex = nextIdx;
        r2.currentWord = PASSWORD_WORDS[nextIdx];
        return { ...prev, teams, round2: r2 };
      });
    }
  };

  const r2Foul = (team) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_foul', { roomCode, team });
    } else {
      sounds.playBuzzer();
      setRoomState(prev => {
        const r2 = { ...prev.round2 };
        r2.fouls[team] = (r2.fouls[team] || 0) + 1;
        const teams = { ...prev.teams };
        teams[team] = { ...teams[team], score: Math.max(0, teams[team].score - 200) };
        return { ...prev, teams, round2: r2 };
      });
    }
  };

  const r2TimeFreeze = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_time_freeze', { roomCode });
    } else {
      showToast('تجميد الوقت الفندقي 🛎️', 'زياد الفندقي مد الوقت +10 ثواني كاملة!');
      setRoomState(prev => ({
        ...prev,
        round2: { ...prev.round2, timer: prev.round2.timer + 10 }
      }));
    }
  };

  // Round 3 Handlers
  const r3InterceptBuzz = () => {
    sounds.playBuzzer();
    if (socket && isConnected && roomCode) {
      socket.emit('r3_intercept_buzz', { roomCode });
    } else {
      showToast('صد واعتراض! 🛡️', 'البربخ ضغط على بزر الصد لسرقة النقطة!');
      setRoomState(prev => ({
        ...prev,
        round3: { ...prev.round3, interceptBuzzedBy: 'local_goalie' }
      }));
    }
  };

  const r3RecordShot = (result) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r3_record_shot', { roomCode, result });
    } else {
      if (result === 'goal') {
        sounds.playGoalRoar();
        fireConfetti();
      } else if (result === 'saved') {
        sounds.playSave();
      } else {
        sounds.playWhistle();
      }

      setRoomState(prev => {
        const r3 = { ...prev.round3 };
        const teams = { ...prev.teams };
        const kickingTeam = r3.kickerTeam;
        const defendingTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';

        if (result === 'goal') {
          teams[kickingTeam].score += 1000;
          teams[kickingTeam].penaltyScore = (teams[kickingTeam].penaltyScore || 0) + 1;
        } else if (result === 'saved') {
          teams[defendingTeam].score += 800;
        }

        r3.shotsHistory.push({
          shotIndex: r3.turnIndex,
          team: kickingTeam,
          result: result,
          intercepted: !!r3.interceptBuzzedBy
        });

        r3.turnIndex += 1;
        r3.kickerTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';
        r3.interceptBuzzedBy = null;
        const nextQIdx = r3.turnIndex % PENALTY_QUESTIONS.length;
        r3.currentQuestion = PENALTY_QUESTIONS[nextQIdx];

        return { ...prev, teams, round3: r3 };
      });
    }
  };

  // Round 4 Handlers
  const r4Bid = (increment) => {
    sounds.playBid();
    if (socket && isConnected && roomCode) {
      socket.emit('r4_bid', { roomCode, increment });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        r4.highestBid += increment;
        r4.highestBidderTeam = r4.highestBidderTeam === 'team_a' ? 'team_b' : 'team_a';
        return { ...prev, round4: r4 };
      });
    }
  };

  const r4ResolveBid = (success) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r4_resolve_bid', { roomCode, success });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        const teams = { ...prev.teams };
        const winningTeam = r4.highestBidderTeam || 'team_a';

        if (success) {
          const reward = r4.highestBid * 400;
          teams[winningTeam].score += reward;
          sounds.playGoalRoar();
          fireConfetti();
          showToast('أنا قدها ونص! 🏆', `${teams[winningTeam].name} نفذ المزاد وكسب ${reward} نقطة!`);
        } else {
          const penalty = r4.highestBid * 250;
          teams[winningTeam].score = Math.max(0, teams[winningTeam].score - penalty);
          sounds.playBuzzer();
          showToast('المزاد طار! ❌', `${teams[winningTeam].name} مقدرش يوفي بالمزاد وخسر ${penalty} نقطة!`);
        }
        r4.phase = 'resolved';
        return { ...prev, teams, round4: r4 };
      });
    }
  };

  // Send Taunt
  const sendTaunt = (text) => {
    sounds.playWhistle();
    const newMsg = {
      id: Date.now().toString(),
      senderName: currentPlayer?.name || 'كابتن الساحة',
      characterAvatar: currentPlayer?.character?.avatar || '⚡',
      team: currentPlayer?.team || 'team_a',
      text,
      isTaunt: true,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    if (socket && isConnected && roomCode) {
      socket.emit('send_chat', { roomCode, text, isTaunt: true });
    } else {
      setRoomState(prev => ({
        ...prev,
        messages: [...(prev.messages || []), newMsg]
      }));
    }
    showToast('رميت إفيه روش! 🔥', text);
  };

  return (
    <GameContext.Provider
      value={{
        socket,
        isConnected,
        isAudioMuted,
        setIsAudioMuted: () => {
          const muted = sounds.toggleMute();
          setIsAudioMuted(muted);
        },
        roomCode,
        currentPlayer,
        setCurrentPlayer,
        isHost,
        setIsHost,
        activeTabMode,
        setActiveTabMode,
        toast,
        showToast,
        fireConfetti,
        roomState,
        setRoomState,
        changeRound,
        // Round actions
        r1Score,
        r1Break,
        r1Bank,
        r1PassTurn,
        r2AwardPoint,
        r2Foul,
        r2TimeFreeze,
        r3InterceptBuzz,
        r3RecordShot,
        r4Bid,
        r4ResolveBid,
        sendTaunt
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);

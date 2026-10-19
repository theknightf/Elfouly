import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { CHARACTERS } from '../data/characters';
import { TRIVIA_BANK, PASSWORD_WORDS, PENALTY_QUESTIONS, AUCTION_TOPICS, PENALTY_CATEGORIES } from '../data/questions';
import { TOURNAMENT_STRUCTURE } from '../data/tournamentStructure';
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

  // Match countdown state: null | 3 | 2 | 1 | 0
  const [countdown, setCountdown] = useState(null);

  // Fallback / Offline local game state (so the entire app is 100% playable standalone or synced)
  const [roomState, setRoomState] = useState({
    code: 'ARENA',
    status: 'lobby',
    tournamentStructure: TOURNAMENT_STRUCTURE,
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
    // Round 1: 48 questions total (24 per team, 4 segments x 12 questions, split [6, 6])
    round1: {
      activeTeam: 'team_a',
      answeringPlayerId: 'p1',
      readerPlayerId: 'p3',
      segmentIndex: 0,
      subBatchIndex: 0,
      subBatchQuestionsAnswered: 0,
      segmentQuestionsAnswered: 0,
      totalQuestionsAnswered: 0,
      totalQuestions: 48,
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
      totalQuestions: 5,
      currentWord: PASSWORD_WORDS[0],
      timer: 45,
      isTimerRunning: false,
      fouls: { team_a: 0, team_b: 0 }
    },
    round3: {
      turnIndex: 0,
      totalShots: 10,
      currentKickerId: 'p1',
      currentGoalieId: 'p3',
      kickerTeam: 'team_a',
      currentCategory: PENALTY_CATEGORIES[0],
      phase: 'duelist_selection', // 'duelist_selection' | 'shootout'
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

  // Check URL parameters for dynamic screen separation (?view=controller & ?room=ARENA)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view') || urlParams.get('mode');
      if (viewParam === 'controller' || viewParam === 'mobile') {
        setActiveTabMode('mobile_controller');
      }
      const roomParam = urlParams.get('room');
      if (roomParam) {
        setRoomCode(roomParam.toUpperCase());
        setRoomState(prev => ({ ...prev, code: roomParam.toUpperCase() }));
      }
    } catch (e) {
      // ignore
    }
  }, []);

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

    s.on('error_message', (msg) => {
      showToast('تنبيه الساحة ⚠️', msg);
    });

    s.on('countdown_tick', ({ count }) => {
      setCountdown(count);
      if (count === 3) sounds.playWhistle();
      else if (count === 2) sounds.playStreakUp(2);
      else if (count === 1) sounds.playStreakUp(4);
      else if (count === 0) {
        sounds.playGoalRoar();
        fireConfetti();
        setTimeout(() => setCountdown(null), 1200);
      }
    });

    s.on('countdown_cancelled', ({ reason }) => {
      setCountdown(null);
      showToast('إلغاء العد التنازلي ⚠️', reason || 'انقطع اتصال أحد اللاعبين!');
    });

    s.on('match_started', () => {
      setCountdown(null);
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

  // Host action: triggers 3-second synchronized countdown
  const startMatchCountdown = () => {
    const currentCode = roomCode || roomState.code || 'ARENA';
    if (socket && isConnected) {
      socket.emit('start_match_countdown', { roomCode: currentCode });
    } else {
      // Local fallback countdown
      const connectedCount = (roomState.players || []).length;
      if (connectedCount < 4) {
        showToast('العدد غير مكتمل ⚠️', `الساحة تحتاج 4 لاعبين على الأقل لبدء المباراة (${connectedCount}/4)`);
        return;
      }

      setCountdown(3);
      sounds.playWhistle();
      setTimeout(() => {
        setCountdown(2);
        sounds.playStreakUp(2);
        setTimeout(() => {
          setCountdown(1);
          sounds.playStreakUp(4);
          setTimeout(() => {
            setCountdown(0);
            sounds.playGoalRoar();
            fireConfetti();
            setTimeout(() => {
              setCountdown(null);
              changeRound('round1');
            }, 800);
          }, 1000);
        }, 1000);
      }, 1000);
    }
  };

  // Create room action
  const createRoom = (playerName, characterId) => {
    if (socket && isConnected) {
      socket.emit('create_room', { playerName, characterId });
    } else {
      const digits = '0123456789';
      let num = '';
      for (let i = 0; i < 4; i++) {
        num += digits.charAt(Math.floor(Math.random() * digits.length));
      }
      const newCode = `QZ-${num}`;
      setRoomCode(newCode);
      setIsHost(true);
      const char = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
      const hostPlayer = {
        id: 'host_p1',
        name: playerName || char.name,
        character: char,
        team: 'team_a',
        isHost: true,
        scoreContribution: 0
      };
      setCurrentPlayer(hostPlayer);
      setRoomState(prev => ({
        ...prev,
        code: newCode,
        status: 'lobby',
        players: [hostPlayer]
      }));
      showToast('تم إنشاء الساحة!', `كود الغرفة: ${newCode}`);
    }
  };

  // Join room action
  const joinRoom = (code, playerName, characterId, teamPreference) => {
    const cleanCode = String(code || '').toUpperCase().trim();
    if (socket && isConnected) {
      socket.emit('join_room', {
        roomCode: cleanCode,
        playerName,
        characterId,
        teamPreference
      });
    } else {
      setRoomCode(cleanCode);
      setIsHost(false);
      const char = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[1];
      const newPlayer = {
        id: `p_${Date.now()}`,
        name: playerName || char.name,
        character: char,
        team: teamPreference || 'team_b',
        isHost: false,
        scoreContribution: 0
      };
      setCurrentPlayer(newPlayer);
      setRoomState(prev => {
        const filtered = (prev.players || []).filter(p => p.id !== newPlayer.id);
        return {
          ...prev,
          code: cleanCode,
          players: [...filtered, newPlayer]
        };
      });
      showToast('نورت الساحة يا كابتن!', `دخلت كود: ${cleanCode}`);
    }
  };

  // Quick bot player generator to help solo testing reach 4/4
  const addDemoPlayer = () => {
    const currentCode = roomCode || roomState.code || 'ARENA';
    if (socket && isConnected) {
      socket.emit('add_demo_player', { roomCode: currentCode });
    } else {
      setRoomState(prev => {
        const currentPlayers = prev.players || [];
        if (currentPlayers.length >= 4) return prev;
        const availableChars = CHARACTERS.filter(c => !currentPlayers.some(p => p.character?.id === c.id));
        const nextChar = availableChars[0] || CHARACTERS[currentPlayers.length % CHARACTERS.length];
        const teamACount = currentPlayers.filter(p => p.team === 'team_a').length;
        const teamBCount = currentPlayers.filter(p => p.team === 'team_b').length;
        const team = teamACount <= teamBCount ? 'team_a' : 'team_b';
        const botPlayer = {
          id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          name: nextChar.name,
          character: nextChar,
          team: team,
          isHost: false,
          scoreContribution: 0
        };
        return {
          ...prev,
          players: [...currentPlayers, botPlayer]
        };
      });
      showToast('انضمام لاعب محاكي 🤖', 'تمت إضافة لاعب جديد لاكتمال نصاب الـ 4 لاعبين!');
    }
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
          const randomCat = PENALTY_CATEGORIES[Math.floor(Math.random() * PENALTY_CATEGORIES.length)];
          next.round3.currentCategory = randomCat;
          next.round3.phase = 'duelist_selection';
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

  // Local helper to advance Round 1 quota offline
  const advanceR1LocalQuota = (r1, players, teams) => {
    r1.subBatchQuestionsAnswered = (r1.subBatchQuestionsAnswered || 0) + 1;
    r1.segmentQuestionsAnswered = (r1.segmentQuestionsAnswered || 0) + 1;
    r1.totalQuestionsAnswered = (r1.totalQuestionsAnswered || 0) + 1;

    const teamAPlayers = players.filter(p => p.team === 'team_a');
    const teamBPlayers = players.filter(p => p.team === 'team_b');

    if (r1.totalQuestionsAnswered >= 48) {
      sounds.playWhistle();
      showToast('🏁 اكتملت جولة "1 تو"!', 'تم إنجاز حصة الـ 48 سؤالاً بالتساوي (24 لكل فريق)!');
      return;
    }

    if (r1.subBatchQuestionsAnswered >= 6) {
      if (r1.segmentQuestionsAnswered < 12) {
        r1.subBatchIndex = 1;
        r1.subBatchQuestionsAnswered = 0;
        const activePlayers = r1.activeTeam === 'team_a' ? teamAPlayers : teamBPlayers;
        if (activePlayers.length > 1) {
          const currentIdx = activePlayers.findIndex(p => p.id === r1.answeringPlayerId);
          r1.answeringPlayerId = activePlayers[(currentIdx + 1) % activePlayers.length].id;
        }
        showToast('الفقرة الفرعية الثانية (6 أسئلة أخرى)', 'انتقل الدور للزميل التالي في نفس الفريق!');
      } else {
        r1.segmentIndex = (r1.segmentIndex || 0) + 1;
        r1.segmentQuestionsAnswered = 0;
        r1.subBatchIndex = 0;
        r1.subBatchQuestionsAnswered = 0;
        r1.pendingPoints = 0;
        r1.streak = 0;
        const targetTurns = ['team_a', 'team_b', 'team_a', 'team_b'];
        r1.activeTeam = targetTurns[r1.segmentIndex % 4];
        const activePlayers = r1.activeTeam === 'team_a' ? teamAPlayers : teamBPlayers;
        const opposingPlayers = r1.activeTeam === 'team_a' ? teamBPlayers : teamAPlayers;
        if (activePlayers.length > 0) {
          r1.answeringPlayerId = activePlayers[r1.segmentIndex % activePlayers.length].id;
        }
        if (opposingPlayers.length > 0) {
          r1.readerPlayerId = opposingPlayers[r1.segmentIndex % opposingPlayers.length].id;
        }
        sounds.playWhistle();
        showToast(`تحويل الفقرة (${r1.segmentIndex + 1} من 4)`, `الدور الآن على ${teams[r1.activeTeam]?.name}`);
      }
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
        advanceR1LocalQuota(r1, prev.players, prev.teams);
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
        advanceR1LocalQuota(r1, prev.players, prev.teams);
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
        r2.currentWordIndex = (r2.currentWordIndex || 0) + 1;
        const nextIdx = r2.currentWordIndex % PASSWORD_WORDS.length;
        r2.currentWord = PASSWORD_WORDS[nextIdx];
        if (r2.currentWordIndex >= 5) {
          sounds.playWhistle();
          showToast('🏁 اكتملت جولة "اديني في سري"!', 'تم إنجاز 5 بطاقات سرية!');
        }
        return { ...prev, teams, round2: r2 };
      });
    }
  };

  const r2SkipCard = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_skip_card', { roomCode });
    } else {
      sounds.playBuzzer();
      setRoomState(prev => {
        const r2 = { ...prev.round2 };
        r2.currentWordIndex = (r2.currentWordIndex || 0) + 1;
        const nextIdx = r2.currentWordIndex % PASSWORD_WORDS.length;
        r2.currentWord = PASSWORD_WORDS[nextIdx];
        if (r2.currentWordIndex >= 5) {
          sounds.playWhistle();
          showToast('🏁 اكتملت جولة "اديني في سري"!', 'تم إنجاز 5 بطاقات سرية!');
        }
        return { ...prev, round2: r2 };
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

        const teamAPlayers = prev.players.filter(p => p.team === 'team_a');
        const teamBPlayers = prev.players.filter(p => p.team === 'team_b');

        if (r3.kickerTeam === 'team_a') {
          r3.currentKickerId = teamAPlayers[r3.turnIndex % teamAPlayers.length]?.id;
          r3.currentGoalieId = teamBPlayers[r3.turnIndex % teamBPlayers.length]?.id;
        } else {
          r3.currentKickerId = teamBPlayers[r3.turnIndex % teamBPlayers.length]?.id;
          r3.currentGoalieId = teamAPlayers[r3.turnIndex % teamAPlayers.length]?.id;
        }

        const nextCat = PENALTY_CATEGORIES[Math.floor(Math.random() * PENALTY_CATEGORIES.length)];
        r3.currentCategory = nextCat;
        r3.phase = 'duelist_selection';

        const nextQIdx = r3.turnIndex % PENALTY_QUESTIONS.length;
        r3.currentQuestion = PENALTY_QUESTIONS[nextQIdx];

        if (r3.turnIndex >= 10) {
          sounds.playWhistle();
          showToast('🏁 انتهت ركلات الجزاء (10 ركلات)!', 'جاهزون لجولة المزاد مين يزوّد!');
        }

        return { ...prev, teams, round3: r3 };
      });
    }
  };

  const r3SelectDuelists = (kickerId, goalieId) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r3_select_duelists', { roomCode, kickerId, goalieId });
    } else {
      setRoomState(prev => {
        const r3 = { ...prev.round3 };
        if (kickerId) r3.currentKickerId = kickerId;
        if (goalieId) r3.currentGoalieId = goalieId;
        return { ...prev, round3: r3 };
      });
    }
  };

  const r3StartShootout = () => {
    sounds.playWhistle();
    if (socket && isConnected && roomCode) {
      socket.emit('r3_start_shootout', { roomCode });
    } else {
      setRoomState(prev => ({
        ...prev,
        round3: {
          ...prev.round3,
          phase: 'shootout',
          interceptBuzzedBy: null
        }
      }));
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

  const r4UseLifeline = (lifelineType) => {
    const team = currentPlayer?.team || roomState?.round4?.highestBidderTeam || 'team_a';
    if (socket && isConnected && roomCode) {
      socket.emit('r4_use_lifeline', { roomCode, team, lifelineType });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        if (!r4.usedLifelines) r4.usedLifelines = { team_a: [], team_b: [] };
        if (!r4.usedLifelines[team]) r4.usedLifelines[team] = [];
        if (r4.usedLifelines[team].includes(lifelineType)) return prev;
        r4.usedLifelines[team].push(lifelineType);
        if (lifelineType === 'call_friend') {
          r4.timer += 20;
          sounds.playBid();
          showToast('📞 اتصل بصديق (+20 ثانية)', 'تم تمديد الوقت 20 ثانية إضافية!');
        } else if (lifelineType === 'rival_hint') {
          sounds.playBid();
          const hint = r4.currentTopic?.validItems?.[0] || 'إجابة مفتاحية';
          showToast('💡 هينت من الخصم!', `تلميح الخصم يكشف: "${hint}"`);
        }
        return { ...prev, round4: r4 };
      });
    }
  };

  const r4ToggleItem = (item) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r4_toggle_item', { roomCode, item });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        if (!r4.itemsNamed) r4.itemsNamed = [];
        if (r4.itemsNamed.includes(item)) {
          r4.itemsNamed = r4.itemsNamed.filter(i => i !== item);
        } else {
          r4.itemsNamed.push(item);
          sounds.playCorrect();
        }
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

        r4.currentTopicIndex = (r4.currentTopicIndex || 0) + 1;
        r4.phase = 'resolved';

        if (r4.currentTopicIndex >= 4) {
          sounds.playFanfare();
          fireConfetti();
          showToast('🏁 اكتملت جولة المزاد (4 موضوعات)!', 'حان وقت تتويج بطل الساحة وإعلان النتائج النهائية 👑');
        } else {
          const nextTopic = AUCTION_TOPICS[r4.currentTopicIndex % AUCTION_TOPICS.length];
          r4.currentTopic = nextTopic;
          r4.highestBid = nextTopic.minBid;
          r4.timer = 60;
          r4.itemsNamed = [];
          r4.phase = 'bidding';
          r4.usedLifelines = { team_a: [], team_b: [] };
        }

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
        countdown,
        setCountdown,
        startMatchCountdown,
        createRoom,
        joinRoom,
        addDemoPlayer,
        // Round actions
        r1Score,
        r1Break,
        r1Bank,
        r1PassTurn,
        r2AwardPoint,
        r2SkipCard,
        r2Foul,
        r2TimeFreeze,
        r3InterceptBuzz,
        r3RecordShot,
        r3SelectDuelists,
        r3StartShootout,
        r4Bid,
        r4UseLifeline,
        r4ToggleItem,
        r4ResolveBid,
        sendTaunt
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);

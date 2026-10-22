import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { PASSWORD_WORDS, AUCTION_TOPICS, PENALTY_CATEGORIES } from '../data/questions';
import { TOURNAMENT_STRUCTURE } from '../data/tournamentStructure';
import {
  buildLocalR1TurnPlan,
  drawLocalR1Question,
  drawLocalRandomQuestion,
  drawLocalCategoryQuestion,
  resetLocalQuestionSession,
  shuffleLocal
} from '../utils/localQuestionEngine';
import { sounds } from '../utils/soundEffects';
import { getServerUrl } from '../utils/serverUrl';
import { createSupabaseSocket } from '../services/supabaseMultiplayerService';
import { CHARACTERS } from '../data/characters';
import { calculateBonus, isGeneralCategory } from '../utils/penaltyRules';

export const CONNECTION_STATUS_MESSAGES = {
  connecting: 'بنتصل بالسيرفر…',
  connected: 'لايف',
  waking_up: 'السيرفر بيصحى، استنى لحد دقيقة',
  failed: 'مش قادرين نوصل للسيرفر',
  misconfigured: 'السيرفر مش متظبط. صاحب اللعبة لازم يضبط VITE_SERVER_URL'
};

const GameContext = createContext();

const SESSION_STORAGE_KEY = 'quizArenaSession';
const LOCAL_ROOM_ID = 'local_room';

function mapLocalR1Question(question, slot) {
  return {
    question: question.question_text,
    answer: question.correct_answer,
    categoryName: question.category,
    slotType: slot.slotType,
    funFact: slot.slotType === 'specialty'
      ? 'سؤال من تخصص اللاعب المجيب.'
      : 'سؤال عشوائي من بنك الجولة الأولى كله.'
  };
}

function dispatchLocalR1Question(r1, players) {
  if (r1.totalQuestionsAnswered >= 48) {
    r1.currentQuestion = null;
    return false;
  }

  const answeringPlayer = players.find(player => player.id === r1.answeringPlayerId);
  const turnKey = `${r1.segmentIndex}:${r1.subBatchIndex}:${r1.answeringPlayerId}`;

  if (!Array.isArray(r1.turnPlan) || r1.turnPlanKey !== turnKey || r1.turnPlanIndex >= r1.turnPlan.length) {
    r1.turnPlan = buildLocalR1TurnPlan(answeringPlayer?.character?.id);
    r1.turnPlanKey = turnKey;
    r1.turnPlanIndex = 0;
  }

  const slot = r1.turnPlan[r1.turnPlanIndex];
  if (!slot) {
    r1.currentQuestion = null;
    return false;
  }

  const question = drawLocalR1Question({
    roomId: LOCAL_ROOM_ID,
    mode: 'one_two_bank',
    characterId: answeringPlayer?.character?.id,
    slotType: slot.slotType,
    category: slot.category
  });

  if (!question) {
    r1.currentQuestion = null;
    return false;
  }

  r1.turnPlanIndex += 1;
  r1.currentQuestionIndex += 1;
  r1.currentQuestion = mapLocalR1Question(question, slot);
  return true;
}

function mapLocalPasswordCard(question) {
  return {
    target: question.question_text,
    forbidden: question.forbidden_words || ['كلمة 1', 'كلمة 2', 'كلمة 3', 'كلمة 4'],
    category: question.category,
    clueIdea: 'خمن الكلمة بدون نطق الممنوعات الأربعة!'
  };
}

function drawLocalPasswordCard() {
  const question = drawLocalRandomQuestion('edini_fi_seri', LOCAL_ROOM_ID);
  return question ? mapLocalPasswordCard(question) : PASSWORD_WORDS[0];
}

function nextLocalR2Card(r2, players) {
  const nextIndex = (r2.currentWordIndex || 0) + 1;
  const nextCard = {
    ...r2,
    currentWordIndex: nextIndex,
    timeFreezeUsed: false,
    isComplete: nextIndex >= 5
  };
  if (nextIndex < 5) {
    Object.assign(nextCard, buildLocalR2Roles(players, nextIndex, {
      toggleTurn: true,
      activeTurnTeam: r2.activeTurnTeam
    }));
    nextCard.currentWord = drawLocalPasswordCard();
  } else {
    nextCard.currentWord = null;
    nextCard.isTimerRunning = false;
  }
  return nextCard;
}

function buildLocalR2Roles(players, cardIndex, { toggleTurn = false, activeTurnTeam = 'team_a' } = {}) {
  const teamA = players.filter(player => player.team === 'team_a');
  const teamB = players.filter(player => player.team === 'team_b');
  const teamARoster = teamA.length > 0 ? teamA : [{ id: 'p1' }, { id: 'p2' }];
  const teamBRoster = teamB.length > 0 ? teamB : [{ id: 'p3' }, { id: 'p4' }];
  const nextTurn = toggleTurn
    ? (activeTurnTeam === 'team_a' ? 'team_b' : 'team_a')
    : activeTurnTeam;

  const activeClueGiverA = teamARoster[cardIndex % teamARoster.length].id;
  const activeClueGiverB = teamBRoster[cardIndex % teamBRoster.length].id;

  return {
    activeClueGiverA,
    activeClueGiverB,
    activeTurnTeam: nextTurn,
    refereePlayerId: nextTurn === 'team_a' ? activeClueGiverB : activeClueGiverA
  };
}

function mapLocalAuctionTopic(question) {
  return {
    topic: question.question_text,
    validItems: question.acceptable_answers || [],
    category: question.category,
    minBid: 3,
    maxPossible: question.acceptable_answers?.length || 3,
    hint: 'أعلى مزايدة تكسب التحدي!'
  };
}

function buildLocalAuctionDeck() {
  const topics = [];
  for (let index = 0; index < 4; index++) {
    const question = drawLocalRandomQuestion('meen_yezawwed', LOCAL_ROOM_ID);
    if (!question) break;
    topics.push(mapLocalAuctionTopic(question));
  }
  if (topics.length === 0) return shuffleLocal(AUCTION_TOPICS).slice(0, 4);
  return topics;
}

function readSavedSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.roomCode || !parsed?.playerToken) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveSession(roomCode, playerToken) {
  if (!roomCode || !playerToken) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ roomCode, playerToken }));
  } catch (e) {
    // ignore storage failures
  }
}

function clearSavedSession() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    // ignore storage failures
  }
}

export function GameProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [reconnectCounter, setReconnectCounter] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState('arena'); // 'arena' (TV/host view) | 'mobile_controller'

  const reconnect = () => {
    setReconnectCounter(prev => prev + 1);
  };

  // Notification toast
  const [toast, setToast] = useState(null);

  // Last server-side action error (shown under the relevant form field)
  const [actionError, setActionError] = useState(null);

  // Match countdown state: null | 3 | 2 | 1 | 0
  const [countdown, setCountdown] = useState(null);

  // Clean room state (the server is the only source of truth)
  const [roomState, setRoomState] = useState({
    code: '',
    status: 'lobby',
    tournamentStructure: TOURNAMENT_STRUCTURE,
    players: [],
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
      currentQuestion: null,
      timer: 30,
      isTimerRunning: false,
      history: []
    },
    round2: {
      ...buildLocalR2Roles([], 0),
      currentWordIndex: 0,
      totalQuestions: 5,
      currentWord: null,
      isComplete: false,
      timeFreezeUsed: false,
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
      currentQuestion: null,
      timer: 20,
      isTimerRunning: false,
      interceptBuzzedBy: null,
      tieBreakActive: false,
      tieBreakData: null,
      isSuddenDeath: false,
      suddenDeathRound: 0,
      isComplete: false,
      shotsHistory: []
    },
    round4: {
      currentTopicIndex: 0,
      currentTopic: AUCTION_TOPICS[0],
      topicId: 'local-topic-0',
      highestBid: 3,
      highestBidderTeam: null,
      highestBidderPlayerId: null,
      timer: 60,
      isTimerRunning: false,
      phase: 'bidding',
      topicDeck: [],
      itemsNamed: [],
      usedLifelines: { team_a: [], team_b: [] }
    },
    messages: []
  });

  // Check URL parameters for dynamic screen separation (?view=controller)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view') || urlParams.get('mode');
      if (viewParam === 'controller' || viewParam === 'mobile') {
        setActiveTabMode('mobile_controller');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Socket setup
  useEffect(() => {
    let isCancelled = false;
    let wakingTimer = null;
    let failureTimer = null;
    let pingTimer = null;
    let socketInstance = null;

    const isExplicitSocketIo = import.meta.env.VITE_MULTIPLAYER_PROVIDER === 'socketio';
    const serverUrl = getServerUrl();
    const useSupabase = !isExplicitSocketIo;

    const attachListeners = (s) => {
      const tryRejoin = () => {
        const saved = readSavedSession();
        if (saved) {
          s.emit('rejoin_room', { roomCode: saved.roomCode, playerToken: saved.playerToken });
        }
      };

      s.on('connect', () => {
        clearTimeout(wakingTimer);
        clearTimeout(failureTimer);
        setConnectionStatus('connected');
        setIsConnected(true);
        tryRejoin();

        // Fair timing: send ping every 3 seconds to measure RTT
        clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (s.connected) {
            s.emit('latency_ping', { start: Date.now() });
          }
        }, 3000);
      });

      s.on('latency_pong', ({ start } = {}) => {
        if (typeof start === 'number') {
          const rtt = Math.max(0, Date.now() - start);
          s.emit('latency_report', { rtt });
        }
      });

      s.on('disconnect', (reason) => {
        clearInterval(pingTimer);
        setIsConnected(false);
        if (reason !== 'io client disconnect' && reason !== 'client_closed') {
          setConnectionStatus('connecting');
          clearTimeout(wakingTimer);
          wakingTimer = setTimeout(() => {
            if (!isCancelled) {
              setConnectionStatus((curr) => (curr === 'connecting' ? 'waking_up' : curr));
            }
          }, 4000);
        }
      });

      s.on('room_state_updated', (updatedRoom) => {
        setRoomState(updatedRoom);
        if (updatedRoom?.viewerId) {
          setIsHost(updatedRoom.hostId === updatedRoom.viewerId);
        }
      });

      s.on('room_created', ({ roomCode, playerToken, player, room }) => {
        setRoomCode(roomCode);
        setCurrentPlayer(player);
        setIsHost(true);
        setRoomState(room);
        setActionError(null);
        saveSession(roomCode, playerToken);
        showToast('تم إنشاء الساحة!', `كود الغرفة: ${roomCode}`);
      });

      s.on('joined_room', ({ roomCode, playerToken, player, room }) => {
        setRoomCode(roomCode);
        setCurrentPlayer(player);
        setIsHost(player.isHost);
        setRoomState(room);
        setActionError(null);
        saveSession(roomCode, playerToken);
        showToast('نورت الساحة يا كابتن!', `دخلت كود: ${roomCode}`);
      });

      s.on('rejoined_room', ({ roomCode, playerToken, player, room }) => {
        setRoomCode(roomCode);
        setCurrentPlayer(player);
        setIsHost(player.isHost);
        setRoomState(room);
        setActionError(null);
        saveSession(roomCode, playerToken);
        showToast('رجعت تاني يا كابتن! ⚡', `اتصلت بساحة: ${roomCode}`);
      });

      s.on('rejoin_failed', ({ message, field, reason } = {}) => {
        clearSavedSession();
        const isRoomGone = reason === 'room_not_found' || /Room not found|مش موجودة|اتقفلت|خلصت/i.test(message || '');
        const displayMessage = isRoomGone
          ? 'الغرفة دي خلصت، اعمل غرفة جديدة'
          : (message || 'جلسة الاستعادة مش صالحة');
        setActionError({ message: displayMessage, field: 'general', action: 'rejoin', at: Date.now() });
        setRoomCode('');
        setCurrentPlayer(null);
        setIsHost(false);
        setRoomState(prev => ({ ...prev, code: '', status: 'lobby', players: [], messages: [] }));
      });

      s.on('action_error', (payload = {}) => {
        setActionError({ ...payload, at: payload.at || Date.now() });
      });

      s.on('profile_updated', ({ player } = {}) => {
        if (!player) return;
        setCurrentPlayer(player);
        setActionError(null);
        showToast('تم تثبيت الاختيار! ✨', `اخترت: ${player.character?.name || 'شخصيتك'}`);
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
        const message = typeof msg === 'string' ? msg : (msg?.message || '');
        if (message) showToast('تنبيه الساحة ⚠️', message);
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
    };

    if (useSupabase) {
      setConnectionStatus('connecting');
      setIsConnected(false);

      const s = createSupabaseSocket();
      socketInstance = s;
      attachListeners(s);
      setSocket(s);

      return () => {
        isCancelled = true;
        clearInterval(pingTimer);
        s.disconnect();
      };
    }

    if (!serverUrl) {
      setConnectionStatus('misconfigured');
      setIsConnected(false);
      return;
    }

    setConnectionStatus('connecting');
    setIsConnected(false);

    // If first connection takes > 4 seconds, show "السيرفر بيصحى، استنى لحد دقيقة"
    wakingTimer = setTimeout(() => {
      if (!isCancelled) {
        setConnectionStatus((curr) => (curr === 'connecting' ? 'waking_up' : curr));
      }
    }, 4000);

    // After 60 seconds of retries, switch to 'failed' if not connected
    failureTimer = setTimeout(() => {
      if (!isCancelled) {
        setConnectionStatus((curr) => (curr !== 'connected' && curr !== 'misconfigured' ? 'failed' : curr));
      }
    }, 60000);

    const initConnection = async () => {
      // Wake-up: call /api/health to wake sleeping host, retrying up to 20 times, 5 seconds apart
      let healthy = false;
      const maxRetries = 20;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (isCancelled) return;
        try {
          const controller = new AbortController();
          const fetchTimer = setTimeout(() => controller.abort(), 4500);
          const res = await fetch(`${serverUrl}/api/health`, { signal: controller.signal });
          clearTimeout(fetchTimer);
          if (res.ok) {
            healthy = true;
            break;
          }
        } catch (e) {
          // Host is sleeping or still starting
        }

        if (attempt < maxRetries - 1 && !isCancelled) {
          setConnectionStatus('waking_up');
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      // In production, if health check fails after all 10 retries, mark failed
      if (!healthy && !isCancelled && import.meta.env.PROD) {
        clearTimeout(wakingTimer);
        clearTimeout(failureTimer);
        setConnectionStatus('failed');
        return;
      }

      if (isCancelled) return;

      const s = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelayMax: 5000,
        timeout: 10000
      });
      socketInstance = s;
      attachListeners(s);
      setSocket(s);
    };

    initConnection();

    return () => {
      isCancelled = true;
      clearTimeout(wakingTimer);
      clearTimeout(failureTimer);
      clearInterval(pingTimer);
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [reconnectCounter]);

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
    const currentCode = roomCode || roomState.code;
    if (!currentCode) return;

    if (!socket || !isConnected) {
      showToast('مش متصل بالسيرفر', CONNECTION_STATUS_MESSAGES[connectionStatus] || 'بنتصل بالسيرفر…');
      return;
    }

    socket.emit('start_match_countdown', { roomCode: currentCode });
  };

  // Create room action
  const createRoom = (playerName, characterId) => {
    if (!socket) {
      showToast('مش متصل بالسيرفر', CONNECTION_STATUS_MESSAGES[connectionStatus] || 'بنتصل بالسيرفر…');
      setActionError({
        message: 'مش متصل بالسيرفر حالياً.. جاري إعادة المحاولة',
        field: 'general',
        action: 'create_room'
      });
      return;
    }

    clearSavedSession();
    setActionError(null);
    try {
      socket.emit('create_room', {
        playerName: (playerName && playerName.trim()) || 'كابتن فولي 🦁',
        characterId: characterId || 'faris'
      });
    } catch (err) {
      console.error('Failed to emit create_room:', err);
      setActionError({
        message: 'تعذر إنشاء الغرفة.. جرب تاني',
        field: 'general',
        action: 'create_room'
      });
    }
  };

  // Join room action
  const joinRoom = (code, playerName, characterId, teamPreference) => {
    if (!socket || !isConnected) {
      showToast('مش متصل بالسيرفر', CONNECTION_STATUS_MESSAGES[connectionStatus] || 'بنتصل بالسيرفر…');
      return;
    }

    const cleanCode = String(code || '').toUpperCase().trim();
    setActionError(null);
    socket.emit('join_room', {
      roomCode: cleanCode,
      playerName,
      characterId,
      teamPreference
    });
  };

  // Choose character / team inside the lobby (server validates uniqueness and caps)
  const updatePlayerProfile = (characterId, team) => {
    const currentCode = roomCode || roomState.code;
    if (!currentCode) return;

    if (!socket || !isConnected) {
      showToast('بنتصل بالسيرفر… ثانية واحدة ⏳', 'استنى لحظة لحد ما الاتصال يرجع.');
      return;
    }

    setActionError(null);
    socket.emit('update_player_profile', {
      roomCode: currentCode,
      characterId,
      team
    });
  };

  // Quick bot player generator to help solo testing reach 4/4
  const addDemoPlayer = () => {
    const currentCode = roomCode || roomState.code;
    if (!currentCode) return;

    if (!socket || !isConnected) {
      showToast('بنتصل بالسيرفر… ثانية واحدة ⏳', 'استنى لحظة لحد ما الاتصال يرجع.');
      return;
    }

    socket.emit('add_demo_player', { roomCode: currentCode });
  };

  const clearActionError = () => setActionError(null);

  // Host Team Management: update team names freely before match start
  const updateTeamNames = (names) => {
    if (socket && isConnected && roomCode) {
      socket.emit('update_team_names', { roomCode, names });
    }
    setRoomState(prev => ({
      ...prev,
      teams: {
        ...prev.teams,
        team_a: { ...prev.teams.team_a, name: names?.team_a || prev.teams.team_a.name },
        team_b: { ...prev.teams.team_b, name: names?.team_b || prev.teams.team_b.name }
      }
    }));
    showToast('تم تحديث أسماء الفرق! 🏷️', 'تم حفظ التعديلات بنجاح.');
  };

  // Host Team Management: reassign player across teams
  const reassignPlayerTeam = (playerId, targetTeam) => {
    if (!['team_a', 'team_b'].includes(targetTeam)) return;
    if (socket && isConnected && roomCode) {
      socket.emit('reassign_player_team', { roomCode, playerId, team: targetTeam });
    }
    setRoomState(prev => {
      const currentTeamCount = prev.players.filter(p => p.team === targetTeam).length;
      const targetPlayer = prev.players.find(p => p.id === playerId);
      if (targetPlayer?.team !== targetTeam && currentTeamCount >= 2) {
        showToast('الفريق المقابل مكتمل!', 'كل فريق بحد أقصى لاعبين (2/2).');
        return prev;
      }
      return {
        ...prev,
        players: prev.players.map(p => p.id === playerId ? { ...p, team: targetTeam } : p)
      };
    });
  };

  // Host Team Management: reorder players within team (changes who answers first)
  const reorderTeamPlayers = (team, fromIndex, toIndex) => {
    if (socket && isConnected && roomCode) {
      socket.emit('reorder_team_players', { roomCode, team, fromIndex, toIndex });
    }
    setRoomState(prev => {
      const teamIndices = [];
      prev.players.forEach((p, idx) => {
        if (p.team === team) teamIndices.push(idx);
      });
      if (fromIndex < 0 || fromIndex >= teamIndices.length || toIndex < 0 || toIndex >= teamIndices.length) {
        return prev;
      }
      const updatedPlayers = [...prev.players];
      const idxA = teamIndices[fromIndex];
      const idxB = teamIndices[toIndex];
      const temp = updatedPlayers[idxA];
      updatedPlayers[idxA] = updatedPlayers[idxB];
      updatedPlayers[idxB] = temp;
      return { ...prev, players: updatedPlayers };
    });
  };

  // Host Team Management: swap teams
  const swapTeams = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('swap_teams', { roomCode });
    }
    setRoomState(prev => ({
      ...prev,
      players: prev.players.map(p => ({
        ...p,
        team: p.team === 'team_a' ? 'team_b' : 'team_a'
      }))
    }));
    showToast('تم تبديل الفرق! 🔄', 'تم تبديل توزيع اللاعبين بين الفريقين.');
  };

  // Single Judge assignment
  const setMatchJudge = (judgeId) => {
    if (socket && isConnected && roomCode) {
      socket.emit('set_match_judge', { roomCode, judgeId });
    }
    setRoomState(prev => ({
      ...prev,
      singleJudgeId: judgeId,
      matchJudgeId: judgeId
    }));
    const judgeName = roomState.players.find(p => p.id === judgeId)?.name || 'اللاعب';
    showToast('تعيين الحكم الوحيد 🛡️', `${judgeName} هو الحكم المكلّف لهذه المباراة.`);
  };

  // Socket or local fallback dispatchers
  const changeRound = (targetRound) => {
    if (socket && isConnected && roomCode) {
      socket.emit('change_round', { roomCode, targetRound });
    } else {
      // Local execution
      sounds.playWhistle();
      if (targetRound === 'round1') {
        resetLocalQuestionSession(LOCAL_ROOM_ID);
      }
      setRoomState(prev => {
        const next = { ...prev, status: targetRound };
        if (targetRound === 'round1') {
          next.round1 = {
            ...prev.round1,
            activeTeam: 'team_a',
            answeringPlayerId: prev.players.find(player => player.team === 'team_a')?.id || prev.players[0]?.id,
            segmentIndex: 0,
            subBatchIndex: 0,
            subBatchQuestionsAnswered: 0,
            segmentQuestionsAnswered: 0,
            totalQuestionsAnswered: 0,
            currentQuestionIndex: 0,
            streak: 0,
            pendingPoints: 0,
            currentQuestion: null,
            turnPlan: null,
            turnPlanKey: null,
            turnPlanIndex: 0,
            history: []
          };
          dispatchLocalR1Question(next.round1, next.players);
        } else if (targetRound === 'round2') {
          next.round2 = {
            ...next.round2,
            ...buildLocalR2Roles(next.players, 0),
            currentWordIndex: 0,
            currentWord: drawLocalPasswordCard(),
            isComplete: false,
            timeFreezeUsed: false,
            timer: 45,
            isTimerRunning: false,
            fouls: { team_a: 0, team_b: 0 }
          };
        } else if (targetRound === 'round3') {
          next.round3.turnIndex = 0;
          next.round3.kickerTeam = 'team_a';
          const randomCat = PENALTY_CATEGORIES[Math.floor(Math.random() * PENALTY_CATEGORIES.length)];
          next.round3.currentCategory = randomCat;
          next.round3.phase = 'duelist_selection';
          next.round3.currentQuestion = null;
          next.round3.interceptBuzzedBy = null;
          next.round3.tieBreakActive = false;
          next.round3.tieBreakData = null;
          next.round3.isComplete = false;
          next.round3.shotsHistory = [];
        } else if (targetRound === 'round4') {
          const topicDeck = buildLocalAuctionDeck();
          next.round4.currentTopicIndex = 0;
          next.round4.currentTopic = topicDeck[0] || AUCTION_TOPICS[0];
          next.round4.topicId = 'local-topic-0';
          next.round4.topicDeck = topicDeck;
          next.round4.highestBid = (topicDeck[0] || AUCTION_TOPICS[0]).minBid;
          next.round4.phase = 'bidding';
          next.round4.timer = 60;
          next.round4.itemsNamed = [];
          next.round4.usedLifelines = { team_a: [], team_b: [] };
          next.round4.highestBidderTeam = null;
          next.round4.highestBidderPlayerId = null;
        }
        return next;
      });
      showToast('انتقال الجولة', `بدأت جولة: ${targetRound}`);
    }
  };

  // Local helper to advance Round 1 quota offline.
  // Strict per-question alternation inside a 12-question team turn; the judge
  // seat stays fixed for the whole turn.
  const advanceR1LocalQuota = (r1, players, teams) => {
    if ((r1.totalQuestionsAnswered || 0) >= 48) return false;
    r1.subBatchQuestionsAnswered = (r1.subBatchQuestionsAnswered || 0) + 1;
    r1.segmentQuestionsAnswered = (r1.segmentQuestionsAnswered || 0) + 1;
    r1.totalQuestionsAnswered = (r1.totalQuestionsAnswered || 0) + 1;

    const teamAPlayers = players.filter(p => p.team === 'team_a');
    const teamBPlayers = players.filter(p => p.team === 'team_b');

    if (r1.totalQuestionsAnswered >= 48) {
      if (r1.pendingPoints > 0) {
        teams[r1.activeTeam].bank += r1.pendingPoints;
        teams[r1.activeTeam].score += r1.pendingPoints;
        r1.pendingPoints = 0;
      }
      sounds.playWhistle();
      showToast('🏁 اكتملت جولة "1 تو"!', 'تم إنجاز حصة الـ 48 سؤالاً بالتساوي (24 لكل فريق)!');
      return false;
    }

    if (r1.segmentQuestionsAnswered >= 12) {
      if (r1.pendingPoints > 0) {
        teams[r1.activeTeam].bank += r1.pendingPoints;
        teams[r1.activeTeam].score += r1.pendingPoints;
      }
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
      if (opposingPlayers.length > 0) {
        r1.readerPlayerId = opposingPlayers[r1.segmentIndex % opposingPlayers.length].id;
      }
      if (activePlayers.length > 0) {
        const nonJudge = activePlayers.find(p => p.id !== r1.readerPlayerId);
        r1.answeringPlayerId = nonJudge?.id || activePlayers[0].id;
      }
      sounds.playWhistle();
      showToast(`تحويل الفقرة (${r1.segmentIndex + 1} من 4)`, `الدور الآن على ${teams[r1.activeTeam]?.name}`);
      return true;
    }

    const activePlayers = r1.activeTeam === 'team_a' ? teamAPlayers : teamBPlayers;
    if (activePlayers.length > 1) {
      const currentIdx = activePlayers.findIndex(p => p.id === r1.answeringPlayerId);
      r1.answeringPlayerId = activePlayers[(currentIdx + 1) % activePlayers.length].id;
    }
    if (r1.subBatchQuestionsAnswered >= 6) {
      r1.subBatchIndex = 1;
      r1.subBatchQuestionsAnswered = 0;
    }
    return true;
  };

  // Round 1 Handlers (Manual Progression Control: NO auto-advancement)
  const r1Score = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_action_score', { roomCode, actionToken: roomState?.round1?.actionToken });
    } else {
      setRoomState(prev => {
        if ((prev.round1?.totalQuestionsAnswered || 0) >= 48 || !prev.round1?.currentQuestion) return prev;
        const r1 = { ...prev.round1 };
        const teams = { ...prev.teams };
        const nextStreak = Math.min(r1.streak + 1, 10);
        r1.streak = nextStreak;
        r1.pendingPoints = r1.streakLadder[nextStreak];
        r1.questionState = 'resolved';
        r1.lastResult = {
          correct: true,
          pointsEarned: r1.pendingPoints,
          streak: nextStreak,
          question: r1.currentQuestion,
          answererId: r1.answeringPlayerId,
          resolvedAt: Date.now()
        };
        sounds.playStreakUp(nextStreak);
        return { ...prev, teams, round1: r1 };
      });
    }
  };

  const r1Break = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_action_break', { roomCode, actionToken: roomState?.round1?.actionToken });
    } else {
      sounds.playBuzzer();
      setRoomState(prev => {
        if ((prev.round1?.totalQuestionsAnswered || 0) >= 48 || !prev.round1?.currentQuestion) return prev;
        const r1 = { ...prev.round1 };
        const teams = { ...prev.teams };
        const answeringPlayer = prev.players.find(p => p.id === r1.answeringPlayerId);
        if (answeringPlayer?.character?.id === 'abdelrahman_eltouny' && r1.streak > 1) {
          showToast('درع التوني بيلافيتا! 🍦', 'تم حماية الستريك وإنقاذ النقاط!');
          r1.streak = Math.max(1, r1.streak - 1);
          r1.pendingPoints = r1.streakLadder[r1.streak];
        } else {
          r1.streak = 0;
          r1.pendingPoints = 0;
        }
        r1.questionState = 'resolved';
        r1.lastResult = {
          correct: false,
          pointsEarned: 0,
          streak: r1.streak,
          question: r1.currentQuestion,
          answererId: r1.answeringPlayerId,
          resolvedAt: Date.now()
        };
        return { ...prev, teams, round1: r1 };
      });
    }
  };

  // Dedicated manual progression trigger for Round 1
  const r1NextQuestion = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_next_question', { roomCode });
    }
    setRoomState(prev => {
      if (!prev.round1) return prev;
      const r1 = { ...prev.round1 };
      const teams = { ...prev.teams };
      advanceR1LocalQuota(r1, prev.players, teams);
      if (r1.totalQuestionsAnswered >= 48) {
        r1.isComplete = true;
        r1.currentQuestion = null;
        r1.questionState = 'complete';
        return { ...prev, teams, round1: r1 };
      }
      dispatchLocalR1Question(r1, prev.players);
      r1.questionState = 'active';
      r1.lastResult = null;
      return { ...prev, teams, round1: r1 };
    });
  };


  const r1Bank = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_action_bank', { roomCode });
    } else {
      setRoomState(prev => {
        const r1 = { ...prev.round1 };
        const teamKey = r1.activeTeam;
        const amount = r1.pendingPoints;
        r1.lastDecision = 'bank';
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
        return { ...prev, round1: r1 };
      });
    }
  };

  const r1Continue = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_action_continue', { roomCode });
    } else {
      setRoomState(prev => ({
        ...prev,
        round1: { ...prev.round1, lastDecision: 'continue' }
      }));
    }
  };

  const r1PassTurn = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r1_pass_turn', { roomCode, actionToken: roomState?.round1?.actionToken });
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
  const r2NextCard = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_next_card', { roomCode });
    }
    setRoomState(prev => {
      if (!prev.round2) return prev;
      const r2 = nextLocalR2Card(prev.round2, prev.players);
      if (r2.currentWordIndex >= 5) {
        sounds.playWhistle();
        showToast('🏁 اكتملت جولة "اديني في سري"!', 'تم إنجاز 5 بطاقات سرية!');
      }
      return {
        ...prev,
        round2: {
          ...r2,
          cardState: r2.currentWordIndex >= 5 ? 'complete' : 'active',
          lastCardResult: null
        }
      };
    });
  };

  const r2AwardPoint = (team) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_award_point', { roomCode, team, actionToken: roomState?.round2?.actionToken });
    } else {
      sounds.playCorrect();
      setRoomState(prev => {
        if (prev.round2.isComplete || (prev.round2.currentWordIndex || 0) >= 5) return prev;
        const teams = { ...prev.teams };
        const targetTeam = team || prev.round2.activeTurnTeam || 'team_a';
        teams[targetTeam] = { ...teams[targetTeam], score: teams[targetTeam].score + 500 };
        const nextIndex = (prev.round2.currentWordIndex || 0) + 1;
        const r2 = nextLocalR2Card(prev.round2, prev.players);
        if (nextIndex >= 5) {
          sounds.playWhistle();
          showToast('🏁 اكتملت جولة "اديني في سري"!', 'تم إنجاز 5 بطاقات سرية!');
        }
        return {
          ...prev,
          teams,
          round2: {
            ...r2,
            cardState: 'resolved',
            lastCardResult: { team: targetTeam, scoreAdded: 500, word: prev.round2.currentWord?.target }
          }
        };
      });
    }
  };

  const r2SkipCard = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_skip_card', { roomCode, actionToken: roomState?.round2?.actionToken });
    } else {
      sounds.playBuzzer();
      setRoomState(prev => {
        if (prev.round2.isComplete || (prev.round2.currentWordIndex || 0) >= 5) return prev;
        const r2 = nextLocalR2Card(prev.round2, prev.players);
        if (r2.currentWordIndex >= 5) {
          sounds.playWhistle();
          showToast('🏁 اكتملت جولة "اديني في سري"!', 'تم إنجاز 5 بطاقات سرية!');
        }
        return {
          ...prev,
          round2: {
            ...r2,
            cardState: r2.currentWordIndex >= 5 ? 'complete' : 'active',
            lastCardResult: { skipped: true }
          }
        };
      });
    }
  };

  const r2Foul = (team) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r2_foul', { roomCode, team, actionToken: roomState?.round2?.actionToken });
    } else {
      sounds.playBuzzer();
      setRoomState(prev => {
        if (team !== (prev.round2.activeTurnTeam || 'team_a')) {
          showToast('🚫 دور الفريق الآخر', 'الحكم يحسم دور الفريق اللي بيلمّح دلوقتي فقط.');
          return prev;
        }
        const r2 = {
          ...prev.round2,
          fouls: { ...prev.round2.fouls, [team]: (prev.round2.fouls[team] || 0) + 1 },
          ...buildLocalR2Roles(prev.players, prev.round2.currentWordIndex || 0, {
            toggleTurn: true,
            activeTurnTeam: prev.round2.activeTurnTeam
          })
        };
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
      setRoomState(prev => {
        if (prev.round2.isComplete || prev.round2.timeFreezeUsed || !prev.round2.currentWord) return prev;
        showToast('تجميد الوقت الفندقي 🛎️', 'زياد الفندقي مد الوقت +10 ثواني كاملة!');
        return {
          ...prev,
          round2: { ...prev.round2, timer: prev.round2.timer + 10, timeFreezeUsed: true }
        };
      });
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
        if (prev.round3.isComplete || prev.round3.phase !== 'shootout') return prev;
        const r3 = { ...prev.round3 };
        const teams = { ...prev.teams };
        const kickingTeam = r3.kickerTeam;
        const defendingTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';

        const kicker = prev.players.find(p => p.id === r3.currentKickerId);
        const goalie = prev.players.find(p => p.id === r3.currentGoalieId);
        const categoryId = r3.currentCategory?.id || r3.currentQuestion?.category;

        let bonusAwarded = false;
        let bonusPoints = 0;

        if (result === 'goal') {
          teams[kickingTeam].score += 1000;
          teams[kickingTeam].penaltyScore = (teams[kickingTeam].penaltyScore || 0) + 1;
          const kickerAttrs = kicker?.attributes || kicker?.character?.attributes;
          const b = calculateBonus(kickerAttrs, categoryId, true);
          if (b.bonusAwarded) {
            bonusAwarded = true;
            bonusPoints = b.bonusPoints;
            teams[kickingTeam].score += b.bonusPoints * 500;
            teams[kickingTeam].bonusPoints = (teams[kickingTeam].bonusPoints || 0) + b.bonusPoints;
            showToast('🎯 بونص خارج التخصص!', `المسدد ${kicker?.name || ''} حقق نقطة بونص إضافية!`);
          }
        } else if (result === 'saved') {
          teams[defendingTeam].score += 800;
          teams[defendingTeam].penaltyScore = (teams[defendingTeam].penaltyScore || 0) + 1;
          const goalieAttrs = goalie?.attributes || goalie?.character?.attributes;
          const b = calculateBonus(goalieAttrs, categoryId, true);
          if (b.bonusAwarded) {
            bonusAwarded = true;
            bonusPoints = b.bonusPoints;
            teams[defendingTeam].score += b.bonusPoints * 500;
            teams[defendingTeam].bonusPoints = (teams[defendingTeam].bonusPoints || 0) + b.bonusPoints;
            showToast('🧤 بونص خارج التخصص!', `الحارس ${goalie?.name || ''} حقق نقطة بونص إضافية للتصدي!`);
          }
        }

        r3.shotsHistory.push({
          shotIndex: r3.turnIndex,
          round: Math.floor(r3.turnIndex / 2) + 1,
          team: kickingTeam,
          result: result,
          intercepted: !!r3.interceptBuzzedBy,
          bonusAwarded,
          bonusPoints,
          isSuddenDeath: !!r3.isSuddenDeath,
          suddenDeathRound: r3.suddenDeathRound || 0
        });

        // Set resolution state for manual progression without freezing or flashing
        r3.shotState = 'resolved';
        r3.phase = 'shot_resolved';
        r3.lastShotResult = {
          result,
          bonusAwarded,
          bonusPoints,
          kickerId: r3.currentKickerId,
          kickerName: kicker?.name,
          team: kickingTeam
        };

        // Check if shootout reached end of regulation or sudden death
        const completedKicks = r3.turnIndex + 1;
        if (completedKicks >= 10) {
          const scoreA = teams.team_a.penaltyScore || 0;
          const scoreB = teams.team_b.penaltyScore || 0;

          if (!r3.isSuddenDeath) {
            if (scoreA === scoreB) {
              r3.isSuddenDeath = true;
              r3.suddenDeathRound = 1;
              sounds.playWhistle();
              showToast('⚡ شوط الموت المفاجئ (Sudden Death)!', 'تعادل في الركلات الترجيحية! ركلة بركلة حتى الحسم!');
            } else {
              r3.phase = 'complete';
              r3.isComplete = true;
              sounds.playWhistle();
              showToast('🏁 انتهت ركلات الجزاء (10 ركلات)!', 'جاهزون لجولة المزاد مين يزوّد!');
            }
          } else {
            // Already in sudden death: evaluated after complete pairs of kicks (Team A + Team B)
            if (completedKicks % 2 === 0) {
              const lastTwo = r3.shotsHistory.slice(-2);
              const shotA = lastTwo.find(s => s.team === 'team_a');
              const shotB = lastTwo.find(s => s.team === 'team_b');
              const roundPtsA = (shotA?.result === 'goal' ? 1 : 0);
              const roundPtsB = (shotB?.result === 'goal' ? 1 : 0);

              if (roundPtsA !== roundPtsB) {
                r3.phase = 'complete';
                r3.isComplete = true;
                sounds.playWhistle();
                const winner = roundPtsA > roundPtsB ? (teams.team_a.name || 'فريق A') : (teams.team_b.name || 'فريق B');
                showToast('🏆 حُسمت في الموت المفاجئ!', `فاز ${winner} بعد شوط الموت المفاجئ!`);
              } else {
                r3.suddenDeathRound = (r3.suddenDeathRound || 1) + 1;
                showToast('⚡ استمرار الموت المفاجئ!', `تعادل في شوط الموت المفاجئ ${r3.suddenDeathRound - 1}! جولة جديدة.`);
              }
            }
          }
        }

        return { ...prev, teams, round3: r3 };
      });
    }
  };

  const r3SubmitAnswer = (option) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r3_submit_answer', { roomCode, option });
      return;
    }

    const currentQuestion = roomState?.round3?.currentQuestion;
    const norm = (value) => String(value || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
    const submitted = norm(option);
    const expected = norm(currentQuestion?.answer);
    const isCorrect = !!submitted && !!expected && submitted === expected;
    // Lock the shooter's answer; the single judge records Goal / Miss.
    setRoomState(prev => {
      if (prev.round3?.pendingAnswer) return prev;
      return {
        ...prev,
        round3: {
          ...prev.round3,
          pendingAnswer: {
            option,
            isCorrect,
            answerAt: Date.now(),
            answerMs: Math.max(0, Date.now() - (prev.round3.shotStartedAt || Date.now())),
            kickerId: prev.round3.currentKickerId
          }
        }
      };
    });
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
      setRoomState(prev => {
        const r3 = prev.round3;
        if (r3.isComplete || r3.turnIndex >= 10 || r3.phase !== 'duelist_selection') return prev;
        const category = r3.currentCategory || PENALTY_CATEGORIES[0];
        const question = drawLocalCategoryQuestion('hat_fi_qoraybi', category.id, LOCAL_ROOM_ID);
        if (!question) return prev;
        return {
          ...prev,
          round3: {
            ...r3,
            phase: 'shootout',
            currentQuestion: {
              question: question.question_text,
              answer: question.correct_answer,
              options: question.options || [],
              category: question.category,
              kickerHint: category.name
            },
            interceptBuzzedBy: null,
            interceptAt: null,
            shotStartedAt: Date.now(),
            pendingAnswer: null,
            tieBreakActive: false,
            tieBreakData: null
          }
        };
      });
    }
  };

  // Dedicated manual progression trigger for Round 3 (Penalty Shootout)
  const r3NextShot = () => {
    if (socket && isConnected && roomCode) {
      socket.emit('r3_next_shot', { roomCode });
    }
    setRoomState(prev => {
      if (!prev.round3) return prev;
      if (prev.round3.isComplete) return prev;

      const r3 = { ...prev.round3 };
      const nextTurn = r3.turnIndex + 1;
      r3.turnIndex = nextTurn;
      r3.kickerTeam = r3.kickerTeam === 'team_a' ? 'team_b' : 'team_a';

      const teamAPlayers = prev.players.filter(p => p.team === 'team_a');
      const teamBPlayers = prev.players.filter(p => p.team === 'team_b');

      if (r3.kickerTeam === 'team_a') {
        r3.currentKickerId = teamAPlayers[r3.turnIndex % Math.max(1, teamAPlayers.length)]?.id;
        r3.currentGoalieId = teamBPlayers[r3.turnIndex % Math.max(1, teamBPlayers.length)]?.id;
      } else {
        r3.currentKickerId = teamBPlayers[r3.turnIndex % Math.max(1, teamBPlayers.length)]?.id;
        r3.currentGoalieId = teamAPlayers[r3.turnIndex % Math.max(1, teamAPlayers.length)]?.id;
      }

      // Draw next question ensuring >= 50% General rule
      const isGeneralTurn = r3.turnIndex % 2 === 0;
      const generalCategories = PENALTY_CATEGORIES.filter(c => isGeneralCategory(c.id));
      const specialtyCategories = PENALTY_CATEGORIES.filter(c => !isGeneralCategory(c.id));
      const nextCat = isGeneralTurn
        ? (generalCategories[Math.floor(Math.random() * generalCategories.length)] || PENALTY_CATEGORIES[0])
        : (specialtyCategories[Math.floor(Math.random() * specialtyCategories.length)] || PENALTY_CATEGORIES[0]);

      const nextPenaltyQuestion = drawLocalCategoryQuestion('hat_fi_qoraybi', nextCat.id, LOCAL_ROOM_ID);
      r3.currentCategory = nextCat;
      r3.currentQuestion = nextPenaltyQuestion ? {
        question: nextPenaltyQuestion.question_text,
        answer: nextPenaltyQuestion.correct_answer,
        options: nextPenaltyQuestion.options || [],
        category: nextPenaltyQuestion.category,
        kickerHint: nextCat.name
      } : null;

      r3.shotState = 'selection';
      r3.lastShotResult = null;
      r3.phase = 'duelist_selection';
      r3.pendingAnswer = null;
      r3.interceptBuzzedBy = null;
      r3.tieBreakActive = false;
      r3.tieBreakData = null;

      return { ...prev, round3: r3 };
    });
  };

  // Unified manual progression triggers for Host / Admin Controls
  const nextQuestion = () => {
    if (roomState?.status === 'round1') {
      r1NextQuestion();
    } else if (roomState?.status === 'round2') {
      r2NextCard();
    } else if (roomState?.status === 'round3') {
      r3NextShot();
    }
  };

  const nextRound = () => {
    const current = roomState?.status;
    if (current === 'lobby') changeRound('round1');
    else if (current === 'round1') changeRound('round2');
    else if (current === 'round2') changeRound('round3');
    else if (current === 'round3') changeRound('round4');
    else if (current === 'round4') changeRound('game_over');
  };

  // Round 4 Handlers
  const r4Bid = (increment) => {
    sounds.playBid();
    if (socket && isConnected && roomCode) {
      socket.emit('r4_bid', {
        roomCode,
        increment,
        expectedBid: roomState?.round4?.highestBid,
        topicId: roomState?.round4?.topicId
      });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        const playerTeam = currentPlayer?.team;
        if (!playerTeam || r4.phase !== 'bidding' || r4.highestBidderTeam === playerTeam) return prev;
        if (![1, 2, 5].includes(increment)) return prev;
        r4.highestBid += increment;
        r4.highestBidderTeam = playerTeam;
        r4.highestBidderPlayerId = currentPlayer?.id || null;
        return { ...prev, round4: r4 };
      });
    }
  };

  const r4UseLifeline = (lifelineType) => {
    const team = currentPlayer?.team || roomState?.round4?.highestBidderTeam || 'team_a';
    if (socket && isConnected && roomCode) {
      socket.emit('r4_use_lifeline', {
        roomCode,
        team,
        lifelineType,
        topicId: roomState?.round4?.topicId
      });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        const callerTeam = currentPlayer?.team;
        if (!callerTeam || !r4.currentTopic || !['bidding', 'execution'].includes(r4.phase)) return prev;
        if (r4.highestBidderTeam !== callerTeam) return prev;
        if (!['call_friend', 'rival_hint', 'opponent_help'].includes(lifelineType)) return prev;
        if (!r4.usedLifelines) r4.usedLifelines = { team_a: [], team_b: [] };
        if (!r4.usedLifelines[callerTeam]) r4.usedLifelines[callerTeam] = [];
        if (r4.usedLifelines[callerTeam].includes(lifelineType)) return prev;
        const validItems = r4.currentTopic.validItems || [];
        const unrevealed = validItems.filter(item => !r4.itemsNamed?.includes(item));
        if (lifelineType === 'rival_hint' && validItems.length === 0) return prev;
        if (lifelineType === 'opponent_help' && unrevealed.length === 0) return prev;
        r4.usedLifelines[callerTeam].push(lifelineType);
        if (lifelineType === 'call_friend') {
          r4.timer += 20;
          sounds.playBid();
          showToast('📞 اتصل بصديق (+20 ثانية)', 'تم تمديد الوقت 20 ثانية إضافية!');
        } else if (lifelineType === 'rival_hint') {
          sounds.playBid();
          const hint = unrevealed[0] || validItems[0];
          showToast('💡 هينت من الخصم!', `تلميح الخصم يكشف: "${hint}"`);
        } else {
          if (!r4.itemsNamed) r4.itemsNamed = [];
          r4.itemsNamed.push(unrevealed[0]);
          sounds.playCorrect();
          showToast('🤝 استعين بالخصم!', `الخصم ساعد بإجابة معتمدة: "${unrevealed[0]}"`);
        }
        return { ...prev, round4: r4 };
      });
    }
  };

  const r4ToggleItem = (item) => {
    if (socket && isConnected && roomCode) {
      socket.emit('r4_toggle_item', { roomCode, item, topicId: roomState?.round4?.topicId });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        const validItems = r4.currentTopic?.validItems || [];
        if (r4.phase === 'resolved' || !validItems.includes(item)) return prev;
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
      socket.emit('r4_resolve_bid', { roomCode, success, topicId: roomState?.round4?.topicId });
    } else {
      setRoomState(prev => {
        const r4 = { ...prev.round4 };
        const teams = { ...prev.teams };
        const winningTeam = r4.highestBidderTeam;

        if (!winningTeam || r4.phase === 'resolved' || !r4.currentTopic) return prev;
        if (success && (r4.itemsNamed?.length || 0) < r4.highestBid) {
          showToast('🚫 لم يكتمل الرقم', `الفريق سمّى ${r4.itemsNamed?.length || 0} من ${r4.highestBid}.`);
          return prev;
        }

        if (success) {
          const reward = r4.highestBid * 400;
          teams[winningTeam] = { ...teams[winningTeam], score: teams[winningTeam].score + reward };
          sounds.playGoalRoar();
          fireConfetti();
          showToast('أنا قدها ونص! 🏆', `${teams[winningTeam].name} نفذ المزاد وكسب ${reward} نقطة!`);
        } else {
          sounds.playBuzzer();
          showToast('المزاد لم يكتمل', `${teams[winningTeam].name} لم يوفِ بالمزاد. لا توجد نقاط مخصومة.`);
        }

        r4.currentTopicIndex = (r4.currentTopicIndex || 0) + 1;
        r4.phase = 'resolved';

        if (r4.currentTopicIndex >= 4) {
          r4.currentTopic = null;
          r4.topicId = null;
          sounds.playFanfare();
          fireConfetti();
          showToast('🏁 اكتملت جولة المزاد (4 موضوعات)!', 'حان وقت تتويج بطل الساحة وإعلان النتائج النهائية 👑');
        } else {
          const nextTopic = AUCTION_TOPICS[r4.currentTopicIndex % AUCTION_TOPICS.length];
          r4.currentTopic = nextTopic;
          r4.topicId = `local-topic-${r4.currentTopicIndex}`;
          r4.highestBid = nextTopic.minBid;
          r4.timer = 60;
          r4.itemsNamed = [];
          r4.phase = 'bidding';
          r4.usedLifelines = { team_a: [], team_b: [] };
          r4.highestBidderTeam = null;
          r4.highestBidderPlayerId = null;
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
        connectionStatus,
        connectionStatusMessage: CONNECTION_STATUS_MESSAGES[connectionStatus] || '',
        reconnect,
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
        actionError,
        clearActionError,
        fireConfetti,
        roomState,
        setRoomState,
        changeRound,
        countdown,
        setCountdown,
        startMatchCountdown,
        createRoom,
        joinRoom,
        updatePlayerProfile,
        addDemoPlayer,
        // Host Team Management
        updateTeamNames,
        reassignPlayerTeam,
        reorderTeamPlayers,
        swapTeams,
        setMatchJudge,
        // Manual Progression Controls
        nextQuestion,
        nextRound,
        r1NextQuestion,
        r2NextCard,
        r3NextShot,
        // Round actions
        r1Score,
        r1Break,
        r1Bank,
        r1Continue,
        r1PassTurn,
        r2AwardPoint,
        r2SkipCard,
        r2Foul,
        r2TimeFreeze,
        r3InterceptBuzz,
        r3RecordShot,
        r3SubmitAnswer,
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

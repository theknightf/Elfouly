import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { CHARACTERS, TEAMS } from '../src/data/characters.js';
import { TRIVIA_BANK, PASSWORD_WORDS, PENALTY_QUESTIONS, AUCTION_TOPICS, PENALTY_CATEGORIES } from '../src/data/questions.js';
import { TOURNAMENT_STRUCTURE, TOURNAMENT_CONFIG } from '../src/data/tournamentStructure.js';
import { triviaEngine } from '../services/triviaEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Global rooms store
const rooms = new Map();

// =================== REFEREE / ANTI-CHEAT ENGINE ===================
// A referee device is the ONLY device allowed to grade the current round.
// If a referee stops sending heartbeats (screen lock / crash / disconnect)
// for this grace period, the server rotates refereeing to the next device.
const REFEREE_FAILOVER_MS = 6000; // inside the required 5-8 seconds window
const REFEREE_WATCHDOG_MS = 2000;
const R3_TIE_WINDOW_MS = 300; // both clicks inside this window require neutral confirmation
const ROUND_KEYS = ['round1', 'round2', 'round3', 'round4'];

function createRefereeSlot() {
  return {
    refereePlayerId: null,
    refereeQueue: [],
    refereeAssignedAt: null,
    refereeLastSeen: null,
    refereeFailovers: 0,
    refereeFallback: false
  };
}

function isConnectedHuman(player) {
  return !!player && !player.isBot && player.connected !== false;
}

function getRoundRefereePool(room, roundKey) {
  const humans = room.players.filter(isConnectedHuman);

  if (roundKey === 'round1') {
    return humans.filter(p => p.team !== room.round1.activeTeam);
  }

  if (roundKey === 'round2') {
    const clueGiverIds = [room.round2.activeClueGiverA, room.round2.activeClueGiverB];
    return humans.filter(p => !clueGiverIds.includes(p.id));
  }

  if (roundKey === 'round3') {
    const duelistIds = [room.round3.currentKickerId, room.round3.currentGoalieId];
    return humans.filter(p => !duelistIds.includes(p.id));
  }

  if (roundKey === 'round4') {
    const winnerTeam = room.round4.highestBidderTeam;
    return winnerTeam ? humans.filter(p => p.team !== winnerTeam) : humans;
  }

  return humans;
}

function getFallbackRefereeId(room) {
  const host = room.players.find(p => p.id === room.hostId && isConnectedHuman(p));
  if (host) return host.id;
  return room.players.find(isConnectedHuman)?.id || room.players[0]?.id || null;
}

function pickRefereeId(room, roundKey, { rotate = false, excludeIds = [] } = {}) {
  const state = room[roundKey];
  const pool = getRoundRefereePool(room, roundKey);
  const poolIds = pool.map(p => p.id).filter(id => !excludeIds.includes(id));

  if (poolIds.length === 0) {
    const fallbackId = getFallbackRefereeId(room);
    return {
      refereeId: fallbackId && !excludeIds.includes(fallbackId) ? fallbackId : null,
      poolIds,
      fallback: true
    };
  }

  if (!rotate) {
    return { refereeId: poolIds[0], poolIds, fallback: false };
  }

  const previousQueue = (state.refereeQueue || []).filter(id => poolIds.includes(id));
  if (previousQueue.length === 0) {
    return { refereeId: poolIds[0], poolIds, fallback: false };
  }

  const currentIndex = previousQueue.indexOf(state.refereePlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % previousQueue.length;
  return { refereeId: previousQueue[nextIndex], poolIds, fallback: false };
}

function assignReferee(room, roundKey, { rotate = false, reason = 'assign', excludeIds = [] } = {}) {
  const state = room[roundKey];
  if (!state) return null;

  const previousId = state.refereePlayerId;
  const { refereeId, poolIds, fallback } = pickRefereeId(room, roundKey, { rotate, excludeIds });

  state.refereePlayerId = refereeId || null;
  state.refereeQueue = poolIds;
  state.refereeAssignedAt = Date.now();
  state.refereeLastSeen = Date.now();
  state.refereeFallback = fallback;
  if (reason === 'failover') state.refereeFailovers = (state.refereeFailovers || 0) + 1;

  // The Round 1 reader must always be the current opposing referee.
  if (roundKey === 'round1' && state.refereePlayerId) {
    state.readerPlayerId = state.refereePlayerId;
  }

  return { previousId, refereeId: state.refereePlayerId, fallback, reason };
}

function isReferee(room, roundKey, socketId) {
  return !!socketId && room?.[roundKey]?.refereePlayerId === socketId;
}

function requireReferee(room, roundKey, socket, actionLabel) {
  if (isReferee(room, roundKey, socket.id)) return true;
  const current = room?.players?.find(p => p.id === room?.[roundKey]?.refereePlayerId);
  socket.emit(
    'error_message',
    `🚫 ${actionLabel}: لوحة التحكيم مقفولة على جهاز الحكم المعتمد (${current?.name || 'لم يتم تعيين حكم بعد'}).`
  );
  return false;
}

function notifyRefereeChange(room, roundKey, previousId, reason) {
  const next = room.players.find(p => p.id === room[roundKey]?.refereePlayerId);
  const previous = room.players.find(p => p.id === previousId);
  const labels = {
    round1: 'جولة "1 تو"',
    round2: 'جولة "اديني في سري"',
    round3: 'جولة ركلات الجزاء',
    round4: 'جولة المزاد'
  };

  io.to(room.code).emit('referee_changed', {
    round: roundKey,
    previousRefId: previousId || null,
    refereePlayerId: room[roundKey]?.refereePlayerId || null,
    reason
  });

  if (reason === 'failover') {
    io.to(room.code).emit('notification', {
      title: 'تحويل صلاحية التحكيم تلقائياً 🛡️',
      message: `فقدنا اتصال الحكم ${previous?.name || 'السابق'} لأكثر من ${Math.round(REFEREE_FAILOVER_MS / 1000)} ثوانٍ. انتقلت صلاحية تحكيم ${labels[roundKey] || roundKey} إلى ${next?.name || 'الحكم التالي'} فوراً.`
    });
  }
}

// Build a per-device room snapshot so secret answers never leave the server
// for players who are not the current referee (or, in Password mode, clue givers).
function sanitizeRoomForViewer(room, socketId) {
  // countdownInterval is a Node timer with circular internals; never serialize it.
  const snapshot = JSON.parse(JSON.stringify({ ...room, countdownInterval: null }));
  const viewer = room.players.find(p => p.id === socketId);

  const r1Ref = room.round1?.refereePlayerId === socketId;
  const r2Ref = room.round2?.refereePlayerId === socketId;
  const r3Ref = room.round3?.refereePlayerId === socketId;
  const r4Ref = room.round4?.refereePlayerId === socketId;
  const r2ClueGiver =
    room.round2?.activeClueGiverA === socketId ||
    room.round2?.activeClueGiverB === socketId;

  if (snapshot.round1?.currentQuestion && !r1Ref) {
    snapshot.round1.currentQuestion.answer = null;
  }

  if (!r2Ref && !r2ClueGiver) {
    snapshot.round2.currentWord = {
      target: '🤫 محجوبة',
      forbidden: ['••••', '••••', '••••', '••••'],
      category: 'سري',
      clueIdea: 'الكلمة السرية مرئية فقط للحكم والمرشدين.',
      redacted: true
    };
  }

  if (snapshot.round3?.currentQuestion && !r3Ref) {
    snapshot.round3.currentQuestion.answer = null;
  }

  if (snapshot.round4?.currentTopic && !r4Ref) {
    snapshot.round4.currentTopic.validItems = [];
  }

  // Internal rotation metadata is not needed by clients.
  for (const key of ROUND_KEYS) {
    if (snapshot[key]) {
      delete snapshot[key].refereeQueue;
      delete snapshot[key].refereeLastSeen;
      delete snapshot[key].refereeAssignedAt;
    }
  }

  // Mark the viewer's identity so clients can resolve their own permissions.
  snapshot.viewerId = viewer?.id || socketId;
  return snapshot;
}

function emitRoomState(room) {
  const socketIds = io.sockets.adapter.rooms.get(room.code);
  if (!socketIds) return;

  for (const socketId of socketIds) {
    const target = io.sockets.sockets.get(socketId);
    if (target) target.emit('room_state_updated', sanitizeRoomForViewer(room, socketId));
  }
}

// Helper to generate a unique 6-character alphanumeric room code (e.g., QZ-7842)
function generateRoomCode() {
  const digits = '0123456789';
  let num = '';
  for (let i = 0; i < 4; i++) {
    num += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return `QZ-${num}`;
}

// Flexible room lookup supporting hyphenated and raw codes
function findRoom(inputCode) {
  if (!inputCode) return null;
  const clean = String(inputCode).toUpperCase().trim();
  if (rooms.has(clean)) return rooms.get(clean);

  // Try formatted with hyphen (e.g. QZ7842 -> QZ-7842)
  if (!clean.includes('-') && clean.startsWith('QZ') && clean.length === 6) {
    const formatted = `QZ-${clean.slice(2)}`;
    if (rooms.has(formatted)) return rooms.get(formatted);
  }

  // Search case-insensitively ignoring hyphens
  const stripped = clean.replace(/-/g, '');
  for (const [key, val] of rooms.entries()) {
    if (key.replace(/-/g, '') === stripped) {
      return val;
    }
  }
  return null;
}

// Initial state for a room
function createInitialRoomState(roomCode, hostId, hostName) {
  return {
    code: roomCode,
    hostId: hostId,
    status: 'lobby', // 'lobby' | 'round1' | 'round2' | 'round3' | 'round4' | 'game_over'
    countdown: null,
    countdownInterval: null,
    tournamentStructure: TOURNAMENT_STRUCTURE,
    players: [],
    teams: {
      team_a: { id: 'team_a', name: 'فريق الحيتان (Team A)', score: 0, bank: 0, penaltyScore: 0 },
      team_b: { id: 'team_b', name: 'فريق الوحوش (Team B)', score: 0, bank: 0, penaltyScore: 0 }
    },
    // Round 1: "1 تو" (Bank Mode) - 48 Questions total, 24/team, 4 segments, 2 sub-batches [6, 6] per segment
    round1: {
      ...createRefereeSlot(),
      activeTeam: 'team_a',
      answeringPlayerId: null,
      readerPlayerId: null,
      segmentIndex: 0, // 0..3 (4 segments total)
      subBatchIndex: 0, // 0..1 (2 sub-batches of 6 per segment)
      subBatchQuestionsAnswered: 0, // 0..6
      segmentQuestionsAnswered: 0, // 0..12
      totalQuestionsAnswered: 0, // 0..48
      totalQuestions: 48,
      currentQuestionIndex: 0,
      streak: 0, // 0 to 10
      pendingPoints: 0,
      streakLadder: [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000],
      currentQuestion: null,
      timer: 30,
      isTimerRunning: false,
      history: []
    },
    // Round 2: "اديني في سري" (Password Mode) - 5 Secret Cards
    round2: {
      ...createRefereeSlot(),
      activeClueGiverA: null,
      activeClueGiverB: null,
      currentWordIndex: 0,
      totalQuestions: 5,
      currentWord: null,
      timer: 45,
      isTimerRunning: false,
      fouls: { team_a: 0, team_b: 0 }
    },
    // Round 3: "حط في قريبي" (Penalty Shootouts) - 10 shots (5 each alternating)
    round3: {
      ...createRefereeSlot(),
      turnIndex: 0, // 0 to 9 (10 shots total)
      totalShots: 10,
      currentKickerId: null,
      currentGoalieId: null,
      kickerTeam: 'team_a',
      currentCategory: PENALTY_CATEGORIES[0],
      phase: 'duelist_selection', // 'duelist_selection' | 'shootout'
      currentQuestion: null,
      timer: 20,
      isTimerRunning: false,
      interceptBuzzedBy: null,
      interceptAt: null,
      shotStartedAt: null,
      tieBreakActive: false,
      tieBreakData: null,
      shotsHistory: []
    },
    // Round 4: "مين يزوّد؟" (Blind Auction)
    round4: {
      ...createRefereeSlot(),
      currentTopicIndex: 0,
      currentTopic: null,
      highestBid: 0,
      highestBidderTeam: null,
      highestBidderPlayerId: null,
      timer: 60,
      isTimerRunning: false,
      phase: 'bidding', // 'bidding' | 'execution' | 'resolved'
      itemsNamed: [],
      usedLifelines: { team_a: [], team_b: [] }
    },
    messages: []
  };
}

// Socket handlers
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Liveness heartbeat. Every player sends this, but only the assigned
  // referee's timestamp is used to detect a locked/crashed judging device.
  socket.on('player_heartbeat', ({ roomCode }) => {
    const room = findRoom(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const now = Date.now();
    player.connected = true;
    player.lastSeen = now;

    const roundKey = room.status;
    if (ROUND_KEYS.includes(roundKey) && room[roundKey]?.refereePlayerId === socket.id) {
      room[roundKey].refereeLastSeen = now;
    }
  });

  // Create room
  socket.on('create_room', ({ playerName, characterId }) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const room = createInitialRoomState(roomCode, socket.id, playerName);
    const char = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];

    const player = {
      id: socket.id,
      name: playerName || 'كابتن الساحة',
      character: char,
      team: 'team_a',
      isHost: true,
      isBot: false,
      connected: true,
      lastSeen: Date.now(),
      scoreContribution: 0
    };

    room.players.push(player);
    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('room_created', { roomCode, player, room: sanitizeRoomForViewer(room, socket.id) });
    console.log(`[Room Created] ${roomCode} by ${player.name}`);
  });

  // Join room
  socket.on('join_room', ({ roomCode, playerName, characterId, teamPreference }) => {
    const room = findRoom(roomCode);

    if (!room) {
      socket.emit('error_message', 'كود الغرفة غير موجود يا بطل! اتأكد من الكود.');
      return;
    }

    // Auto assign team if not preferred
    const teamACount = room.players.filter(p => p.team === 'team_a').length;
    const teamBCount = room.players.filter(p => p.team === 'team_b').length;
    const team = teamPreference || (teamACount <= teamBCount ? 'team_a' : 'team_b');

    // Pick character or default
    const char = CHARACTERS.find(c => c.id === characterId) || 
      CHARACTERS.find(c => !room.players.some(p => p.character.id === c.id)) || 
      CHARACTERS[0];

    const player = {
      id: socket.id,
      name: playerName || `لاعب ${room.players.length + 1}`,
      character: char,
      team: team,
      isHost: false,
      isBot: false,
      connected: true,
      lastSeen: Date.now(),
      scoreContribution: 0
    };

    room.players.push(player);
    socket.join(room.code);

    socket.emit('joined_room', { roomCode: room.code, player, room: sanitizeRoomForViewer(room, socket.id) });
    emitRoomState(room);
    console.log(`[Player Joined] ${player.name} joined ${room.code} in ${team}`);
  });

  // Add demo simulated bot player to room (helps solo testing 4/4)
  socket.on('add_demo_player', ({ roomCode }) => {
    const room = findRoom(roomCode);
    if (!room || room.players.length >= 4) return;
    if (socket.id !== room.hostId || !['lobby', 'waiting'].includes(room.status)) {
      socket.emit('error_message', '🚫 إضافة اللاعبين التجريبيين متاحة للهوست داخل صالة الانتظار فقط.');
      return;
    }

    const availableChars = CHARACTERS.filter(c => !room.players.some(p => p.character?.id === c.id));
    const nextChar = availableChars[0] || CHARACTERS[room.players.length % CHARACTERS.length];
    const team = room.players.filter(p => p.team === 'team_a').length <= room.players.filter(p => p.team === 'team_b').length ? 'team_a' : 'team_b';

    const botPlayer = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: nextChar.name,
      character: nextChar,
      team: team,
      isHost: false,
      isBot: true,
      connected: false,
      lastSeen: 0,
      scoreContribution: 0
    };

    room.players.push(botPlayer);
    emitRoomState(room);
    io.to(room.code).emit('notification', {
      title: 'انضمام لاعب 🎮',
      message: `انضم ${botPlayer.name} إلى الساحة في ${team === 'team_a' ? 'فريق الحيتان' : 'فريق الوحوش'}`
    });
  });

  // Update player character or team in lobby
  socket.on('update_player_profile', ({ roomCode, characterId, team }) => {
    const room = findRoom(roomCode);
    if (!room) return;

    if (!['lobby', 'waiting'].includes(room.status)) {
      socket.emit('error_message', '🚫 لا يمكن تغيير الفريق أو الشخصية بعد انطلاق الماتش.');
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      if (characterId) {
        const char = CHARACTERS.find(c => c.id === characterId);
        if (char) player.character = char;
      }
      if (team) {
        player.team = team;
      }
      emitRoomState(room);
    }
  });

  // Helper to initialize Round 1
  function setupRound1(room) {
    const teamAPlayers = room.players.filter(p => p.team === 'team_a');
    const teamBPlayers = room.players.filter(p => p.team === 'team_b');
    room.round1.activeTeam = 'team_a';
    room.round1.answeringPlayerId = teamAPlayers[0]?.id || room.players[0]?.id;
    room.round1.streak = 0;
    room.round1.pendingPoints = 0;
    room.round1.currentQuestionIndex = 0;
    room.round1.segmentIndex = 0;
    room.round1.subBatchIndex = 0;
    room.round1.subBatchQuestionsAnswered = 0;
    room.round1.segmentQuestionsAnswered = 0;
    room.round1.totalQuestionsAnswered = 0;
    room.round1.history = [];

    // Round-robin referee from the opposing team (never the answering team).
    assignReferee(room, 'round1', { reason: 'round_start' });

    const answeringPlayer = teamAPlayers[0] || room.players[0];
    const dispatchedQ = triviaEngine.getQuestionForPlayer({
      roomId: room.code,
      characterId: answeringPlayer?.character?.id || 'fares_elfouly',
      mode: 'one_two_bank'
    });
    room.round1.currentQuestion = dispatchedQ ? {
      question: dispatchedQ.question_text,
      answer: dispatchedQ.correct_answer,
      categoryName: dispatchedQ.category,
      funFact: 'سؤال مستهدف بحسب تخصص الشخصية والمحرك الديناميكي!'
    } : TRIVIA_BANK[0];
  }

  // Host triggers synchronized 3-second match start countdown
  socket.on('start_match_countdown', ({ roomCode }) => {
    const room = findRoom(roomCode);
    if (!room) {
      socket.emit('error_message', 'الغرفة غير موجودة!');
      return;
    }

    const isHost = socket.id === room.hostId || room.players.find(p => p.id === socket.id && p.isHost);
    if (!isHost) {
      socket.emit('error_message', 'فقط كابتن الغرفة (الهوست 👑) يملك صلاحية بدء الماتش!');
      return;
    }

    if (room.players.length < 4) {
      socket.emit('error_message', `العدد غير مكتمل! لازم 4 لاعبين في الساحة لبدء المباراة (${room.players.length}/4)`);
      return;
    }

    if (room.countdownInterval) return;

    let count = 3;
    room.countdown = count;
    io.to(room.code).emit('countdown_tick', { count });
    io.to(room.code).emit('sound_trigger', { sound: 'whistle' });

    room.countdownInterval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        room.countdown = count;
        io.to(room.code).emit('countdown_tick', { count });
        io.to(room.code).emit('sound_trigger', { sound: 'whistle' });
      } else {
        clearInterval(room.countdownInterval);
        room.countdownInterval = null;
        room.countdown = 0;
        io.to(room.code).emit('countdown_tick', { count: 0 });

        setupRound1(room);
        room.status = 'round1';
        emitRoomState(room);
        io.to(room.code).emit('match_started', { roomCode: room.code });
      }
    }, 1000);
  });

  // Start game / change round (Host only)
  socket.on('change_round', ({ roomCode, targetRound }) => {
    const room = findRoom(roomCode);
    if (!room) return;

    // Round transitions are host-only. Players can never jump rounds themselves.
    if (socket.id !== room.hostId) {
      socket.emit('error_message', '🚫 فقط كابتن الغرفة (الهوست) يمكنه الانتقال بين الجولات.');
      return;
    }

    room.status = targetRound;

    if (targetRound === 'round1') {
      setupRound1(room);
    } else if (targetRound === 'round2') {
      // Setup Round 2: اديني في سري Password Mode
      const teamAPlayers = room.players.filter(p => p.team === 'team_a');
      const teamBPlayers = room.players.filter(p => p.team === 'team_b');
      room.round2.activeClueGiverA = teamAPlayers[0]?.id || room.players[0]?.id;
      room.round2.activeClueGiverB = teamBPlayers[0]?.id || (room.players[1] ? room.players[1].id : room.players[0]?.id);
      room.round2.currentWordIndex = 0;
      room.round2.fouls = { team_a: 0, team_b: 0 };
      assignReferee(room, 'round2', { reason: 'round_start' });

      const dispatchedWord = triviaEngine.getQuestionForPlayer({
        roomId: roomCode,
        characterId: teamAPlayers[0]?.character?.id || 'fares_elfouly',
        mode: 'edini_fi_seri'
      });
      if (dispatchedWord) {
        room.round2.currentWord = {
          target: dispatchedWord.question_text,
          forbidden: dispatchedWord.forbidden_words || ['كلمة 1', 'كلمة 2', 'كلمة 3', 'كلمة 4'],
          category: dispatchedWord.category,
          clueIdea: 'خمن الكلمة بدون نطق الممنوعات الأربعة!'
        };
      } else {
        room.round2.currentWord = PASSWORD_WORDS[0];
      }
      room.round2.timer = 45;

    } else if (targetRound === 'round3') {
      // Setup Round 3: حط في قريبي Penalty Shootouts
      room.round3.turnIndex = 0;
      room.round3.kickerTeam = 'team_a';
      const teamAPlayers = room.players.filter(p => p.team === 'team_a');
      const teamBPlayers = room.players.filter(p => p.team === 'team_b');
      room.round3.currentKickerId = teamAPlayers[0]?.id || room.players[0]?.id;
      room.round3.currentGoalieId = teamBPlayers[0]?.id || (room.players[1] ? room.players[1].id : room.players[0]?.id);
      room.round3.shotsHistory = [];
      room.round3.turnIndex = 0;
      room.round3.interceptBuzzedBy = null;
      room.round3.interceptAt = null;
      room.round3.shotStartedAt = null;
      room.round3.tieBreakActive = false;
      room.round3.tieBreakData = null;

      // Random category generated first -> Teams select their duelists -> 1v1 speed shootout
      const randomCategory = PENALTY_CATEGORIES[Math.floor(Math.random() * PENALTY_CATEGORIES.length)];
      room.round3.currentCategory = randomCategory;
      room.round3.phase = 'duelist_selection';

      // Neutral referee (not the kicker or the goalie) confirms only ties/disputes.
      assignReferee(room, 'round3', { reason: 'round_start' });

      const kickerPlayer = teamAPlayers[0] || room.players[0];
      const dispatchedPenalty = triviaEngine.getQuestionForPlayer({
        roomId: roomCode,
        characterId: kickerPlayer?.character?.id || 'fares_elfouly',
        mode: 'hat_fi_qoraybi',
        preferredCategory: randomCategory.id
      });
      if (dispatchedPenalty) {
        room.round3.currentQuestion = {
          question: dispatchedPenalty.question_text,
          answer: dispatchedPenalty.correct_answer,
          options: dispatchedPenalty.options || ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
          category: randomCategory.id,
          kickerHint: randomCategory.name
        };
      } else {
        const backupQ = PENALTY_QUESTIONS.find(q => q.category === randomCategory.id) || PENALTY_QUESTIONS[0];
        room.round3.currentQuestion = backupQ;
      }
      room.round3.interceptBuzzedBy = null;

    } else if (targetRound === 'round4') {
      // Setup Round 4: مين يزوّد؟ Blind Auction
      room.round4.currentTopicIndex = 0;
      const teamBPlayers = room.players.filter(p => p.team === 'team_b');
      const dispatchedAuction = triviaEngine.getQuestionForPlayer({
        roomId: roomCode,
        characterId: teamBPlayers[0]?.character?.id || 'khaled_elbarbakh',
        mode: 'meen_yezawwed'
      });
      if (dispatchedAuction) {
        room.round4.currentTopic = {
          topic: dispatchedAuction.question_text,
          validItems: dispatchedAuction.acceptable_answers || [],
          category: dispatchedAuction.category,
          minBid: 3,
          hint: 'أعلى مزايدة تكسب التحدي!'
        };
      } else {
        room.round4.currentTopic = AUCTION_TOPICS[0];
      }
      room.round4.highestBid = room.round4.currentTopic.minBid;
      room.round4.highestBidderTeam = null;
      room.round4.highestBidderPlayerId = null;
      room.round4.phase = 'bidding';
      room.round4.timer = 60;
      room.round4.itemsNamed = [];
      room.round4.usedLifelines = { team_a: [], team_b: [] };
      assignReferee(room, 'round4', { reason: 'round_start' });
    }

    emitRoomState(room);
    io.to(roomCode).emit('notification', { title: 'انتقال الجولة', message: `بدأت الآن: ${targetRound}` });
  });

  // Helper to advance Round 1 question quota according to TOURNAMENT_STRUCTURE
  function advanceR1Question(room, roomCode) {
    const r1 = room.round1;
    r1.subBatchQuestionsAnswered += 1;
    r1.segmentQuestionsAnswered += 1;
    r1.totalQuestionsAnswered += 1;

    const teamAPlayers = room.players.filter(p => p.team === 'team_a');
    const teamBPlayers = room.players.filter(p => p.team === 'team_b');

    // Check if 48 questions reached (End of Round 1 quota)
    if (r1.totalQuestionsAnswered >= 48) {
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
      io.to(roomCode).emit('notification', {
        title: '🏁 اكتملت جولة "1 تو" بالكامل!',
        message: 'تم إنجاز حصة الـ 48 سؤالاً بالتساوي (24 لكل فريق)! جاهزون للجولة 2.'
      });
      return;
    }

    // Check if current sub-batch (6 questions) is complete
    if (r1.subBatchQuestionsAnswered >= 6) {
      if (r1.segmentQuestionsAnswered < 12) {
        // Move to sub-batch 2 within the same segment (same team)
        r1.subBatchIndex = 1;
        r1.subBatchQuestionsAnswered = 0;

        const activePlayers = r1.activeTeam === 'team_a' ? teamAPlayers : teamBPlayers;
        if (activePlayers.length > 1) {
          const currentIdx = activePlayers.findIndex(p => p.id === r1.answeringPlayerId);
          const nextIdx = (currentIdx + 1) % activePlayers.length;
          r1.answeringPlayerId = activePlayers[nextIdx].id;
        }

        // Round-robin refereeing: the next opposing player takes the judge seat.
        assignReferee(room, 'round1', { rotate: true, reason: 'sub_batch_rotation' });

        const newPlayer = room.players.find(p => p.id === r1.answeringPlayerId);
        const newRef = room.players.find(p => p.id === r1.refereePlayerId);
        io.to(roomCode).emit('notification', {
          title: '🔄 الفقرة الفرعية الثانية (6 أسئلة أخرى)',
          message: `الدور الآن على الكابتن ${newPlayer?.name || 'اللاعب الجديد'} من نفس الفريق! الحكم الجديد: ${newRef?.name || 'لاعب الخصم'}.`
        });
      } else {
        // Full segment (12 questions) complete! Switch to opposite team segment
        r1.segmentIndex += 1;
        r1.segmentQuestionsAnswered = 0;
        r1.subBatchIndex = 0;
        r1.subBatchQuestionsAnswered = 0;

        // Reset streak for the incoming team
        r1.pendingPoints = 0;
        r1.streak = 0;

        // Sequence: Team A (Seg 0) -> Team B (Seg 1) -> Team A (Seg 2) -> Team B (Seg 3)
        const targetTurns = ['team_a', 'team_b', 'team_a', 'team_b'];
        r1.activeTeam = targetTurns[r1.segmentIndex % 4];

        const activePlayers = r1.activeTeam === 'team_a' ? teamAPlayers : teamBPlayers;

        if (activePlayers.length > 0) {
          const nextAnsIdx = r1.segmentIndex % activePlayers.length;
          r1.answeringPlayerId = activePlayers[nextAnsIdx].id;
        }

        // A new answering team => a new opposing referee (and reader).
        assignReferee(room, 'round1', { reason: 'segment_change' });

        const activeTeamObj = room.teams[r1.activeTeam];
        io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
        io.to(roomCode).emit('notification', {
          title: `🔄 تحويل الفقرة (${r1.segmentIndex + 1} من 4)`,
          message: `انتهت فقرة الـ 12 سؤالاً! الدور الآن على ${activeTeamObj?.name}`
        });
      }
    }
  }

  // =================== ROUND 1 ACTIONS ===================
  // Score / Correct Answer
  socket.on('r1_action_score', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Zero Self-Grading Anti-Cheat: only the assigned opposing referee may grade.
    if (!requireReferee(room, 'round1', socket, 'احتساب نقطة')) return;
    const caller = room.players.find(p => p.id === socket.id);
    if (caller && caller.team === room.round1.activeTeam) {
      socket.emit('error_message', '🚫 ممنوع احتساب النقاط لنفسك! الحكم الخصم هو المسؤول الوحيد عن التقييم.');
      return;
    }

    const r1 = room.round1;
    const answeringPlayer = room.players.find(p => p.id === r1.answeringPlayerId);
    let nextStreak = Math.min(r1.streak + 1, 10);
    r1.streak = nextStreak;

    // Base value from ladder
    let points = r1.streakLadder[nextStreak];
    // Attribute bonuses
    if (answeringPlayer?.character?.id === 'fares_elfouly') {
      // +20% score multiplier
      points = Math.round(points * 1.2);
    }
    r1.pendingPoints = points;

    // Advance Round 1 quota tracking (48 total, 2x12 segments, [6, 6] splits)
    advanceR1Question(room, roomCode);

    // Pick next question tailored to active player via triviaEngine ("القلاية")
    const nextAnsweringPlayer = room.players.find(p => p.id === r1.answeringPlayerId) || answeringPlayer;
    const nextQ = triviaEngine.getQuestionForPlayer({
      roomId: roomCode,
      characterId: nextAnsweringPlayer?.character?.id || 'fares_elfouly',
      mode: 'one_two_bank'
    });
    if (nextQ) {
      r1.currentQuestion = {
        question: nextQ.question_text,
        answer: nextQ.correct_answer,
        categoryName: nextQ.category,
        funFact: 'سؤال مستهدف ديناميكياً بحسب التخصص والمحرك الذكي!'
      };
    } else {
      const nextIdx = (r1.currentQuestionIndex + 1) % TRIVIA_BANK.length;
      r1.currentQuestionIndex = nextIdx;
      r1.currentQuestion = TRIVIA_BANK[nextIdx];
    }

    io.to(roomCode).emit('sound_trigger', { sound: 'correct', streak: nextStreak });
    emitRoomState(room);
  });

  // Break streak / Wrong answer
  socket.on('r1_action_break', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Zero Self-Grading Anti-Cheat: only the assigned opposing referee may break.
    if (!requireReferee(room, 'round1', socket, 'كسر الستريك')) return;
    const caller = room.players.find(p => p.id === socket.id);
    if (caller && caller.team === room.round1.activeTeam) {
      socket.emit('error_message', '🚫 ممنوع تقييم الإجابة من الفريق المجيب! الحكم الخصم هو المسؤول الوحيد.');
      return;
    }

    const r1 = room.round1;
    const answeringPlayer = room.players.find(p => p.id === r1.answeringPlayerId);

    // Check if player has streak shield (El-Touny) or firewall protection (Eyad)
    if (answeringPlayer?.character?.id === 'abdelrahman_eltouny' && r1.streak > 1) {
      // El Touny shield saves streak once!
      io.to(roomCode).emit('notification', {
        title: 'درع التوني بيلافيتا! 🍦',
        message: 'تم تفعيل حماية الستريك وإنقاذ النقاط من الضياع!'
      });
      r1.streak = Math.max(1, r1.streak - 1);
      r1.pendingPoints = r1.streakLadder[r1.streak];
    } else {
      // Break streak completely
      r1.streak = 0;
      r1.pendingPoints = 0;
      io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    }

    // Advance Round 1 quota tracking
    advanceR1Question(room, roomCode);

    // Pick next question tailored to active player via triviaEngine ("القلاية")
    const nextAnsweringPlayer = room.players.find(p => p.id === r1.answeringPlayerId) || answeringPlayer;
    const nextQ = triviaEngine.getQuestionForPlayer({
      roomId: roomCode,
      characterId: nextAnsweringPlayer?.character?.id || 'fares_elfouly',
      mode: 'one_two_bank'
    });
    if (nextQ) {
      r1.currentQuestion = {
        question: nextQ.question_text,
        answer: nextQ.correct_answer,
        categoryName: nextQ.category,
        funFact: 'سؤال مستهدف ديناميكياً بحسب التخصص والمحرك الذكي!'
      };
    } else {
      const nextIdx = (r1.currentQuestionIndex + 1) % TRIVIA_BANK.length;
      r1.currentQuestionIndex = nextIdx;
      r1.currentQuestion = TRIVIA_BANK[nextIdx];
    }

    emitRoomState(room);
  });

  // BANK points
  socket.on('r1_action_bank', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Only active answering team can bank their points. The referee is from
    // the opposing team and must never be able to bank on their behalf.
    const caller = room.players.find(p => p.id === socket.id);
    if (!caller || caller.team !== room.round1.activeTeam) {
      socket.emit('error_message', '🚫 لا يمكنك حفظ النقاط في الخزنة لفريق الخصم!');
      return;
    }

    const r1 = room.round1;
    const activeTeamKey = r1.activeTeam;
    const banked = r1.pendingPoints;

    if (banked > 0) {
      room.teams[activeTeamKey].bank += banked;
      room.teams[activeTeamKey].score += banked;

      const player = room.players.find(p => p.id === r1.answeringPlayerId);
      if (player) {
        player.scoreContribution += banked;
      }

      r1.history.push({
        team: activeTeamKey,
        amount: banked,
        player: player?.name || 'اللاعب'
      });

      r1.pendingPoints = 0;
      r1.streak = 0;

      io.to(roomCode).emit('sound_trigger', { sound: 'bank_safe' });
      io.to(roomCode).emit('confetti_trigger');
      emitRoomState(room);
    }
  });

  // Pass Round 1 turn to next player / opposite team (host control only)
  socket.on('r1_pass_turn', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (socket.id !== room.hostId) {
      socket.emit('error_message', '🚫 تبديل الدور يتم من جهاز كابتن الغرفة فقط.');
      return;
    }

    const r1 = room.round1;
    r1.pendingPoints = 0;
    r1.streak = 0;

    // Toggle active team
    r1.activeTeam = r1.activeTeam === 'team_a' ? 'team_b' : 'team_a';
    const answeringCandidates = room.players.filter(p => p.team === r1.activeTeam);

    if (answeringCandidates.length > 0) {
      const currentAnsIdx = answeringCandidates.findIndex(p => p.id === r1.answeringPlayerId);
      const nextAnsIdx = (currentAnsIdx + 1) % answeringCandidates.length;
      r1.answeringPlayerId = answeringCandidates[nextAnsIdx].id;
    }

    // Assign the next opposing referee/reader automatically.
    assignReferee(room, 'round1', { reason: 'turn_change' });

    io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    emitRoomState(room);
  });

  // =================== ROUND 2 ACTIONS (Password Mode) ===================
  socket.on('r2_award_point', ({ roomCode, team }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Only the neutral referee may award the card.
    if (!requireReferee(room, 'round2', socket, 'احتساب نقطة كلمة السر')) return;
    if (team !== 'team_a' && team !== 'team_b') return;

    const r2 = room.round2;
    room.teams[team].score += 500;
    r2.currentWordIndex += 1;

    // Check if 5 cards quota reached
    if (r2.currentWordIndex >= 5) {
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
      io.to(roomCode).emit('notification', {
        title: '🏁 اكتملت جولة "اديني في سري" (5 بطاقات)!',
        message: 'تم إنجاز الـ 5 بطاقات السرية! جاهزون للانتقال لجولة ركلات الجزاء.'
      });
    }

    // Pick next secret word via triviaEngine
    const nextWord = triviaEngine.getQuestionForPlayer({
      roomId: roomCode,
      characterId: room.players[0]?.character?.id || 'fares_elfouly',
      mode: 'edini_fi_seri'
    });
    if (nextWord) {
      r2.currentWord = {
        target: nextWord.question_text,
        forbidden: nextWord.forbidden_words || ['كلمة 1', 'كلمة 2', 'كلمة 3', 'كلمة 4'],
        category: nextWord.category,
        clueIdea: 'خمن الكلمة بدون نطق الممنوعات الأربعة!'
      };
    } else {
      const nextIdx = (r2.currentWordIndex) % PASSWORD_WORDS.length;
      r2.currentWord = PASSWORD_WORDS[nextIdx];
    }

    // Rotate the neutral referee for the next secret card.
    if (r2.currentWordIndex < 5) {
      assignReferee(room, 'round2', { rotate: true, reason: 'card_complete' });
    }

    io.to(roomCode).emit('sound_trigger', { sound: 'correct' });
    emitRoomState(room);
  });

  socket.on('r2_skip_card', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!requireReferee(room, 'round2', socket, 'تخطي كلمة سرية')) return;

    const r2 = room.round2;
    r2.currentWordIndex += 1;

    if (r2.currentWordIndex >= 5) {
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
      io.to(roomCode).emit('notification', {
        title: '🏁 اكتملت جولة "اديني في سري" (5 بطاقات)!',
        message: 'تم إنجاز الـ 5 بطاقات السرية! جاهزون للانتقال لجولة ركلات الجزاء.'
      });
    }

    const nextWord = triviaEngine.getQuestionForPlayer({
      roomId: roomCode,
      characterId: room.players[0]?.character?.id || 'fares_elfouly',
      mode: 'edini_fi_seri'
    });
    if (nextWord) {
      r2.currentWord = {
        target: nextWord.question_text,
        forbidden: nextWord.forbidden_words || ['كلمة 1', 'كلمة 2', 'كلمة 3', 'كلمة 4'],
        category: nextWord.category,
        clueIdea: 'خمن الكلمة بدون نطق الممنوعات الأربعة!'
      };
    } else {
      const nextIdx = (r2.currentWordIndex) % PASSWORD_WORDS.length;
      r2.currentWord = PASSWORD_WORDS[nextIdx];
    }

    if (r2.currentWordIndex < 5) {
      assignReferee(room, 'round2', { rotate: true, reason: 'card_skipped' });
    }

    io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    emitRoomState(room);
  });

  socket.on('r2_foul', ({ roomCode, team }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!requireReferee(room, 'round2', socket, 'احتساب مخالفة')) return;
    if (team !== 'team_a' && team !== 'team_b') return;

    const r2 = room.round2;
    r2.fouls[team] = (r2.fouls[team] || 0) + 1;
    // Deduct 200 points on foul
    room.teams[team].score = Math.max(0, room.teams[team].score - 200);

    io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    emitRoomState(room);
  });

  socket.on('r2_time_freeze', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!requireReferee(room, 'round2', socket, 'تجميد الوقت')) return;

    // Ziad's bonus: +10s time freeze
    room.round2.timer += 10;
    io.to(roomCode).emit('notification', {
      title: 'تجميد الوقت الفندقي 🛎️',
      message: 'زياد الفندقي مد الوقت +10 ثواني كاملة بروقان!'
    });
    emitRoomState(room);
  });

  // Select Duelists for Penalty Shootout
  socket.on('r3_select_duelists', ({ roomCode, kickerId, goalieId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r3 = room.round3;
    if (r3.phase !== 'duelist_selection') {
      socket.emit('error_message', '🚫 لا يمكن تغيير المبارزين أثناء تنفيذ الركلة.');
      return;
    }

    const caller = room.players.find(p => p.id === socket.id);
    if (!caller) return;

    const defendingTeam = r3.kickerTeam === 'team_a' ? 'team_b' : 'team_a';

    if (kickerId) {
      const candidate = room.players.find(p => p.id === kickerId);
      if (caller.team !== r3.kickerTeam || candidate?.team !== r3.kickerTeam) {
        socket.emit('error_message', '🚫 اختيار المسدد من صلاحيات فريق المسدد فقط.');
        return;
      }
      r3.currentKickerId = kickerId;
    }

    if (goalieId) {
      const candidate = room.players.find(p => p.id === goalieId);
      if (caller.team !== defendingTeam || candidate?.team !== defendingTeam) {
        socket.emit('error_message', '🚫 اختيار الحارس من صلاحيات فريق الحارس فقط.');
        return;
      }
      r3.currentGoalieId = goalieId;
    }

    // Referee must stay neutral: never the kicker or the goalie.
    if ([r3.currentKickerId, r3.currentGoalieId].includes(r3.refereePlayerId)) {
      assignReferee(room, 'round3', { rotate: true, reason: 'duelists_changed' });
    }

    const kickerPlayer = room.players.find(p => p.id === r3.currentKickerId);
    const category = r3.currentCategory;
    const dispatched = triviaEngine.getQuestionForPlayer({
      roomId: roomCode,
      characterId: kickerPlayer?.character?.id || 'fares_elfouly',
      mode: 'hat_fi_qoraybi',
      preferredCategory: category?.id
    });
    if (dispatched) {
      r3.currentQuestion = {
        question: dispatched.question_text,
        answer: dispatched.correct_answer,
        options: dispatched.options || ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
        category: category?.id || dispatched.category,
        kickerHint: category?.name || dispatched.category
      };
    } else {
      const backupQ = PENALTY_QUESTIONS.find(q => q.category === category?.id) || PENALTY_QUESTIONS[0];
      r3.currentQuestion = backupQ;
    }

    r3.interceptBuzzedBy = null;
    r3.interceptAt = null;
    r3.tieBreakActive = false;
    r3.tieBreakData = null;

    emitRoomState(room);
  });

  // Start Shootout
  socket.on('r3_start_shootout', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r3 = room.round3;
    if (socket.id !== room.hostId && !isReferee(room, 'round3', socket.id)) {
      socket.emit('error_message', '🚫 بدء الركلة يتم من جهاز الهوست أو الحكم المحايد فقط.');
      return;
    }

    if (!r3.currentKickerId || !r3.currentGoalieId) {
      socket.emit('error_message', '🚫 يجب اختيار المسدد والحارس أولاً.');
      return;
    }

    r3.phase = 'shootout';
    r3.interceptBuzzedBy = null;
    r3.interceptAt = null;
    r3.shotStartedAt = Date.now();
    r3.tieBreakActive = false;
    r3.tieBreakData = null;
    io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    emitRoomState(room);
  });

  // Server timestamp #1: goalkeeper's save buzz.
  socket.on('r3_intercept_buzz', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r3 = room.round3;
    if (r3.phase !== 'shootout') {
      socket.emit('error_message', '🚫 بزر الصد متاح أثناء الركلة فقط.');
      return;
    }
    if (socket.id !== r3.currentGoalieId) {
      socket.emit('error_message', '🚫 بزر الصد مخصص لحارس المرمى الحالي فقط.');
      return;
    }
    if (r3.interceptBuzzedBy) return;

    r3.interceptBuzzedBy = socket.id;
    r3.interceptAt = Date.now();
    const goalie = room.players.find(p => p.id === socket.id);
    io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    io.to(roomCode).emit('notification', {
      title: 'صد واعتراض! 🛡️',
      message: `${goalie?.name || 'حارس المرمى'} ضغط على بزر الصد لسرقة النقطة!`
    });
    emitRoomState(room);
  });

  function settlePenaltyShot(room, roomCode, result, meta = {}) {
    const r3 = room.round3;
    const kickingTeam = r3.kickerTeam;
    const defendingTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';

    if (result === 'goal') {
      room.teams[kickingTeam].score += 1000;
      room.teams[kickingTeam].penaltyScore = (room.teams[kickingTeam].penaltyScore || 0) + 1;
      io.to(roomCode).emit('sound_trigger', { sound: 'goal_roar' });
      io.to(roomCode).emit('confetti_trigger');
    } else if (result === 'saved') {
      room.teams[defendingTeam].score += 800;
      io.to(roomCode).emit('sound_trigger', { sound: 'save' });
    } else {
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    }

    r3.shotsHistory.push({
      shotIndex: r3.turnIndex,
      team: kickingTeam,
      result,
      intercepted: !!r3.interceptBuzzedBy,
      tieBreak: !!meta.tieBreak,
      answerMs: meta.answerMs ?? null,
      interceptMs: meta.interceptMs ?? null
    });

    // Advance turn and reset the shooting clock / buzzer for the next kick.
    r3.turnIndex += 1;
    r3.kickerTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';
    r3.interceptBuzzedBy = null;
    r3.interceptAt = null;
    r3.shotStartedAt = null;
    r3.tieBreakActive = false;
    r3.tieBreakData = null;

    const nextCategory = PENALTY_CATEGORIES[Math.floor(Math.random() * PENALTY_CATEGORIES.length)];
    r3.currentCategory = nextCategory;
    r3.phase = 'duelist_selection';
    r3.isComplete = r3.turnIndex >= 10;

    if (r3.turnIndex >= 10) {
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
      io.to(roomCode).emit('notification', {
        title: '🏁 انتهت ركلات الجزاء الترجيحية (10 ركلات)!',
        message: 'تم تسديد 10 ركلات بالتساوي (5 لكل فريق)! الانتقال لجولة المزاد مين يزوّد.'
      });
    }

    const teamAPlayers = room.players.filter(p => p.team === 'team_a');
    const teamBPlayers = room.players.filter(p => p.team === 'team_b');

    if (r3.kickerTeam === 'team_a') {
      r3.currentKickerId = teamAPlayers[r3.turnIndex % Math.max(1, teamAPlayers.length)]?.id;
      r3.currentGoalieId = teamBPlayers[r3.turnIndex % Math.max(1, teamBPlayers.length)]?.id;
    } else {
      r3.currentKickerId = teamBPlayers[r3.turnIndex % Math.max(1, teamBPlayers.length)]?.id;
      r3.currentGoalieId = teamAPlayers[r3.turnIndex % Math.max(1, teamAPlayers.length)]?.id;
    }

    // Neutral tie-break referee must not be either duelist for the next kick.
    assignReferee(room, 'round3', { rotate: true, reason: 'shot_complete' });

    const nextKickerPlayer = room.players.find(p => p.id === r3.currentKickerId);
    const nextPenaltyQ = triviaEngine.getQuestionForPlayer({
      roomId: roomCode,
      characterId: nextKickerPlayer?.character?.id || 'fares_elfouly',
      mode: 'hat_fi_qoraybi',
      preferredCategory: nextCategory.id
    });
    if (nextPenaltyQ) {
      r3.currentQuestion = {
        question: nextPenaltyQ.question_text,
        answer: nextPenaltyQ.correct_answer,
        options: nextPenaltyQ.options || ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
        category: nextCategory.id,
        kickerHint: nextCategory.name
      };
    } else {
      const backupQ = PENALTY_QUESTIONS.find(q => q.category === nextCategory.id) || PENALTY_QUESTIONS[0];
      r3.currentQuestion = backupQ;
    }

    emitRoomState(room);
  }

  // Server timestamp #2: shooter's answer. The server — not the phone —
  // decides whether the answer or the goalkeeper buzz happened first.
  socket.on('r3_submit_answer', ({ roomCode, option }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r3 = room.round3;
    if (r3.phase !== 'shootout' || !r3.shotStartedAt) {
      socket.emit('error_message', '🚫 لا توجد ركلة نشطة الآن.');
      return;
    }
    if (socket.id !== r3.currentKickerId) {
      socket.emit('error_message', '🚫 المسدد الحالي فقط هو من يجيب على سؤال الركلة.');
      return;
    }
    if (r3.tieBreakActive) return;

    const answerAt = Date.now();
    const answerMs = answerAt - r3.shotStartedAt;
    const interceptMs = r3.interceptAt ? r3.interceptAt - r3.shotStartedAt : null;
    const norm = (value) => String(value || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
    const submitted = norm(option);
    const expected = norm(r3.currentQuestion?.answer);
    const isCorrect = !!submitted && (submitted === expected || expected.includes(submitted) || submitted.includes(expected));

    let provisional;
    if (isCorrect) {
      // Correct answer wins unless the goalie buzzed first.
      provisional = r3.interceptAt && r3.interceptAt < answerAt ? 'saved' : 'goal';
    } else {
      provisional = r3.interceptAt ? 'saved' : 'missed';
    }

    const bothClicked = !!r3.interceptAt;
    const nearlySimultaneous = bothClicked && Math.abs(answerAt - r3.interceptAt) <= R3_TIE_WINDOW_MS;

    if (nearlySimultaneous) {
      r3.tieBreakActive = true;
      r3.tieBreakData = {
        provisionalResult: provisional,
        answerMs,
        interceptMs,
        isCorrect,
        kickerId: r3.currentKickerId,
        goalieId: r3.currentGoalieId
      };
      io.to(roomCode).emit('notification', {
        title: '⏱️ تعادل لحظي في أجزاء الثانية!',
        message: 'الضغطتان متزامنتان. الحكم المحايد سيفصل النتيجة نهائياً من جهازه.'
      });
      emitRoomState(room);
      return;
    }

    const resultLabel = provisional === 'goal' ? 'هدف ⚽' : provisional === 'saved' ? 'تصدي 🧤' : 'ضاعت ❌';
    io.to(roomCode).emit('notification', {
      title: `نتيجة الركلة: ${resultLabel}`,
      message: `حسمها السيرفر بالتوقيت: ${provisional === 'goal' ? 'المسدد أسرع' : provisional === 'saved' ? 'الحارس أسرع بالصد' : 'بدون إصابة'}.`
    });

    settlePenaltyShot(room, roomCode, provisional, { answerMs, interceptMs });
  });

  // Neutral referee final confirmation / tie-break only.
  socket.on('r3_resolve_tiebreak', ({ roomCode, result }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!requireReferee(room, 'round3', socket, 'فض تعادل الركلة')) return;

    const r3 = room.round3;
    if (!r3.tieBreakActive || !r3.tieBreakData) {
      socket.emit('error_message', '🚫 لا يوجد تعادل لحظي يحتاج تدخّل الحكم الآن.');
      return;
    }

    const allowed = ['goal', 'saved', 'missed'];
    if (!allowed.includes(result)) return;

    settlePenaltyShot(room, roomCode, result, {
      tieBreak: true,
      answerMs: r3.tieBreakData.answerMs,
      interceptMs: r3.tieBreakData.interceptMs
    });
  });

  // Legacy manual record endpoint: only the neutral referee can use it,
  // and only while a genuine tie-break is waiting for a decision.
  socket.on('r3_record_shot', ({ roomCode, result }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!requireReferee(room, 'round3', socket, 'اعتماد نتيجة الركلة')) return;
    if (!room.round3.tieBreakActive) {
      socket.emit('error_message', '🚫 النتيجة تُحسب تلقائياً بتوقيت السيرفر. يدوي فقط عند التعادل اللحظي.');
      return;
    }
    if (!['goal', 'saved', 'missed'].includes(result)) return;
    settlePenaltyShot(room, roomCode, result, { tieBreak: true });
  });

  // =================== ROUND 4 ACTIONS (Blind Auction) ===================
  socket.on('r4_bid', ({ roomCode, increment }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r4 = room.round4;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (![1, 2, 5].includes(increment)) {
      socket.emit('error_message', '🚫 قيمة المزايدة غير صحيحة.');
      return;
    }

    r4.highestBid += increment;
    r4.highestBidderTeam = player.team;
    r4.highestBidderPlayerId = player.id;

    // When the winning team changes, the referee must be an opposing player.
    if (room.round4.refereePlayerId) {
      const currentRef = room.players.find(p => p.id === room.round4.refereePlayerId);
      if (currentRef?.team === player.team) {
        assignReferee(room, 'round4', { rotate: true, reason: 'bidder_changed' });
      }
    }

    io.to(roomCode).emit('sound_trigger', { sound: 'bid' });
    emitRoomState(room);
  });

  // R4 Lifelines: 'call_friend' | 'rival_hint'
  socket.on('r4_use_lifeline', ({ roomCode, team, lifelineType }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const caller = room.players.find(p => p.id === socket.id);
    if (!caller) return;
    if (team && team !== caller.team) {
      socket.emit('error_message', '🚫 لا يمكنك استخدام وسائل مساعدة لفريق الخصم.');
      return;
    }
    team = caller.team;

    const r4 = room.round4;
    if (!r4.usedLifelines) r4.usedLifelines = { team_a: [], team_b: [] };
    if (!r4.usedLifelines[team]) r4.usedLifelines[team] = [];

    if (r4.usedLifelines[team].includes(lifelineType)) {
      socket.emit('error_message', 'هذه الوسيلة تم استخدامها من قبل لفريقك!');
      return;
    }

    r4.usedLifelines[team].push(lifelineType);

    if (lifelineType === 'call_friend') {
      r4.timer += 20;
      io.to(roomCode).emit('sound_trigger', { sound: 'bid' });
      io.to(roomCode).emit('notification', {
        title: '📞 اتصل بصديق (+20 ثانية)',
        message: `${room.teams[team]?.name || 'الفريق'} استخدم وسيلة اتصل بصديق وحصل على +20 ثانية!`
      });
    } else if (lifelineType === 'rival_hint') {
      const validItems = r4.currentTopic?.validItems || [];
      const unrevealed = validItems.filter(item => !r4.itemsNamed.includes(item));
      const hintItem = unrevealed.length > 0 ? unrevealed[0] : (validItems[0] || 'إجابة مفتاحية');
      io.to(roomCode).emit('sound_trigger', { sound: 'bid' });
      io.to(roomCode).emit('notification', {
        title: '💡 هينت من الخصم!',
        message: `تلميح الخصم يكشف إجابة مؤكدة: "${hintItem}"`
      });
    }

    emitRoomState(room);
  });

  // Toggle item named in auction checklist. Only the designated opposing
  // referee may tick items; the answering team can never self-verify.
  socket.on('r4_toggle_item', ({ roomCode, item }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!requireReferee(room, 'round4', socket, 'تدقيق إجابات المزاد')) return;

    const r4 = room.round4;
    const validItems = r4.currentTopic?.validItems || [];
    if (!validItems.includes(item)) {
      socket.emit('error_message', '🚫 هذا العنصر ليس ضمن قائمة الإجابات المعتمدة.');
      return;
    }
    if (!r4.itemsNamed) r4.itemsNamed = [];

    if (r4.itemsNamed.includes(item)) {
      r4.itemsNamed = r4.itemsNamed.filter(i => i !== item);
    } else {
      r4.itemsNamed.push(item);
      io.to(roomCode).emit('sound_trigger', { sound: 'correct' });
    }

    emitRoomState(room);
  });

  socket.on('r4_resolve_bid', ({ roomCode, success }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!requireReferee(room, 'round4', socket, 'اعتماد نقاط المزاد')) return;

    const r4 = room.round4;
    const winningTeam = r4.highestBidderTeam;

    if (!winningTeam) {
      socket.emit('error_message', '🚫 لا يوجد صاحب مزاد معتمد بعد.');
      return;
    }

    if (success && (r4.itemsNamed?.length || 0) < r4.highestBid) {
      socket.emit('error_message', `🚫 لم يصل الفريق للرقم المطلوب (${r4.itemsNamed?.length || 0}/${r4.highestBid}). لا يمكن اعتماد النقاط.`);
      return;
    }

    if (success) {
      const reward = r4.highestBid * 400;
      room.teams[winningTeam].score += reward;
      io.to(roomCode).emit('sound_trigger', { sound: 'goal_roar' });
      io.to(roomCode).emit('confetti_trigger');
      io.to(roomCode).emit('notification', {
        title: 'أنا قدها ونص! 🏆',
        message: `${room.teams[winningTeam].name} حقق الرقم المطلوب وكسب ${reward} نقطة!`
      });
    } else {
      // Penalty for failing bid
      const penalty = r4.highestBid * 250;
      room.teams[winningTeam].score = Math.max(0, room.teams[winningTeam].score - penalty);
      io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
      io.to(roomCode).emit('notification', {
        title: 'وقعت في الفخ! ❌',
        message: `${room.teams[winningTeam].name} مقدرش يوفي بالمزاد وخسر ${penalty} نقطة!`
      });
    }

    r4.currentTopicIndex = (r4.currentTopicIndex || 0) + 1;
    r4.phase = 'resolved';

    if (r4.currentTopicIndex >= 4) {
      io.to(roomCode).emit('sound_trigger', { sound: 'fanfare' });
      io.to(roomCode).emit('confetti_trigger');
      io.to(roomCode).emit('notification', {
        title: '🏁 اكتملت جولة المزاد (4 موضوعات)!',
        message: 'تم إنجاز كافة جولات ساحة الكويز! حان وقت تتويج بطل الساحة 👑'
      });
    } else {
      const nextTopic = AUCTION_TOPICS[r4.currentTopicIndex % AUCTION_TOPICS.length];
      r4.currentTopic = nextTopic;
      r4.highestBid = nextTopic.minBid;
      r4.timer = 60;
      r4.itemsNamed = [];
      r4.phase = 'bidding';
      r4.usedLifelines = { team_a: [], team_b: [] };
      r4.highestBidderTeam = null;
      r4.highestBidderPlayerId = null;
      assignReferee(room, 'round4', { reason: 'next_topic' });
    }

    emitRoomState(room);
  });

  // Chat message & Taunts
  socket.on('send_chat', ({ roomCode, text, isTaunt }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const msg = {
      id: Date.now() + Math.random().toString(),
      senderName: player?.name || 'مجهول',
      characterAvatar: player?.character?.avatar || '⚡',
      team: player?.team || 'team_a',
      text,
      isTaunt: !!isTaunt,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    room.messages.push(msg);
    if (room.messages.length > 50) room.messages.shift();

    io.to(roomCode).emit('chat_received', msg);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);

    for (const [code, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) continue;

      const removedPlayer = room.players[playerIndex];
      console.log(`[Player Disconnected] ${removedPlayer.name} disconnected from room ${code}`);

      if (room.status === 'lobby' || room.status === 'waiting') {
        // If countdown was in progress, cancel it immediately!
        if (room.countdownInterval) {
          clearInterval(room.countdownInterval);
          room.countdownInterval = null;
          room.countdown = null;
          io.to(room.code).emit('countdown_cancelled', {
            reason: `انقطع اتصال ${removedPlayer.name} قبل انطلاق المباراة! تم إلغاء العد التنازلي.`
          });
        }

        // Remove disconnected player (resets slot to empty)
        room.players.splice(playerIndex, 1);

        // Transfer host authority if host left
        if (removedPlayer.isHost && room.players.length > 0) {
          room.players[0].isHost = true;
          room.hostId = room.players[0].id;
          io.to(room.code).emit('notification', {
            title: 'انتقال شارة القيادة 👑',
            message: `${room.players[0].name} أصبح هو كابتن الغرفة الجديد!`
          });
        }

        if (room.players.length === 0 && code !== 'ARENA' && code !== 'QZ-7842') {
          rooms.delete(code);
          console.log(`[Room Deleted] Room ${code} was deleted because all players left.`);
        } else {
          emitRoomState(room);
          io.to(room.code).emit('notification', {
            title: 'تفريغ خانة ⚠️',
            message: `غادر ${removedPlayer.name} الساحة. تم تفريغ الخانة!`
          });
        }
        continue;
      }

      // In-game disconnect: keep the seat for the scoreboard, mark it offline.
      // The referee watchdog will transfer judging rights after the grace period.
      removedPlayer.connected = false;
      removedPlayer.lastSeen = Date.now();

      // Host migration during a live match (connected humans first).
      if (removedPlayer.isHost) {
        const nextHost = room.players.find(p => p.id !== socket.id && isConnectedHuman(p));
        if (nextHost) {
          room.players.forEach(p => { p.isHost = false; });
          nextHost.isHost = true;
          room.hostId = nextHost.id;
          io.to(room.code).emit('notification', {
            title: 'انتقال شارة القيادة 👑',
            message: `${nextHost.name} أصبح كابتن الغرفة الجديد بعد انقطاع الهوست.`
          });
        }
      }

      emitRoomState(room);
      io.to(room.code).emit('notification', {
        title: 'انقطاع اتصال ⚠️',
        message: `فقدنا اتصال ${removedPlayer.name}. سيتم تحويل صلاحيات التحكيم تلقائياً إذا كان هو الحكم الحالي.`
      });
    }
  });
});

// =================== REFEREE FAILOVER WATCHDOG ===================
// Runs continuously. A referee that stops heartbeating for REFEREE_FAILOVER_MS
// (screen lock, crash, network drop) loses judging rights immediately.
const refereeWatchdog = setInterval(() => {
  const now = Date.now();

  for (const room of rooms.values()) {
    const roundKey = room.status;
    if (!ROUND_KEYS.includes(roundKey)) continue;

    const state = room[roundKey];
    if (!state) continue;

    const currentRef = room.players.find(p => p.id === state.refereePlayerId);

    if (!currentRef) {
      if (getRoundRefereePool(room, roundKey).length > 0) {
        const previousId = state.refereePlayerId;
        assignReferee(room, roundKey, { reason: 'missing_referee' });
        notifyRefereeChange(room, roundKey, previousId, 'failover');
        emitRoomState(room);
      }
      continue;
    }

    // Bots never receive judging rights, so they cannot "time out".
    if (currentRef.isBot) continue;

    const lastSeen = Math.max(state.refereeLastSeen || 0, currentRef.lastSeen || 0, state.refereeAssignedAt || 0);
    const isAlive =
      currentRef.connected !== false &&
      now - lastSeen <= REFEREE_FAILOVER_MS;

    if (isAlive) continue;

    // Pick a different connected human. If no alternative exists, keep the
    // seat to avoid an infinite rotation loop and wait for a player to return.
    const alternatives = getRoundRefereePool(room, roundKey).filter(p => p.id !== currentRef.id);
    if (alternatives.length === 0) continue;

    const previousId = state.refereePlayerId;
    assignReferee(room, roundKey, {
      rotate: true,
      reason: 'failover',
      excludeIds: [currentRef.id]
    });

    if (state.refereePlayerId) {
      notifyRefereeChange(room, roundKey, previousId, 'failover');
      emitRoomState(room);
    }
  }
}, REFEREE_WATCHDOG_MS);

refereeWatchdog.unref?.();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'Quiz Arena Backend', activeRooms: rooms.size });
});

// Dynamic In-Game Engine API Endpoints ("القلاية")
app.get('/api/trivia/stats', (req, res) => {
  res.json({
    totalQuestions: triviaEngine.inMemoryBank.length,
    modes: {
      one_two_bank: triviaEngine.inMemoryBank.filter(q => q.mode === 'one_two_bank').length,
      edini_fi_seri: triviaEngine.inMemoryBank.filter(q => q.mode === 'edini_fi_seri').length,
      hat_fi_qoraybi: triviaEngine.inMemoryBank.filter(q => q.mode === 'hat_fi_qoraybi').length,
      meen_yezawwed: triviaEngine.inMemoryBank.filter(q => q.mode === 'meen_yezawwed').length
    }
  });
});

app.get('/api/trivia/next', (req, res) => {
  const { roomId = 'test_room', characterId = 'fares_elfouly', mode = 'one_two_bank', category } = req.query;
  const q = triviaEngine.getQuestionForPlayer({
    roomId,
    characterId,
    mode,
    preferredCategory: category
  });
  res.json({ question: q });
});

app.post('/api/trivia/replenish', async (req, res) => {
  const { category = 'general_knowledge', mode = 'one_two_bank', count = 50 } = req.body || {};
  const batch = await triviaEngine.generateBatch(category, mode, count);
  const inserted = triviaEngine.upsertQuestions(batch);
  res.json({ success: true, count: inserted, total: triviaEngine.inMemoryBank.length });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 Quiz Arena Real-Time Game Server running on port ${PORT}`);
});

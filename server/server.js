import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { CHARACTERS, TEAMS } from '../src/data/characters.js';
import { TRIVIA_BANK, PASSWORD_WORDS, PENALTY_QUESTIONS, AUCTION_TOPICS } from '../src/data/questions.js';

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

// Helper to generate a 4-letter room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Initial state for a room
function createInitialRoomState(roomCode, hostId, hostName) {
  return {
    code: roomCode,
    hostId: hostId,
    status: 'lobby', // 'lobby' | 'round1' | 'round2' | 'round3' | 'round4' | 'game_over'
    players: [],
    teams: {
      team_a: { id: 'team_a', name: 'فريق الحيتان (Team A)', score: 0, bank: 0, penaltyScore: 0 },
      team_b: { id: 'team_b', name: 'فريق الوحوش (Team B)', score: 0, bank: 0, penaltyScore: 0 }
    },
    // Round 1: "1 تو" (Bank Mode)
    round1: {
      activeTeam: 'team_a',
      answeringPlayerId: null,
      readerPlayerId: null,
      currentQuestionIndex: 0,
      streak: 0, // 0 to 10
      pendingPoints: 0,
      streakLadder: [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000],
      currentQuestion: null,
      timer: 30,
      isTimerRunning: false,
      history: []
    },
    // Round 2: "اديني في سري" (Password Mode)
    round2: {
      activeClueGiverA: null,
      activeClueGiverB: null,
      hostRefereeId: null,
      currentWordIndex: 0,
      currentWord: null,
      timer: 45,
      isTimerRunning: false,
      fouls: { team_a: 0, team_b: 0 }
    },
    // Round 3: "حط في قريبي" (Penalty Shootouts)
    round3: {
      turnIndex: 0, // 0 to 9 (5 shots each)
      currentKickerId: null,
      currentGoalieId: null,
      kickerTeam: 'team_a',
      currentQuestion: null,
      timer: 20,
      isTimerRunning: false,
      interceptBuzzedBy: null,
      shotsHistory: []
    },
    // Round 4: "مين يزوّد؟" (Blind Auction)
    round4: {
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
      scoreContribution: 0
    };

    room.players.push(player);
    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('room_created', { roomCode, player, room });
    console.log(`[Room Created] ${roomCode} by ${player.name}`);
  });

  // Join room
  socket.on('join_room', ({ roomCode, playerName, characterId, teamPreference }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);

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
      scoreContribution: 0
    };

    room.players.push(player);
    socket.join(code);

    socket.emit('joined_room', { roomCode: code, player, room });
    io.to(code).emit('room_state_updated', room);
    console.log(`[Player Joined] ${player.name} joined ${code} in ${team}`);
  });

  // Update player character or team in lobby
  socket.on('update_player_profile', ({ roomCode, characterId, team }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      if (characterId) {
        const char = CHARACTERS.find(c => c.id === characterId);
        if (char) player.character = char;
      }
      if (team) {
        player.team = team;
      }
      io.to(roomCode).emit('room_state_updated', room);
    }
  });

  // Start game / change round (Host only)
  socket.on('change_round', ({ roomCode, targetRound }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.status = targetRound;

    if (targetRound === 'round1') {
      // Setup Round 1: 1 تو Bank Mode
      const teamAPlayers = room.players.filter(p => p.team === 'team_a');
      const teamBPlayers = room.players.filter(p => p.team === 'team_b');
      room.round1.activeTeam = 'team_a';
      room.round1.answeringPlayerId = teamAPlayers[0]?.id || room.players[0]?.id;
      room.round1.readerPlayerId = teamBPlayers[0]?.id || (room.players[1] ? room.players[1].id : room.players[0]?.id);
      room.round1.streak = 0;
      room.round1.pendingPoints = 0;
      room.round1.currentQuestionIndex = 0;
      room.round1.currentQuestion = TRIVIA_BANK[0];
    } else if (targetRound === 'round2') {
      // Setup Round 2: اديني في سري Password Mode
      const teamAPlayers = room.players.filter(p => p.team === 'team_a');
      const teamBPlayers = room.players.filter(p => p.team === 'team_b');
      room.round2.activeClueGiverA = teamAPlayers[0]?.id || room.players[0]?.id;
      room.round2.activeClueGiverB = teamBPlayers[0]?.id || (room.players[1] ? room.players[1].id : room.players[0]?.id);
      room.round2.hostRefereeId = room.hostId;
      room.round2.currentWordIndex = 0;
      room.round2.currentWord = PASSWORD_WORDS[0];
      room.round2.timer = 45;
    } else if (targetRound === 'round3') {
      // Setup Round 3: حط في قريبي Penalty Shootouts
      room.round3.turnIndex = 0;
      room.round3.kickerTeam = 'team_a';
      const teamAPlayers = room.players.filter(p => p.team === 'team_a');
      const teamBPlayers = room.players.filter(p => p.team === 'team_b');
      room.round3.currentKickerId = teamAPlayers[0]?.id || room.players[0]?.id;
      room.round3.currentGoalieId = teamBPlayers[0]?.id || (room.players[1] ? room.players[1].id : room.players[0]?.id);
      room.round3.currentQuestion = PENALTY_QUESTIONS[0];
      room.round3.interceptBuzzedBy = null;
    } else if (targetRound === 'round4') {
      // Setup Round 4: مين يزوّد؟ Blind Auction
      room.round4.currentTopicIndex = 0;
      room.round4.currentTopic = AUCTION_TOPICS[0];
      room.round4.highestBid = room.round4.currentTopic.minBid;
      room.round4.highestBidderTeam = null;
      room.round4.highestBidderPlayerId = null;
      room.round4.phase = 'bidding';
      room.round4.timer = 60;
      room.round4.itemsNamed = [];
    }

    io.to(roomCode).emit('room_state_updated', room);
    io.to(roomCode).emit('notification', { title: 'انتقال الجولة', message: `بدأت الآن: ${targetRound}` });
  });

  // =================== ROUND 1 ACTIONS ===================
  // Score / Correct Answer
  socket.on('r1_action_score', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

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

    // Pick next question tailored to player or general
    const nextIdx = (r1.currentQuestionIndex + 1) % TRIVIA_BANK.length;
    r1.currentQuestionIndex = nextIdx;
    r1.currentQuestion = TRIVIA_BANK[nextIdx];

    io.to(roomCode).emit('sound_trigger', { sound: 'correct', streak: nextStreak });
    io.to(roomCode).emit('room_state_updated', room);
  });

  // Break streak / Wrong answer
  socket.on('r1_action_break', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r1 = room.round1;
    const answeringPlayer = room.players.find(p => p.id === r1.answeringPlayerId);

    // Check if player has streak shield (El-Touny) or firewall protection (Eyad)
    if (answeringPlayer?.character?.id === 'abdelrahman_eltouny' && r1.streak > 1) {
      // El Touny shield saves streak once!
      io.to(roomCode).emit('notification', {
        title: 'درع التوني بيلافيتا! 🍦',
        message: 'تم تفعيل حماية الستريك وإنقاذ النقاط من الضياع!'
      });
      // Streak reduced by only 1 instead of 0
      r1.streak = Math.max(1, r1.streak - 1);
      r1.pendingPoints = r1.streakLadder[r1.streak];
    } else {
      // Break streak completely
      r1.streak = 0;
      r1.pendingPoints = 0;
      io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    }

    const nextIdx = (r1.currentQuestionIndex + 1) % TRIVIA_BANK.length;
    r1.currentQuestionIndex = nextIdx;
    r1.currentQuestion = TRIVIA_BANK[nextIdx];

    io.to(roomCode).emit('room_state_updated', room);
  });

  // BANK points
  socket.on('r1_action_bank', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

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
      io.to(roomCode).emit('room_state_updated', room);
    }
  });

  // Pass Round 1 turn to next player / opposite team
  socket.on('r1_pass_turn', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r1 = room.round1;
    r1.pendingPoints = 0;
    r1.streak = 0;

    // Toggle active team
    r1.activeTeam = r1.activeTeam === 'team_a' ? 'team_b' : 'team_a';
    const answeringCandidates = room.players.filter(p => p.team === r1.activeTeam);
    const readerCandidates = room.players.filter(p => p.team !== r1.activeTeam);

    if (answeringCandidates.length > 0) {
      const currentAnsIdx = answeringCandidates.findIndex(p => p.id === r1.answeringPlayerId);
      const nextAnsIdx = (currentAnsIdx + 1) % answeringCandidates.length;
      r1.answeringPlayerId = answeringCandidates[nextAnsIdx].id;
    }

    if (readerCandidates.length > 0) {
      const currentReadIdx = readerCandidates.findIndex(p => p.id === r1.readerPlayerId);
      const nextReadIdx = (currentReadIdx + 1) % readerCandidates.length;
      r1.readerPlayerId = readerCandidates[nextReadIdx].id;
    }

    io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    io.to(roomCode).emit('room_state_updated', room);
  });

  // =================== ROUND 2 ACTIONS (Password Mode) ===================
  socket.on('r2_award_point', ({ roomCode, team }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r2 = room.round2;
    room.teams[team].score += 500;

    // Pick next secret word
    const nextIdx = (r2.currentWordIndex + 1) % PASSWORD_WORDS.length;
    r2.currentWordIndex = nextIdx;
    r2.currentWord = PASSWORD_WORDS[nextIdx];

    io.to(roomCode).emit('sound_trigger', { sound: 'correct' });
    io.to(roomCode).emit('room_state_updated', room);
  });

  socket.on('r2_foul', ({ roomCode, team }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r2 = room.round2;
    r2.fouls[team] = (r2.fouls[team] || 0) + 1;
    // Deduct 200 points on foul
    room.teams[team].score = Math.max(0, room.teams[team].score - 200);

    io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    io.to(roomCode).emit('room_state_updated', room);
  });

  socket.on('r2_time_freeze', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Ziad's bonus: +10s time freeze
    room.round2.timer += 10;
    io.to(roomCode).emit('notification', {
      title: 'تجميد الوقت الفندقي 🛎️',
      message: 'زياد الفندقي مد الوقت +10 ثواني كاملة بروقان!'
    });
    io.to(roomCode).emit('room_state_updated', room);
  });

  // =================== ROUND 3 ACTIONS (Penalty Shootout) ===================
  socket.on('r3_intercept_buzz', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r3 = room.round3;
    if (!r3.interceptBuzzedBy) {
      r3.interceptBuzzedBy = socket.id;
      const goalie = room.players.find(p => p.id === socket.id);
      io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
      io.to(roomCode).emit('notification', {
        title: 'صد واعتراض! 🛡️',
        message: `${goalie?.name || 'حارس المرمى'} ضغط على بزر الصد لسرقة النقطة!`
      });
      io.to(roomCode).emit('room_state_updated', room);
    }
  });

  socket.on('r3_record_shot', ({ roomCode, result }) => { // result: 'goal' | 'saved' | 'missed'
    const room = rooms.get(roomCode);
    if (!room) return;

    const r3 = room.round3;
    const kickingTeam = r3.kickerTeam;
    const defendingTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';

    if (result === 'goal') {
      room.teams[kickingTeam].score += 1000;
      room.teams[kickingTeam].penaltyScore += 1;
      io.to(roomCode).emit('sound_trigger', { sound: 'goal_roar' });
      io.to(roomCode).emit('confetti_trigger');
    } else if (result === 'saved') {
      // Goalie stole point
      room.teams[defendingTeam].score += 800;
      io.to(roomCode).emit('sound_trigger', { sound: 'save' });
    } else {
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    }

    r3.shotsHistory.push({
      shotIndex: r3.turnIndex,
      team: kickingTeam,
      result: result,
      intercepted: !!r3.interceptBuzzedBy
    });

    // Advance turn
    r3.turnIndex += 1;
    r3.kickerTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';
    r3.interceptBuzzedBy = null;

    const teamAPlayers = room.players.filter(p => p.team === 'team_a');
    const teamBPlayers = room.players.filter(p => p.team === 'team_b');

    if (r3.kickerTeam === 'team_a') {
      r3.currentKickerId = teamAPlayers[r3.turnIndex % teamAPlayers.length]?.id;
      r3.currentGoalieId = teamBPlayers[r3.turnIndex % teamBPlayers.length]?.id;
    } else {
      r3.currentKickerId = teamBPlayers[r3.turnIndex % teamBPlayers.length]?.id;
      r3.currentGoalieId = teamAPlayers[r3.turnIndex % teamAPlayers.length]?.id;
    }

    const nextQIdx = (r3.turnIndex) % PENALTY_QUESTIONS.length;
    r3.currentQuestion = PENALTY_QUESTIONS[nextQIdx];

    io.to(roomCode).emit('room_state_updated', room);
  });

  // =================== ROUND 4 ACTIONS (Blind Auction) ===================
  socket.on('r4_bid', ({ roomCode, increment }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r4 = room.round4;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    r4.highestBid += increment;
    r4.highestBidderTeam = player.team;
    r4.highestBidderPlayerId = player.id;

    io.to(roomCode).emit('sound_trigger', { sound: 'bid' });
    io.to(roomCode).emit('room_state_updated', room);
  });

  socket.on('r4_resolve_bid', ({ roomCode, success }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const r4 = room.round4;
    const winningTeam = r4.highestBidderTeam;

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

    r4.phase = 'resolved';
    io.to(roomCode).emit('room_state_updated', room);
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
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'Quiz Arena Backend', activeRooms: rooms.size });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 Quiz Arena Real-Time Game Server running on port ${PORT}`);
});

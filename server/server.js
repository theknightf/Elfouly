import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { CHARACTERS } from '../src/data/characters.js';
import { PASSWORD_WORDS, AUCTION_TOPICS, PENALTY_CATEGORIES } from '../src/data/questions.js';
import { TOURNAMENT_STRUCTURE } from '../src/data/tournamentStructure.js';
import { TurnManager } from '../src/game/TurnManager.js';
import { triviaEngine, buildRound1TurnPlan } from '../services/triviaEngine.js';
import { calculateBonus, isGeneralCategory } from '../src/utils/penaltyRules.js';

// Resolve CORS allowed origins
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
let corsOrigins;

if (rawAllowedOrigins && rawAllowedOrigins.trim() !== '') {
  const parsed = rawAllowedOrigins
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  corsOrigins = parsed.length === 1 ? parsed[0] : parsed;
} else {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ [SECURITY] ALLOWED_ORIGINS must be set in production. Refusing to start with wildcard CORS.');
    process.exit(1);
  }
  corsOrigins = '*';
}

const app = express();
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST']
}));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST']
  },
  pingInterval: 20000,
  pingTimeout: 25000
});

const PORT = Number(process.env.PORT) || 3001;

// Global rooms store
const rooms = new Map();

// =================== ROOM / RECONNECT CONSTANTS ===================
const DISCONNECT_GRACE_MS = 20000;
const JOIN_RATE_LIMIT = 10;
const JOIN_RATE_WINDOW_MS = 60000;
const JOIN_ATTEMPTS = new Map();
const LAST_CHAT_AT = new Map();
const LOBBY_STATUSES = ['lobby', 'waiting'];
const MATCH_STATUSES = ['round1', 'round2', 'round3', 'round4', 'game_over'];
const TARGET_ROUNDS = ['lobby', 'round1', 'round2', 'round3', 'round4', 'game_over'];
const MAX_ROOM_PLAYERS = 4;
const TEAM_PLAYERS = 2;
const MAX_CHAT_LENGTH = 240;
const CHAT_RATE_LIMIT_MS = 500;
const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0, O, 1, I, L

function sanitizePlayerName(inputName) {
  if (typeof inputName !== 'string') return '';
  return inputName
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
}

function createPlayerToken() {
  return crypto.randomUUID();
}

function getTeamCounts(room) {
  const counts = { team_a: 0, team_b: 0 };
  for (const player of room.players) {
    if (counts[player.team] !== undefined) counts[player.team] += 1;
  }
  return counts;
}

// The server always decides the team. A preference is honoured only while
// that team still has room; every team is capped at 2 players.
function pickTeamForNewPlayer(room, teamPreference) {
  const counts = getTeamCounts(room);
  const preferred = teamPreference === 'team_a' || teamPreference === 'team_b'
    ? teamPreference
    : null;

  if (preferred && counts[preferred] < TEAM_PLAYERS) return preferred;

  if (preferred) {
    const other = preferred === 'team_a' ? 'team_b' : 'team_a';
    if (counts[other] < TEAM_PLAYERS) return other;
    return null;
  }

  if (counts.team_a < TEAM_PLAYERS) return 'team_a';
  if (counts.team_b < TEAM_PLAYERS) return 'team_b';
  return null;
}

function resolveCharacterForPlayer(room, characterId, socketId = null) {
  const takenByAnother = (charId) => room.players.some(
    p => p.character?.id === charId && p.id !== socketId
  );

  if (characterId) {
    const character = CHARACTERS.find(c => c.id === characterId);
    if (!character) {
      return { error: 'الشخصية دي مش موجودة في الساحة! اختار شخصية تانية — Character not found.' };
    }
    if (takenByAnother(character.id)) {
      return { error: 'الشخصية دي محجوزة بالفعل! اختار شخصية تانية — Character already taken.' };
    }
    return { character };
  }

  const available = CHARACTERS.find(c => !takenByAnother(c.id));
  if (!available) {
    return { error: 'كل الشخصيات محجوزة بالفعل! — All characters are taken.' };
  }
  return { character: available };
}

function getStartReadiness(room) {
  const teamA = room.players.filter(p => p.team === 'team_a');
  const teamB = room.players.filter(p => p.team === 'team_b');

  if (room.players.length !== MAX_ROOM_PLAYERS) {
    return {
      ok: false,
      message: `العدد مش مكتمل! لازم ${MAX_ROOM_PLAYERS} لاعبين بالظبط، والتوزيع ${TEAM_PLAYERS} ضد ${TEAM_PLAYERS} (${room.players.length}/${MAX_ROOM_PLAYERS}).`
    };
  }

  if (teamA.length !== TEAM_PLAYERS || teamB.length !== TEAM_PLAYERS) {
    return {
      ok: false,
      message: `التوزيع مش ${TEAM_PLAYERS} ضد ${TEAM_PLAYERS}! لازم فريقين كل واحد فيهم ${TEAM_PLAYERS} لاعبين بالظبط (${teamA.length} ضد ${teamB.length}).`
    };
  }

  const offlineHumans = room.players.filter(p => !p.isBot && p.connected === false);
  if (offlineHumans.length > 0) {
    return {
      ok: false,
      message: `كل اللاعبين لازم يكونوا متصلين! في لاعب مش متصل: ${offlineHumans.map(p => p.name).join('، ')}.`
    };
  }

  return { ok: true };
}

function isJoinRateLimited(socketId) {
  const now = Date.now();
  const attempts = (JOIN_ATTEMPTS.get(socketId) || []).filter(t => now - t < JOIN_RATE_WINDOW_MS);

  if (attempts.length >= JOIN_RATE_LIMIT) {
    JOIN_ATTEMPTS.set(socketId, attempts);
    return true;
  }

  attempts.push(now);
  JOIN_ATTEMPTS.set(socketId, attempts);
  return false;
}

function emitActionError(socket, message, field = null, action = null) {
  socket.emit('error_message', message);
  socket.emit('action_error', { message, field, action, at: Date.now() });
}

function remapPlayerId(room, oldId, newId) {
  if (!oldId || oldId === newId) return;

  const oldSamples = playerLatencySamples.get(oldId);
  if (oldSamples) {
    playerLatencySamples.set(newId, oldSamples);
    playerLatencySamples.delete(oldId);
  }

  for (const roundKey of ROUND_KEYS) {
    const state = room[roundKey];
    if (!state) continue;

    if (state.refereePlayerId === oldId) state.refereePlayerId = newId;
    if (Array.isArray(state.refereeQueue)) {
      state.refereeQueue = state.refereeQueue.map(id => (id === oldId ? newId : id));
    }
    if (state.readerPlayerId === oldId) state.readerPlayerId = newId;
    if (state.answeringPlayerId === oldId) state.answeringPlayerId = newId;
    if (state.activeClueGiverA === oldId) state.activeClueGiverA = newId;
    if (state.activeClueGiverB === oldId) state.activeClueGiverB = newId;
    if (state.currentKickerId === oldId) state.currentKickerId = newId;
    if (state.currentGoalieId === oldId) state.currentGoalieId = newId;
    if (state.highestBidderPlayerId === oldId) state.highestBidderPlayerId = newId;
    if (state.interceptBuzzedBy === oldId) state.interceptBuzzedBy = newId;
  }
}

// =================== REFEREE / ANTI-CHEAT ENGINE ===================
// A referee device is the ONLY device allowed to grade the current round.
// If a referee stops sending heartbeats (screen lock / crash / disconnect)
// for this grace period, the server rotates refereeing to the next device.
const REFEREE_FAILOVER_MS = 6000; // inside the required 5-8 seconds window
const REFEREE_WATCHDOG_MS = 2000;
export const R3_TIE_WINDOW_MS = 300; // both clicks inside this window require neutral confirmation
export const MAX_LATENCY_COMPENSATION_MS = 250;
export const LATENCY_SAMPLE_TTL_MS = 15000;

// =================== FAIR TIMING (ROUND 3 INTERNET LATENCY) ===================
export const playerLatencySamples = new Map(); // socket.id -> [{ rtt: number, timestamp: number }]

export function recordPlayerRtt(socketId, rtt) {
  if (typeof rtt !== 'number' || isNaN(rtt) || rtt < 0) return;
  const now = Date.now();
  let samples = playerLatencySamples.get(socketId) || [];
  samples = samples.filter(s => now - s.timestamp <= LATENCY_SAMPLE_TTL_MS);
  samples.push({ rtt, timestamp: now });
  if (samples.length > 5) samples = samples.slice(-5);
  playerLatencySamples.set(socketId, samples);
}

export function getPlayerSmoothedRtt(socketId) {
  const now = Date.now();
  const samples = (playerLatencySamples.get(socketId) || []).filter(s => now - s.timestamp <= LATENCY_SAMPLE_TTL_MS);
  if (samples.length === 0) return 0;
  const sorted = samples.map(s => s.rtt).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function getPlayerCompensation(socketId) {
  const smoothedRtt = getPlayerSmoothedRtt(socketId);
  return Math.min(MAX_LATENCY_COMPENSATION_MS, Math.max(0, smoothedRtt / 2));
}

export function resolveShootoutTimings({
  answerAt,
  interceptAt,
  kickerCompensation = 0,
  goalieCompensation = 0,
  isCorrect = true,
  tieWindowMs = R3_TIE_WINDOW_MS
}) {
  const answerCompensatedAt = answerAt - kickerCompensation;
  const interceptCompensatedAt = interceptAt != null ? (interceptAt - goalieCompensation) : null;

  let provisional;
  if (isCorrect) {
    provisional = (interceptCompensatedAt != null && interceptCompensatedAt < answerCompensatedAt)
      ? 'saved'
      : 'goal';
  } else {
    provisional = interceptCompensatedAt != null ? 'saved' : 'missed';
  }

  const bothClicked = interceptAt != null;
  const nearlySimultaneous = bothClicked && Math.abs(answerCompensatedAt - interceptCompensatedAt) <= tieWindowMs;

  return {
    provisional,
    nearlySimultaneous,
    answerCompensatedAt,
    interceptCompensatedAt
  };
}

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

function getR2ActiveTurnTeam(room) {
  return room?.round2?.activeTurnTeam === 'team_b' ? 'team_b' : 'team_a';
}

function getR2RefereeId(room) {
  const activeTeam = getR2ActiveTurnTeam(room);
  return activeTeam === 'team_a'
    ? room?.round2?.activeClueGiverB || null
    : room?.round2?.activeClueGiverA || null;
}

function getRoundRefereePool(room, roundKey) {
  const humans = room.players.filter(isConnectedHuman);

  if (roundKey === 'round1') {
    return humans.filter(p => p.team !== room.round1.activeTeam);
  }

  if (roundKey === 'round2') {
    // The only judge is the opposing team's clue-giver for the active turn.
    // Guessers must never hold the secret card or the judging console.
    const refereeId = getR2RefereeId(room);
    return humans.filter(p => p.id === refereeId);
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

  if (roundKey === 'round2') {
    // Password mode has a fixed judge for the active clue turn: the opposing
    // clue-giver. There is no independent referee rotation and never a fallback
    // to a guesser, because that would leak the secret card.
    const candidateId = getR2RefereeId(room);
    const candidate = room.players.find(p => p.id === candidateId && isConnectedHuman(p));
    state.refereePlayerId = candidate?.id || null;
    state.refereeQueue = candidate ? [candidate.id] : [];
    state.refereeAssignedAt = Date.now();
    state.refereeLastSeen = Date.now();
    state.refereeFallback = false;
    if (reason === 'failover') state.refereeFailovers = (state.refereeFailovers || 0) + 1;
    return { previousId, refereeId: state.refereePlayerId, fallback: false, reason };
  }

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
  // Player tokens and disconnect timers are private server-side reconnect data.
  const roomData = { ...room };
  delete roomData.countdownInterval;
  delete roomData.disconnectTimers;
  const snapshot = JSON.parse(JSON.stringify({ ...roomData, countdownInterval: null }));
  snapshot.players = (snapshot.players || []).map(player => {
    delete player.playerToken;
    delete player.disconnectAt;
    return player;
  });
  const viewer = room.players.find(p => p.id === socketId);

  const r1Ref = room.round1?.refereePlayerId === socketId;
  const r3Ref = room.round3?.refereePlayerId === socketId;
  const r4Ref = room.round4?.refereePlayerId === socketId;
  const r2ClueGiver =
    room.round2?.activeClueGiverA === socketId ||
    room.round2?.activeClueGiverB === socketId;

  if (snapshot.round1?.currentQuestion && !r1Ref) {
    snapshot.round1.currentQuestion.answer = null;
  }

  if (!r2ClueGiver) {
    snapshot.round2.currentWord = {
      target: '🤫 محجوبة',
      forbidden: ['••••', '••••', '••••', '••••'],
      category: 'سري',
      clueIdea: 'الكلمة السرية مرئية فقط لمرشدي الفريقين في هذا الدور.',
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

// Helper to generate a unique 6-character alphanumeric room code (e.g., QZ-AB2C9D)
function generateRoomCode() {
  let body = '';
  for (let i = 0; i < 6; i++) {
    body += ROOM_CODE_ALPHABET.charAt(crypto.randomInt(0, ROOM_CODE_ALPHABET.length));
  }
  return `QZ-${body}`;
}

// Flexible room lookup supporting hyphenated and raw codes, with or without QZ prefix
function findRoom(inputCode) {
  if (!inputCode) return null;
  const clean = String(inputCode).toUpperCase().trim().replace(/\s+/g, '');
  if (!clean) return null;
  if (rooms.has(clean)) return rooms.get(clean);

  const stripped = clean.replace(/-/g, '');
  const body = stripped.startsWith('QZ') ? stripped.slice(2) : stripped;

  // Try formatted with hyphen (e.g. QZAB2C9D or AB2C9D -> QZ-AB2C9D)
  if (body.length === 6) {
    const formatted = `QZ-${body}`;
    if (rooms.has(formatted)) return rooms.get(formatted);
  }

  // Search case-insensitively ignoring hyphens
  for (const [key, val] of rooms.entries()) {
    if (key.replace(/-/g, '') === stripped) {
      return val;
    }
  }
  return null;
}

function stopCountdown(room, reason = null) {
  if (!room?.countdownInterval) return false;
  clearInterval(room.countdownInterval);
  room.countdownInterval = null;
  room.countdown = null;
  if (reason) {
    io.to(room.code).emit('countdown_cancelled', { reason });
  }
  return true;
}

function isValidActionToken(expectedToken, receivedToken) {
  if (!expectedToken) return false;
  return typeof receivedToken === 'string' && receivedToken === expectedToken;
}

function requireRoundStatus(room, expectedStatus, socket, actionLabel) {
  if (room?.status === expectedStatus) return true;
  socket.emit('error_message', `🚫 ${actionLabel} متاح في ${expectedStatus} فقط.`);
  return false;
}

function getRoomAndPlayer(roomCode, socket) {
  const room = findRoom(roomCode);
  if (!room) {
    emitActionError(socket, 'الغرفة غير موجودة!', 'roomCode', 'room_lookup');
    return null;
  }
  const player = room.players.find(p => p.id === socket.id);
  if (!player) {
    emitActionError(socket, 'أنت لست عضواً في هذه الغرفة.', 'roomCode', 'room_membership');
    return null;
  }
  return { room, player };
}

// Initial state for a room
function createInitialRoomState(roomCode, hostId) {
  return {
    code: roomCode,
    hostId: hostId,
    status: 'lobby', // 'lobby' | 'round1' | 'round2' | 'round3' | 'round4' | 'game_over'
    countdown: null,
    countdownInterval: null,
    disconnectTimers: new Map(),
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
      actionToken: null,
      timer: 30,
      isTimerRunning: false,
      history: []
    },
    // Round 2: "اديني في سري" (Password Mode) - 5 Secret Cards
    round2: {
      ...createRefereeSlot(),
      activeClueGiverA: null,
      activeClueGiverB: null,
      activeTurnTeam: 'team_a',
      currentWordIndex: 0,
      totalQuestions: 5,
      currentWord: null,
      currentGiverIndex: 0,
      actionToken: null,
      isComplete: false,
      timeFreezeUsed: false,
      timer: 45,
      isTimerRunning: false,
      endTime: null,
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
      isComplete: false,
      shotsHistory: []
    },
    // Round 4: "مين يزوّد؟" (Blind Auction)
    round4: {
      ...createRefereeSlot(),
      currentTopicIndex: 0,
      currentTopic: null,
      topicId: null,
      highestBid: 0,
      highestBidderTeam: null,
      highestBidderPlayerId: null,
      timer: 60,
      isTimerRunning: false,
      endTime: null,
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

  // Fair timing: RTT measurement ping/pong and report
  socket.on('latency_ping', ({ start } = {}, callback) => {
    socket.emit('latency_pong', { start });
    if (typeof callback === 'function') callback({ start });
  });

  socket.on('latency_report', ({ rtt } = {}) => {
    if (typeof rtt === 'number') {
      recordPlayerRtt(socket.id, rtt);
    }
  });

  // Create room
  socket.on('create_room', ({ playerName, characterId }) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const room = createInitialRoomState(roomCode, socket.id);
    const { character, error } = resolveCharacterForPlayer(room, characterId);
    if (error) {
      emitActionError(socket, error, 'character', 'create_room');
      return;
    }

    const cleanName = sanitizePlayerName(playerName) || 'كابتن الساحة';

    const player = {
      id: socket.id,
      name: cleanName,
      character,
      team: 'team_a',
      isHost: true,
      isBot: false,
      connected: true,
      lastSeen: Date.now(),
      scoreContribution: 0,
      playerToken: createPlayerToken()
    };

    room.players.push(player);
    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('room_created', {
      roomCode,
      playerToken: player.playerToken,
      player,
      room: sanitizeRoomForViewer(room, socket.id)
    });
    console.log(`[Room Created] ${roomCode} by ${player.name}`);
  });

  // Join room
  socket.on('join_room', ({ roomCode, playerName, characterId, teamPreference }) => {
    if (isJoinRateLimited(socket.id)) {
      emitActionError(socket, 'محاولات دخول كتير في وقت قصير! استنى دقيقة وجرب تاني — Too many join attempts.', 'roomCode', 'join_room');
      return;
    }

    const room = findRoom(roomCode);

    if (!room) {
      emitActionError(socket, 'كود الغرفة غير موجود يا بطل! اتأكد من الكود — Room not found.', 'roomCode', 'join_room');
      return;
    }

    if (!LOBBY_STATUSES.includes(room.status)) {
      emitActionError(socket, 'الماتش بدأ بالفعل! مينفعش تنضم دلوقتي — Match already started.', 'roomCode', 'join_room');
      return;
    }

    if (room.players.length >= MAX_ROOM_PLAYERS) {
      emitActionError(socket, `الغرفة ممتلئة بالفعل (${MAX_ROOM_PLAYERS}/${MAX_ROOM_PLAYERS})! — Room is full.`, 'roomCode', 'join_room');
      return;
    }

    const { character, error } = resolveCharacterForPlayer(room, characterId);
    if (error) {
      emitActionError(socket, error, 'character', 'join_room');
      return;
    }

    const team = pickTeamForNewPlayer(room, teamPreference);
    if (!team) {
      emitActionError(socket, `الغرفة ممتلئة بالفعل (${MAX_ROOM_PLAYERS}/${MAX_ROOM_PLAYERS})! — Room is full.`, 'roomCode', 'join_room');
      return;
    }

    const cleanName = sanitizePlayerName(playerName) || `لاعب ${room.players.length + 1}`;

    const player = {
      id: socket.id,
      name: cleanName,
      character,
      team,
      isHost: false,
      isBot: false,
      connected: true,
      lastSeen: Date.now(),
      scoreContribution: 0,
      playerToken: createPlayerToken()
    };

    room.players.push(player);
    socket.join(room.code);

    socket.emit('joined_room', {
      roomCode: room.code,
      playerToken: player.playerToken,
      player,
      room: sanitizeRoomForViewer(room, socket.id)
    });
    emitRoomState(room);
    console.log(`[Player Joined] ${player.name} joined ${room.code} in ${team}`);
  });

  // Reconnect to a room using the private player token issued on create/join
  socket.on('rejoin_room', ({ roomCode, playerToken } = {}) => {
    const room = findRoom(roomCode);

    if (!room) {
      socket.emit('rejoin_failed', { message: 'الغرفة دي خلصت، اعمل غرفة جديدة', field: 'roomCode', reason: 'room_not_found' });
      socket.emit('error_message', 'الغرفة دي خلصت، اعمل غرفة جديدة');
      return;
    }

    const player = typeof playerToken === 'string' && playerToken
      ? room.players.find(p => p.playerToken === playerToken && !p.isBot)
      : null;

    if (!player) {
      socket.emit('rejoin_failed', { message: 'جلسة الاستعادة مش صالحة! ادخل بكود الغرفة من جديد — Invalid rejoin token.', field: 'roomCode' });
      socket.emit('error_message', 'جلسة الاستعادة مش صالحة! ادخل بكود الغرفة من جديد — Invalid rejoin token.');
      return;
    }

    const previousId = player.id;
    const pendingTimer = room.disconnectTimers?.get(player.playerToken);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      room.disconnectTimers.delete(player.playerToken);
    }

    const previousSocket = previousId !== socket.id ? io.sockets.sockets.get(previousId) : null;
    if (previousSocket) previousSocket.leave(room.code);

    player.id = socket.id;
    player.connected = true;
    player.lastSeen = Date.now();

    if (player.isHost) room.hostId = socket.id;
    remapPlayerId(room, previousId, socket.id);

    socket.join(room.code);

    socket.emit('rejoined_room', {
      roomCode: room.code,
      playerToken: player.playerToken,
      player,
      room: sanitizeRoomForViewer(room, socket.id)
    });
    emitRoomState(room);

    io.to(room.code).emit('notification', {
      title: 'رجوع الساحة ⚡',
      message: `${player.name} رجع تاني واتصل بالساحة.`
    });
  });

  // Add demo simulated bot player to room (helps solo testing 4/4)
  socket.on('add_demo_player', ({ roomCode }) => {
    const demoAllowed = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_BOTS === 'true';
    if (!demoAllowed) {
      socket.emit('error_message', '🚫 اللاعبين التجريبيين متاحين في بيئة التطوير فقط.');
      return;
    }

    const room = findRoom(roomCode);
    if (!room || room.players.length >= MAX_ROOM_PLAYERS) return;
    if (socket.id !== room.hostId || !LOBBY_STATUSES.includes(room.status)) {
      socket.emit('error_message', '🚫 إضافة اللاعبين التجريبيين متاحة للهوست داخل صالة الانتظار فقط.');
      return;
    }

    const availableChars = CHARACTERS.filter(c => !room.players.some(p => p.character?.id === c.id));
    const nextChar = availableChars[0] || CHARACTERS[room.players.length % CHARACTERS.length];
    const team = pickTeamForNewPlayer(room);

    if (!team) return;

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
  socket.on('update_player_profile', ({ roomCode, characterId, team, playerName }, ack) => {
    const respond = (payload) => {
      if (typeof ack === 'function') ack(payload);
    };

    const room = findRoom(roomCode);
    if (!room) {
      emitActionError(socket, 'الغرفة مش موجودة!', 'roomCode', 'update_player_profile');
      respond({ ok: false, error: 'room_not_found' });
      return;
    }

    if (!LOBBY_STATUSES.includes(room.status)) {
      const message = '🚫 لا يمكن تغيير الفريق أو الشخصية بعد انطلاق الماتش.';
      emitActionError(socket, message, 'character', 'update_player_profile');
      respond({ ok: false, error: message });
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      respond({ ok: false, error: 'player_not_found' });
      return;
    }

    if (characterId) {
      const character = CHARACTERS.find(c => c.id === characterId);
      if (!character) {
        const message = 'الشخصية دي مش موجودة! — Character not found.';
        emitActionError(socket, message, 'character', 'update_player_profile');
        respond({ ok: false, error: message });
        return;
      }

      const takenByAnother = room.players.some(
        p => p.id !== player.id && p.character?.id === character.id
      );
      if (takenByAnother) {
        const message = 'الشخصية دي محجوزة بالفعل! اختار شخصية تانية — Character already taken.';
        emitActionError(socket, message, 'character', 'update_player_profile');
        respond({ ok: false, error: message });
        return;
      }
    }

    if (team && team !== player.team) {
      if (team !== 'team_a' && team !== 'team_b') {
        const message = 'الفريق المطلوب غير صالح!';
        emitActionError(socket, message, 'team', 'update_player_profile');
        respond({ ok: false, error: message });
        return;
      }

      const counts = getTeamCounts(room);
      if (counts[team] >= 2) {
        const message = 'الفريق ده كامل (2/2)! اختار الفريق التاني أو استنى حد يخرج.';
        emitActionError(socket, message, 'team', 'update_player_profile');
        respond({ ok: false, error: message });
        return;
      }
    }

    if (characterId) {
      player.character = CHARACTERS.find(c => c.id === characterId);
    }
    if (team) player.team = team;

    const cleanName = sanitizePlayerName(playerName);
    if (cleanName) player.name = cleanName;

    emitRoomState(room);
    socket.emit('profile_updated', { player });
    respond({ ok: true, player });
  });

  function getR1TurnKey(room) {
    const r1 = room.round1;
    return `${r1.segmentIndex}:${r1.subBatchIndex}:${r1.answeringPlayerId}`;
  }

  function dispatchR1Question(room) {
    const r1 = room.round1;
    if (r1.totalQuestionsAnswered >= 48) {
      r1.currentQuestion = null;
      r1.actionToken = null;
      return false;
    }

    const answeringPlayer = room.players.find(p => p.id === r1.answeringPlayerId);
    const turnKey = getR1TurnKey(room);
    if (!Array.isArray(r1.turnPlan) || r1.turnPlanKey !== turnKey || r1.turnPlanIndex >= r1.turnPlan.length) {
      r1.turnPlan = buildRound1TurnPlan(answeringPlayer?.character?.id);
      r1.turnPlanKey = turnKey;
      r1.turnPlanIndex = 0;
    }

    const slot = r1.turnPlan[r1.turnPlanIndex];
    if (!slot) return false;

    const dispatchedQ = triviaEngine.getQuestionBySlot({
      roomId: room.code,
      characterId: answeringPlayer?.character?.id,
      mode: 'one_two_bank',
      slotType: slot.slotType,
      preferredCategory: slot.category
    });

    if (!dispatchedQ) {
      r1.currentQuestion = null;
      r1.actionToken = null;
      return false;
    }

    r1.turnPlanIndex += 1;
    r1.currentQuestionIndex += 1;
    r1.currentQuestion = {
      question: dispatchedQ.question_text,
      answer: dispatchedQ.correct_answer,
      categoryName: dispatchedQ.category,
      slotType: slot.slotType,
      funFact: slot.slotType === 'specialty'
        ? 'سؤال من تخصص اللاعب المجيب.'
        : 'سؤال عشوائي من بنك الجولة الأولى كله.'
    };
    r1.actionToken = crypto.randomUUID();
    return true;
  }

  // Helper to initialize Round 1
  function setupRound1(room) {
    const teamAPlayers = room.players.filter(p => p.team === 'team_a');
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
    room.round1.turnPlan = null;
    room.round1.turnPlanKey = null;
    room.round1.turnPlanIndex = 0;
    room.round1.history = [];
    room.round1.currentQuestion = null;
    room.round1.actionToken = null;
    room.round1.timer = 30;
    room.round1.isTimerRunning = false;

    // Round-robin referee from the opposing team (never the answering team).
    assignReferee(room, 'round1', { reason: 'round_start' });
    dispatchR1Question(room);
  }

  function setR2CardRoles(room, { toggleTurn = false, reason = 'card_roles' } = {}) {
    const r2 = room.round2;
    const teamAPlayers = room.players.filter(p => p.team === 'team_a');
    const teamBPlayers = room.players.filter(p => p.team === 'team_b');
    const cardIndex = Math.max(0, r2.currentWordIndex || 0);
    const previousGiverA = r2.activeClueGiverA;
    const previousGiverB = r2.activeClueGiverB;

    if (toggleTurn) {
      r2.activeTurnTeam = getR2ActiveTurnTeam(room) === 'team_a' ? 'team_b' : 'team_a';
    } else if (r2.activeTurnTeam !== 'team_a' && r2.activeTurnTeam !== 'team_b') {
      r2.activeTurnTeam = 'team_a';
    }

    const giverSwap = toggleTurn
      ? TurnManager.swapClueGivers(room.players, previousGiverA, previousGiverB, cardIndex)
      : {
          activeClueGiverA: teamAPlayers[cardIndex % Math.max(1, teamAPlayers.length)]?.id || null,
          activeClueGiverB: teamBPlayers[cardIndex % Math.max(1, teamBPlayers.length)]?.id || null,
          currentGiverIndex: cardIndex
        };
    const nextGiverId = r2.activeTurnTeam === 'team_a' ? giverSwap.activeClueGiverA : giverSwap.activeClueGiverB;
    const otherGiverId = r2.activeTurnTeam === 'team_a' ? giverSwap.activeClueGiverB : giverSwap.activeClueGiverA;
    if (r2.activeTurnTeam === 'team_a') {
      r2.activeClueGiverA = nextGiverId;
      r2.activeClueGiverB = otherGiverId;
    } else {
      r2.activeClueGiverB = nextGiverId;
      r2.activeClueGiverA = otherGiverId;
    }
    r2.currentGiverIndex = giverSwap.currentGiverIndex;

    assignReferee(room, 'round2', { reason });
  }

  function dispatchR2Card(room) {
    const dispatchedWord = triviaEngine.getQuestionBySlot({
      roomId: room.code,
      mode: 'edini_fi_seri',
      slotType: 'random'
    });

    if (dispatchedWord) {
      room.round2.currentWord = {
        target: dispatchedWord.question_text,
        forbidden: dispatchedWord.forbidden_words || [],
        category: dispatchedWord.category,
        clueIdea: 'خمن الكلمة بدون نطق الممنوعات الأربعة!'
      };
      room.round2.actionToken = crypto.randomUUID();
      room.round2.timeFreezeUsed = false;
      room.round2.timer = 45;
      room.round2.endTime = Date.now() + 45000;
      room.round2.isTimerRunning = true;
      return true;
    }

    const fallbackWord = PASSWORD_WORDS[(room.round2.currentWordIndex || 0) % PASSWORD_WORDS.length];
    room.round2.currentWord = fallbackWord ? { ...fallbackWord } : null;
    room.round2.actionToken = fallbackWord ? crypto.randomUUID() : null;
    room.round2.timeFreezeUsed = false;
    room.round2.timer = 45;
    room.round2.endTime = Date.now() + 45000;
    room.round2.isTimerRunning = !!fallbackWord;
    return false;
  }

  function dispatchR3PenaltyQuestion(room) {
    const category = room.round3.currentCategory;
    if (!category?.id) return false;

    const dispatchedPenalty = triviaEngine.getQuestionForCategory({
      roomId: room.code,
      mode: 'hat_fi_qoraybi',
      category: category.id
    });

    if (!dispatchedPenalty) {
      room.round3.currentQuestion = null;
      return false;
    }

    const options = Array.isArray(dispatchedPenalty.options)
      ? dispatchedPenalty.options.filter(option => typeof option === 'string' && option.trim())
      : [];
    const answer = typeof dispatchedPenalty.correct_answer === 'string'
      ? dispatchedPenalty.correct_answer
      : '';

    if (!answer || options.length < 2 || !options.includes(answer)) {
      room.round3.currentQuestion = null;
      return false;
    }

    room.round3.currentQuestion = {
      question: dispatchedPenalty.question_text,
      answer,
      options,
      category: dispatchedPenalty.category,
      kickerHint: category.name
    };
    return true;
  }

  function dispatchR4Topic(room) {
    const dispatchedAuction = triviaEngine.getQuestionBySlot({
      roomId: room.code,
      mode: 'meen_yezawwed',
      slotType: 'random'
    });

    if (dispatchedAuction) {
      room.round4.currentTopic = {
        topic: dispatchedAuction.question_text,
        validItems: dispatchedAuction.acceptable_answers || [],
        category: dispatchedAuction.category,
        minBid: 3,
        hint: 'أعلى مزايدة تكسب التحدي!'
      };
      room.round4.topicId = crypto.randomUUID();
      return true;
    }

    const fallbackTopic = AUCTION_TOPICS[(room.round4.currentTopicIndex || 0) % AUCTION_TOPICS.length];
    room.round4.currentTopic = fallbackTopic ? { ...fallbackTopic } : null;
    room.round4.topicId = fallbackTopic ? crypto.randomUUID() : null;
    return false;
  }

  // Host triggers synchronized 3-second match start countdown
  socket.on('start_match_countdown', ({ roomCode }) => {
    const room = findRoom(roomCode);
    if (!room) {
      socket.emit('error_message', 'الغرفة غير موجودة!');
      return;
    }

    const isHost = socket.id === room.hostId || room.players.some(p => p.id === socket.id && p.isHost);
    if (!isHost) {
      socket.emit('error_message', 'فقط كابتن الغرفة (الهوست 👑) يملك صلاحية بدء الماتش!');
      return;
    }

    if (!LOBBY_STATUSES.includes(room.status)) {
      socket.emit('error_message', '🚫 الماتش بدأ بالفعل، مينفعش تشغّل عد تنازلي جديد.');
      return;
    }

    if (room.countdownInterval) return;

    const readiness = getStartReadiness(room);
    if (!readiness.ok) {
      socket.emit('error_message', readiness.message);
      return;
    }

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

        const finalReadiness = getStartReadiness(room);
        if (!LOBBY_STATUSES.includes(room.status) || !finalReadiness.ok) {
          room.countdown = null;
          io.to(room.code).emit('countdown_cancelled', {
            reason: LOBBY_STATUSES.includes(room.status)
              ? finalReadiness.message
              : 'تم إلغاء العد التنازلي لأن الماتش بدأ بالفعل.'
          });
          return;
        }

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

    if (!TARGET_ROUNDS.includes(targetRound)) {
      socket.emit('error_message', '🚫 جولة غير معروفة. الاختيارات المتاحة: lobby, round1, round2, round3, round4, game_over.');
      return;
    }

    if (room.status === targetRound && targetRound !== 'lobby') {
      socket.emit('error_message', '🚫 الماتش في هذه الجولة بالفعل.');
      return;
    }

    // The lobby cannot jump straight into a round unless the full start
    // conditions are met: exactly 4 players, a strict 2v2 split, all connected.
    if (LOBBY_STATUSES.includes(room.status) && MATCH_STATUSES.includes(targetRound)) {
      const readiness = getStartReadiness(room);
      if (!readiness.ok) {
        socket.emit('error_message', `🚫 مينفعش تبدأ الجولة من غير شروط الانطلاق: ${readiness.message}`);
        return;
      }
    }

    stopCountdown(room, 'تم إلغاء العد التنازلي بسبب انتقال الجولة.');
    room.status = targetRound;

    if (targetRound === 'round1') {
      setupRound1(room);
    } else if (targetRound === 'round2') {
      // Setup Round 2: اديني في سري Password Mode
      room.round2.currentWordIndex = 0;
      room.round2.activeTurnTeam = 'team_a';
      room.round2.fouls = { team_a: 0, team_b: 0 };
      room.round2.isTimerRunning = false;
      room.round2.isComplete = false;
      room.round2.timeFreezeUsed = false;
      room.round2.actionToken = null;
      room.round2.timer = 45;
      setR2CardRoles(room, { reason: 'round_start' });
      dispatchR2Card(room);

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
      room.round3.isComplete = false;

      // Random category generated first -> Teams select their duelists -> 1v1 speed shootout
      const randomCategory = PENALTY_CATEGORIES[Math.floor(Math.random() * PENALTY_CATEGORIES.length)];
      room.round3.currentCategory = randomCategory;
      room.round3.phase = 'duelist_selection';

      // Neutral referee (not the kicker or the goalie) confirms only ties/disputes.
      assignReferee(room, 'round3', { reason: 'round_start' });
      room.round3.currentQuestion = null;
      room.round3.interceptBuzzedBy = null;

    } else if (targetRound === 'round4') {
      // Setup Round 4: مين يزوّد؟ Blind Auction
      room.round4.currentTopicIndex = 0;
      dispatchR4Topic(room);
      room.round4.highestBid = room.round4.currentTopic?.minBid || 3;
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
      r1.currentQuestion = null;
      r1.actionToken = null;
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
  socket.on('r1_action_score', ({ roomCode, actionToken }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round1', socket, 'احتساب نقاط الجولة الأولى')) return;
    // Zero Self-Grading Anti-Cheat: only the assigned opposing referee may grade.
    if (!requireReferee(room, 'round1', socket, 'احتساب نقطة')) return;
    const caller = room.players.find(p => p.id === socket.id);
    if (caller && caller.team === room.round1.activeTeam) {
      socket.emit('error_message', '🚫 ممنوع احتساب النقاط لنفسك! الحكم الخصم هو المسؤول الوحيد عن التقييم.');
      return;
    }

    const r1 = room.round1;
    if (!r1.currentQuestion || !isValidActionToken(r1.actionToken, actionToken)) {
      socket.emit('error_message', '🚫 انتهت صلاحية هذا السؤال أو تم احتسابه بالفعل. انتظر السؤال الجديد.');
      return;
    }
    r1.actionToken = null;

    const nextStreak = Math.min(r1.streak + 1, 10);
    r1.streak = nextStreak;
    r1.pendingPoints = r1.streakLadder[nextStreak];

    // Advance Round 1 quota tracking (48 total, 4x12 segments, [6, 6] splits)
    advanceR1Question(room, roomCode);
    dispatchR1Question(room);

    io.to(roomCode).emit('sound_trigger', { sound: 'correct', streak: nextStreak });
    emitRoomState(room);
  });

  // Break streak / Wrong answer
  socket.on('r1_action_break', ({ roomCode, actionToken }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round1', socket, 'كسر الستريك')) return;
    // Zero Self-Grading Anti-Cheat: only the assigned opposing referee may break.
    if (!requireReferee(room, 'round1', socket, 'كسر الستريك')) return;
    const caller = room.players.find(p => p.id === socket.id);
    if (caller && caller.team === room.round1.activeTeam) {
      socket.emit('error_message', '🚫 ممنوع تقييم الإجابة من الفريق المجيب! الحكم الخصم هو المسؤول الوحيد.');
      return;
    }

    const r1 = room.round1;
    if (!r1.currentQuestion || !isValidActionToken(r1.actionToken, actionToken)) {
      socket.emit('error_message', '🚫 انتهت صلاحية هذا السؤال أو تم حسمه بالفعل. انتظر السؤال الجديد.');
      return;
    }
    r1.actionToken = null;
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
    dispatchR1Question(room);

    emitRoomState(room);
  });

  // BANK points
  socket.on('r1_action_bank', ({ roomCode }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room, player: caller } = context;

    if (!requireRoundStatus(room, 'round1', socket, 'حفظ النقاط')) return;

    // Only active answering team can bank their points. The referee is from
    // the opposing team and must never be able to bank on their behalf.
    if (caller.team !== room.round1.activeTeam) {
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
  socket.on('r1_pass_turn', ({ roomCode, actionToken }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round1', socket, 'تبديل الدور')) return;
    if (socket.id !== room.hostId) {
      socket.emit('error_message', '🚫 تبديل الدور يتم من جهاز كابتن الغرفة فقط.');
      return;
    }

    const r1 = room.round1;
    if (!r1.currentQuestion || !isValidActionToken(r1.actionToken, actionToken)) {
      socket.emit('error_message', '🚫 لا يوجد سؤال نشط لتبديل الدور عليه.');
      return;
    }
    r1.actionToken = null;
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
    dispatchR1Question(room);

    io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    emitRoomState(room);
  });

  // =================== ROUND 2 ACTIONS (Password Mode) ===================
  socket.on('r2_award_point', ({ roomCode, team, actionToken }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room, player: caller } = context;

    if (!requireRoundStatus(room, 'round2', socket, 'احتساب نقاط كلمة السر')) return;
    if (team !== 'team_a' && team !== 'team_b') return;
    if (team === caller.team) {
      socket.emit('error_message', '🚫 ممنوع تحتسب نقطة أو مخالفة لفريقك. الحكم هنا هو مرشد الفريق المنافس فقط.');
      return;
    }
    // Only the opposing clue-giver (current referee) may award the card.
    if (!requireReferee(room, 'round2', socket, 'احتساب نقطة كلمة السر')) return;

    const r2 = room.round2;
    if (team !== getR2ActiveTurnTeam(room)) {
      socket.emit('error_message', '🚫 الحكم يحسم دور الفريق اللي بيلمّح دلوقتي فقط.');
      return;
    }
    if (r2.isComplete || r2.currentWordIndex >= 5) {
      socket.emit('error_message', '🚫 اكتملت بطاقات الجولة الخمسة بالفعل.');
      return;
    }
    if (!isValidActionToken(r2.actionToken, actionToken)) {
      socket.emit('error_message', '🚫 انتهت صلاحية هذه البطاقة أو تم حسمها بالفعل.');
      return;
    }
    r2.actionToken = null;

    room.teams[team].score += 500;
    r2.currentWordIndex += 1;

    // Check if 5 cards quota reached
    if (r2.currentWordIndex >= 5) {
      r2.isComplete = true;
      r2.currentWord = null;
      r2.isTimerRunning = false;
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
      io.to(roomCode).emit('notification', {
        title: '🏁 اكتملت جولة "اديني في سري" (5 بطاقات)!',
        message: 'تم إنجاز الـ 5 بطاقات السرية! جاهزون للانتقال لجولة ركلات الجزاء.'
      });
    } else {
      // Rotate the clue-giver pair for the next card and hand the judge seat
      // to the opposing clue-giver of the new active turn.
      setR2CardRoles(room, { toggleTurn: true, reason: 'card_complete' });
      dispatchR2Card(room);
    }

    io.to(roomCode).emit('sound_trigger', { sound: 'correct' });
    emitRoomState(room);
  });

  socket.on('r2_skip_card', ({ roomCode, actionToken }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round2', socket, 'تخطي بطاقة كلمة السر')) return;
    if (!requireReferee(room, 'round2', socket, 'تخطي كلمة سرية')) return;

    const r2 = room.round2;
    if (r2.isComplete || r2.currentWordIndex >= 5) {
      socket.emit('error_message', '🚫 اكتملت بطاقات الجولة الخمسة بالفعل.');
      return;
    }
    if (!isValidActionToken(r2.actionToken, actionToken)) {
      socket.emit('error_message', '🚫 انتهت صلاحية هذه البطاقة أو تم حسمها بالفعل.');
      return;
    }
    r2.actionToken = null;
    r2.currentWordIndex += 1;

    if (r2.currentWordIndex >= 5) {
      r2.isComplete = true;
      r2.currentWord = null;
      r2.isTimerRunning = false;
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
      io.to(roomCode).emit('notification', {
        title: '🏁 اكتملت جولة "اديني في سري" (5 بطاقات)!',
        message: 'تم إنجاز الـ 5 بطاقات السرية! جاهزون للانتقال لجولة ركلات الجزاء.'
      });
    } else {
      setR2CardRoles(room, { toggleTurn: true, reason: 'card_skipped' });
      dispatchR2Card(room);
    }

    io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    emitRoomState(room);
  });

  socket.on('r2_foul', ({ roomCode, team, actionToken }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room, player: caller } = context;

    if (!requireRoundStatus(room, 'round2', socket, 'احتساب مخالفة كلمة السر')) return;
    if (team !== 'team_a' && team !== 'team_b') return;
    if (team === caller.team) {
      socket.emit('error_message', '🚫 ممنوع تحتسب نقطة أو مخالفة لفريقك. الحكم هنا هو مرشد الفريق المنافس فقط.');
      return;
    }
    if (!requireReferee(room, 'round2', socket, 'احتساب مخالفة')) return;

    const r2 = room.round2;
    if (r2.isComplete || r2.currentWordIndex >= 5) {
      socket.emit('error_message', '🚫 اكتملت بطاقات الجولة الخمسة بالفعل.');
      return;
    }
    if (team !== getR2ActiveTurnTeam(room)) {
      socket.emit('error_message', '🚫 الحكم يحسم دور الفريق اللي بيلمّح دلوقتي فقط.');
      return;
    }
    if (!isValidActionToken(r2.actionToken, actionToken)) {
      socket.emit('error_message', '🚫 انتهت صلاحية هذه البطاقة أو تم حسمها بالفعل.');
      return;
    }

    r2.fouls[team] = (r2.fouls[team] || 0) + 1;
    // Deduct 200 points on foul
    room.teams[team].score = Math.max(0, room.teams[team].score - 200);

    // A foul ends this clue turn. The other clue-giver becomes the judge.
    r2.activeTurnTeam = getR2ActiveTurnTeam(room) === 'team_a' ? 'team_b' : 'team_a';
    r2.actionToken = crypto.randomUUID();
    assignReferee(room, 'round2', { reason: 'clue_turn_change' });

    io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
    emitRoomState(room);
  });

  socket.on('r2_time_freeze', ({ roomCode }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round2', socket, 'تجميد الوقت')) return;
    if (!requireReferee(room, 'round2', socket, 'تجميد الوقت')) return;

    const r2 = room.round2;
    if (r2.isComplete || r2.currentWordIndex >= 5 || !r2.currentWord) {
      socket.emit('error_message', '🚫 لا توجد بطاقة نشطة لتجميد وقتها.');
      return;
    }
    if (r2.timeFreezeUsed) {
      socket.emit('error_message', '🚫 تم استخدام تجميد الوقت لهذه البطاقة بالفعل.');
      return;
    }
    r2.timeFreezeUsed = true;

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
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round3', socket, 'اختيار المبارزين')) return;

    const r3 = room.round3;
    if (r3.isComplete || r3.turnIndex >= 10) {
      socket.emit('error_message', '🚫 انتهت ركلات الجزاء بالفعل.');
      return;
    }
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

    r3.currentQuestion = null;
    r3.interceptBuzzedBy = null;
    r3.interceptAt = null;
    r3.tieBreakActive = false;
    r3.tieBreakData = null;

    emitRoomState(room);
  });

  // Start Shootout
  socket.on('r3_start_shootout', ({ roomCode }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round3', socket, 'بدء ركلة الجزاء')) return;

    const r3 = room.round3;
    if (r3.isComplete || r3.turnIndex >= 10) {
      socket.emit('error_message', '🚫 انتهت ركلات الجزاء بالفعل.');
      return;
    }
    if (socket.id !== room.hostId && !isReferee(room, 'round3', socket.id)) {
      socket.emit('error_message', '🚫 بدء الركلة يتم من جهاز الهوست أو الحكم المحايد فقط.');
      return;
    }

    if (r3.phase !== 'duelist_selection') {
      socket.emit('error_message', '🚫 الركلة بدأت بالفعل.');
      return;
    }

    if (!r3.currentKickerId || !r3.currentGoalieId) {
      socket.emit('error_message', '🚫 يجب اختيار المسدد والحارس أولاً.');
      return;
    }

    if (!dispatchR3PenaltyQuestion(room)) {
      socket.emit('error_message', '🚫 لا يوجد سؤال متاح لهذه الركلة.');
      return;
    }

    r3.phase = 'shootout';
    r3.interceptBuzzedBy = null;
    r3.interceptAt = null;
    r3.interceptCompensatedAt = null;
    r3.goalieCompensation = 0;
    r3.shotStartedAt = Date.now();
    r3.endTime = r3.shotStartedAt + (r3.timer || 20) * 1000;
    r3.shotResolved = false;
    r3.tieBreakActive = false;
    r3.tieBreakData = null;
    io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    emitRoomState(room);
  });

  // Server timestamp #1: goalkeeper's save buzz.
  socket.on('r3_intercept_buzz', ({ roomCode }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round3', socket, 'بزر الصد')) return;

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
    r3.goalieCompensation = getPlayerCompensation(socket.id);
    r3.interceptCompensatedAt = r3.interceptAt - r3.goalieCompensation;
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
    if (r3.shotResolved || r3.isComplete || r3.phase !== 'shootout') return false;
    r3.shotResolved = true;
    r3.isTimerRunning = false;
    r3.endTime = null;

    const kickingTeam = r3.kickerTeam;
    const defendingTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';

    const kicker = room.players.find(p => p.id === r3.currentKickerId);
    const goalie = room.players.find(p => p.id === r3.currentGoalieId);
    const categoryId = r3.currentCategory?.id || r3.currentQuestion?.category;

    let bonusAwarded = false;
    let bonusPoints = 0;

    if (result === 'goal') {
      room.teams[kickingTeam].score += 1000;
      room.teams[kickingTeam].penaltyScore = (room.teams[kickingTeam].penaltyScore || 0) + 1;
      const kickerAttrs = kicker?.attributes || kicker?.character?.attributes;
      const b = calculateBonus(kickerAttrs, categoryId, true);
      if (b.bonusAwarded) {
        bonusAwarded = true;
        bonusPoints = b.bonusPoints;
        room.teams[kickingTeam].score += b.bonusPoints * 500;
        room.teams[kickingTeam].bonusPoints = (room.teams[kickingTeam].bonusPoints || 0) + b.bonusPoints;
      }
      io.to(roomCode).emit('sound_trigger', { sound: 'goal_roar' });
      io.to(roomCode).emit('confetti_trigger');
    } else if (result === 'saved') {
      room.teams[defendingTeam].score += 800;
      room.teams[defendingTeam].penaltyScore = (room.teams[defendingTeam].penaltyScore || 0) + 1;
      const goalieAttrs = goalie?.attributes || goalie?.character?.attributes;
      const b = calculateBonus(goalieAttrs, categoryId, true);
      if (b.bonusAwarded) {
        bonusAwarded = true;
        bonusPoints = b.bonusPoints;
        room.teams[defendingTeam].score += b.bonusPoints * 500;
        room.teams[defendingTeam].bonusPoints = (room.teams[defendingTeam].bonusPoints || 0) + b.bonusPoints;
      }
      io.to(roomCode).emit('sound_trigger', { sound: 'save' });
    } else {
      io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
    }

    r3.shotsHistory.push({
      shotIndex: r3.turnIndex,
      round: Math.floor(r3.turnIndex / 2) + 1,
      team: kickingTeam,
      result,
      intercepted: !!r3.interceptBuzzedBy,
      tieBreak: !!meta.tieBreak,
      answerMs: meta.answerMs ?? null,
      interceptMs: meta.interceptMs ?? null,
      bonusAwarded,
      bonusPoints,
      isSuddenDeath: !!r3.isSuddenDeath,
      suddenDeathRound: r3.suddenDeathRound || 0
    });

    // Advance turn and reset the shooting clock / buzzer for the next kick.
    r3.turnIndex += 1;
    r3.kickerTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';
    r3.interceptBuzzedBy = null;
    r3.interceptAt = null;
    r3.interceptCompensatedAt = null;
    r3.goalieCompensation = 0;
    r3.shotStartedAt = null;
    r3.tieBreakActive = false;
    r3.tieBreakData = null;

    // Regulation (10 kicks) or Sudden Death round evaluation:
    if (r3.turnIndex >= 10) {
      const scoreA = room.teams.team_a.penaltyScore || 0;
      const scoreB = room.teams.team_b.penaltyScore || 0;

      if (!r3.isSuddenDeath) {
        if (scoreA === scoreB) {
          r3.isSuddenDeath = true;
          r3.suddenDeathRound = 1;
          r3.isComplete = false;
          io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
          io.to(roomCode).emit('notification', {
            title: '⚡ شوط الموت المفاجئ (Sudden Death)!',
            message: 'تعادل في الركلات الترجيحية (5-5)! ركلة بركلة حتى الحسم.'
          });
        } else {
          r3.isComplete = true;
        }
      } else {
        // Evaluated at the end of complete 2-kick sudden death rounds (A then B)
        if (r3.turnIndex % 2 === 0) {
          const lastTwo = r3.shotsHistory.slice(-2);
          const shotA = lastTwo.find(s => s.team === 'team_a');
          const shotB = lastTwo.find(s => s.team === 'team_b');
          const roundPtsA = (shotA?.result === 'goal' ? 1 : 0) + (shotB?.result === 'saved' ? 1 : 0);
          const roundPtsB = (shotB?.result === 'goal' ? 1 : 0) + (shotA?.result === 'saved' ? 1 : 0);

          if (roundPtsA !== roundPtsB) {
            r3.isComplete = true;
            const winner = roundPtsA > roundPtsB ? 'فريق الحيتان' : 'فريق الوحوش';
            io.to(roomCode).emit('notification', {
              title: '🏆 حُسمت في الموت المفاجئ!',
              message: `فاز ${winner} بركلات الترجيح!`
            });
          } else {
            r3.suddenDeathRound = (r3.suddenDeathRound || 1) + 1;
            r3.isComplete = false;
            io.to(roomCode).emit('notification', {
              title: '⚡ استمرار الموت المفاجئ!',
              message: `تعادل في شوط الموت المفاجئ ${r3.suddenDeathRound - 1}! جولة جديدة.`
            });
          }
        }
      }

      if (r3.isComplete) {
        r3.phase = 'complete';
        r3.currentQuestion = null;
        r3.currentKickerId = null;
        r3.currentGoalieId = null;
        io.to(roomCode).emit('sound_trigger', { sound: 'whistle' });
        io.to(roomCode).emit('notification', {
          title: '🏁 انتهت ركلات الجزاء الترجيحية!',
          message: 'تم حسم ركلات الجزاء! الانتقال لجولة المزاد مين يزوّد.'
        });
        emitRoomState(room);
        return true;
      }
    }

    // Guarantee >= 50% General questions
    const isGeneralTurn = r3.turnIndex % 2 === 0;
    const generalCategories = PENALTY_CATEGORIES.filter(c => isGeneralCategory(c.id));
    const specialtyCategories = PENALTY_CATEGORIES.filter(c => !isGeneralCategory(c.id));
    const nextCategory = isGeneralTurn
      ? (generalCategories[Math.floor(Math.random() * generalCategories.length)] || PENALTY_CATEGORIES[0])
      : (specialtyCategories[Math.floor(Math.random() * specialtyCategories.length)] || PENALTY_CATEGORIES[0]);

    r3.currentCategory = nextCategory;
    r3.phase = 'duelist_selection';

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
    r3.currentQuestion = null;

    emitRoomState(room);
    return true;
  }

  // Server timestamp #2: shooter's answer. The server — not the phone —
  // decides whether the answer or the goalkeeper buzz happened first.
  socket.on('r3_submit_answer', ({ roomCode, option }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round3', socket, 'تسجيل إجابة ركلة الجزاء')) return;

    const r3 = room.round3;
    if (r3.isComplete || r3.phase !== 'shootout' || !r3.shotStartedAt) {
      socket.emit('error_message', '🚫 لا توجد ركلة نشطة الآن.');
      return;
    }
    if (socket.id !== r3.currentKickerId) {
      socket.emit('error_message', '🚫 المسدد الحالي فقط هو من يجيب على سؤال الركلة.');
      return;
    }
    if (r3.tieBreakActive) return;

    const options = r3.currentQuestion?.options || [];
    if (typeof option !== 'string' || !options.includes(option)) {
      socket.emit('error_message', '🚫 اختر أحد الخيارات المعروضة في سؤال الركلة.');
      return;
    }

    const answerAt = Date.now();
    const kickerCompensation = getPlayerCompensation(socket.id);
    const goalieCompensation = r3.goalieCompensation ?? getPlayerCompensation(r3.currentGoalieId);

    const norm = (value) => String(value || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
    const submitted = norm(option);
    const expected = norm(r3.currentQuestion.answer);
    const isCorrect = !!submitted && !!expected && submitted === expected;

    const {
      provisional,
      nearlySimultaneous,
      answerCompensatedAt,
      interceptCompensatedAt
    } = resolveShootoutTimings({
      answerAt,
      interceptAt: r3.interceptAt,
      kickerCompensation,
      goalieCompensation,
      isCorrect,
      tieWindowMs: R3_TIE_WINDOW_MS
    });

    const answerMs = answerAt - r3.shotStartedAt;
    const interceptMs = r3.interceptAt ? r3.interceptAt - r3.shotStartedAt : null;

    if (nearlySimultaneous) {
      r3.tieBreakActive = true;
      r3.tieBreakData = {
        provisionalResult: provisional,
        answerMs,
        interceptMs,
        answerCompensatedAt,
        interceptCompensatedAt,
        kickerCompensation,
        goalieCompensation,
        isCorrect,
        kickerId: r3.currentKickerId,
        goalieId: r3.currentGoalieId
      };
      io.to(roomCode).emit('notification', {
        title: '⏱️ تعادل لحظي في أجزاء الثانية!',
        message: 'الضغطتان متزامنتان بعد تعويض سرعة الاتصال. الحكم المحايد سيفصل النتيجة نهائياً من جهازه.'
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
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round3', socket, 'فض تعادل الركلة')) return;
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
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round3', socket, 'اعتماد نتيجة الركلة')) return;
    if (!requireReferee(room, 'round3', socket, 'اعتماد نتيجة الركلة')) return;
    if (!room.round3.tieBreakActive) {
      socket.emit('error_message', '🚫 النتيجة تُحسب تلقائياً بتوقيت السيرفر. يدوي فقط عند التعادل اللحظي.');
      return;
    }
    if (!['goal', 'saved', 'missed'].includes(result)) return;
    settlePenaltyShot(room, roomCode, result, { tieBreak: true });
  });

  // =================== ROUND 4 ACTIONS (Blind Auction) ===================
  socket.on('r4_bid', ({ roomCode, increment, expectedBid, topicId }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room, player } = context;

    if (!requireRoundStatus(room, 'round4', socket, 'المزايدة')) return;

    const r4 = room.round4;
    if (!r4.currentTopic || !r4.topicId) {
      socket.emit('error_message', '🚫 لا يوجد موضوع مزاد نشط الآن.');
      return;
    }
    if (r4.phase !== 'bidding') {
      socket.emit('error_message', '🚫 انتهت مرحلة المزايدة على هذا الموضوع.');
      return;
    }
    if (typeof topicId !== 'string' || topicId !== r4.topicId) {
      socket.emit('error_message', '🚫 انتهت صلاحية موضوع المزاد. انتظر الموضوع الجديد.');
      return;
    }
    if (![1, 2, 5].includes(increment)) {
      socket.emit('error_message', '🚫 قيمة المزايدة غير صحيحة.');
      return;
    }
    if (!Number.isInteger(expectedBid) || expectedBid !== r4.highestBid) {
      socket.emit('error_message', '🚫 تغيّرت أعلى مزايدة. راجع الرقم الحالي قبل المزايدة.');
      return;
    }
    if (r4.highestBidderTeam === player.team) {
      socket.emit('error_message', '🚫 فريقك صاحب أعلى مزايدة بالفعل.');
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

  socket.on('r4_start_challenge', ({ roomCode, topicId }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room, player } = context;
    const r4 = room.round4;
    if (r4.phase !== 'execution' || r4.highestBidderTeam !== player.team || r4.topicId !== topicId || r4.isTimerRunning) return;
    r4.timer = 60;
    r4.endTime = Date.now() + 60000;
    r4.isTimerRunning = true;
    emitRoomState(room);
  });

  // R4 Lifelines: 'call_friend' | 'rival_hint'
  socket.on('r4_use_lifeline', ({ roomCode, team, lifelineType, topicId }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room, player: caller } = context;

    if (!requireRoundStatus(room, 'round4', socket, 'وسيلة المساعدة')) return;

    const r4 = room.round4;
    if (!r4.currentTopic || !r4.topicId) {
      socket.emit('error_message', '🚫 لا يوجد موضوع مزاد نشط الآن.');
      return;
    }
    if (r4.phase !== 'bidding' && r4.phase !== 'execution') {
      socket.emit('error_message', '🚫 انتهت مرحلة استخدام وسائل المساعدة لهذا الموضوع.');
      return;
    }
    if (typeof topicId !== 'string' || topicId !== r4.topicId) {
      socket.emit('error_message', '🚫 انتهت صلاحية موضوع المزاد. انتظر الموضوع الجديد.');
      return;
    }
    if (!['call_friend', 'rival_hint', 'opponent_help'].includes(lifelineType)) {
      socket.emit('error_message', '🚫 وسيلة مساعدة غير معروفة.');
      return;
    }
    if (team && team !== caller.team) {
      socket.emit('error_message', '🚫 لا يمكنك استخدام وسائل مساعدة لفريق الخصم.');
      return;
    }
    team = caller.team;

    if (r4.highestBidderTeam !== team) {
      socket.emit('error_message', '🚫 وسائل المساعدة متاحة لصاحب أعلى مزاد فقط.');
      return;
    }

    if (!r4.usedLifelines) r4.usedLifelines = { team_a: [], team_b: [] };
    if (!r4.usedLifelines[team]) r4.usedLifelines[team] = [];

    if (r4.usedLifelines[team].includes(lifelineType)) {
      socket.emit('error_message', 'هذه الوسيلة تم استخدامها من قبل لفريقك!');
      return;
    }

    const validItems = r4.currentTopic?.validItems || [];
    if (lifelineType === 'rival_hint' && !validItems.length) {
      socket.emit('error_message', '🚫 لا توجد إجابات معتمدة متاحة لهذا التلميح.');
      return;
    }
    if (lifelineType === 'opponent_help' && !validItems.some(item => !r4.itemsNamed.includes(item))) {
      socket.emit('error_message', '🚫 لا توجد إجابات متبقية يمكن للخصم المساعدة بها.');
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
      const unrevealed = validItems.filter(item => !r4.itemsNamed.includes(item));
      const hintItem = unrevealed.length > 0 ? unrevealed[0] : (validItems[0] || 'إجابة مفتاحية');
      io.to(roomCode).emit('sound_trigger', { sound: 'bid' });
      io.to(roomCode).emit('notification', {
        title: '💡 هينت من الخصم!',
        message: `تلميح الخصم يكشف إجابة مؤكدة: "${hintItem}"`
      });
    } else if (lifelineType === 'opponent_help') {
      if (!r4.itemsNamed) r4.itemsNamed = [];
      const assistedItem = validItems.find(item => !r4.itemsNamed.includes(item));
      r4.itemsNamed.push(assistedItem);
      io.to(roomCode).emit('sound_trigger', { sound: 'correct' });
      io.to(roomCode).emit('notification', {
        title: '🤝 استعين بالخصم!',
        message: `الخصم ساعد بإجابة معتمدة: "${assistedItem}"`
      });
    }

    emitRoomState(room);
  });

  // Toggle item named in auction checklist. Only the designated opposing
  // referee may tick items; the answering team can never self-verify.
  socket.on('r4_toggle_item', ({ roomCode, item, topicId }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round4', socket, 'تدقيق إجابات المزاد')) return;
    if (!requireReferee(room, 'round4', socket, 'تدقيق إجابات المزاد')) return;

    const r4 = room.round4;
    if (!r4.currentTopic || !r4.topicId || topicId !== r4.topicId) {
      socket.emit('error_message', '🚫 انتهت صلاحية موضوع المزاد. انتظر الموضوع الجديد.');
      return;
    }
    if (r4.phase === 'resolved') {
      socket.emit('error_message', '🚫 تم اعتماد نتيجة هذا المزاد بالفعل.');
      return;
    }
    const validItems = r4.currentTopic.validItems || [];
    if (typeof item !== 'string' || !validItems.includes(item)) {
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

  socket.on('r4_resolve_bid', ({ roomCode, success, topicId }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room } = context;

    if (!requireRoundStatus(room, 'round4', socket, 'اعتماد نتيجة المزاد')) return;
    if (!requireReferee(room, 'round4', socket, 'اعتماد نقاط المزاد')) return;

    const r4 = room.round4;
    if (!r4.currentTopic || !r4.topicId || topicId !== r4.topicId) {
      socket.emit('error_message', '🚫 انتهت صلاحية موضوع المزاد. انتظر الموضوع الجديد.');
      return;
    }
    if (r4.phase === 'resolved') {
      socket.emit('error_message', '🚫 تم اعتماد نتيجة هذا المزاد بالفعل.');
      return;
    }
    if (typeof success !== 'boolean') {
      socket.emit('error_message', '🚫 نتيجة المزاد غير صحيحة.');
      return;
    }

    const winningTeam = r4.highestBidderTeam;
    if (!winningTeam) {
      socket.emit('error_message', '🚫 لا يوجد صاحب مزاد معتمد بعد.');
      return;
    }

    if (success && (r4.itemsNamed?.length || 0) < r4.highestBid) {
      socket.emit('error_message', `🚫 لم يصل الفريق للرقم المطلوب (${r4.itemsNamed?.length || 0}/${r4.highestBid}). لا يمكن اعتماد النقاط.`);
      return;
    }

    r4.phase = 'resolved';
    r4.isTimerRunning = false;
    r4.endTime = null;

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
      io.to(roomCode).emit('sound_trigger', { sound: 'buzzer' });
      io.to(roomCode).emit('notification', {
        title: 'المزاد لم يكتمل',
        message: `${room.teams[winningTeam].name} لم يوفِ بالمزاد. لا توجد نقاط مخصومة.`
      });
    }

    r4.currentTopicIndex = (r4.currentTopicIndex || 0) + 1;

    if (r4.currentTopicIndex >= 4) {
      r4.currentTopic = null;
      r4.topicId = null;
      io.to(roomCode).emit('sound_trigger', { sound: 'fanfare' });
      io.to(roomCode).emit('confetti_trigger');
      io.to(roomCode).emit('notification', {
        title: '🏁 اكتملت جولة المزاد (4 موضوعات)!',
        message: 'تم إنجاز كافة جولات ساحة الكويز! حان وقت تتويج بطل الساحة 👑'
      });
    } else {
      dispatchR4Topic(room);
      r4.highestBid = r4.currentTopic?.minBid || 3;
      r4.timer = 60;
      r4.itemsNamed = [];
      r4.phase = 'bidding';
      r4.usedLifelines = { team_a: [], team_b: [] };
      r4.highestBidderTeam = null;
      r4.highestBidderPlayerId = null;
      r4.isTimerRunning = false;
      r4.endTime = null;
      assignReferee(room, 'round4', { reason: 'next_topic' });
    }

    emitRoomState(room);
  });

  // Chat message & Taunts
  socket.on('send_chat', ({ roomCode, text, isTaunt }) => {
    const context = getRoomAndPlayer(roomCode, socket);
    if (!context) return;
    const { room, player } = context;

    if (typeof text !== 'string') return;
    const cleanText = Array.from(text)
      .map(char => {
        const code = char.charCodeAt(0);
        return code < 32 || code === 127 ? ' ' : char;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CHAT_LENGTH);
    if (!cleanText) return;

    const now = Date.now();
    if (now - (LAST_CHAT_AT.get(socket.id) || 0) < CHAT_RATE_LIMIT_MS) return;
    LAST_CHAT_AT.set(socket.id, now);

    const msg = {
      id: crypto.randomUUID(),
      senderName: player.name,
      characterAvatar: player.character?.avatar || '⚡',
      team: player.team,
      text: cleanText,
      isTaunt: isTaunt === true,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    room.messages.push(msg);
    if (room.messages.length > 50) room.messages.shift();

    io.to(room.code).emit('chat_received', msg);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    JOIN_ATTEMPTS.delete(socket.id);
    LAST_CHAT_AT.delete(socket.id);

    for (const [code, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) continue;

      const removedPlayer = room.players[playerIndex];
      console.log(`[Player Disconnected] ${removedPlayer.name} disconnected from room ${code}`);

      // If countdown was in progress, cancel it immediately, even though the
      // player still gets a reconnection grace period in the lobby.
      if (LOBBY_STATUSES.includes(room.status)) {
        stopCountdown(room, `انقطع اتصال ${removedPlayer.name} قبل انطلاق المباراة! تم إلغاء العد التنازلي.`);
      }

      if (LOBBY_STATUSES.includes(room.status)) {
        // Lobby disconnect: keep the seat reserved for a 20-second grace window.
        removedPlayer.connected = false;
        removedPlayer.lastSeen = Date.now();
        removedPlayer.disconnectAt = Date.now();

        const token = removedPlayer.playerToken;
        if (!room.disconnectTimers) room.disconnectTimers = new Map();
        const existingTimer = room.disconnectTimers.get(token);
        if (existingTimer) clearTimeout(existingTimer);

        const removalTimer = setTimeout(() => {
          const currentRoom = rooms.get(code);
          if (!currentRoom) return;

          currentRoom.disconnectTimers?.delete(token);

          const index = currentRoom.players.findIndex(p => p.playerToken === token && !p.isBot);
          if (index === -1) return;

          const player = currentRoom.players[index];
          if (player.connected) return;

          currentRoom.players.splice(index, 1);

          // Transfer host authority only after the grace period expires.
          if (player.isHost && currentRoom.players.length > 0) {
            const nextHost =
              currentRoom.players.find(p => !p.isBot && p.connected !== false) ||
              currentRoom.players.find(p => !p.isBot) ||
              currentRoom.players[0];

            currentRoom.players.forEach(p => { p.isHost = false; });
            nextHost.isHost = true;
            currentRoom.hostId = nextHost.id;

            io.to(currentRoom.code).emit('notification', {
              title: 'انتقال شارة القيادة 👑',
              message: `${nextHost.name} أصبح هو كابتن الغرفة الجديد!`
            });
          }

          if (currentRoom.players.length === 0) {
            rooms.delete(code);
            console.log(`[Room Deleted] Room ${code} was deleted because all players left.`);
          } else {
            emitRoomState(currentRoom);
            io.to(currentRoom.code).emit('notification', {
              title: 'تفريغ خانة ⚠️',
              message: `غادر ${player.name} الساحة بعد ${Math.round(DISCONNECT_GRACE_MS / 1000)} ثانية من غير رجوع. تم تفريغ الخانة!`
            });
          }
        }, DISCONNECT_GRACE_MS);

        removalTimer.unref?.();
        room.disconnectTimers.set(token, removalTimer);

        emitRoomState(room);
        io.to(room.code).emit('notification', {
          title: 'انقطاع اتصال مؤقت ⚠️',
          message: `فقدنا اتصال ${removedPlayer.name}. عنده ${Math.round(DISCONNECT_GRACE_MS / 1000)} ثانية يرجع قبل ما الخانة تتفضى.`
        });
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
  res.json({
    status: 'ok',
    server: 'Quiz Arena Backend',
    activeRooms: rooms.size,
    uptimeSeconds: Math.floor(process.uptime())
  });
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

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Quiz Arena Real-Time Game Server running on 0.0.0.0:${PORT}`);
  });
}

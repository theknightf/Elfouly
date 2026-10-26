/**
 * src/services/supabaseMultiplayerService.js
 *
 * Supabase Realtime & PostgreSQL Multiplayer Provider for Quiz Arena.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The project can run without a long-lived Node backend by using Supabase
 * Realtime (Broadcast + Presence) for the live channel and the PostgreSQL
 * `public.rooms` table as the shared room state.
 *
 * SECURITY MODEL (READ BEFORE CHANGING)
 * ------------------------------------
 * This provider is CLIENT-AUTHORITATIVE: every participant runs this same
 * file and the acting client persists the resulting state. That is the price
 * of a serverless deployment with no backend process. To keep the game as
 * fair as possible the provider mirrors the rules of the dedicated
 * Node/Socket.IO server (server/server.js):
 *
 *   - only the assigned referee may grade (R1), award/skip/foul (R2),
 *     verify items and resolve the auction (R4);
 *   - only the answering team may bank its own points (R1);
 *   - only the host may switch rounds;
 *   - only the current kicker may answer, and only the goalie may intercept;
 *   - every scored mutation must present the current action token, so a
 *     captured action cannot be replayed;
 *   - secret payloads (R1/R3 answers, the R2 password card, the R4 auction
 *     checklist) are NEVER broadcast and NEVER persisted in clear text.
 *     They are kept in the acting client's memory and delivered to the single
 *     authorised player over a dedicated judge channel.
 *
 * A determined player can still patch their own browser build, so for
 * competitive play prefer the dedicated server:
 *   VITE_MULTIPLAYER_PROVIDER=socketio
 * See README.md for the full comparison and for the RLS hardening notes.
 */

import { createSupabaseClient } from './supabaseClient';
import { CHARACTERS } from '../data/characters';
import { TOURNAMENT_STRUCTURE } from '../data/tournamentStructure';
import { PENALTY_CATEGORIES, AUCTION_TOPICS, PASSWORD_WORDS } from '../data/questions';
import {
  drawLocalQuestion,
  drawLocalR1Question,
  buildLocalR1TurnPlan,
  drawLocalCategoryQuestion
} from '../utils/localQuestionEngine';
import { calculateBonus, isGeneralCategory } from '../utils/penaltyRules.js';

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_PLAYERS = 4;
const TEAM_PLAYERS = 2;
const MAX_CHAT_LENGTH = 240;
const R1_TOTAL_QUESTIONS = 48;
const R1_SUB_BATCH_SIZE = 6;
const R1_SEGMENT_SIZE = 12;
const R1_STREAK_LADDER = [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12000, 20000, 35000];
const R2_TOTAL_CARDS = 5;
const R2_TIME_FREEZE_SECONDS = 10;
const R3_TOTAL_SHOTS = 10;
const R4_TOTAL_TOPICS = 4;
const R4_BID_INCREMENTS = [1, 2, 5];
const R4_LIFELINES = ['call_friend', 'rival_hint', 'opponent_help'];
const R4_CALL_FRIEND_SECONDS = 20;
const CHAT_RATE_LIMIT_MS = 400;

function generateRoomCode() {
  let body = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    body += ROOM_CODE_ALPHABET.charAt(idx);
  }
  return `QZ-${body}`;
}

function normalizeRoomCode(code) {
  if (!code) return '';
  const clean = String(code).toUpperCase().trim().replace(/\s+/g, '');
  const stripped = clean.replace(/-/g, '');
  const body = stripped.startsWith('QZ') ? stripped.slice(2) : stripped;
  return body.length === 6 ? `QZ-${body}` : clean;
}

function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
}

// Chat text is sanitised without a control-character regex (the ESLint
// no-control-regex rule rejects it), and it is length limited.
function sanitizeChatText(text) {
  if (typeof text !== 'string') return '';
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0);
    out += (code < 32 || code === 127) ? ' ' : char;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH);
}

function deepClone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

// Session tokens are never persisted in clear text: the database only keeps
// a 64-bit hash, so a leaked database row cannot be used to impersonate a
// player (the raw token lives in the browser session storage only).
function hashToken(token) {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x01000193 >>> 0;
  const str = String(token || '');
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function createToken() {
  return `tok_${Math.random().toString(36).substring(2, 12)}${Date.now().toString(36)}`;
}

// ------------------------------------------------------------------
// Question shape normalisation
//
// The bank stores raw questions (question_text / correct_answer /
// forbidden_words / acceptable_answers) while the UI expects the
// normalised contract used by the Node server
// (question / answer / target / forbidden / options / validItems).
// ------------------------------------------------------------------
function normalizeR1Question(raw, slotType = 'random') {
  if (!raw) return null;
  const question = raw.question_text || raw.question || '';
  if (!question) return null;
  return {
    question,
    answer: raw.correct_answer || raw.answer || '',
    categoryName: raw.category || '',
    slotType,
    funFact: slotType === 'specialty'
      ? 'سؤال من تخصص شخصيتك — ركّز في المعلومة المهمة.'
      : 'سؤال عام من البنك — كل إجابة صحيحة ترفع سُلّم الستريك.'
  };
}

function normalizeR2Word(raw, index = 0) {
  if (raw) {
    const forbidden = Array.isArray(raw.forbidden)
      ? raw.forbidden
      : Array.isArray(raw.forbidden_words) ? raw.forbidden_words : [];
    const target = raw.target || raw.word || raw.question_text || raw.correct_answer || '';
    if (target) {
      return {
        target,
        forbidden: forbidden.filter(word => typeof word === 'string' && word.trim()),
        category: raw.category || 'عام',
        clueIdea: 'من غير الكلمة السرية ولا أي كلمة ممنوعة… كلمة واحدة بس كتلميح.'
      };
    }
  }
  const fallback = PASSWORD_WORDS[index % PASSWORD_WORDS.length];
  if (!fallback) return null;
  return {
    target: fallback.target || fallback.word || '',
    forbidden: fallback.forbidden || [],
    category: fallback.category || 'عام',
    clueIdea: 'من غير الكلمة السرية ولا أي كلمة ممنوعة… كلمة واحدة بس كتلميح.'
  };
}

function normalizeR3Question(raw, category) {
  if (!raw) return null;
  const options = Array.isArray(raw.options)
    ? raw.options.filter(option => typeof option === 'string' && option.trim())
    : [];
  const answer = raw.correct_answer || raw.answer || '';
  if (!answer || options.length < 2 || !options.includes(answer)) return null;
  return {
    question: raw.question_text || raw.question || '',
    answer,
    options,
    category: raw.category || '',
    kickerHint: category?.name || ''
  };
}

function normalizeR4Topic(raw, index = 0) {
  if (raw) {
    const validItems = Array.isArray(raw.acceptable_answers)
      ? raw.acceptable_answers.filter(item => typeof item === 'string' && item.trim())
      : [];
    if (validItems.length) {
      return {
        topic: raw.question_text || raw.question || '',
        validItems,
        category: raw.category || 'عام',
        minBid: 3,
        hint: 'اذكر عناصر صحيحة من القائمة المعتمدة — الحكم الخصم هو اللي يتحقق منها.'
      };
    }
  }
  const fallback = AUCTION_TOPICS[index % AUCTION_TOPICS.length];
  return fallback ? { ...fallback } : null;
}

// ------------------------------------------------------------------
// Referee model (mirrors server/server.js)
// ------------------------------------------------------------------
function getRoundRefereeId(room, roundKey) {
  const state = room?.[roundKey] || {};
  if (roundKey === 'round1') return state.refereePlayerId || state.readerPlayerId || null;
  if (roundKey === 'round2') {
    const active = state.activeTurnTeam === 'team_b' ? 'team_b' : 'team_a';
    return active === 'team_a' ? (state.activeClueGiverB || null) : (state.activeClueGiverA || null);
  }
  return state.refereePlayerId || null;
}

function assignReferee(room, roundKey, { rotate = false } = {}) {
  const state = room?.[roundKey];
  if (!state) return null;
  const players = room.players || [];
  // Demo bots can never hold the judge seat: nobody would be able to act.
  const humans = players.filter(player => !player.isBot);
  let pool = [];
  if (roundKey === 'round1') {
    pool = humans.filter(player => player.team !== state.activeTeam);
  } else if (roundKey === 'round3') {
    pool = humans.filter(player => ![state.currentKickerId, state.currentGoalieId].includes(player.id));
  } else if (roundKey === 'round4') {
    pool = state.highestBidderTeam
      ? humans.filter(player => player.team !== state.highestBidderTeam)
      : humans.slice();
  } else {
    pool = humans.slice();
  }
  if (!pool.length) {
    // Fallback: the host (or the first human) keeps the arena moving.
    const host = humans.find(player => player.id === room.hostId) || humans[0];
    if (!host) return null;
    state.refereePlayerId = host.id;
    if (roundKey === 'round1') state.readerPlayerId = host.id;
    return host.id;
  }
  let chosen = pool[0];
  if (rotate && state.refereePlayerId) {
    const index = pool.findIndex(player => player.id === state.refereePlayerId);
    if (index !== -1) chosen = pool[(index + 1) % pool.length];
  }
  state.refereePlayerId = chosen.id;
  if (roundKey === 'round1') state.readerPlayerId = chosen.id;
  return chosen.id;
}

function isRound2ClueGiver(room, playerId) {
  if (!playerId) return false;
  const r2 = room?.round2 || {};
  return playerId === r2.activeClueGiverA || playerId === r2.activeClueGiverB;
}

function isAuthorizedForRound(room, roundKey, playerId) {
  if (!playerId) return false;
  if (roundKey === 'round2') return isRound2ClueGiver(room, playerId);
  return playerId === getRoundRefereeId(room, roundKey);
}

function secretTargets(room, roundKey) {
  if (roundKey === 'round2') {
    const r2 = room?.round2 || {};
    return [r2.activeClueGiverA, r2.activeClueGiverB].filter(Boolean);
  }
  const id = getRoundRefereeId(room, roundKey);
  return id ? [id] : [];
}

// ------------------------------------------------------------------
// Secret handling
//
// A "secret" is the answer of the current R1/R3 question, the R2 password
// card or the R4 verification checklist. It is stored in clear text only in
// the memory of the client that produced it, delivered to the authorised
// player over a judge channel, and stripped from every broadcast/persisted
// payload.
// ------------------------------------------------------------------
function stripRoundSecrets(room) {
  const clone = deepClone(room);
  if (!clone) return clone;
  if (clone.round1?.currentQuestion) clone.round1.currentQuestion.answer = null;
  if (clone.round2?.currentWord) {
    clone.round2.currentWord.target = '🔒 [كلمة سرية]';
    clone.round2.currentWord.forbidden = ['🔒 ممنوع', '🔒 ممنوع', '🔒 ممنوع', '🔒 ممنوع'];
    clone.round2.currentWord.redacted = true;
  }
  if (clone.round3?.currentQuestion) clone.round3.currentQuestion.answer = null;
  if (clone.round4?.currentTopic) clone.round4.currentTopic.validItems = [];
  return clone;
}

function collectRoundSecrets(room) {
  const secrets = {};
  const r1 = room?.round1;
  if (r1?.currentQuestion?.answer) {
    secrets.round1 = { answer: r1.currentQuestion.answer, questionId: `r1-${r1.currentQuestionIndex}` };
  }
  const r2 = room?.round2;
  if (r2?.currentWord?.target && !r2.currentWord.redacted) {
    secrets.round2 = {
      target: r2.currentWord.target,
      forbidden: r2.currentWord.forbidden || [],
      questionId: `r2-${r2.currentWordIndex}`
    };
  }
  const r3 = room?.round3;
  if (r3?.currentQuestion?.answer) {
    secrets.round3 = { answer: r3.currentQuestion.answer, questionId: `r3-${r3.turnIndex}` };
  }
  const r4 = room?.round4;
  if (r4?.currentTopic?.validItems?.length) {
    secrets.round4 = { validItems: r4.currentTopic.validItems, questionId: `r4-${r4.topicId}` };
  }
  return secrets;
}

function currentSecretId(room, roundKey) {
  if (roundKey === 'round1') return `r1-${room?.round1?.currentQuestionIndex}`;
  if (roundKey === 'round2') return `r2-${room?.round2?.currentWordIndex}`;
  if (roundKey === 'round3') return `r3-${room?.round3?.turnIndex}`;
  if (roundKey === 'round4') return `r4-${room?.round4?.topicId}`;
  return null;
}

function createInitialState(roomCode, hostId) {
  return {
    code: roomCode,
    hostId: hostId,
    status: 'lobby',
    countdown: null,
    tournamentStructure: TOURNAMENT_STRUCTURE,
    players: [],
    teams: {
      team_a: { id: 'team_a', name: 'فريق الحيتان (Team A)', score: 0, bank: 0, penaltyScore: 0 },
      team_b: { id: 'team_b', name: 'فريق الوحوش (Team B)', score: 0, bank: 0, penaltyScore: 0 }
    },
    round1: {
      activeTeam: 'team_a',
      answeringPlayerId: null,
      readerPlayerId: null,
      refereePlayerId: null,
      segmentIndex: 0,
      subBatchIndex: 0,
      subBatchQuestionsAnswered: 0,
      segmentQuestionsAnswered: 0,
      totalQuestionsAnswered: 0,
      totalQuestions: R1_TOTAL_QUESTIONS,
      currentQuestionIndex: 0,
      streak: 0,
      pendingPoints: 0,
      lastDecision: null,
      streakLadder: R1_STREAK_LADDER,
      currentQuestion: null,
      actionToken: null,
      timer: 30,
      isTimerRunning: false,
      history: []
    },
    round2: {
      currentWordIndex: 0,
      totalQuestions: R2_TOTAL_CARDS,
      currentWord: null,
      activeTurnTeam: 'team_a',
      activeClueGiverA: null,
      activeClueGiverB: null,
      currentGiverIndex: 0,
      refereePlayerId: null,
      isComplete: false,
      timeFreezeUsed: false,
      timer: 45,
      isTimerRunning: false,
      endTime: null,
      actionToken: null,
      fouls: { team_a: 0, team_b: 0 }
    },
    round3: {
      turnIndex: 0,
      totalShots: R3_TOTAL_SHOTS,
      currentKickerId: null,
      currentGoalieId: null,
      kickerTeam: 'team_a',
      currentCategory: PENALTY_CATEGORIES[0],
      phase: 'duelist_selection',
      currentQuestion: null,
      refereePlayerId: null,
      timer: 20,
      isTimerRunning: false,
      interceptBuzzedBy: null,
      interceptAt: null,
      shotStartedAt: null,
      pendingAnswer: null,
      tieBreakActive: false,
      tieBreakData: null,
      isComplete: false,
      shotsHistory: []
    },
    round4: {
      currentTopicIndex: 0,
      currentTopic: null,
      topicId: null,
      highestBid: 3,
      highestBidderTeam: null,
      highestBidderPlayerId: null,
      refereePlayerId: null,
      timer: 60,
      isTimerRunning: false,
      endTime: null,
      phase: 'bidding',
      itemsNamed: [],
      usedLifelines: { team_a: [], team_b: [] }
    },
    messages: []
  };
}

export function createSupabaseSocket(customClient = null) {
  const supabase = customClient || createSupabaseClient();
  const listeners = new Map();
  let channel = null;
  let judgeChannel = null;
  let currentRoomCode = null;
  let localPlayer = null;
  let cachedRoomState = null;
  const localSecrets = {};
  const pendingSecretRequests = {};
  let lastChatAt = 0;
  const socketId = 'sb_' + Math.random().toString(36).substring(2, 11);

  const socket = {
    id: socketId,
    connected: true,

    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return socket;
    },

    off(event, handler) {
      if (listeners.has(event)) {
        if (handler) {
          listeners.get(event).delete(handler);
        } else {
          listeners.delete(event);
        }
      }
      return socket;
    },

    emit(event, payload = {}) {
      Promise.resolve(handleClientAction(event, payload)).catch(err => {
        console.error(`[SupabaseSocket] Unhandled error in action "${event}":`, err);
        emitError('تعذر تنفيذ العملية، تأكد من الاتصال بالإنترنت', event);
      });
      return socket;
    },

    disconnect() {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      if (judgeChannel) {
        supabase.removeChannel(judgeChannel);
        judgeChannel = null;
      }
      socket.connected = false;
      trigger('disconnect', 'client_closed');
    }
  };

  function trigger(event, data) {
    const handlers = listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[SupabaseSocket] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  function emitError(message, action) {
    trigger('action_error', { message, field: 'general', action });
    trigger('error_message', message);
  }

  function emitLocalState() {
    if (cachedRoomState) {
      trigger('room_state_updated', sanitizeForViewer(cachedRoomState, socketId));
      requestMissingSecrets();
    }
  }

  // If this client is the authorised viewer for a round but it does not hold
  // the secret yet (fresh referee, reconnect, missed broadcast) it asks the
  // room for it. The request is throttled per question so it cannot spam.
  function requestMissingSecrets() {
    const room = cachedRoomState;
    if (!room || !channel) return;
    for (const roundKey of ['round1', 'round2', 'round3', 'round4']) {
      if (!isAuthorizedForRound(room, roundKey, socketId)) continue;
      const secretId = currentSecretId(room, roundKey);
      if (!secretId) continue;
      const local = localSecrets[roundKey];
      if (local && local.questionId === secretId) continue;
      if (pendingSecretRequests[roundKey] === secretId) continue;
      pendingSecretRequests[roundKey] = secretId;
      channel.send({
        type: 'broadcast',
        event: 'judge_secret_request',
        payload: { roundKey, questionId: secretId, requesterId: socketId }
      });
    }
  }

  function sanitizeForViewer(room, viewerId) {
    if (!room) return null;
    const clone = stripRoundSecrets(room);
    clone.viewerId = viewerId;
    clone.players = (clone.players || []).map(player => {
      const copy = { ...player };
      delete copy.playerToken;
      delete copy.playerTokenHash;
      return copy;
    });
    clone.refereeIds = {
      round1: getRoundRefereeId(room, 'round1'),
      round2: getRoundRefereeId(room, 'round2'),
      round3: getRoundRefereeId(room, 'round3'),
      round4: getRoundRefereeId(room, 'round4')
    };

    // Restore only the secrets this viewer is actually allowed to see, and
    // only when they belong to the question that is currently live.
    const secretMatches = (roundKey) => {
      const secret = localSecrets[roundKey];
      if (!secret) return false;
      const currentId = currentSecretId(room, roundKey);
      return !secret.questionId || !currentId || secret.questionId === currentId;
    };

    if (isAuthorizedForRound(room, 'round1', viewerId) && secretMatches('round1')) {
      if (clone.round1?.currentQuestion) clone.round1.currentQuestion.answer = localSecrets.round1.answer;
    }
    if (isAuthorizedForRound(room, 'round2', viewerId) && secretMatches('round2')) {
      if (clone.round2?.currentWord) {
        clone.round2.currentWord.target = localSecrets.round2.target;
        clone.round2.currentWord.forbidden = localSecrets.round2.forbidden || [];
        clone.round2.currentWord.redacted = false;
      }
    }
    if (isAuthorizedForRound(room, 'round3', viewerId) && secretMatches('round3')) {
      if (clone.round3?.currentQuestion) clone.round3.currentQuestion.answer = localSecrets.round3.answer;
    }
    if (isAuthorizedForRound(room, 'round4', viewerId) && secretMatches('round4')) {
      if (clone.round4?.currentTopic) clone.round4.currentTopic.validItems = localSecrets.round4.validItems;
    }
    return clone;
  }

  function broadcastToRoom(event, payload) {
    if (channel) {
      channel.send({
        type: 'broadcast',
        event,
        payload
      });
    }
    trigger(event, payload);
  }

  function publicState(room) {
    const clone = stripRoundSecrets(room);
    clone.players = (clone.players || []).map(player => {
      const copy = { ...player };
      delete copy.playerToken;
      return copy;
    });
    return clone;
  }

  async function persistAndBroadcast(newRoomState) {
    cachedRoomState = newRoomState;
    const publicRoom = publicState(newRoomState);

    try {
      await supabase
        .from('rooms')
        .update({
          status: newRoomState.status,
          players: publicRoom.players,
          teams: publicRoom.teams,
          state: {
            round1: publicRoom.round1,
            round2: publicRoom.round2,
            round3: publicRoom.round3,
            round4: publicRoom.round4,
            countdown: publicRoom.countdown,
            messages: publicRoom.messages
          },
          updated_at: new Date().toISOString()
        })
        .eq('room_id', newRoomState.code);
    } catch (err) {
      console.error('[SupabaseSocket] Error updating room in DB:', err);
    }

    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'room_state_updated',
        payload: publicRoom
      });
    }
    trigger('room_state_updated', sanitizeForViewer(newRoomState, socketId));
  }

  // ------------------------------------------------------------------
  // Judge channel: the only channel allowed to carry secret payloads.
  // ------------------------------------------------------------------
  function setupJudgeChannel(roomCode) {
    if (judgeChannel) {
      supabase.removeChannel(judgeChannel);
      judgeChannel = null;
    }
    judgeChannel = supabase.channel(`room:${roomCode}:judge:${socketId}`);
    judgeChannel
      .on('broadcast', { event: 'judge_secret' }, ({ payload }) => {
        if (!payload || !payload.roundKey || !payload.secret) return;
        localSecrets[payload.roundKey] = payload.secret;
        emitLocalState();
      })
      .subscribe();
  }

  function sendJudgeSecret(room, roundKey, secret) {
    if (!room || !secret) return;
    const targets = secretTargets(room, roundKey);
    for (const targetId of targets) {
      if (targetId === socketId) {
        localSecrets[roundKey] = secret;
        continue;
      }
      const targetChannel = supabase.channel(`room:${room.code}:judge:${targetId}`);
      targetChannel.send({
        type: 'broadcast',
        event: 'judge_secret',
        payload: { roundKey, secret }
      });
      supabase.removeChannel(targetChannel);
    }
  }

  function publishSecrets(room) {
    const secrets = collectRoundSecrets(room);
    for (const [roundKey, secret] of Object.entries(secrets)) {
      // The client that produced the question keeps the secret locally: it is
      // the one that has to validate the answers (Round 3) or rotate the
      // referee with it (Round 1).
      localSecrets[roundKey] = secret;
      sendJudgeSecret(room, roundKey, secret);
    }
  }

  function setupChannel(roomCode, playerInfo) {
    if (channel && currentRoomCode === roomCode) return;
    if (channel) supabase.removeChannel(channel);

    currentRoomCode = roomCode;
    channel = supabase.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: false },
        presence: { key: socketId }
      }
    });

    channel
      .on('broadcast', { event: '*' }, async ({ event, payload }) => {
        if (event === 'room_state_updated') {
          cachedRoomState = payload;
          emitLocalState();
        } else if (event === 'judge_secret_request') {
          // Another client is the authorised viewer and needs the secret.
          const room = cachedRoomState || {};
          const roundKey = payload?.roundKey;
          const local = localSecrets[roundKey];
          const secret = (local && local.questionId === payload.questionId)
            ? local
            : collectRoundSecrets(room)[roundKey];
          if (secret && payload.questionId === currentSecretId(room, roundKey)) {
            sendJudgeSecret(room, roundKey, secret);
          }
        } else {
          trigger(event, payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = Object.keys(state);
        if (cachedRoomState && Array.isArray(cachedRoomState.players)) {
          let changed = false;
          cachedRoomState.players.forEach(player => {
            const isOnline = activeIds.includes(player.id) || player.isBot;
            if (player.connected !== isOnline) {
              player.connected = isOnline;
              changed = true;
            }
          });
          if (changed) emitLocalState();
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (cachedRoomState && Array.isArray(cachedRoomState.players)) {
          const leftIds = leftPresences.map(presence => presence.playerId || presence.key);
          cachedRoomState.players.forEach(player => {
            if (leftIds.includes(player.id) && !player.isBot) {
              player.connected = false;
            }
          });
          emitLocalState();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && playerInfo) {
          channel.track({
            playerId: socketId,
            name: playerInfo.name,
            team: playerInfo.team,
            isHost: playerInfo.isHost
          });
        }
      });

    setupJudgeChannel(roomCode);
  }

  async function loadRoomFromDb(roomCode) {
    const { data: row, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', roomCode)
      .maybeSingle();
    if (error || !row) return null;

    const base = createInitialState(roomCode, row.host_id);
    return {
      ...base,
      status: row.status || 'lobby',
      players: row.players || [],
      teams: row.teams || base.teams,
      countdown: row.state?.countdown ?? null,
      messages: row.state?.messages || [],
      round1: { ...base.round1, ...(row.state?.round1 || {}) },
      round2: { ...base.round2, ...(row.state?.round2 || {}) },
      round3: { ...base.round3, ...(row.state?.round3 || {}) },
      round4: { ...base.round4, ...(row.state?.round4 || {}) }
    };
  }

  function isHost(room) {
    return !!localPlayer?.isHost || room?.hostId === socketId;
  }

  function findPlayer(room, playerId = socketId) {
    return (room?.players || []).find(player => player.id === playerId) || null;
  }

  // Room scoped actions must not be applied to another room.
  function isCurrentRoom(roomCode) {
    if (!roomCode) return true;
    return normalizeRoomCode(roomCode) === currentRoomCode;
  }

  // Read-modify-write: every mutation is applied to the freshest state that
  // PostgreSQL holds, so a client with a stale snapshot cannot roll the room
  // back (for example writing an old room status over a newer one).
  async function currentRoom() {
    if (cachedRoomState && cachedRoomState.code === currentRoomCode) {
      return cachedRoomState;
    }
    if (currentRoomCode) {
      const fresh = await loadRoomFromDb(currentRoomCode);
      if (fresh) return fresh;
    }
    return cachedRoomState;
  }

  // ------------------------------------------------------------------
  // Round helpers
  // ------------------------------------------------------------------
  function setR2CardRoles(room, { toggleTurn = false } = {}) {
    const r2 = room.round2;
    const teamA = room.players.filter(player => player.team === 'team_a');
    const teamB = room.players.filter(player => player.team === 'team_b');
    const cardIndex = Math.max(0, r2.currentWordIndex || 0);
    const previousGiverA = r2.activeClueGiverA;
    const previousGiverB = r2.activeClueGiverB;

    if (toggleTurn) {
      r2.activeTurnTeam = r2.activeTurnTeam === 'team_a' ? 'team_b' : 'team_a';
    }
    const giverSwap = (toggleTurn || reason === 'card_end')
      ? TurnManager.swapClueGivers(room.players, previousGiverA, previousGiverB, cardIndex)
      : {
          activeClueGiverA: teamA[cardIndex % Math.max(1, teamA.length)]?.id || null,
          activeClueGiverB: teamB[cardIndex % Math.max(1, teamB.length)]?.id || null,
          currentGiverIndex: cardIndex
        };
    r2.activeClueGiverA = giverSwap.activeClueGiverA;
    r2.activeClueGiverB = giverSwap.activeClueGiverB;
    r2.currentGiverIndex = giverSwap.currentGiverIndex;
    r2.refereePlayerId = getRoundRefereeId(room, 'round2');
  }

  function dispatchR2Card(room) {
    const r2 = room.round2;
    const raw = drawLocalQuestion({
      roomId: room.code,
      mode: 'edini_fi_seri',
      slotType: 'random'
    });
    const word = normalizeR2Word(raw, r2.currentWordIndex || 0);
    r2.currentWord = word;
    r2.actionToken = word ? `act_${Math.random().toString(36).substring(2, 12)}` : null;
    r2.timeFreezeUsed = false;
    r2.isTimerRunning = true;
    r2.timer = 45;
    r2.endTime = Date.now() + 45000;
    return !!word;
  }

  function dispatchR3Question(room) {
    const category = room.round3.currentCategory;
    if (!category?.id) return false;
    const raw = drawLocalCategoryQuestion('hat_fi_qoraybi', category.id, room.code);
    const question = normalizeR3Question(raw, category);
    room.round3.currentQuestion = question;
    return !!question;
  }

  function dispatchR4Topic(room) {
    const index = room.round4.currentTopicIndex || 0;
    const raw = drawLocalQuestion({ roomId: room.code, mode: 'meen_yezawwed', slotType: 'random' });
    const topic = normalizeR4Topic(raw, index);
    room.round4.currentTopic = topic;
    room.round4.topicId = topic ? `topic-${index}-${Math.random().toString(36).substring(2, 8)}` : null;
    return !!topic;
  }

  function buildR1Plan(room) {
    const answering = findPlayer(room, room.round1.answeringPlayerId);
    const plan = buildLocalR1TurnPlan(answering?.character?.id);
    room.round1.turnPlan = plan;
    room.round1.turnPlanIndex = 0;
    return plan;
  }

  function dispatchR1Question(room) {
    const r1 = room.round1;
    if (r1.totalQuestionsAnswered >= R1_TOTAL_QUESTIONS) {
      r1.currentQuestion = null;
      r1.actionToken = null;
      r1.isTimerRunning = false;
      return false;
    }
    if (!Array.isArray(r1.turnPlan) || !r1.turnPlan.length || r1.turnPlanIndex >= r1.turnPlan.length) {
      buildR1Plan(room);
    }
    const slot = r1.turnPlan[r1.turnPlanIndex] || { slotType: 'random' };
    const raw = drawLocalR1Question({
      roomId: room.code,
      mode: 'one_two_bank',
      slotType: slot.slotType,
      characterId: findPlayer(room, r1.answeringPlayerId)?.character?.id
    });
    const question = normalizeR1Question(raw, slot.slotType);
    if (!question) {
      r1.currentQuestion = null;
      r1.actionToken = null;
      return false;
    }
    r1.turnPlanIndex += 1;
    r1.currentQuestionIndex += 1;
    r1.currentQuestion = question;
    r1.actionToken = `act_${Math.random().toString(36).substring(2, 12)}`;
    r1.isTimerRunning = true;
    return true;
  }

  function advanceR1Quota(room) {
    const r1 = room.round1;
    r1.subBatchQuestionsAnswered += 1;
    r1.segmentQuestionsAnswered += 1;
    r1.totalQuestionsAnswered += 1;

    if (r1.totalQuestionsAnswered >= R1_TOTAL_QUESTIONS) {
      if (r1.pendingPoints > 0) {
        room.teams[r1.activeTeam].bank += r1.pendingPoints;
        room.teams[r1.activeTeam].score += r1.pendingPoints;
        r1.pendingPoints = 0;
      }
      r1.currentQuestion = null;
      r1.actionToken = null;
      r1.isTimerRunning = false;
      return;
    }

    if (r1.segmentQuestionsAnswered >= R1_SEGMENT_SIZE) {
      // Segment complete: settle the pot and give the turn to the other team.
      if (r1.pendingPoints > 0) {
        room.teams[r1.activeTeam].bank += r1.pendingPoints;
        room.teams[r1.activeTeam].score += r1.pendingPoints;
      }
      r1.segmentIndex += 1;
      r1.segmentQuestionsAnswered = 0;
      r1.subBatchIndex = 0;
      r1.subBatchQuestionsAnswered = 0;
      r1.pendingPoints = 0;
      r1.streak = 0;
      r1.activeTeam = r1.activeTeam === 'team_a' ? 'team_b' : 'team_a';

      const activePlayers = room.players.filter(player => player.team === r1.activeTeam);
      assignReferee(room, 'round1');
      r1.answeringPlayerId = activePlayers.find(player => player.id !== r1.refereePlayerId)?.id
        || activePlayers[0]?.id
        || null;
      return;
    }

    // Strict per-question alternation inside the same team's 12-question turn.
    const activePlayers = room.players.filter(player => player.team === r1.activeTeam);
    if (activePlayers.length > 1) {
      const index = activePlayers.findIndex(player => player.id === r1.answeringPlayerId);
      r1.answeringPlayerId = activePlayers[(index + 1) % activePlayers.length].id;
    }

    // Keep the legacy 6+6 counters coherent; the judge does not rotate mid-segment.
    if (r1.subBatchQuestionsAnswered >= R1_SUB_BATCH_SIZE) {
      r1.subBatchIndex = 1;
      r1.subBatchQuestionsAnswered = 0;
    }
  }

  function settleR3Shot(room, result, meta = {}) {
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
      broadcastToRoom('sound_trigger', { sound: 'goal_roar' });
      broadcastToRoom('confetti_trigger', {});
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
      broadcastToRoom('sound_trigger', { sound: 'save' });
    } else {
      broadcastToRoom('sound_trigger', { sound: 'whistle' });
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

    r3.turnIndex += 1;
    r3.kickerTeam = kickingTeam === 'team_a' ? 'team_b' : 'team_a';
    r3.interceptBuzzedBy = null;
    r3.interceptAt = null;
    r3.shotStartedAt = null;
    r3.pendingAnswer = null;
    r3.tieBreakActive = false;
    r3.tieBreakData = null;
    r3.currentQuestion = null;

    // Regulation or Sudden Death check
    if (r3.turnIndex >= R3_TOTAL_SHOTS) {
      const scoreA = room.teams.team_a.penaltyScore || 0;
      const scoreB = room.teams.team_b.penaltyScore || 0;

      if (!r3.isSuddenDeath) {
        if (scoreA === scoreB) {
          r3.isSuddenDeath = true;
          r3.suddenDeathRound = 1;
          r3.isComplete = false;
          broadcastToRoom('sound_trigger', { sound: 'whistle' });
          broadcastToRoom('notification', {
            title: '⚡ شوط الموت المفاجئ (Sudden Death)!',
            message: 'تعادل في الركلات الترجيحية! ركلة بركلة حتى الحسم.'
          });
        } else {
          r3.isComplete = true;
        }
      } else {
        // Evaluate complete 2-kick rounds in sudden death
        if (r3.turnIndex % 2 === 0) {
          const lastTwo = r3.shotsHistory.slice(-2);
          const shotA = lastTwo.find(s => s.team === 'team_a');
          const shotB = lastTwo.find(s => s.team === 'team_b');
          const roundPtsA = (shotA?.result === 'goal' ? 1 : 0) + (shotB?.result === 'saved' ? 1 : 0);
          const roundPtsB = (shotB?.result === 'goal' ? 1 : 0) + (shotA?.result === 'saved' ? 1 : 0);

          if (roundPtsA !== roundPtsB) {
            r3.isComplete = true;
            const teamAName = room.teams?.team_a?.name || 'فريق A';
            const teamBName = room.teams?.team_b?.name || 'فريق B';
            const winner = roundPtsA > roundPtsB ? teamAName : teamBName;
            broadcastToRoom('notification', {
              title: '🏆 حُسمت في الموت المفاجئ!',
              message: `فاز ${winner} بعد شوط الموت المفاجئ!`
            });
          } else {
            r3.suddenDeathRound = (r3.suddenDeathRound || 1) + 1;
            r3.isComplete = false;
            broadcastToRoom('notification', {
              title: '⚡ استمرار الموت المفاجئ!',
              message: `تعادل في الجولة ${r3.suddenDeathRound - 1}! جولة جديدة.`
            });
          }
        }
      }

      if (r3.isComplete) {
        r3.phase = 'complete';
        r3.currentKickerId = null;
        r3.currentGoalieId = null;
        broadcastToRoom('sound_trigger', { sound: 'whistle' });
        broadcastToRoom('notification', {
          title: '🏁 خلصت ركلات الجزاء!',
          message: 'تم حسم ركلات الجزاء الترجيحية! الانتقال لجولة المزاد مين يزوّد.'
        });
        return true;
      }
    }

    // Guarantee >= 50% General questions
    const isGeneralTurn = r3.turnIndex % 2 === 0;
    const generalCategories = PENALTY_CATEGORIES.filter(c => isGeneralCategory(c.id));
    const specialtyCategories = PENALTY_CATEGORIES.filter(c => !isGeneralCategory(c.id));
    r3.currentCategory = isGeneralTurn
      ? (generalCategories[Math.floor(Math.random() * generalCategories.length)] || PENALTY_CATEGORIES[0])
      : (specialtyCategories[Math.floor(Math.random() * specialtyCategories.length)] || PENALTY_CATEGORIES[0]);

    r3.phase = 'duelist_selection';

    const teamA = room.players.filter(player => player.team === 'team_a');
    const teamB = room.players.filter(player => player.team === 'team_b');
    if (r3.kickerTeam === 'team_a') {
      r3.currentKickerId = teamA[r3.turnIndex % Math.max(1, teamA.length)]?.id;
      r3.currentGoalieId = teamB[r3.turnIndex % Math.max(1, teamB.length)]?.id;
    } else {
      r3.currentKickerId = teamB[r3.turnIndex % Math.max(1, teamB.length)]?.id;
      r3.currentGoalieId = teamA[r3.turnIndex % Math.max(1, teamA.length)]?.id;
    }
    assignReferee(room, 'round3', { rotate: true });
    return true;
  }

  // ------------------------------------------------------------------
  // Client actions
  // ------------------------------------------------------------------
  async function handleClientAction(event, payload) {
    switch (event) {
      case 'create_room': {
        const { playerName, characterId } = payload;
        const cleanName = sanitizeName(playerName) || 'كابتن الساحة';
        const character = CHARACTERS.find(char => char.id === characterId) || CHARACTERS[0];
        const roomCode = generateRoomCode();
        const playerToken = createToken();

        const player = {
          id: socketId,
          name: cleanName,
          character,
          team: 'team_a',
          isHost: true,
          isBot: false,
          connected: true,
          lastSeen: Date.now(),
          scoreContribution: 0,
          playerToken,
          playerTokenHash: hashToken(playerToken)
        };

        const initial = createInitialState(roomCode, socketId);
        initial.players.push(player);
        localPlayer = player;
        cachedRoomState = initial;

        let created = false;
        let attempts = 0;
        let activeRoomCode = roomCode;

        while (!created && attempts < 3) {
          attempts++;
          try {
            const { error: insertErr } = await supabase.from('rooms').insert({
              room_id: activeRoomCode,
              host_id: socketId,
              status: 'lobby',
              players: publicState(initial).players,
              teams: initial.teams,
              state: {
                round1: initial.round1,
                round2: initial.round2,
                round3: initial.round3,
                round4: initial.round4
              }
            });
            if (!insertErr) {
              created = true;
            } else if (insertErr.code === '23505') {
              activeRoomCode = generateRoomCode();
              initial.code = activeRoomCode;
            } else {
              console.error('[SupabaseSocket] Error inserting room into DB:', insertErr);
              break;
            }
          } catch (err) {
            console.error('[SupabaseSocket] Error creating room in DB:', err);
            break;
          }
        }

        if (!created) {
          localPlayer = null;
          cachedRoomState = null;
          trigger('error_message', 'تعذر إنشاء الغرفة على السيرفر.. جرب تاني.');
          trigger('action_error', {
            message: 'تعذر إنشاء الغرفة على السيرفر.. جرب تاني.',
            field: 'general',
            action: 'create_room'
          });
          break;
        }

        setupChannel(activeRoomCode, player);

        trigger('room_created', {
          roomCode: activeRoomCode,
          playerToken,
          player: publicState(initial).players[0],
          room: sanitizeForViewer(initial, socketId)
        });
        break;
      }

      case 'join_room': {
        const { roomCode, playerName, characterId, teamPreference } = payload;
        const cleanCode = normalizeRoomCode(roomCode);
        const cleanName = sanitizeName(playerName) || 'لاعب';

        const room = await loadRoomFromDb(cleanCode);
        if (!room) {
          trigger('action_error', {
            message: 'كود الغرفة غير موجود يا بطل! اتأكد من الكود — Room not found.',
            field: 'roomCode',
            action: 'join_room'
          });
          return;
        }

        if (room.status !== 'lobby' && room.status !== 'waiting') {
          trigger('action_error', {
            message: 'الماتش بدأ بالفعل! مينفعش تنضم دلوقتي — Match already started.',
            field: 'roomCode',
            action: 'join_room'
          });
          return;
        }

        if (room.players.length >= MAX_PLAYERS) {
          trigger('action_error', {
            message: `الغرفة ممتلئة بالفعل (${MAX_PLAYERS}/${MAX_PLAYERS})! — Room is full.`,
            field: 'roomCode',
            action: 'join_room'
          });
          return;
        }

        // Character ownership is NOT exclusive: players may share a character.
        const character = CHARACTERS.find(char => char.id === characterId)
          || CHARACTERS[room.players.length % CHARACTERS.length]
          || CHARACTERS[0];

        const teamACount = room.players.filter(player => player.team === 'team_a').length;
        const teamBCount = room.players.filter(player => player.team === 'team_b').length;
        let assignedTeam = teamPreference === 'team_b' ? 'team_b' : 'team_a';
        if (assignedTeam === 'team_a' && teamACount >= TEAM_PLAYERS) assignedTeam = 'team_b';
        else if (assignedTeam === 'team_b' && teamBCount >= TEAM_PLAYERS) assignedTeam = 'team_a';
        if (assignedTeam === 'team_a' && teamACount >= TEAM_PLAYERS) {
          emitError('الفريق ده كامل (2/2)!', 'join_room');
          return;
        }
        if (assignedTeam === 'team_b' && teamBCount >= TEAM_PLAYERS) {
          emitError('الفريق ده كامل (2/2)!', 'join_room');
          return;
        }

        const playerToken = createToken();
        const player = {
          id: socketId,
          name: cleanName,
          character,
          team: assignedTeam,
          isHost: false,
          isBot: false,
          connected: true,
          lastSeen: Date.now(),
          scoreContribution: 0,
          playerToken,
          playerTokenHash: hashToken(playerToken)
        };

        room.players.push(player);
        localPlayer = player;
        cachedRoomState = room;

        setupChannel(cleanCode, player);
        await persistAndBroadcast(room);

        trigger('joined_room', {
          roomCode: cleanCode,
          playerToken,
          player,
          room: sanitizeForViewer(room, socketId)
        });
        break;
      }

      case 'rejoin_room': {
        const { roomCode, playerToken } = payload;
        const cleanCode = normalizeRoomCode(roomCode);

        const room = await loadRoomFromDb(cleanCode);
        if (!room) {
          trigger('rejoin_failed', { message: 'الغرفة دي خلصت، اعمل غرفة جديدة' });
          trigger('error_message', 'الغرفة دي خلصت، اعمل غرفة جديدة');
          return;
        }

        const tokenHash = hashToken(playerToken);
        const player = room.players.find(candidate => candidate.playerTokenHash === tokenHash);
        if (!player) {
          trigger('rejoin_failed', { message: 'جلسة الاستعادة مش صالحة! ادخل بكود الغرفة من جديد.' });
          trigger('error_message', 'جلسة الاستعادة مش صالحة! ادخل بكود الغرفة من جديد.');
          return;
        }

        player.id = socketId;
        player.connected = true;
        player.lastSeen = Date.now();
        player.playerToken = playerToken;
        localPlayer = player;
        cachedRoomState = room;

        setupChannel(cleanCode, player);
        await persistAndBroadcast(room);

        trigger('rejoined_room', {
          roomCode: cleanCode,
          playerToken,
          player,
          room: sanitizeForViewer(room, socketId)
        });
        break;
      }

      case 'update_player_profile': {
        const { characterId, team, playerName } = payload;
        const room = await currentRoom();
        if (!room) return;
        const player = findPlayer(room);
        if (!player) return;

        if (characterId) {
          const character = CHARACTERS.find(char => char.id === characterId);
          // Character ownership is NOT exclusive.
          if (character) player.character = character;
        }
        if (team && team !== player.team) {
          const count = room.players.filter(other => other.team === team).length;
          if (count >= TEAM_PLAYERS) {
            emitError('الفريق ده كامل (2/2)!', 'update_player_profile');
            return;
          }
          player.team = team;
        }
        if (playerName) player.name = sanitizeName(playerName);
        localPlayer = player;
        await persistAndBroadcast(room);
        trigger('profile_updated', { player: { ...player, playerToken: undefined, playerTokenHash: undefined } });
        break;
      }

      case 'add_demo_player': {
        const room = await currentRoom();
        if (!room) return;
        if (room.players.length >= MAX_PLAYERS) return;

        // Demo bots may also reuse an existing character.
        const nextChar = CHARACTERS[room.players.length % CHARACTERS.length] || CHARACTERS[0];
        const teamACount = room.players.filter(player => player.team === 'team_a').length;
        const teamBCount = room.players.filter(player => player.team === 'team_b').length;
        const assignedTeam = teamACount <= teamBCount ? 'team_a' : 'team_b';

        const botPlayer = {
          id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: nextChar.name,
          character: nextChar,
          team: assignedTeam,
          isHost: false,
          isBot: true,
          connected: true,
          lastSeen: Date.now(),
          scoreContribution: 0
        };

        room.players.push(botPlayer);
        cachedRoomState = room;
        await persistAndBroadcast(room);
        const botTeamName = assignedTeam === 'team_a' ? (room.teams?.team_a?.name || 'فريق A') : (room.teams?.team_b?.name || 'فريق B');
        broadcastToRoom('notification', {
          title: 'انضمام لاعب 🎮',
          message: `انضم ${botPlayer.name} إلى الساحة في ${botTeamName}`
        });
        break;
      }

      case 'start_match_countdown': {
        const cleanCode = normalizeRoomCode(payload.roomCode || currentRoomCode);
        const room = await loadRoomFromDb(cleanCode);
        if (!room) return;
        if (!isHost(room)) {
          emitError('Starting the match is reserved for the room host.', 'start_match_countdown');
          return;
        }
        cachedRoomState = room;

        broadcastToRoom('countdown_tick', { count: 3 });
        broadcastToRoom('sound_trigger', { sound: 'whistle' });

        setTimeout(() => {
          broadcastToRoom('countdown_tick', { count: 2 });
          broadcastToRoom('sound_trigger', { sound: 'whistle' });
        }, 1000);

        setTimeout(() => {
          broadcastToRoom('countdown_tick', { count: 1 });
          broadcastToRoom('sound_trigger', { sound: 'whistle' });
        }, 2000);

        setTimeout(async () => {
          broadcastToRoom('countdown_tick', { count: 0 });
          room.countdown = 0;
          room.status = 'round1';

          const teamA = room.players.filter(player => player.team === 'team_a');
          room.round1.activeTeam = 'team_a';
          room.round1.answeringPlayerId = teamA[0]?.id || room.players[0]?.id;
          assignReferee(room, 'round1');
          dispatchR1Question(room);
          publishSecrets(room);

          await persistAndBroadcast(room);
          broadcastToRoom('match_started', { roomCode: room.code });
        }, 3000);
        break;
      }

      case 'change_round': {
        const { targetRound } = payload;
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        if (!isHost(room)) {
          emitError('Round changes are reserved for the room host.', 'change_round');
          return;
        }

        room.status = targetRound;

        if (targetRound === 'round1') {
          room.round1.activeTeam = 'team_a';
          room.round1.answeringPlayerId = room.players.find(player => player.team === 'team_a')?.id || null;
          room.round1.segmentIndex = 0;
          room.round1.subBatchIndex = 0;
          room.round1.subBatchQuestionsAnswered = 0;
          room.round1.segmentQuestionsAnswered = 0;
          room.round1.totalQuestionsAnswered = 0;
          room.round1.streak = 0;
          room.round1.pendingPoints = 0;
          room.round1.turnPlan = null;
          room.round1.turnPlanIndex = 0;
          assignReferee(room, 'round1');
          dispatchR1Question(room);
        } else if (targetRound === 'round2') {
          room.round2.currentWordIndex = 0;
          room.round2.activeTurnTeam = 'team_a';
          room.round2.fouls = { team_a: 0, team_b: 0 };
          room.round2.isComplete = false;
          room.round2.timeFreezeUsed = false;
          room.round2.timer = 45;
          setR2CardRoles(room);
          dispatchR2Card(room);
        } else if (targetRound === 'round3') {
          room.round3.turnIndex = 0;
          room.round3.kickerTeam = 'team_a';
          room.round3.currentCategory = PENALTY_CATEGORIES[Math.floor(Math.random() * PENALTY_CATEGORIES.length)];
          room.round3.phase = 'duelist_selection';
          room.round3.currentQuestion = null;
          room.round3.shotsHistory = [];
          room.round3.isComplete = false;
          room.round3.tieBreakActive = false;
          room.round3.tieBreakData = null;
          room.round3.interceptBuzzedBy = null;
          const teamA = room.players.filter(player => player.team === 'team_a');
          const teamB = room.players.filter(player => player.team === 'team_b');
          room.round3.currentKickerId = teamA[0]?.id || null;
          room.round3.currentGoalieId = teamB[0]?.id || null;
          assignReferee(room, 'round3');
        } else if (targetRound === 'round4') {
          room.round4.currentTopicIndex = 0;
          dispatchR4Topic(room);
          room.round4.highestBid = room.round4.currentTopic?.minBid || 3;
          room.round4.highestBidderTeam = null;
          room.round4.highestBidderPlayerId = null;
          room.round4.phase = 'bidding';
          room.round4.timer = 60;
          room.round4.itemsNamed = [];
          room.round4.usedLifelines = { team_a: [], team_b: [] };
          assignReferee(room, 'round4');
        }

        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r1_action_score': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r1 = room.round1;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round1')) {
          emitError('اعتماد الإجابة محصور بجهاز الحكم المكلّف فقط.', 'r1_action_score');
          return;
        }
        if (!r1.currentQuestion || !r1.actionToken || r1.actionToken !== payload.actionToken) {
          emitError('انتهت صلاحية السؤال ده — اطلب سؤال جديد.', 'r1_action_score');
          return;
        }
        r1.actionToken = null;

        const nextStreak = Math.min(r1.streak + 1, 10);
        r1.streak = nextStreak;
        r1.pendingPoints = r1.streakLadder[nextStreak] || 0;

        advanceR1Quota(room);
        if (r1.totalQuestionsAnswered < R1_TOTAL_QUESTIONS) {
          dispatchR1Question(room);
        }
        broadcastToRoom('sound_trigger', { sound: 'correct', streak: nextStreak });
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r1_action_break': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r1 = room.round1;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round1')) {
          emitError('كسر الستريك محصور بجهاز الحكم المكلّف فقط.', 'r1_action_break');
          return;
        }
        if (!r1.currentQuestion || !r1.actionToken || r1.actionToken !== payload.actionToken) {
          emitError('انتهت صلاحية السؤال ده — اطلب سؤال جديد.', 'r1_action_break');
          return;
        }
        r1.actionToken = null;

        const answering = findPlayer(room, r1.answeringPlayerId);
        if (answering?.character?.id === 'abdelrahman_eltouny' && r1.streak > 1) {
          r1.streak = Math.max(1, r1.streak - 1);
          r1.pendingPoints = r1.streakLadder[r1.streak] || 0;
          broadcastToRoom('notification', {
            title: '🛡️ درع بيلافيتا!',
            message: 'درع التوني خفّى كسر الستريك.'
          });
        } else {
          r1.streak = 0;
          r1.pendingPoints = 0;
          broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        }

        advanceR1Quota(room);
        if (r1.totalQuestionsAnswered < R1_TOTAL_QUESTIONS) {
          dispatchR1Question(room);
        }
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r1_action_bank': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r1 = room.round1;
        const player = findPlayer(room);
        if (!player) return;
        // The Bank decision belongs ONLY to the opposing team.
        if (player.team === r1.activeTeam || player.id === r1.answeringPlayerId) {
          emitError('قرار الخزنة للفريق الخصم فقط — فريق الإجابة ممنوع من البنك.', 'r1_action_bank');
          return;
        }
        const banked = r1.pendingPoints || 0;
        r1.lastDecision = 'bank';
        if (banked > 0) {
          room.teams[r1.activeTeam].bank += banked;
          room.teams[r1.activeTeam].score += banked;
          const answering = findPlayer(room, r1.answeringPlayerId);
          if (answering) answering.scoreContribution = (answering.scoreContribution || 0) + banked;
          r1.history.push({ team: r1.activeTeam, amount: banked, player: answering?.name || '' });
          r1.pendingPoints = 0;
          r1.streak = 0;
          broadcastToRoom('sound_trigger', { sound: 'bank_safe' });
          broadcastToRoom('confetti_trigger', {});
        }
        await persistAndBroadcast(room);
        break;
      }

      case 'r1_action_continue': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r1 = room.round1;
        const player = findPlayer(room);
        if (!player) return;
        if (player.team === r1.activeTeam || player.id === r1.answeringPlayerId) {
          emitError('قرار الاستكمال للفريق الخصم فقط — فريق الإجابة ممنوع من البنك.', 'r1_action_continue');
          return;
        }
        if (!r1.currentQuestion) {
          emitError('مفيش سؤال نشط لاتخاذ قرار الاستكمال.', 'r1_action_continue');
          return;
        }
        r1.lastDecision = 'continue';
        broadcastToRoom('notification', {
          title: 'كمل يا بطل! 🔥',
          message: `${player.name} قرر الاستكمال — النقاط على المحك (${r1.pendingPoints || 0}).`
        });
        await persistAndBroadcast(room);
        break;
      }

      case 'r1_pass_turn': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        if (!isHost(room)) {
          emitError('تبديل الدور متاح للمضيف فقط.', 'r1_pass_turn');
          return;
        }
        const r1 = room.round1;
        if (!r1.currentQuestion || !r1.actionToken || r1.actionToken !== payload.actionToken) {
          emitError('انتهت صلاحية السؤال ده.', 'r1_pass_turn');
          return;
        }
        r1.actionToken = null;
        r1.pendingPoints = 0;
        r1.streak = 0;
        r1.activeTeam = r1.activeTeam === 'team_a' ? 'team_b' : 'team_a';
        const activePlayers = room.players.filter(player => player.team === r1.activeTeam);
        if (activePlayers.length) {
          const index = activePlayers.findIndex(candidate => candidate.id === r1.answeringPlayerId);
          r1.answeringPlayerId = activePlayers[(index + 1) % activePlayers.length].id;
        }
        assignReferee(room, 'round1');
        dispatchR1Question(room);
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r2_award_point': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r2 = room.round2;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round2')) {
          emitError('احتساب نقاط الجولة 2 محصور بالحكم المكلّف.', 'r2_award_point');
          return;
        }
        const team = r2.activeTurnTeam;
        if (payload.team && payload.team !== team) {
          emitError('النقاط تُحتسب للفريق المجيب في الدور الحالي فقط.', 'r2_award_point');
          return;
        }
        if (r2.isComplete || r2.currentWordIndex >= R2_TOTAL_CARDS) {
          emitError('خلصت بطاقات الجولة 2.', 'r2_award_point');
          return;
        }
        if (!r2.actionToken || r2.actionToken !== payload.actionToken) {
          emitError('انتهت صلاحية البطاقة دي.', 'r2_award_point');
          return;
        }
        r2.actionToken = null;
        room.teams[team].score += 500;
        r2.currentWordIndex += 1;

        if (r2.currentWordIndex >= R2_TOTAL_CARDS) {
          r2.isComplete = true;
          r2.currentWord = null;
          r2.isTimerRunning = false;
          broadcastToRoom('sound_trigger', { sound: 'whistle' });
        } else {
          setR2CardRoles(room, { toggleTurn: true });
          dispatchR2Card(room);
        }
        broadcastToRoom('sound_trigger', { sound: 'correct' });
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r2_skip_card': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r2 = room.round2;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round2')) {
          emitError('تخطي البطاقة محصور بالحكم المكلّف.', 'r2_skip_card');
          return;
        }
        if (r2.isComplete || r2.currentWordIndex >= R2_TOTAL_CARDS) {
          emitError('خلصت بطاقات الجولة 2.', 'r2_skip_card');
          return;
        }
        if (!r2.actionToken || r2.actionToken !== payload.actionToken) {
          emitError('انتهت صلاحية البطاقة دي.', 'r2_skip_card');
          return;
        }
        r2.actionToken = null;
        r2.currentWordIndex += 1;

        if (r2.currentWordIndex >= R2_TOTAL_CARDS) {
          r2.isComplete = true;
          r2.currentWord = null;
          r2.isTimerRunning = false;
          broadcastToRoom('sound_trigger', { sound: 'whistle' });
        } else {
          setR2CardRoles(room, { toggleTurn: true });
          dispatchR2Card(room);
        }
        broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r2_foul': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r2 = room.round2;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round2')) {
          emitError('تسجيل المخالفة محصور بالحكم المكلّف.', 'r2_foul');
          return;
        }
        const team = r2.activeTurnTeam;
        if (payload.team && payload.team !== team) {
          emitError('المخالفة تُسجّل على الفريق المجيب في الدور الحالي فقط.', 'r2_foul');
          return;
        }
        if (r2.isComplete || r2.currentWordIndex >= R2_TOTAL_CARDS) {
          emitError('خلصت بطاقات الجولة 2.', 'r2_foul');
          return;
        }
        if (!r2.actionToken || r2.actionToken !== payload.actionToken) {
          emitError('انتهت صلاحية البطاقة دي.', 'r2_foul');
          return;
        }
        r2.actionToken = null;
        r2.fouls[team] = (r2.fouls[team] || 0) + 1;
        room.teams[team].score = Math.max(0, room.teams[team].score - 200);
        r2.activeTurnTeam = team === 'team_a' ? 'team_b' : 'team_a';
        r2.refereePlayerId = getRoundRefereeId(room, 'round2');
        r2.actionToken = `act_${Math.random().toString(36).substring(2, 12)}`;
        broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r2_time_freeze': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r2 = room.round2;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round2')) {
          emitError('تجميد الوقت محصور بالحكم المكلّف.', 'r2_time_freeze');
          return;
        }
        if (r2.isComplete || !r2.currentWord) {
          emitError('مفيش بطاقة شغالة دلوقتي.', 'r2_time_freeze');
          return;
        }
        if (r2.timeFreezeUsed) {
          emitError('تجميد الوقت اتستخدم مرة واحدة في البطاقة دي.', 'r2_time_freeze');
          return;
        }
        r2.timeFreezeUsed = true;
        r2.timer += R2_TIME_FREEZE_SECONDS;
        broadcastToRoom('notification', {
          title: '⏱️ تجميد الوقت',
          message: `اتضاف ${R2_TIME_FREEZE_SECONDS} ثانية لوقت البطاقة.`
        });
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_select_duelists': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        if (room.status !== 'round3') return;
        const r3 = room.round3;
        const player = findPlayer(room);
        if (!player) return;
        if (r3.isComplete || r3.turnIndex >= R3_TOTAL_SHOTS) return;
        if (r3.phase !== 'duelist_selection') {
          emitError('اختيار المبارزين متاح وقت اختيار الثنائيات بس.', 'r3_select_duelists');
          return;
        }

        const defendingTeam = r3.kickerTeam === 'team_a' ? 'team_b' : 'team_a';
        if (payload.kickerId) {
          const candidate = room.players.find(candidatePlayer => candidatePlayer.id === payload.kickerId);
          if (player.team !== r3.kickerTeam || candidate?.team !== r3.kickerTeam) {
            emitError('اختيار المسدد من صلاحيات الفريق الضارب فقط.', 'r3_select_duelists');
            return;
          }
          r3.currentKickerId = payload.kickerId;
        }
        if (payload.goalieId) {
          const candidate = room.players.find(candidatePlayer => candidatePlayer.id === payload.goalieId);
          if (player.team !== defendingTeam || candidate?.team !== defendingTeam) {
            emitError('الحارس لازم يكون من الفريق المدافع.', 'r3_select_duelists');
            return;
          }
          r3.currentGoalieId = payload.goalieId;
        }

        // The neutral referee must never be one of the duelists.
        if ([r3.currentKickerId, r3.currentGoalieId].includes(r3.refereePlayerId)) {
          assignReferee(room, 'round3', { rotate: true });
        } else {
          assignReferee(room, 'round3');
        }
        r3.currentQuestion = null;
        r3.interceptBuzzedBy = null;
        r3.interceptAt = null;
        r3.tieBreakActive = false;
        r3.tieBreakData = null;
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_start_shootout': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r3 = room.round3;
        const player = findPlayer(room);
        if (!player) return;
        const kickingRepresentative = room.players.find(candidatePlayer => candidatePlayer.team === r3.kickerTeam);
        if (!isHost(room) && player.id !== getRoundRefereeId(room, 'round3') && player.id !== kickingRepresentative?.id) {
          emitError('بدء التسديد محصور بممثل الفريق الضارب أو الحكم المكلّف.', 'r3_start_shootout');
          return;
        }
        if (r3.isComplete || r3.turnIndex >= R3_TOTAL_SHOTS) return;
        if (r3.phase !== 'duelist_selection') {
          emitError('التسديد اتبدأ بالفعل للركلة دي.', 'r3_start_shootout');
          return;
        }
        if (!r3.currentKickerId || !r3.currentGoalieId) {
          emitError('اختار المسدد والحارس الأول.', 'r3_start_shootout');
          return;
        }
        if (!dispatchR3Question(room)) {
          emitError('مفيش سؤال متاح للتصنيف ده.', 'r3_start_shootout');
          return;
        }
        r3.phase = 'shootout';
        r3.interceptBuzzedBy = null;
        r3.interceptAt = null;
        r3.shotStartedAt = Date.now();
        r3.endTime = r3.shotStartedAt + (r3.timer || 20) * 1000;
        r3.shotResolved = false;
        r3.tieBreakActive = false;
        r3.tieBreakData = null;
        broadcastToRoom('sound_trigger', { sound: 'whistle' });
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r3_intercept_buzz': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r3 = room.round3;
        if (r3.phase !== 'shootout') {
          emitError('مفيش تسديدة شغالة دلوقتي.', 'r3_intercept_buzz');
          return;
        }
        if (socket.id !== r3.currentGoalieId) {
          emitError('زرار الصد للحارس المدافع فقط.', 'r3_intercept_buzz');
          return;
        }
        if (r3.interceptBuzzedBy) return;
        r3.interceptBuzzedBy = socket.id;
        r3.interceptAt = Date.now();
        broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        broadcastToRoom('notification', {
          title: '🧤 صد!',
          message: 'الحارس ضغط زرار الصد!'
        });
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_submit_answer': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r3 = room.round3;
        if (r3.isComplete || r3.phase !== 'shootout' || !r3.shotStartedAt) {
          emitError('مفيش تسديدة شغالة دلوقتي.', 'r3_submit_answer');
          return;
        }
        if (socket.id !== r3.currentKickerId) {
          emitError('الإجابة من المسدد الحالي فقط.', 'r3_submit_answer');
          return;
        }
        if (r3.tieBreakActive) return;
        if (r3.pendingAnswer) {
          emitError('تم تسجيل إجابتك بالفعل، بانتظار قرار الحكم.', 'r3_submit_answer');
          return;
        }

        const options = r3.currentQuestion?.options || [];
        if (typeof payload.option !== 'string' || !options.includes(payload.option)) {
          emitError('الإجابة لازم تكون من الاختيارات المعتمدة.', 'r3_submit_answer');
          return;
        }

        const answerAt = Date.now();
        // The shooter locks an answer. The single judge decides Goal / Miss;
        // this service never awards the kick automatically.
        r3.pendingAnswer = {
          option: payload.option,
          answerAt,
          answerMs: answerAt - r3.shotStartedAt,
          kickerId: r3.currentKickerId
        };
        broadcastToRoom('notification', {
          title: '🔒 تم تسجيل إجابة المسدد',
          message: 'الحكم الوحيد هو من يعتمد النتيجة الآن: Goal أو Miss.'
        });
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_resolve_tiebreak': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r3 = room.round3;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round3')) {
          emitError('حسم التعادل محصور بالحكم المحايد.', 'r3_resolve_tiebreak');
          return;
        }
        if (!r3.tieBreakActive) return;
        if (!['goal', 'saved', 'missed'].includes(payload.result)) return;
        settleR3Shot(room, payload.result, {
          tieBreak: true,
          answerMs: r3.tieBreakData?.answerMs ?? null,
          interceptMs: r3.tieBreakData?.interceptMs ?? null
        });
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_record_shot': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r3 = room.round3;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round3')) {
          emitError('تسجيل الركلة محصور بالحكم المحايد.', 'r3_record_shot');
          return;
        }
        if (r3.phase !== 'shootout') {
          emitError('مفيش ركلة نشطة ليحكم عليها الآن.', 'r3_record_shot');
          return;
        }
        if (!['goal', 'saved', 'missed'].includes(payload.result)) return;
        settleR3Shot(room, payload.result, {
          tieBreak: !!r3.tieBreakActive,
          answerMs: r3.pendingAnswer?.answerMs ?? null
        });
        await persistAndBroadcast(room);
        break;
      }

      case 'r4_bid': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r4 = room.round4;
        const player = findPlayer(room);
        if (!player) return;
        if (!r4.currentTopic || !r4.topicId) {
          emitError('مفيش موضوع مزاد نشط.', 'r4_bid');
          return;
        }
        if (r4.phase !== 'bidding') {
          emitError('المزايدة خلصت على الموضوع ده.', 'r4_bid');
          return;
        }
        if (payload.topicId && payload.topicId !== r4.topicId) {
          emitError('موضوع المزاد اتغير.', 'r4_bid');
          return;
        }
        if (!R4_BID_INCREMENTS.includes(payload.increment)) {
          emitError('قيمة المزايدة غير صحيحة.', 'r4_bid');
          return;
        }
        if (Number.isInteger(payload.expectedBid) && payload.expectedBid !== r4.highestBid) {
          emitError('تغيّرت أعلى مزايدة — راجع الرقم الحالي.', 'r4_bid');
          return;
        }
        if (r4.highestBidderTeam === player.team) {
          emitError('فريقك صاحب أعلى مزايدة بالفعل.', 'r4_bid');
          return;
        }

        r4.highestBid += payload.increment;
        r4.highestBidderTeam = player.team;
        r4.highestBidderPlayerId = player.id;
        if (r4.refereePlayerId) {
          const referee = room.players.find(candidate => candidate.id === r4.refereePlayerId);
          if (referee?.team === player.team) assignReferee(room, 'round4', { rotate: true });
        }
        broadcastToRoom('sound_trigger', { sound: 'bid' });
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'r4_start_challenge': {
        const room = await currentRoom();
        if (!room || !isCurrentRoom(payload.roomCode)) return;
        const player = findPlayer(room);
        const r4 = room.round4;
        if (!player || r4.phase !== 'challenge' || r4.highestBidderTeam !== player.team || r4.topicId !== payload.topicId || r4.isTimerRunning) return;
        r4.timer = 60;
        r4.endTime = Date.now() + 60000;
        r4.isTimerRunning = true;
        await persistAndBroadcast(room);
        break;
      }

      case 'r4_use_lifeline': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r4 = room.round4;
        const player = findPlayer(room);
        if (!player) return;
        if (!r4.currentTopic || !r4.topicId) {
          emitError('مفيش موضوع مزاد نشط.', 'r4_use_lifeline');
          return;
        }
        if (r4.phase !== 'bidding' && r4.phase !== 'execution') {
          emitError('انتهت مرحلة استخدام وسائل المساعدة.', 'r4_use_lifeline');
          return;
        }
        if (payload.topicId && payload.topicId !== r4.topicId) {
          emitError('موضوع المزاد اتغير.', 'r4_use_lifeline');
          return;
        }
        if (!R4_LIFELINES.includes(payload.lifelineType)) {
          emitError('وسيلة مساعدة غير معروفة.', 'r4_use_lifeline');
          return;
        }
        if (payload.team && payload.team !== player.team) {
          emitError('مينفعش تستخدم وسيلة مساعدة لفريق الخصم.', 'r4_use_lifeline');
          return;
        }
        const team = player.team;
        if (r4.highestBidderTeam !== team) {
          emitError('وسائل المساعدة متاحة لصاحب أعلى مزاد فقط.', 'r4_use_lifeline');
          return;
        }
        if (!r4.usedLifelines) r4.usedLifelines = { team_a: [], team_b: [] };
        if (!r4.usedLifelines[team]) r4.usedLifelines[team] = [];
        if (r4.usedLifelines[team].includes(payload.lifelineType)) {
          emitError('الوسيلة دي اتستخدمت من قبل لفريقك.', 'r4_use_lifeline');
          return;
        }

        const validItems = r4.currentTopic.validItems || [];
        const unrevealed = validItems.filter(item => !r4.itemsNamed.includes(item));
        if (payload.lifelineType === 'rival_hint' && !unrevealed.length) {
          emitError('مفيش إجابات متبقية للتلميح.', 'r4_use_lifeline');
          return;
        }
        if (payload.lifelineType === 'opponent_help' && !unrevealed.length) {
          emitError('مفيش إجابات متبقية يمكن للخصم يساعد فيها.', 'r4_use_lifeline');
          return;
        }

        r4.usedLifelines[team].push(payload.lifelineType);
        if (payload.lifelineType === 'call_friend') {
          r4.timer += R4_CALL_FRIEND_SECONDS;
          broadcastToRoom('sound_trigger', { sound: 'bid' });
          broadcastToRoom('notification', {
            title: `📞 اتصل بصديق (+${R4_CALL_FRIEND_SECONDS} ثانية)`,
            message: `${room.teams[team]?.name || 'الفريق'} استخدم وسيلة اتصل بصديق.`
          });
        } else if (payload.lifelineType === 'rival_hint') {
          broadcastToRoom('sound_trigger', { sound: 'bid' });
          broadcastToRoom('notification', {
            title: '💡 هينت من الخصم!',
            message: `تلميح الخصم يكشف إجابة مؤكدة: "${unrevealed[0]}"`
          });
        } else {
          r4.itemsNamed = [...r4.itemsNamed, unrevealed[0]];
          broadcastToRoom('sound_trigger', { sound: 'correct' });
          broadcastToRoom('notification', {
            title: '🤝 استعين بالخصم!',
            message: `الخصم ساعد بإجابة معتمدة: "${unrevealed[0]}"`
          });
        }
        await persistAndBroadcast(room);
        break;
      }

      case 'r4_toggle_item': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r4 = room.round4;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round4')) {
          emitError('تدقيق إجابات المزاد محصور بالحكم المكلّف.', 'r4_toggle_item');
          return;
        }
        if (!r4.currentTopic || !r4.topicId || payload.topicId !== r4.topicId) {
          emitError('موضوع المزاد اتغير.', 'r4_toggle_item');
          return;
        }
        if (r4.phase === 'resolved') {
          emitError('تم اعتماد نتيجة المزاد بالفعل.', 'r4_toggle_item');
          return;
        }
        const validItems = r4.currentTopic.validItems || [];
        if (typeof payload.item !== 'string' || !validItems.includes(payload.item)) {
          emitError('العنصر ده مش من القائمة المعتمدة.', 'r4_toggle_item');
          return;
        }
        if (r4.itemsNamed.includes(payload.item)) {
          r4.itemsNamed = r4.itemsNamed.filter(item => item !== payload.item);
        } else {
          r4.itemsNamed = [...r4.itemsNamed, payload.item];
          broadcastToRoom('sound_trigger', { sound: 'correct' });
        }
        await persistAndBroadcast(room);
        break;
      }

      case 'r4_resolve_bid': {
        const room = await currentRoom();
        if (!room) return;
        if (!isCurrentRoom(payload.roomCode)) return;
        const r4 = room.round4;
        const player = findPlayer(room);
        if (!player) return;
        if (player.id !== getRoundRefereeId(room, 'round4')) {
          emitError('اعتماد نتيجة المزاد محصور بالحكم المكلّف.', 'r4_resolve_bid');
          return;
        }
        if (!r4.currentTopic || !r4.topicId || payload.topicId !== r4.topicId) {
          emitError('موضوع المزاد اتغير.', 'r4_resolve_bid');
          return;
        }
        if (r4.phase === 'resolved') {
          emitError('تم اعتماد نتيجة المزاد بالفعل.', 'r4_resolve_bid');
          return;
        }
        if (typeof payload.success !== 'boolean') {
          emitError('نتيجة المزاد غير صحيحة.', 'r4_resolve_bid');
          return;
        }
        const winningTeam = r4.highestBidderTeam;
        if (!winningTeam) {
          emitError('مفيش صاحب مزاد معتمد.', 'r4_resolve_bid');
          return;
        }
        if (payload.success && (r4.itemsNamed?.length || 0) < r4.highestBid) {
          emitError(`لم يصل الفريق للرقم المطلوب (${r4.itemsNamed?.length || 0}/${r4.highestBid}).`, 'r4_resolve_bid');
          return;
        }

        r4.phase = 'resolved';
        if (payload.success) {
          const reward = r4.highestBid * 400;
          room.teams[winningTeam].score += reward;
          broadcastToRoom('sound_trigger', { sound: 'goal_roar' });
          broadcastToRoom('confetti_trigger', {});
          broadcastToRoom('notification', {
            title: 'أنا قدها ونص! 🏆',
            message: `${room.teams[winningTeam].name} حقق الرقم المطلوب وكسب ${reward} نقطة!`
          });
        } else {
          broadcastToRoom('sound_trigger', { sound: 'buzzer' });
          broadcastToRoom('notification', {
            title: 'المزاد لم يكتمل',
            message: `${room.teams[winningTeam].name} لم يوفِ بالمزاد.`
          });
        }

        r4.currentTopicIndex += 1;
        if (r4.currentTopicIndex >= R4_TOTAL_TOPICS) {
          r4.currentTopic = null;
          r4.topicId = null;
          broadcastToRoom('sound_trigger', { sound: 'fanfare' });
          broadcastToRoom('confetti_trigger', {});
        } else {
          dispatchR4Topic(room);
          r4.highestBid = r4.currentTopic?.minBid || 3;
          r4.timer = 60;
          r4.itemsNamed = [];
          r4.phase = 'bidding';
          r4.usedLifelines = { team_a: [], team_b: [] };
          r4.highestBidderTeam = null;
          r4.highestBidderPlayerId = null;
          assignReferee(room, 'round4');
        }
        await persistAndBroadcast(room);
        publishSecrets(room);
        break;
      }

      case 'send_chat': {
        if (!cachedRoomState) return;
        const now = Date.now();
        if (now - lastChatAt < CHAT_RATE_LIMIT_MS) return;
        lastChatAt = now;
        const text = sanitizeChatText(payload.text);
        if (!text) return;
        const chatItem = {
          id: `chat_${Math.random().toString(36).substring(2, 9)}`,
          sender: localPlayer?.name || 'مشارك',
          text,
          team: localPlayer?.team || 'team_a',
          isTaunt: Boolean(payload.isTaunt),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        };
        broadcastToRoom('chat_received', chatItem);
        break;
      }

      case 'judge_secret_request': {
        // The active referee asks for the secret of the current question.
        const room = cachedRoomState;
        if (!room) return;
        const secret = localSecrets[payload?.roundKey];
        if (secret) sendJudgeSecret(room, payload.roundKey, secret);
        break;
      }

      case 'latency_ping': {
        trigger('latency_pong', { start: payload?.start });
        break;
      }

      default:
        console.warn(`[SupabaseSocket] Unhandled event: ${event}`);
    }
  }

  // Trigger immediate connect event
  setTimeout(() => {
    trigger('connect');
  }, 10);

  return socket;
}

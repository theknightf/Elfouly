/**
 * src/services/supabaseMultiplayerService.js
 *
 * Supabase Realtime & Database Multiplayer Provider for Quiz Arena.
 * Emulates the Socket.io interface (.on, .off, .emit) using:
 * - Supabase Realtime Channels (Broadcast + Presence)
 * - PostgreSQL 'public.rooms' for persistent, authoritative game state
 * - Local question engine with Post-2010 football constraints & deduplication
 */

import { supabase as defaultSupabase, createSupabaseClient } from './supabaseClient';
import { CHARACTERS } from '../data/characters';
import { TOURNAMENT_STRUCTURE } from '../data/tournamentStructure';
import { PENALTY_CATEGORIES, AUCTION_TOPICS, PASSWORD_WORDS } from '../data/questions';
import {
  drawLocalQuestion,
  drawLocalR1Question,
  buildLocalR1TurnPlan,
  drawLocalCategoryQuestion
} from '../utils/localQuestionEngine';

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_PLAYERS = 4;
const TEAM_PLAYERS = 2;

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
      actionToken: null,
      timer: 30,
      isTimerRunning: false,
      history: []
    },
    round2: {
      currentWordIndex: 0,
      totalQuestions: 5,
      currentWord: null,
      activeTurnTeam: 'team_a',
      activeClueGiverA: null,
      activeClueGiverB: null,
      refereePlayerId: null,
      isComplete: false,
      timeFreezeUsed: false,
      timer: 45,
      isTimerRunning: false,
      actionToken: null,
      fouls: { team_a: 0, team_b: 0 }
    },
    round3: {
      turnIndex: 0,
      totalShots: 10,
      currentKickerId: null,
      currentGoalieId: null,
      kickerTeam: 'team_a',
      currentCategory: PENALTY_CATEGORIES[0],
      phase: 'duelist_selection',
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
    round4: {
      currentTopicIndex: 0,
      currentTopic: AUCTION_TOPICS[0],
      topicId: 'topic-0',
      highestBid: 3,
      highestBidderTeam: null,
      highestBidderPlayerId: null,
      timer: 60,
      isTimerRunning: false,
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
  let currentRoomCode = null;
  let localPlayer = null;
  let cachedRoomState = null;
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
      handleClientAction(event, payload);
      return socket;
    },

    disconnect() {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      socket.connected = false;
      trigger('disconnect', 'client_closed');
    }
  };

  function trigger(event, data) {
    const handlers = listeners.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(data);
        } catch (err) {
          console.error(`[SupabaseSocket] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  function sanitizeForViewer(room, viewerId) {
    if (!room) return null;
    const clone = JSON.parse(JSON.stringify(room));
    clone.viewerId = viewerId;

    // Redact secret words in Round 2 for non-clue-givers
    if (clone.status === 'round2' && clone.round2?.currentWord) {
      const r2 = clone.round2;
      const isClueGiver = viewerId === r2.activeClueGiverA || viewerId === r2.activeClueGiverB;
      if (!isClueGiver) {
        clone.round2.currentWord = {
          target: '🔒 [كلمة سرية]',
          forbidden: ['🔒 ممنوع', '🔒 ممنوع', '🔒 ممنوع', '🔒 ممنوع'],
          category: r2.currentWord.category || 'عام',
          redacted: true
        };
      }
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

  async function persistAndBroadcast(newRoomState) {
    cachedRoomState = newRoomState;
    try {
      await supabase
        .from('rooms')
        .update({
          status: newRoomState.status,
          players: newRoomState.players,
          teams: newRoomState.teams,
          state: {
            round1: newRoomState.round1,
            round2: newRoomState.round2,
            round3: newRoomState.round3,
            round4: newRoomState.round4,
            countdown: newRoomState.countdown,
            messages: newRoomState.messages
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
        payload: newRoomState
      });
    }
    trigger('room_state_updated', sanitizeForViewer(newRoomState, socketId));
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
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        if (event === 'room_state_updated') {
          cachedRoomState = payload;
          trigger('room_state_updated', sanitizeForViewer(payload, socketId));
        } else {
          trigger(event, payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = Object.keys(state);
        if (cachedRoomState && Array.isArray(cachedRoomState.players)) {
          let changed = false;
          cachedRoomState.players.forEach(p => {
            const isOnline = activeIds.includes(p.id) || p.isBot;
            if (p.connected !== isOnline) {
              p.connected = isOnline;
              changed = true;
            }
          });
          if (changed) {
            trigger('room_state_updated', sanitizeForViewer(cachedRoomState, socketId));
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (cachedRoomState && Array.isArray(cachedRoomState.players)) {
          const leftIds = leftPresences.map(p => p.playerId || p.key);
          cachedRoomState.players.forEach(p => {
            if (leftIds.includes(p.id) && !p.isBot) {
              p.connected = false;
            }
          });
          trigger('room_state_updated', sanitizeForViewer(cachedRoomState, socketId));
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
  }

  // Client actions
  async function handleClientAction(event, payload) {
    switch (event) {
      case 'create_room': {
        const { playerName, characterId } = payload;
        const cleanName = sanitizeName(playerName) || 'كابتن الساحة';
        const character = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
        const roomCode = generateRoomCode();
        const playerToken = 'tok_' + Math.random().toString(36).substring(2, 15);

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
          playerToken
        };

        const initial = createInitialState(roomCode, socketId);
        initial.players.push(player);
        localPlayer = player;
        cachedRoomState = initial;

        setupChannel(roomCode, player);

        try {
          const { error: insertErr } = await supabase.from('rooms').insert({
            room_id: roomCode,
            host_id: socketId,
            status: 'lobby',
            players: initial.players,
            teams: initial.teams,
            state: {
              round1: initial.round1,
              round2: initial.round2,
              round3: initial.round3,
              round4: initial.round4
            }
          });
          if (insertErr) {
            console.error('[SupabaseSocket] Error inserting room into DB:', insertErr);
          }
        } catch (err) {
          console.error('[SupabaseSocket] Error creating room in DB:', err);
        }

        trigger('room_created', {
          roomCode,
          playerToken,
          player,
          room: sanitizeForViewer(initial, socketId)
        });
        break;
      }

      case 'join_room': {
        const { roomCode, playerName, characterId, teamPreference } = payload;
        const cleanCode = normalizeRoomCode(roomCode);
        const cleanName = sanitizeName(playerName) || 'لاعب';

        const { data: row, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_id', cleanCode)
          .maybeSingle();

        if (error || !row) {
          trigger('action_error', {
            message: 'كود الغرفة غير موجود يا بطل! اتأكد من الكود — Room not found.',
            field: 'roomCode',
            action: 'join_room'
          });
          return;
        }

        const room = {
          ...createInitialState(cleanCode, row.host_id),
          status: row.status,
          players: row.players || [],
          teams: row.teams || createInitialState(cleanCode, row.host_id).teams,
          ...(row.state || {})
        };

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

        // Validate character duplication
        const takenChar = room.players.some(p => p.character?.id === characterId);
        const availableChar = CHARACTERS.find(c => !room.players.some(p => p.character?.id === c.id)) || CHARACTERS[0];
        const character = takenChar ? availableChar : (CHARACTERS.find(c => c.id === characterId) || availableChar);

        // Assign team (2v2 split)
        const teamACount = room.players.filter(p => p.team === 'team_a').length;
        const teamBCount = room.players.filter(p => p.team === 'team_b').length;
        let assignedTeam = teamPreference === 'team_b' ? 'team_b' : 'team_a';
        if (assignedTeam === 'team_a' && teamACount >= TEAM_PLAYERS) assignedTeam = 'team_b';
        else if (assignedTeam === 'team_b' && teamBCount >= TEAM_PLAYERS) assignedTeam = 'team_a';

        const playerToken = 'tok_' + Math.random().toString(36).substring(2, 15);
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
          playerToken
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

        const { data: row, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_id', cleanCode)
          .maybeSingle();

        if (error || !row) {
          trigger('rejoin_failed', { message: 'الغرفة دي خلصت، اعمل غرفة جديدة' });
          trigger('error_message', 'الغرفة دي خلصت، اعمل غرفة جديدة');
          return;
        }

        const room = {
          ...createInitialState(cleanCode, row.host_id),
          status: row.status,
          players: row.players || [],
          teams: row.teams || createInitialState(cleanCode, row.host_id).teams,
          ...(row.state || {})
        };

        const player = room.players.find(p => p.playerToken === playerToken);
        if (!player) {
          trigger('rejoin_failed', { message: 'جلسة الاستعادة مش صالحة! ادخل بكود الغرفة من جديد.' });
          trigger('error_message', 'جلسة الاستعادة مش صالحة! ادخل بكود الغرفة من جديد.');
          return;
        }

        player.id = socketId;
        player.connected = true;
        player.lastSeen = Date.now();
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
        const { roomCode, characterId, team, playerName } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const p = room.players.find(player => player.id === socketId);
        if (p) {
          if (characterId) {
            const char = CHARACTERS.find(c => c.id === characterId);
            if (char) p.character = char;
          }
          if (team) p.team = team;
          if (playerName) p.name = sanitizeName(playerName);
          localPlayer = p;
          await persistAndBroadcast(room);
          trigger('profile_updated', { player: p });
        }
        break;
      }

      case 'add_demo_player': {
        const cleanCode = normalizeRoomCode(payload.roomCode || currentRoomCode);
        const { data: row } = await supabase.from('rooms').select('*').eq('room_id', cleanCode).maybeSingle();
        if (!row) return;
        const room = {
          ...createInitialState(cleanCode, row.host_id),
          status: row.status,
          players: row.players || [],
          teams: row.teams || createInitialState(cleanCode, row.host_id).teams,
          ...(row.state || {})
        };
        if (room.players.length >= MAX_PLAYERS) return;

        const availableChars = CHARACTERS.filter(c => !room.players.some(p => p.character?.id === c.id));
        const nextChar = availableChars[0] || CHARACTERS[room.players.length % CHARACTERS.length];
        const teamACount = room.players.filter(p => p.team === 'team_a').length;
        const teamBCount = room.players.filter(p => p.team === 'team_b').length;
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
        broadcastToRoom('notification', {
          title: 'انضمام لاعب 🎮',
          message: `انضم ${botPlayer.name} إلى الساحة في ${assignedTeam === 'team_a' ? 'فريق الحيتان' : 'فريق الوحوش'}`
        });
        break;
      }

      case 'start_match_countdown': {
        const cleanCode = normalizeRoomCode(payload.roomCode || currentRoomCode);
        const { data: row } = await supabase.from('rooms').select('*').eq('room_id', cleanCode).maybeSingle();
        if (!row) return;
        const room = {
          ...createInitialState(cleanCode, row.host_id),
          status: row.status,
          players: row.players || [],
          teams: row.teams || createInitialState(cleanCode, row.host_id).teams,
          ...(row.state || {})
        };
        cachedRoomState = room;
        if (room.hostId !== socketId && !localPlayer?.isHost) return;

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

          // Initialize Round 1 questions
          const teamAPlayers = room.players.filter(p => p.team === 'team_a');
          const teamBPlayers = room.players.filter(p => p.team === 'team_b');
          const answeringPlayer = teamAPlayers[0] || room.players[0];
          const readerPlayer = teamBPlayers[0] || room.players[1] || room.players[0];

          room.round1.answeringPlayerId = answeringPlayer.id;
          room.round1.readerPlayerId = readerPlayer.id;
          room.round1.activeTeam = 'team_a';
          room.round1.turnPlan = buildLocalR1TurnPlan(answeringPlayer.character?.id);
          room.round1.currentQuestion = drawLocalR1Question({
            roomId: room.code,
            mode: 'one_two_bank',
            slotType: 'specialty',
            characterId: answeringPlayer.character?.id
          });
          room.round1.actionToken = 'act_' + Math.random().toString(36).substring(2, 9);
          room.round1.isTimerRunning = true;

          await persistAndBroadcast(room);
        }, 3000);
        break;
      }

      case 'change_round': {
        const { targetRound } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        room.status = targetRound;

        if (targetRound === 'round2') {
          room.round2.currentWordIndex = 0;
          room.round2.activeTurnTeam = 'team_a';
          const teamA = room.players.filter(p => p.team === 'team_a');
          const teamB = room.players.filter(p => p.team === 'team_b');
          room.round2.activeClueGiverA = teamA[0]?.id;
          room.round2.activeClueGiverB = teamB[0]?.id;
          room.round2.refereePlayerId = teamB[0]?.id;
          room.round2.currentWord = drawLocalQuestion({
            roomId: room.code,
            mode: 'edini_fi_seri',
            slotType: 'random'
          }) || {
            target: PASSWORD_WORDS[0].word,
            forbidden: PASSWORD_WORDS[0].forbidden,
            category: 'سينما ومسلسلات'
          };
          room.round2.actionToken = 'act_' + Math.random().toString(36).substring(2, 9);
        } else if (targetRound === 'round3') {
          room.round3.turnIndex = 0;
          room.round3.kickerTeam = 'team_a';
          const teamA = room.players.filter(p => p.team === 'team_a');
          const teamB = room.players.filter(p => p.team === 'team_b');
          room.round3.currentKickerId = teamA[0]?.id;
          room.round3.currentGoalieId = teamB[0]?.id;
          room.round3.currentCategory = PENALTY_CATEGORIES[0];
          room.round3.phase = 'duelist_selection';
          room.round3.shotsHistory = [];
        } else if (targetRound === 'round4') {
          room.round4.currentTopicIndex = 0;
          room.round4.currentTopic = AUCTION_TOPICS[0];
          room.round4.highestBid = 3;
          room.round4.highestBidderTeam = null;
          room.round4.phase = 'bidding';
        }

        await persistAndBroadcast(room);
        break;
      }

      case 'r1_action_score': {
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const r1 = room.round1;
        const nextStreak = Math.min(r1.streak + 1, 10);
        r1.streak = nextStreak;
        r1.pendingPoints = r1.streakLadder[nextStreak] || 0;
        r1.subBatchQuestionsAnswered = (r1.subBatchQuestionsAnswered || 0) + 1;

        r1.currentQuestion = drawLocalR1Question({
          roomId: room.code,
          mode: 'one_two_bank',
          slotType: 'random'
        });
        r1.actionToken = 'act_' + Math.random().toString(36).substring(2, 9);

        broadcastToRoom('sound_trigger', { sound: 'correct' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r1_action_bank': {
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const r1 = room.round1;
        const team = r1.activeTeam;
        if (room.teams[team]) {
          room.teams[team].score += r1.pendingPoints;
          room.teams[team].bank += r1.pendingPoints;
        }
        r1.pendingPoints = 0;
        r1.streak = 0;

        broadcastToRoom('sound_trigger', { sound: 'bank' });
        broadcastToRoom('confetti_trigger', {});
        await persistAndBroadcast(room);
        break;
      }

      case 'r1_action_break': {
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const r1 = room.round1;
        r1.streak = 0;
        r1.pendingPoints = 0;
        r1.subBatchQuestionsAnswered = (r1.subBatchQuestionsAnswered || 0) + 1;

        r1.currentQuestion = drawLocalR1Question({
          roomId: room.code,
          mode: 'one_two_bank',
          slotType: 'random'
        });
        r1.actionToken = 'act_' + Math.random().toString(36).substring(2, 9);

        broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r2_award_point': {
        const { team } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const r2 = room.round2;
        if (room.teams[team]) {
          room.teams[team].score += 500;
        }
        r2.currentWordIndex = (r2.currentWordIndex || 0) + 1;
        if (r2.currentWordIndex >= 5) {
          r2.isComplete = true;
          broadcastToRoom('sound_trigger', { sound: 'whistle' });
        } else {
          r2.activeTurnTeam = r2.activeTurnTeam === 'team_a' ? 'team_b' : 'team_a';
          r2.refereePlayerId = r2.activeTurnTeam === 'team_a' ? r2.activeClueGiverB : r2.activeClueGiverA;
          r2.currentWord = drawLocalQuestion({
            roomId: room.code,
            mode: 'edini_fi_seri',
            slotType: 'random'
          }) || PASSWORD_WORDS[r2.currentWordIndex % PASSWORD_WORDS.length];
        }
        r2.actionToken = 'act_' + Math.random().toString(36).substring(2, 9);

        broadcastToRoom('sound_trigger', { sound: 'correct' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r2_skip_card': {
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const r2 = room.round2;
        r2.currentWordIndex = (r2.currentWordIndex || 0) + 1;
        if (r2.currentWordIndex >= 5) {
          r2.isComplete = true;
        } else {
          r2.activeTurnTeam = r2.activeTurnTeam === 'team_a' ? 'team_b' : 'team_a';
          r2.refereePlayerId = r2.activeTurnTeam === 'team_a' ? r2.activeClueGiverB : r2.activeClueGiverA;
          r2.currentWord = drawLocalQuestion({
            roomId: room.code,
            mode: 'edini_fi_seri',
            slotType: 'random'
          }) || PASSWORD_WORDS[r2.currentWordIndex % PASSWORD_WORDS.length];
        }
        r2.actionToken = 'act_' + Math.random().toString(36).substring(2, 9);

        broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r2_foul': {
        const { team } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const r2 = room.round2;
        r2.fouls[team] = (r2.fouls[team] || 0) + 1;
        if (room.teams[team]) {
          room.teams[team].score = Math.max(0, room.teams[team].score - 200);
        }
        broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_select_duelists': {
        const { kickerId, goalieId } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        room.round3.currentKickerId = kickerId;
        room.round3.currentGoalieId = goalieId;
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_start_shootout': {
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        room.round3.phase = 'shootout';
        room.round3.currentQuestion = drawLocalCategoryQuestion(
          'hat_fi_qoraybi',
          room.round3.currentCategory,
          room.code
        );
        room.round3.shotStartedAt = Date.now();
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_intercept_buzz': {
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        room.round3.interceptBuzzedBy = socketId;
        room.round3.interceptAt = Date.now();
        broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r3_record_shot': {
        const { result } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const r3 = room.round3;
        r3.shotsHistory.push({
          shotIndex: r3.turnIndex,
          kickerTeam: r3.kickerTeam,
          result
        });
        if (result === 'goal' && room.teams[r3.kickerTeam]) {
          room.teams[r3.kickerTeam].score += 1000;
          room.teams[r3.kickerTeam].penaltyScore = (room.teams[r3.kickerTeam].penaltyScore || 0) + 1;
        }
        r3.turnIndex += 1;
        r3.kickerTeam = r3.kickerTeam === 'team_a' ? 'team_b' : 'team_a';
        r3.phase = 'duelist_selection';
        r3.currentCategory = PENALTY_CATEGORIES[r3.turnIndex % PENALTY_CATEGORIES.length];
        r3.currentQuestion = null;
        r3.interceptBuzzedBy = null;

        if (r3.turnIndex >= r3.totalShots) {
          r3.isComplete = true;
          broadcastToRoom('sound_trigger', { sound: 'whistle' });
        } else {
          broadcastToRoom('sound_trigger', { sound: result === 'goal' ? 'correct' : 'buzzer' });
        }
        await persistAndBroadcast(room);
        break;
      }

      case 'r4_bid': {
        const { amount } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        room.round4.highestBid += amount;
        room.round4.highestBidderPlayerId = socketId;
        room.round4.highestBidderTeam = localPlayer?.team || 'team_a';
        broadcastToRoom('sound_trigger', { sound: 'gavel' });
        await persistAndBroadcast(room);
        break;
      }

      case 'r4_toggle_item': {
        const { item } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const list = room.round4.itemsNamed || [];
        if (list.includes(item)) {
          room.round4.itemsNamed = list.filter(i => i !== item);
        } else {
          room.round4.itemsNamed = [...list, item];
          broadcastToRoom('sound_trigger', { sound: 'correct' });
        }
        await persistAndBroadcast(room);
        break;
      }

      case 'r4_resolve_bid': {
        const { success } = payload;
        if (!cachedRoomState) return;
        const room = cachedRoomState;
        const team = room.round4.highestBidderTeam;
        if (success && team && room.teams[team]) {
          const awarded = room.round4.highestBid * 400;
          room.teams[team].score += awarded;
          broadcastToRoom('sound_trigger', { sound: 'correct' });
          broadcastToRoom('confetti_trigger', {});
        } else {
          broadcastToRoom('sound_trigger', { sound: 'buzzer' });
        }
        room.round4.phase = 'resolved';
        await persistAndBroadcast(room);
        break;
      }

      case 'send_chat': {
        const { text, isTaunt } = payload;
        const chatItem = {
          id: 'chat_' + Math.random().toString(36).substring(2, 9),
          sender: localPlayer?.name || 'مشارك',
          text,
          team: localPlayer?.team || 'team_a',
          isTaunt: Boolean(isTaunt),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        };
        broadcastToRoom('chat_received', chatItem);
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

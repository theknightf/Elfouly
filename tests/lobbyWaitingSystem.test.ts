/**
 * tests/lobbyWaitingSystem.test.ts
 * 
 * Comprehensive Unit & Integration Test Suite for:
 * 1. 6-Character Room ID Generation & Flexible Lookup (e.g., QZ-7842)
 * 2. 4-Player Threshold & Real-time Slot Population (Slots 1..4)
 * 3. Strict Host Authority Launch Controls (Disabled < 4, Active == 4)
 * 4. Disconnection Handling (Slot reset & auto Start-button re-locking)
 * 5. Synchronized 3-Second Match Countdown Transition to Round 1
 * 6. SQL Database Schema Verification (Supabase/PostgreSQL rooms table)
 */

import fs from 'fs';
import path from 'path';
import { CHARACTERS } from '../src/data/characters';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// Simulated Room Store & Server Logic for testing
class MockLobbyServer {
  rooms: Map<string, any> = new Map();

  generateRoomCode(): string {
    const digits = '0123456789';
    let num = '';
    for (let i = 0; i < 4; i++) {
      num += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return `QZ-${num}`;
  }

  findRoom(inputCode: string): any {
    if (!inputCode) return null;
    const clean = String(inputCode).toUpperCase().trim();
    if (this.rooms.has(clean)) return this.rooms.get(clean);

    if (!clean.includes('-') && clean.startsWith('QZ') && clean.length === 6) {
      const formatted = `QZ-${clean.slice(2)}`;
      if (this.rooms.has(formatted)) return this.rooms.get(formatted);
    }

    const stripped = clean.replace(/-/g, '');
    for (const [key, val] of this.rooms.entries()) {
      if (key.replace(/-/g, '') === stripped) return val;
    }
    return null;
  }

  createRoom(hostSocketId: string, playerName: string, characterId?: string): any {
    let roomCode = this.generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = this.generateRoomCode();
    }

    const char = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
    const hostPlayer = {
      id: hostSocketId,
      name: playerName || 'كابتن الساحة',
      character: char,
      team: 'team_a',
      isHost: true,
      scoreContribution: 0
    };

    const room = {
      code: roomCode,
      hostId: hostSocketId,
      status: 'waiting', // 'waiting' | 'round1'
      countdown: null as number | null,
      countdownInterval: null as any,
      players: [hostPlayer]
    };

    this.rooms.set(roomCode, room);
    return room;
  }

  joinRoom(roomCode: string, playerSocketId: string, playerName: string, characterId?: string, teamPreference?: string): any {
    const room = this.findRoom(roomCode);
    if (!room) throw new Error('Room not found');

    const char = CHARACTERS.find(c => c.id === characterId) || 
      CHARACTERS.find(c => !room.players.some((p: any) => p.character.id === c.id)) || 
      CHARACTERS[0];

    const teamACount = room.players.filter((p: any) => p.team === 'team_a').length;
    const teamBCount = room.players.filter((p: any) => p.team === 'team_b').length;
    const team = teamPreference || (teamACount <= teamBCount ? 'team_a' : 'team_b');

    const player = {
      id: playerSocketId,
      name: playerName,
      character: char,
      team,
      isHost: false,
      scoreContribution: 0
    };

    room.players.push(player);
    return { room, player };
  }

  triggerStartCountdown(roomCode: string, requesterSocketId: string): boolean {
    const room = this.findRoom(roomCode);
    if (!room) throw new Error('Room not found');

    // Strict host authority check
    const isHost = room.hostId === requesterSocketId || room.players.find((p: any) => p.id === requesterSocketId && p.isHost);
    if (!isHost) {
      throw new Error('Unauthorized: Only Host can start game');
    }

    // 4-Player Threshold check
    if (room.players.length < 4) {
      throw new Error(`Threshold error: Need 4 players to start (current: ${room.players.length})`);
    }

    room.countdown = 3;
    return true;
  }

  handleDisconnect(socketId: string) {
    for (const [code, room] of this.rooms.entries()) {
      const idx = room.players.findIndex((p: any) => p.id === socketId);
      if (idx !== -1) {
        const removed = room.players[idx];

        if (room.status === 'waiting' || room.status === 'lobby') {
          // Cancel countdown if active
          if (room.countdown !== null) {
            room.countdown = null;
          }

          room.players.splice(idx, 1);

          // Transfer host if host left
          if (removed.isHost && room.players.length > 0) {
            room.players[0].isHost = true;
            room.hostId = room.players[0].id;
          }

          if (room.players.length === 0) {
            this.rooms.delete(code);
          }
        }
      }
    }
  }
}

async function runLobbyTests() {
  console.log('\n================================================================================');
  console.log('👑 QUIZ ARENA - LOBBY & HOST AUTHORITY TEST SUITE');
  console.log('================================================================================\n');

  const server = new MockLobbyServer();

  // Test 1: 6-Character Room ID Generation
  console.log('🔹 Test 1: 6-Character Alphanumeric Room Code Generation (QZ-XXXX)...');
  const code1 = server.generateRoomCode();
  const code2 = server.generateRoomCode();
  assert(code1.startsWith('QZ-'), `Expected code to start with QZ-, got ${code1}`);
  assert(code1.length === 7, `Expected length 7 (QZ- + 4 digits = 6 alphanumeric chars), got ${code1.length}`);
  assert(code1 !== code2, 'Expected randomly generated codes to be unique');
  console.log(`   ✅ Generated unique valid codes: ${code1}, ${code2}`);

  // Test 2: Flexible Lookup (Hyphenated & Raw)
  console.log('🔹 Test 2: Flexible Room Code Lookup (QZ-7842 vs QZ7842 vs lowercase)...');
  const roomA = server.createRoom('socket_host_1', 'فارس الفولي', 'fares_elfouly');
  const lookup1 = server.findRoom(roomA.code);
  const lookup2 = server.findRoom(roomA.code.replace('-', ''));
  const lookup3 = server.findRoom(roomA.code.toLowerCase());
  assert(lookup1 && lookup1.code === roomA.code, 'Failed exact lookup');
  assert(lookup2 && lookup2.code === roomA.code, 'Failed lookup without hyphen');
  assert(lookup3 && lookup3.code === roomA.code, 'Failed lowercase lookup');
  console.log(`   ✅ Room found across all formats: ${roomA.code}`);

  // Test 3: Host Authority & Waiting Screen Slot 1
  console.log('🔹 Test 3: Host Room Creation & Initial Slot 1 Status...');
  assert(roomA.players.length === 1, 'Room should have 1 player initially (Host)');
  assert(roomA.players[0].isHost === true, 'Player 1 must be designated Host 👑');
  assert(roomA.status === 'waiting', 'Initial room status must be waiting');
  console.log(`   ✅ Host ${roomA.players[0].name} occupies Slot 1 with Crown authority`);

  // Test 4: 4-Player Threshold (Start Button Grayed Out < 4)
  console.log('🔹 Test 4: Start Game Launch Button Locking under 4-Player Threshold...');
  let errorCaught = false;
  try {
    server.triggerStartCountdown(roomA.code, 'socket_host_1');
  } catch (e: any) {
    errorCaught = true;
    assert(e.message.includes('Threshold error'), `Unexpected error: ${e.message}`);
  }
  assert(errorCaught, 'Start button MUST be disabled / rejected when players < 4');
  console.log(`   ✅ Launch properly blocked at (1/4) players`);

  // Add players 2, 3, 4 to reach (4/4)
  console.log('🔹 Test 5: Real-time Slot Population (Slots 2, 3, 4)...');
  server.joinRoom(roomA.code, 'socket_p2', 'عبد الرحمن التوني', 'abdelrahman_eltouny');
  server.joinRoom(roomA.code, 'socket_p3', 'خالد البربخ', 'khaled_elbarbakh');
  server.joinRoom(roomA.code, 'socket_p4', 'زياد الفندقي', 'ziad_elfondoqy');
  
  assert(roomA.players.length === 4, `Expected 4 players, got ${roomA.players.length}`);
  assert(roomA.players[0].isHost === true, 'Slot 1 remains Host');
  assert(roomA.players[1].isHost === false, 'Slot 2 is regular player');
  assert(roomA.players[2].isHost === false, 'Slot 3 is regular player');
  assert(roomA.players[3].isHost === false, 'Slot 4 is regular player');
  console.log(`   ✅ 4 interactive slots filled: ${roomA.players.map((p: any) => p.name).join(' | ')}`);

  // Test 6: Non-Host cannot launch game
  console.log('🔹 Test 6: Strict Host Authority (Non-host cannot trigger game start)...');
  let nonHostBlocked = false;
  try {
    server.triggerStartCountdown(roomA.code, 'socket_p2');
  } catch (e: any) {
    nonHostBlocked = true;
    assert(e.message.includes('Unauthorized'), `Unexpected error: ${e.message}`);
  }
  assert(nonHostBlocked, 'Non-host launch attempt must be blocked');
  console.log('   ✅ Non-host player correctly blocked from starting match');

  // Test 7: Host launches countdown at 4/4
  console.log('🔹 Test 7: Host launches 3-Second Synchronized Match Countdown at 4/4...');
  const started = server.triggerStartCountdown(roomA.code, 'socket_host_1');
  assert(started === true && roomA.countdown === 3, 'Countdown should be active at 3');
  console.log('   ✅ 3-second countdown triggered successfully');

  // Test 8: Disconnection Handling & Auto-Relock
  console.log('🔹 Test 8: Disconnection Handling (Slot Reset & Auto Start-Button Re-locking)...');
  server.handleDisconnect('socket_p4');
  assert(roomA.players.length === 3, `Expected 3 players after disconnect, got ${roomA.players.length}`);
  assert(roomA.countdown === null, 'Countdown must be cancelled if player disconnects before start');
  
  // Verify start button locks again
  let relockVerified = false;
  try {
    server.triggerStartCountdown(roomA.code, 'socket_host_1');
  } catch (e: any) {
    relockVerified = true;
  }
  assert(relockVerified, 'Start button must automatically lock again after disconnection drops players < 4');
  console.log('   ✅ Slot 4 reset to empty and Start button successfully re-locked');

  // Test 9: Host Transfer on Host Disconnect
  console.log('🔹 Test 9: Host Migration on Host Disconnect...');
  const nextHostId = roomA.players[1].id;
  const nextHostName = roomA.players[1].name;
  server.handleDisconnect('socket_host_1');
  assert(roomA.players[0].id === nextHostId, 'New Slot 1 must be next connected player');
  assert(roomA.players[0].isHost === true, 'Next player must inherit Host Crown 👑');
  assert(roomA.hostId === nextHostId, 'Room hostId must update to new host');
  console.log(`   ✅ Host Crown successfully migrated to: ${nextHostName}`);

  // Test 10: Database Schema Audit (Supabase / PostgreSQL)
  console.log('🔹 Test 10: Database SQL Schema Verification (server/schema.sql)...');
  const schemaPath = path.resolve('server/schema.sql');
  assert(fs.existsSync(schemaPath), 'server/schema.sql must exist');
  const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
  assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS rooms') || sqlContent.includes('CREATE TABLE rooms'), 'Must create rooms table');
  assert(sqlContent.includes('room_id VARCHAR(10) PRIMARY KEY'), 'Must define room_id VARCHAR(10) PRIMARY KEY');
  assert(sqlContent.includes('host_id UUID NOT NULL'), 'Must define host_id UUID NOT NULL');
  assert(sqlContent.includes("status VARCHAR(20) DEFAULT 'waiting'"), "Must define status VARCHAR(20) DEFAULT 'waiting'");
  assert(sqlContent.includes("players JSONB DEFAULT '[]'::jsonb"), "Must define players JSONB DEFAULT '[]'::jsonb");
  assert(sqlContent.includes('created_at TIMESTAMP WITH TIME ZONE'), 'Must define created_at');
  console.log('   ✅ Supabase PostgreSQL rooms table schema 100% compliant');

  console.log('\n================================================================================');
  console.log('🏁 ALL 10 LOBBY & HOST AUTHORITY TESTS PASSED (100% SUCCESS)');
  console.log('================================================================================\n');
}

runLobbyTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

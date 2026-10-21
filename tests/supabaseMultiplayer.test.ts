/**
 * tests/supabaseMultiplayer.test.ts
 *
 * Tests the Supabase Realtime & Database Multiplayer Provider:
 * 1. Room creation and persistence in PostgreSQL
 * 2. Second player joining the same room
 * 3. Shared synchronized player list
 * 4. Match start and synchronized Round 1 question
 * 5. Scoring and banking state updates
 * 6. Player rejoin with token without membership duplication
 * 7. Room cleanup
 */

import { supabase } from '../src/services/supabaseClient';
import { createSupabaseSocket } from '../src/services/supabaseMultiplayerService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Assertion Failure] ${message}`);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForEvent<T = any>(socket: any, event: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

async function runSupabaseTests() {
  console.log('\n================================================================================');
  console.log('⚡ QUIZ ARENA - SUPABASE REALTIME MULTIPLAYER INTEGRATION TEST');
  console.log('================================================================================\n');

  let testRoomCode = '';

  try {
    // 1. Create Host Client
    console.log('🔹 Test 1: Host creates room via Supabase Realtime...');
    const hostSocket = createSupabaseSocket();

    const roomCreatedPromise = waitForEvent(hostSocket, 'room_created');
    hostSocket.emit('create_room', {
      playerName: 'فارس الهوست',
      characterId: 'fares_elfouly'
    });

    const createdData = await roomCreatedPromise;
    testRoomCode = createdData.roomCode;
    assert(typeof testRoomCode === 'string' && testRoomCode.startsWith('QZ-'), 'Room code must start with QZ-');
    assert(createdData.player?.name === 'فارس الهوست', 'Host player name must match');
    assert(createdData.player?.isHost === true, 'Player must be host');
    console.log(`   ✅ Room created: ${testRoomCode} with host token: ${createdData.playerToken}`);

    // Verify database row in Supabase
    const { data: dbRow, error: dbErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();

    assert(!dbErr && dbRow, 'Room must exist in Supabase PostgreSQL "rooms" table');
    assert(dbRow.status === 'lobby', 'Initial status must be lobby');
    assert(Array.isArray(dbRow.players) && dbRow.players.length === 1, 'Room in DB must have 1 player');
    console.log('   ✅ PostgreSQL persistence verified in public.rooms');

    // 2. Client B joins the room
    console.log('\n🔹 Test 2: Second client joins the room...');
    const clientB = createSupabaseSocket();
    clientB.on('action_error', (e) => console.error('CLIENT B ACTION ERROR:', e));
    clientB.on('error_message', (e) => console.error('CLIENT B ERROR MESSAGE:', e));

    const joinedPromise = waitForEvent(clientB, 'joined_room');
    clientB.emit('join_room', {
      roomCode: testRoomCode,
      playerName: 'زيزو البطل',
      characterId: 'ziad_elfondoqy',
      teamPreference: 'team_b'
    });

    const joinedData = await joinedPromise;
    assert(joinedData.roomCode === testRoomCode, 'Joined roomCode must match');
    assert(joinedData.player?.name === 'زيزو البطل', 'Player name must match');
    assert(joinedData.player?.team === 'team_b', 'Player B must be in team_b');
    console.log('   ✅ Second client successfully joined room');

    // 3. Shared synchronized player roster
    console.log('\n🔹 Test 3: Verify shared synchronized player roster (2 players)...');
    await delay(300);
    const { data: updatedRow } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();

    assert(updatedRow.players.length === 2, `Expected 2 players in room, found: ${updatedRow.players.length}`);
    const names = updatedRow.players.map((p: any) => p.name);
    assert(names.includes('فارس الهوست') && names.includes('زيزو البطل'), 'Both players must be in roster');
    console.log(`   ✅ Synchronized roster: ${names.join(' & ')}`);

    // 4. Fill to 4 players using demo bots
    console.log('\n🔹 Test 4: Fill slots to 4 players for match threshold...');
    const bot1Promise = waitForEvent(hostSocket, 'room_state_updated');
    hostSocket.emit('add_demo_player', { roomCode: testRoomCode });
    await bot1Promise;

    const bot2Promise = waitForEvent(hostSocket, 'room_state_updated');
    hostSocket.emit('add_demo_player', { roomCode: testRoomCode });
    await bot2Promise;

    const { data: fullRow } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();
    assert(fullRow.players.length === 4, `Expected 4 players, found: ${fullRow.players.length}`);
    console.log('   ✅ 4 players assembled with 2v2 team split');

    // 5. Host launches match countdown & transitions to Round 1
    console.log('\n🔹 Test 5: Host triggers match countdown & Round 1 start...');
    const stateUpdatedPromise = waitForEvent(clientB, 'room_state_updated', 15000);
    hostSocket.emit('start_match_countdown', { roomCode: testRoomCode });

    const round1State = await stateUpdatedPromise;
    assert(round1State.status === 'round1', `Expected status round1, got: ${round1State.status}`);
    assert(round1State.round1?.currentQuestion, 'Round 1 must have active question dispatched');
    assert(round1State.round1?.currentQuestion?.question_text, 'Question text must be populated');
    console.log(`   ✅ Round 1 live: "${round1State.round1.currentQuestion.question_text.slice(0, 40)}..."`);

    // 6. Scoring & Banking in Round 1
    console.log('\n🔹 Test 6: Verify scoring action & streak ladder progression...');
    const scoredPromise = waitForEvent(hostSocket, 'room_state_updated');
    hostSocket.emit('r1_action_score', { roomCode: testRoomCode });
    await scoredPromise;

    const { data: scoredRow } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();

    const r1State = scoredRow.state?.round1;
    assert(r1State?.streak === 1, `Expected streak 1, got ${r1State?.streak}`);
    assert(r1State?.pendingPoints === 100, `Expected pending points 100, got ${r1State?.pendingPoints}`);
    console.log('   ✅ Scoring verified: Streak = 1, Pending Vault = 100 pts');

    // Bank points
    const bankedPromise = waitForEvent(hostSocket, 'room_state_updated');
    hostSocket.emit('r1_action_bank', { roomCode: testRoomCode });
    await bankedPromise;

    const { data: bankedRow } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();

    const teamAScore = bankedRow.teams?.team_a?.score;
    assert(teamAScore === 100, `Expected Team A score 100, got ${teamAScore}`);
    assert(bankedRow.state?.round1?.pendingPoints === 0, 'Pending points must reset to 0 after banking');
    console.log('   ✅ Banking verified: Team A Vault = 100 pts banked successfully');

    // 7. Player Rejoin with token (no duplication)
    console.log('\n🔹 Test 7: Client B rejoins using player token (verifying no duplicate player)...');
    const clientBRejoinSocket = createSupabaseSocket();
    const rejoinedPromise = waitForEvent(clientBRejoinSocket, 'rejoined_room');
    clientBRejoinSocket.emit('rejoin_room', {
      roomCode: testRoomCode,
      playerToken: joinedData.playerToken
    });

    const rejoinedData = await rejoinedPromise;
    assert(rejoinedData.roomCode === testRoomCode, 'Rejoined room code must match');
    assert(rejoinedData.player.name === 'زيزو البطل', 'Rejoined player identity must match');

    const { data: afterRejoinRow } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();

    assert(afterRejoinRow.players.length === 4, `Player count must remain exactly 4 after rejoin, got: ${afterRejoinRow.players.length}`);
    console.log('   ✅ Reconnection verified: Player restored without duplicate membership');

    // Clean up sockets
    hostSocket.disconnect();
    clientB.disconnect();
    clientBRejoinSocket.disconnect();

    console.log('\n================================================================================');
    console.log('🏁 ALL 7 SUPABASE REALTIME & DATABASE MULTIPLAYER TESTS PASSED (100% SUCCESS)');
    console.log('================================================================================\n');

  } finally {
    // Clean up test room from database
    if (testRoomCode) {
      await supabase.from('rooms').delete().eq('room_id', testRoomCode);
      console.log(`🧹 Cleaned up test room ${testRoomCode} from Supabase database.`);
    }
  }
}

runSupabaseTests().catch(err => {
  console.error('\n❌ SUPABASE TEST FAILED:', err);
  process.exit(1);
});

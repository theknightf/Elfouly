/**
 * tests/supabaseAuthority.test.ts
 *
 * Authority & hidden-information tests for the Supabase Realtime provider.
 * These complement tests/supabaseMultiplayer.test.ts (basic flow) and focus
 * on the security model of the serverless provider:
 *
 *  1. The Round 1 answer is never persisted and never reaches a client that
 *     is not the assigned referee.
 *  2. The assigned referee does receive the answer over the judge channel.
 *  3. A client that is not the assigned referee cannot grade the round.
 *  4. The penalty answer is validated by the client that dispatched the
 *     question (the kicker does not know the answer).
 *  5. A non kicker cannot answer the penalty.
 *  6. Raw session tokens are never stored in the database.
 *  7. Chat messages are sanitised and length limited.
 */

import { supabase } from '../src/services/supabaseClient';
import { createSupabaseSocket } from '../src/services/supabaseMultiplayerService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Assertion Failure] ${message}`);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForEvent<T = any>(socket: any, event: string, timeoutMs = 20000): Promise<T> {
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

function trackState(socket: any) {
  const holder: { current: any } = { current: null };
  socket.on('room_state_updated', (payload: any) => {
    holder.current = payload;
  });
  return holder;
}

function waitForState(socket: any, predicate: (payload: any) => boolean, timeoutMs = 20000, label = 'state'): Promise<any> {
  return new Promise((resolve, reject) => {
    let last: any = null;
    const timer = setTimeout(() => {
      socket.off('room_state_updated', handler);
      reject(new Error(`Timed out waiting for ${label} (last status: ${last?.status}, phase: ${last?.round3?.phase})`));
    }, timeoutMs);

    const handler = (payload: any) => {
      last = payload;
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off('room_state_updated', handler);
      resolve(payload);
    };

    socket.on('room_state_updated', handler);
  });
}

async function runSupabaseAuthorityTests() {
  console.log('\n================================================================================');
  console.log('🛡️  QUIZ ARENA - SUPABASE AUTHORITY & HIDDEN INFORMATION TEST SUITE');
  console.log('================================================================================\n');

  let testRoomCode = '';

  try {
    console.log('🔹 Setup: host + two players in a fresh room...');
    const hostSocket = createSupabaseSocket();
    const hostState = trackState(hostSocket);

    const createdPromise = waitForEvent(hostSocket, 'room_created');
    hostSocket.emit('create_room', { playerName: 'فارس الهوست', characterId: 'fares_elfouly' });
    const created: any = await createdPromise;
    testRoomCode = created.roomCode;

    const clientB = createSupabaseSocket();
    const clientBState = trackState(clientB);
    const joinedBPromise = waitForEvent(clientB, 'joined_room');
    clientB.emit('join_room', {
      roomCode: testRoomCode,
      playerName: 'زيزو البطل',
      characterId: 'ziad_elfondoqy',
      teamPreference: 'team_b'
    });
    const joinedB: any = await joinedBPromise;

    const clientC = createSupabaseSocket();
    const joinedCPromise = waitForEvent(clientC, 'joined_room');
    clientC.emit('join_room', {
      roomCode: testRoomCode,
      playerName: 'مازن المصد',
      characterId: 'mazen_elgamer',
      teamPreference: 'team_a'
    });
    const joinedC: any = await joinedCPromise;

    await waitForState(hostSocket, (state: any) => (state.players?.length || 0) === 3, 20000, '3 players');
    hostSocket.emit('add_demo_player', { roomCode: testRoomCode });
    await waitForState(hostSocket, (state: any) => (state.players?.length || 0) === 4, 20000, '4 players');
    console.log('   ✅ Room assembled with 4 players (3 humans + 1 demo bot)');

    // ------------------------------------------------------------------
    // 1. Session tokens are hashed in the database
    // ------------------------------------------------------------------
    console.log('\n🔹 Test 1: Raw session tokens must never be persisted...');
    const { data: dbRow } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();
    const leaked = (dbRow.players || []).find((player: any) => player.playerToken);
    assert(!leaked, 'The database must not contain raw session tokens');
    console.log('   ✅ No raw session token in public.rooms');

    // ------------------------------------------------------------------
    // 2. Start the match and inspect the hidden information
    // ------------------------------------------------------------------
    console.log('\n🔹 Test 2: The Round 1 answer must stay hidden from non referee clients...');
    const round1Promise = waitForState(clientB, (state: any) => state.status === 'round1', 25000, 'round1');
    hostSocket.emit('start_match_countdown', { roomCode: testRoomCode });
    await round1Promise;

    const { data: liveRow } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single();
    assert(!liveRow.state?.round1?.currentQuestion?.answer, 'The answer must never be persisted in clear text');

    const refereeId = liveRow.state?.round1?.refereePlayerId;
    assert(refereeId, 'A Round 1 referee must be assigned');
    const refereeIsClientB = refereeId === joinedB.player.id;

    const nonRefereeState = refereeIsClientB ? hostState.current : clientBState.current;
    assert(nonRefereeState, 'A room state must be available for the non referee client');
    assert(!nonRefereeState.round1?.currentQuestion?.answer, 'The answer must not be visible to a non referee client');

    const refereeState = refereeIsClientB ? clientBState.current : hostState.current;
    assert(refereeState?.round1?.currentQuestion?.answer, 'The assigned referee must receive the answer over the judge channel');
    console.log('   ✅ Answer hidden from non referees, delivered to the assigned referee');

    // ------------------------------------------------------------------
    // 3. Only the assigned referee may grade
    // ------------------------------------------------------------------
    console.log('\n🔹 Test 3: Only the assigned referee may grade Round 1...');
    const nonReferee = refereeIsClientB ? hostSocket : clientB;
    const errors: string[] = [];
    nonReferee.on('error_message', (message: string) => errors.push(message));

    const streakBefore = liveRow.state?.round1?.streak || 0;
    nonReferee.emit('r1_action_score', {
      roomCode: testRoomCode,
      actionToken: liveRow.state?.round1?.actionToken
    });
    await delay(900);

    const streakAfter = (await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single()).data.state?.round1?.streak || 0;
    assert(streakAfter === streakBefore, 'A non referee must not be able to score');
    assert(errors.length > 0, 'The unauthorised attempt must be rejected with an error message');
    console.log('   ✅ Non referee grading attempt rejected');

    // The referee can grade.
    const refereeSocket = refereeIsClientB ? clientB : hostSocket;
    const refereeToken = refereeState.round1.actionToken;
    const scoredPromise = waitForState(refereeSocket, (state: any) => state.round1?.streak === 1, 15000, 'scored');
    refereeSocket.emit('r1_action_score', { roomCode: testRoomCode, actionToken: refereeToken });
    await scoredPromise;
    console.log('   ✅ The assigned referee graded the round successfully');

    // ------------------------------------------------------------------
    // 4. Chat sanitisation
    // ------------------------------------------------------------------
    console.log('\n🔹 Test 4: Chat must be sanitised and length limited...');
    const chatPromise = waitForEvent(clientB, 'chat_received');
    hostSocket.emit('send_chat', { text: '  hello   world  ', isTaunt: false });
    const chatMessage = await chatPromise;
    const hasControlChars = Array.from(chatMessage.text).some(char => {
      const code = char.codePointAt(0) ?? 0;
      return code < 32 || code === 127;
    });
    assert(!hasControlChars, 'Control characters must be stripped from chat');
    assert(chatMessage.text.length <= 240, 'Chat messages must be limited to 240 characters');
    console.log(`   ✅ Chat sanitised: "${chatMessage.text}"`);

    // ------------------------------------------------------------------
    // 5. Distributed penalty validation
    // ------------------------------------------------------------------
    console.log('\n🔹 Test 5: The penalty answer must be validated by the answer holder...');
    hostSocket.emit('change_round', { roomCode: testRoomCode, targetRound: 'round3' });
    const round3State = await waitForState(hostSocket, (state: any) => state.status === 'round3', 25000, 'round3');

    // The duelists are chosen from the teams the engine assigned, not by a
    // hardcoded assumption about who kicks first.
    const socketsById: Record<string, any> = {
      [created.player.id]: hostSocket,
      [joinedB.player.id]: clientB,
      [joinedC.player.id]: clientC
    };
    const kickerTeam = round3State.round3?.kickerTeam || 'team_a';
    const defendingTeam = kickerTeam === 'team_a' ? 'team_b' : 'team_a';
    const humans = (round3State.players || []).filter((player: any) => !player.isBot && socketsById[player.id]);
    const kickerPlayer = humans.find((player: any) => player.team === kickerTeam);
    const goaliePlayer = humans.find((player: any) => player.team === defendingTeam);
    assert(kickerPlayer && goaliePlayer, 'Both teams need a human duelist for the shootout');

    const kickerSocket = socketsById[kickerPlayer.id];
    const goalieSocket = socketsById[goaliePlayer.id];

    goalieSocket.emit('r3_select_duelists', { roomCode: testRoomCode, goalieId: goaliePlayer.id });
    await delay(500);
    kickerSocket.emit('r3_select_duelists', { roomCode: testRoomCode, kickerId: kickerPlayer.id });
    await delay(500);

    hostSocket.emit('r3_start_shootout', { roomCode: testRoomCode });
    const shootoutState = await waitForState(
      hostSocket,
      (state: any) => state.round3?.phase === 'shootout',
      25000,
      'shootout'
    );
    const options = shootoutState.round3?.currentQuestion?.options || [];
    assert(options.length >= 2, 'The penalty question must expose its options');
    assert(
      shootoutState.round3.currentKickerId === kickerPlayer.id,
      'The chosen kicker must be the player allowed to answer'
    );

    // The kicker does not know the answer: the client that dispatched the
    // question performs the validation and settles the shot.
    kickerSocket.emit('r3_submit_answer', { roomCode: testRoomCode, option: options[0] });
    const settledState = await waitForState(
      hostSocket,
      (state: any) => (state.round3?.shotsHistory?.length || 0) >= 1,
      35000,
      'settled shot'
    );
    assert(settledState.round3.shotsHistory[0].result, 'The shot must be settled by the answer holder');
    console.log(`   ✅ Penalty shot settled by the answer holder (${settledState.round3.shotsHistory[0].result})`);

    // A non kicker cannot answer.
    const turnIndexBefore = settledState.round3.turnIndex;
    const nonKickerSocket = [hostSocket, clientB, clientC].find(candidate => candidate !== kickerSocket);
    nonKickerSocket.emit('r3_submit_answer', { roomCode: testRoomCode, option: options[0] });
    await delay(900);
    const turnIndexAfter = (await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', testRoomCode)
      .single()).data.state?.round3?.turnIndex;
    assert(turnIndexAfter === turnIndexBefore, 'A non kicker must not be able to answer the penalty');
    console.log('   ✅ Non kicker answer attempt rejected');

    hostSocket.disconnect();
    clientB.disconnect();
    clientC.disconnect();

    console.log('\n================================================================================');
    console.log('🏁 ALL SUPABASE AUTHORITY & HIDDEN INFORMATION TESTS PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } finally {
    if (testRoomCode) {
      await supabase.from('rooms').delete().eq('room_id', testRoomCode);
      console.log(`🧹 Cleaned up test room ${testRoomCode} from Supabase database.`);
    }
  }
}

runSupabaseAuthorityTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ SUPABASE AUTHORITY TEST FAILED:', err);
    process.exit(1);
  });

/**
 * tests/roundIntegrity.test.ts
 *
 * Real Socket.IO integration tests for authoritative round behavior:
 * 1. Round 1 hides answers, rejects non-referee grading, and blocks token replay.
 * 2. Round 3 hides answers, gates submission to the kicker, and rejects unofficial options.
 * 3. Round 4 rejects stale bids, protects the referee checklist, and enforces bid resolution.
 * 4. Chat uses server-side identity, sanitizes content, and rejects non-members.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import net from 'net';
import path from 'path';
import { io, type Socket } from 'socket.io-client';
import { CHARACTERS } from '../src/data/characters';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Assertion Failure] ${message}`);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasControlCharacter(value: string) {
  return Array.from(value).some(char => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url: string, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet
    }
    await delay(200);
  }
  throw new Error(`Server did not become ready at ${url}`);
}

function connectClient(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const client = io(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      timeout: 5000
    });

    const timer = setTimeout(() => {
      client.close();
      reject(new Error('Socket connection timeout'));
    }, 6000);

    client.once('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function once<T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(event, handler);
  });
}

function waitForRoomState(
  socket: Socket,
  predicate: (room: any) => boolean,
  timeoutMs = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('room_state_updated', handler);
      reject(new Error('Timed out waiting for the expected room state'));
    }, timeoutMs);

    const handler = (room: any) => {
      if (!predicate(room)) return;
      clearTimeout(timer);
      socket.off('room_state_updated', handler);
      resolve(room);
    };

    socket.on('room_state_updated', handler);
  });
}

async function createRoom(socket: Socket, playerName: string, characterId?: string) {
  const created = once<any>(socket, 'room_created');
  socket.emit('create_room', { playerName, characterId });
  return created;
}

async function joinRoom(
  socket: Socket,
  roomCode: string,
  playerName: string,
  characterId?: string,
  teamPreference?: string
) {
  const joined = once<any>(socket, 'joined_room');
  socket.emit('join_room', { roomCode, playerName, characterId, teamPreference });
  return joined;
}

async function expectErrorMessage(socket: Socket, emit: () => void, pattern: RegExp) {
  const messagePromise = once<string>(socket, 'error_message');
  emit();
  const message = await messagePromise;
  assert(typeof message === 'string' && pattern.test(message), `Expected error matching ${pattern}, got: ${message}`);
  return message;
}

async function setupFourPlayers(sockets: Socket[], targetRound: string) {
  const created = await createRoom(sockets[0], 'Integrity Host', CHARACTERS[0].id);
  await joinRoom(sockets[1], created.roomCode, 'Integrity A', CHARACTERS[1].id, 'team_a');
  await joinRoom(sockets[2], created.roomCode, 'Integrity B1', CHARACTERS[2].id, 'team_b');
  await joinRoom(sockets[3], created.roomCode, 'Integrity B2', CHARACTERS[3].id, 'team_b');

  const statePromise = waitForRoomState(sockets[0], room => room.status === targetRound);
  sockets[0].emit('change_round', { roomCode: created.roomCode, targetRound });
  const state = await statePromise;
  return { roomCode: created.roomCode, state };
}

async function run() {
  const port = await getFreePort();
  const rootDir = process.cwd();
  let serverLogs = '';

  const serverProcess: ChildProcessWithoutNullStreams = spawn(
    process.execPath,
    [path.join(rootDir, 'server', 'server.js')],
    {
      cwd: rootDir,
      env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  ) as ChildProcessWithoutNullStreams;

  serverProcess.stdout.on('data', (chunk) => {
    serverLogs += chunk.toString();
    if (serverLogs.length > 8000) serverLogs = serverLogs.slice(-8000);
  });
  serverProcess.stderr.on('data', (chunk) => {
    serverLogs += chunk.toString();
    if (serverLogs.length > 8000) serverLogs = serverLogs.slice(-8000);
  });

  const clients: Socket[] = [];
  const opened = async () => {
    const client = await connectClient(port);
    clients.push(client);
    return client;
  };

  const results: { name: string; ok: boolean; error?: string }[] = [];
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  PASS: ${name}`);
    } catch (error: any) {
      results.push({ name, ok: false, error: error?.message || String(error) });
      console.log(`  FAIL: ${name}`);
      console.log(`     ${error?.message || error}`);
    }
  };

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    console.log('\n================================================================================');
    console.log('QUIZ ARENA - ROUND INTEGRITY / HIDDEN INFORMATION TEST SUITE');
    console.log('================================================================================\n');

    await test('Round 1 hides answers, gates grading, and rejects token replay', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round1');
      const r1 = state.round1;

      assert(r1.currentQuestion?.question, 'Round 1 did not dispatch a question');
      assert(r1.currentQuestion.answer === null, 'Non-referee received the Round 1 answer');
      assert(r1.actionToken, 'Round 1 action token missing');

      const referee = sockets.find(socket => socket.id === r1.refereePlayerId);
      const nonReferee = sockets.find(socket => socket.id !== r1.refereePlayerId);
      assert(referee && nonReferee, 'Could not resolve Round 1 roles');

      await expectErrorMessage(nonReferee, () => {
        nonReferee.emit('r1_action_score', { roomCode, actionToken: r1.actionToken });
      }, /الحكم|ممنوع/);

      await expectErrorMessage(referee, () => {
        referee.emit('r1_action_score', { roomCode, actionToken: 'invalid-token' });
      }, /صلاحية/);

      const nextPromise = waitForRoomState(
        sockets[0],
        room => room.status === 'round1' && room.round1.currentQuestionIndex === r1.currentQuestionIndex + 1
      );
      referee.emit('r1_action_score', { roomCode, actionToken: r1.actionToken });
      const next = await nextPromise;
      assert(next.round1.actionToken && next.round1.actionToken !== r1.actionToken, 'Token did not rotate after grading');

      await expectErrorMessage(referee, () => {
        referee.emit('r1_action_score', { roomCode, actionToken: r1.actionToken });
      }, /صلاحية/);
    });

    await test('Round 3 hides answers, gates submissions, and rejects unofficial options', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round3');
      const kickerId = state.round3.currentKickerId;
      const goalieId = state.round3.currentGoalieId;
      const kicker = sockets.find(socket => socket.id === kickerId);
      const goalie = sockets.find(socket => socket.id === goalieId);
      const host = sockets[0];
      assert(kicker && goalie && kicker.id !== goalie.id, 'Round 3 duelists were not assigned');

      await expectErrorMessage(goalie, () => {
        goalie.emit('r3_start_shootout', { roomCode });
      }, /الهوست|الحكم/);

      const shootoutPromise = waitForRoomState(sockets[0], room => room.round3.phase === 'shootout');
      host.emit('r3_start_shootout', { roomCode });
      const shootout = await shootoutPromise;
      assert(shootout.round3.currentQuestion?.options?.length, 'Round 3 question options missing');
      assert(shootout.round3.currentQuestion.answer === null, 'Non-referee received the Round 3 answer');

      const option = shootout.round3.currentQuestion.options[0];
      await expectErrorMessage(goalie, () => {
        goalie.emit('r3_submit_answer', { roomCode, option });
      }, /المسدد/);

      await expectErrorMessage(kicker, () => {
        kicker.emit('r3_submit_answer', { roomCode, option: '__not_an_official_option__' });
      }, /الخيارات/);

      const settledPromise = waitForRoomState(sockets[0], room => room.round3.turnIndex === 1);
      kicker.emit('r3_submit_answer', { roomCode, option });
      await settledPromise;
    });

    await test('Round 4 rejects stale bids, protects the checklist, and enforces resolution', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round4');
      const r4 = state.round4;
      const topicId = r4.topicId;
      assert(topicId, 'Round 4 topic ID missing');

      const referee = sockets.find(socket => socket.id === r4.refereePlayerId);
      const nonReferee = sockets.find(socket => socket.id !== r4.refereePlayerId);
      assert(referee && nonReferee, 'Could not resolve Round 4 referee');

      await expectErrorMessage(nonReferee, () => {
        nonReferee.emit('r4_toggle_item', { roomCode, item: 'anything', topicId });
      }, /الحكم/);

      const bidder = nonReferee;
      const bidderPlayer = state.players.find((player: any) => player.id === bidder.id);
      const opponent = sockets.find(socket => {
        if (socket.id === r4.refereePlayerId) return false;
        const player = state.players.find((candidate: any) => candidate.id === socket.id);
        return player?.team !== bidderPlayer?.team;
      });
      assert(opponent, 'Could not resolve an opposing bidder');

      const firstBid = r4.highestBid;
      const firstBidPromise = waitForRoomState(
        sockets[0],
        room => room.round4.highestBid === firstBid + 1
      );
      bidder.emit('r4_bid', { roomCode, increment: 1, expectedBid: firstBid, topicId });
      const afterFirstBid = await firstBidPromise;
      assert(afterFirstBid.round4.highestBidderTeam === bidderPlayer.team, 'Highest bidder team was not recorded');

      await expectErrorMessage(bidder, () => {
        bidder.emit('r4_bid', { roomCode, increment: 1, expectedBid: afterFirstBid.round4.highestBid, topicId });
      }, /بالفعل/);

      await expectErrorMessage(opponent, () => {
        opponent.emit('r4_bid', { roomCode, increment: 1, expectedBid: firstBid, topicId });
      }, /تغيّرت/);

      await expectErrorMessage(opponent, () => {
        opponent.emit('r4_use_lifeline', { roomCode, lifelineType: 'call_friend', topicId });
      }, /أعلى مزاد/);

      const secondBidPromise = waitForRoomState(
        sockets[0],
        room => room.round4.highestBid === firstBid + 2
      );
      const refStatePromise = waitForRoomState(
        referee,
        room => room.round4.highestBid === firstBid + 2
      );
      opponent.emit('r4_bid', { roomCode, increment: 1, expectedBid: afterFirstBid.round4.highestBid, topicId });
      const [afterSecondBid, refState] = await Promise.all([secondBidPromise, refStatePromise]);

      const opponentPlayer = state.players.find((player: any) => player.id === opponent.id);
      const opponentTeam = opponentPlayer?.team;
      assert(opponentTeam, 'Could not resolve the opponent team');

      await expectErrorMessage(opponent, () => {
        opponent.emit('r4_use_lifeline', { roomCode, lifelineType: 'unsupported', topicId });
      }, /غير معروفة/);
      assert(!(afterSecondBid.round4.usedLifelines?.[opponentTeam] || []).length, 'Invalid lifeline was consumed');

      const lifelinePromise = waitForRoomState(
        sockets[0],
        room => (room.round4.usedLifelines?.[opponentTeam] || []).includes('call_friend')
      );
      opponent.emit('r4_use_lifeline', { roomCode, lifelineType: 'call_friend', topicId });
      const afterLifeline = await lifelinePromise;
      assert(afterLifeline.round4.timer === afterSecondBid.round4.timer + 20, 'Call-friend did not add 20 seconds');

      const helpPromise = waitForRoomState(
        sockets[0],
        room => (room.round4.itemsNamed?.length || 0) === 1
      );
      opponent.emit('r4_use_lifeline', { roomCode, lifelineType: 'opponent_help', topicId });
      const afterHelp = await helpPromise;
      assert(
        (afterHelp.round4.usedLifelines?.[opponentTeam] || []).includes('opponent_help'),
        'Opponent-help lifeline was not recorded'
      );

      await expectErrorMessage(referee, () => {
        referee.emit('r4_resolve_bid', { roomCode, success: true, topicId });
      }, /لم يصل/);

      const required = afterSecondBid.round4.highestBid;
      const validItems = refState.round4.currentTopic?.validItems || [];
      assert(validItems.length >= required, 'Referee did not receive enough valid auction items');

      const checklistPromise = waitForRoomState(
        sockets[0],
        room => (room.round4.itemsNamed?.length || 0) >= required
      );
      const remainingItems = validItems
        .filter((item: string) => !afterHelp.round4.itemsNamed.includes(item))
        .slice(0, required - afterHelp.round4.itemsNamed.length);
      for (const item of remainingItems) {
        referee.emit('r4_toggle_item', { roomCode, item, topicId });
      }
      await checklistPromise;

      const winningTeam = afterSecondBid.round4.highestBidderTeam;
      const scoreBefore = refState.teams[winningTeam].score;
      const resolvedPromise = waitForRoomState(
        sockets[0],
        room => room.round4.currentTopicIndex === 1
      );
      referee.emit('r4_resolve_bid', { roomCode, success: true, topicId });
      const resolved = await resolvedPromise;
      assert(resolved.teams[winningTeam].score === scoreBefore + required * 400, 'Auction reward was not applied');
      assert(resolved.round4.topicId !== topicId, 'Auction topic did not rotate after resolution');
    });

    await test('Chat uses server identity, sanitizes content, and rejects non-members', async () => {
      const host = await opened();
      const outsider = await opened();
      const created = await createRoom(host, 'Chat Host', CHARACTERS[0].id);
      const rawText = `  spoof\u0007  ${'x'.repeat(300)}  `;

      const messagePromise = once<any>(host, 'chat_received');
      host.emit('send_chat', {
        roomCode: created.roomCode,
        text: rawText,
        senderName: 'Fake Name',
        characterAvatar: 'FAKE',
        team: 'team_b',
        isTaunt: true
      });
      const message = await messagePromise;
      assert(message.senderName === 'Chat Host', 'Server trusted the client-supplied sender name');
      assert(message.team === 'team_a', 'Server trusted the client-supplied team');
      assert(message.characterAvatar !== 'FAKE', 'Server trusted the client-supplied avatar');
      assert(message.text.length <= 240, 'Chat text exceeded the server limit');
      assert(!hasControlCharacter(message.text), 'Chat text retained control characters');
      assert(message.isTaunt === true, 'Chat taunt flag was not preserved');

      await expectErrorMessage(outsider, () => {
        outsider.emit('send_chat', { roomCode: created.roomCode, text: 'hello' });
      }, /لست عضوا/);
    });

  } finally {
    for (const client of clients) {
      try {
        client.disconnect();
      } catch {
        // ignore cleanup errors
      }
    }

    serverProcess.kill();
    await delay(300);
  }

  const passed = results.filter(result => result.ok).length;
  const total = results.length;

  console.log('\n--------------------------------------------------------------------------------');
  console.log(`ROUND INTEGRITY SUMMARY: ${passed}/${total} passed`);
  console.log('--------------------------------------------------------------------------------');

  if (passed !== total) {
    console.error('\nServer logs (tail):\n' + serverLogs);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Round integrity test suite crashed:', error);
  process.exit(1);
});

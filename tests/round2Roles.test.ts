/**
 * Round 2 integration tests.
 *
 * These tests boot the real socket server and verify the Password-mode role
 * model: only the two clue-givers receive the secret card, the opposing
 * clue-giver judges each clue turn, and clue-givers rotate across all 5 cards.
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

function once<T>(socket: Socket, event: string, timeoutMs = 6000): Promise<T> {
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
  timeoutMs = 6000
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

async function waitForStates(sockets: Socket[], predicate: (room: any) => boolean) {
  return Promise.all(sockets.map(socket => waitForRoomState(socket, predicate)));
}

async function createRoom(socket: Socket, playerName: string, characterId: string) {
  const created = once<any>(socket, 'room_created');
  socket.emit('create_room', { playerName, characterId });
  return created;
}

async function joinRoom(
  socket: Socket,
  roomCode: string,
  playerName: string,
  characterId: string,
  teamPreference: string
) {
  const joined = once<any>(socket, 'joined_room');
  socket.emit('join_room', { roomCode, playerName, characterId, teamPreference });
  return joined;
}

async function expectErrorMessage(socket: Socket, emit: () => void, pattern: RegExp) {
  const messagePromise = once<string>(socket, 'error_message');
  emit();
  const message = await messagePromise;
  assert(pattern.test(message), `Expected error matching ${pattern}, got: ${message}`);
  return message;
}

async function setupRoom(sockets: Socket[]) {
  const created = await createRoom(sockets[0], 'R2 Host', CHARACTERS[0].id);
  await joinRoom(sockets[1], created.roomCode, 'R2 A2', CHARACTERS[1].id, 'team_a');
  await joinRoom(sockets[2], created.roomCode, 'R2 B1', CHARACTERS[2].id, 'team_b');
  await joinRoom(sockets[3], created.roomCode, 'R2 B2', CHARACTERS[3].id, 'team_b');

  const statesPromise = waitForStates(sockets, room => room.status === 'round2');
  sockets[0].emit('change_round', { roomCode: created.roomCode, targetRound: 'round2' });
  const states = await statesPromise;
  return { roomCode: created.roomCode, states };
}

function occurrences(haystack: string, needle: string) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function folderByTeam(room: any, team: string) {
  return room.players.filter((player: any) => player.team === team);
}

function secretWords(card: any) {
  const target = String(card?.target || '');
  const forbidden = Array.isArray(card?.forbidden) ? card.forbidden.map(String) : [];
  return [target, ...forbidden].filter(Boolean);
}

function assertNoSecretLeak(states: any[], viewerIds: string[], secretCard: any, label: string) {
  const secret = secretWords(secretCard);
  assert(secret.length >= 1, `${label}: secret card is empty`);

  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    const viewerId = viewerIds[index];
    const shouldSee = viewerId === secretCard.clueGiverA || viewerId === secretCard.clueGiverB;
    const serialized = JSON.stringify(state);

    if (shouldSee) {
      assert(state.round2.currentWord?.redacted !== true, `${label}: clue-giver ${viewerId} cannot see the card`);
      assert(state.round2.currentWord?.target === secretCard.target, `${label}: clue-giver received the wrong target`);
      continue;
    }

    assert(state.round2.currentWord?.redacted === true, `${label}: guesser ${viewerId} received a visible secret`);

    // Public data may legitimately contain a word like "وحش" inside a team name.
    // Remove the secret card from the state and prove the viewer received no
    // additional occurrences of the target or any forbidden word.
    const baselineState = JSON.parse(serialized);
    baselineState.round2.currentWord = {
      target: '__REDACTED__',
      forbidden: ['__REDACTED__', '__REDACTED__', '__REDACTED__', '__REDACTED__'],
      category: '__REDACTED__',
      clueIdea: '__REDACTED__',
      redacted: true
    };
    const baseline = JSON.stringify(baselineState);

    for (const word of secret) {
      assert(
        occurrences(serialized, word) === occurrences(baseline, word),
        `${label}: guesser ${viewerId} received secret word "${word}"`
      );
    }
  }
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
      console.log(`  ✅ PASS: ${name}`);
    } catch (error: any) {
      results.push({ name, ok: false, error: error?.message || String(error) });
      console.log(`  ❌ FAIL: ${name}`);
      console.log(`     ↳ ${error?.message || error}`);
    }
  };

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/health`);

    console.log('\n================================================================================');
    console.log('🔐 QUIZ ARENA - ROUND 2 ROLE / PRIVACY TEST SUITE');
    console.log('================================================================================\n');

    await test('Only the two clue-givers see the card and pairs rotate across 5 cards', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const viewerIds = sockets.map(socket => socket.id as string);
      const { roomCode, states: initialStates } = await setupRoom(sockets);

      const initial = initialStates[0];
      const teamA = folderByTeam(initial, 'team_a');
      const teamB = folderByTeam(initial, 'team_b');
      assert(teamA.length === 2 && teamB.length === 2, 'Round 2 requires exactly 2 players per team');

      let currentStates = initialStates;

      for (let cardIndex = 0; cardIndex < 5; cardIndex += 1) {
        const state = currentStates[0];
        assert(state.round2.currentWordIndex === cardIndex, `Expected card ${cardIndex + 1}, got index ${state.round2.currentWordIndex}`);

        const expectedA = teamA[cardIndex % 2].id;
        const expectedB = teamB[cardIndex % 2].id;
        const clueGiverA = state.round2.activeClueGiverA;
        const clueGiverB = state.round2.activeClueGiverB;

        assert(clueGiverA === expectedA, `Card ${cardIndex + 1}: team A clue-giver did not rotate as expected`);
        assert(clueGiverB === expectedB, `Card ${cardIndex + 1}: team B clue-giver did not rotate as expected`);

        const activeTeam = state.round2.activeTurnTeam;
        const expectedReferee = activeTeam === 'team_a' ? clueGiverB : clueGiverA;
        assert(state.round2.refereePlayerId === expectedReferee, `Card ${cardIndex + 1}: referee is not the opposing clue-giver`);

        const guessers = [...teamA, ...teamB]
          .filter(player => player.id !== clueGiverA && player.id !== clueGiverB)
          .map(player => player.id);
        assert(!guessers.includes(state.round2.refereePlayerId), `Card ${cardIndex + 1}: a guesser became referee`);

        const visibleCard = currentStates.find(viewerState =>
          viewerState.round2.currentWord?.redacted !== true
        )?.round2.currentWord;
        assert(visibleCard, `Card ${cardIndex + 1}: no clue-giver received the secret card`);

        assertNoSecretLeak(currentStates, viewerIds, {
          ...visibleCard,
          clueGiverA,
          clueGiverB
        }, `Card ${cardIndex + 1}`);

        if (cardIndex < 4) {
          const refereeSocket = sockets.find(socket => socket.id === expectedReferee);
          assert(refereeSocket, `Card ${cardIndex + 1}: referee socket not found`);
          const nextStatesPromise = waitForStates(
            sockets,
            room => room.status === 'round2' && room.round2.currentWordIndex === cardIndex + 1
          );
          const actionToken = currentStates[0].round2.actionToken;
          assert(actionToken, `Card ${cardIndex + 1}: server did not issue an action token`);
          refereeSocket.emit('r2_award_point', { roomCode, team: activeTeam, actionToken });
          currentStates = await nextStatesPromise;
        }
      }
    });

    await test('Clue-givers cannot judge their own team; the opposing clue-giver can', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, states } = await setupRoom(sockets);
      const initial = states[0];

      const clueGiverA = initial.round2.activeClueGiverA;
      const clueGiverB = initial.round2.activeClueGiverB;
      const activeTeam = initial.round2.activeTurnTeam;
      const actionToken = initial.round2.actionToken;
      const socketA = sockets.find(socket => socket.id === clueGiverA);
      const socketB = sockets.find(socket => socket.id === clueGiverB);
      const guesser = sockets.find(socket => socket.id !== clueGiverA && socket.id !== clueGiverB);
      assert(socketA && socketB && guesser, 'Could not resolve the Round 2 role sockets');
      assert(actionToken, 'Server did not issue a Round 2 action token');

      await expectErrorMessage(socketA, () => {
        socketA.emit('r2_award_point', { roomCode, team: activeTeam, actionToken });
      }, /فريقك|ممنوع/);

      await expectErrorMessage(socketA, () => {
        socketA.emit('r2_foul', { roomCode, team: activeTeam, actionToken });
      }, /فريقك|ممنوع/);

      const ownTeamB = activeTeam === 'team_a' ? 'team_b' : 'team_a';
      await expectErrorMessage(socketB, () => {
        socketB.emit('r2_award_point', { roomCode, team: ownTeamB, actionToken });
      }, /فريقك|ممنوع/);

      await expectErrorMessage(socketB, () => {
        socketB.emit('r2_foul', { roomCode, team: ownTeamB, actionToken });
      }, /فريقك|ممنوع/);

      await expectErrorMessage(guesser, () => {
        guesser.emit('r2_award_point', { roomCode, team: activeTeam, actionToken });
      }, /لوحة التحكيم|مقفولة|الحكم/);

      await expectErrorMessage(socketB, () => {
        socketB.emit('r2_award_point', { roomCode, team: activeTeam });
      }, /صلاحية/);

      const afterFoulPromise = waitForRoomState(
        sockets[0],
        room => room.status === 'round2' && room.round2.activeTurnTeam === ownTeamB
      );
      socketB.emit('r2_foul', { roomCode, team: activeTeam, actionToken });
      const afterFoul = await afterFoulPromise;

      assert(afterFoul.teams[activeTeam].score === 0, 'Foul should not push the score below zero');
      assert(afterFoul.round2.fouls[activeTeam] === 1, 'The opposing clue-giver foul was not recorded');
      assert(afterFoul.round2.refereePlayerId === clueGiverA, 'The judge seat did not pass to the other clue-giver');

      const rotatedToken = afterFoul.round2.actionToken;
      assert(rotatedToken && rotatedToken !== actionToken, 'The foul did not rotate the action token');

      const awardPromise = waitForRoomState(
        sockets[0],
        room => room.status === 'round2' && room.round2.currentWordIndex === 1
      );
      socketA.emit('r2_award_point', { roomCode, team: ownTeamB, actionToken: rotatedToken });
      const afterAward = await awardPromise;
      assert(afterAward.teams[ownTeamB].score === 500, 'The opposing clue-giver could not award the active team');

      await expectErrorMessage(socketA, () => {
        socketA.emit('r2_award_point', { roomCode, team: ownTeamB, actionToken: rotatedToken });
      }, /صلاحية|مكتملة|الحكم/);
    });

    await test('Only the current referee can skip the card or freeze the timer', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, states } = await setupRoom(sockets);
      const initial = states[0];

      const refereeId = initial.round2.refereePlayerId;
      const refereeSocket = sockets.find(socket => socket.id === refereeId);
      const outsider = sockets.find(socket => socket.id !== refereeId);
      const actionToken = initial.round2.actionToken;
      assert(refereeSocket && outsider, 'Could not resolve the referee socket');
      assert(actionToken, 'Server did not issue a Round 2 action token');

      await expectErrorMessage(outsider, () => {
        outsider.emit('r2_time_freeze', { roomCode });
      }, /لوحة التحكيم|مقفولة|الحكم/);

      const frozenPromise = waitForRoomState(
        sockets[0],
        room => room.status === 'round2' && room.round2.timer === 55
      );
      refereeSocket.emit('r2_time_freeze', { roomCode });
      const frozen = await frozenPromise;
      assert(frozen.round2.timer === 55, 'The referee time-freeze did not add 10 seconds');

      await expectErrorMessage(outsider, () => {
        outsider.emit('r2_skip_card', { roomCode });
      }, /لوحة التحكيم|مقفولة|الحكم/);

      const skippedPromise = waitForRoomState(
        sockets[0],
        room => room.status === 'round2' && room.round2.currentWordIndex === 1
      );
      refereeSocket.emit('r2_skip_card', { roomCode, actionToken });
      const skipped = await skippedPromise;
      assert(skipped.round2.currentWordIndex === 1, 'The referee could not skip the card');
      assert(skipped.round2.activeClueGiverA !== initial.round2.activeClueGiverA, 'Team A clue-giver did not rotate after skip');
      assert(skipped.round2.activeClueGiverB !== initial.round2.activeClueGiverB, 'Team B clue-giver did not rotate after skip');
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
  console.log(`📊 ROUND 2 ROLE SUMMARY: ${passed}/${total} passed`);
  console.log('--------------------------------------------------------------------------------');

  if (passed !== total) {
    console.error('\nServer logs (tail):\n' + serverLogs);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Round 2 role test suite crashed:', error);
  process.exit(1);
});

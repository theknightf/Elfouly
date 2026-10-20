/**
 * tests/roomSystem.test.ts
 *
 * Integration tests for the QUIZ ARENA room system. These tests boot the real
 * Socket.io server on a free port and talk to it with socket.io-client.
 *
 * Covered:
 * 1. 6-character room codes without look-alike characters (QZ-XXXXXX)
 * 2. Joining a full room
 * 3. Joining a room after the match started
 * 4. Duplicate character selection (join + profile update)
 * 5. Full team handling (server moves the player to the other team)
 * 6. Rejoin with a valid and an invalid player token
 * 7. Starting a match without a strict 2v2 split
 * 8. change_round cannot skip the lobby start conditions
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
    } catch (error) {
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

function emitAck<T>(socket: Socket, event: string, payload: unknown, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}" ack`)), timeoutMs);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
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

async function fillTeamSplit(roomCode: string, sockets: Socket[]) {
  const joined: any[] = [];
  joined.push(await joinRoom(sockets[0], roomCode, 'Player 2', CHARACTERS[1].id, 'team_a'));
  joined.push(await joinRoom(sockets[1], roomCode, 'Player 3', CHARACTERS[2].id, 'team_b'));
  joined.push(await joinRoom(sockets[2], roomCode, 'Player 4', CHARACTERS[3].id, 'team_b'));

  return joined;
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
    console.log('🚪 QUIZ ARENA - ROOM SYSTEM INTEGRATION TEST SUITE');
    console.log('================================================================================\n');

    await test('Room codes are QZ-XXXXXX without look-alike characters', async () => {
      const host = await opened();
      const created = await createRoom(host, 'Code Host', CHARACTERS[0].id);
      assert(/^QZ-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(created.roomCode), `Invalid room code: ${created.roomCode}`);
      assert(typeof created.playerToken === 'string' && created.playerToken.length >= 10, 'playerToken was not issued');
    });

    await test('Joining a full room is rejected', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened(), await opened()];
      const created = await createRoom(sockets[0], 'Full Host', CHARACTERS[0].id);

      await joinRoom(sockets[1], created.roomCode, 'Full P2', CHARACTERS[1].id, 'team_a');
      await joinRoom(sockets[2], created.roomCode, 'Full P3', CHARACTERS[2].id, 'team_b');
      await joinRoom(sockets[3], created.roomCode, 'Full P4', CHARACTERS[3].id, 'team_b');

      await expectErrorMessage(sockets[4], () => {
        sockets[4].emit('join_room', {
          roomCode: created.roomCode,
          playerName: 'Full P5',
          characterId: CHARACTERS[4].id
        });
      }, /Room is full|ممتلئة/i);
    });

    await test('Joining a room after the match started is rejected', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened(), await opened()];
      const created = await createRoom(sockets[0], 'Live Host', CHARACTERS[0].id);
      await fillTeamSplit(created.roomCode, [sockets[1], sockets[2], sockets[3]]);

      const started = once<any>(sockets[0], 'match_started', 8000);
      sockets[0].emit('start_match_countdown', { roomCode: created.roomCode });
      const startPayload = await started;
      assert(startPayload.roomCode === created.roomCode, 'match_started did not include the room code');

      await expectErrorMessage(sockets[4], () => {
        sockets[4].emit('join_room', {
          roomCode: created.roomCode,
          playerName: 'Late P5',
          characterId: CHARACTERS[4].id
        });
      }, /Match already started|بدأ/i);
    });

    await test('Duplicate characters are rejected on join and profile update', async () => {
      const host = await opened();
      const guest = await opened();
      const created = await createRoom(host, 'Dup Host', CHARACTERS[0].id);

      await expectErrorMessage(guest, () => {
        guest.emit('join_room', {
          roomCode: created.roomCode,
          playerName: 'Dup Guest',
          characterId: CHARACTERS[0].id
        });
      }, /already taken|محجوزة/i);

      const joined = await joinRoom(guest, created.roomCode, 'Dup Guest', CHARACTERS[1].id, 'team_b');
      assert(joined.player.character.id === CHARACTERS[1].id, 'Guest did not receive the requested character');

      const ack = await emitAck<any>(guest, 'update_player_profile', {
        roomCode: created.roomCode,
        characterId: CHARACTERS[0].id
      });
      assert(ack.ok === false, 'Duplicate character profile update should be rejected');
      assert(/already taken|محجوزة/i.test(ack.error), `Unexpected profile error: ${ack.error}`);
    });

    await test('Full team is capped and the server moves the player to the other team', async () => {
      const host = await opened();
      const guestA = await opened();
      const guestB = await opened();
      const created = await createRoom(host, 'Team Host', CHARACTERS[0].id);

      const second = await joinRoom(guestA, created.roomCode, 'Team A2', CHARACTERS[1].id, 'team_a');
      assert(second.player.team === 'team_a', 'Second player should fit into team A');

      const third = await joinRoom(guestB, created.roomCode, 'Team A3', CHARACTERS[2].id, 'team_a');
      assert(third.player.team === 'team_b', `Full team preference should be ignored, got ${third.player.team}`);

      const ack = await emitAck<any>(guestB, 'update_player_profile', {
        roomCode: created.roomCode,
        team: 'team_a'
      });
      assert(ack.ok === false, 'Switching to a full team should be rejected');
      assert(/كامل|2\/2|full/i.test(ack.error), `Unexpected team error: ${ack.error}`);
    });

    await test('Rejoin works with a valid token and fails with an invalid one', async () => {
      const originalHost = await opened();
      const created = await createRoom(originalHost, 'Rejoin Host', CHARACTERS[0].id);

      originalHost.disconnect();
      await delay(150);

      const reconnectHost = await opened();
      const rejoinedPromise = once<any>(reconnectHost, 'rejoined_room');
      reconnectHost.emit('rejoin_room', {
        roomCode: created.roomCode,
        playerToken: created.playerToken
      });
      const rejoined = await rejoinedPromise;

      assert(rejoined.player.id === reconnectHost.id, 'Rejoin did not update player.id to the new socket id');
      assert(rejoined.room.hostId === reconnectHost.id, 'Rejoin did not update room.hostId for the host');
      assert(rejoined.playerToken === created.playerToken, 'Rejoin did not preserve the player token');
      assert(rejoined.player.connected === true, 'Rejoined player should be marked connected');

      const intruder = await opened();
      const failedPromise = once<any>(intruder, 'rejoin_failed');
      intruder.emit('rejoin_room', {
        roomCode: created.roomCode,
        playerToken: 'invalid-token-123'
      });
      const failed = await failedPromise;
      assert(/Invalid rejoin token|صالحة/i.test(failed.message), `Unexpected rejoin error: ${failed.message}`);
    });

    await test('Starting a match without a strict 2v2 split is rejected', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const created = await createRoom(sockets[0], 'Split Host', CHARACTERS[0].id);

      await joinRoom(sockets[1], created.roomCode, 'Split P2', CHARACTERS[1].id, 'team_a');
      await joinRoom(sockets[2], created.roomCode, 'Split P3', CHARACTERS[2].id, 'team_b');

      await expectErrorMessage(sockets[0], () => {
        sockets[0].emit('start_match_countdown', { roomCode: created.roomCode });
      }, /2 ضد 2|2v2|4 لاعبين/i);

      const joinedFourth = await joinRoom(sockets[3], created.roomCode, 'Split P4', CHARACTERS[3].id, 'team_b');
      assert(joinedFourth.player.team === 'team_b', 'Fourth player should complete team B');

      const droppedSocketId = sockets[2].id;
      const stateAfterDrop = waitForRoomState(
        sockets[0],
        room => room.players.find((p: any) => p.id === droppedSocketId)?.connected === false
      );
      sockets[2].disconnect();
      const droppedState = await stateAfterDrop;
      const droppedPlayer = droppedState.players.find((p: any) => p.id === droppedSocketId);
      assert(droppedPlayer && droppedPlayer.connected === false, 'Disconnected lobby player should stay in the slot during grace');

      await expectErrorMessage(sockets[0], () => {
        sockets[0].emit('start_match_countdown', { roomCode: created.roomCode });
      }, /متصل|connected/i);
    });

    await test('change_round cannot jump from the lobby before start conditions', async () => {
      const sockets = [await opened(), await opened()];
      const created = await createRoom(sockets[0], 'Jump Host', CHARACTERS[0].id);
      await joinRoom(sockets[1], created.roomCode, 'Jump P2', CHARACTERS[1].id, 'team_b');

      await expectErrorMessage(sockets[0], () => {
        sockets[0].emit('change_round', { roomCode: created.roomCode, targetRound: 'round1' });
      }, /شروط الانطلاق|2 ضد 2|4 لاعبين/i);
    });

  } finally {
    for (const client of clients) {
      try {
        client.disconnect();
      } catch (error) {
        // ignore cleanup errors
      }
    }

    serverProcess.kill();
    await delay(300);
  }

  const passed = results.filter(result => result.ok).length;
  const total = results.length;

  console.log('\n--------------------------------------------------------------------------------');
  console.log(`📊 ROOM SYSTEM SUMMARY: ${passed}/${total} passed`);
  console.log('--------------------------------------------------------------------------------');

  if (passed !== total) {
    console.error('\nServer logs (tail):\n' + serverLogs);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Room system test suite crashed:', error);
  process.exit(1);
});

// Lobby and room creation: seats, leaving, names, host-only management, limits.

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


async function expectError(socket: Socket, emit: () => void, pattern: RegExp) {
  const messagePromise = once<string>(socket, 'error_message');
  emit();
  const message = await messagePromise;
  assert(typeof message === 'string' && pattern.test(message), `Expected error matching ${pattern}, got: ${message}`);
}

function latestState(socket: Socket) {
  const holder: { room: any } = { room: null };
  socket.on('room_state_updated', (room: any) => { holder.room = room; });
  return holder;
}

async function run() {
  const port = await getFreePort();
  const rootDir = process.cwd();
  let serverLogs = '';

  const serverProcess: ChildProcessWithoutNullStreams = spawn(
    process.execPath,
    [path.join(rootDir, 'server', 'server.js')],
    { cwd: rootDir, env: { ...process.env, PORT: String(port), NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] }
  ) as ChildProcessWithoutNullStreams;
  serverProcess.stdout.on('data', (chunk) => { serverLogs += chunk.toString(); serverLogs = serverLogs.slice(-8000); });
  serverProcess.stderr.on('data', (chunk) => { serverLogs += chunk.toString(); serverLogs = serverLogs.slice(-8000); });

  const clients: Socket[] = [];
  const opened = async () => {
    const client = await connectClient(port);
    clients.push(client);
    return client;
  };

  const results: { name: string; ok: boolean }[] = [];
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  PASS: ${name}`);
    } catch (error: any) {
      results.push({ name, ok: false });
      console.log(`  FAIL: ${name}\n     ${error?.message || error}`);
    }
  };

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/health`);
    console.log('\nLOBBY & ROOM CREATION TESTS\n');

    await test('double-tapping join does not create a second seat', async () => {
      const [host, guest] = [await opened(), await opened()];
      const hostState = latestState(host);
      const created = await createRoom(host, 'Host', CHARACTERS[0].id);
      const first = once<any>(guest, 'joined_room');
      guest.emit('join_room', { roomCode: created.roomCode, playerName: 'Guest', characterId: CHARACTERS[1].id });
      guest.emit('join_room', { roomCode: created.roomCode, playerName: 'Guest', characterId: CHARACTERS[1].id });
      await first;
      await delay(400);
      assert(hostState.room.players.length === 2, `Expected 2 seats, got ${hostState.room.players.length}`);
    });

    await test('creating a second room leaves the first one and hands over the crown', async () => {
      const [a, b] = [await opened(), await opened()];
      const bState = latestState(b);
      const first = await createRoom(a, 'Alpha', CHARACTERS[0].id);
      await joinRoom(b, first.roomCode, 'Beta', CHARACTERS[1].id);
      const second = await createRoom(a, 'Alpha', CHARACTERS[0].id);
      assert(second.roomCode !== first.roomCode, 'A new room should have a new code');
      await delay(400);
      assert(bState.room.players.length === 1, 'The first room should only have Beta left');
      assert(bState.room.players[0].isHost && bState.room.hostId === b.id, 'Beta should become the host of the first room');
    });

    await test('leaving frees the seat, passes the crown, and deletes an empty room', async () => {
      const [a, b, c] = [await opened(), await opened(), await opened()];
      const aState = latestState(a);
      const created = await createRoom(a, 'Alpha', CHARACTERS[0].id);
      await joinRoom(b, created.roomCode, 'Beta', CHARACTERS[1].id);
      const bLeft = once<any>(b, 'left_room');
      b.emit('leave_room', { roomCode: created.roomCode });
      await bLeft;
      await delay(300);
      assert(aState.room.players.length === 1, 'Beta should have left the room');
      await joinRoom(c, created.roomCode, 'Gamma', CHARACTERS[2].id);
      const aLeft = once<any>(a, 'left_room');
      a.emit('leave_room', { roomCode: created.roomCode });
      await aLeft;
      await delay(300);
      const cLeft = once<any>(c, 'left_room');
      c.emit('leave_room', { roomCode: created.roomCode });
      await cLeft;
      await delay(300);
      const d = await opened();
      await expectError(d, () => d.emit('join_room', { roomCode: created.roomCode, playerName: 'Late' }), /غير موجود/);
    });

    await test('players with the same name get a number suffix', async () => {
      const [host, guest] = [await opened(), await opened()];
      const created = await createRoom(host, 'فارس', CHARACTERS[0].id);
      const joined = await joinRoom(guest, created.roomCode, 'فارس', CHARACTERS[1].id);
      assert(joined.player.name === 'فارس 2', `Expected "فارس 2", got "${joined.player.name}"`);
    });

    await test('only the host can manage teams, names and the judge', async () => {
      const [host, guest] = [await opened(), await opened()];
      const hostState = latestState(host);
      const created = await createRoom(host, 'Host', CHARACTERS[0].id);
      const joined = await joinRoom(guest, created.roomCode, 'Guest', CHARACTERS[1].id);
      const roomCode = created.roomCode;

      await expectError(guest, () => guest.emit('update_team_names', { roomCode, names: { team_a: 'Hacked' } }), /للهوست/);
      await expectError(guest, () => guest.emit('swap_teams', { roomCode }), /للهوست/);
      await expectError(guest, () => guest.emit('reassign_player_team', { roomCode, playerId: host.id, team: 'team_b' }), /للهوست/);
      await expectError(guest, () => guest.emit('set_match_judge', { roomCode, judgeId: guest.id }), /للهوست/);

      host.emit('update_team_names', { roomCode, names: { team_a: '<b>الصقور</b>', team_b: '   ' } });
      await delay(300);
      assert(hostState.room.teams.team_a.name === 'الصقور', `Team name was not sanitized: ${hostState.room.teams.team_a.name}`);
      assert(hostState.room.teams.team_b.name.length > 0, 'A blank name must not erase the team name');

      await expectError(host, () => host.emit('set_match_judge', { roomCode, judgeId: 'not-a-player' }), /لاعب حقيقي/);
      host.emit('reassign_player_team', { roomCode, playerId: joined.player.id, team: 'team_b' });
      await delay(300);
      assert(hostState.room.players.find((p: any) => p.id === guest.id)?.team === 'team_b', 'Host could not move a player');
    });

    await test('team changes are locked once the match starts', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const created = await createRoom(sockets[0], 'P1', CHARACTERS[0].id);
      await joinRoom(sockets[1], created.roomCode, 'P2', CHARACTERS[1].id, 'team_a');
      await joinRoom(sockets[2], created.roomCode, 'P3', CHARACTERS[2].id, 'team_b');
      await joinRoom(sockets[3], created.roomCode, 'P4', CHARACTERS[3].id, 'team_b');
      const started = waitForRoomState(sockets[0], room => room.status === 'round1');
      sockets[0].emit('change_round', { roomCode: created.roomCode, targetRound: 'round1' });
      await started;
      await expectError(sockets[0], () => sockets[0].emit('swap_teams', { roomCode: created.roomCode }), /صالة الانتظار/);
      const late = await opened();
      await expectError(late, () => late.emit('join_room', { roomCode: created.roomCode, playerName: 'Late' }), /بدأ بالفعل/);
    });

    await test('teams are capped at 2 and the room at 4', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened(), await opened()];
      const created = await createRoom(sockets[0], 'P1', CHARACTERS[0].id);
      const teams: string[] = ['team_a'];
      for (let i = 1; i < 4; i += 1) {
        const joined = await joinRoom(sockets[i], created.roomCode, `P${i + 1}`, CHARACTERS[i].id, 'team_a');
        teams.push(joined.player.team);
      }
      assert(teams.filter(t => t === 'team_a').length === 2 && teams.filter(t => t === 'team_b').length === 2, `Bad split: ${teams.join(',')}`);
      await expectError(sockets[4], () => sockets[4].emit('join_room', { roomCode: created.roomCode, playerName: 'P5' }), /ممتلئة/);
    });

    await test('room creation is rate limited per player', async () => {
      const spammer = await opened();
      for (let i = 0; i < 6; i += 1) await createRoom(spammer, `Room${i}`, CHARACTERS[0].id);
      await expectError(spammer, () => spammer.emit('create_room', { playerName: 'One too many', characterId: CHARACTERS[0].id }), /غرف كتير/);
    });

    await test('players can create a custom character and choose the categories they know', async () => {
      const [host, guest] = [await opened(), await opened()];
      const custom = { name: '<b>الصقر</b>', avatar: '🦅', color: '#FFC857', powerId: 'shield', specialties: ['dentistry', 'fitness_gym', 'cars_mechanics', 'islamic_studies'] };
      const created: any = await new Promise(resolve => {
        host.once('room_created', resolve);
        host.emit('create_room', { playerName: 'Host', customCharacter: custom });
      });
      const hero = created.player.character;
      assert(hero.isCustom && hero.name === 'الصقر', `Custom character not created: ${JSON.stringify(hero.name)}`);
      assert(hero.attributes.length === 3, 'A player may know at most 3 categories');
      assert(hero.powerId === 'shield', 'The chosen power was not kept');

      // a built-in character with the categories the player knows
      const joined: any = await new Promise(resolve => {
        guest.once('joined_room', resolve);
        guest.emit('join_room', { roomCode: created.roomCode, playerName: 'Guest', characterId: CHARACTERS[1].id, specialties: ['capitals_and_flags'] });
      });
      assert(joined.player.character.attributes.join() === 'capitals_and_flags', 'Chosen categories were ignored on join');

      // changing categories later from the lobby
      const guestState = latestState(guest);
      guest.emit('update_player_profile', { roomCode: created.roomCode, specialties: ['dentistry', 'reflex_trivia'] });
      await delay(300);
      const me = guestState.room.players.find((p: any) => p.id === guest.id);
      assert(me.character.attributes.join() === 'dentistry,reflex_trivia', 'Lobby category change was not applied');
      assert(me.character.id === CHARACTERS[1].id, 'Changing categories must keep the character');
    });

    await test('invalid custom characters are rejected', async () => {
      const socket = await opened();
      await expectError(socket, () => socket.emit('create_room', { playerName: 'X', customCharacter: { name: '', powerId: 'shield', specialties: ['dentistry'] } }), /اسم الشخصية/);
      await expectError(socket, () => socket.emit('create_room', { playerName: 'X', customCharacter: { name: 'A', powerId: 'laser', specialties: ['dentistry'] } }), /قدرة/);
      await expectError(socket, () => socket.emit('create_room', { playerName: 'X', customCharacter: { name: 'A', powerId: 'shield', specialties: ['nope'] } }), /تخصص/);
    });

    await test('Round 1 asks specialty questions from the categories the answerer chose', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const created: any = await new Promise(resolve => {
        sockets[0].once('room_created', resolve);
        sockets[0].emit('create_room', { playerName: 'P1', characterId: CHARACTERS[0].id, specialties: ['dentistry'] });
      });
      await joinRoom(sockets[1], created.roomCode, 'P2', CHARACTERS[1].id, 'team_a');
      await joinRoom(sockets[2], created.roomCode, 'P3', CHARACTERS[2].id, 'team_b');
      await joinRoom(sockets[3], created.roomCode, 'P4', CHARACTERS[3].id, 'team_b');
      const started = waitForRoomState(sockets[0], room => room.status === 'round1' && !!room.round1.turnPlan);
      sockets[0].emit('change_round', { roomCode: created.roomCode, targetRound: 'round1' });
      const state = await started;
      const answerer = state.players.find((p: any) => p.id === state.round1.answeringPlayerId);
      assert(answerer.character.attributes.join() === 'dentistry', 'The first answerer should know dentistry only');
      const specialtySlots = state.round1.turnPlan.filter((slot: any) => slot.slotType === 'specialty');
      assert(specialtySlots.length > 0 && specialtySlots.every((slot: any) => slot.category === 'dentistry'), 'Specialty slots must use the chosen category');
    });

    await test('an unknown character is rejected instead of creating a broken room', async () => {
      const socket = await opened();
      await expectError(socket, () => socket.emit('create_room', { playerName: 'X', characterId: 'faris' }), /مش موجودة/);
    });
  } finally {
    for (const client of clients) {
      try { client.disconnect(); } catch { /* ignore */ }
    }
    serverProcess.kill();
    await delay(300);
  }

  const passed = results.filter(result => result.ok).length;
  console.log(`\nLOBBY SUMMARY: ${passed}/${results.length} passed`);
  if (passed !== results.length) {
    console.error('\nServer logs (tail):\n' + serverLogs);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Lobby test suite crashed:', error);
  process.exit(1);
});

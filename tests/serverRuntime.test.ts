// Server runtime features: host kick, crash-report endpoint, restart persistence.
import fs from 'fs';

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

type RunningServer = { port: number; stop: () => Promise<void>; logs: () => string };

async function startServer(extraEnv: Record<string, string> = {}): Promise<RunningServer> {
  const port = await getFreePort();
  let logs = '';
  const child: ChildProcessWithoutNullStreams = spawn(
    process.execPath,
    [path.join(process.cwd(), 'server', 'server.js')],
    { cwd: process.cwd(), env: { ...process.env, PORT: String(port), NODE_ENV: 'test', ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] }
  ) as ChildProcessWithoutNullStreams;
  child.stdout.on('data', chunk => { logs = (logs + chunk.toString()).slice(-6000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk.toString()).slice(-6000); });
  await waitForServer(`http://127.0.0.1:${port}/api/health`);
  return { port, logs: () => logs, stop: async () => { child.kill(); await delay(300); } };
}

async function run() {
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

  console.log('\nSERVER RUNTIME TESTS (kick, crash reports, restart persistence)\n');

  const main = await startServer();
  const clients: Socket[] = [];
  const open = async (port = main.port) => {
    const client = await connectClient(port);
    clients.push(client);
    return client;
  };

  try {
    await test('the host can kick a player from the lobby (and only the host)', async () => {
      const [host, guest] = [await open(), await open()];
      const hostState = latestState(host);
      const created = await createRoom(host, 'Host', CHARACTERS[0].id);
      const joined: any = await joinRoom(guest, created.roomCode, 'Guest', CHARACTERS[1].id);

      await expectError(guest, () => guest.emit('kick_player', { roomCode: created.roomCode, playerId: host.id }), /للهوست/);
      await expectError(host, () => host.emit('kick_player', { roomCode: created.roomCode, playerId: host.id }), /الهوست نفسه/);

      const kicked = once<any>(guest, 'kicked');
      host.emit('kick_player', { roomCode: created.roomCode, playerId: joined.player.id });
      await kicked;
      await delay(300);
      assert(hostState.room.players.length === 1, 'The kicked player should be gone from the room');
      await expectError(guest, () => guest.emit('update_team_names', { roomCode: created.roomCode, names: { team_a: 'x' } }), /ليس عضو|غير موجودة|عضواً/);
    });

    await test('crash reports are accepted, size-limited and rate-limited', async () => {
      const url = `http://127.0.0.1:${main.port}/api/client-error`;
      const post = (body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const first = await post({ message: 'x'.repeat(5000), stack: 'at foo', url: 'http://localhost' });
      assert(first.status === 204, `Expected 204, got ${first.status}`);
      let limited = false;
      for (let i = 0; i < 25; i += 1) {
        const response = await post({ message: `boom ${i}` });
        if (response.status === 429) { limited = true; break; }
      }
      assert(limited, 'Crash reports must be rate-limited');
      assert(!main.logs().includes('x'.repeat(400)), 'Crash report text must be truncated in the logs');
    });

    await test('rooms survive a server restart and players rejoin with their token', async () => {
      const snapshot = path.join(process.env.TEMP || process.env.TMPDIR || '.', `rooms-snapshot-${Date.now()}.json`);
      const env = { ROOM_SNAPSHOT_PATH: snapshot, ROOM_SNAPSHOT_INTERVAL_MS: '200' };
      const first = await startServer(env);
      const [host, guest] = [await open(first.port), await open(first.port)];
      const created: any = await createRoom(host, 'Host', CHARACTERS[0].id);
      const joined: any = await joinRoom(guest, created.roomCode, 'Guest', CHARACTERS[1].id);
      await delay(900); // at least one snapshot
      await first.stop();
      assert(fs.existsSync(snapshot), 'No snapshot file was written');

      const second = await startServer(env);
      const returning = await open(second.port);
      const rejoined = once<any>(returning, 'rejoined_room');
      returning.emit('rejoin_room', { roomCode: created.roomCode, playerToken: joined.playerToken });
      const payload: any = await rejoined;
      assert(payload.room.players.length === 2, 'The room did not come back with both players');
      assert(payload.player.name === 'Guest', 'The wrong seat was restored');
      await second.stop();
      try { fs.unlinkSync(snapshot); } catch { /* ignore */ }
    });
  } finally {
    for (const client of clients) {
      try { client.disconnect(); } catch { /* ignore */ }
    }
    await main.stop();
  }

  const passed = results.filter(result => result.ok).length;
  console.log(`\nRUNTIME SUMMARY: ${passed}/${results.length} passed`);
  if (passed !== results.length) {
    console.error('\nServer logs (tail):\n' + main.logs());
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Runtime test suite crashed:', error);
  process.exit(1);
});

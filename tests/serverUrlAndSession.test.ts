/**
 * tests/serverUrlAndSession.test.ts
 *
 * Tests for:
 * 1. getServerUrl logic (env var set, trimmed, localhost, LAN IP, https null)
 * 2. Server startup with GROQ_API_KEY unset and /api/health response format
 * 3. Client session clearance on non-existent room rejoin ending on Landing state
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import net from 'net';
import os from 'os';
import path from 'path';
import { io, type Socket } from 'socket.io-client';
import { getServerUrl } from '../src/utils/serverUrl.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[Assertion Failure] ${message}`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      // Server not ready yet
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

async function run() {
  console.log('\n================================================================================');
  console.log('🌐 QUIZ ARENA - SERVER URL, SERVER HARDENING & SESSION CLEARANCE TEST SUITE');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Unit tests for getServerUrl
  // ---------------------------------------------------------------------------
  console.log('🔹 Part 1: getServerUrl unit tests');

  // Rule 1: env var set
  const resEnv = getServerUrl({
    env: { VITE_SERVER_URL: 'https://my-backend.railway.app' },
    location: { hostname: 'my-quiz.vercel.app', protocol: 'https:' }
  });
  assert(resEnv === 'https://my-backend.railway.app', `Expected env url, got: ${resEnv}`);
  console.log('   ✅ PASS: VITE_SERVER_URL env var set is used directly');

  // Rule 1: trailing slash trimmed
  const resTrimmed = getServerUrl({
    env: { VITE_SERVER_URL: 'https://my-backend.railway.app///' },
    location: { hostname: 'my-quiz.vercel.app', protocol: 'https:' }
  });
  assert(resTrimmed === 'https://my-backend.railway.app', `Expected trimmed url, got: ${resTrimmed}`);
  console.log('   ✅ PASS: VITE_SERVER_URL trailing slashes trimmed');

  // Rule 2: DEV true with localhost
  const resDevLocal = getServerUrl({
    env: { DEV: true },
    location: { hostname: 'localhost' }
  });
  assert(resDevLocal === 'http://localhost:3001', `Expected localhost:3001, got: ${resDevLocal}`);
  console.log('   ✅ PASS: DEV true with localhost resolves to http://localhost:3001');

  // Rule 2: DEV true with LAN IP
  const resDevLan = getServerUrl({
    env: { DEV: true },
    location: { hostname: '192.168.1.150' }
  });
  assert(resDevLan === 'http://192.168.1.150:3001', `Expected LAN url, got: ${resDevLan}`);
  console.log('   ✅ PASS: DEV true with LAN IP resolves to http://192.168.1.150:3001');

  // Rule 3: production without env var returns null
  const resProdNoEnv = getServerUrl({
    env: { DEV: false, PROD: true },
    location: { hostname: 'my-quiz.vercel.app' }
  });
  assert(resProdNoEnv === null, `Expected null in production without env var, got: ${resProdNoEnv}`);
  console.log('   ✅ PASS: Production build without VITE_SERVER_URL returns null (clear config error)');

  // ---------------------------------------------------------------------------
  // 2. Server startup with GROQ_API_KEY unset and /api/health response format
  // ---------------------------------------------------------------------------
  console.log('\n🔹 Part 2: Server startup with GROQ_API_KEY unset & /api/health check');

  const port = await getFreePort();
  const rootDir = process.cwd();
  const serverPath = path.join(rootDir, 'server', 'server.js');

  const serverEnv = { ...process.env, PORT: String(port), NODE_ENV: 'test' };
  delete serverEnv.GROQ_API_KEY;

  // Run from a different working directory (e.g. os.tmpdir) to also verify relative path resolution
  const serverProcess: ChildProcessWithoutNullStreams = spawn(
    process.execPath,
    [serverPath],
    {
      cwd: os.tmpdir(),
      env: serverEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  let serverErrorOutput = '';
  serverProcess.stderr.on('data', (d) => {
    serverErrorOutput += d.toString();
  });

  try {
    const healthUrl = `http://127.0.0.1:${port}/api/health`;
    await waitForServer(healthUrl);

    const healthRes = await fetch(healthUrl);
    assert(healthRes.ok, `Health check returned status ${healthRes.status}`);
    const healthData = await healthRes.json();

    assert(healthData.status === 'ok', `Expected status ok, got ${healthData.status}`);
    assert(typeof healthData.activeRooms === 'number', `Expected activeRooms number, got ${typeof healthData.activeRooms}`);
    assert(healthData.activeRooms === 0, `Expected activeRooms === 0, got ${healthData.activeRooms}`);
    assert(typeof healthData.uptimeSeconds === 'number', `Expected uptimeSeconds number, got ${typeof healthData.uptimeSeconds}`);
    assert(healthData.uptimeSeconds >= 0, `Expected non-negative uptimeSeconds, got ${healthData.uptimeSeconds}`);

    console.log('   ✅ PASS: Server starts normally with GROQ_API_KEY unset from any working directory');
    console.log(`   ✅ PASS: /api/health answered: ${JSON.stringify(healthData)}`);

    // -------------------------------------------------------------------------
    // 3. Client saved session for non-existent room clears session & ends on Landing
    // -------------------------------------------------------------------------
    console.log('\n🔹 Part 3: Client rejoin for non-existent room session clearance');

    const client = await connectClient(port);

    // Mock client-side session store & screen state as managed by GameContext
    let clientSession: { roomCode: string; playerToken: string } | null = {
      roomCode: 'QZ-NONEXIST',
      playerToken: 'saved-token-12345'
    };
    let currentScreen = 'lobby';
    let displayedErrorMessage: string | null = null;

    const rejoinFailedPromise = new Promise<{ message: string; field?: string; reason?: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for rejoin_failed')), 5000);
      client.once('rejoin_failed', (payload: any) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    client.emit('rejoin_room', {
      roomCode: clientSession.roomCode,
      playerToken: clientSession.playerToken
    });

    const failedPayload = await rejoinFailedPromise;

    // Simulate GameContext's rejoin_failed event handler
    const isRoomGone = failedPayload.reason === 'room_not_found' ||
      /Room not found|مش موجودة|اتقفلت|خلصت/i.test(failedPayload.message || '');

    if (isRoomGone) {
      clientSession = null; // clearSavedSession()
      displayedErrorMessage = 'الغرفة دي خلصت، اعمل غرفة جديدة';
      currentScreen = 'landing';
    }

    assert(clientSession === null, 'Client session was not cleared after room was not found');
    assert(currentScreen === 'landing', 'Client was not redirected to Landing screen');
    assert(
      displayedErrorMessage === 'الغرفة دي خلصت، اعمل غرفة جديدة',
      `Unexpected error message: ${displayedErrorMessage}`
    );

    console.log('   ✅ PASS: rejoin_room for non-existent room triggered rejoin_failed');
    console.log('   ✅ PASS: Client saved session cleared successfully');
    console.log(`   ✅ PASS: State transitioned to Landing with message: "${displayedErrorMessage}"`);

    // -------------------------------------------------------------------------
    // 4. Fair timing in Round 3 over the internet
    // -------------------------------------------------------------------------
    console.log('\n🔹 Part 4: Fair timing in Round 3 over the internet');

    // Test 4.1: RTT smoothing (median of last 5 samples) & 15s expiration & 250ms clamp
    const testSocketId = 'socket-test-fairness';
    const now = Date.now();

    // Import from server/server.js
    const {
      recordPlayerRtt,
      getPlayerSmoothedRtt,
      getPlayerCompensation,
      resolveShootoutTimings,
      playerLatencySamples
    } = await import('../server/server.js');

    // Test clamp: 600ms RTT -> compensation clamped to 250ms (not 300ms)
    recordPlayerRtt(testSocketId, 600);
    assert(getPlayerCompensation(testSocketId) === 250, `Expected clamped 250ms, got ${getPlayerCompensation(testSocketId)}`);
    console.log('   ✅ PASS: Latency compensation clamped to maximum 250ms');

    // Test median of 5 samples: [100, 150, 200, 300, 400] -> median is 200
    playerLatencySamples.delete(testSocketId);
    [100, 150, 200, 300, 400].forEach(rtt => recordPlayerRtt(testSocketId, rtt));
    assert(getPlayerSmoothedRtt(testSocketId) === 200, `Expected median 200, got ${getPlayerSmoothedRtt(testSocketId)}`);
    console.log('   ✅ PASS: Server keeps smoothed RTT (median of last 5 samples)');

    // Test sample expiration: samples older than 15s are ignored
    playerLatencySamples.set(testSocketId, [
      { rtt: 500, timestamp: now - 20000 }, // 20s old -> expired
      { rtt: 80, timestamp: now - 1000 }    // 1s old -> valid
    ]);
    assert(getPlayerSmoothedRtt(testSocketId) === 80, `Expected expired samples to be ignored, got ${getPlayerSmoothedRtt(testSocketId)}`);
    console.log('   ✅ PASS: Samples older than 15 seconds are correctly ignored');

    // Test 4.2: Two players with 200ms different RTT pressing at the same real moment resolve as a tie
    // Real physical press time = 5000ms
    // Player A (Kicker): RTT = 200ms -> compensation = 100ms. Arrives at server at 5000 + 100 = 5100ms
    // Player B (Goalie): RTT = 0ms   -> compensation = 0ms.   Arrives at server at 5000 + 0   = 5000ms
    const tieResult = resolveShootoutTimings({
      answerAt: 5100,
      interceptAt: 5000,
      kickerCompensation: 100,
      goalieCompensation: 0,
      isCorrect: true,
      tieWindowMs: 300
    });
    assert(
      tieResult.answerCompensatedAt === 5000 && tieResult.interceptCompensatedAt === 5000,
      `Compensated times should both be 5000ms (got answer ${tieResult.answerCompensatedAt}, intercept ${tieResult.interceptCompensatedAt})`
    );
    assert(tieResult.nearlySimultaneous === true, 'Simultaneous real presses with 200ms RTT difference should resolve as tie');
    console.log('   ✅ PASS: Two players with 200ms different RTT pressing at same real moment resolve as tie');

    // Test 4.3: Player with faster press and much higher RTT still wins when compensated times say so
    // Real physical press: Kicker at T=5000ms, Goalie at T=5400ms (400ms slower press)
    // Kicker RTT = 500ms (high latency, one-way 250ms) -> arrives at server at 5250ms
    // Goalie RTT = 20ms  (low latency, one-way 10ms)   -> arrives at server at 5410ms
    // Note: If Goalie pressed at T=5150ms with 20ms RTT -> Goalie packet arrives at 5160ms (earlier than Kicker's 5250ms arrival!)
    const latencyWinResult = resolveShootoutTimings({
      answerAt: 5250,          // Kicker arrived later raw (5250ms)
      interceptAt: 5160,       // Goalie arrived earlier raw (5160ms)
      kickerCompensation: 250, // Kicker one-way latency compensation
      goalieCompensation: 10,  // Goalie one-way latency compensation
      isCorrect: true,
      tieWindowMs: 50
    });
    // Compensated: Kicker = 5250 - 250 = 5000ms; Goalie = 5160 - 10 = 5150ms
    // Kicker pressed 150ms faster in reality!
    assert(latencyWinResult.answerCompensatedAt === 5000, `Expected kicker compensated 5000, got ${latencyWinResult.answerCompensatedAt}`);
    assert(latencyWinResult.interceptCompensatedAt === 5150, `Expected goalie compensated 5150, got ${latencyWinResult.interceptCompensatedAt}`);
    assert(latencyWinResult.provisional === 'goal', `Kicker should win goal despite arriving later raw, got ${latencyWinResult.provisional}`);
    console.log('   ✅ PASS: Player with faster real press and much higher RTT wins based on compensated time');

    client.close();
  } finally {
    serverProcess.kill('SIGTERM');
  }

  // ---------------------------------------------------------------------------
  // 5. Production must refuse to start with wildcard CORS
  // ---------------------------------------------------------------------------
  console.log('\n🔹 Part 5: Production CORS fail-fast');
  const productionPort = await getFreePort();
  const productionProcess = spawn(
    process.execPath,
    [serverPath],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: String(productionPort),
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  const productionExitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      productionProcess.kill('SIGKILL');
      reject(new Error('Production server did not fail fast without ALLOWED_ORIGINS'));
    }, 10000);
    productionProcess.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  assert(productionExitCode === 1, `Expected exit code 1 without ALLOWED_ORIGINS, got ${productionExitCode}`);
  console.log('   ✅ PASS: Production refuses to start without ALLOWED_ORIGINS');

  console.log('\n================================================================================');
  console.log('🏁 ALL SERVER URL, HARDENING & SESSION TESTS PASSED (100% SUCCESS)');
  console.log('================================================================================\n');

  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

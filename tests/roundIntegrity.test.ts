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

    await test('Round 1 wrong answer opens a one-time steal for the other team at x1', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round1');
      const r1 = state.round1;
      const originalTeam = r1.activeTeam;
      const stealTeam = originalTeam === 'team_a' ? 'team_b' : 'team_a';
      const referee = sockets.find(socket => socket.id === r1.refereePlayerId);
      assert(referee, 'Could not resolve Round 1 referee');

      const stealPromise = waitForRoomState(
        sockets[0],
        room => room.status === 'round1' && !!room.round1.steal
      );
      referee.emit('r1_action_break', { roomCode, actionToken: r1.actionToken });
      const stealing = await stealPromise;
      assert(stealing.round1.activeTeam === stealTeam, 'Steal did not pass to the other team');
      assert(stealing.round1.pendingPoints === 0 && stealing.round1.streak === 0, 'Unbanked streak was not lost');
      assert(stealing.round1.currentQuestionIndex === r1.currentQuestionIndex, 'Steal must reuse the same question');
      assert(stealing.round1.totalQuestionsAnswered === 0, 'Steal must not consume a quota slot yet');

      const stealReferee = sockets.find(socket => socket.id === stealing.round1.refereePlayerId);
      const stealerPlayer = stealing.players.find((p: any) => p.id === stealing.round1.refereePlayerId);
      assert(stealReferee && stealerPlayer?.team === originalTeam, 'Steal judge must come from the team that missed');

      const resolvedPromise = waitForRoomState(
        sockets[0],
        room => room.status === 'round1' && !room.round1.steal && room.round1.totalQuestionsAnswered === 1
      );
      stealReferee.emit('r1_action_score', { roomCode, actionToken: stealing.round1.actionToken });
      const resolved = await resolvedPromise;
      assert(resolved.teams[stealTeam].score === 100, 'Correct steal should award x1 (100) to the stealing team');
      assert(resolved.round1.activeTeam === originalTeam, 'Turn did not return to the original team after the steal');
      assert(resolved.round1.currentQuestionIndex === r1.currentQuestionIndex + 1, 'Next question was not dispatched');
    });

    await test('Rematch: going back to the lobby resets scores, powers and round state', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round1');
      const r1 = state.round1;
      const referee = sockets.find(socket => socket.id === r1.refereePlayerId);
      assert(referee, 'Could not resolve the referee');

      // Score a point through a wrong answer followed by a correct steal (+100 for the other team).
      const stealPromise = waitForRoomState(sockets[0], room => !!room.round1.steal);
      referee.emit('r1_action_break', { roomCode, actionToken: r1.actionToken });
      const stealing = await stealPromise;
      const stealReferee = sockets.find(socket => socket.id === stealing.round1.refereePlayerId);
      assert(stealReferee, 'Could not resolve the steal referee');
      const scoredPromise = waitForRoomState(sockets[0], room => room.teams.team_a.score + room.teams.team_b.score > 0);
      stealReferee.emit('r1_action_score', { roomCode, actionToken: stealing.round1.actionToken });
      await scoredPromise;

      const lobbyPromise = waitForRoomState(sockets[0], room => room.status === 'lobby');
      sockets[0].emit('change_round', { roomCode, targetRound: 'lobby' });
      const lobby = await lobbyPromise;
      assert(lobby.teams.team_a.score === 0 && lobby.teams.team_b.score === 0, 'Scores must be zero after returning to the lobby');
      assert(lobby.round1.totalQuestionsAnswered === 0, 'Round 1 progress must be reset');
      assert(lobby.players.every((player: any) => !player.powerUsed), 'Powers must be available again');
    });

    await test('A judge who reloads the page gets the judge seat back (and the token never leaks)', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const created = await createRoom(sockets[0], 'P1', CHARACTERS[0].id);
      await joinRoom(sockets[1], created.roomCode, 'P2', CHARACTERS[1].id, 'team_a');
      const joinedB1: any = await joinRoom(sockets[2], created.roomCode, 'P3', CHARACTERS[2].id, 'team_b');
      const joinedB2: any = await joinRoom(sockets[3], created.roomCode, 'P4', CHARACTERS[3].id, 'team_b');
      const tokens: Record<string, string> = { [sockets[2].id as string]: joinedB1.playerToken, [sockets[3].id as string]: joinedB2.playerToken };
      const started = waitForRoomState(sockets[0], room => room.status === 'round1' && !!room.round1.refereePlayerId);
      sockets[0].emit('change_round', { roomCode: created.roomCode, targetRound: 'round1' });
      const state = await started;

      const judgeId: string = state.round1.refereePlayerId;
      const judgeSocket = sockets.find(socket => socket.id === judgeId);
      assert(judgeSocket && tokens[judgeId], 'The Round 1 judge should be a Team B player');

      // The judge's page reloads: the connection drops, and after a few seconds the seat is handed to someone else.
      const failover = waitForRoomState(sockets[0], room => !!room.round1.refereePlayerId && room.round1.refereePlayerId !== judgeId, 12000);
      judgeSocket.disconnect();
      const afterFailover = await failover.catch(() => { throw new Error('STEP failover: the seat was not handed to another player'); });
      assert(!JSON.stringify(afterFailover).includes(tokens[judgeId]), 'A player token leaked in the room snapshot');

      // ...they come back with their private token while the same question is open.
      const returned = await opened();
      const rejoined = once<any>(returned, 'rejoined_room');
      const restoredPromise = waitForRoomState(sockets[0], room => room.round1.refereePlayerId === returned.id, 6000);
      returned.emit('rejoin_room', { roomCode: created.roomCode, playerToken: tokens[judgeId] });
      await rejoined.catch(() => { throw new Error('STEP rejoin: rejoined_room never arrived'); });
      const restored = await restoredPromise.catch(() => { throw new Error('STEP restore: the seat was not given back'); });
      assert(restored.round1.refereePlayerId === returned.id, 'The returning judge did not get the seat back');
    });

    await test('Round 1 Bank / Continue belongs to the opposing team only', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round1');
      const r1 = state.round1;
      const socketOf = (playerId: string) => sockets.find(socket => socket.id === playerId);
      const answeringSocket = socketOf(r1.answeringPlayerId);
      const activeTeamSocket = sockets.find(socket => {
        const player = state.players.find((candidate: any) => candidate.id === socket.id);
        return player?.team === r1.activeTeam;
      });
      const opponentSocket = sockets.find(socket => {
        const player = state.players.find((candidate: any) => candidate.id === socket.id);
        return player?.team !== r1.activeTeam;
      });
      assert(answeringSocket && activeTeamSocket && opponentSocket, 'Could not resolve Round 1 bank roles');

      const scoredPromise = waitForRoomState(
        sockets[0],
        room => (room.round1?.pendingPoints || 0) === 100
      );
      const referee = socketOf(r1.refereePlayerId);
      referee.emit('r1_action_score', { roomCode, actionToken: r1.actionToken });
      const scored = await scoredPromise;
      assert(scored.round1.pendingPoints === 100, 'Correct answer did not build the pot');

      await expectErrorMessage(answeringSocket, () => {
        answeringSocket.emit('r1_action_bank', { roomCode });
      }, /الخصم|ممنوع/);
      await expectErrorMessage(activeTeamSocket, () => {
        activeTeamSocket.emit('r1_action_continue', { roomCode });
      }, /الخصم|ممنوع/);

      const bankedPromise = waitForRoomState(
        sockets[0],
        room => room.teams[r1.activeTeam].score === 100 && (room.round1?.pendingPoints || 0) === 0
      );
      opponentSocket.emit('r1_action_bank', { roomCode });
      const banked = await bankedPromise;
      assert(banked.round1.lastDecision === 'bank', 'Bank decision was not recorded');

      await expectErrorMessage(answeringSocket, () => {
        answeringSocket.emit('r1_action_continue', { roomCode });
      }, /الخصم|ممنوع/);

      const continuedPromise = waitForRoomState(
        sockets[0],
        room => room.round1?.lastDecision === 'continue'
      );
      opponentSocket.emit('r1_action_continue', { roomCode });
      await continuedPromise;
    });

    await test('Round 3 hides answers, gates submissions, and rejects unofficial options', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round3');
      const kickerId = state.round3.currentKickerId;
      const goalieId = state.round3.currentGoalieId;
      const judgeId = state.round3.refereePlayerId;
      const kicker = sockets.find(socket => socket.id === kickerId);
      const goalie = sockets.find(socket => socket.id === goalieId);
      const judge = sockets.find(socket => socket.id === judgeId);
      const host = sockets[0];
      assert(kicker && goalie && judge, 'Round 3 roles were not assigned');

      await expectErrorMessage(goalie, () => {
        goalie.emit('r3_start_shootout', { roomCode });
      }, /ممثل الفريق الضارب|الحكم/);

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

      const lockedPromise = waitForRoomState(
        sockets[0],
        room => !!room.round3.pendingAnswer
      );
      kicker.emit('r3_submit_answer', { roomCode, option });
      await lockedPromise;

      await expectErrorMessage(kicker, () => {
        kicker.emit('r3_submit_answer', { roomCode, option: shootout.round3.currentQuestion.options[1] });
      }, /بالفعل/);

      await expectErrorMessage(goalie, () => {
        goalie.emit('r3_record_shot', { roomCode, result: 'goal' });
      }, /الحكم/);

      const settledPromise = waitForRoomState(sockets[0], room => room.round3.turnIndex === 1);
      judge.emit('r3_record_shot', { roomCode, result: 'goal' });
      await settledPromise;
    });

    await test('Powers: Foly re-roll and Touny shield work once in Round 1', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round1');
      const foly = sockets[0];
      const touny = sockets[1];
      const r1 = state.round1;
      assert(r1.answeringPlayerId === foly.id, 'Foly should be the first answering player');

      // Touny is not the answering player, but the shield is for his team's turn.
      await expectErrorMessage(sockets[3], () => {
        sockets[3].emit('use_power', { roomCode });
      }, /مش متاحة/);

      const rerolledPromise = waitForRoomState(
        foly,
        room => room.round1.actionToken !== r1.actionToken && !!room.round1.currentQuestion
      );
      foly.emit('use_power', { roomCode });
      const rerolled = await rerolledPromise;
      assert(rerolled.round1.currentQuestionIndex === r1.currentQuestionIndex, 'Re-roll must not consume a quota slot');
      assert(rerolled.round1.totalQuestionsAnswered === 0, 'Re-roll must not count as an answered question');

      await expectErrorMessage(foly, () => {
        foly.emit('use_power', { roomCode });
      }, /استخدمت/);

      const armedPromise = waitForRoomState(foly, room => room.powerEffects?.team_a?.shield === true);
      touny.emit('use_power', { roomCode });
      await armedPromise;

      const referee = sockets.find(socket => socket.id === rerolled.round1.refereePlayerId);
      assert(referee, 'Could not resolve the referee');
      const afterBreakPromise = waitForRoomState(foly, room => room.round1.totalQuestionsAnswered === 1);
      referee.emit('r1_action_break', { roomCode, actionToken: rerolled.round1.actionToken });
      const afterBreak = await afterBreakPromise;
      assert(!afterBreak.round1.steal, 'A shielded wrong answer must not open a steal');
      assert(afterBreak.round1.activeTeam === 'team_a', 'Shield must keep the turn with the shielded team');
      assert(afterBreak.powerEffects.team_a.shield === false, 'Shield must be spent after absorbing one wrong answer');
    });

    await test('Powers: Barbakh intercepts instantly in Round 3 (no 10 s wait)', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round3');
      const barbakh = sockets[2];
      assert(state.round3.currentGoalieId === barbakh.id, 'Barbakh should be the first goalie');

      const shootoutPromise = waitForRoomState(sockets[0], room => room.round3.phase === 'shootout');
      sockets[0].emit('r3_start_shootout', { roomCode });
      await shootoutPromise;

      const interceptedPromise = waitForRoomState(sockets[0], room => room.round3.interceptBuzzedBy === barbakh.id);
      barbakh.emit('use_power', { roomCode });
      await interceptedPromise;
    });

    await test('Round 3 keeper can only intercept after the 10 s delay', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round3');
      const goalie = sockets.find(socket => socket.id === state.round3.currentGoalieId);
      assert(goalie, 'Round 3 goalie was not assigned');

      const shootoutPromise = waitForRoomState(sockets[0], room => room.round3.phase === 'shootout');
      sockets[0].emit('r3_start_shootout', { roomCode });
      await shootoutPromise;

      await expectErrorMessage(goalie, () => {
        goalie.emit('r3_intercept_buzz', { roomCode });
      }, /الصد يفتح بعد/);

      await delay(10500);
      const interceptedPromise = waitForRoomState(sockets[0], room => !!room.round3.interceptBuzzedBy);
      goalie.emit('r3_intercept_buzz', { roomCode });
      const intercepted = await interceptedPromise;
      assert(intercepted.round3.interceptBuzzedBy === goalie.id, 'Late intercept was not accepted');
    });

    await test('Final tie-break: level after Round 4 plays sudden-death kicks until the totals differ', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const host = sockets[0];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round4');
      assert(state.teams.team_a.score === state.teams.team_b.score, 'Scores should start level');

      const tiePromise = waitForRoomState(host, room => room.status === 'round3' && !!room.round3.finalTieBreak);
      host.emit('change_round', { roomCode, targetRound: 'game_over' });
      const tied = await tiePromise;
      assert(tied.round3.isSuddenDeath && tied.round3.turnIndex === 10, 'Final tie-break must start in sudden death');
      assert(!tied.round3.isComplete, 'Final tie-break must not start complete');

      const playKick = async (expectedTurnIndex: number, result: 'goal' | 'missed', fresh: any) => {
        const kickerId = fresh.round3.currentKickerId;
        const judgeId = fresh.round3.refereePlayerId;
        const kicker = sockets.find(socket => socket.id === kickerId);
        const judge = sockets.find(socket => socket.id === judgeId);
        assert(kicker && judge, 'Final tie-break roles were not assigned');
        const startPromise = waitForRoomState(host, room => room.round3.phase === 'shootout');
        host.emit('r3_start_shootout', { roomCode });
        const started = await startPromise;
        const option = started.round3.currentQuestion.options[0];
        const lockedPromise = waitForRoomState(host, room => !!room.round3.pendingAnswer);
        kicker.emit('r3_submit_answer', { roomCode, option });
        await lockedPromise;
        const settledPromise = waitForRoomState(host, room => room.round3.turnIndex === expectedTurnIndex + 1);
        judge.emit('r3_record_shot', { roomCode, result });
        return settledPromise;
      };

      // Team A scores, Team B misses: totals differ after the pair -> decided.
      const afterA = await playKick(10, 'goal', tied);
      assert(!afterA.round3.isComplete, 'A single kick must not end the final tie-break');
      const selectionPromise = waitForRoomState(host, room => room.round3.phase === 'duelist_selection');
      host.emit('r3_next_shot', { roomCode });
      const selection = await selectionPromise;
      const completePromise = waitForRoomState(host, room => room.round3.isComplete === true);
      await playKick(11, 'missed', selection);
      const done = await completePromise;
      assert(done.round3.finalTieBreakDone === true, 'Final tie-break was not marked done');
      assert(done.teams.team_a.score > done.teams.team_b.score, 'The scoring team must lead after the tie-break');

      const overPromise = waitForRoomState(host, room => room.status === 'game_over');
      host.emit('change_round', { roomCode, targetRound: 'game_over' });
      await overPromise;
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
      const rivalTeamKey = winningTeam === 'team_a' ? 'team_b' : 'team_a';
      const expectedMultiplier = scoreBefore < refState.teams[rivalTeamKey].score ? 2 : 1;
      assert(
        resolved.teams[winningTeam].score === scoreBefore + required * 200 * expectedMultiplier,
        'Auction reward (bid x 200, x2 only when trailing) was not applied'
      );
      assert(resolved.round4.topicId !== topicId, 'Auction topic did not rotate after resolution');
    });

    await test('Round 4 bids can never exceed the number of valid answers', async () => {
      const sockets = [await opened(), await opened(), await opened(), await opened()];
      const { roomCode, state } = await setupFourPlayers(sockets, 'round4');
      const topicId = state.round4.topicId;
      const max = state.round4.currentTopic.maxPossible;
      assert(Number.isInteger(max) && max >= 5, `Topic must expose maxPossible (got ${max})`);
      assert(state.round4.highestBid < max, 'The opening bid must leave room to bid');

      // Teams must alternate (the leading team cannot outbid itself).
      const teamSockets = [sockets[0], sockets[2]]; // team_a host, team_b first player
      let bid = state.round4.highestBid;
      let turn = 0;
      while (bid + 1 <= max) {
        const increment = [5, 2, 1].find(step => bid + step <= max) as number;
        const bidder = teamSockets[turn % 2];
        const raised = waitForRoomState(sockets[0], room => room.round4.highestBid === bid + increment);
        bidder.emit('r4_bid', { roomCode, increment, expectedBid: bid, topicId });
        await raised;
        bid += increment;
        turn += 1;
      }
      assert(bid === max, 'Bidding should be able to reach exactly the number of valid answers');

      const other = teamSockets[turn % 2];
      await expectErrorMessage(other, () => {
        other.emit('r4_bid', { roomCode, increment: 1, expectedBid: bid, topicId });
      }, /الحد الأقصى/);
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

// Dev helper: play a match to the podium with UNEQUAL scores so you can look at the game-over screen.
// 1) node scripts/dev_podium.mjs            -> creates a room with 3 bots and prints the room code
// 2) join that room from your browser as the 4th player (it lands in Team A)
// 3) the script then jumps to Round 4, makes Team A win one auction, and moves to the podium.
// Usage: node scripts/dev_podium.mjs [--server http://localhost:3001]
// Stays connected until Ctrl+C so the room keeps living.
import { io } from 'socket.io-client';

const args = process.argv.slice(2);
const serverIndex = args.indexOf('--server');
const server = serverIndex >= 0 ? args[serverIndex + 1] : 'http://localhost:3001';

const connect = () => new Promise(resolve => {
  const socket = io(server, { transports: ['websocket'] });
  socket.state = null;
  socket.on('room_state_updated', state => { socket.state = state; });
  socket.on('error_message', message => console.log(`[${socket.id}] error: ${message}`));
  socket.on('connect', () => resolve(socket));
});

const waitFor = async (predicate, label, timeoutMs = 120000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for: ${label}`);
};

const host = await connect();
const created = new Promise(resolve => host.once('room_created', resolve));
host.emit('create_room', { playerName: 'كابتن الحيتان', characterId: 'fares_elfouly' });
const { roomCode } = await created;
console.log(`\nROOM CODE: ${roomCode}\nJoin it from the browser now (it will be the 4th player, Team A).\n`);

const bots = [];
for (const [name, characterId, team] of [
  ['بوت الأهلي', 'khaled_elbarbakh', 'team_b'],
  ['بوت الفندقي', 'ziad_elfondoqy', 'team_b']
]) {
  const bot = await connect();
  bot.emit('join_room', { roomCode, playerName: name, characterId, teamPreference: team });
  bots.push(bot);
}

await waitFor(() => host.state?.players?.length === 4, 'the 4th player (you) to join');
console.log('4 players in the room. Jumping to Round 4...');

host.emit('change_round', { roomCode, targetRound: 'round4' });
const r4 = await waitFor(() => host.state?.status === 'round4' && host.state.round4?.topicId && host.state.round4, 'round 4 to start');

host.emit('r4_bid', { roomCode, increment: 1, expectedBid: r4.highestBid, topicId: r4.topicId });
await waitFor(() => host.state.round4.highestBidderTeam === 'team_a', 'Team A bid');
const bid = host.state.round4.highestBid;
host.emit('r4_end_bidding', { roomCode, topicId: r4.topicId });
await waitFor(() => host.state.round4.phase === 'execution', 'execution phase');

const referee = [host, ...bots].find(s => s.id === host.state.round4.refereePlayerId);
await waitFor(() => referee.state?.round4?.currentTopic?.validItems?.length >= bid, 'referee to receive the answer list');
for (const item of referee.state.round4.currentTopic.validItems.slice(0, bid)) {
  referee.emit('r4_toggle_item', { roomCode, item, topicId: r4.topicId });
}
await waitFor(() => (host.state.round4.itemsNamed?.length || 0) >= bid, 'items to be named');
referee.emit('r4_resolve_bid', { roomCode, success: true, topicId: r4.topicId });
await waitFor(() => host.state.teams.team_a.score > host.state.teams.team_b.score, 'Team A to lead');

host.emit('change_round', { roomCode, targetRound: 'game_over' });
await waitFor(() => host.state.status === 'game_over', 'game over');
console.log(`Podium reached. Score: Team A ${host.state.teams.team_a.score} - Team B ${host.state.teams.team_b.score}`);
console.log('Look at the browser. Press Ctrl+C to stop.');
setInterval(() => {}, 60000);

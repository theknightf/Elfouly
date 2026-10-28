// Dev helper: join a room with 3 extra bot players so one browser can play a full 2v2 match.
// Usage: node scripts/dev_bots.mjs QZ-123456 [--server http://localhost:3001]
// The bots stay connected until you press Ctrl+C. They only join; they never answer.
import { io } from 'socket.io-client';

const args = process.argv.slice(2);
const roomCode = args.find(a => a.startsWith('QZ-') || /^[A-Z0-9-]{6,}$/i.test(a));
const serverIndex = args.indexOf('--server');
const server = serverIndex >= 0 ? args[serverIndex + 1] : 'http://localhost:3001';

if (!roomCode) {
  console.error('Usage: node scripts/dev_bots.mjs <ROOM_CODE> [--server http://localhost:3001]');
  process.exit(1);
}

const bots = [
  { name: 'بوت الأهلي', characterId: 'abdelrahman_eltouny', team: 'team_a' },
  { name: 'بوت البربخ', characterId: 'khaled_elbarbakh', team: 'team_b' },
  { name: 'بوت الفندقي', characterId: 'ziad_elfondoqy', team: 'team_b' }
];

for (const bot of bots) {
  const socket = io(server, { transports: ['websocket'] });
  socket.on('connect', () => {
    socket.emit('join_room', { roomCode, playerName: bot.name, characterId: bot.characterId, teamPreference: bot.team });
  });
  socket.on('joined_room', () => console.log(`joined: ${bot.name} -> ${bot.team}`));
  socket.on('error_message', message => console.log(`${bot.name}: ${message}`));
}

// Dev helper: a bot-hosted room where YOUR browser is the first player of Team B.
//   node scripts/dev_room.mjs            -> prints the room code; join it from the browser
//   echo <command> > dev_room.cmd        -> run a command (one per file write)
// Commands:
//   lobby | round1 | round2 | round3 | round4 | game_over   bot host jumps to that round
//   r2skip     the Round 2 judge bot skips the card (rotates the clue-givers)
//   r3start    bot host starts the shot; if the kicker is a bot it answers (first option)
//   r3goal | r3miss   the Round 3 judge bot records the shot
//   r3next     bot host moves to the next shot (duelist selection)
// Bots never answer on their own. Press Ctrl+C to stop.
import fs from 'fs';
import { io } from 'socket.io-client';

const args = process.argv.slice(2);
const serverIndex = args.indexOf('--server');
const server = serverIndex >= 0 ? args[serverIndex + 1] : 'http://localhost:3001';
const cmdFile = 'dev_room.cmd';

const connect = () => new Promise(resolve => {
  const socket = io(server, { transports: ['websocket'] });
  socket.state = null;
  socket.on('room_state_updated', state => { socket.state = state; });
  socket.on('error_message', message => console.log(`error: ${message}`));
  socket.on('connect', () => resolve(socket));
});

const host = await connect();
const created = new Promise(resolve => host.once('room_created', resolve));
host.emit('create_room', { playerName: 'كابتن الحيتان', characterId: 'fares_elfouly' });
const { roomCode } = await created;
console.log(`ROOM CODE: ${roomCode}`);

const bots = [host];
const addBot = async (name, characterId, team) => {
  const bot = await connect();
  bot.emit('join_room', { roomCode, playerName: name, characterId, teamPreference: team });
  bots.push(bot);
};

await addBot('بوت التوني', 'abdelrahman_eltouny', 'team_a');
// You (the browser) must join before the last bot so you are the FIRST player of Team B.
while (host.state?.players?.length !== 3) await new Promise(r => setTimeout(r, 300));
console.log('You joined. Adding the last bot and starting Round 1.');
await addBot('بوت الفندقي', 'ziad_elfondoqy', 'team_b');
while (host.state?.players?.length !== 4) await new Promise(r => setTimeout(r, 300));
host.emit('change_round', { roomCode, targetRound: 'round1' });

const botById = id => bots.find(b => b.id === id);
const state = () => host.state;

const commands = {
  r2skip: () => {
    const referee = botById(state().round2.refereePlayerId);
    if (!referee) return console.log('r2skip: the judge is you, press the skip button yourself');
    referee.emit('r2_skip_card', { roomCode, actionToken: state().round2.actionToken });
  },
  r3start: () => {
    host.emit('r3_start_shootout', { roomCode });
    setTimeout(() => {
      const r3 = state().round3;
      const kicker = botById(r3.currentKickerId);
      const option = botById(r3.refereePlayerId)?.state?.round3?.currentQuestion?.options?.[0] || kicker?.state?.round3?.currentQuestion?.options?.[0];
      if (kicker && option) kicker.emit('r3_submit_answer', { roomCode, option });
      else console.log('r3start: you are the kicker, answer from the browser');
    }, 800);
  },
  r3goal: () => botById(state().round3.refereePlayerId)?.emit('r3_record_shot', { roomCode, result: 'goal' }),
  r3miss: () => botById(state().round3.refereePlayerId)?.emit('r3_record_shot', { roomCode, result: 'missed' }),
  r3next: () => host.emit('r3_next_shot', { roomCode })
};

try { fs.unlinkSync(cmdFile); } catch { /* none yet */ }
setInterval(() => {
  if (!fs.existsSync(cmdFile)) return;
  const command = fs.readFileSync(cmdFile, 'utf8').trim();
  fs.unlinkSync(cmdFile);
  if (!command) return;
  console.log(`command: ${command}`);
  if (commands[command]) commands[command]();
  else host.emit('change_round', { roomCode, targetRound: command });
}, 500);

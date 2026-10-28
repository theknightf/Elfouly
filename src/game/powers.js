/**
 * src/game/powers.js
 *
 * One active power per player, usable ONCE per match, and only in the round(s)
 * it was designed for. Framework-free so the Socket.IO server, the Supabase
 * provider and the offline mode all enforce the exact same rules.
 *
 * State lives on the room:
 *   player.powerUsed                      -> spent?
 *   room.powerEffects[team].shield        -> next wrong answer in Round 1 costs nothing
 *   room.powerEffects[team].firewall      -> next point loss (R2 foul / R4 failed bid) is cancelled
 *   room.powerEffects[team].turbo         -> next Password card / auction win pays x1.5
 *   room.powerEffects.bidLock[team]       -> timestamp until which the team cannot bid
 */

export const POWER_RULES = Object.freeze({
  FREEZE_SECONDS: 10,
  BID_LOCK_MS: 10000,
  TURBO_MULTIPLIER: 1.5
});

export const POWERS = Object.freeze({
  fares_elfouly: {
    id: 'reroll',
    icon: '🧭',
    title: 'بوصلة الفولي: غيّر السؤال',
    description: 'بدّل السؤال الحالي بسؤال جديد (جولة 1 أو 3).',
    rounds: ['round1', 'round3']
  },
  abdelrahman_eltouny: {
    id: 'shield',
    icon: '🍦',
    title: 'درع بيلافيتا',
    description: 'أول إجابة غلط بعد التفعيل في جولة 1 متكلّفكش ستريك ولا سرقة.',
    rounds: ['round1']
  },
  khaled_elbarbakh: {
    id: 'wall',
    icon: '🛡️',
    title: 'حائط البربخ: صد فوري',
    description: 'اعترض الركلة فورًا من غير ما تستنى 10 ثواني (جولة 3).',
    rounds: ['round3']
  },
  ziad_elfondoqy: {
    id: 'freeze',
    icon: '🛎️',
    title: 'تجميد الوقت الفندقي',
    description: 'زوّد +10 ثواني على البطاقة الحالية (جولة 2).',
    rounds: ['round2']
  },
  eyad_amr: {
    id: 'firewall',
    icon: '🦁',
    title: 'جدار الأسد',
    description: 'يلغي أول خصم نقاط (مخالفة جولة 2 أو مزاد فاشل جولة 4).',
    rounds: ['round2', 'round4']
  },
  mazen_elgamer: {
    id: 'lock',
    icon: '🕹️',
    title: 'قفل السايبر',
    description: 'امنع الفريق الخصم من المزايدة 10 ثواني (جولة 4).',
    rounds: ['round4']
  },
  ali_ahmed: {
    id: 'turbo',
    icon: '🏎️',
    title: 'توربو علي ×1.5',
    description: 'أول بطاقة سر صح أو مزاد ناجح بعد التفعيل بيدفع ×1.5.',
    rounds: ['round2', 'round4']
  }
});

/** power id -> power (custom characters choose one of these) */
export const POWER_BY_ID = Object.freeze(Object.fromEntries(Object.values(POWERS).map(power => [power.id, power])));

const TEAM_KEYS = ['team_a', 'team_b'];
const otherTeamKey = (team) => (team === 'team_a' ? 'team_b' : 'team_a');

export const getPowerForPlayer = (player) =>
  POWER_BY_ID[player?.character?.powerId] || POWERS[player?.character?.id] || null;

export const createPowerEffects = () => ({
  team_a: { shield: false, firewall: false, turbo: false },
  team_b: { shield: false, firewall: false, turbo: false },
  bidLock: { team_a: 0, team_b: 0 }
});

/** Deep copy for immutable state (offline mode). */
export const clonePowerEffects = (effects) => JSON.parse(JSON.stringify(effects || createPowerEffects()));

export const ensurePowerState = (room) => {
  if (!room.powerEffects) room.powerEffects = createPowerEffects();
  return room.powerEffects;
};

/** New match: every power is available again and nothing is armed. */
export const resetPowers = (room) => {
  for (const player of room.players || []) player.powerUsed = false;
  room.powerEffects = null;
  ensurePowerState(room);
};

/** Pure check: can this player fire their power right now? */
export const canUsePower = (room, playerId) => {
  const player = (room.players || []).find(p => p.id === playerId);
  const power = getPowerForPlayer(player);
  if (!player || !power) return { ok: false, reason: 'مفيش قدرة خاصة للاعب ده.' };
  if (player.powerUsed) return { ok: false, reason: 'استخدمت قدرتك الخاصة قبل كده (مرة واحدة في الماتش).', power };
  if (!power.rounds.includes(room.status)) return { ok: false, reason: 'القدرة دي مش متاحة في الجولة الحالية.', power };

  const effects = ensurePowerState(room);
  const team = player.team;

  switch (power.id) {
    case 'reroll': {
      if (room.status === 'round1') {
        const r1 = room.round1 || {};
        if (!r1.currentQuestion || !r1.actionToken || r1.steal) return { ok: false, reason: 'مفيش سؤال جولة 1 نشط تغيّره.', power };
        if (player.id !== r1.answeringPlayerId) return { ok: false, reason: 'بس اللاعب المجاوب يغيّر السؤال.', power };
        return { ok: true, power };
      }
      const r3 = room.round3 || {};
      if (r3.phase !== 'shootout' || r3.pendingAnswer || !r3.currentQuestion) return { ok: false, reason: 'غيّر السؤال قبل ما تجاوب في الركلة.', power };
      if (player.id !== r3.currentKickerId) return { ok: false, reason: 'بس المسدد يغيّر سؤال الركلة.', power };
      return { ok: true, power };
    }
    case 'shield': {
      const r1 = room.round1 || {};
      if (team !== r1.activeTeam || r1.steal || !r1.currentQuestion) return { ok: false, reason: 'الدرع بيتفعّل في دور فريقك.', power };
      if (effects[team].shield) return { ok: false, reason: 'الدرع مفعّل بالفعل.', power };
      return { ok: true, power };
    }
    case 'wall': {
      const r3 = room.round3 || {};
      if (r3.phase !== 'shootout' || r3.interceptBuzzedBy || r3.pendingAnswer) return { ok: false, reason: 'مفيش ركلة تقدر تصدّها دلوقتي.', power };
      if (player.id !== r3.currentGoalieId) return { ok: false, reason: 'بس الحارس الحالي يستخدم الصد الفوري.', power };
      return { ok: true, power };
    }
    case 'freeze': {
      const r2 = room.round2 || {};
      if (!r2.currentWord || r2.isComplete) return { ok: false, reason: 'مفيش بطاقة شغالة تجمّد وقتها.', power };
      if (![r2.activeClueGiverA, r2.activeClueGiverB].includes(player.id)) return { ok: false, reason: 'بس مرشدا البطاقة الحالية يجمّدوا الوقت.', power };
      return { ok: true, power };
    }
    case 'firewall':
    case 'turbo': {
      if (effects[team][power.id]) return { ok: false, reason: 'القدرة مفعّلة بالفعل.', power };
      return { ok: true, power };
    }
    case 'lock': {
      const r4 = room.round4 || {};
      if (r4.phase !== 'bidding') return { ok: false, reason: 'القفل بيشتغل في وقت المزايدة بس.', power };
      return { ok: true, power };
    }
    default:
      return { ok: false, reason: 'قدرة غير معروفة.', power };
  }
};

/**
 * Fire the power. `hooks.rerollR1(room)` / `hooks.rerollR3(room)` are provided
 * by each provider (they know how to draw a question) and return true/false.
 * The power is only consumed when the effect really happened.
 */
export const applyPower = (room, playerId, hooks = {}, now = Date.now()) => {
  const check = canUsePower(room, playerId);
  if (!check.ok) return check;

  const player = room.players.find(p => p.id === playerId);
  const power = check.power;
  const effects = ensurePowerState(room);
  const team = player.team;

  switch (power.id) {
    case 'reroll': {
      const done = room.status === 'round1' ? hooks.rerollR1?.(room) : hooks.rerollR3?.(room);
      if (!done) return { ok: false, reason: 'مفيش سؤال بديل متاح دلوقتي.', power };
      break;
    }
    case 'shield':
    case 'firewall':
    case 'turbo':
      effects[team][power.id] = true;
      break;
    case 'wall': {
      const r3 = room.round3;
      r3.interceptBuzzedBy = player.id;
      r3.interceptAt = now;
      r3.interceptCompensatedAt = now;
      r3.goalieCompensation = 0;
      break;
    }
    case 'freeze': {
      const r2 = room.round2;
      r2.timer = (r2.timer || 45) + POWER_RULES.FREEZE_SECONDS;
      if (r2.endTime) r2.endTime += POWER_RULES.FREEZE_SECONDS * 1000;
      r2.timeFreezeUsed = true;
      break;
    }
    case 'lock':
      effects.bidLock[otherTeamKey(team)] = now + POWER_RULES.BID_LOCK_MS;
      break;
    default:
      return { ok: false, reason: 'قدرة غير معروفة.', power };
  }

  player.powerUsed = true;
  return { ok: true, power, player };
};

// ---- consumption points (called from the round handlers) ----

/** True only for El-Fondoqy while his freeze can actually be used (drives the Password freeze button). */
export const canFreezeNow = (room, playerId) => {
  const check = canUsePower(room, playerId);
  return check.ok && check.power.id === 'freeze';
};

/** Round 1 wrong answer: true if the team's shield absorbed it (and is now spent). */
export const takeShield = (room, team) => {
  const effects = ensurePowerState(room);
  if (!TEAM_KEYS.includes(team) || !effects[team].shield) return false;
  effects[team].shield = false;
  return true;
};

/** Point loss for `team`: returns the loss to apply (0 if the firewall absorbed it). */
export const applyFirewall = (room, team, loss) => {
  const effects = ensurePowerState(room);
  if (!(loss > 0) || !TEAM_KEYS.includes(team) || !effects[team].firewall) return loss;
  effects[team].firewall = false;
  return 0;
};

/** Points earned by `team`: returns the (possibly x1.5) reward. */
export const applyTurbo = (room, team, points) => {
  const effects = ensurePowerState(room);
  if (!(points > 0) || !TEAM_KEYS.includes(team) || !effects[team].turbo) return points;
  effects[team].turbo = false;
  return Math.round(points * POWER_RULES.TURBO_MULTIPLIER);
};

export const bidLockedMs = (room, team, now = Date.now()) =>
  Math.max(0, (ensurePowerState(room).bidLock?.[team] || 0) - now);

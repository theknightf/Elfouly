import assert from 'node:assert/strict';
import { MAX_SPECIALTIES, buildPlayerCharacter, normalizeSpecialties } from '../src/game/characterBuilder';
import { canUsePower, getPowerForPlayer } from '../src/game/powers';
// @ts-expect-error plain JS engine used by the server
import { triviaEngine } from '../services/triviaEngine.js';
import { drawLocalQuestion } from '../src/utils/localQuestionEngine';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const validCustom = { name: 'الصقر', avatar: '🦅', color: '#FFC857', powerId: 'shield', specialties: ['dentistry', 'fitness_gym'] };

test('a custom character needs a name, a known power and at least one category', () => {
  assert.ok(buildPlayerCharacter({ custom: validCustom }).character);
  assert.ok(buildPlayerCharacter({ custom: { ...validCustom, name: '   ' } }).error);
  assert.ok(buildPlayerCharacter({ custom: { ...validCustom, powerId: 'laser' } }).error);
  assert.ok(buildPlayerCharacter({ custom: { ...validCustom, specialties: [] } }).error);
  assert.ok(buildPlayerCharacter({ custom: { ...validCustom, specialties: ['not_a_category'] } }).error);
});

test('names and catchphrases are cleaned; unknown avatar and colour fall back', () => {
  const { character } = buildPlayerCharacter({
    custom: { ...validCustom, name: '<b>صقر</b>‮ الجبل', catchphrase: '<script>x</script>مرحبا', avatar: '<img>', color: 'red' }
  }) as any;
  assert.equal(character.name.includes('<'), false);
  assert.equal(character.name.includes('‮'), false);
  assert.equal(character.catchphrase.includes('<'), false);
  assert.equal(character.avatar, '🦅');
  assert.equal(character.color, '#4CC9F0');
});

test('at most 3 unique known categories are kept', () => {
  assert.equal(MAX_SPECIALTIES, 3);
  const list = normalizeSpecialties(['dentistry', 'dentistry', 'fitness_gym', 'cars_mechanics', 'islamic_studies', 'bogus']);
  assert.deepEqual(list, ['dentistry', 'fitness_gym', 'cars_mechanics']);
  assert.deepEqual(normalizeSpecialties([], ['general_knowledge']), ['general_knowledge']);
});

test('a built-in character can take the categories its player knows', () => {
  const { character } = buildPlayerCharacter({ characterId: 'ali_ahmed', specialties: ['islamic_studies', 'reflex_trivia'] }) as any;
  assert.equal(character.id, 'ali_ahmed');
  assert.deepEqual(character.attributes, ['islamic_studies', 'reflex_trivia']);
  const untouched = buildPlayerCharacter({ characterId: 'ali_ahmed' }) as any;
  assert.deepEqual(untouched.character.attributes, ['dentistry', 'cars_mechanics', 'fitness_gym']);
  assert.ok(buildPlayerCharacter({ characterId: 'nobody' }).error);
});

test('the shared character list is not mutated by a player customising it', () => {
  buildPlayerCharacter({ characterId: 'ali_ahmed', specialties: ['islamic_studies'] });
  const again = buildPlayerCharacter({ characterId: 'ali_ahmed' }) as any;
  assert.deepEqual(again.character.attributes, ['dentistry', 'cars_mechanics', 'fitness_gym']);
});

test('a custom character uses the power it chose', () => {
  const { character } = buildPlayerCharacter({ custom: { ...validCustom, powerId: 'shield' } }) as any;
  const player = { id: 'p1', team: 'team_a', character };
  assert.equal(getPowerForPlayer(player)?.id, 'shield');
  const room: any = {
    status: 'round1',
    players: [player],
    round1: { activeTeam: 'team_a', currentQuestion: { question: 'q' }, actionToken: 't', steal: null }
  };
  assert.equal(canUsePower(room, 'p1').ok, true);
  room.status = 'round2';
  assert.equal(canUsePower(room, 'p1').ok, false, 'a Round 1 power is not usable in Round 2');
});

test('specialty questions come from the categories the player chose (server engine)', () => {
  for (let i = 0; i < 6; i += 1) {
    const q = triviaEngine.getQuestionBySlot({ roomId: `spec-${i}`, characterId: ['dentistry'], mode: 'one_two_bank', slotType: 'specialty' });
    assert.ok(q, 'a dentistry question should exist');
    assert.equal(q.category, 'dentistry');
  }
});

test('specialty questions come from the categories the player chose (offline engine)', () => {
  for (let i = 0; i < 4; i += 1) {
    const q: any = drawLocalQuestion({ roomId: `local-spec-${i}`, mode: 'one_two_bank', slotType: 'specialty', characterId: ['fitness_gym'] as any });
    assert.ok(q);
    assert.equal(q.category, 'fitness_gym');
  }
});

console.log(`\nAll ${passed} custom character tests passed.`);

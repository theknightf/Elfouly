import questionsBank from '../../data/questions_bank.json';
import { CHARACTERS } from '../data/characters';

const FOOTBALL_CATEGORY_HINTS = ['football', 'barcelona', 'ahly', 'real_madrid', 'champions'];
const PRE_2010_YEAR_PATTERN = /\b(1\d{3}|200\d)\b/;

const CATEGORY_ALIASES = {
  football_post_2010: [
    'football_post_2010',
    'barcelona_post_2010',
    'ahly_post_2010',
    'real_madrid_post_2010',
    'football_legends_post_2010',
    'european_champions_post_2010',
    'football'
  ],
  general_knowledge: ['general_knowledge', 'general', 'egyptian_culture'],
  popular_foreign_series: ['popular_foreign_series', 'foreign_tv_series', 'drama_series'],
  series_breaking_bad: ['series_breaking_bad', 'breaking_bad_series', 'foreign_tv_series'],
  gelato_sweets: ['gelato_sweets', 'gelato_and_desserts'],
  veterinary_biology: ['veterinary_biology', 'veterinary_medicine'],
  veterinary_medicine: ['veterinary_medicine', 'veterinary_biology'],
  pc_hardware_gaming: ['pc_hardware_gaming', 'pc_hardware', 'fifa_gaming', 'gaming_consoles'],
  gaming_tech: ['gaming_tech', 'cybersecurity', 'tech_networking', 'pc_hardware'],
  cars_mechanics: ['cars_mechanics', 'cars_and_engine_mechanics'],
  islamic_studies: ['islamic_studies', 'islamic_culture'],
  islamic_culture: ['islamic_culture', 'islamic_studies'],
  console_pc_gaming: ['console_pc_gaming', 'gaming_consoles', 'fifa_gaming']
};

const servedByRoom = new Map();

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function collectText(value, target) {
  if (typeof value === 'string') {
    target.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectText(entry, target);
  }
}

export function isServableQuestion(question) {
  if (!question) return false;
  const category = String(question.category || '').toLowerCase();
  const isFootball = question.is_post_2010_football === true ||
    question.is_post_2010_football === 1 ||
    FOOTBALL_CATEGORY_HINTS.some(hint => category.includes(hint));

  if (!isFootball) return true;
  if (question.is_post_2010_football !== true && question.is_post_2010_football !== 1) return false;

  const values = [];
  for (const field of [
    question.question_text,
    question.question,
    question.correct_answer,
    question.answer,
    question.options,
    question.acceptable_answers,
    question.forbidden_words,
    question.target_word,
    question.target
  ]) {
    collectText(field, values);
  }
  return !values.some(value => PRE_2010_YEAR_PATTERN.test(value));
}

export function getCharacterAttributes(characterId) {
  const character = CHARACTERS.find(char => char.id === characterId);
  return character?.attributes?.length ? character.attributes : ['general_knowledge'];
}

export function buildLocalR1TurnPlan(characterId) {
  const categories = [...new Set(getCharacterAttributes(characterId))];
  const shuffledCategories = shuffleArray(categories);
  const specialtySlots = [0, 1, 2].map(index => ({
    slotType: 'specialty',
    category: shuffledCategories[index % shuffledCategories.length]
  }));
  const randomSlots = [0, 1, 2].map(() => ({ slotType: 'random' }));
  return shuffleArray([...specialtySlots, ...randomSlots]);
}

export function resetLocalQuestionSession(roomId = 'local_room') {
  servedByRoom.delete(roomId);
}

function getServedSet(roomId) {
  if (!servedByRoom.has(roomId)) servedByRoom.set(roomId, new Set());
  return servedByRoom.get(roomId);
}

function matchesCategory(question, category) {
  if (category === 'football_post_2010' && question.is_post_2010_football) return true;
  if (question.category === category) return true;
  return (CATEGORY_ALIASES[category] || []).includes(question.category);
}

function pickUnserved(mode, categories, served) {
  for (const category of categories) {
    const candidates = questionsBank.filter(question =>
      question.mode === mode &&
      matchesCategory(question, category) &&
      !served.has(question.id) &&
      isServableQuestion(question)
    );
    if (candidates.length > 0) return shuffleArray(candidates)[0];
  }
  return null;
}

function pickRandomUnserved(mode, served) {
  const candidates = questionsBank.filter(question =>
    question.mode === mode &&
    !served.has(question.id) &&
    isServableQuestion(question)
  );
  return candidates.length > 0 ? shuffleArray(candidates)[0] : null;
}

export function drawLocalQuestion({
  roomId = 'local_room',
  mode,
  slotType = 'random',
  characterId,
  category
}) {
  const served = getServedSet(roomId);
  let question = null;

  if (slotType === 'specialty') {
    const categories = category ? [category] : getCharacterAttributes(characterId);
    question = pickUnserved(mode, categories, served);
  } else {
    if (category) question = pickUnserved(mode, [category], served);
    if (!question) question = pickRandomUnserved(mode, served);
  }

  if (question) served.add(question.id);
  return question;
}

export function drawLocalR1Question(options) {
  return drawLocalQuestion(options);
}

export function drawLocalRandomQuestion(mode, roomId = 'local_room') {
  return drawLocalQuestion({ roomId, mode, slotType: 'random' });
}

export function drawLocalCategoryQuestion(mode, category, roomId = 'local_room') {
  return drawLocalQuestion({ roomId, mode, slotType: 'specialty', category });
}

export function shuffleLocal(items) {
  return shuffleArray(items);
}

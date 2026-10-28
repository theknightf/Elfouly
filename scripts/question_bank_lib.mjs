// Shared rules for the question bank (data/questions_bank.json).
// Used by clean_question_bank.mjs, validate_question_bank.mjs and add_questions.mjs.
import crypto from 'crypto';

export const MODES = Object.freeze({
  BANK: 'one_two_bank',        // Round 1: open question, judge reads the answer
  PASSWORD: 'edini_fi_seri',   // Round 2: secret word + 4 forbidden words
  PENALTY: 'hat_fi_qoraybi',   // Round 3: multiple choice (4 options)
  AUCTION: 'meen_yezawwed'     // Round 4: "name N items" list
});

// Old slug -> canonical slug (+ optional club/sub-topic tag).
export const CATEGORY_MERGES = Object.freeze({
  ahly_post_2010: { category: 'football_post_2010', subtopic: 'ahly' },
  barcelona_post_2010: { category: 'football_post_2010', subtopic: 'barcelona' },
  real_madrid_post_2010: { category: 'football_post_2010', subtopic: 'real_madrid' },
  european_champions_post_2010: { category: 'football_post_2010', subtopic: 'ucl' },
  football_legends_post_2010: { category: 'football_post_2010', subtopic: 'legends' },
  cars_and_engine_mechanics: { category: 'cars_mechanics' },
  gelato_and_desserts: { category: 'gelato_sweets' },
  islamic_culture: { category: 'islamic_studies' },
  foreign_tv_series: { category: 'popular_foreign_series' },
  gaming_consoles: { category: 'console_pc_gaming' },
  pc_hardware: { category: 'pc_hardware_gaming' },
  egyptian_culture: { category: 'general_knowledge' },
  veterinary_medicine: { category: 'veterinary_biology' }
});

// The only categories a question may use. Keep in sync with src/data/characters.js.
export const KNOWN_CATEGORIES = Object.freeze([
  'football_post_2010',
  'capitals_and_flags',
  'general_knowledge',
  'reflex_trivia',
  'veterinary_biology',
  'gelato_sweets',
  'islamic_studies',
  'pc_hardware_gaming',
  'console_pc_gaming',
  'gaming_tech',
  'cybersecurity',
  'tech_networking',
  'series_breaking_bad',
  'popular_foreign_series',
  'health_sciences_lab',
  'dentistry',
  'cars_mechanics',
  'fitness_gym'
]);

export const SUBTOPICS = Object.freeze(['ahly', 'barcelona', 'real_madrid', 'ucl', 'legends']);

// Hard minimum so a bid (starting at 3) is always possible; aim for 10+ for a fun auction.
export const MIN_AUCTION_ITEMS = 5;

export const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s‏‎]+/g, ' ')
    .replace(/[؟?!.,،:؛"'()]/g, '');

export const contentHash = (q) =>
  crypto.createHash('md5').update(`${q.mode}|${normalizeText(q.question_text)}`).digest('hex');

export const canonicalCategory = (category) => CATEGORY_MERGES[category]?.category || category;

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/** Returns a list of human-readable problems (empty = valid). */
export function validateQuestion(q) {
  const errors = [];
  if (!Object.values(MODES).includes(q.mode)) errors.push(`mode must be one of ${Object.values(MODES).join(', ')}`);
  if (!KNOWN_CATEGORIES.includes(q.category)) errors.push(`unknown category "${q.category}"`);
  if (!nonEmpty(q.question_text)) errors.push('question_text is empty');
  if (q.subtopic != null && !SUBTOPICS.includes(q.subtopic)) errors.push(`unknown subtopic "${q.subtopic}"`);
  if (q.subtopic != null && q.category !== 'football_post_2010') errors.push('subtopic is only for football_post_2010');

  switch (q.mode) {
    case MODES.BANK:
      if (!nonEmpty(q.correct_answer)) errors.push('correct_answer is required');
      if (q.options) errors.push('Bank questions are open-ended: options must be null');
      break;
    case MODES.PENALTY: {
      if (!nonEmpty(q.correct_answer)) errors.push('correct_answer is required');
      const options = Array.isArray(q.options) ? q.options : [];
      if (options.length !== 4) errors.push(`needs exactly 4 options (has ${options.length})`);
      if (new Set(options.map(normalizeText)).size !== options.length) errors.push('options must be unique');
      if (!options.includes(q.correct_answer)) errors.push('correct_answer must be one of the options (exact text)');
      break;
    }
    case MODES.PASSWORD: {
      const forbidden = Array.isArray(q.forbidden_words) ? q.forbidden_words : [];
      if (forbidden.length !== 4) errors.push(`needs exactly 4 forbidden_words (has ${forbidden.length})`);
      if (new Set(forbidden.map(normalizeText)).size !== forbidden.length) errors.push('forbidden_words must be unique');
      const word = normalizeText(q.question_text);
      if (forbidden.some(f => normalizeText(f) === word)) errors.push('a forbidden word equals the secret word');
      if (!nonEmpty(q.correct_answer) || normalizeText(q.correct_answer) !== word) {
        errors.push('correct_answer must equal question_text for Password cards');
      }
      break;
    }
    case MODES.AUCTION: {
      const items = Array.isArray(q.acceptable_answers) ? q.acceptable_answers : [];
      if (items.length < MIN_AUCTION_ITEMS) errors.push(`needs at least ${MIN_AUCTION_ITEMS} acceptable_answers (has ${items.length})`);
      if (new Set(items.map(normalizeText)).size !== items.length) errors.push('acceptable_answers must be unique');
      break;
    }
    default:
      break;
  }

  if (q.category === 'football_post_2010' && q.is_post_2010_football !== true) {
    errors.push('football questions must have is_post_2010_football: true (and only post-2010 facts)');
  }
  return errors;
}

/** Duplicate key: same normalized text, any mode. */
export const duplicateKey = (q) => normalizeText(q.question_text);

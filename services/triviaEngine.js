/**
 * services/triviaEngine.js - In-Game Dynamic Specialty Engine ("القلاية")
 * Targeted Question Dispatcher & Infinite Bank for QUIZ ARENA (ساحة الكويز)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BANK_PATH = path.resolve(__dirname, '../data/questions_bank.json');

export const CHARACTER_ATTRIBUTES = {
  fares_elfouly: [
    'football_post_2010',
    'capitals_and_flags',
    'general_knowledge'
  ],
  fares: [
    'football_post_2010',
    'capitals_and_flags',
    'general_knowledge'
  ],
  ziad_elfondoqy: [
    'popular_foreign_series',
    'football_post_2010',
    'general_knowledge'
  ],
  ziad_ashraf: [
    'popular_foreign_series',
    'football_post_2010',
    'general_knowledge'
  ],
  ziad: [
    'popular_foreign_series',
    'football_post_2010',
    'general_knowledge'
  ],
  abdelrahman_eltouny: [
    'veterinary_biology',
    'gelato_sweets',
    'football_post_2010',
    'islamic_studies'
  ],
  eltouny: [
    'veterinary_biology',
    'gelato_sweets',
    'football_post_2010',
    'islamic_studies'
  ],
  khaled_elbarbakh: [
    'veterinary_medicine',
    'pc_hardware_gaming',
    'series_breaking_bad',
    'football_post_2010',
    'islamic_culture'
  ],
  khaled: [
    'veterinary_medicine',
    'pc_hardware_gaming',
    'series_breaking_bad',
    'football_post_2010',
    'islamic_culture'
  ],
  eyad_amr: [
    'football_post_2010',
    'general_knowledge',
    'gaming_tech'
  ],
  eyad_mohamed: [
    'football_post_2010',
    'general_knowledge',
    'gaming_tech'
  ],
  eyad: [
    'football_post_2010',
    'general_knowledge',
    'gaming_tech'
  ],
  mazen_elgamer: [
    'health_sciences_lab',
    'console_pc_gaming',
    'reflex_trivia'
  ],
  mazen_hazem: [
    'health_sciences_lab',
    'console_pc_gaming',
    'reflex_trivia'
  ],
  mazen: [
    'health_sciences_lab',
    'console_pc_gaming',
    'reflex_trivia'
  ],
  ali_ahmed: [
    'dentistry',
    'cars_mechanics',
    'fitness_gym'
  ],
  ali: [
    'dentistry',
    'cars_mechanics',
    'fitness_gym'
  ]
};

const FOOTBALL_CATEGORY_HINTS = [
  'football',
  'barcelona',
  'ahly',
  'real_madrid',
  'european_champions'
];

export const PRE_2010_YEAR_PATTERN = /\b(1\d{3}|200\d)\b/;

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function collectTextValues(value, target) {
  if (typeof value === 'string') {
    target.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectTextValues(entry, target);
  }
}

export function isFootballQuestion(question) {
  if (!question) return false;
  if (question.is_post_2010_football === true || question.is_post_2010_football === 1) {
    return true;
  }
  const category = String(question.category || '').toLowerCase();
  return FOOTBALL_CATEGORY_HINTS.some(hint => category.includes(hint));
}

export function findPre2010FootballReference(question) {
  if (!question || !isFootballQuestion(question)) return null;

  const fields = [
    question.question_text,
    question.question,
    question.correct_answer,
    question.answer,
    question.options,
    question.acceptable_answers,
    question.forbidden_words,
    question.target_word,
    question.target
  ];
  const values = [];
  for (const field of fields) collectTextValues(field, values);

  for (const value of values) {
    const match = value.match(PRE_2010_YEAR_PATTERN);
    if (match) return match[0];
  }
  return null;
}

const VALID_MODES = new Set(['one_two_bank', 'edini_fi_seri', 'hat_fi_qoraybi', 'meen_yezawwed']);
const PLACEHOLDER_PATTERN = /سؤال إضافي متقدم|إجابة صحيحة نموذجية|^خيار\s*\d+$|^ممنوع\s*\d+$|^عنصر\s*\d+$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUniqueStrings(value, minimum) {
  if (!Array.isArray(value)) return false;
  const strings = value.filter(isNonEmptyString).map(item => item.trim());
  return strings.length >= minimum && new Set(strings).size === strings.length;
}

function hasPlaceholderContent(value) {
  if (typeof value === 'string') return PLACEHOLDER_PATTERN.test(value.trim());
  if (Array.isArray(value)) return value.some(hasPlaceholderContent);
  return false;
}

export function isServableQuestion(question) {
  if (!question || typeof question !== 'object') return false;
  if (!VALID_MODES.has(question.mode)) return false;
  if (!isNonEmptyString(question.id) || !isNonEmptyString(question.category) || !isNonEmptyString(question.question_text)) {
    return false;
  }
  if (hasPlaceholderContent(question.question_text)
    || hasPlaceholderContent(question.correct_answer)
    || hasPlaceholderContent(question.options)
    || hasPlaceholderContent(question.forbidden_words)
    || hasPlaceholderContent(question.acceptable_answers)) {
    return false;
  }

  if (question.mode === 'edini_fi_seri' && !hasUniqueStrings(question.forbidden_words, 4)) return false;
  if (question.mode === 'meen_yezawwed' && !hasUniqueStrings(question.acceptable_answers, 3)) return false;
  if (question.mode === 'hat_fi_qoraybi') {
    if (!hasUniqueStrings(question.options, 2) || !question.options.includes(question.correct_answer)) return false;
  }
  if ((question.mode === 'one_two_bank' || question.mode === 'hat_fi_qoraybi') && !isNonEmptyString(question.correct_answer)) {
    return false;
  }

  if (isFootballQuestion(question)) {
    if (question.is_post_2010_football !== true && question.is_post_2010_football !== 1) {
      return false;
    }
    if (findPre2010FootballReference(question) !== null) return false;
  }

  return true;
}

export function buildRound1TurnPlan(characterId) {
  const characterCategories = [...new Set(
    (CHARACTER_ATTRIBUTES[characterId] || ['general_knowledge']).filter(Boolean)
  )];
  const shuffledCategories = shuffleArray(characterCategories);
  const specialtySlots = [0, 1, 2].map(index => ({
    slotType: 'specialty',
    category: shuffledCategories[index % shuffledCategories.length]
  }));
  const randomSlots = [0, 1, 2].map(() => ({ slotType: 'random' }));
  return shuffleArray([...specialtySlots, ...randomSlots]);
}

// Category Aliases mapping for flexible DB item matching
export const CATEGORY_ALIASES = {
  football_post_2010: [
    'football_post_2010',
    'barcelona_post_2010',
    'ahly_post_2010',
    'real_madrid_post_2010',
    'football_legends_post_2010',
    'european_champions_post_2010',
    'football'
  ],
  general_knowledge: [
    'general_knowledge',
    'general',
    'egyptian_culture'
  ],
  popular_foreign_series: [
    'popular_foreign_series',
    'foreign_tv_series',
    'drama_series'
  ],
  series_breaking_bad: [
    'series_breaking_bad',
    'breaking_bad_series',
    'foreign_tv_series'
  ],
  gelato_sweets: [
    'gelato_sweets',
    'gelato_and_desserts'
  ],
  veterinary_biology: [
    'veterinary_biology',
    'veterinary_medicine'
  ],
  veterinary_medicine: [
    'veterinary_medicine',
    'veterinary_biology'
  ],
  pc_hardware_gaming: [
    'pc_hardware_gaming',
    'pc_hardware',
    'fifa_gaming',
    'gaming_consoles'
  ],
  gaming_tech: [
    'gaming_tech',
    'cybersecurity',
    'tech_networking',
    'pc_hardware'
  ],
  cars_mechanics: [
    'cars_mechanics',
    'cars_and_engine_mechanics'
  ],
  islamic_studies: [
    'islamic_studies',
    'islamic_culture'
  ],
  islamic_culture: [
    'islamic_culture',
    'islamic_studies'
  ],
  console_pc_gaming: [
    'console_pc_gaming',
    'gaming_consoles',
    'fifa_gaming'
  ]
};

export class TriviaEngine {
  constructor() {
    this.inMemoryBank = [];
    this.servedQuestionsByRoom = new Map();
    this.backgroundReplenishing = new Set();
    this.threshold = 20;
    this.loadInitialBank();
  }

  loadInitialBank() {
    try {
      const bankPath = BANK_PATH;
      if (fs.existsSync(bankPath)) {
        const raw = fs.readFileSync(bankPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const valid = Array.isArray(parsed) ? parsed.filter(isServableQuestion) : [];
        const rejected = Array.isArray(parsed) ? parsed.length - valid.length : 0;
        this.inMemoryBank = valid;
        console.log(`[TriviaEngine] Loaded ${valid.length} questions from local bank${rejected ? ` (ignored ${rejected} invalid entries)` : ''}.`);
      }
    } catch (err) {
      console.warn('[TriviaEngine] Could not load questions_bank.json, starting empty.', err);
    }
  }

  /**
   * Reset session history for a room
   */
  resetRoomSession(roomId) {
    this.servedQuestionsByRoom.delete(roomId);
    console.log(`[TriviaEngine] Room session ${roomId} reset.`);
  }

  /**
   * Helper to check if a question matches a category directly or via alias
   */
  matchesCategory(q, cat) {
    if (cat === 'football_post_2010' && q.is_post_2010_football) {
      return true;
    }
    if (q.category === cat) return true;
    const aliases = CATEGORY_ALIASES[cat] || [];
    return aliases.includes(q.category);
  }

  /**
   * Fisher-Yates array shuffling for unbiased random question selection
   */
  shuffle(array) {
    return shuffleArray(array);
  }

  getServedSet(roomId) {
    if (!this.servedQuestionsByRoom.has(roomId)) {
      this.servedQuestionsByRoom.set(roomId, new Set());
    }
    return this.servedQuestionsByRoom.get(roomId);
  }

  pickUnserved(mode, categories, servedSet) {
    for (const cat of categories) {
      const matchingUnserved = this.inMemoryBank.filter(q =>
        q.mode === mode &&
        this.matchesCategory(q, cat) &&
        !servedSet.has(q.id) &&
        isServableQuestion(q)
      );

      if (matchingUnserved.length > 0) {
        return this.shuffle(matchingUnserved)[0];
      }
    }
    return null;
  }

  pickRandomUnserved(mode, servedSet) {
    const candidates = this.inMemoryBank.filter(q =>
      q.mode === mode &&
      !servedSet.has(q.id) &&
      isServableQuestion(q)
    );
    return candidates.length > 0 ? this.shuffle(candidates)[0] : null;
  }

  replenishAndPick(category, mode) {
    this.reportExhaustion(mode, category);
    return null;
  }

  reportExhaustion(mode, category) {
    const key = `${mode}_${category}`;
    this.exhaustionReported = this.exhaustionReported || new Set();
    if (this.exhaustionReported.has(key)) return;
    this.exhaustionReported.add(key);
    console.warn(`[TriviaEngine] Content exhausted for ${mode}/${category}. No synthetic fallback was created.`);
  }

  triggerLowBankReplenish(mode, category, servedSet) {
    const unservedCount = this.inMemoryBank.filter(q =>
      q.mode === mode &&
      !servedSet.has(q.id) &&
      isServableQuestion(q)
    ).length;
    if (unservedCount < this.threshold) {
      this.reportExhaustion(mode, category);
    }
  }

  /**
   * Query next question targeted by character attribute & mode with zero repetition
   */
  getQuestionForPlayer(options) {
    const { roomId, characterId, mode, preferredCategory } = options;
    const servedSet = this.getServedSet(roomId);

    const charCats = CHARACTER_ATTRIBUTES[characterId] || ['general_knowledge'];
    const searchCategories = preferredCategory
      ? [preferredCategory, ...charCats]
      : [...charCats];

    let chosenQuestion = this.pickUnserved(mode, searchCategories, servedSet);

    if (!chosenQuestion) {
      chosenQuestion = this.pickUnserved(mode, ['general_knowledge'], servedSet);
    }

    if (!chosenQuestion) {
      chosenQuestion = this.pickRandomUnserved(mode, servedSet);
    }

    if (!chosenQuestion) {
      chosenQuestion = this.replenishAndPick(searchCategories[0] || 'general_knowledge', mode);
    }

    if (chosenQuestion) {
      servedSet.add(chosenQuestion.id);
    }

    this.triggerLowBankReplenish(mode, searchCategories[0] || 'general_knowledge', servedSet);
    return chosenQuestion;
  }

  /**
   * Draw one question for a Round 1 turn slot.
   * Specialty slots stay inside the answering player's categories; random slots
   * draw from the entire mode pool as required by the tournament rules.
   */
  getQuestionBySlot(options) {
    const {
      roomId,
      characterId,
      mode,
      slotType = 'random',
      preferredCategory
    } = options;
    const servedSet = this.getServedSet(roomId);
    const charCats = CHARACTER_ATTRIBUTES[characterId] || ['general_knowledge'];
    const primaryCategory = preferredCategory || charCats[0] || 'general_knowledge';

    let chosenQuestion = null;

    if (slotType === 'specialty') {
      const categories = preferredCategory ? [preferredCategory] : charCats;
      chosenQuestion = this.pickUnserved(mode, categories, servedSet);
      if (!chosenQuestion) {
        chosenQuestion = this.replenishAndPick(primaryCategory, mode);
      }
    } else {
      if (preferredCategory) {
        chosenQuestion = this.pickUnserved(mode, [preferredCategory], servedSet);
      }
      if (!chosenQuestion) {
        chosenQuestion = this.pickRandomUnserved(mode, servedSet);
      }
      if (!chosenQuestion) {
        chosenQuestion = this.replenishAndPick(primaryCategory, mode);
      }
    }

    if (chosenQuestion) {
      servedSet.add(chosenQuestion.id);
    }

    this.triggerLowBankReplenish(mode, primaryCategory, servedSet);
    return chosenQuestion;
  }

  /**
   * Strict category draw used when a round has already revealed its category.
   */
  getQuestionForCategory(options) {
    const { roomId, mode, category } = options;
    const servedSet = this.getServedSet(roomId);

    let chosenQuestion = this.pickUnserved(mode, [category], servedSet);
    if (!chosenQuestion) {
      chosenQuestion = this.replenishAndPick(category, mode);
    }

    if (chosenQuestion) {
      servedSet.add(chosenQuestion.id);
    }

    this.triggerLowBankReplenish(mode, category, servedSet);
    return chosenQuestion;
  }

  generateBatchSync(category, mode, count = 50) {
    const results = [];
    const isFootball = isFootballQuestion({ category });

    for (let i = 0; i < count; i++) {
      const qText = `سؤال جديد وحصري في ${category} #${Date.now()}_${i}`;
      const hash = crypto.createHash('md5').update(`${mode}_${category}_${qText}`).digest('hex');
      const answer = `إجابة صحيحة لسؤال ${category} #${i + 1}`;
      results.push({
        id: crypto.randomUUID(),
        mode,
        category,
        question_text: qText,
        correct_answer: answer,
        options: mode === 'hat_fi_qoraybi' ? [answer, `بديل أول #${i + 1}`, `بديل ثاني #${i + 1}`, `بديل ثالث #${i + 1}`] : null,
        forbidden_words: mode === 'edini_fi_seri' ? [`محظور أول #${i + 1}`, `محظور ثاني #${i + 1}`, `محظور ثالث #${i + 1}`, `محظور رابع #${i + 1}`] : null,
        acceptable_answers: mode === 'meen_yezawwed' ? [`إجابة مقبولة أولى #${i + 1}`, `إجابة مقبولة ثانية #${i + 1}`, `إجابة مقبولة ثالثة #${i + 1}`, `إجابة مقبولة رابعة #${i + 1}`, `إجابة مقبولة خامسة #${i + 1}`] : null,
        content_hash: hash,
        is_post_2010_football: isFootball,
        created_at: new Date().toISOString()
      });
    }
    return results;
  }

  async triggerAsyncReplenish(category, mode) {
    const key = `${mode}_${category}`;
    if (this.backgroundReplenishing.has(key)) return;

    this.backgroundReplenishing.add(key);
    console.log(`[TriviaEngine Fallback] Threshold reached for (${key}). Triggering background replenish...`);

    setTimeout(async () => {
      try {
        const freshBatch = await this.generateBatch(category, mode, 50);
        this.upsertQuestions(freshBatch);
        console.log(`[TriviaEngine Fallback] Successfully replenished ${freshBatch.length} fresh questions for ${key}.`);
      } catch (err) {
        console.error(`[TriviaEngine Fallback] Error replenishing ${key}:`, err);
      } finally {
        this.backgroundReplenishing.delete(key);
      }
    }, 100);
  }

  /**
   * Upsert questions with duplicate avoidance
   */
  upsertQuestions(items) {
    let added = 0;
    const existingHashes = new Set(this.inMemoryBank.map(q => q.content_hash));
    const existingIds = new Set(this.inMemoryBank.map(q => q.id));

    for (const item of Array.isArray(items) ? items : []) {
      if (!isServableQuestion(item)) {
        console.warn(`[TriviaEngine] Rejected invalid question: ${item?.id || item?.content_hash || 'unknown'}`);
        continue;
      }
      if (existingIds.has(item.id)) continue;
      const contentHash = item.content_hash
        || crypto.createHash('sha256')
          .update(`${item.mode}_${item.category}_${item.question_text.trim()}`)
          .digest('hex');
      if (existingHashes.has(contentHash)) continue;
      const nextItem = { ...item, content_hash: contentHash };
      this.inMemoryBank.push(nextItem);
      existingHashes.add(contentHash);
      existingIds.add(nextItem.id);
      added++;
    }

    if (added > 0) {
      try {
        const bankPath = BANK_PATH;
        fs.writeFileSync(bankPath, JSON.stringify(this.inMemoryBank, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[TriviaEngine] Error persisting to questions_bank.json:', err);
      }
    }
    return added;
  }

  async generateBatch(category, mode, count) {
    return this.generateBatchSync(category, mode, count);
  }
}

export const triviaEngine = new TriviaEngine();

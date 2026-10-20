/**
 * services/triviaEngine.js - In-Game Dynamic Specialty Engine ("القلاية")
 * Targeted Question Dispatcher & Infinite Bank for QUIZ ARENA (ساحة الكويز)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
      const bankPath = path.resolve('data/questions_bank.json');
      if (fs.existsSync(bankPath)) {
        const raw = fs.readFileSync(bankPath, 'utf-8');
        this.inMemoryBank = JSON.parse(raw);
        console.log(`[TriviaEngine] Loaded ${this.inMemoryBank.length} questions from local bank.`);
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
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Query next question targeted by character attribute & mode with zero repetition
   */
  getQuestionForPlayer(options) {
    const { roomId, characterId, mode, preferredCategory } = options;

    if (!this.servedQuestionsByRoom.has(roomId)) {
      this.servedQuestionsByRoom.set(roomId, new Set());
    }
    const servedSet = this.servedQuestionsByRoom.get(roomId);

    // 1. Resolve character candidate categories
    const charCats = CHARACTER_ATTRIBUTES[characterId] || ['general_knowledge'];
    const searchCategories = preferredCategory
      ? [preferredCategory, ...charCats]
      : [...charCats];

    let chosenQuestion = null;

    // 2. Iterate through searchCategories in priority order and pick first matching unserved question
    for (const cat of searchCategories) {
      const matchingUnserved = this.inMemoryBank.filter(q =>
        q.mode === mode &&
        this.matchesCategory(q, cat) &&
        !servedSet.has(q.id)
      );

      if (matchingUnserved.length > 0) {
        const shuffled = this.shuffle(matchingUnserved);
        chosenQuestion = shuffled[0];
        break;
      }
    }

    // 3. Dynamic Fallback: if character's primary category questions are exhausted, try 'general_knowledge'
    if (!chosenQuestion) {
      const gkCandidates = this.inMemoryBank.filter(q =>
        q.mode === mode &&
        this.matchesCategory(q, 'general_knowledge') &&
        !servedSet.has(q.id)
      );
      if (gkCandidates.length > 0) {
        chosenQuestion = this.shuffle(gkCandidates)[0];
      }
    }

    // 4. Fallback to any unserved question in this mode
    if (!chosenQuestion) {
      const anyUnserved = this.inMemoryBank.filter(q =>
        q.mode === mode &&
        !servedSet.has(q.id)
      );
      if (anyUnserved.length > 0) {
        chosenQuestion = this.shuffle(anyUnserved)[0];
      }
    }

    // 5. If everything in the bank has been served in this session, replenish fresh batch
    if (!chosenQuestion) {
      console.log(`[TriviaEngine] All questions in mode ${mode} consumed for room ${roomId}. Generating instant batch...`);
      const fallbackCat = searchCategories[0] || 'general_knowledge';
      const replenished = this.generateBatchSync(fallbackCat, mode, 10);
      this.upsertQuestions(replenished);
      chosenQuestion = replenished[0];
    }

    if (chosenQuestion) {
      servedSet.add(chosenQuestion.id);
    }

    // Background replenish trigger if remaining unserved is low
    const unservedCount = this.inMemoryBank.filter(q => q.mode === mode && !servedSet.has(q.id)).length;
    if (unservedCount < this.threshold) {
      this.triggerAsyncReplenish(searchCategories[0] || 'general_knowledge', mode);
    }

    return chosenQuestion;
  }

  /**
   * Synchronous question generator for instant replenishment
   */
  generateBatchSync(category, mode, count) {
    const results = [];
    const isFootball = category.includes('football') || category.includes('barcelona') || category.includes('ahly') || category.includes('real_madrid');

    for (let i = 0; i < count; i++) {
      const qText = `سؤال إضافي متقدم في ${category} (${Date.now() + i})`;
      const hash = crypto.createHash('md5').update(`${mode}_${category}_${qText}`).digest('hex');

      const answer = `إجابة صحيحة نموذجية #${i + 1}`;
      results.push({
        id: crypto.randomUUID(),
        mode: mode,
        category,
        question_text: qText,
        correct_answer: answer,
        options: mode === 'hat_fi_qoraybi' ? this.shuffle([answer, 'خيار 2', 'خيار 3', 'خيار 4']) : null,
        forbidden_words: mode === 'edini_fi_seri' ? ['ممنوع 1', 'ممنوع 2', 'ممنوع 3', 'ممنوع 4'] : null,
        acceptable_answers: mode === 'meen_yezawwed' ? ['عنصر 1', 'عنصر 2', 'عنصر 3', 'عنصر 4', 'عنصر 5'] : null,
        content_hash: hash,
        is_post_2010_football: isFootball,
        created_at: new Date().toISOString()
      });
    }
    return results;
  }

  /**
   * Asynchronous background question generator (Infinite Bank)
   */
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

    for (const item of items) {
      if (!existingHashes.has(item.content_hash)) {
        this.inMemoryBank.push(item);
        existingHashes.add(item.content_hash);
        added++;
      }
    }

    if (added > 0) {
      try {
        const bankPath = path.resolve('data/questions_bank.json');
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

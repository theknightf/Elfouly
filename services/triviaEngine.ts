/**
 * services/triviaEngine.ts - In-Game Dynamic Specialty Engine ("القلاية")
 * Targeted Question Dispatcher & Infinite Bank for QUIZ ARENA (ساحة الكويز)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface QuestionItem {
  id: string;
  mode: 'one_two_bank' | 'edini_fi_seri' | 'hat_fi_qoraybi' | 'meen_yezawwed';
  category: string;
  question_text: string | null;
  correct_answer: string | null;
  options?: string[] | null;
  forbidden_words?: string[] | null;
  acceptable_answers?: string[] | null;
  content_hash: string;
  is_post_2010_football: boolean;
  created_at?: string;
}

export interface GetQuestionOptions {
  roomId: string;
  characterId: string;
  mode: 'one_two_bank' | 'edini_fi_seri' | 'hat_fi_qoraybi' | 'meen_yezawwed';
  preferredCategory?: string;
}

// Character -> Specialized Attribute Categories mapping
export const CHARACTER_ATTRIBUTES: Record<string, string[]> = {
  fares_elfouly: [
    'computer_science',
    'barcelona_post_2010',
    'capitals_and_flags'
  ],
  abdelrahman_eltouny: [
    'veterinary_biology',
    'gelato_and_desserts',
    'ahly_post_2010',
    'islamic_studies'
  ],
  khaled_elbarbakh: [
    'veterinary_biology',
    'pc_hardware',
    'fifa_gaming',
    'foreign_tv_series',
    'real_madrid_post_2010'
  ],
  ziad_elfondoqy: [
    'tourism_hospitality',
    'foreign_tv_series',
    'real_madrid_post_2010'
  ],
  eyad_amr: [
    'cybersecurity',
    'tech_networking',
    'barcelona_post_2010',
    'ahly_post_2010'
  ],
  mazen_elgamer: [
    'health_sciences_lab',
    'gaming_consoles',
    'reflex_gaming'
  ],
  ali_ahmed: [
    'dentistry',
    'cars_and_engine_mechanics',
    'fitness_gym'
  ]
};

export class TriviaEngine {
  private inMemoryBank: QuestionItem[] = [];
  private servedQuestionsByRoom: Map<string, Set<string>> = new Map();
  private backgroundReplenishing: Set<string> = new Set();
  private threshold = 20;

  constructor() {
    this.loadInitialBank();
  }

  private loadInitialBank(): void {
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
  public resetRoomSession(roomId: string): void {
    this.servedQuestionsByRoom.delete(roomId);
    console.log(`[TriviaEngine] Room session ${roomId} reset.`);
  }

  /**
   * Query next question targeted by character attribute & mode
   */
  public getQuestionForPlayer(options: GetQuestionOptions): QuestionItem | null {
    const { roomId, characterId, mode, preferredCategory } = options;

    if (!this.servedQuestionsByRoom.has(roomId)) {
      this.servedQuestionsByRoom.set(roomId, new Set());
    }
    const servedSet = this.servedQuestionsByRoom.get(roomId)!;

    // Get candidate categories for character
    const charCats = CHARACTER_ATTRIBUTES[characterId] || [];
    const targetCategories = preferredCategory
      ? [preferredCategory, ...charCats]
      : charCats;

    // Filter questions matching mode & categories
    let eligible = this.inMemoryBank.filter(q => {
      const matchesMode = q.mode === mode;
      const matchesCat = targetCategories.length === 0 || targetCategories.includes(q.category);
      return matchesMode && matchesCat;
    });

    // If no character-specific questions found, fallback to any question for this mode
    if (eligible.length === 0) {
      eligible = this.inMemoryBank.filter(q => q.mode === mode);
    }

    // Filter out already served in this room
    const unserved = eligible.filter(q => !servedSet.has(q.id));

    // Dynamic Fallback check: If remaining unserved in category drops below threshold, trigger async replenish
    const primaryCat = targetCategories[0] || 'general';
    if (unserved.length < this.threshold) {
      this.triggerAsyncReplenish(primaryCat, mode);
    }

    // Pick question
    const pool = unserved.length > 0 ? unserved : eligible;
    if (pool.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * pool.length);
    const selected = pool[randomIndex];

    servedSet.add(selected.id);
    return selected;
  }

  /**
   * Asynchronous background question generator (Infinite Bank)
   */
  private async triggerAsyncReplenish(category: string, mode: string): Promise<void> {
    const key = `${mode}_${category}`;
    if (this.backgroundReplenishing.has(key)) return;

    this.backgroundReplenishing.add(key);
    console.log(`[TriviaEngine Fallback] Threshold reached for (${key}). Triggering background replenish...`);

    // Non-blocking async execution
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
  public upsertQuestions(items: QuestionItem[]): number {
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

  /**
   * Mock or Live LLM generation of batch
   */
  private async generateBatch(category: string, mode: string, count: number): Promise<QuestionItem[]> {
    const results: QuestionItem[] = [];
    const isFootball = category.includes('football') || category.includes('barcelona') || category.includes('ahly') || category.includes('real_madrid');

    for (let i = 0; i < count; i++) {
      const qText = `سؤال إضافي متقدم في ${category} (${Date.now() + i})`;
      const hash = crypto.createHash('md5').update(`${mode}_${category}_${qText}`).digest('hex');

      results.push({
        id: crypto.randomUUID(),
        mode: mode as any,
        category,
        question_text: qText,
        correct_answer: `إجابة صحيحة نموذجية #${i + 1}`,
        options: mode === 'hat_fi_qoraybi' ? ['إجابة صحيحة نموذجية #1', 'خيار 2', 'خيار 3', 'خيار 4'] : null,
        forbidden_words: mode === 'edini_fi_seri' ? ['ممنوع 1', 'ممنوع 2', 'ممنوع 3', 'ممنوع 4'] : null,
        acceptable_answers: mode === 'meen_yezawwed' ? ['عنصر 1', 'عنصر 2', 'عنصر 3', 'عنصر 4', 'عنصر 5'] : null,
        content_hash: hash,
        is_post_2010_football: isFootball,
        created_at: new Date().toISOString()
      });
    }
    return results;
  }
}

export const triviaEngine = new TriviaEngine();

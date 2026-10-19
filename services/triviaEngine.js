/**
 * services/triviaEngine.js - In-Game Dynamic Specialty Engine ("القلاية")
 * Targeted Question Dispatcher & Infinite Bank for QUIZ ARENA (ساحة الكويز)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Character -> Specialized Attribute Categories mapping
export const CHARACTER_ATTRIBUTES = {
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
   * Query next question targeted by character attribute & mode
   */
  getQuestionForPlayer({ roomId, characterId, mode, preferredCategory }) {
    if (!this.servedQuestionsByRoom.has(roomId)) {
      this.servedQuestionsByRoom.set(roomId, new Set());
    }
    const servedSet = this.servedQuestionsByRoom.get(roomId);

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
  async triggerAsyncReplenish(category, mode) {
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

  /**
   * Live LLM generation of batch via Groq API
   */
  async generateBatch(category, mode, count = 10) {
    const results = [];
    const isFootball = category.includes('football') || category.includes('barcelona') || category.includes('ahly') || category.includes('real_madrid');
    const groqKey = process.env.GROQ_API_KEY || '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';

    const footballConstraint = isFootball ? `
CRITICAL CONSTRAINT: All football questions/topics MUST be STRICTLY from 2010 ONWARD (2010 to 2026).
DO NOT mention or ask about anything before 2010 (no 2006, 2008, 1990s, etc.). Immediate rejection if violated!
` : '';

    const prompt = `أنت المخرج التفاعلي للعبة البارتي المصرية الشهيرة "QUIZ ARENA (ساحة الكويز - روش ومصري)".
المطلوب: توليد ${count} عناصر تريفيا حصرية وجديدة للطور: "${mode}" في التصنيف: "${category}".

${footballConstraint}

الشروط:
- لهجة مصرية روشة، ذكية، وممتعة ("روش ومصري").
- أسئلة وإجابات دقيقة خالية من اللبس.
- أخرج الناتج بتنسيق JSON array حصراً كما يلي:

صيغة الكائنات داخل الـ JSON:
للـ one_two_bank: [{"question_text": "نص السؤال بالعامية المصرية الروشة", "correct_answer": "الإجابة النموذجية"}]
للـ edini_fi_seri: [{"target_word": "الكلمة السرية", "forbidden_words": ["كلمة 1", "كلمة 2", "كلمة 3", "كلمة 4"]}]
للـ hat_fi_qoraybi: [{"question_text": "سؤال ركلة جزاء ترجيحية", "options": ["إجابة 1", "إجابة 2", "إجابة 3", "إجابة 4"], "correct_answer": "إجابة 1"}]
للـ meen_yezawwed: [{"question_text": "موضوع المزاد", "acceptable_answers": ["عنصر 1", "عنصر 2", "عنصر 3", "عنصر 4", "عنصر 5"]}]

أخرج فقط مصفوفة JSON صالحة [ ... ] بدون أي نصوص قبلها أو بعدها.`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.8-27b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content?.trim() || '';
        
        // Extract JSON array
        const jsonMatch = rawContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          for (const item of parsed) {
            const qText = item.question_text || item.target_word || '';
            if (!qText) continue;

            // Strict football check
            if (isFootball) {
              const fullStr = `${qText} ${item.correct_answer || ''} ${JSON.stringify(item.options || [])}`;
              if (fullStr.match(/\b(19\d\d|200\d)\b/)) {
                console.warn(`[Groq Filter] Rejected pre-2010 item: ${qText}`);
                continue;
              }
            }

            const hash = crypto.createHash('md5').update(`${mode}_${category}_${qText}`).digest('hex');
            results.push({
              id: crypto.randomUUID(),
              mode,
              category,
              question_text: item.question_text || item.target_word,
              correct_answer: item.correct_answer || item.target_word,
              options: item.options || (mode === 'hat_fi_qoraybi' ? [item.correct_answer, 'خيار ب', 'خيار ج', 'خيار د'] : null),
              forbidden_words: item.forbidden_words || null,
              acceptable_answers: item.acceptable_answers || null,
              content_hash: hash,
              is_post_2010_football: isFootball,
              created_at: new Date().toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.warn('[TriviaEngine Groq] Error calling Groq API, using fallback:', err.message);
    }

    // Fallback if LLM didn't return items
    if (results.length === 0) {
      for (let i = 0; i < count; i++) {
        const qText = `تحدي متقدم في ${category} #${i + 1} (${Date.now()})`;
        const hash = crypto.createHash('md5').update(`${mode}_${category}_${qText}`).digest('hex');
        results.push({
          id: crypto.randomUUID(),
          mode,
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
    }

    return results;
  }
}

export const triviaEngine = new TriviaEngine();

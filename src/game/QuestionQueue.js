/**
 * QuestionQueue - Per-Game Session Deduplicating Question Queue
 *
 * Requirements:
 * 1. Shuffles the question list ONCE at game start (Fisher-Yates).
 * 2. Pops one-by-one sequentially without replacement (never random pick with replacement).
 * 3. Keeps a persistent `usedQuestionIds` set per game session.
 * 4. Provides `peek(offset)` and `preloadNext()` for zero-delay preloading.
 * 5. Deterministic deck generation for multiplayer rooms where host generates once and stores for all clients.
 */

export class QuestionQueue {
  constructor(questions = [], externalUsedSet = null) {
    this.usedQuestionIds = externalUsedSet instanceof Set ? externalUsedSet : new Set();
    this.items = [];
    this.cursor = 0;
    if (questions && questions.length > 0) {
      this.load(questions);
    }
  }

  /**
   * Load and shuffle questions ONCE using Fisher-Yates algorithm.
   * Deduplicates against already used IDs in the session.
   */
  load(questions = []) {
    const seenInBatch = new Set();
    const cleanList = [];

    for (const q of questions) {
      if (!q || q.id == null) continue;
      const id = String(q.id);
      // Skip questions already served in this game session or duplicated in this batch
      if (this.usedQuestionIds.has(id) || seenInBatch.has(id)) continue;
      seenInBatch.add(id);
      cleanList.push(q);
    }

    // Fisher-Yates shuffle ONCE
    for (let i = cleanList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cleanList[i], cleanList[j]] = [cleanList[j], cleanList[i]];
    }

    this.items = cleanList;
    this.cursor = 0;
  }

  /**
   * Pop the next question sequentially. Never uses replacement.
   */
  pop() {
    while (this.cursor < this.items.length) {
      const question = this.items[this.cursor++];
      if (!question || question.id == null) continue;
      const id = String(question.id);
      if (this.usedQuestionIds.has(id)) continue;
      this.usedQuestionIds.add(id);
      return question;
    }
    return null;
  }

  /**
   * Take a specific matching question or candidate from the unserved queue.
   */
  take(target) {
    if (!target || target.id == null) return null;
    const targetId = String(target.id);
    if (this.usedQuestionIds.has(targetId)) return null;

    const index = this.items.findIndex(
      (item, idx) => idx >= this.cursor && String(item?.id) === targetId
    );
    if (index < this.cursor || index < 0) return null;

    // Swap candidate to cursor position and pop
    [this.items[this.cursor], this.items[index]] = [this.items[index], this.items[this.cursor]];
    return this.pop();
  }

  /**
   * Preload the upcoming question while the current one is being displayed.
   * offset 0 = immediately next question in line.
   */
  peek(offset = 0) {
    const targetIndex = this.cursor + offset;
    if (targetIndex >= this.items.length) return null;
    return this.items[targetIndex] || null;
  }

  /**
   * Helper specifically for preloading the next question for optimistic zero-latency UI.
   */
  preloadNext() {
    return this.peek(0);
  }

  /**
   * Mark a question ID as used externally (e.g. from server/sync).
   */
  markUsed(questionId) {
    if (questionId != null) {
      this.usedQuestionIds.add(String(questionId));
    }
  }

  /**
   * Check if question has been used in this game session.
   */
  isUsed(questionId) {
    return this.usedQuestionIds.has(String(questionId));
  }

  /**
   * Reset session used IDs.
   */
  resetSession() {
    this.usedQuestionIds.clear();
    this.cursor = 0;
  }

  get remaining() {
    return Math.max(0, this.items.length - this.cursor);
  }

  get length() {
    return this.items.length;
  }
}

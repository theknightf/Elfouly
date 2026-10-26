/** A per-round question deck. Questions are shuffled once, then consumed once. */
export class QuestionQueue {
  constructor(questions = []) {
    this.reset(questions);
  }

  reset(questions = []) {
    this.usedQuestionIds = new Set();
    const unique = [];
    for (const question of questions) {
      if (question?.id == null || this.usedQuestionIds.has(question.id)) continue;
      this.usedQuestionIds.add(question.id);
      unique.push(question);
    }
    this.usedQuestionIds.clear();
    this.items = unique;
    for (let index = this.items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.items[index], this.items[swapIndex]] = [this.items[swapIndex], this.items[index]];
    }
    this.items = this.items.filter(question => {
      const id = question?.id;
      if (id == null || this.usedQuestionIds.has(id)) return false;
      return true;
    });
    this.cursor = 0;
  }

  pop() {
    const question = this.items[this.cursor];
    if (!question) return null;
    this.cursor += 1;
    this.usedQuestionIds.add(question.id);
    return question;
  }

  take(question) {
    if (!question) return null;
    const index = this.items.findIndex(item => item.id === question.id);
    if (index < this.cursor || index < 0 || this.usedQuestionIds.has(question.id)) return null;
    [this.items[this.cursor], this.items[index]] = [this.items[index], this.items[this.cursor]];
    return this.pop();
  }

  peek() {
    return this.items[this.cursor] || null;
  }

  get remaining() {
    return Math.max(0, this.items.length - this.cursor);
  }
}


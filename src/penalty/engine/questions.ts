import type { Question } from './types';
import {
  GENERAL_CATEGORY,
  categoryLabel,
  isGeneralCategory
} from './categories';
import { shuffle } from './rng';

function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
}

export function normalizeQuestionBank(raw: readonly Question[]): Question[] {
  const seenIds = new Set<string>();
  const seenPrompts = new Set<string>();
  const result: Question[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) {
      throw new Error('كل سؤال لازم يكون له معرّف فريد.');
    }

    const prompt = String(entry.prompt || '').trim();
    const options = Array.isArray(entry.options)
      ? entry.options.map(option => String(option).trim())
      : [];

    if (!prompt) {
      throw new Error(`السؤال ${entry.id} ليس له نص.`);
    }
    if (options.length < 2 || options.length > 4) {
      throw new Error(`السؤال ${entry.id} لازم يكون فيه من 2 إلى 4 اختيارات.`);
    }
    if (options.some(option => !option)) {
      throw new Error(`السؤال ${entry.id} فيه اختيار فاضي.`);
    }
    if (
      !Number.isInteger(entry.correctIndex) ||
      entry.correctIndex < 0 ||
      entry.correctIndex >= options.length
    ) {
      throw new Error(`السؤال ${entry.id} فيه إجابة صحيحة غير صالحة.`);
    }
    if (
      entry.timeLimitMs !== undefined &&
      (!Number.isFinite(entry.timeLimitMs) || entry.timeLimitMs <= 0)
    ) {
      throw new Error(`السؤال ${entry.id} فيه مدة غير صالحة.`);
    }

    const promptKey = normalizePrompt(prompt);
    if (seenIds.has(entry.id) || seenPrompts.has(promptKey)) {
      continue;
    }

    const category = entry.category
      ? String(entry.category).trim().toLowerCase()
      : GENERAL_CATEGORY;

    seenIds.add(entry.id);
    seenPrompts.add(promptKey);
    result.push({
      id: entry.id,
      prompt,
      options,
      correctIndex: entry.correctIndex,
      category,
      categoryLabel: entry.categoryLabel || categoryLabel(category),
      timeLimitMs: entry.timeLimitMs
    });
  }

  return result;
}

/**
 * Builds a question deck that keeps at least half of every prefix General.
 *
 * Categories are arranged in balanced six-question blocks:
 *
 *   General, General, General, Specialty, Specialty, Specialty
 *
 * Every prefix of that block has at least as many General questions as
 * specialty questions, so the 50% rule holds at every draw — including when
 * sudden death extends the match. The three-question runs also avoid aligning
 * the category with the two-question kick rhythm, which keeps both attackers
 * and goalkeepers exposed to General and specialty questions.
 */
export function prepareQuestionDeck(
  questions: readonly Question[],
  seedState: number
): { deck: Question[]; rngState: number } {
  const normalized = normalizeQuestionBank(questions);
  const general: Question[] = [];
  const specialty: Question[] = [];

  for (const question of normalized) {
    if (isGeneralCategory(question.category)) {
      general.push(question);
    } else {
      specialty.push(question);
    }
  }

  const shuffledGeneral = shuffle(general, seedState);
  const shuffledSpecialty = shuffle(specialty, shuffledGeneral.state);

  const deck: Question[] = [];
  let generalIndex = 0;
  let specialtyIndex = 0;

  // Complete 3+3 blocks keep the ratio balanced and varied.
  const completeBlocks = Math.min(
    Math.floor(shuffledGeneral.items.length / 3),
    Math.floor(shuffledSpecialty.items.length / 3)
  );

  for (let block = 0; block < completeBlocks; block += 1) {
    for (let count = 0; count < 3; count += 1) {
      deck.push(shuffledGeneral.items[generalIndex]);
      generalIndex += 1;
    }
    for (let count = 0; count < 3; count += 1) {
      deck.push(shuffledSpecialty.items[specialtyIndex]);
      specialtyIndex += 1;
    }
  }

  // Pair up any leftovers. A General always precedes its paired specialty, so
  // even the tail cannot dip below 50%.
  while (
    generalIndex < shuffledGeneral.items.length &&
    specialtyIndex < shuffledSpecialty.items.length
  ) {
    deck.push(shuffledGeneral.items[generalIndex]);
    generalIndex += 1;
    deck.push(shuffledSpecialty.items[specialtyIndex]);
    specialtyIndex += 1;
  }

  // Extra General questions are always safe to append. Extra specialty
  // questions are intentionally dropped because they would break the rule.
  while (generalIndex < shuffledGeneral.items.length) {
    deck.push(shuffledGeneral.items[generalIndex]);
    generalIndex += 1;
  }

  return { deck, rngState: shuffledSpecialty.state };
}

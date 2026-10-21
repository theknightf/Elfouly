import rawPenaltyBank from '../../../data/questions_bank.json';
import { TRIVIA_BANK } from '../../data/questions.js';
import { categoryLabel, GENERAL_CATEGORY } from '../engine/categories';
import { normalizeQuestionBank } from '../engine/questions';
import type { Question } from '../engine/types';
import { GENERAL_QUESTIONS, HISTORY_QUESTIONS } from './generalQuestions';

/**
 * The source bank uses very specific labels. The game needs a small, stable
 * set of specialties so a player's attributes and the bonus rule stay clear.
 */
const CATEGORY_MAP: Record<string, string> = {
  general_knowledge: GENERAL_CATEGORY,
  reflex_trivia: GENERAL_CATEGORY,

  football: 'sports',
  football_post_2010: 'sports',
  barcelona_post_2010: 'sports',
  real_madrid_post_2010: 'sports',
  barcelona_european_football: 'sports',
  real_madrid_al_ahly: 'sports',
  fitness_gym: 'sports',

  veterinary_biology: 'science',
  veterinary_medicine: 'science',
  health_sciences_lab: 'science',
  dentistry: 'science',
  biology: 'science',

  computer_science: 'tech',
  pc_hardware_gaming: 'tech',
  pc_hardware: 'tech',
  cybersecurity: 'tech',
  gaming_tech: 'tech',
  console_pc_gaming: 'tech',

  popular_foreign_series: 'arts',
  series_breaking_bad: 'arts',
  foreign_tv_series: 'arts',

  gelato_sweets: 'food',
  gelato_and_desserts: 'food',

  cars_mechanics: 'cars',
  cars_and_engine_mechanics: 'cars',

  islamic_studies: 'religion',
  islamic_culture: 'religion',

  tourism_hospitality: 'geography',
  capitals_and_flags: 'geography',

  history: 'history'
};

function canonicalCategory(category: string | undefined): string {
  if (!category) {
    return GENERAL_CATEGORY;
  }
  return CATEGORY_MAP[category] || GENERAL_CATEGORY;
}

function makeQuestion(input: {
  id: string;
  prompt: string;
  options: unknown;
  answer: unknown;
  category?: string;
}): Question | null {
  if (!Array.isArray(input.options)) {
    return null;
  }

  const options = input.options.map(option => String(option || '').trim());
  const correctIndex = options.indexOf(String(input.answer || '').trim());

  if (options.length < 2 || options.length > 4 || correctIndex < 0) {
    return null;
  }

  const category = canonicalCategory(input.category);

  return {
    id: input.id,
    prompt: String(input.prompt || '').trim(),
    options,
    correctIndex,
    category,
    categoryLabel: categoryLabel(category)
  };
}

const penaltySpecific: Question[] = (rawPenaltyBank as any[])
  .filter(entry => entry.mode === 'hat_fi_qoraybi')
  .map(entry =>
    makeQuestion({
      id: `penalty:${entry.id}`,
      prompt: entry.question_text,
      options: entry.options,
      answer: entry.correct_answer,
      category: entry.category
    })
  )
  .filter((question): question is Question => question !== null);

const generalTrivia: Question[] = (TRIVIA_BANK as any[])
  .map(entry =>
    makeQuestion({
      id: `arena:${entry.id}`,
      prompt: entry.question,
      options: entry.options,
      answer: entry.answer,
      category: entry.category
    })
  )
  .filter((question): question is Question => question !== null);

export const PENALTY_QUESTION_BANK: Question[] = normalizeQuestionBank([
  ...penaltySpecific,
  ...generalTrivia,
  ...GENERAL_QUESTIONS,
  ...HISTORY_QUESTIONS
]);

if (PENALTY_QUESTION_BANK.length < 20) {
  throw new Error('مخزون أسئلة ضربات الجزاء أقل من الحد الأدنى المطلوب.');
}

export const PENALTY_GENERAL_QUESTION_COUNT = PENALTY_QUESTION_BANK.filter(
  question => question.category === GENERAL_CATEGORY
).length;

export const PENALTY_SPECIALTY_QUESTION_COUNT =
  PENALTY_QUESTION_BANK.length - PENALTY_GENERAL_QUESTION_COUNT;

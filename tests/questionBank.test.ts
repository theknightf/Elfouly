import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  CATEGORY_MERGES,
  KNOWN_CATEGORIES,
  MODES,
  duplicateKey,
  validateQuestion
  // @ts-expect-error plain .mjs helper shared with the CLI scripts
} from '../scripts/question_bank_lib.mjs';
import { CHARACTERS } from '../src/data/characters';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const bank: any[] = JSON.parse(fs.readFileSync(path.resolve('data/questions_bank.json'), 'utf8'));

test('every bank question passes the validator', () => {
  const problems = bank.flatMap((q, i) => validateQuestion(q).map((e: string) => `#${i + 1} ${q.question_text}: ${e}`));
  assert.deepEqual(problems, []);
});

test('no duplicate questions, even across modes', () => {
  const seen = new Set<string>();
  for (const q of bank) {
    const key = duplicateKey(q);
    assert.equal(seen.has(key), false, `duplicate: ${q.question_text}`);
    seen.add(key);
  }
});

test('no legacy overlapping category slugs remain', () => {
  const legacy = Object.keys(CATEGORY_MERGES);
  const leftovers = bank.filter(q => legacy.includes(q.category)).map(q => q.category);
  assert.deepEqual(leftovers, []);
});

test('every character specialty is a known category with questions', () => {
  const used = new Set(bank.map(q => q.category));
  for (const character of CHARACTERS) {
    for (const attribute of character.attributes) {
      assert.ok(KNOWN_CATEGORIES.includes(attribute), `${character.id}: unknown specialty ${attribute}`);
      assert.ok(used.has(attribute), `${character.id}: specialty ${attribute} has no questions`);
    }
  }
});

test('each mode has enough questions for one match', () => {
  const count = (mode: string) => bank.filter(q => q.mode === mode).length;
  assert.ok(count(MODES.PASSWORD) >= 5);
  assert.ok(count(MODES.PENALTY) >= 11); // 10 kicks + at least one sudden-death kick
  assert.ok(count(MODES.AUCTION) >= 4);
  assert.ok(count(MODES.BANK) >= 48);
});

test('validator rejects the usual mistakes', () => {
  const base = { mode: MODES.PENALTY, category: 'general_knowledge', question_text: 'س', correct_answer: 'أ', options: ['أ', 'ب', 'ج', 'د'] };
  assert.deepEqual(validateQuestion(base), []);
  assert.ok(validateQuestion({ ...base, options: ['أ', 'ب', 'ج'] }).length);
  assert.ok(validateQuestion({ ...base, correct_answer: 'هـ' }).length);
  assert.ok(validateQuestion({ ...base, category: 'ahly_post_2010' }).length);
  assert.ok(validateQuestion({ mode: MODES.PASSWORD, category: 'general_knowledge', question_text: 'كشري', correct_answer: 'كشري', forbidden_words: ['أ', 'ب', 'ج'] }).length);
  assert.ok(validateQuestion({ mode: MODES.AUCTION, category: 'general_knowledge', question_text: 'قائمة', acceptable_answers: ['أ', 'ب'] }).length);
});

console.log(`\nAll ${passed} question bank tests passed.`);

// Validate the question bank, or a file of new questions.
// Usage: node scripts/validate_question_bank.mjs [path-to-json]   (default: data/questions_bank.json)
// Exit code 1 when any question is invalid (so it can run in CI / npm scripts).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODES, duplicateKey, validateQuestion } from './question_bank_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(process.argv[2] || path.join(root, 'data', 'questions_bank.json'));
const questions = JSON.parse(fs.readFileSync(target, 'utf8'));

let problems = 0;
const seen = new Map();
questions.forEach((q, index) => {
  const label = `#${index + 1} [${q.mode}/${q.category}] ${String(q.question_text).slice(0, 50)}`;
  const errors = validateQuestion(q);
  const key = duplicateKey(q);
  if (seen.has(key)) errors.push(`duplicate of ${seen.get(key)}`);
  else seen.set(key, `#${index + 1}`);
  if (errors.length) {
    problems += errors.length;
    console.log(`✗ ${label}`);
    errors.forEach(e => console.log(`    - ${e}`));
  }
});

const counts = {};
questions.forEach(q => { counts[q.mode] = (counts[q.mode] || 0) + 1; });
console.log(`\n${path.relative(root, target)}: ${questions.length} questions`, counts);
console.log(problems ? `❌ ${problems} problem(s)` : '✅ all questions valid');
process.exit(problems ? 1 : 0);

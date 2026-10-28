// Merge new questions into data/questions_bank.json after validating them.
// Usage:
//   node scripts/add_questions.mjs                      # check data/new_questions.json (dry run)
//   node scripts/add_questions.mjs --write              # validate + append to the bank
//   node scripts/add_questions.mjs path/to/file.json --write
// Write only the fields shown in data/new_questions.template.json; id, content_hash,
// created_at and is_post_2010_football are filled in for you.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { contentHash, duplicateKey, validateQuestion } from './question_bank_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankFile = path.join(root, 'data', 'questions_bank.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const inputArg = args.find(a => !a.startsWith('--'));
const inputFile = path.resolve(inputArg || path.join(root, 'data', 'new_questions.json'));

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${path.relative(root, inputFile)}`);
  console.error('Copy data/new_questions.template.json to data/new_questions.json and fill it in.');
  process.exit(1);
}

const bankRaw = fs.readFileSync(bankFile, 'utf8');
const crlf = bankRaw.includes('\r\n');
const bank = JSON.parse(bankRaw);
const incoming = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
if (!Array.isArray(incoming)) {
  console.error('The input file must be a JSON array of questions.');
  process.exit(1);
}

const existing = new Map(bank.map(q => [duplicateKey(q), q]));
const accepted = [];
let rejected = 0;

incoming.forEach((raw, index) => {
  const q = {
    id: crypto.randomUUID(),
    mode: raw.mode,
    category: raw.category,
    question_text: typeof raw.question_text === 'string' ? raw.question_text.trim() : raw.question_text,
    correct_answer: raw.correct_answer ?? null,
    options: raw.options ?? null,
    forbidden_words: raw.forbidden_words ?? null,
    acceptable_answers: raw.acceptable_answers ?? null,
    ...(raw.subtopic ? { subtopic: raw.subtopic } : {}),
    is_post_2010_football: raw.category === 'football_post_2010',
    created_at: new Date().toISOString()
  };
  q.content_hash = contentHash(q);

  const errors = validateQuestion(q);
  const key = duplicateKey(q);
  if (existing.has(key)) errors.push(`already in the bank (${existing.get(key).mode}/${existing.get(key).category})`);

  if (errors.length) {
    rejected += 1;
    console.log(`✗ #${index + 1} ${String(raw.question_text).slice(0, 60)}`);
    errors.forEach(e => console.log(`    - ${e}`));
  } else {
    existing.set(key, q);
    accepted.push(q);
  }
});

console.log(`\n${accepted.length} valid, ${rejected} rejected (of ${incoming.length}).`);

if (!write) {
  console.log('Dry run: nothing written. Re-run with --write to add the valid ones.');
  process.exit(rejected ? 1 : 0);
}

if (accepted.length) {
  let out = JSON.stringify([...bank, ...accepted], null, 2) + '\n';
  if (crlf) out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync(bankFile, out);
  console.log(`Added ${accepted.length} questions. Bank size: ${bank.length + accepted.length}.`);
  console.log('Tip: valid ones are in the bank now; fix the rejected ones and run again (already-added ones are skipped as duplicates).');
}
process.exit(rejected ? 1 : 0);

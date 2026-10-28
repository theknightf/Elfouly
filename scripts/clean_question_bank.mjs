// One-time (idempotent) cleanup of data/questions_bank.json:
//  - merges overlapping categories (football clubs become a `subtopic` tag)
//  - removes duplicate questions, keeping the Bank/Password/Auction copy over the Penalty copy
// Usage: node scripts/clean_question_bank.mjs [--dry]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORY_MERGES, MODES, duplicateKey } from './question_bank_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'data', 'questions_bank.json');
const dry = process.argv.includes('--dry');

const bank = JSON.parse(fs.readFileSync(file, 'utf8'));
const crlf = fs.readFileSync(file, 'utf8').includes('\r\n');

const report = { merged: {}, removed: [] };

for (const q of bank) {
  const merge = CATEGORY_MERGES[q.category];
  if (!merge) continue;
  report.merged[`${q.category} -> ${merge.category}`] = (report.merged[`${q.category} -> ${merge.category}`] || 0) + 1;
  q.category = merge.category;
  if (merge.subtopic) q.subtopic = merge.subtopic;
}

// Duplicates: prefer to keep the non-Penalty copy (open-ended version is the richer one).
const priority = (q) => (q.mode === MODES.PENALTY ? 1 : 0);
const sorted = [...bank].sort((a, b) => priority(a) - priority(b));
const seen = new Map();
const drop = new Set();
for (const q of sorted) {
  const key = duplicateKey(q);
  if (seen.has(key)) {
    drop.add(q.id);
    report.removed.push(`${q.mode}/${q.category}: ${q.question_text}`);
  } else {
    seen.set(key, q.id);
  }
}
const cleaned = bank.filter(q => !drop.has(q.id));

console.log('Merged categories:');
for (const [k, v] of Object.entries(report.merged)) console.log(`  ${k}: ${v}`);
console.log(`Removed duplicates (${report.removed.length}):`);
report.removed.forEach(r => console.log(`  - ${r}`));
console.log(`Questions: ${bank.length} -> ${cleaned.length}`);

if (dry) {
  console.log('(dry run: nothing written)');
} else {
  let out = JSON.stringify(cleaned, null, 2) + '\n';
  if (crlf) out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, out);
  console.log('Wrote', path.relative(root, file));
}

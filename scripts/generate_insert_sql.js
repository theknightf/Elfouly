import fs from 'fs';
import path from 'path';

// Generate SQL insert statements for Supabase
const data = JSON.parse(fs.readFileSync(path.resolve('data/questions_bank.json'), 'utf-8'));

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

const values = data.map(q => {
  return `(
    ${escapeSql(q.id)},
    ${escapeSql(q.mode)},
    ${escapeSql(q.category)},
    ${escapeSql(q.question_text)},
    ${escapeSql(q.correct_answer)},
    ${escapeSql(q.options)},
    ${escapeSql(q.forbidden_words)},
    ${escapeSql(q.acceptable_answers)},
    ${escapeSql(q.content_hash)},
    ${escapeSql(q.is_post_2010_football)}
  )`;
}).join(',\n');

const sql = `
INSERT INTO questions (
  id, mode, category, question_text, correct_answer, options,
  forbidden_words, acceptable_answers, content_hash, is_post_2010_football
) VALUES
${values}
ON CONFLICT (content_hash) DO NOTHING;
`;

fs.writeFileSync(path.resolve('scripts/insert_questions.sql'), sql, 'utf-8');
console.log(`Generated insert SQL with ${data.length} records in scripts/insert_questions.sql`);

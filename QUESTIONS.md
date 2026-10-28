# Adding questions

1. Copy `data/new_questions.template.json` to `data/new_questions.json` and write your questions in it (a JSON array).
2. Check them without changing anything:
   ```bash
   npm run questions:add
   ```
   Every rejected question is listed with the reason. Fix and re-run until it says `0 rejected`.
3. Add them to the bank:
   ```bash
   npm run questions:add -- --write
   ```
4. Anytime, check the whole bank: `npm run questions:validate` (also part of `npm test` via `test:bank`).

`id`, `content_hash`, `created_at` and `is_post_2010_football` are filled in for you. A question that is already in the bank
(same text, any mode) is rejected, so re-running after a partial add is safe.

## Fields per mode

| Mode (`mode`) | Round | Fields you write | Rules |
|---|---|---|---|
| `one_two_bank` | 1 تو | `question_text`, `correct_answer` | Open question; no `options`. |
| `hat_fi_qoraybi` | حط في قريبي | `question_text`, `correct_answer`, `options` | Exactly 4 unique options; `correct_answer` must be one of them (same text). |
| `edini_fi_seri` | اديني في سري | `question_text` (the secret word), `correct_answer` (same word), `forbidden_words` | Exactly 4 unique forbidden words; none equal to the secret word. Pick words/people/things that can be hinted at in one word. |
| `meen_yezawwed` | مين يزوّد؟ | `question_text` (the topic), `acceptable_answers` | At least 5 unique answers (aim for 10+). Players cannot bid above the number of answers. |

## Categories (`category`)

Only these are accepted (they match the characters' specialties in `src/data/characters.js`):

`football_post_2010`, `capitals_and_flags`, `general_knowledge`, `reflex_trivia`, `veterinary_biology`, `gelato_sweets`,
`islamic_studies`, `pc_hardware_gaming`, `console_pc_gaming`, `gaming_tech`, `cybersecurity`, `tech_networking`,
`series_breaking_bad`, `popular_foreign_series`, `health_sciences_lab`, `dentistry`, `cars_mechanics`, `fitness_gym`.

Football: use `football_post_2010` and only facts from 2010 onwards. Optional `subtopic`: `ahly`, `barcelona`, `real_madrid`, `ucl`, `legends`.

Aim for a mix of about half specialty topics and half `general_knowledge` so every character gets questions they know and some they don't.

## Notes

- `data/questions_bank.pre-cleanup.json` is the bank as it was before the cleanup (270 questions). Delete it when you no longer need it.
- Facts in new questions are your responsibility: have a second person check them before a real match.
- If the game runs on the Supabase provider with its own `questions` table, that table is separate: this file feeds the offline and Socket.IO modes.

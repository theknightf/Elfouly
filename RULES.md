# Quiz Arena — Game Rules (DRAFT v1, unofficial until the owner signs off)

Status: **[DONE]** = in code, **[TODO]** = agreed but not yet implemented.

## Format
- Exactly 4 players, 2 vs 2. Full match ~60 min. Human judge (an opposing player) always.
- Questions: Round 1 plans 3 specialty + 3 general questions per answerer turn (50/50). The specialty categories are the ones the PLAYER chose (up to 3 of 18), or the built-in character's defaults; players can also create their own character in the lobby. **[DONE]**
- Each character has ONE active power, once per match, usable only in its own round(s), tapped by its owner; everyone is notified when it fires. **[DONE]** (`src/game/powers.js`, all three providers, floating button). Foly: re-roll the current question (R1 answerer / R3 kicker). Touny: arm a shield, the next wrong answer in R1 costs nothing and opens no steal. Barbakh: instant intercept as goalie, ignores the 10 s delay (R3). Fondoqy: +10 s on the current Password card (R2, clue-givers). Eyad: cancels the next point loss (R2 foul or failed R4 bid). Mazen: locks the opposing team out of bidding for 10 s (R4). Ali: next Password card or auction win pays ×1.5 (R2/R4).

## Round 1 — 1 تو (Bank)
- 24 questions per team (48 total), 30 s per question. **[DONE]**
- Streak ladder: 0, 100, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 5000 (max 5,000). **[DONE]**
  Single source: `BANK_RULES.STREAK_LADDER` in `src/game/constants.js`.
- Wrong answer: unbanked streak is lost and the SAME question passes once to the other team at ×1 (+100, banked immediately, 30 s, judged by a player from the team that missed). Then play returns to the original team. Timeout on a normal question does not open a steal. **[DONE]** (Socket.IO, Supabase, offline)

## Round 2 — اديني في سري (Password)
- 5 cards, 45 s each, one-word clues, 4 forbidden words.
- Points scale with speed: 1000 at the start of the card, linear down to 200 at 0 s, rounded to 10 (`passwordCardPoints`). Violation = -300 and the card ends. **[DONE]** (all three providers)

## Round 3 — حط في قريبي (Penalty)
- 5 shots per team, 20 s per shot. A correct answer is a goal (1,000).
- Keeper may press Intercept only after 10 s (`PENALTY_RULES.INTERCEPT_DELAY_SECONDS`); a correct answer before that is a safe goal. The server also counts the keeper's latency compensation (max 250 ms). **[DONE]** (all three providers + button countdown)

## Round 4 — مين يزوّد؟ (Auction)
- 4 topics, 60 s bidding. Winner must name the bid number of items.
- Win: bid × 200 points (`AUCTION_RULES`, `auctionOutcome`). Failure: lose bid × 200 (never below 0, never doubled); the other team gains nothing. **[DONE]**
- Trailing team (strictly lower total score when the topic is resolved; a tie doubles nobody) gets ×2 on a successful bid only. **[DONE]** (all three providers; UI shows stake)

## Ties
- Level on total score after Round 4 → Round 3 is replayed as sudden death: one kick each (A then B), repeated until the TOTAL score differs (`needsFinalTieBreak`, `suddenDeathWinner`); then the podium. Once per match. **[DONE]** (all three providers)

- A bid can never exceed the number of valid answers of the topic (`maxPossible`); the opening bid is min(3, answers - 1). **[DONE]** (all three providers)

## Question bank (cleaned 2026-10-28, see QUESTIONS.md)
Merged 12 overlapping slugs into 18 canonical categories (football clubs became a `subtopic` tag), removed 2 duplicates (270 -> 268),
fixed Barbakh's specialties (`veterinary_medicine` -> `veterinary_biology`, `islamic_culture` -> `islamic_studies`),
added a validator and an importer (`npm run questions:validate`, `npm run questions:add`) and a bank test in `npm test`.

| Mode | Per match needs (+30% spare) | In bank now |
|---|---|---|
| one_two_bank | 48 -> ~65 | 236 (57 general + 101 drafted 2026-10-28, still need a fact-check) |
| edini_fi_seri | 5 -> ~8 | 28 |
| hat_fi_qoraybi | 10 + sudden death -> ~15 | 99 |
| meen_yezawwed | 4 -> ~6 | 15 |

Counts are fine for ONE match; the problem is **specialty depth** for Round 1 (with a 50% specialty mix, repeat matches reuse the same few):
Round 1 questions per category: tech_networking 0, fitness_gym 2, reflex_trivia 2, console_pc_gaming 2, cybersecurity 2, series_breaking_bad 3,
gaming_tech 3, dentistry 4, health_sciences_lab 4, cars_mechanics 4, islamic_studies 5, gelato_sweets 5, pc_hardware_gaming 5,
veterinary_biology 6, popular_foreign_series 6, capitals_and_flags 7, football_post_2010 18, general_knowledge 57.
Target: at least 12 Round 1 questions per specialty. Also 3 auction topics (Ballon d'Or, Premier League, UCL winners) have only 5-7 answers: fine with the bid cap, but 10+ is better.
Penalty has 0 questions for health_sciences_lab and tech_networking/gaming_tech-adjacent specialties are thin (cybersecurity 1).

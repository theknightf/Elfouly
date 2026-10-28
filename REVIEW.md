# Full game review — status after the fix pass

Review dates: 2026-10-28. "Verified" = I ran it (tests, a real server, or the browser at phone size).
"Not verified" = changed or read, but could not run end to end (mostly because it needs real Supabase keys).

## 1. Fixed

| Problem | Verified |
|---|---|
| A rematch kept old scores, bank, powers and round state | Test (`Rematch: going back to the lobby...`) |
| A judge who reloaded the page lost the judge seat for good | Test (`A judge who reloads the page gets the seat back`) |
| The private player token could have been sent in the room snapshot (new failover record) | Test (asserts it never leaks) |
| Rooms vanished on every server restart | Test (`rooms survive a server restart`), snapshot file `data/rooms-snapshot.json` |
| The Supabase project URL **and key were hardcoded in source** (shipped in every build; tests created/deleted rooms in that live project) | Removed; build contains no key. Supabase test suites now skip unless you provide keys |
| Unconfigured Supabase silently used someone else's project | App now shows the "not configured" banner |
| Two diverged copies of the question engine (tests ran a different one than the server) | Merged to `services/triviaEngine.js`; this exposed and fixed a real bug: `getQuestionForPlayer` ignored the requested category |
| Question facts: 7 football questions were wrong, unclear or unconfirmed | Web-checked and rewritten (details below) |
| Supabase mode had no host controls (rename, move, swap, reorder, judge, kick) | Not verified (needs keys) |
| Supabase "start match" never checked for 4 players in a 2 v 2 split, could run two countdowns, and could not be cancelled | Rewritten; Not verified |
| Host could not cancel the start countdown | Socket.IO: built; Supabase: built (not verified) |
| Host could not remove a player | Test (`the host can kick a player`) |
| One tap on the host round bar could wipe a round | Confirmation added |
| Players' browser crashes were invisible to the owner | `POST /api/client-error` (rate-limited, truncated) + client reporter; Test |
| Rules were only readable on the landing page | "Rules" button in the top bar (accessible dialog, Esc closes, focus returns) |
| Modals had no dialog role / Esc / focus handling | Rules, role alert and landing dialogs fixed |
| README and `RULES.md` described old rules | Rewritten |
| No CI | `.github/workflows/ci.yml` (build + tests) |
| Main JavaScript bundle ~995 KB | Round screens lazy-loaded: main chunk 626 KB |

### Fact-check (web search, 2026-10-28)
Corrected: the 2023 CAF final goal was the **equaliser** (1-1) by Mohamed Abdelmonem, not a "winning headed goal";
the player's nickname is **أفشة** (Afsha), not "قفشة" (question and Password card fixed); the 2020 final goal minute is
reported as 85 *or* 86 so the minute question was replaced with "who scored"; "الخماسية" for Al Ahly 2022-23 could not be
confirmed so that question now asks only for the coach (Koller) of the 2023 Champions League; the Club World Cup bronze
was the **2020 edition played in Feb 2021** (reworded); Mbappé / Barcelona 2011 wording tidied.
Confirmed correct (from knowledge, plus the searches above): the other football year/season questions, Ballon d'Or,
Premier League and Champions League winner lists, Al Ahly's 6 Champions League titles 2012-2024.
Second pass (religion, series, gaming, networking, security, 2026-10-29), by reading each question against what I know:
fixed Hank Schrader's relation to Walter (brother-in-law via Skyler's sister, not "Walter's sister's husband"), fixed the
La Casa de Papel question (the gang took city names from around the world, not Spanish cities), and removed the "THE CAPN"
licence-plate question because the car could not be confirmed. The rest of these categories looked correct.
Third pass (general knowledge, science, cars, fitness, food, flags, 2026-10-29), same method: fixed the Algerian flag question
(the crescent and star are red, not green), the Sphinx wording (a statue, not "embalmed"), the "longest river" question (narrowed
to Africa because the Amazon is disputed), the "only bird that flies backwards" absolutes, removed a nonsense "Red Sea / Qulzum"
question, an out-of-date "Indonesia's current capital" question, a vague Ramadan-dessert question, and 11 duplicates of the same
fact. The bank is now 491 questions, all valid.
**Not checked by search or by a person:** these passes were done by reading each question against what I know, plus web
search only for the football/Al Ahly claims. The Islamic-studies questions looked correct but a qualified reader should confirm
them, and any question about a recent event or product (graphics cards, new releases) can go out of date.

## 2. Still wrong or risky (not fixed — and why)

1. **Non-football questions are unverified** (see above). Only a person who knows the subject can finish this.
2. **Supabase mode is client-authoritative with open table policies**: anyone with the key can edit a room row. This is a
   design limit of "no server"; the only fix is to use the Socket.IO server (or add server-side rules in Supabase).
3. **The same rules are written three times** (Socket.IO server, Supabase provider, offline mode). Scoring, powers, tie-break,
   speed scoring and the auction already live in shared `src/game/*` helpers, but the flow code around them is still
   triplicated. A true single rules engine is a rewrite, not a fix; I did not attempt it.
4. **Offline (single-device) mode** has no automated tests.
5. **Round 1 needs a human judge for every answer**; there is no auto-check (open answers cannot be graded safely).
6. **A restart still loses timers**: a question that was mid-countdown when the server restarted waits for the host's
   screen to move on (the host's browser drives it). Persistence restores the room, not running timers.
7. **Very large files** (`server.js` ~3,300 lines, the Supabase provider ~2,700, `GameContext.jsx` ~1,800).

## 3. Missing (not built — and why)

- **Spectators and other player counts** (6, 8): every rule assumes exactly 2 v 2 and one referee per round. Adding this
  touches judge selection, scoring and the lobby; it is a feature project, not a fix.
- **Saved match history / leaderboard / shareable result image.**
- **Browser tests** (Playwright): needs a browser download, so I added a static undefined-variable check plus server-level
  tests instead. A real click-through suite is still the best next test investment.
- **Full keyboard and screen-reader pass** on the round screens (option buttons, auction controls).
- **Tutorial / first-time walkthrough** (the rules dialog helps, but is not a guided tour).

## 4. Suggested next steps

1. Have someone fact-check the remaining questions (start with Islamic studies, science and gaming).
2. Decide whether Supabase mode stays "friends only" and say so in the lobby.
3. Add a Playwright smoke suite (create, join, start, one question per round, rematch).
4. If you want more than 4 players or spectators, plan it as a separate feature.

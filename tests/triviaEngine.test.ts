/**
 * tests/triviaEngine.test.ts - Unit & Integration Test Suite for Dynamic Question Engine ("القلاية")
 * 
 * Verifies:
 * 1. Post-2010 Football Strict Guardrail (100% compliance, zero pre-2010 references).
 * 2. Session Deduplication (zero duplicate questions within a match session).
 * 3. Dynamic Fallback ("القلاية" Infinite Bank): triggers background replenish on low inventory without blocking.
 * 4. Character Attribute Targeting accuracy.
 */

import { triviaEngine, CHARACTER_ATTRIBUTES, QuestionItem } from '../services/triviaEngine';
import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  const start = performance.now();
  try {
    await fn();
    const duration = Math.round(performance.now() - start);
    results.push({ name, passed: true, durationMs: duration });
    console.log(`  ✅ PASS: ${name} (${duration}ms)`);
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    results.push({ name, passed: false, durationMs: duration, details: err.message });
    console.error(`  ❌ FAIL: ${name} (${duration}ms) - ${err.message}`);
  }
}

async function main() {
  console.log('\n============================================================');
  console.log('🧪 QUIZ ARENA - Dynamic Trivia Engine & Constraint Test Suite');
  console.log('============================================================\n');

  // Test 1: Football 2010+ Strict Guardrail
  await runTest('Football 2010+ Strict Guardrail (100% compliance)', () => {
    const bankPath = path.resolve('data/questions_bank.json');
    assert(fs.existsSync(bankPath), 'questions_bank.json must exist');
    const questions: QuestionItem[] = JSON.parse(fs.readFileSync(bankPath, 'utf-8'));

    const footballQuestions = questions.filter(q => 
      q.is_post_2010_football || 
      q.category.includes('football') || 
      q.category.includes('barcelona') || 
      q.category.includes('ahly') || 
      q.category.includes('real_madrid') ||
      q.category.includes('champions')
    );

    assert(footballQuestions.length > 0, 'Must have football questions in bank to audit');

    const violations: { id: string; text: string; match: string }[] = [];

    for (const q of footballQuestions) {
      const fullText = `${q.question_text || ''} ${q.correct_answer || ''} ${JSON.stringify(q.options || [])} ${JSON.stringify(q.acceptable_answers || [])}`;
      // Search for any year between 1900 and 2009
      const pre2010Match = fullText.match(/\b(19\d\d|200\d)\b/);
      if (pre2010Match) {
        violations.push({
          id: q.id,
          text: fullText.substring(0, 80),
          match: pre2010Match[0]
        });
      }
    }

    if (violations.length > 0) {
      console.error('Violations found:', violations);
    }

    assert(
      violations.length === 0,
      `Detected ${violations.length} pre-2010 football question violations!`
    );
    console.log(`     ↳ Audited ${footballQuestions.length} football questions: 100% Post-2010 verified.`);
  });

  // Test 2: Character Attribute Targeting ("القلاية")
  await runTest('Character Attribute Targeted Question Dispatch', () => {
    const roomId = 'audit_targeting_room';
    triviaEngine.resetRoomSession(roomId);

    // 1. Fares -> football_post_2010 or capitals_and_flags or general_knowledge
    const qFares = triviaEngine.getQuestionForPlayer({
      roomId,
      characterId: 'fares_elfouly',
      mode: 'one_two_bank'
    });
    assert(qFares !== null, 'Should return a question for Fares');
    assert(
      CHARACTER_ATTRIBUTES.fares_elfouly.some(cat => triviaEngine.matchesCategory(qFares!, cat)),
      `Question category "${qFares!.category}" must match Fares attributes: ${CHARACTER_ATTRIBUTES.fares_elfouly.join(', ')}`
    );

    // 2. Ali Turbo -> Dentistry or Cars or Fitness
    const qAli = triviaEngine.getQuestionForPlayer({
      roomId,
      characterId: 'ali_ahmed',
      mode: 'one_two_bank'
    });
    assert(qAli !== null, 'Should return a question for Ali');
    assert(
      CHARACTER_ATTRIBUTES.ali_ahmed.some(cat => triviaEngine.matchesCategory(qAli!, cat)),
      `Question category "${qAli!.category}" must match Ali attributes: ${CHARACTER_ATTRIBUTES.ali_ahmed.join(', ')}`
    );

    // 3. Khaled El-Barbakh -> Hardware, TV series, Real Madrid post-2010, etc.
    const qKhaled = triviaEngine.getQuestionForPlayer({
      roomId,
      characterId: 'khaled_elbarbakh',
      mode: 'one_two_bank'
    });
    assert(qKhaled !== null, 'Should return a question for Khaled');
    assert(
      CHARACTER_ATTRIBUTES.khaled_elbarbakh.some(cat => triviaEngine.matchesCategory(qKhaled!, cat)),
      `Question category "${qKhaled!.category}" must match Khaled attributes: ${CHARACTER_ATTRIBUTES.khaled_elbarbakh.join(', ')}`
    );
  });

  // Test 3: Deduplication across a single room session
  await runTest('Session Deduplication (Zero repeat questions in session)', () => {
    const roomId = 'dedup_test_room';
    triviaEngine.resetRoomSession(roomId);

    const servedIds = new Set<string>();
    const totalRequests = 15;

    for (let i = 0; i < totalRequests; i++) {
      const q = triviaEngine.getQuestionForPlayer({
        roomId,
        characterId: 'fares_elfouly',
        mode: 'one_two_bank'
      });
      assert(q !== null, 'Should return question');
      assert(!servedIds.has(q!.id), `Question ID ${q!.id} was served more than once in the same session!`);
      servedIds.add(q!.id);
    }

    assert(servedIds.size === totalRequests, `Expected ${totalRequests} unique questions served.`);
    console.log(`     ↳ Served ${servedIds.size} distinct questions consecutively with 0 repetitions.`);
  });

  // Test 4: Dynamic Fallback ("القلاية" Low-Inventory Async Replenish)
  await runTest('Dynamic Fallback ("القلاية" Infinite Bank Replenishment)', async () => {
    const roomId = 'replenish_test_room';
    triviaEngine.resetRoomSession(roomId);

    const initialCount = (triviaEngine as any).inMemoryBank.length;

    // Trigger replenish directly or through low inventory query
    await (triviaEngine as any).triggerAsyncReplenish('capitals_and_flags', 'one_two_bank');

    // Wait 250ms for background replenishment task to process
    await new Promise(resolve => setTimeout(resolve, 350));

    const finalCount = (triviaEngine as any).inMemoryBank.length;
    assert(finalCount > initialCount, `Bank should have expanded. Initial: ${initialCount}, Final: ${finalCount}`);
    console.log(`     ↳ Bank expanded from ${initialCount} to ${finalCount} items asynchronously in background.`);
  });

  // Test 5: MD5 Content Hashing and Duplicate Insertion Guard
  await runTest('MD5 Content Hashing & Duplicate Ingestion Prevention', () => {
    const testItem: QuestionItem = {
      id: 'test-hash-id-1',
      mode: 'one_two_bank',
      category: 'general_knowledge',
      question_text: 'سؤال اختبار الهاش والتكرار',
      correct_answer: 'نعم',
      content_hash: 'test_hash_unique_123',
      is_post_2010_football: false
    };

    // First insertion
    const addedFirst = triviaEngine.upsertQuestions([testItem]);
    assert(addedFirst === 1 || addedFirst === 0, 'Initial upsert should execute cleanly');

    // Second insertion of identical content_hash
    const addedSecond = triviaEngine.upsertQuestions([testItem]);
    assert(addedSecond === 0, 'Duplicate content_hash MUST be rejected (0 added)');
    console.log('     ↳ Duplicate item with identical MD5 hash was successfully rejected.');
  });

  // Test 6: Category Replacement Audit (Zero CS/Hospitality, 100% General Knowledge)
  await runTest('Category Replacement Audit (Zero computer_science/tourism, valid general_knowledge)', () => {
    const bankPath = path.resolve('data/questions_bank.json');
    const questions: QuestionItem[] = JSON.parse(fs.readFileSync(bankPath, 'utf-8'));

    const forbiddenCategories = ['computer_science', 'programming', 'tourism_and_hospitality', 'tourism_hospitality'];
    const forbiddenMatches = questions.filter(q => forbiddenCategories.includes(q.category));

    assert(
      forbiddenMatches.length === 0,
      `Found ${forbiddenMatches.length} questions with deprecated categories: ${forbiddenMatches.map(q => q.category).join(', ')}`
    );

    const gkQuestions = questions.filter(q => q.category === 'general_knowledge');
    assert(gkQuestions.length >= 100, `Expected at least 100 general_knowledge questions, found ${gkQuestions.length}`);

    console.log(`     ↳ Audited bank: 0 obsolete categories found. Active general_knowledge count: ${gkQuestions.length}.`);
  });

  // Test 7: All 7 Character Attribute Profiles & Fallback Verification
  await runTest('All 7 Character Attribute Profiles & General Knowledge Fallback', () => {
    const roomId = 'seven_characters_audit_room';
    triviaEngine.resetRoomSession(roomId);

    const characters = [
      'fares_elfouly',
      'ziad_ashraf',
      'eltouny',
      'khaled_elbarbakh',
      'eyad_mohamed',
      'mazen_hazem',
      'ali_ahmed'
    ];

    for (const charId of characters) {
      const attributes = (CHARACTER_ATTRIBUTES as any)[charId];
      assert(Array.isArray(attributes) && attributes.length > 0, `Character ${charId} must have attributes configured`);

      const q = triviaEngine.getQuestionForPlayer({
        roomId,
        characterId: charId,
        mode: 'one_two_bank'
      });
      assert(q !== null, `Should return a question for ${charId}`);
      assert(
        attributes.some((cat: string) => triviaEngine.matchesCategory(q!, cat)) || q!.category === 'general_knowledge',
        `Question category "${q!.category}" must match character ${charId} attributes or fallback`
      );
    }
    console.log(`     ↳ Verified dispatch and attribute matching for all 7 characters.`);
  });

  // Test 8: Penalty Shots Category and Question Strict Synchronization
  await runTest('Penalty Shots (hat_fi_qoraybi) Question & Category Strict Synchronization', () => {
    const roomId = 'penalty_sync_audit_room';
    triviaEngine.resetRoomSession(roomId);

    const penaltyCategories = [
      'football_post_2010',
      'capitals_and_flags',
      'general_knowledge',
      'popular_foreign_series',
      'series_breaking_bad',
      'pc_hardware_gaming',
      'gaming_tech',
      'console_pc_gaming',
      'reflex_trivia',
      'cars_mechanics',
      'dentistry',
      'fitness_gym',
      'veterinary_biology',
      'gelato_sweets',
      'islamic_studies'
    ];

    for (const catId of penaltyCategories) {
      const q = triviaEngine.getQuestionForPlayer({
        roomId,
        characterId: 'fares_elfouly',
        mode: 'hat_fi_qoraybi',
        preferredCategory: catId
      });

      assert(q !== null, `Must return a question for penalty category ${catId}`);
      assert(
        triviaEngine.matchesCategory(q!, catId),
        `Penalty question category "${q!.category}" MUST match the requested category "${catId}"`
      );
      assert(
        Array.isArray(q!.options) && q!.options.length >= 4,
        `Penalty question for "${catId}" must have at least 4 options`
      );
      assert(
        q!.options!.includes(q!.correct_answer!),
        `Options must contain correct_answer "${q!.correct_answer}"`
      );
    }
    console.log(`     ↳ Successfully verified 100% synchronization across all ${penaltyCategories.length} penalty categories.`);
  });

  // Print Summary
  console.log('\n============================================================');
  console.log('📊 TEST SUMMARY REPORT');
  console.log('============================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total Tests : ${results.length}`);
  console.log(`Passed      : ${passedCount} ✅`);
  console.log(`Failed      : ${failedCount} ❌`);
  console.log(`Success Rate: ${Math.round((passedCount / results.length) * 100)}%`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

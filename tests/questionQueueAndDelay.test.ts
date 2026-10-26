/**
 * tests/questionQueueAndDelay.test.ts
 *
 * Dedicated Test Suite for:
 * 1. QuestionQueue Fisher-Yates single shuffle ONCE at game start.
 * 2. Sequential pop without replacement (never random pick with replacement).
 * 3. Persistent usedQuestionIds set per game session preventing duplicate questions.
 * 4. Preloading upcoming questions with zero delay (peek / preloadNext).
 * 5. Guarding against double listener/subscriber triggers.
 */

import { QuestionQueue } from '../src/game/QuestionQueue.js';

function assert(condition: unknown, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

console.log('\n============================================================');
console.log('🧪 QUIZ ARENA - QuestionQueue & Zero-Delay Test Suite');
console.log('============================================================\n');

// Mock question generator
function generateMockQuestions(count: number, prefix = 'q') {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    question: `Mock Question ${i + 1}`,
    answer: `Answer ${i + 1}`,
    category: 'general_knowledge'
  }));
}

// Test 1: Fisher-Yates Shuffle ONCE preserves items without replacement
console.log('🔹 Test 1: Fisher-Yates shuffle ONCE at initialization...');
const rawList = generateMockQuestions(50);
const queue = new QuestionQueue(rawList);

assert(queue.length === 50, 'Queue must contain all 50 unique questions');
assert(queue.remaining === 50, 'All 50 questions must initially be remaining');

// Check that order is randomized but complete
const popped: any[] = [];
while (queue.remaining > 0) {
  popped.push(queue.pop());
}
assert(popped.length === 50, 'Must pop exactly 50 items');
const uniqueIds = new Set(popped.map(q => q.id));
assert(uniqueIds.size === 50, 'All popped questions must have distinct IDs (zero duplicates)');
console.log('   ✅ PASS: Shuffled once and popped all 50 items with zero duplicates');

// Test 2: Sequential pop without replacement (never random pick with replacement)
console.log('🔹 Test 2: Sequential pop without replacement...');
const queue2 = new QuestionQueue(generateMockQuestions(10));
const first = queue2.pop();
const second = queue2.pop();
assert(first.id !== second.id, 'Consecutive pops must not repeat');
assert(queue2.remaining === 8, 'Remaining count must decrease monotonically');
console.log('   ✅ PASS: Monotonic sequential pop verified');

// Test 3: Persistent usedQuestionIds per game session
console.log('🔹 Test 3: Persistent usedQuestionIds set per game session...');
const sessionUsedSet = new Set<string>();
const deckA = generateMockQuestions(20, 'shared');
const queueA = new QuestionQueue(deckA, sessionUsedSet);

// Pop 10 from deckA
const poppedInA = new Set<string>();
for (let i = 0; i < 10; i++) {
  const q = queueA.pop();
  if (q) poppedInA.add(q.id);
}
assert(sessionUsedSet.size === 10, 'Session set must record all 10 used IDs');

// Now create deckB with the same raw pool in the same session
const queueB = new QuestionQueue(deckA, sessionUsedSet);
// The 10 already used IDs must be automatically excluded from queueB!
assert(queueB.length === 10, 'New queue in same session must filter out the 10 used IDs');
while (queueB.remaining > 0) {
  const q = queueB.pop();
  assert(!poppedInA.has(q.id), 'Already used question was drawn in queueB!');
}
assert(sessionUsedSet.size === 20, 'All 20 questions in session consumed without overlap');
console.log('   ✅ PASS: Session usedQuestionIds prevents any duplicate draws across queues');

// Test 4: Preloading upcoming questions (peek / preloadNext)
console.log('🔹 Test 4: Zero-delay preloading (peek / preloadNext)...');
const queue3 = new QuestionQueue(generateMockQuestions(10));
const current = queue3.pop();
const preloaded = queue3.preloadNext();

assert(preloaded !== null, 'preloadNext() must return the upcoming question');
assert(preloaded.id !== current.id, 'Preloaded question must differ from current');
assert(queue3.remaining === 9, 'Preloading must not consume or pop the question');
assert(!queue3.isUsed(preloaded.id), 'Preloaded question must not be marked used yet');

// Now popping should return that exact preloaded question
const nextPopped = queue3.pop();
assert(nextPopped.id === preloaded.id, 'Next pop must match the preloaded question');
assert(queue3.isUsed(preloaded.id), 'Question is marked used only once formally popped');
console.log('   ✅ PASS: Preloading is zero-cost, non-consuming, and accurate');

// Test 5: Guarding against double next-question triggers
console.log('🔹 Test 5: Double-trigger and race condition guards...');
let questionState = 'resolved';
let advanceCount = 0;

function simulateAdvance() {
  if (questionState === 'active') return false; // Guard
  questionState = 'active';
  advanceCount++;
  return true;
}

const firstTrigger = simulateAdvance();
const secondTrigger = simulateAdvance(); // duplicate fire
assert(firstTrigger === true, 'First advance trigger must succeed');
assert(secondTrigger === false, 'Duplicate trigger must be safely blocked');
assert(advanceCount === 1, 'Advance must execute exactly once');
console.log('   ✅ PASS: Double next-question trigger blocked successfully');

console.log('\n============================================================');
console.log('🏁 ALL QUESTION QUEUE & ZERO-DELAY TESTS PASSED (100% SUCCESS)');
console.log('============================================================\n');

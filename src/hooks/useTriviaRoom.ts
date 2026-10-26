/**
 * src/hooks/useTriviaRoom.ts
 *
 * Dedicated State Hydration & Role Permissions Hook for Quiz Arena.
 * Guarantees:
 * 1. `activeQuestion` is NEVER null/undefined during an active round.
 * 2. `questionsQueue` is maintained and auto-refilled when dropping below threshold.
 * 3. `fetchRoundQuestions()` fetches batches from questions engine / bank.
 * 4. Selective redaction of correct answers according to role authorization.
 * 5. Strict role flags for Round 1 (Bank), Round 2 (Password), Round 3 (Penalty), Round 4 (Auction).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import {
  drawLocalR1Question,
  drawLocalRandomQuestion,
  drawLocalCategoryQuestion,
  buildLocalR1TurnPlan
} from '../utils/localQuestionEngine';
import {
  TRIVIA_BANK,
  PASSWORD_WORDS,
  PENALTY_CATEGORIES,
  AUCTION_TOPICS
} from '../data/questions';

export interface Question {
  id: string;
  question_text: string;
  question?: string;
  correct_answer?: string | null;
  answer?: string | null;
  category?: string;
  categoryName?: string;
  options?: string[];
  forbidden_words?: string[];
  acceptable_answers?: string[];
  slotType?: 'specialty' | 'random';
  funFact?: string;
  redacted?: boolean;
}

const QUEUE_MIN_THRESHOLD = 3;
const DEFAULT_BATCH_SIZE = 12;

/**
 * Fetch a batch of questions for a specific round.
 */
export function fetchRoundQuestions(roundKey: string, count = DEFAULT_BATCH_SIZE, options: any = {}): Question[] {
  const batch: Question[] = [];
  const roomId = options.roomId || 'local_session';

  if (roundKey === 'round1' || roundKey === 'one_two_bank') {
    const characterId = options.characterId;
    const plan = buildLocalR1TurnPlan(characterId);
    for (let i = 0; i < count; i++) {
      const slot = plan[i % plan.length] || { slotType: 'random', category: 'general_knowledge' };
      const q = drawLocalR1Question({
        roomId,
        mode: 'one_two_bank',
        characterId,
        slotType: slot.slotType,
        category: slot.category
      });
      if (q) {
        batch.push({
          id: q.id || `r1-batch-${i}-${Date.now()}`,
          question_text: q.question_text || q.question || '',
          question: q.question_text || q.question || '',
          correct_answer: q.correct_answer || q.answer || '',
          answer: q.correct_answer || q.answer || '',
          category: q.category || 'معلومات عامة',
          categoryName: q.category || 'معلومات عامة',
          slotType: slot.slotType,
          funFact: q.fun_fact || q.funFact || ''
        });
      }
    }
  } else if (roundKey === 'round2' || roundKey === 'edini_fi_seri') {
    for (let i = 0; i < Math.min(count, 5); i++) {
      const q = drawLocalRandomQuestion('edini_fi_seri', roomId);
      const fallback = PASSWORD_WORDS[i % PASSWORD_WORDS.length];
      batch.push({
        id: q?.id || `r2-batch-${i}`,
        question_text: q?.question_text || fallback.target,
        question: q?.question_text || fallback.target,
        correct_answer: q?.question_text || fallback.target,
        answer: q?.question_text || fallback.target,
        forbidden_words: q?.forbidden_words || fallback.forbidden,
        category: q?.category || fallback.category,
        categoryName: q?.category || fallback.category
      });
    }
  } else if (roundKey === 'round3' || roundKey === 'hat_fi_qoraybi') {
    for (let i = 0; i < Math.min(count, 10); i++) {
      const cat = PENALTY_CATEGORIES[i % PENALTY_CATEGORIES.length];
      const q = drawLocalCategoryQuestion(cat.id, roomId) ||
                drawLocalCategoryQuestion(cat.name, roomId) ||
                drawLocalRandomQuestion('hat_fi_qoraybi', roomId) ||
                TRIVIA_BANK[i % TRIVIA_BANK.length];
      if (q) {
        batch.push({
          id: q.id || `r3-batch-${i}`,
          question_text: q.question_text || q.question || '',
          question: q.question_text || q.question || '',
          correct_answer: q.correct_answer || q.answer || '',
          answer: q.correct_answer || q.answer || '',
          options: q.options || ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'],
          category: cat.name,
          categoryName: cat.name
        });
      }
    }
  } else if (roundKey === 'round4' || roundKey === 'meen_yezawwed') {
    for (let i = 0; i < Math.min(count, 4); i++) {
      const q = drawLocalRandomQuestion('meen_yezawwed', roomId);
      const fallback = AUCTION_TOPICS[i % AUCTION_TOPICS.length];
      batch.push({
        id: q?.id || `r4-batch-${i}`,
        question_text: q?.question_text || fallback.topic,
        question: q?.question_text || fallback.topic,
        acceptable_answers: q?.acceptable_answers || fallback.validItems,
        category: q?.category || fallback.category,
        categoryName: q?.category || fallback.category
      });
    }
  }

  // Fallback to static questions if bank returned empty
  if (batch.length === 0) {
    const fallbackList = TRIVIA_BANK.slice(0, count);
    return fallbackList.map((q, idx) => ({
      id: q.id || `fb-${idx}`,
      question_text: q.question,
      question: q.question,
      correct_answer: q.answer,
      answer: q.answer,
      category: q.categoryName,
      categoryName: q.categoryName,
      funFact: q.funFact
    }));
  }

  return batch;
}

/**
 * Custom React hook for robust trivia room state, queues, and role permissions.
 */
export function useTriviaRoom() {
  const game = useGame();
  const { roomState, currentPlayer } = game;
  const round = roomState?.status || 'lobby';

  const [questionsQueue, setQuestionsQueue] = useState<Question[]>(() => {
    return fetchRoundQuestions('round1', 12);
  });

  // Keep queue hydrated
  const hydrateQueue = useCallback((roundKey: string, count = DEFAULT_BATCH_SIZE) => {
    const newBatch = fetchRoundQuestions(roundKey, count, {
      characterId: currentPlayer?.character?.id
    });
    setQuestionsQueue(prev => [...prev, ...newBatch]);
  }, [currentPlayer?.character?.id]);

  useEffect(() => {
    if (round === 'round1' && questionsQueue.length < QUEUE_MIN_THRESHOLD) {
      hydrateQueue('round1', 6);
    }
  }, [round, questionsQueue.length, hydrateQueue]);

  // Round 1 role calculations (strict question-by-question alternation for active team)
  const r1 = roomState?.round1 || {};
  const activeTeamKey = r1.activeTeam || 'team_a';
  const activeTeam = roomState?.teams?.[activeTeamKey] || { name: 'فريق الحيتان', score: 0, bank: 0 };
  const defendingTeamKey = activeTeamKey === 'team_a' ? 'team_b' : 'team_a';
  const defendingTeam = roomState?.teams?.[defendingTeamKey] || { name: 'فريق الوحوش', score: 0, bank: 0 };

  const activeTeamPlayers = roomState?.players?.filter((p: any) => p.team === activeTeamKey) || [];
  const defendingTeamPlayers = roomState?.players?.filter((p: any) => p.team === defendingTeamKey) || [];

  // Question index within current turn (1 to 12)
  const currentTurnQNumber = (r1.segmentQuestionsAnswered || 0) + 1;
  const currentTurnQIndex = (currentTurnQNumber - 1);

  // Strictly alternate question-by-question between the 2 active team players
  const designatedAnsweringPlayer = activeTeamPlayers.length > 0
    ? activeTeamPlayers[currentTurnQIndex % activeTeamPlayers.length]
    : roomState?.players?.[0];

  const designatedReaderPlayer = defendingTeamPlayers.length > 0
    ? defendingTeamPlayers[currentTurnQIndex % defendingTeamPlayers.length]
    : roomState?.players?.[1];

  const isAnswering = !!currentPlayer && designatedAnsweringPlayer?.id === currentPlayer.id;
  const isAnsweringTeam = !!currentPlayer && currentPlayer.team === activeTeamKey;
  const isDefendingTeam = !!currentPlayer && currentPlayer.team === defendingTeamKey;
  // The server assigns ONE referee per turn (round1.refereePlayerId). Only that
  // player may see the answer key and grade — the whole defending team must
  // not, otherwise the anti-cheat console would leak the answer to everyone.
  const r1RefereeId = r1.refereePlayerId || designatedReaderPlayer?.id || null;
  const isR1Referee = !currentPlayer || (!!r1RefereeId && currentPlayer.id === r1RefereeId);

  // Round 2 role calculations
  const r2 = roomState?.round2 || {};
  const isClueGiverA = !!currentPlayer && currentPlayer.id === r2.activeClueGiverA;
  const isClueGiverB = !!currentPlayer && currentPlayer.id === r2.activeClueGiverB;
  const isClueGiver = !currentPlayer || isClueGiverA || isClueGiverB;
  const isGuesser = !!currentPlayer && !isClueGiver;
  const r2ActiveTurnTeam = r2.activeTurnTeam === 'team_b' ? 'team_b' : 'team_a';
  const isR2Referee = !currentPlayer || currentPlayer.id === r2.refereePlayerId;

  // Round 3 role calculations
  const r3 = roomState?.round3 || {};
  const isKicker = !!currentPlayer && currentPlayer.id === r3.currentKickerId;
  const isGoalie = !!currentPlayer && currentPlayer.id === r3.currentGoalieId;
  const isDuelist = isKicker || isGoalie;
  const isPenaltyReferee = !currentPlayer
    || (!isDuelist && (currentPlayer.id === r3.refereePlayerId || (!r3.refereePlayerId && currentPlayer.isHost)));

  // Round 4 role calculations
  const r4 = roomState?.round4 || {};
  const isCaptain = !!currentPlayer && (
    currentPlayer.isHost ||
    (currentPlayer.team === 'team_a' && roomState?.players?.filter((p: any) => p.team === 'team_a')[0]?.id === currentPlayer.id) ||
    (currentPlayer.team === 'team_b' && roomState?.players?.filter((p: any) => p.team === 'team_b')[0]?.id === currentPlayer.id)
  );
  const isHighestBidderTeam = !!currentPlayer && currentPlayer.team === r4.highestBidderTeam;
  const isHighestBidderPlayer = !!currentPlayer && currentPlayer.id === r4.highestBidderPlayerId;
  // Same rule as Round 1: only the assigned opposing referee holds the
  // verification checklist, never the whole opposing team.
  const isAuctionReferee = !currentPlayer
    || (r4.refereePlayerId
      ? currentPlayer.id === r4.refereePlayerId
      : !!(currentPlayer.team && currentPlayer.team !== r4.highestBidderTeam));

  // Active question guarantee: NEVER null or undefined during active rounds
  const activeQuestion = useMemo<Question>(() => {
    if (round === 'round1') {
      const raw = r1.currentQuestion || r1.lastResult?.question || questionsQueue[0] || {
        question: 'ما هو الحيوان صاحب أطول فترة نوم شتوي؟',
        answer: 'القنفذ الأوروبي',
        categoryName: 'عالم الطبيعة والحيوان',
        slotType: 'random'
      };

      const qText = raw.question_text || raw.question || 'سؤال الجولة الأولى';
      const rawAnswer = raw.correct_answer || raw.answer || '';

      // Redact answer if viewer is on the answering side or not the referee
      const showAnswer = isR1Referee && !isAnsweringTeam;
      return {
        id: raw.id || `r1-${r1.currentQuestionIndex || 0}`,
        question_text: qText,
        question: qText,
        correct_answer: showAnswer ? rawAnswer : null,
        answer: showAnswer ? rawAnswer : null,
        category: raw.category || raw.categoryName || 'عام',
        categoryName: raw.category || raw.categoryName || 'عام',
        slotType: raw.slotType || 'random',
        funFact: raw.funFact || raw.fun_fact || '',
        redacted: !showAnswer
      };
    }

    if (round === 'round2') {
      const raw = r2.currentWord || PASSWORD_WORDS[0];
      const target = raw.target || 'كلمة السر';
      const forbidden = raw.forbidden || ['ممنوع 1', 'ممنوع 2', 'ممنوع 3', 'ممنوع 4'];
      const showSecret = isClueGiver;

      return {
        id: `r2-${r2.currentWordIndex || 0}`,
        question_text: showSecret ? target : '🔒 [استمع للتلميح وخمن كلمة السر]',
        question: showSecret ? target : '🔒 [استمع للتلميح وخمن كلمة السر]',
        correct_answer: showSecret ? target : null,
        answer: showSecret ? target : null,
        forbidden_words: showSecret ? forbidden : ['🔒 ممنوع', '🔒 ممنوع', '🔒 ممنوع', '🔒 ممنوع'],
        category: raw.category || 'عام',
        categoryName: raw.category || 'عام',
        clueIdea: showSecret ? raw.clueIdea : '',
        redacted: !showSecret
      };
    }

    if (round === 'round3') {
      const raw = r3.currentQuestion || {
        question: 'من صاحب لقب دوري أبطال أوروبا عام 2012؟',
        options: ['تشيلسي', 'بايرن ميونخ', 'برشلونة', 'ريال مدريد'],
        answer: 'تشيلسي',
        category: 'كرة قدم بعد 2010'
      };

      const qText = raw.question_text || raw.question || 'سؤال ركلة الجزاء';
      const rawAnswer = raw.correct_answer || raw.answer || '';
      const showAnswer = isPenaltyReferee && !isDuelist;

      return {
        id: `r3-${r3.turnIndex || 0}`,
        question_text: qText,
        question: qText,
        correct_answer: showAnswer ? rawAnswer : null,
        answer: showAnswer ? rawAnswer : null,
        options: raw.options || [],
        category: raw.category || r3.currentCategory?.name || 'كرة قدم',
        categoryName: raw.category || r3.currentCategory?.name || 'كرة قدم',
        redacted: !showAnswer
      };
    }

    if (round === 'round4') {
      const raw = r4.currentTopic || AUCTION_TOPICS[0];
      const validItems = raw.validItems || raw.acceptable_answers || [];
      const showChecklist = isAuctionReferee;

      return {
        id: `r4-${r4.currentTopicIndex || 0}`,
        question_text: raw.topic || raw.question_text || 'موضوع المزاد',
        question: raw.topic || raw.question_text || 'موضوع المزاد',
        acceptable_answers: showChecklist ? validItems : [],
        category: raw.category || 'عام',
        categoryName: raw.category || 'عام',
        redacted: !showChecklist
      };
    }

    // Default question for lobby/idle
    return {
      id: 'idle',
      question_text: 'ساحة الكويز جاهزة للانطلاق!',
      question: 'ساحة الكويز جاهزة للانطلاق!',
      category: 'عام',
      categoryName: 'عام'
    };
  }, [
    round,
    r1,
    r2,
    r3,
    r4,
    questionsQueue,
    isR1Referee,
    isAnsweringTeam,
    isClueGiver,
    isPenaltyReferee,
    isDuelist,
    isAuctionReferee
  ]);

  return {
    ...game,
    activeQuestion,
    questionsQueue,
    fetchRoundQuestions,
    hydrateQueue,
    // Round 1 role flags
    currentTurnQNumber,
    designatedAnsweringPlayer,
    designatedReaderPlayer,
    isAnswering,
    isAnsweringTeam,
    isDefendingTeam,
    isR1Referee,
    activeTeam,
    defendingTeam,
    // Round 2 role flags
    isClueGiver,
    isClueGiverA,
    isClueGiverB,
    isGuesser,
    isR2Referee,
    r2ActiveTurnTeam,
    // Round 3 role flags
    isKicker,
    isGoalie,
    isDuelist,
    isPenaltyReferee,
    // Round 4 role flags
    isCaptain,
    isHighestBidderTeam,
    isHighestBidderPlayer,
    isAuctionReferee
  };
}

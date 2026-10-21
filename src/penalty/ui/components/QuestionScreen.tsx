import { useEffect, useRef, useState } from 'react';
import {
  categoryLabel,
  isGeneralCategory,
  specialtyIcon
} from '../../engine/categories';
import { getCurrentKick, getPlayer } from '../../engine/selectors';
import type { Match } from '../../engine/types';
import { useCountdown } from '../hooks/useCountdown';
import { teamTheme } from '../theme';
import { PlayerBadge } from './PlayerBadge';
import { TimerRing } from './TimerRing';

interface QuestionScreenProps {
  match: Match;
  onAnswer: (optionIndex: number) => void;
  onTimeout: () => void;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د'];

export function QuestionScreen({
  match,
  onAnswer,
  onTimeout
}: QuestionScreenProps) {
  const active = match.activeQuestion;
  const countdown = useCountdown(active?.deadlineAt ?? null);
  const [chosen, setChosen] = useState<number | null>(null);
  const answeredForRef = useRef<string | null>(null);
  const timedOutForRef = useRef<string | null>(null);

  const question = active?.question;
  const questionId = question?.id ?? null;

  useEffect(() => {
    setChosen(null);
    answeredForRef.current = null;
  }, [questionId]);

  useEffect(() => {
    if (!active || countdown > 0) {
      return;
    }
    // The countdown hook keeps its previous value for one render when a new
    // question starts. Never fire a timeout for a deadline that is still in
    // the future; that would also mark the new question as already timed out.
    if (Date.now() < active.deadlineAt) {
      return;
    }
    if (timedOutForRef.current === active.question.id) {
      return;
    }
    timedOutForRef.current = active.question.id;
    onTimeout();
  }, [active, countdown, onTimeout]);

  if (!active || !question) {
    return null;
  }

  const kick = getCurrentKick(match);
  if (!kick) {
    return null;
  }

  const isAttacker = active.phase === 'attacker';
  const teamId = isAttacker ? kick.attackingTeamId : kick.defendingTeamId;
  const theme = teamTheme(teamId);
  const playerId = isAttacker ? kick.attackerId : kick.goalkeeperId;
  const player = getPlayer(match, playerId);
  const general = isGeneralCategory(question.category);
  const category = String(question.category || 'general');
  const inSpecialty = Boolean(player?.attributes.includes(category));
  const bonusAvailable = Boolean(player && !general && !inSpecialty);
  const categoryText = question.categoryLabel || categoryLabel(category);
  const remainingSeconds = Math.max(0, Math.ceil(countdown / 1000));

  const choose = (optionIndex: number) => {
    if (answeredForRef.current === question.id) {
      return;
    }
    answeredForRef.current = question.id;
    setChosen(optionIndex);
    onAnswer(optionIndex);
  };

  return (
    <section className="pk-fade-up space-y-3">
      <div className="pk-card overflow-hidden rounded-3xl border border-white/10 bg-black/35">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-white/[0.025] px-3 py-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${theme.border} ${theme.text}`}>
                {isAttacker ? '⚽ سؤال المسدد' : '🧤 سؤال الحارس'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-gray-300">
                {match.suddenDeath
                  ? `جولة فاصلة ${
                      match.currentRoundNumber - match.config.regulationRounds + 1
                    }`
                  : `الجولة ${match.currentRoundNumber}`}
              </span>
              {match.suddenDeath && (
                <span className="rounded-full border border-arena-yellow/50 bg-arena-yellow/10 px-2 py-0.5 text-[9px] font-black text-arena-yellow">
                  موت مفاجئ ⚡
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-lg font-black text-white sm:text-xl">
              {isAttacker ? 'سجّل هدف لفريقك!' : 'أنقذ مرماك!'}
            </h2>
            <p className="mt-0.5 text-[10px] font-bold text-gray-400">
              {isAttacker
                ? `إجابة صحيحة = هدف +1 لصالح ${match.teams[teamId].name}.`
                : `إجابة صحيحة = تصدي +1 لصالح ${match.teams[teamId].name}.`}
            </p>
          </div>
          <TimerRing
            remainingMs={countdown}
            totalMs={Math.max(
              1,
              active.deadlineAt - active.startedAt
            )}
            size={94}
          />
        </div>

        <div className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <PlayerBadge player={player} teamId={teamId} role={active.phase} compact />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold text-gray-300">
                {general ? '🌐' : specialtyIcon(category)} {categoryText}
              </span>
              {bonusAvailable && (
                <span className="pk-bonus-chip rounded-full border border-arena-yellow/60 bg-arena-yellow/15 px-2 py-1 text-[9px] font-black text-arena-yellow">
                  خارج التخصص • بونص +1
                </span>
              )}
            </div>
          </div>

          <div
            className="rounded-2xl border border-white/10 bg-[#0c1025]/80 p-3 sm:p-4"
            aria-live="polite"
          >
            <p className="text-base font-black leading-relaxed text-white sm:text-lg">
              {question.prompt}
            </p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {question.options.map((option, index) => (
              <button
                key={`${question.id}-${index}`}
                type="button"
                disabled={chosen !== null}
                onClick={() => choose(index)}
                className={`pk-answer group flex min-h-[54px] items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 text-right transition active:scale-[0.99] ${
                  chosen === index
                    ? 'border-arena-yellow bg-arena-yellow/20'
                    : 'border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.07]'
                } disabled:cursor-default`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/30 font-mono text-xs font-black text-arena-cyan group-hover:border-arena-cyan/40">
                  {OPTION_LETTERS[index] || index + 1}
                </span>
                <span className="text-xs font-bold leading-snug text-white sm:text-sm">
                  {option}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[9px] font-bold text-gray-500">
            <span>الوقت المتبقي: {remainingSeconds} ثانية</span>
            <span>لو الوقت خلص، الإجابة تتحسب غلط.</span>
          </div>
        </div>
      </div>

      {bonusAvailable && (
        <p className="text-center text-[10px] font-bold text-arena-yellow/90">
          {player?.name} مش متخصص في {categoryText}. لو جاوب صح، فريقه هياخد نقطة
          الركلة + نقطة بونص.
        </p>
      )}
    </section>
  );
}

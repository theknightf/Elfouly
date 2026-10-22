import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { ShieldCheck, Megaphone, Target } from 'lucide-react';

const ACK_STORAGE_KEY = 'elfouly-role-alerts-ack';

function readAcks() {
  try {
    const raw = window.localStorage.getItem(ACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAcks(acks) {
  try {
    window.localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(acks));
  } catch {
    // Storage can be unavailable (private mode); alerts simply reappear.
  }
}

/**
 * Blocking role alert. Each player only ever sees the alert that belongs to
 * their own role:
 *  - the answerer gets "It's your turn to answer!"
 *  - the single assigned judge gets "You are the judge for this round."
 *  - the selected penalty shooter gets "You are shooting!"
 *
 * The alert is acknowledged per question/round, so it never blocks the same
 * turn twice.
 */
export default function RoleAlertModal() {
  const { roomState, currentPlayer } = useGame();
  const [acks, setAcks] = useState(readAcks);

  const alert = useMemo(() => {
    if (!roomState || !currentPlayer) return null;
    const playerId = currentPlayer.id;
    const isSingleJudge = roomState.singleJudgeId === playerId;

    if (roomState.status === 'round1' && roomState.round1?.currentQuestion) {
      const r1 = roomState.round1;
      const key = `r1:${roomState.code || 'room'}:${r1.actionToken || r1.currentQuestionIndex || 'q'}:${r1.totalQuestionsAnswered || 0}`;
      if (playerId === r1.answeringPlayerId && !isSingleJudge) {
        return {
          key,
          title: "It's your turn to answer!",
          body: 'أجب بصوت عالٍ الآن — جميع أدوات الإجابة مقفولة لباقي اللاعبين.',
          tone: 'cyan',
          icon: Megaphone,
          role: 'answerer'
        };
      }
      if (playerId === (roomState.singleJudgeId || r1.refereePlayerId)) {
        return {
          key,
          title: 'You are the judge for this round.',
          body: 'أنت الحكم الوحيد لهذه الفقرة وممنوع من الإجابة. أزرار الحكم مفعلة لك الآن: [صح / Correct]، [غلط / Incorrect]، والتحكم بالتايمر.',
          tone: 'red',
          icon: ShieldCheck,
          role: 'judge'
        };
      }
    }

    if (roomState.status === 'round3' && roomState.round3?.currentQuestion) {
      const r3 = roomState.round3;
      const key = `r3:${roomState.code || 'room'}:${r3.turnIndex}:${r3.currentKickerId || ''}`;
      if (playerId === r3.currentKickerId && !isSingleJudge) {
        return {
          key,
          title: "It's your turn to answer!",
          body: 'أنت المسدد المختار لهذه الركلة! جاوب على السؤال — أزرار الاختيار مفعلة لك فقط.',
          tone: 'cyan',
          icon: Target,
          role: 'answerer'
        };
      }
      if (playerId === (roomState.singleJudgeId || r3.refereePlayerId)) {
        return {
          key,
          title: 'You are the judge for this round.',
          body: 'أنت الحكم الوحيد لهذه الركلة وممنوع من الإجابة. أزرار القرار مفعلة لك: [هدف / Goal] أو [ضاعت / Miss]، والبونص يُحسب تلقائياً.',
          tone: 'red',
          icon: ShieldCheck,
          role: 'judge'
        };
      }
    }

    return null;
  }, [roomState, currentPlayer]);

  useEffect(() => {
    if (!alert) return;
    if (acks[alert.key]) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [alert, acks]);

  if (!alert || acks[alert.key]) return null;

  const Icon = alert.icon;
  const toneClasses = alert.tone === 'red'
    ? 'border-arena-red/70 shadow-[0_0_40px_rgba(239,68,68,0.35)]'
    : 'border-arena-cyan/70 shadow-[0_0_40px_rgba(34,211,238,0.35)]';
  const iconClasses = alert.tone === 'red' ? 'bg-arena-red/20 text-arena-red' : 'bg-arena-cyan/20 text-arena-cyan';

  const acknowledge = () => {
    const next = { ...acks, [alert.key]: true };
    setAcks(next);
    writeAcks(next);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`w-full max-w-sm bg-arena-card border-[3px] rounded-3xl p-6 text-center ${toneClasses}`}>
        <div className={`w-14 h-14 mx-auto rounded-2xl border-2 border-[#090614] flex items-center justify-center ${iconClasses}`}>
          <Icon className="w-7 h-7" />
        </div>
        <h2 className="mt-4 text-lg font-black text-white leading-snug">{alert.title}</h2>
        <p className="mt-2 text-xs font-bold text-gray-400 leading-relaxed">{alert.body}</p>
        <button
          onClick={acknowledge}
          className="mt-5 w-full btn-arcade-yellow py-3 rounded-2xl font-black text-sm cursor-pointer shadow-xl hover:scale-[1.02]"
        >
          تمام، فهمت 👌
        </button>
      </div>
    </div>
  );
}

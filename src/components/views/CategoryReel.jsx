import React, { useEffect, useState } from 'react';
import { PENALTY_CATEGORIES } from '../../data/questions';
import { categoryLabel } from '../../utils/categoryLabels';

const SPIN_MS = 1800;
const TICK_MS = 90;

/**
 * Slot-style reel for the category the server already drew. It is purely visual:
 * it shuffles through the pool, then lands on `category` (re-spins when it changes).
 */
export default function CategoryReel({ category }) {
  const pool = PENALTY_CATEGORIES.map(item => item.id);
  const targetId = category?.id;
  const [shown, setShown] = useState(targetId);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!targetId || pool.length < 2) {
      setShown(targetId);
      return undefined;
    }
    setSpinning(true);
    const startedAt = Date.now();
    const ticker = setInterval(() => {
      if (Date.now() - startedAt >= SPIN_MS) {
        clearInterval(ticker);
        setShown(targetId);
        setSpinning(false);
        return;
      }
      setShown(pool[Math.floor(Math.random() * pool.length)]);
    }, TICK_MS);
    return () => clearInterval(ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  if (!targetId) return null;
  return (
    <div className="rounded-2xl border-2 border-arena-yellow/50 bg-black/40 p-3 text-center" aria-live="polite">
      <div className="text-[10px] font-bold text-gray-400">{spinning ? 'بنختار الفئة…' : 'فئة الركلة'}</div>
      <div className={`mt-1 text-lg font-black text-arena-yellow ${spinning ? 'animate-pulse' : ''}`}>
        {categoryLabel(shown)}
      </div>
    </div>
  );
}

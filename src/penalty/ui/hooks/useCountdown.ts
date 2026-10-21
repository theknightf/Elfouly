import { useEffect, useState } from 'react';

/**
 * Presentation-only countdown. The engine still validates the deadline
 * against the `now` value sent with every event.
 */
export function useCountdown(deadlineAt: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    deadlineAt ? Math.max(0, deadlineAt - Date.now()) : 0
  );

  useEffect(() => {
    if (!deadlineAt) {
      setRemaining(0);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (!active) {
        return;
      }
      const left = Math.max(0, deadlineAt - Date.now());
      setRemaining(left);
      if (left > 0) {
        timer = setTimeout(tick, 100);
      }
    };

    tick();

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [deadlineAt]);

  return remaining;
}

/**
 * Small deterministic PRNG used by the penalty engine.
 * Keeping the state on the Match makes every random decision reproducible in tests.
 */

export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  const text = String(seed);
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextRandom(state: number): { state: number; value: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = Math.imul(nextState ^ (nextState >>> 15), 1 | nextState);
  value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
  return {
    state: nextState,
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296
  };
}

export function randomInt(
  state: number,
  maxExclusive: number
): { state: number; value: number } {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('randomInt requires a positive integer bound');
  }

  const next = nextRandom(state);
  return {
    state: next.state,
    value: Math.min(maxExclusive - 1, Math.floor(next.value * maxExclusive))
  };
}

export function shuffle<T>(
  items: readonly T[],
  state: number
): { items: T[]; state: number } {
  const result = [...items];
  let nextState = state;

  for (let i = result.length - 1; i > 0; i -= 1) {
    const picked = randomInt(nextState, i + 1);
    nextState = picked.state;
    const swap = result[i];
    result[i] = result[picked.value];
    result[picked.value] = swap;
  }

  return { items: result, state: nextState };
}

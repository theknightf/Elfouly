interface TimerRingProps {
  remainingMs: number;
  totalMs: number;
  size?: number;
}

export function TimerRing({ remainingMs, totalMs, size = 108 }: TimerRingProps) {
  const safeTotal = Math.max(1, totalMs);
  const ratio = Math.max(0, Math.min(1, remainingMs / safeTotal));
  const seconds = Math.ceil(remainingMs / 1000);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);
  const urgent = remainingMs <= 5_000;
  const warning = remainingMs <= 10_000 && !urgent;
  const stroke = urgent ? '#FF4B4B' : warning ? '#FFD200' : '#00F2FE';

  return (
    <div
      className={`relative shrink-0 ${urgent ? 'animate-pk-urgent' : ''}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`الوقت المتبقي ${Math.max(0, seconds)} ثانية`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 200ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className={`font-mono text-3xl font-black tabular-nums ${
            urgent ? 'text-arena-red' : warning ? 'text-arena-yellow' : 'text-white'
          }`}
        >
          {Math.max(0, seconds)}
        </span>
        <span className="mt-1 text-[9px] font-bold text-gray-400">ثانية</span>
      </div>
    </div>
  );
}

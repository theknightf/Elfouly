import type { TeamId } from '../engine/types';

export const TEAM_THEME: Record<
  TeamId,
  {
    hex: string;
    label: string;
    shortLabel: string;
    text: string;
    border: string;
    background: string;
    softBackground: string;
    ring: string;
    shadow: string;
  }
> = {
  A: {
    hex: '#00F2FE',
    label: 'الفريق أ',
    shortLabel: 'A',
    text: 'text-arena-cyan',
    border: 'border-arena-cyan',
    background: 'bg-arena-cyan',
    softBackground: 'bg-arena-cyan/10',
    ring: 'ring-arena-cyan/50',
    shadow: 'shadow-[0_5px_0_0_#008f97]'
  },
  B: {
    hex: '#FF4B4B',
    label: 'الفريق ب',
    shortLabel: 'B',
    text: 'text-arena-red',
    border: 'border-arena-red',
    background: 'bg-arena-red',
    softBackground: 'bg-arena-red/10',
    ring: 'ring-arena-red/50',
    shadow: 'shadow-[0_5px_0_0_#b32828]'
  }
};

export function teamTheme(teamId: TeamId) {
  return TEAM_THEME[teamId];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '؟';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return `${parts[0][0]}${parts[1][0]}`;
}

import type { SetupTeams } from './types';

export function createDefaultSetup(): SetupTeams {
  return {
    A: {
      name: 'فريق النيل',
      players: [
        { id: 'a-1', name: 'حسن', attributes: ['sports', 'history'] },
        { id: 'a-2', name: 'سلمى', attributes: ['science', 'religion'] },
        { id: 'a-3', name: 'عمر', attributes: ['history', 'geography'] },
        { id: 'a-4', name: 'نور', attributes: ['tech', 'arts'] }
      ]
    },
    B: {
      name: 'فريق الصعيد',
      players: [
        { id: 'b-1', name: 'كريم', attributes: ['sports', 'geography'] },
        { id: 'b-2', name: 'هبة', attributes: ['arts', 'food'] },
        { id: 'b-3', name: 'طارق', attributes: ['science', 'tech'] },
        { id: 'b-4', name: 'ليلى', attributes: ['religion', 'cars'] }
      ]
    }
  };
}

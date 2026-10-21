import type { Player, TeamId } from '../../engine/types';
import { initials, teamTheme } from '../theme';

interface PlayerBadgeProps {
  player: Player | null;
  teamId: TeamId;
  role: 'attacker' | 'goalkeeper' | 'player';
  compact?: boolean;
}

const ROLE_LABEL = {
  attacker: 'المسدد',
  goalkeeper: 'الحارس',
  player: 'لاعب'
};

const ROLE_ICON = {
  attacker: '⚽',
  goalkeeper: '🧤',
  player: '👤'
};

export function PlayerBadge({
  player,
  teamId,
  role,
  compact = false
}: PlayerBadgeProps) {
  const theme = teamTheme(teamId);
  return (
    <div
      className={`flex items-center gap-2.5 ${compact ? '' : 'rounded-2xl border-2 bg-black/30 px-3 py-2.5'} ${theme.border}`}
    >
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-full border-2 font-black ${theme.border} ${
          compact ? 'h-9 w-9 text-xs' : 'h-12 w-12 text-sm'
        }`}
        style={{ backgroundColor: `${theme.hex}22`, color: theme.hex }}
      >
        {player ? initials(player.name) : '؟'}
        <span className="absolute -bottom-1 -left-1 text-xs">{ROLE_ICON[role]}</span>
      </div>
      <div className="min-w-0 text-right">
        <div className={`text-[9px] font-bold ${theme.text}`}>{ROLE_LABEL[role]}</div>
        <div className={`truncate font-black text-white ${compact ? 'text-xs' : 'text-sm'}`}>
          {player?.name || 'غير محدد'}
        </div>
      </div>
    </div>
  );
}

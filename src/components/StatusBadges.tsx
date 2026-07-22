import { useAppContext } from '@/context';
import { IS_DEV_BUILD } from '@/utils/isDevBuild';
import { FC } from 'react';
import { AdvancedModeBadge, BadgeTray, DevBadge } from './StyledComponents';

/**
 * Corner status badges for the bottom-left of the app: "DEV BUILD" in
 * non-production builds, "ADVANCED MODE" while the Konami-unlocked advanced mode
 * is active. Both live in a single `BadgeTray`, so whichever combination
 * applies lays out side by side rather than overlapping — and the row reflows on
 * its own when advanced mode is toggled.
 *
 * Rendered once at the app level so the badges follow the user across panels,
 * rather than being duplicated per page.
 * @returns The badge tray, or `null` when no badge applies.
 * @example
 * ```tsx
 * <StatusBadges />
 * // dev build + advanced mode => [DEV BUILD][ADVANCED MODE]
 * // prod build + advanced mode => [ADVANCED MODE]
 * ```
 * @category Components
 * @source
 */
export const StatusBadges: FC = () => {
  const { advancedMode } = useAppContext();

  if (!IS_DEV_BUILD && !advancedMode) {
    return null;
  }

  return (
    <BadgeTray>
      {IS_DEV_BUILD && <DevBadge>DEV BUILD</DevBadge>}
      {advancedMode && <AdvancedModeBadge>ADVANCED MODE</AdvancedModeBadge>}
    </BadgeTray>
  );
};

export default StatusBadges;

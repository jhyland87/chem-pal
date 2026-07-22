import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mui/icons-material/Clear', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/AutoDelete', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/Contrast', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/BarChart', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/InfoOutline', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/Menu', () => ({ default: () => <span /> }));

vi.mock('@/helpers/i18n', () => ({ i18n: (key: string) => key }));

// SpeedDialMenu calls useTheme(), which throws outside a ThemeProvider.
vi.mock('../../themes', () => ({ useTheme: () => ({ toggleTheme: vi.fn() }) }));
// Rendered as a child but irrelevant here, and it needs its own ThemeContext.
vi.mock('../AboutModal', () => ({ default: () => null }));

const setPanel = vi.fn();
let advancedMode = false;
vi.mock('@/context', () => ({
  useAppContext: () => ({
    userSettings: {},
    setUserSettings: vi.fn(),
    setSearchResults: vi.fn(),
    setPanel,
    advancedMode,
  }),
}));

import SpeedDialMenu from '../SpeedDialMenu';

// MUI renders each SpeedDialAction as a role="menuitem" button whose accessible
// name is the action's title; it drops the `id` prop entirely. The actions stay
// mounted whether or not the dial is open, so no hover is needed.
function renderMenu() {
  render(<SpeedDialMenu speedDialVisibility={true} />);
}

const statsAction = () => screen.queryByRole('menuitem', { name: 'speed_dial_stats' });

describe('SpeedDialMenu stats action', () => {
  beforeEach(() => {
    advancedMode = false;
    vi.clearAllMocks();
  });

  it('omits the stats action when advanced mode is off, even in a dev build', () => {
    renderMenu();
    expect(statsAction()).toBeNull();
    // An always-present action confirms the menu itself rendered.
    expect(screen.getByRole('menuitem', { name: 'speed_dial_about' })).toBeTruthy();
  });

  it('shows the stats action once advanced mode is on, and it opens the panel', () => {
    advancedMode = true;
    renderMenu();

    const stats = statsAction();
    expect(stats).not.toBeNull();

    fireEvent.click(stats!);
    expect(setPanel).toHaveBeenCalledWith(2); // PANEL.STATS
  });
});

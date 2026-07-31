import { DRAWER_INDEX } from '@/constants/common';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mui/icons-material', () => ({
  Search: () => <span />,
  History: () => <span />,
  Settings: () => <span />,
}));

vi.mock('@/helpers/i18n', () => ({ i18n: (key: string) => key }));

// The three tab bodies are heavy; stub them so this test targets DrawerSystem's
// own tab/drawer wiring.
vi.mock('../DrawerSearchPanel', () => ({ default: () => <div>search-panel</div> }));
vi.mock('../HistoryPanel', () => ({ default: () => <div>history-panel</div> }));
vi.mock('../SettingsPanel', () => ({ default: () => <div>settings-panel</div> }));

let mockContext: {
  drawerTab: DRAWER_INDEX;
  setDrawerTab: ReturnType<typeof vi.fn>;
};

vi.mock('@/context', () => ({ useAppContext: () => mockContext }));

import DrawerSystem from '../DrawerSystem';

/** Installs a context whose drawer is open to the given tab. */
function setContext(drawerTab: DRAWER_INDEX) {
  mockContext = { drawerTab, setDrawerTab: vi.fn() };
  return mockContext;
}

describe('DrawerSystem', () => {
  beforeEach(() => {
    setContext(DRAWER_INDEX.CLOSED);
  });

  it('renders nothing visible when the drawer is closed', () => {
    setContext(DRAWER_INDEX.CLOSED);
    render(<DrawerSystem />);

    expect(screen.queryByText('search-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows the tabs and the search panel when open to the Search tab', () => {
    setContext(DRAWER_INDEX.SEARCH);
    render(<DrawerSystem />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByText('search-panel')).toBeInTheDocument();
    expect(screen.queryByText('history-panel')).not.toBeInTheDocument();
  });

  it('renders the history panel when open to the History tab', () => {
    setContext(DRAWER_INDEX.HISTORY);
    render(<DrawerSystem />);

    expect(screen.getByText('history-panel')).toBeInTheDocument();
    expect(screen.queryByText('search-panel')).not.toBeInTheDocument();
  });

  it('renders the settings panel when open to the Settings tab', () => {
    setContext(DRAWER_INDEX.SETTINGS);
    render(<DrawerSystem />);

    expect(screen.getByText('settings-panel')).toBeInTheDocument();
  });

  it('switches tabs through setDrawerTab', () => {
    const ctx = setContext(DRAWER_INDEX.SEARCH);
    render(<DrawerSystem />);

    fireEvent.click(screen.getAllByRole('tab')[2]);

    expect(ctx.setDrawerTab).toHaveBeenCalledWith(DRAWER_INDEX.SETTINGS);
  });

  it('closes the drawer when the backdrop is clicked', () => {
    const ctx = setContext(DRAWER_INDEX.SEARCH);
    render(<DrawerSystem />);

    const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
    fireEvent.click(backdrop);

    expect(ctx.setDrawerTab).toHaveBeenCalledWith(DRAWER_INDEX.CLOSED);
  });
});

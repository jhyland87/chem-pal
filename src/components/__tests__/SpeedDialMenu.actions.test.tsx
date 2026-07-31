import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mui/icons-material/Clear', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/AutoDelete', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/Contrast', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/BarChart', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/InfoOutline', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/Menu', () => ({ default: () => <span /> }));

vi.mock('@/helpers/i18n', () => ({ i18n: (key: string) => key }));

const mocks = vi.hoisted(() => ({
  toggleTheme: vi.fn(),
  clearSearchResults: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock('../../themes', () => ({ useTheme: () => ({ toggleTheme: mocks.toggleTheme }) }));

// Reflect the aboutOpen prop so the About action's effect is observable.
vi.mock('../AboutModal', () => ({
  default: ({ aboutOpen }: { aboutOpen: boolean }) =>
    aboutOpen ? <div>about-open</div> : null,
}));

vi.mock('@/utils/idbCache', () => ({ clearSearchResults: mocks.clearSearchResults }));
vi.mock('@/utils/SupplierCache', () => ({ SupplierCache: { clearAll: mocks.clearAll } }));

let mockContext: {
  userSettings: object;
  searchFilters: { titleQuery: string };
  setUserSettings: ReturnType<typeof vi.fn>;
  setSearchResults: ReturnType<typeof vi.fn>;
  setSearchFilters: ReturnType<typeof vi.fn>;
  setPanel: ReturnType<typeof vi.fn>;
  advancedMode: boolean;
};

vi.mock('@/context', () => ({ useAppContext: () => mockContext }));

import SpeedDialMenu from '../SpeedDialMenu';

/** Installs a fresh app-context mock with spies for every setter used here. */
function setContext() {
  mockContext = {
    userSettings: { theme: 'light' },
    searchFilters: { titleQuery: 'old query' },
    setUserSettings: vi.fn(),
    setSearchResults: vi.fn(),
    setSearchFilters: vi.fn(),
    setPanel: vi.fn(),
    advancedMode: false,
  };
  return mockContext;
}

const action = (name: string) => screen.getByRole('menuitem', { name });

describe('SpeedDialMenu actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clearSearchResults.mockResolvedValue(undefined);
    mocks.clearAll.mockResolvedValue(undefined);
    setContext();
  });

  it('renders the always-present actions', () => {
    render(<SpeedDialMenu speedDialVisibility={true} />);

    expect(action('speed_dial_clear_results')).toBeInTheDocument();
    expect(action('speed_dial_clear_cache')).toBeInTheDocument();
    expect(action('speed_dial_toggle_theme')).toBeInTheDocument();
    expect(action('speed_dial_about')).toBeInTheDocument();
  });

  it('clears results, empties the table and resets the query', async () => {
    const ctx = setContext();
    render(<SpeedDialMenu speedDialVisibility={true} />);

    fireEvent.click(action('speed_dial_clear_results'));

    await waitFor(() => expect(mocks.clearSearchResults).toHaveBeenCalledOnce());
    expect(ctx.setSearchResults).toHaveBeenCalledWith([]);
    expect(ctx.setUserSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: 'light' }));
    expect(ctx.setSearchFilters).toHaveBeenCalledWith(
      expect.objectContaining({ titleQuery: '' }),
    );
  });

  it('still resets state when clearing results rejects', async () => {
    const ctx = setContext();
    mocks.clearSearchResults.mockRejectedValue(new Error('idb down'));
    render(<SpeedDialMenu speedDialVisibility={true} />);

    fireEvent.click(action('speed_dial_clear_results'));

    await waitFor(() => expect(ctx.setSearchResults).toHaveBeenCalledWith([]));
  });

  it('clears the supplier cache', async () => {
    render(<SpeedDialMenu speedDialVisibility={true} />);

    fireEvent.click(action('speed_dial_clear_cache'));

    await waitFor(() => expect(mocks.clearAll).toHaveBeenCalledOnce());
  });

  it('swallows errors when clearing the supplier cache fails', async () => {
    mocks.clearAll.mockRejectedValue(new Error('cache down'));
    render(<SpeedDialMenu speedDialVisibility={true} />);

    fireEvent.click(action('speed_dial_clear_cache'));

    await waitFor(() => expect(mocks.clearAll).toHaveBeenCalledOnce());
    // No unhandled rejection / thrown error: the menu is still mounted.
    expect(action('speed_dial_clear_cache')).toBeInTheDocument();
  });

  it('toggles the theme', () => {
    render(<SpeedDialMenu speedDialVisibility={true} />);

    fireEvent.click(action('speed_dial_toggle_theme'));

    expect(mocks.toggleTheme).toHaveBeenCalledOnce();
  });

  it('opens the About modal', () => {
    render(<SpeedDialMenu speedDialVisibility={true} />);

    expect(screen.queryByText('about-open')).not.toBeInTheDocument();
    fireEvent.click(action('speed_dial_about'));

    expect(screen.getByText('about-open')).toBeInTheDocument();
  });

  it('applies the visibility class from the prop', () => {
    const { rerender } = render(<SpeedDialMenu speedDialVisibility={false} />);
    expect(document.querySelector('#speed-dial-menu')).toHaveClass('speed-dial-menu');
    expect(document.querySelector('#speed-dial-menu')).not.toHaveClass('open');

    rerender(<SpeedDialMenu speedDialVisibility={true} />);
    expect(document.querySelector('#speed-dial-menu')).toHaveClass('open');
  });
});

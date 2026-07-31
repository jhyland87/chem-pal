import { CACHE, DRAWER_INDEX, PANEL } from '@/constants/common';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mui/icons-material/ArrowForward', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/OpenInNew', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/Settings', () => ({ default: () => <span /> }));

vi.mock('@/helpers/i18n', () => ({ i18n: (key: string) => key }));

const mocks = vi.hoisted(() => ({
  getSearchResults: vi.fn(),
  sessionSet: vi.fn(),
  isTabView: vi.fn(),
  openExtensionTab: vi.fn(),
  mode: 'light' as 'light' | 'dark',
}));

vi.mock('@/utils/idbCache', () => ({ getSearchResults: mocks.getSearchResults }));
vi.mock('@/utils/storage', () => ({ cstorage: { session: { set: mocks.sessionSet } } }));
vi.mock('@/utils/displayContext', () => ({
  isTabView: mocks.isTabView,
  openExtensionTab: mocks.openExtensionTab,
}));
vi.mock('../../themes', () => ({ useTheme: () => ({ mode: mocks.mode }) }));

// Stub the search form so this test targets SearchPanelHome's own wiring.
vi.mock('../SearchForm', () => ({
  SearchForm: ({ onSearch }: { onSearch: (q: string) => void }) => (
    <button onClick={() => onSearch('acetone')}>do-search</button>
  ),
}));

let mockContext: Record<string, unknown>;

vi.mock('@/context', () => ({ useAppContext: () => mockContext }));

import SearchPanelHome from '../SearchPanelHome';

/** Installs a fresh context with spies for the setters SearchPanelHome uses. */
function setContext(overrides: Record<string, unknown> = {}) {
  mockContext = {
    searchResults: [],
    userSettings: {},
    setUserSettings: vi.fn(),
    setPendingSearchQuery: vi.fn(),
    setPanel: vi.fn(),
    toggleDrawer: vi.fn(),
    ...overrides,
  };
  return mockContext;
}

describe('SearchPanelHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSearchResults.mockResolvedValue([]);
    mocks.sessionSet.mockResolvedValue(undefined);
    mocks.isTabView.mockReturnValue(false);
    mocks.mode = 'light';
    setContext();
  });

  it('renders the logo, search form and settings button', () => {
    render(<SearchPanelHome />);

    expect(screen.getByAltText('search_logo_alt')).toBeInTheDocument();
    expect(screen.getByText('do-search')).toBeInTheDocument();
    expect(screen.getByLabelText('search_open_settings')).toBeInTheDocument();
  });

  it('opens the settings drawer from the settings button', () => {
    const ctx = setContext();
    render(<SearchPanelHome />);

    fireEvent.click(screen.getByLabelText('search_open_settings'));

    expect(ctx.toggleDrawer).toHaveBeenCalledWith(DRAWER_INDEX.SETTINGS);
  });

  it('shows a forward button with the result count when context has results', () => {
    setContext({ searchResults: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    render(<SearchPanelHome />);

    const forward = screen.getByLabelText('search_go_to_results');
    expect(forward).toBeInTheDocument();
    expect(forward).toHaveTextContent('3');
  });

  it('routes to the results panel when the forward button is clicked', () => {
    const ctx = setContext({ searchResults: [{ id: 1 }] });
    render(<SearchPanelHome />);

    fireEvent.click(screen.getByLabelText('search_go_to_results'));

    expect(ctx.setPanel).toHaveBeenCalledWith(PANEL.RESULTS);
  });

  it('loads stored results from IndexedDB when context has none', async () => {
    mocks.getSearchResults.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    setContext({ searchResults: [] });
    render(<SearchPanelHome />);

    const forward = await screen.findByLabelText('search_go_to_results');
    expect(forward).toHaveTextContent('2');
  });

  it('shows no forward button when there are no stored results', async () => {
    mocks.getSearchResults.mockResolvedValue([]);
    setContext({ searchResults: [] });
    render(<SearchPanelHome />);

    await waitFor(() => expect(mocks.getSearchResults).toHaveBeenCalled());
    expect(screen.queryByLabelText('search_go_to_results')).not.toBeInTheDocument();
  });

  it('shows the maximize button outside tab view and opens a tab on click', () => {
    mocks.isTabView.mockReturnValue(false);
    render(<SearchPanelHome />);

    fireEvent.click(screen.getByLabelText('common_open_in_tab'));

    expect(mocks.openExtensionTab).toHaveBeenCalledOnce();
  });

  it('hides the maximize button when already in tab view', () => {
    mocks.isTabView.mockReturnValue(true);
    render(<SearchPanelHome />);

    expect(screen.queryByLabelText('common_open_in_tab')).not.toBeInTheDocument();
  });

  it('uses the inverted logo in dark mode', () => {
    mocks.mode = 'dark';
    render(<SearchPanelHome />);

    expect(screen.getByAltText('search_logo_alt')).toHaveAttribute(
      'src',
      '/static/images/logo/ChemPal-logo-inverted.png',
    );
  });

  it('persists the query and routes to results on search submit', async () => {
    const ctx = setContext();
    render(<SearchPanelHome />);

    fireEvent.click(screen.getByText('do-search'));

    await waitFor(() =>
      expect(mocks.sessionSet).toHaveBeenCalledWith({
        [CACHE.QUERY]: 'acetone',
        [CACHE.SEARCH_INPUT]: '',
      }),
    );
    expect(ctx.setPendingSearchQuery).toHaveBeenCalledWith('acetone');
    expect(ctx.setPanel).toHaveBeenCalledWith(PANEL.RESULTS);
  });
});

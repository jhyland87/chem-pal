import { CACHE, DRAWER_INDEX, PANEL } from '@/constants/common';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mui/icons-material/FilterAltOff', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/ExpandMore', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/Search', () => ({ default: () => <span /> }));

vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string, subs?: string[]) => (subs?.length ? `${key}:${subs.join(',')}` : key),
  useLocale: () => 'en',
}));

const mocks = vi.hoisted(() => ({
  tableColumns: vi.fn(),
  countActiveSearchFilters: vi.fn(),
  sessionGet: vi.fn(),
  sessionSet: vi.fn(),
}));

vi.mock('@/components/SearchPanel/TableColumns', () => ({ default: mocks.tableColumns }));

vi.mock('@/helpers/searchFilters', () => ({
  countActiveSearchFilters: mocks.countActiveSearchFilters,
}));

vi.mock('@/utils/storage', () => ({
  cstorage: { session: { get: mocks.sessionGet, set: mocks.sessionSet } },
}));

// Stub the column section so this test targets DrawerSearchPanel's own logic.
vi.mock('../ColumnDrawerSection', () => ({
  default: ({ columnId }: { columnId: string }) => <div>section-{columnId}</div>,
}));

let mockContext: Record<string, unknown>;

vi.mock('@/context', () => ({ useAppContext: () => mockContext }));

import DrawerSearchPanel from '../DrawerSearchPanel';

/** Installs a fresh context with spies for every setter DrawerSearchPanel uses. */
function setContext(overrides: Record<string, unknown> = {}) {
  mockContext = {
    userSettings: {},
    setUserSettings: vi.fn(),
    setDrawerTab: vi.fn(),
    setPendingSearchQuery: vi.fn(),
    searchFilters: { titleQuery: '' },
    setSearchFilters: vi.fn(),
    selectedSuppliers: [],
    setSelectedSuppliers: vi.fn(),
    setPanel: vi.fn(),
    ...overrides,
  };
  return mockContext;
}

const noopAccordion = () => () => {};

/** Renders the panel with a no-op accordion handler. */
function renderPanel() {
  return render(
    <DrawerSearchPanel expandedAccordion={false} onAccordionChange={noopAccordion} />,
  );
}

describe('DrawerSearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionGet.mockResolvedValue({});
    mocks.sessionSet.mockResolvedValue(undefined);
    mocks.countActiveSearchFilters.mockReturnValue(0);
    mocks.tableColumns.mockReturnValue([
      { id: 'supplier', meta: { drawer: { label: 'Supplier' } } },
      { id: 'price', meta: { drawer: { label: 'Price' } } },
      { id: 'no-drawer', meta: {} },
    ]);
    setContext();
  });

  it('renders a section per drawer column and injects the results-limit before price', () => {
    renderPanel();

    expect(screen.getByText('section-supplier')).toBeInTheDocument();
    expect(screen.getByText('section-price')).toBeInTheDocument();
    // The non-drawer column produces no section.
    expect(screen.queryByText('section-no-drawer')).not.toBeInTheDocument();
    // Results-limit accordion is injected.
    expect(screen.getByText('drawer_results_limit')).toBeInTheDocument();
  });

  it('updates the title query and persists the draft on change', async () => {
    const ctx = setContext();
    renderPanel();

    fireEvent.change(screen.getByLabelText('drawer_product_name_label'), {
      target: { value: 'acetone' },
    });

    expect(ctx.setSearchFilters).toHaveBeenCalledWith(
      expect.objectContaining({ titleQuery: 'acetone' }),
    );
    await waitFor(() =>
      expect(mocks.sessionSet).toHaveBeenCalledWith({ [CACHE.SEARCH_INPUT]: 'acetone' }),
    );
  });

  it('runs a search on button click and routes to the results panel', async () => {
    const ctx = setContext({ searchFilters: { titleQuery: 'acetone' } });
    renderPanel();

    fireEvent.click(screen.getByText('drawer_search_button'));

    await waitFor(() => expect(ctx.setPendingSearchQuery).toHaveBeenCalledWith('acetone'));
    expect(ctx.setDrawerTab).toHaveBeenCalledWith(DRAWER_INDEX.CLOSED);
    expect(ctx.setPanel).toHaveBeenCalledWith(PANEL.RESULTS);
    expect(ctx.setSearchFilters).toHaveBeenCalledWith(
      expect.objectContaining({ titleQuery: '' }),
    );
  });

  it('runs a search on Enter in the title field', async () => {
    const ctx = setContext({ searchFilters: { titleQuery: 'benzene' } });
    renderPanel();

    fireEvent.keyDown(screen.getByLabelText('drawer_product_name_label'), { key: 'Enter' });

    await waitFor(() => expect(ctx.setPendingSearchQuery).toHaveBeenCalledWith('benzene'));
  });

  it('does not search when the title query is blank', () => {
    const ctx = setContext({ searchFilters: { titleQuery: '   ' } });
    renderPanel();

    fireEvent.keyDown(screen.getByLabelText('drawer_product_name_label'), { key: 'Enter' });

    expect(ctx.setPendingSearchQuery).not.toHaveBeenCalled();
    // Button is disabled for a blank query.
    expect(screen.getByText('drawer_search_button').closest('button')).toBeDisabled();
  });

  describe('clear filters', () => {
    it('is disabled when no filters are active', () => {
      mocks.countActiveSearchFilters.mockReturnValue(0);
      renderPanel();

      expect(screen.getByText('drawer_clear_filters').closest('button')).toBeDisabled();
    });

    it('resets suppliers, filters and price bounds when clicked', () => {
      mocks.countActiveSearchFilters.mockReturnValue(2);
      const ctx = setContext({ searchFilters: { titleQuery: 'x', country: ['US'] } });
      renderPanel();

      fireEvent.click(screen.getByText('drawer_clear_filters'));

      expect(ctx.setSelectedSuppliers).toHaveBeenCalledWith([]);
      expect(ctx.setSearchFilters).toHaveBeenCalledWith(
        expect.objectContaining({ availability: [], country: [], shippingType: [] }),
      );
      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ priceMin: undefined, priceMax: undefined }),
      );
    });
  });

  describe('results limit', () => {
    it('shows the limit hint when a limit is set', () => {
      setContext({ userSettings: { supplierResultLimit: 15 } });
      renderPanel();

      expect(screen.getByText('drawer_results_limit_hint:15')).toBeInTheDocument();
    });

    it('updates the supplier result limit on change', () => {
      const ctx = setContext({ userSettings: { supplierResultLimit: 15 } });
      renderPanel();

      fireEvent.change(screen.getByLabelText('drawer_results_limit_label'), {
        target: { value: '25' },
      });

      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ supplierResultLimit: 25 }),
      );
    });
  });

  it('hydrates the title query from session storage on mount', async () => {
    mocks.sessionGet.mockResolvedValue({ [CACHE.SEARCH_INPUT]: 'stored' });
    const ctx = setContext({ searchFilters: { titleQuery: '' } });
    renderPanel();

    await waitFor(() =>
      expect(ctx.setSearchFilters).toHaveBeenCalledWith(
        expect.objectContaining({ titleQuery: 'stored' }),
      ),
    );
  });
});

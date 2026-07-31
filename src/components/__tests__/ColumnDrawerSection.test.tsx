import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mui/icons-material/ExpandMore', () => ({ default: () => <span /> }));

vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string, subs?: string[]) => (subs?.length ? `${key}:${subs.join(',')}` : key),
}));

const mocks = vi.hoisted(() => ({
  supplierShippingMeta: vi.fn(),
  supplierShipsTo: vi.fn(),
  isSupplierClassName: vi.fn(),
  suppliersExcludedBySearchFilters: vi.fn(),
  countriesForSuppliers: vi.fn(),
  fulfillableShippingRanges: vi.fn(),
}));

vi.mock('@/suppliers/SupplierFactory', () => ({
  SupplierFactory: {
    supplierShippingMeta: mocks.supplierShippingMeta,
    supplierShipsTo: mocks.supplierShipsTo,
    isSupplierClassName: mocks.isSupplierClassName,
  },
}));

vi.mock('@/helpers/supplierFilters', () => ({
  suppliersExcludedBySearchFilters: mocks.suppliersExcludedBySearchFilters,
  countriesForSuppliers: mocks.countriesForSuppliers,
  fulfillableShippingRanges: mocks.fulfillableShippingRanges,
}));

let mockContext: {
  selectedSuppliers: string[];
  setSelectedSuppliers: ReturnType<typeof vi.fn>;
  searchFilters: Record<string, unknown>;
  setSearchFilters: ReturnType<typeof vi.fn>;
  userSettings: Record<string, unknown>;
  setUserSettings: ReturnType<typeof vi.fn>;
};

vi.mock('@/context', () => ({ useAppContext: () => mockContext }));

import ColumnDrawerSection from '../ColumnDrawerSection';

/** Installs a fresh context; each field is overridable per test. */
function setContext(overrides: Partial<typeof mockContext> = {}) {
  mockContext = {
    selectedSuppliers: [],
    setSelectedSuppliers: vi.fn(),
    searchFilters: {},
    setSearchFilters: vi.fn(),
    userSettings: {},
    setUserSettings: vi.fn(),
    ...overrides,
  };
  return mockContext;
}

const noopAccordion = () => () => {};

/** Renders the section expanded so its widget body is mounted. */
function renderSection(columnId: string, config: ColumnDrawerConfig) {
  return render(
    <ColumnDrawerSection
      columnId={columnId}
      config={config}
      expandedAccordion={`search-${columnId}`}
      onAccordionChange={noopAccordion}
    />,
  );
}

describe('ColumnDrawerSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supplierShippingMeta.mockReturnValue({});
    mocks.supplierShipsTo.mockReturnValue({});
    mocks.isSupplierClassName.mockImplementation((s: string) => s.startsWith('Supplier'));
    mocks.suppliersExcludedBySearchFilters.mockReturnValue([]);
    mocks.countriesForSuppliers.mockReturnValue([]);
    mocks.fulfillableShippingRanges.mockReturnValue([]);
    setContext({
      selectedSuppliers: [],
      searchFilters: {},
      userSettings: {},
    });
  });

  describe('autocompleteStrings (supplier selector)', () => {
    const config: ColumnDrawerConfig = {
      label: 'Supplier',
      widget: 'autocompleteStrings',
      options: ['SupplierAlpha', 'SupplierBeta'],
      optionLabels: { SupplierAlpha: 'Alpha', SupplierBeta: 'Beta' },
      emptyHelperText: 'pick suppliers',
      placeholder: 'type a supplier',
      bind: { kind: 'selectedSuppliers' },
    };

    it('renders the label and the two shipping switches', () => {
      renderSection('supplier', config);

      expect(screen.getByText('Supplier')).toBeInTheDocument();
      expect(screen.getByText('drawer_only_shipping_suppliers')).toBeInTheDocument();
      expect(screen.getByText('drawer_hide_restricted_products')).toBeInTheDocument();
    });

    it('shows a selected-count hint when suppliers are chosen', () => {
      setContext({ selectedSuppliers: ['SupplierAlpha'] });
      renderSection('supplier', config);

      expect(screen.getByText(/\(1 selected\)/)).toBeInTheDocument();
    });

    it('greys out suppliers that cannot ship to the user location', () => {
      mocks.supplierShipsTo.mockReturnValue({ SupplierBeta: false });
      setContext({
        userSettings: { location: 'US', excludeNonShippingSuppliers: true },
      });
      renderSection('supplier', config);

      // Open the listbox; the excluded option renders disabled.
      fireEvent.mouseDown(screen.getByRole('combobox'));
      const betaOption = screen.getByRole('option', { name: 'Beta' });
      expect(betaOption).toHaveAttribute('aria-disabled', 'true');
    });

    it('adds a picked supplier through setSelectedSuppliers', () => {
      const setSelectedSuppliers = vi.fn();
      setContext({ setSelectedSuppliers });
      renderSection('supplier', config);

      fireEvent.mouseDown(screen.getByRole('combobox'));
      fireEvent.click(screen.getByRole('option', { name: 'Alpha' }));

      expect(setSelectedSuppliers).toHaveBeenCalledWith(['SupplierAlpha']);
    });

    it('toggles the exclude-non-shipping and hide-restricted settings', () => {
      const setUserSettings = vi.fn();
      setContext({ userSettings: { location: 'US' }, setUserSettings });
      renderSection('supplier', config);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);
      fireEvent.click(switches[1]);

      expect(setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ excludeNonShippingSuppliers: false }),
      );
      expect(setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ hideRestrictedProducts: false }),
      );
    });
  });

  describe('autocompleteStrings (searchFilters bind)', () => {
    const config: ColumnDrawerConfig = {
      label: 'Availability',
      widget: 'autocompleteStrings',
      options: ['in_stock', 'backorder'],
      emptyHelperText: 'any availability',
      bind: { kind: 'searchFilters', key: 'availability' },
    };

    it('does not render the supplier-only switches', () => {
      renderSection('availability', config);

      expect(screen.getByText('Availability')).toBeInTheDocument();
      expect(screen.queryByText('drawer_only_shipping_suppliers')).not.toBeInTheDocument();
    });

    it('writes the chosen values back to searchFilters', () => {
      const setSearchFilters = vi.fn();
      setContext({ searchFilters: { availability: [] }, setSearchFilters });
      renderSection('availability', config);

      fireEvent.mouseDown(screen.getByRole('combobox'));
      fireEvent.click(screen.getByRole('option', { name: 'in_stock' }));

      expect(setSearchFilters).toHaveBeenCalledWith(
        expect.objectContaining({ availability: ['in_stock'] }),
      );
    });

    it('returns null for an unsupported bind kind', () => {
      const bad: ColumnDrawerConfig = {
        ...config,
        bind: { kind: 'userSettingsRange', minKey: 'priceMin', maxKey: 'priceMax' },
      };
      const { container } = renderSection('availability', bad);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('autocompleteObjects', () => {
    const config: ColumnDrawerConfig = {
      label: 'Country',
      widget: 'autocompleteObjects',
      options: [
        { code: 'US', label: 'United States' },
        { code: 'DE', label: 'Germany' },
      ],
      emptyHelperText: 'any country',
      bind: { kind: 'searchFilters', key: 'country' },
    };

    it('renders selected countries and a count hint', () => {
      setContext({ searchFilters: { country: ['US'] } });
      renderSection('country', config);

      expect(screen.getByText(/\(1 selected\)/)).toBeInTheDocument();
    });

    it('maps picked options back to country codes', () => {
      const setSearchFilters = vi.fn();
      setContext({ searchFilters: { country: [] }, setSearchFilters });
      renderSection('country', config);

      fireEvent.mouseDown(screen.getByRole('combobox'));
      fireEvent.click(screen.getByRole('option', { name: 'Germany' }));

      expect(setSearchFilters).toHaveBeenCalledWith(
        expect.objectContaining({ country: ['DE'] }),
      );
    });

    it('greys out countries no selected supplier resides in', () => {
      mocks.countriesForSuppliers.mockReturnValue(['US']);
      setContext({ searchFilters: { country: [] }, selectedSuppliers: ['SupplierAlpha'] });
      renderSection('country', config);

      fireEvent.mouseDown(screen.getByRole('combobox'));
      expect(screen.getByRole('option', { name: 'Germany' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('returns null when not bound to searchFilters', () => {
      const bad: ColumnDrawerConfig = { ...config, bind: { kind: 'selectedSuppliers' } };
      const { container } = renderSection('country', bad);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('chips', () => {
    const config: ColumnDrawerConfig = {
      label: 'Shipping Type',
      widget: 'chips',
      options: ['local', 'domestic', 'international'],
      formatChipLabel: (o) => o.toUpperCase(),
      bind: { kind: 'searchFilters', key: 'shippingType' },
    };

    it('renders a chip per option using the label formatter', () => {
      setContext({ searchFilters: { shippingType: [] } });
      renderSection('shippingType', config);

      expect(screen.getByText('LOCAL')).toBeInTheDocument();
      expect(screen.getByText('DOMESTIC')).toBeInTheDocument();
    });

    it('adds an unselected chip on click', () => {
      const setSearchFilters = vi.fn();
      setContext({ searchFilters: { shippingType: [] }, setSearchFilters });
      renderSection('shippingType', config);

      fireEvent.click(screen.getByText('DOMESTIC'));

      expect(setSearchFilters).toHaveBeenCalledWith(
        expect.objectContaining({ shippingType: ['domestic'] }),
      );
    });

    it('removes a selected chip on click', () => {
      const setSearchFilters = vi.fn();
      setContext({ searchFilters: { shippingType: ['local'] }, setSearchFilters });
      renderSection('shippingType', config);

      fireEvent.click(screen.getByText('LOCAL'));

      expect(setSearchFilters).toHaveBeenCalledWith(
        expect.objectContaining({ shippingType: [] }),
      );
    });

    it('disables chips no selected supplier can fulfill', () => {
      mocks.fulfillableShippingRanges.mockReturnValue(['local']);
      setContext({
        searchFilters: { shippingType: [] },
        selectedSuppliers: ['SupplierAlpha'],
      });
      renderSection('shippingType', config);

      // "international" is not fulfillable and not selected → disabled chip.
      const intlChip = screen.getByText('INTERNATIONAL').closest('.MuiChip-root');
      expect(intlChip).toHaveClass('Mui-disabled');
    });

    it('returns null when not bound to searchFilters', () => {
      const bad: ColumnDrawerConfig = { ...config, bind: { kind: 'selectedSuppliers' } };
      const { container } = renderSection('shippingType', bad);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('numberRange', () => {
    const config: ColumnDrawerConfig = {
      label: 'Price Range',
      widget: 'numberRange',
      adornment: 'currency',
      bind: { kind: 'userSettingsRange', minKey: 'priceMin', maxKey: 'priceMax' },
    };

    it('renders min and max inputs with the currency adornment', () => {
      setContext({ userSettings: { currency: 'USD', priceMin: 5, priceMax: 20 } });
      renderSection('price', config);

      expect(screen.getByLabelText('drawer_range_min')).toHaveValue(5);
      expect(screen.getByLabelText('drawer_range_max')).toHaveValue(20);
      // The $ adornment appears for USD.
      expect(screen.getAllByText('$').length).toBeGreaterThan(0);
    });

    it('shows a combined range hint when both bounds are set', () => {
      setContext({ userSettings: { currency: 'USD', priceMin: 5, priceMax: 20 } });
      renderSection('price', config);

      expect(screen.getByText(/\$5 - \$20/)).toBeInTheDocument();
    });

    it('writes a parsed number to the bound setting on change', () => {
      const setUserSettings = vi.fn();
      setContext({ userSettings: { currency: 'USD' }, setUserSettings });
      renderSection('price', config);

      fireEvent.change(screen.getByLabelText('drawer_range_min'), { target: { value: '12' } });

      expect(setUserSettings).toHaveBeenCalledWith(expect.objectContaining({ priceMin: 12 }));
    });

    it('clears the setting to undefined for blank input', () => {
      const setUserSettings = vi.fn();
      setContext({ userSettings: { currency: 'USD', priceMax: 9 }, setUserSettings });
      renderSection('price', config);

      fireEvent.change(screen.getByLabelText('drawer_range_max'), { target: { value: '' } });

      expect(setUserSettings).toHaveBeenCalledWith(expect.objectContaining({ priceMax: undefined }));
    });

    it('returns null when not bound to a userSettings range', () => {
      const bad: ColumnDrawerConfig = {
        ...config,
        bind: { kind: 'searchFilters', key: 'availability' },
      };
      const { container } = renderSection('price', bad);

      expect(container).toBeEmptyDOMElement();
    });
  });
});

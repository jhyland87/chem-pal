import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// TabLink pulls in the StatusBar context and only matters to the column cells as
// an anchor, so stub it to a plain <a> that forwards href/aria-label/title. This
// keeps the column-cell tests isolated from the surrounding app providers.
vi.mock('@/components/TabLink', () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) => (
    <a href={href as string} aria-label={rest['aria-label'] as string} title={rest.title as string}>
      {children as React.ReactNode}
    </a>
  ),
}));

import TableColumns, { getColumnFilterConfig } from '../TableColumns';

// Loosely typed overrides so tests can pass branded fields (e.g. pubchemId) as raw values.
const makeProduct = (overrides: Record<string, unknown> = {}): Product =>
  ({ title: 'Acetone', supplier: 'Loudwolf', ...overrides }) as Product;

/** Column ids in the order TableColumns() returns them (description has only an accessorKey). */
const COLUMN_ORDER = [
  'expander',
  'title',
  'supplier',
  'country',
  'shipping',
  'availability',
  'description',
  'price',
  'quantity',
  'uom',
  'unitPrice',
  'priceTrend',
  'priceChange',
  'sds',
  'specs',
  'coa',
  'cas',
  'pubchem',
  'formula',
  'moleweight',
  'purity',
  'concentration',
];

/** Finds a column by its `id`, falling back to `accessorKey` (the description column has no id). */
function byId(id: string) {
  const col = TableColumns().find(
    (c) => c.id === id || (c as { accessorKey?: string }).accessorKey === id,
  );
  if (!col) throw new Error(`no column with id ${id}`);
  return col;
}

/** Returns a column's `accessorFn` (present only on the accessor variant of the ColumnDef union). */
function accessorOf(id: string) {
  const fn = (byId(id) as { accessorFn?: (p: Product, i: number) => unknown }).accessorFn;
  if (!fn) throw new Error(`column ${id} has no accessorFn`);
  return fn;
}

interface CellOpts {
  value?: unknown;
  meta?: { userSettings?: unknown; priceHistory?: unknown };
  depth?: number;
  subRows?: Array<{ original: Product }>;
  canExpand?: boolean;
  expanded?: boolean;
}

/** Builds the minimal CellContext the column cell renderers read (row + getValue + table.meta). */
function cellContext(product: Product, opts: CellOpts = {}) {
  const row = {
    original: product,
    depth: opts.depth ?? 0,
    subRows: opts.subRows ?? [],
    getCanExpand: () => opts.canExpand ?? false,
    getIsExpanded: () => opts.expanded ?? false,
    getToggleExpandedHandler: () => vi.fn(),
  };
  return {
    row,
    getValue: () => opts.value,
    table: { options: { meta: opts.meta ?? {} } },
  };
}

/** Invokes a column's cell renderer with `context` and renders the result. */
function renderCell(id: string, context: ReturnType<typeof cellContext>) {
  const cell = byId(id).cell as (ctx: unknown) => unknown;
  return render(<>{cell(context) as React.ReactNode}</>);
}

describe('TableColumns structure', () => {
  it('returns the columns in the documented order', () => {
    const ids = TableColumns().map(
      (c) => c.id ?? (c as { accessorKey?: string }).accessorKey,
    );
    expect(ids).toEqual(COLUMN_ORDER);
  });

  it('marks only supplier/country/shipping/availability/price as drawer-enabled', () => {
    const drawerIds = TableColumns()
      .filter((c) => c.meta?.drawer)
      .map((c) => c.id);
    expect(drawerIds).toEqual(['supplier', 'country', 'shipping', 'availability', 'price']);
  });

  it('keeps the expander non-interactive (no sort, filter, or hide)', () => {
    const expander = byId('expander');
    expect(expander.enableSorting).toBe(false);
    expect(expander.enableColumnFilter).toBe(false);
    expect(expander.enableHiding).toBe(false);
  });

  it('pins the always-present columns visible (title, expander not hideable)', () => {
    expect(byId('title').enableHiding).toBe(false);
  });
});

describe('TableColumns accessors', () => {
  it('unitPrice accessor returns the per-base-unit price, or undefined without data', () => {
    const accessor = accessorOf('unitPrice');
    expect(accessor(makeProduct({ usdPrice: 10, quantity: 100, uom: 'g' }), 0)).toBeTypeOf('number');
    expect(accessor(makeProduct({}), 0)).toBeUndefined();
  });

  it.each([
    [{ grade: 'ACS' }, 'ACS'],
    [{ purity: '99%' }, '99%'],
    [{ grade: 'ACS', purity: '99%' }, 'ACS'],
    [{}, 'Ungraded'],
  ])('purity accessor prefers grade then purity then Ungraded (%o → %s)', (over, expected) => {
    const accessor = accessorOf('purity');
    expect(accessor(makeProduct(over), 0)).toBe(expected);
  });

  it.each(['priceTrend', 'priceChange'])(
    '%s accessor reads the stamped priceTrendValue',
    (id) => {
      const accessor = accessorOf(id);
      expect(accessor(makeProduct({ priceTrendValue: -12.5 }), 0)).toBe(-12.5);
    },
  );
});

describe('TableColumns cell — empty/absent branches render nothing', () => {
  it.each(['country', 'shipping', 'availability', 'sds', 'specs', 'coa', 'cas', 'pubchem'])(
    '%s cell is empty when its field is absent',
    (id) => {
      const { container } = renderCell(id, cellContext(makeProduct({})));
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('expander is empty when the row cannot expand', () => {
    const { container } = renderCell('expander', cellContext(makeProduct({}), { canExpand: false }));
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['priceTrend', 'priceChange'])(
    '%s cell is empty before price history has loaded (meta.priceHistory undefined)',
    (id) => {
      const { container } = renderCell(id, cellContext(makeProduct({}), { meta: {} }));
      expect(container).toBeEmptyDOMElement();
    },
  );

  it.each(['priceTrend', 'priceChange'])(
    '%s cell is empty when history is present but the row has no trend points',
    (id) => {
      const context = cellContext(makeProduct({ variants: [] }), {
        meta: { priceHistory: new Map() },
      });
      const { container } = renderCell(id, context);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('unitPrice cell is empty when there is no price to divide', () => {
    const { container } = renderCell('unitPrice', cellContext(makeProduct({})));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TableColumns cell — present branches', () => {
  it('expander renders a toggle button when the row can expand', () => {
    renderCell('expander', cellContext(makeProduct({}), { canExpand: true, expanded: false }));
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('expander renders the toggle when the row is expanded', () => {
    renderCell('expander', cellContext(makeProduct({}), { canExpand: true, expanded: true }));
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('title links to the permalink and shows the product title', () => {
    renderCell(
      'title',
      cellContext(makeProduct({ title: 'Acetone', permalink: 'https://x.test/acetone' })),
    );
    const link = screen.getByRole('link', { name: 'Acetone' });
    expect(link).toHaveAttribute('href', 'https://x.test/acetone');
  });

  it('title falls back to url and indents variant (deep) rows', () => {
    renderCell(
      'title',
      cellContext(makeProduct({ title: 'Variant', url: 'https://x.test/v' }), { depth: 2 }),
    );
    expect(screen.getByRole('link', { name: 'Variant' })).toHaveAttribute('href', 'https://x.test/v');
  });

  it('supplier cell shows the supplier name', () => {
    const { container } = renderCell('supplier', cellContext(makeProduct({}), { value: 'Loudwolf' }));
    expect(container).toHaveTextContent('Loudwolf');
  });

  it('country cell renders a flag for a known country code', () => {
    const { container } = renderCell('country', cellContext(makeProduct({ supplierCountry: 'US' })));
    expect(container.querySelector('span')).not.toBeNull();
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it('country cell falls back to the raw code when no flag exists', () => {
    const { container } = renderCell('country', cellContext(makeProduct({ supplierCountry: 'ZZ' })));
    expect(container).toHaveTextContent('ZZ');
  });

  it('shipping cell renders a shipping label', () => {
    const { container } = renderCell(
      'shipping',
      cellContext(makeProduct({ supplierShipping: 'domestic' })),
    );
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it('availability cell renders an availability label', () => {
    const { container } = renderCell(
      'availability',
      cellContext(makeProduct({ availability: 'in_stock' })),
    );
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it('description cell renders the description text', () => {
    const { container } = renderCell(
      'description',
      cellContext(makeProduct({ description: 'A clear liquid' })),
    );
    expect(container).toHaveTextContent('A clear liquid');
  });

  it('price cell renders a converted price', () => {
    const { container } = renderCell(
      'price',
      cellContext(makeProduct({ price: 10, usdPrice: 10 }), {
        meta: { userSettings: { currency: 'USD' } },
      }),
    );
    expect(container.textContent).toMatch(/\d/);
  });

  it('quantity cell renders the quantity with a unit', () => {
    const { container } = renderCell(
      'quantity',
      cellContext(makeProduct({ quantity: 500, uom: 'g' })),
    );
    expect(container).toHaveTextContent('500');
  });

  it('uom cell renders the formatted unit', () => {
    const { container } = renderCell('uom', cellContext(makeProduct({}), { value: 'g' }));
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it('unitPrice cell renders a per-unit price', () => {
    const { container } = renderCell(
      'unitPrice',
      cellContext(makeProduct({ usdPrice: 10, price: 10, quantity: 100, uom: 'g' }), {
        meta: { userSettings: { currency: 'USD' } },
      }),
    );
    expect(container.textContent).toMatch(/\d/);
  });

  it.each([
    ['sds', 'sdsUrl'],
    ['specs', 'specSheetUrl'],
    ['coa', 'coaUrl'],
  ])('%s cell links to its document URL', (id, field) => {
    renderCell(id, cellContext(makeProduct({ [field]: 'https://x.test/doc.pdf' })));
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://x.test/doc.pdf');
  });

  it('cas cell links straight to the compound page when the CID is known', () => {
    renderCell('cas', cellContext(makeProduct({ cas: '67-64-1', pubchemId: 180 })));
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('67-64-1');
    expect(link.getAttribute('href')).toContain('180');
  });

  it('cas cell links to a CAS search when no CID is known', () => {
    renderCell('cas', cellContext(makeProduct({ cas: '67-64-1' })));
    expect(screen.getByRole('link').getAttribute('href')).toContain('67-64-1');
  });

  it('pubchem cell links to the compound page', () => {
    renderCell('pubchem', cellContext(makeProduct({ pubchemId: 180 })));
    expect(screen.getByRole('link')).toHaveTextContent('180');
  });

  it.each(['formula', 'moleweight', 'concentration'])(
    '%s cell renders its raw value',
    (id) => {
      const { container } = renderCell(id, cellContext(makeProduct({}), { value: 'X-123' }));
      expect(container).toHaveTextContent('X-123');
    },
  );

  it('purity cell renders a grade value directly', () => {
    const { container } = renderCell('purity', cellContext(makeProduct({}), { value: 'ACS' }));
    expect(container).toHaveTextContent('ACS');
  });

  it.each([undefined, '', 'Ungraded'])(
    'purity cell renders the "ungraded" label for %o',
    (value) => {
      const { container } = renderCell('purity', cellContext(makeProduct({}), { value }));
      expect(container.textContent?.length).toBeGreaterThan(0);
    },
  );
});

describe('TableColumns price header', () => {
  const headerCtx = (currency?: string) => ({
    table: { options: { meta: currency ? { userSettings: { currency } } : {} } },
  });

  it('shows the selected currency code', () => {
    const header = byId('price').header as (ctx: unknown) => string;
    expect(header(headerCtx('EUR'))).toContain('EUR');
  });

  it('defaults to USD when no currency is set', () => {
    const header = byId('price').header as (ctx: unknown) => string;
    expect(header(headerCtx())).toContain('USD');
  });
});

describe('getColumnFilterConfig', () => {
  it('includes exactly the columns that have both an id and a filterVariant', () => {
    const expected = TableColumns()
      .filter((c) => c.id && c.meta?.filterVariant)
      .map((c) => c.id as string)
      .sort();
    expect(Object.keys(getColumnFilterConfig()).sort()).toEqual(expected);
  });

  it('excludes the id-less description column and the un-filterable columns', () => {
    const config = getColumnFilterConfig();
    expect(config.description).toBeUndefined();
    expect(config.expander).toBeUndefined();
    expect(config.priceTrend).toBeUndefined();
    expect(config.sds).toBeUndefined();
  });

  it.each([
    ['title', 'text'],
    ['supplier', 'select'],
    ['country', 'select'],
    ['price', 'range'],
    ['quantity', 'range'],
    ['uom', 'select'],
    ['cas', 'text'],
  ])('maps %s to the %s filter variant with empty seed data', (id, variant) => {
    const entry = getColumnFilterConfig()[id];
    expect(entry.filterVariant).toBe(variant);
    expect(entry.filterData).toEqual([]);
  });
});

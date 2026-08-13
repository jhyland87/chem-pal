import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Row, Table } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// TabLink needs the StatusBar context; stub it to a plain anchor.
vi.mock('@/components/TabLink', () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) => (
    <a href={href as string} aria-label={rest['aria-label'] as string} title={rest.title as string}>
      {children as React.ReactNode}
    </a>
  ),
}));

// Keep describeTrend (used by EntryTrend) real; control the data-producing fns.
vi.mock('@/helpers/priceHistory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/priceHistory')>();
  return {
    ...actual,
    getProductPriceHistory: vi.fn(),
    productSeriesKey: vi.fn(() => 'pk'),
    variantSeriesKey: vi.fn(() => 'vk'),
    resolveRowTrendPoints: vi.fn(),
  };
});

// Keep isPresent real; control image/variant resolution.
vi.mock('@/helpers/product', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/product')>();
  return {
    ...actual,
    resolveProductImages: vi.fn(),
    resolveDisplayedVariants: vi.fn(),
  };
});

import { ProductDetailPanel } from '../ProductDetailPanel';
import { i18n } from '@/helpers/i18n';
import { getProductPriceHistory, resolveRowTrendPoints } from '@/helpers/priceHistory';
import { resolveDisplayedVariants, resolveProductImages } from '@/helpers/product';

const mockedGetHistory = vi.mocked(getProductPriceHistory);
const mockedTrendPoints = vi.mocked(resolveRowTrendPoints);
const mockedDisplayedVariants = vi.mocked(resolveDisplayedVariants);
const mockedImages = vi.mocked(resolveProductImages);

const makeProduct = (overrides: Record<string, unknown> = {}): Product =>
  ({
    title: 'Acetone',
    supplier: 'Loudwolf',
    url: 'https://x.test/a',
    permalink: 'https://x.test/a',
    price: 10,
    ...overrides,
  }) as Product;

const makeRow = (product: Product, subRows: Array<{ original: Product }> = []) =>
  ({ original: product, subRows }) as unknown as Row<Product>;

const makeTable = (userSettings: Record<string, unknown> = { currency: 'USD' }) =>
  ({ options: { meta: { userSettings } } }) as unknown as Table<Product>;

const renderPanel = (product: Product, opts: { subRows?: Array<{ original: Product }>; userSettings?: Record<string, unknown> } = {}) =>
  render(<ProductDetailPanel row={makeRow(product, opts.subRows)} table={makeTable(opts.userSettings)} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockedImages.mockReturnValue([]);
  mockedDisplayedVariants.mockImplementation((_product, variants) => variants as never);
  mockedGetHistory.mockResolvedValue(new Map());
  mockedTrendPoints.mockReturnValue(undefined);
});

describe('ProductDetailPanel detail fields', () => {
  it('renders every populated identity field and a PubChem link', () => {
    renderPanel(
      makeProduct({
        cas: '7647-14-5',
        formula: 'NaCl',
        moleweight: '58.44',
        iupacName: 'sodium chloride',
        inchiKey: 'FAPWRFPIFSIZLT-UHFFFAOYSA-M',
        inchi: 'InChI=1S/...',
        smiles: '[Na+].[Cl-]',
        purity: '99%',
        grade: 'ACS',
        concentration: '1M',
        manufacturer: 'Acme',
        pubchemId: 5234,
      }),
    );
    expect(screen.getByText(i18n('product_detail_cas'))).toBeInTheDocument();
    expect(screen.getByText('7647-14-5')).toBeInTheDocument();
    expect(screen.getByText('NaCl')).toBeInTheDocument();
    expect(screen.getByText('ACS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /5234/ })).toHaveAttribute(
      'href',
      expect.stringContaining('5234'),
    );
  });

  it('omits fields that are absent', () => {
    renderPanel(makeProduct({ cas: '67-64-1' }));
    expect(screen.getByText('67-64-1')).toBeInTheDocument();
    expect(screen.queryByText(i18n('product_detail_formula'))).not.toBeInTheDocument();
  });

  it('renders the description band when present', () => {
    renderPanel(makeProduct({ description: 'A clear volatile liquid' }));
    expect(screen.getByText(/clear volatile liquid/)).toBeInTheDocument();
  });
});

describe('ProductDetailPanel document links & images', () => {
  it('renders SDS/TDS/COA links when their URLs are set', () => {
    renderPanel(
      makeProduct({
        sdsUrl: 'https://x.test/sds.pdf',
        specSheetUrl: 'https://x.test/tds.pdf',
        coaUrl: 'https://x.test/coa.pdf',
      }),
    );
    expect(screen.getByRole('link', { name: i18n('product_detail_sds') })).toHaveAttribute(
      'href',
      'https://x.test/sds.pdf',
    );
    expect(screen.getByRole('link', { name: i18n('product_detail_tds') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n('product_detail_coa') })).toBeInTheDocument();
  });

  it('shows the image column when images resolve', () => {
    mockedImages.mockReturnValue([{ thumbSrc: 'https://x.test/i.png', altText: 'alt' }] as never);
    renderPanel(makeProduct({ title: 'Acetone' }));
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('omits the image column when there are no images and no documents', () => {
    renderPanel(makeProduct({}));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: i18n('product_detail_sds') })).not.toBeInTheDocument();
  });
});

describe('ProductDetailPanel variants', () => {
  it('lists displayed variants with price and quantity', () => {
    const variant = makeProduct({ title: '500 g', permalink: 'https://x.test/v', price: 12, quantity: 500, uom: 'g' });
    mockedDisplayedVariants.mockReturnValue([variant] as never);
    renderPanel(makeProduct({ variants: [variant] }));
    expect(screen.getByRole('link', { name: '500 g' })).toHaveAttribute('href', 'https://x.test/v');
    expect(screen.getByText('500 g', { selector: '.variant-qty' })).toBeInTheDocument();
  });

  it('leaves the quantity blank for a variant with no quantity', () => {
    const variant = makeProduct({ title: 'No qty', url: 'https://x.test/v', price: 12 });
    mockedDisplayedVariants.mockReturnValue([variant] as never);
    const { container } = renderPanel(makeProduct({ variants: [variant] }));
    expect(container.querySelector('.variant-qty')?.textContent).toBe('');
  });

  it('shows a parent-product link instead of the variants grid', () => {
    const parent = makeProduct({ title: 'Parent', permalink: 'https://x.test/parent' });
    renderPanel(makeProduct({ parentProduct: parent }));
    expect(screen.getByText(i18n('product_detail_parent_product'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parent' })).toHaveAttribute('href', 'https://x.test/parent');
  });

  it('renders a variant price-history tooltip on hover once history loads', async () => {
    const variant = makeProduct({ title: '500 g', permalink: 'https://x.test/v', price: 12, quantity: 500, uom: 'g' });
    mockedDisplayedVariants.mockReturnValue([variant] as never);
    // baseline (row 1), flat (row 2 equal price), up (row 3) — exercises all EntryTrend branches.
    const points = [
      { t: 1, usd: 20 },
      { t: 2, usd: 20 },
      { t: 3, usd: 22 },
    ];
    mockedGetHistory.mockResolvedValue(new Map([['vk', { points }]]) as never);
    const { container } = renderPanel(makeProduct({ variants: [variant] }));

    // The trend trigger only appears after the async history load populates state.
    const trigger = await waitFor(() => {
      const el = container.querySelector('.variant-trend span[style*="inline-flex"]');
      if (!el) throw new Error('trend trigger not ready');
      return el;
    });

    // The card (VariantPriceHistoryCard) is in the tooltip title — rendered only on hover.
    fireEvent.mouseOver(trigger);
    expect(await screen.findByText(i18n('product_detail_price_history_col_date'))).toBeInTheDocument();
  });
});

describe('ProductDetailPanel price history block', () => {
  it('summarizes the aggregate trend when points exist', () => {
    mockedTrendPoints.mockReturnValue([
      { t: 1, usd: 20 },
      { t: 2, usd: 25 },
    ] as never);
    renderPanel(makeProduct({}));
    expect(screen.getByText(i18n('product_detail_points', ['2']))).toBeInTheDocument();
  });

  it('shows a "no history yet" note when tracking is on but there are no points', () => {
    mockedTrendPoints.mockReturnValue(undefined);
    renderPanel(makeProduct({}), { userSettings: { currency: 'USD' } });
    expect(screen.getByText(i18n('product_detail_no_history'))).toBeInTheDocument();
  });

  it('renders nothing for the block when tracking is disabled and there is no history', () => {
    mockedTrendPoints.mockReturnValue(undefined);
    renderPanel(makeProduct({}), { userSettings: { currency: 'USD', priceTracking: { enabled: false } } });
    expect(screen.queryByText(i18n('product_detail_no_history'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n('product_detail_price_history_currency', ['USD'])),
    ).not.toBeInTheDocument();
  });
});

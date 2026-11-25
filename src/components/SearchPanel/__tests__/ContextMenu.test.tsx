import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Table } from '@tanstack/react-table';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock fns, hoisted so the vi.mock factories below can reference them.
const mocks = vi.hoisted(() => ({
  flashStatusText: vi.fn(),
  setBookmarksFolderId: vi.fn(),
  bookmarksFolderId: null as string | null,
  buildResultsWorkbook: vi.fn(),
  downloadBlob: vi.fn(),
  deleteSupplierProductDataCacheEntry: vi.fn(),
  putExport: vi.fn(),
  priceAlerts: [] as Array<{ id: string }>,
  addPriceAlert: vi.fn(),
  removePriceAlerts: vi.fn(),
  requestNotificationPermission: vi.fn(),
}));

vi.mock('@/hooks/usePriceAlerts', () => ({ usePriceAlerts: () => mocks.priceAlerts }));

vi.mock('@/helpers/priceAlerts', () => ({
  addPriceAlert: mocks.addPriceAlert,
  removePriceAlerts: mocks.removePriceAlerts,
}));

vi.mock('@/helpers/permissions', () => ({
  requestNotificationPermission: mocks.requestNotificationPermission,
}));

vi.mock('@/components/StatusBar', () => ({
  useStatusBar: () => ({ flashStatusText: mocks.flashStatusText }),
}));

vi.mock('@/context', () => ({
  useAppContext: () => ({
    bookmarksFolderId: mocks.bookmarksFolderId,
    setBookmarksFolderId: mocks.setBookmarksFolderId,
  }),
}));

vi.mock('@/helpers/exportResults', () => ({
  buildResultsWorkbook: mocks.buildResultsWorkbook,
  downloadBlob: mocks.downloadBlob,
}));

vi.mock('@/utils/idbCache', () => ({
  deleteSupplierProductDataCacheEntry: mocks.deleteSupplierProductDataCacheEntry,
  putExport: mocks.putExport,
}));

import ContextMenu from '../ContextMenu';
import { i18n } from '@/helpers/i18n';
import { productSeriesKey } from '@/helpers/priceHistory';

const OPEN_URL = 'https://x.test/acetone';

const makeProduct = (overrides: Record<string, unknown> = {}): Product =>
  ({
    title: 'Acetone',
    supplier: 'Loudwolf',
    url: OPEN_URL,
    permalink: OPEN_URL,
    cacheKey: 'ck-1',
    price: 10,
    quantity: 500,
    uom: 'g',
    ...overrides,
  }) as Product;

function makeRow(product: Product, opts: Record<string, unknown> = {}) {
  return {
    original: product,
    depth: (opts.depth as number) ?? 0,
    getCanExpand: () => (opts.canExpand as boolean) ?? false,
    getIsExpanded: () => (opts.expanded as boolean) ?? false,
    toggleExpanded: (opts.toggleExpanded as () => void) ?? vi.fn(),
    subRows: (opts.subRows as unknown[]) ?? [],
  };
}

function makeTable(opts: Record<string, unknown> = {}): Table<Product> {
  const rows = (opts.rows as unknown[]) ?? [];
  return {
    getRowModel: () => ({ rows }),
    getCoreRowModel: () => ({ rows: (opts.coreRows as unknown[]) ?? rows }),
    getState: () => ({
      columnFilters: (opts.columnFilters as unknown[]) ?? [],
      globalFilter: (opts.globalFilter as string) ?? '',
    }),
    getColumn: (id: string) => ({
      columnDef: { header: (opts.headers as Record<string, unknown>)?.[id] },
    }),
    getPreFilteredRowModel: () => ({ rows: (opts.preFiltered as unknown[]) ?? rows }),
    getFilteredRowModel: () => ({ rows: (opts.filtered as unknown[]) ?? rows }),
    getAllLeafColumns: () => (opts.leafColumns as unknown[]) ?? [],
    options: { meta: { userSettings: (opts.userSettings as unknown) ?? {} } },
  } as unknown as Table<Product>;
}

function renderMenu(over: Record<string, unknown> = {}) {
  const props = {
    x: 10,
    y: 10,
    onClose: vi.fn(),
    product: makeProduct(),
    table: makeTable(),
    onExcludeProduct: vi.fn(),
    executedQuery: 'acetone',
    ...over,
  };
  const utils = render(
    <ContextMenu {...(props as unknown as ComponentProps<typeof ContextMenu>)} />,
  );
  return { ...utils, props };
}

const clickItem = (key: string) =>
  fireEvent.click(screen.getByRole('menuitem', { name: i18n(key) }));

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bookmarksFolderId = null;
  mocks.priceAlerts = [];
  mocks.addPriceAlert.mockResolvedValue(true);
  mocks.removePriceAlerts.mockResolvedValue(undefined);
  mocks.requestNotificationPermission.mockResolvedValue(true);
  mocks.buildResultsWorkbook.mockResolvedValue(new Blob(['x']));
  mocks.putExport.mockResolvedValue(undefined);
  mocks.deleteSupplierProductDataCacheEntry.mockResolvedValue(undefined);

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });

  const chromeGlobal = globalThis as unknown as { chrome: Record<string, unknown> };
  chromeGlobal.chrome = {
    ...chromeGlobal.chrome,
    tabs: { create: vi.fn().mockResolvedValue({}) },
    bookmarks: {
      get: vi.fn().mockResolvedValue([{ id: 'f', title: 'ChemPal Favorites' }]),
      getTree: vi.fn().mockResolvedValue([{ id: '0', children: [{ id: 'bar' }] }]),
      getChildren: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'new-folder' }),
    },
  };
});

afterEach(() => {
  delete (navigator as { share?: unknown }).share;
});

describe('ContextMenu rendering', () => {
  it('renders the core menu items', () => {
    renderMenu();
    expect(
      screen.getByRole('menuitem', { name: i18n('context_menu_copy_title') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: i18n('context_menu_export_all') }),
    ).toBeInTheDocument();
  });

  it('renders nothing when no product is supplied', () => {
    const { container } = renderMenu({ product: undefined });
    expect(container).toBeEmptyDOMElement();
  });

  it('disables url-dependent items when the product has no URL', () => {
    renderMenu({ product: makeProduct({ url: undefined, permalink: undefined }) });
    expect(screen.getByRole('menuitem', { name: i18n('context_menu_copy_url') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('repositions to stay within the viewport when placed off-screen', () => {
    // getBoundingClientRect is 0×0 in jsdom, so a huge x/y trips the overflow branches.
    renderMenu({ x: 99999, y: 99999 });
    expect(
      screen.getByRole('menuitem', { name: i18n('context_menu_copy_title') }),
    ).toBeInTheDocument();
  });
});

describe('ContextMenu clipboard actions', () => {
  it('copies the product title', async () => {
    const { props } = renderMenu();
    clickItem('context_menu_copy_title');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Acetone'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('swallows clipboard failures when copying the title', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const { props } = renderMenu();
    clickItem('context_menu_copy_title');
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('copies the product URL', async () => {
    renderMenu();
    clickItem('context_menu_copy_url');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(OPEN_URL));
  });

  it('copies YAML product info', async () => {
    renderMenu();
    clickItem('context_menu_copy_product_info');
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('Acetone');
  });

  it('copies JSON product info', async () => {
    renderMenu();
    clickItem('context_menu_copy_product_info_json');
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toMatch(/^\{/);
  });
});

describe('ContextMenu open in new tab', () => {
  it('opens via chrome.tabs when available', async () => {
    renderMenu();
    clickItem('context_menu_open_in_new_tab');
    const chromeGlobal = globalThis as unknown as {
      chrome: { tabs: { create: ReturnType<typeof vi.fn> } };
    };
    await waitFor(() =>
      expect(chromeGlobal.chrome.tabs.create).toHaveBeenCalledWith({ url: OPEN_URL }),
    );
  });

  it('falls back to window.open when chrome.tabs.create rejects', async () => {
    const chromeGlobal = globalThis as unknown as {
      chrome: { tabs: { create: ReturnType<typeof vi.fn> } };
    };
    chromeGlobal.chrome.tabs.create.mockRejectedValueOnce(new Error('no'));
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderMenu();
    clickItem('context_menu_open_in_new_tab');
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(OPEN_URL, '_blank', 'noopener,noreferrer'),
    );
    openSpy.mockRestore();
  });

  it('falls back to window.open when chrome.tabs is unavailable', async () => {
    const chromeGlobal = globalThis as unknown as { chrome: Record<string, unknown> };
    chromeGlobal.chrome = { ...chromeGlobal.chrome, tabs: undefined };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderMenu();
    clickItem('context_menu_open_in_new_tab');
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    openSpy.mockRestore();
  });
});

describe('ContextMenu exclude and cache', () => {
  it('delegates ignore-product to the parent callback', async () => {
    const onExcludeProduct = vi.fn().mockResolvedValue(undefined);
    const { props } = renderMenu({ onExcludeProduct });
    clickItem('context_menu_ignore_product');
    await waitFor(() => expect(onExcludeProduct).toHaveBeenCalledWith(props.product));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('still closes when ignore-product rejects', async () => {
    const onExcludeProduct = vi.fn().mockRejectedValue(new Error('nope'));
    const { props } = renderMenu({ onExcludeProduct });
    clickItem('context_menu_ignore_product');
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('removes the product from cache when it has a cache key and supplier', async () => {
    renderMenu();
    clickItem('context_menu_remove_product_from_cache');
    await waitFor(() => expect(mocks.deleteSupplierProductDataCacheEntry).toHaveBeenCalled());
    expect(mocks.flashStatusText).toHaveBeenCalled();
  });

  it('reports when the product cannot be removed from cache', async () => {
    renderMenu({ product: makeProduct({ cacheKey: undefined }) });
    clickItem('context_menu_remove_product_from_cache');
    await waitFor(() => expect(mocks.flashStatusText).toHaveBeenCalled());
    expect(mocks.deleteSupplierProductDataCacheEntry).not.toHaveBeenCalled();
  });
});

describe('ContextMenu export', () => {
  const exportTable = () =>
    makeTable({
      rows: [makeRow(makeProduct({ title: 'A' })), makeRow(makeProduct({ title: 'B' }))],
      leafColumns: [{ id: 'title', getIsVisible: () => true }],
    });

  it('exports all results, caches, and downloads the workbook', async () => {
    const { props } = renderMenu({ table: exportTable() });
    clickItem('context_menu_export_all');
    await waitFor(() => expect(mocks.buildResultsWorkbook).toHaveBeenCalled());
    expect(mocks.putExport).toHaveBeenCalled();
    expect(mocks.downloadBlob).toHaveBeenCalled();
    expect(mocks.flashStatusText).toHaveBeenCalled();
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('offers a filtered export and summarizes the active filters', async () => {
    renderMenu({
      table: makeTable({
        rows: [makeRow(makeProduct({ title: 'A' }))],
        leafColumns: [{ id: 'title', getIsVisible: () => true }],
        globalFilter: 'ace',
        columnFilters: [
          { id: 'price', value: [5, 20] }, // range → "5–20"
          { id: 'supplier', value: ['Loudwolf', 'Onyxmet'] }, // multi-select → joined
          { id: 'unlabelled', value: 'x' }, // header falls back to the column id
        ],
        headers: { price: 'Price' },
      }),
    });
    clickItem('context_menu_export_filtered');
    await waitFor(() => expect(mocks.buildResultsWorkbook).toHaveBeenCalled());
    const context = mocks.buildResultsWorkbook.mock.calls[0][0] as {
      scope: string;
      activeFilters: Array<{ label: string; value: string }>;
    };
    expect(context.scope).toBe('filtered');
    expect(context.activeFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '5–20' }),
        expect.objectContaining({ value: 'Loudwolf, Onyxmet' }),
        expect.objectContaining({ label: 'unlabelled' }),
      ]),
    );
  });

  it('hides the filtered-export item when no filters are active', () => {
    renderMenu({ table: exportTable() });
    expect(
      screen.queryByRole('menuitem', { name: i18n('context_menu_export_filtered') }),
    ).not.toBeInTheDocument();
  });

  it('reports a failure when the workbook build throws', async () => {
    mocks.buildResultsWorkbook.mockRejectedValueOnce(new Error('boom'));
    renderMenu({ table: exportTable() });
    clickItem('context_menu_export_all');
    await waitFor(() => expect(mocks.flashStatusText).toHaveBeenCalledWith(i18n('export_failed')));
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });
});

describe('ContextMenu bookmarks', () => {
  it('creates the favorites folder and bookmarks the product', async () => {
    const chromeGlobal = globalThis as unknown as {
      chrome: { bookmarks: { create: ReturnType<typeof vi.fn> } };
    };
    renderMenu();
    clickItem('context_menu_create_bookmark');
    // First create() makes the folder, second create() adds the bookmark.
    await waitFor(() => expect(chromeGlobal.chrome.bookmarks.create).toHaveBeenCalledTimes(2));
    expect(mocks.setBookmarksFolderId).toHaveBeenCalledWith('new-folder');
    expect(mocks.flashStatusText).toHaveBeenCalled();
  });

  it('flags a duplicate instead of re-bookmarking', async () => {
    const chromeGlobal = globalThis as unknown as {
      chrome: {
        bookmarks: {
          getTree: ReturnType<typeof vi.fn>;
          getChildren: ReturnType<typeof vi.fn>;
          create: ReturnType<typeof vi.fn>;
        };
      };
    };
    chromeGlobal.chrome.bookmarks.getTree.mockResolvedValue([
      { id: '0', children: [{ id: 'fav', title: i18n('bookmark_favorites_folder') }] },
    ]);
    chromeGlobal.chrome.bookmarks.getChildren.mockResolvedValue([{ url: OPEN_URL }]);
    renderMenu();
    clickItem('context_menu_create_bookmark');
    await waitFor(() => expect(mocks.flashStatusText).toHaveBeenCalled());
    expect(chromeGlobal.chrome.bookmarks.create).not.toHaveBeenCalled();
  });

  it('reuses a valid cached folder id', async () => {
    mocks.bookmarksFolderId = 'cached';
    const chromeGlobal = globalThis as unknown as {
      chrome: { bookmarks: { get: ReturnType<typeof vi.fn>; getTree: ReturnType<typeof vi.fn> } };
    };
    chromeGlobal.chrome.bookmarks.get.mockResolvedValue([
      { id: 'cached', title: 'ChemPal Favorites' },
    ]);
    renderMenu();
    clickItem('context_menu_create_bookmark');
    await waitFor(() => expect(chromeGlobal.chrome.bookmarks.get).toHaveBeenCalledWith('cached'));
    // A valid cached folder means we never scan the whole tree.
    expect(chromeGlobal.chrome.bookmarks.getTree).not.toHaveBeenCalled();
  });
});

describe('ContextMenu share', () => {
  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    (navigator as { share?: unknown }).share = share;
    renderMenu();
    clickItem('context_menu_share');
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: OPEN_URL })),
    );
  });

  it('falls back to copying the URL when sharing fails', async () => {
    (navigator as { share?: unknown }).share = vi.fn().mockRejectedValue(new Error('cancel'));
    renderMenu();
    clickItem('context_menu_share');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(OPEN_URL));
  });

  it('falls back to copying the URL when the Web Share API is absent', async () => {
    renderMenu();
    clickItem('context_menu_share');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(OPEN_URL));
  });
});

describe('ContextMenu expand/collapse all', () => {
  it('shows expand-all for collapsed rows and expands them on click', () => {
    const toggle = vi.fn();
    const rows = [
      makeRow(makeProduct(), { canExpand: true, expanded: false, toggleExpanded: toggle }),
    ];
    const { props } = renderMenu({ table: makeTable({ rows }) });
    clickItem('context_menu_expand_all');
    expect(toggle).toHaveBeenCalledWith(true);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows collapse-all for expanded rows and collapses them on click', () => {
    const toggle = vi.fn();
    const rows = [
      makeRow(makeProduct(), { canExpand: true, expanded: true, toggleExpanded: toggle }),
    ];
    renderMenu({ table: makeTable({ rows }) });
    clickItem('context_menu_collapse_all');
    expect(toggle).toHaveBeenCalledWith(false);
  });
});

describe('ContextMenu dismissal', () => {
  it('closes on an outside mousedown', () => {
    const { props } = renderMenu();
    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { props } = renderMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe('ContextMenu price alerts', () => {
  const SUPPORTED = 'Carolina Chemical';
  const enableName = () => i18n('context_menu_enable_price_alerts');
  const disableName = () => i18n('context_menu_disable_price_alerts');
  const supported = (overrides: Record<string, unknown> = {}) =>
    makeProduct({ supplier: SUPPORTED, ...overrides });
  const alertFor = (product: Product) => ({ id: productSeriesKey(product) ?? '' });

  it('offers to enable alerts when the product is not watched', () => {
    renderMenu({ product: supported() });
    expect(screen.getByRole('menuitem', { name: enableName() })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.queryByRole('menuitem', { name: disableName() })).toBeNull();
  });

  it('disables the item for a supplier without price alert support', () => {
    renderMenu({ product: makeProduct({ supplier: 'Warchem' }) });
    expect(screen.getByRole('menuitem', { name: enableName() })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('stays enabled to turn off an existing alert on an unsupported supplier', () => {
    const product = makeProduct({ supplier: 'Warchem' });
    mocks.priceAlerts = [alertFor(product)];
    renderMenu({ product });
    expect(screen.getByRole('menuitem', { name: disableName() })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('adds an alert for the product and asks for notifications on the first one', async () => {
    const product = supported();
    const { props } = renderMenu({ product });
    fireEvent.click(screen.getByRole('menuitem', { name: enableName() }));

    // Requested synchronously in the click, as the browser requires.
    expect(mocks.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalled();
    await waitFor(() => expect(mocks.addPriceAlert).toHaveBeenCalledWith(product));
    await waitFor(() =>
      expect(mocks.flashStatusText).toHaveBeenCalledWith(i18n('price_alerts_enabled')),
    );
  });

  it('does not ask for notifications when other alerts already exist', async () => {
    mocks.priceAlerts = [{ id: 'other' }];
    renderMenu({ product: supported() });
    fireEvent.click(screen.getByRole('menuitem', { name: enableName() }));
    await waitFor(() => expect(mocks.addPriceAlert).toHaveBeenCalled());
    expect(mocks.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it('still saves the alert when notifications are declined', async () => {
    mocks.requestNotificationPermission.mockResolvedValue(false);
    renderMenu({ product: supported() });
    fireEvent.click(screen.getByRole('menuitem', { name: enableName() }));
    await waitFor(() =>
      expect(mocks.flashStatusText).toHaveBeenCalledWith(i18n('price_alerts_enabled')),
    );
    expect(mocks.addPriceAlert).toHaveBeenCalled();
  });

  it('reports when the alert could not be saved', async () => {
    mocks.addPriceAlert.mockResolvedValue(false);
    renderMenu({ product: supported() });
    fireEvent.click(screen.getByRole('menuitem', { name: enableName() }));
    await waitFor(() =>
      expect(mocks.flashStatusText).toHaveBeenCalledWith(i18n('price_alerts_enable_failed')),
    );
  });

  it('saves the parent product when a flattened size row is clicked', async () => {
    const parent = supported({ title: 'Acetone parent', variants: [{ title: '1 L' }] });
    const size = supported({ title: 'Acetone 1 L', parentProduct: parent });
    renderMenu({
      product: size,
      table: makeTable({ coreRows: [makeRow(size), makeRow(parent)] }),
    });
    fireEvent.click(screen.getByRole('menuitem', { name: enableName() }));
    await waitFor(() => expect(mocks.addPriceAlert).toHaveBeenCalledWith(parent));
  });

  it('removes an existing alert', async () => {
    const product = supported();
    mocks.priceAlerts = [alertFor(product)];
    renderMenu({ product });
    fireEvent.click(screen.getByRole('menuitem', { name: disableName() }));
    await waitFor(() =>
      expect(mocks.removePriceAlerts).toHaveBeenCalledWith([productSeriesKey(product)]),
    );
    expect(mocks.flashStatusText).toHaveBeenCalledWith(i18n('price_alerts_disabled'));
    expect(mocks.addPriceAlert).not.toHaveBeenCalled();
  });
});

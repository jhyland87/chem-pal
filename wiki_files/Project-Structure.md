# Project Structure

## Top-Level Layout

```
chem-pal/
├── public/                  # Static assets and manifest.json
│   ├── manifest.json        # Chrome extension manifest (v3)
│   └── static/              # Icons, logos, images
├── src/                     # Application source code
│   ├── App.tsx              # Root component and state management
│   ├── index.tsx            # Entry point
│   ├── service-worker.js    # Extension service worker
│   ├── components/          # React components
│   ├── suppliers/           # Supplier implementations
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility classes
│   ├── helpers/             # Helper functions
│   ├── constants/           # Constants and enums
│   ├── context/             # React context providers
│   ├── features/            # Feature modules
│   ├── shared/              # Shared components and hooks
│   ├── styles/              # SCSS stylesheets
│   ├── theme/               # Theme configuration
│   └── __mocks__/           # MSW mock data
├── e2e/                     # End-to-end tests
├── tests/                   # Test utilities and mock data
├── wiki_files/              # GitHub wiki source files
├── pages/                   # Documentation pages (diagrams, guides)
├── themes/                  # TypeDoc themes
├── tools/                   # Build tools and scripts
├── config.json              # App configuration (locations, currencies)
├── vite.config.ts           # Vite build configuration
├── vitest.config.ts         # Unit test configuration
├── vitest.e2e.config.ts     # E2E test configuration
├── typedoc.json             # TypeDoc configuration
└── package.json             # Dependencies and scripts
```

## Source Code (`src/`)

### Components (`src/components/`)

```
components/
├── SearchPanel/             # Main search results interface
│   ├── SearchPanel.tsx      # Container component
│   ├── SearchInput.tsx      # Search query input
│   ├── ResultsTable.tsx     # TanStack data table with filters
│   ├── TableColumns.tsx     # Column definitions
│   ├── TableHeader.tsx      # Header controls
│   ├── TableOptions.tsx     # Table options menu
│   ├── FilterMenu.tsx       # Advanced filtering
│   ├── ContextMenu.tsx      # Right-click context menu
│   ├── Pagination.tsx       # Result pagination
│   ├── hooks/               # Panel-specific hooks
│   │   ├── useAutoColumnSizing.hook.ts
│   │   ├── useContextMenu.hook.ts
│   │   ├── useFilterMenu.hook.ts
│   │   ├── useResultsTable.hook.ts
│   │   └── useSearchInput.hook.ts
│   └── Inputs/              # Filter input components
│       ├── ColumnVisibilitySelect.tsx
│       ├── RangeColumnFilter.tsx
│       ├── SelectColumnFilter.tsx
│       ├── TextColumnFilter.tsx
│       └── SupplierResultLimit.tsx
├── SettingsPanel.tsx         # Popup settings panel
├── SettingsPanelFull.tsx     # Full-page settings
├── SuppliersPanel.tsx        # Supplier enable/disable
├── StatsPanel.tsx            # Search statistics
├── DrawerSystem.tsx          # Drawer-based navigation
├── FavoritesPanel.tsx        # Saved favorites
├── HistoryPanel.tsx          # Search history
├── SpeedDialMenu.tsx         # FAB speed dial
├── ThemeProvider.tsx          # Theme context
├── ThemeSwitcher.tsx          # Theme toggle
├── StyledComponents.ts       # MUI styled components
├── ErrorBoundary.tsx          # Error boundary
├── LoadingBackdrop.tsx        # Loading overlay
└── HelpTooltip.tsx            # Contextual help tooltips
```

### Suppliers (`src/suppliers/`)

```
suppliers/
├── index.ts                  # Barrel export of all active suppliers
├── SupplierBase.ts           # Abstract base class
├── SupplierFactory.ts        # Parallel execution orchestrator
├── SupplierBaseWix.ts        # Wix platform base
├── SupplierBaseSearchanise.ts # Searchanise platform base
├── SupplierBaseShopify.ts    # Shopify platform base
├── SupplierBaseWoocommerce.ts # WooCommerce platform base
├── SupplierBaseMagento2.ts   # Magento 2 platform base
├── SupplierBaseAmazon.ts     # Amazon platform base
├── SupplierAladdinSci.ts     # AladdinSci (Magento 2)
├── SupplierAlchemieLabs.ts   # Alchemie Labs (WooCommerce)
├── SupplierAmbeed.ts         # Ambeed
├── SupplierBiofuranChem.ts   # BioFuran Chem (Wix)
├── SupplierBVV.ts            # BVV (Shopify)
├── SupplierCarolina.ts       # Carolina Biological
├── SupplierCarolinaChemical.ts # Carolina Chemical (WooCommerce)
├── SupplierChemsavers.ts
├── SupplierFtfScientific.ts  # FTF Scientific (Wix)
├── SupplierGoldAndSilverTesting.ts # Gold and Silver Testing (Shopify)
├── SupplierHbarSci.ts        # HbarSci (Searchanise)
├── SupplierHimedia.ts        # Himedia (Amazon)
├── SupplierInnovatingScience.ts # Innovating Science (Amazon)
├── SupplierLaballey.ts       # Laballey (Searchanise)
├── SupplierLaboratoriumDiscounter.ts
├── SupplierLibertySci.ts     # LibertySci (WooCommerce)
├── SupplierLoudwolf.ts
├── SupplierMacklin.ts
├── SupplierOnyxmet.ts
├── SupplierSynthetika.ts
├── SupplierWarchem.ts
├── SupplierAkmekem.ts        # Deprecated — not in index.ts (booted from Amazon)
├── SupplierBunmurraLabs.ts   # Deprecated — not in index.ts (site under reconstruction)
├── SupplierN2O3.ts           # Deprecated — not in index.ts (offline since 2026-01-20)
├── base/                     # Platform base-class helpers
├── cache/                    # Supplier cache helpers
├── queries/                  # Platform query definitions (GraphQL, REST)
├── __tests__/                # Supplier tests
├── __mocks__/                # Supplier mocks
└── __fixtures__/             # Test fixtures
```

### Utilities (`src/utils/`)

| File | Description |
|------|-------------|
| `Logger.ts` | Structured logging with per-supplier prefixes |
| `ProductBuilder.ts` | Fluent product construction with validation and serialization |
| `Pubchem.ts` | PubChem API client |
| `storage.ts` | `cstorage` — compression-aware `chrome.storage` wrapper using lz-string (UTF-16) |
| `SupplierCache.ts` | Chrome storage caching with LRU eviction (writes via `cstorage`) |
| `SupplierStatsStore.ts` | Per-supplier success/failure/timing statistics |
| `Cactus.ts` | NCI/CADD Chemical Identifier Resolver utility |
| `BadgeAnimator.ts` | Extension badge animations |
| `HttpLru.ts` | In-memory LRU cache for HTTP requests |
| `fetchDecorator.ts` | Enhanced fetch wrapper with response capture |

### Helpers (`src/helpers/`)

| File | Description |
|------|-------------|
| `currency.ts` | Currency conversion, rate fetching, price parsing |
| `pubchem.ts` | PubChem type guards and assertion functions |
| `quantity.ts` | Quantity string parsing and formatting |
| `cas.ts` | CAS number validation and parsing |
| `fetch.ts` | Enhanced fetch with request hashing |
| `request.ts` | HTTP request utilities |
| `responseAggregate.ts` | Response capture for test mock generation |
| `utils.ts` | General utilities (sorting, collections) |
| `science.ts` | Chemistry-specific helpers |
| `collectionUtils.ts` | Array and collection operations |
| `history.ts` | Search history management |

### Types (`src/types/`)

| File | Description |
|------|-------------|
| `product.d.ts` | Core types: `Product`, `ISupplier`, `UserSettings`, `QuantityObject` |
| `pubchem.d.ts` | PubChem SDQ API types |
| `currency.d.ts` | Currency conversion types |
| `cas.d.ts` | CAS number types |
| `settings.d.ts` | Settings action types |
| `chromeStorage.d.ts` | Chrome storage types |
| `datetime.d.ts` | Date/time utility types |
| `tanstack.d.ts` | TanStack React Table extensions |
| `props.d.ts` | React component prop types |
| Supplier-specific: | `carolina.d.ts`, `ambeed.d.ts`, `macklin.d.ts`, `searchanise.d.ts`, `shopify.d.ts`, `wix.d.ts`, `woocommerce.d.ts`, etc. |

### Shared (`src/shared/`)

```
shared/
├── components/               # Reusable UI components
│   ├── AboutModal/
│   ├── Debounce/
│   ├── ErrorBoundary/
│   ├── HelpTooltip/
│   ├── IconTextFader/
│   ├── LoadingBackdrop/
│   ├── SuppliersPanel/
│   ├── TabLink/
│   └── TabPanel/
└── hooks/                    # Reusable hooks
    ├── useDebouncedCallback.hook.ts
    ├── useHelpTooltip.hook.ts
    └── index.ts
```

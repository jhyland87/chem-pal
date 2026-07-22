import { createDOM } from '@/helpers/request';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierWarchem } from '../SupplierWarchem';

const formFixture = readFileSync(resolve(__dirname, '../__fixtures__/warchem/form.html'), 'utf8');
const dataTableFixture = readFileSync(
  resolve(__dirname, '../__fixtures__/warchem/product-datatable.html'),
  'utf8',
);

const makeSupplier = () => new SupplierWarchem('winian', 1);

type WarchemInternals = {
  parseVariants: (html: string, dom: Document) => Partial<Variant>[];
  initProductBuilders: (elements: Element[]) => ProductBuilder<Product>[];
  getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
  applyDataTable: (b: ProductBuilder<Product>, dom: Document) => void;
  fuzzHtmlResponse: (query: string, response: string) => Element[];
};

// Two search rows: a short name and a fuller-named variant of the same compound.
const searchListingHtml = `
<div class="ListingWierszeKontener">
  <div class="Wiersz LiniaDolna" id="1">
    <div class="LiniaOpisu"><div>&nbsp;&nbsp;</div></div>
    <div class="ProdCena"><h3><a href="/winian-amonu-czysty-p-1.html">WINIAN AMONU - czysty</a></h3></div>
  </div>
  <div class="Wiersz LiniaDolna" id="2">
    <div class="LiniaOpisu"><div>&nbsp;&nbsp;</div></div>
    <div class="ProdCena"><h3><a href="/winian-amonu-sodu-4hydrat-czysty-p-2.html">WINIAN AMONU SODU 4hydrat - czysty</a></h3></div>
  </div>
</div>`;

describe('SupplierWarchem parseVariants', () => {
  it("ties each radio's pack size to its gross price from the opcje map", () => {
    const supplier = makeSupplier() as unknown as WarchemInternals;

    const variants = supplier.parseVariants(formFixture, createDOM(formFixture));

    expect(variants).toHaveLength(6);
    // DOM order is ascending pack size; price is the gross (brutto) value, i.e.
    // the second `;`-separated field of each opcje entry.
    expect(variants.map((v) => v.price)).toEqual([8, 11, 18, 39, 72, 131]);
    // Key suffix is the radio's data-id.
    expect(variants.map((v) => v.id)).toEqual(['7', '8', '9', '10', '11', '12']);
    expect(variants[0]).toMatchObject({ id: '7', price: 8, quantity: 25, uom: 'g' });
    expect(variants[5]).toMatchObject({ id: '12', price: 131, quantity: 1, uom: 'kg' });
    expect(variants.map((v) => v.title)).toEqual(['25g', '50g', '100g', '250g', '500g', '1kg']);
    // Currency is left unset so it inherits the parent product at build time.
    expect(variants[0].currencyCode).toBeUndefined();
  });

  it('returns an empty array when the page has no opcje script', () => {
    const supplier = makeSupplier() as unknown as WarchemInternals;
    const html = '<form><div>No variants here</div></form>';
    expect(supplier.parseVariants(html, createDOM(html))).toEqual([]);
  });

  it('parses opcje whether the inline script uses single or double quotes', () => {
    const supplier = makeSupplier() as unknown as WarchemInternals;
    const radio =
      '<div class="CechaWyboru"><label>' +
      '<input type="radio" data-id-cechy="1" data-id="7" aria-label="Opakowanie:: 25g" />' +
      '</label></div>';

    for (const q of ["'", '"']) {
      const html = `<script>opcje[${q}x1-7${q}] = ${q}6.50;8.00;0;0;0.00${q};</script>${radio}`;
      const variants = supplier.parseVariants(html, createDOM(html));
      expect(variants).toHaveLength(1);
      expect(variants[0]).toMatchObject({ id: '7', price: 8, quantity: 25, uom: 'g' });
    }
  });
});

// A search-result row carries its data as schema.org Product microdata.
const listingHtml = `
<div class="ListingWierszeKontener">
  <div class="Wiersz LiniaDolna" id="81" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
    <div itemprop="item" itemscope itemtype="https://schema.org/Product">
      <meta itemprop="name" content="WINIAN AMONU SODU 4hydrat - czysty" />
      <link itemprop="url" href="https://warchem.pl/winian-amonu-sodu-4hydrat-czysty-p-81.html" />
      <link itemprop="image" href="https://warchem.pl/images/NEW_IMG_31521.jpg" />
      <meta itemprop="sku" content="44962" />
      <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <link itemprop="availability" href="https://schema.org/InStock" />
        <meta itemprop="price" content="8.00" />
        <meta itemprop="priceCurrency" content="PLN" />
      </div>
    </div>
  </div>
</div>`;

describe('SupplierWarchem initProductBuilders', () => {
  it("extracts product fields from the listing's schema.org microdata", () => {
    const supplier = makeSupplier() as unknown as WarchemInternals;
    const dom = createDOM(listingHtml);
    const elements = Array.from(dom.querySelectorAll('div.Wiersz.LiniaDolna'));

    const builders = supplier.initProductBuilders(elements);

    expect(builders).toHaveLength(1);
    const dump = builders[0].dump();
    expect(dump.title).toBe('WINIAN AMONU SODU 4hydrat - czysty');
    expect(dump.url).toBe('https://warchem.pl/winian-amonu-sodu-4hydrat-czysty-p-81.html');
    expect(dump.supplier).toBe('Warchem');
    expect(dump.sku).toBe('44962');
    expect(dump.price).toBe(8);
    expect(dump.currencyCode).toBe('PLN');
    expect(dump.images).toEqual([
      { href: 'https://warchem.pl/images/NEW_IMG_31521.jpg', type: 'image' },
    ]);
    expect(dump.availability).toBe('in_stock');
  });
});

const productPageHtml = `
<html>
  <head>
    <meta property="og:title" content="WINIAN AMONU SODU 4hydrat - czysty" />
    <meta property="og:image" content="https://warchem.pl/images/NEW_IMG_31521.jpg" />
    <meta property="product:price:amount" content="8.00" />
    <meta property="product:price:currency" content="PLN" />
    <meta property="product:availability" content="in stock" />
  </head>
  <body></body>
</html>`;

describe('SupplierWarchem fuzzHtmlResponse', () => {
  it('keeps fuller-named variants for a partial-name query (token_set_ratio)', () => {
    const supplier = makeSupplier() as unknown as WarchemInternals;

    const matches = supplier.fuzzHtmlResponse('WINIAN AMONU', searchListingHtml);
    const titles = matches.map((el) =>
      el.querySelector('div.ProdCena > h3 > a')?.textContent?.trim(),
    );

    // The default `ratio` scorer drops the longer name at the 55 cutoff;
    // token_set_ratio keeps both because the query words are a subset.
    expect(titles).toContain('WINIAN AMONU - czysty');
    expect(titles).toContain('WINIAN AMONU SODU 4hydrat - czysty');
  });
});

describe('SupplierWarchem applyDataTable', () => {
  it('extracts CAS, formula, and molar mass from the description spec table', () => {
    const supplier = makeSupplier() as unknown as WarchemInternals;
    const builder = new ProductBuilder<Product>('https://warchem.pl');

    supplier.applyDataTable(builder, createDOM(dataTableFixture));

    const dump = builder.dump();
    // The table is a more reliable CAS source than the title/description.
    expect(dump.cas).toBe('20199-92-2');
    // The formula is stored verbatim (already display-formatted).
    expect(dump.formula).toBe('NH₄NaC₄H₄O₆ x 4H₂O');
    // "261,06 g/mol" -> 261.06 (Polish decimal comma, unit stripped).
    expect(dump.moleweight).toBe(261.06);
  });
});

describe('SupplierWarchem getProductData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sets the product image from the og:image meta tag', async () => {
    const supplier = makeSupplier() as unknown as WarchemInternals;
    vi.spyOn(supplier as never, 'httpGetHtml').mockResolvedValue(productPageHtml as never);
    // Bypass the cache wrapper and run the fetcher directly.
    vi.spyOn(supplier as never, 'getProductDataWithCache').mockImplementation(((
      b: ProductBuilder<Product>,
      fetcher: (b: ProductBuilder<Product>) => unknown,
    ) => fetcher(b)) as never);

    const builder = new ProductBuilder<Product>('https://warchem.pl');
    builder.setBasicInfo('Test Product', 'https://warchem.pl/winian-p-81.html', 'Warchem');

    const result = await supplier.getProductData(builder as unknown as ProductBuilder<Product>);

    expect(result).toBe(builder);
    const dump = builder.dump();
    expect(dump.images).toEqual([
      { href: 'https://warchem.pl/images/NEW_IMG_31521.jpg', type: 'image' },
    ]);
    expect(dump.price).toBe(8);
    expect(dump.currencyCode).toBe('PLN');
  });
});

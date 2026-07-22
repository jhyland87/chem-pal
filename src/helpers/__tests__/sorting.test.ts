import {
  matchPercentageSortingFn,
  priceSortingFn,
  puritySortingFn,
  quantitySortingFn,
} from '@/helpers/sorting';
import type { Row } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

function makeRow(original: Partial<Product>): Row<Product> {
  return { original } as Row<Product>;
}

describe('quantitySortingFn', () => {
  it('returns 1 when rowA baseQuantity is greater', () => {
    expect(quantitySortingFn(makeRow({ baseQuantity: 500 }), makeRow({ baseQuantity: 100 }))).toBe(
      1,
    );
  });

  it('returns -1 when rowA baseQuantity is smaller', () => {
    expect(quantitySortingFn(makeRow({ baseQuantity: 100 }), makeRow({ baseQuantity: 500 }))).toBe(
      -1,
    );
  });

  it('returns 0 when equal', () => {
    expect(quantitySortingFn(makeRow({ baseQuantity: 100 }), makeRow({ baseQuantity: 100 }))).toBe(
      0,
    );
  });

  it('treats a missing baseQuantity as 0', () => {
    expect(quantitySortingFn(makeRow({}), makeRow({ baseQuantity: 100 }))).toBe(-1);
    expect(quantitySortingFn(makeRow({ baseQuantity: 5 }), makeRow({}))).toBe(1);
    expect(quantitySortingFn(makeRow({}), makeRow({}))).toBe(0);
  });
});

describe('matchPercentageSortingFn', () => {
  it('returns 1 when rowA matchPercentage is greater', () => {
    expect(
      matchPercentageSortingFn(makeRow({ matchPercentage: 90 }), makeRow({ matchPercentage: 70 })),
    ).toBe(1);
  });

  it('returns -1 when rowA matchPercentage is smaller', () => {
    expect(
      matchPercentageSortingFn(makeRow({ matchPercentage: 70 }), makeRow({ matchPercentage: 90 })),
    ).toBe(-1);
  });

  it('returns 0 when equal', () => {
    expect(
      matchPercentageSortingFn(makeRow({ matchPercentage: 50 }), makeRow({ matchPercentage: 50 })),
    ).toBe(0);
  });

  it('treats a missing matchPercentage as 0', () => {
    expect(matchPercentageSortingFn(makeRow({}), makeRow({ matchPercentage: 10 }))).toBe(-1);
    expect(matchPercentageSortingFn(makeRow({ matchPercentage: 10 }), makeRow({}))).toBe(1);
    expect(matchPercentageSortingFn(makeRow({}), makeRow({}))).toBe(0);
  });
});

describe('priceSortingFn', () => {
  it('returns 1 when rowA usdPrice is greater', () => {
    expect(priceSortingFn(makeRow({ usdPrice: 29.99 }), makeRow({ usdPrice: 9.99 }))).toBe(1);
  });

  it('returns -1 when rowA usdPrice is smaller', () => {
    expect(priceSortingFn(makeRow({ usdPrice: 9.99 }), makeRow({ usdPrice: 29.99 }))).toBe(-1);
  });

  it('returns 0 when equal', () => {
    expect(priceSortingFn(makeRow({ usdPrice: 5 }), makeRow({ usdPrice: 5 }))).toBe(0);
  });

  it('falls back to price when usdPrice is missing', () => {
    expect(priceSortingFn(makeRow({ price: 20 }), makeRow({ price: 10 }))).toBe(1);
    expect(priceSortingFn(makeRow({ price: 10 }), makeRow({ price: 20 }))).toBe(-1);
  });

  it('prefers usdPrice over price when both present', () => {
    expect(
      priceSortingFn(makeRow({ usdPrice: 1, price: 999 }), makeRow({ usdPrice: 2, price: 0 })),
    ).toBe(-1);
  });

  it('treats a fully missing price as 0', () => {
    expect(priceSortingFn(makeRow({}), makeRow({ usdPrice: 1 }))).toBe(-1);
    expect(priceSortingFn(makeRow({}), makeRow({}))).toBe(0);
  });
});

describe('puritySortingFn', () => {
  it('ranks grades by their representative purity', () => {
    // ACS (99.8) outranks Technical (90).
    expect(
      puritySortingFn(makeRow({ grade: 'ACS Grade' }), makeRow({ grade: 'Technical Grade' })),
    ).toBe(1);
    expect(
      puritySortingFn(makeRow({ grade: 'Technical Grade' }), makeRow({ grade: 'ACS Grade' })),
    ).toBe(-1);
  });

  it('returns 0 for grades in the same tier', () => {
    // USP/BP/JP/NF are deliberately tied.
    expect(puritySortingFn(makeRow({ grade: 'USP Grade' }), makeRow({ grade: 'BP Grade' }))).toBe(
      0,
    );
  });

  it('ranks percentages against each other', () => {
    expect(puritySortingFn(makeRow({ purity: '99.9%' }), makeRow({ purity: '95%' }))).toBe(1);
    expect(puritySortingFn(makeRow({ purity: '≥99.8%' }), makeRow({ purity: '99.9%' }))).toBe(-1);
  });

  it('orders equal percentages by their comparator prefix', () => {
    // ">75%" sorts just above a bare "75%"; "<75%" just below.
    expect(puritySortingFn(makeRow({ purity: '>75%' }), makeRow({ purity: '75%' }))).toBe(1);
    expect(puritySortingFn(makeRow({ purity: '<75%' }), makeRow({ purity: '75%' }))).toBe(-1);
  });

  it('puts grades and percentages on one scale', () => {
    // This is the whole point: a string sort would interleave these arbitrarily.
    expect(puritySortingFn(makeRow({ grade: 'ACS Grade' }), makeRow({ purity: '95%' }))).toBe(1);
    expect(puritySortingFn(makeRow({ purity: '99.9%' }), makeRow({ grade: 'Lab Grade' }))).toBe(1);
  });

  it("prefers grade over purity, matching the column's accessor", () => {
    // Same precedence as `product.grade ?? product.purity` in TableColumns.
    const row = makeRow({ grade: 'Technical Grade', purity: '99.9%' });
    expect(puritySortingFn(row, makeRow({ purity: '95%' }))).toBe(-1);
  });

  it('treats a missing or unrecognized purity as 0', () => {
    expect(puritySortingFn(makeRow({}), makeRow({ grade: 'ACS Grade' }))).toBe(-1);
    expect(puritySortingFn(makeRow({ grade: 'Ungraded' }), makeRow({ grade: 'Low Grade' }))).toBe(
      -1,
    );
    expect(puritySortingFn(makeRow({}), makeRow({}))).toBe(0);
    expect(puritySortingFn(makeRow({ grade: 'Ungraded' }), makeRow({}))).toBe(0);
  });
});

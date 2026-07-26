import { countActiveSearchFilters } from '@/helpers/searchFilters';
import { describe, expect, it } from 'vitest';

const emptyFilters: { availability: string[]; country: string[]; shippingType: string[] } = {
  availability: [],
  country: [],
  shippingType: [],
};

const call = (overrides: {
  selectedSuppliers?: string[];
  searchFilters?: Partial<typeof emptyFilters>;
  userSettings?: { priceMin?: number; priceMax?: number };
}): number =>
  countActiveSearchFilters({
    selectedSuppliers: overrides.selectedSuppliers ?? [],
    searchFilters: { ...emptyFilters, ...overrides.searchFilters },
    userSettings: overrides.userSettings ?? {},
  });

describe.concurrent('countActiveSearchFilters', () => {
  it('returns 0 when every filter is at its default', () => {
    expect(call({})).toBe(0);
  });

  it.for([
    { label: 'selected suppliers', arg: { selectedSuppliers: ['Loudwolf'] } },
    { label: 'country', arg: { searchFilters: { country: ['US'] } } },
    { label: 'shipping', arg: { searchFilters: { shippingType: ['domestic'] } } },
    { label: 'availability', arg: { searchFilters: { availability: ['in_stock'] } } },
    { label: 'price min only', arg: { userSettings: { priceMin: 10 } } },
    { label: 'price max only', arg: { userSettings: { priceMax: 99 } } },
    { label: 'price min + max (one range)', arg: { userSettings: { priceMin: 10, priceMax: 99 } } },
  ])('counts $label as one active filter', ({ arg }) => {
    expect(call(arg)).toBe(1);
  });

  it('sums independent categories, counting the price range once', () => {
    expect(
      call({
        selectedSuppliers: ['Loudwolf'],
        searchFilters: { country: ['US'], shippingType: ['domestic'], availability: ['in_stock'] },
        userSettings: { priceMin: 10, priceMax: 99 },
      }),
    ).toBe(5);
  });

  it('treats a price min of 0 as active (a real bound, not a default)', () => {
    expect(call({ userSettings: { priceMin: 0 } })).toBe(1);
  });
});

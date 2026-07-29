import {
  countriesForSuppliers,
  fulfillableShippingRanges,
  shippingCovers,
  suppliersExcludedBySearchFilters,
  type SupplierMetaMap,
} from '@/helpers/supplierFilters';
import { describe, expect, it } from 'vitest';

const meta: SupplierMetaMap = {
  Worldly: { country: 'US', shipping: 'worldwide' },
  Intl: { country: 'DE', shipping: 'international' },
  DomUS: { country: 'US', shipping: 'domestic' },
  LocalUS: { country: 'US', shipping: 'local' },
};

describe.concurrent('shippingCovers', () => {
  it.for([
    { a: 'worldwide', b: 'local', expected: true },
    { a: 'worldwide', b: 'worldwide', expected: true },
    { a: 'international', b: 'domestic', expected: true },
    { a: 'international', b: 'worldwide', expected: false },
    { a: 'domestic', b: 'local', expected: true },
    { a: 'domestic', b: 'international', expected: false },
    { a: 'local', b: 'local', expected: true },
    { a: 'local', b: 'domestic', expected: false },
  ] as const)('$a covers $b → $expected', ({ a, b, expected }) => {
    expect(shippingCovers(a, b)).toBe(expected);
  });
});

describe.concurrent('suppliersExcludedBySearchFilters', () => {
  it('excludes nothing when no shipping/country filter is set', () => {
    expect(suppliersExcludedBySearchFilters(meta, { shippingType: [], country: [] }).size).toBe(0);
  });

  it.for([
    {
      label: 'worldwide keeps only worldwide suppliers',
      filters: { shippingType: ['worldwide'], country: [] },
      expected: ['Intl', 'DomUS', 'LocalUS'],
    },
    {
      label: 'international keeps worldwide + international',
      filters: { shippingType: ['international'], country: [] },
      expected: ['DomUS', 'LocalUS'],
    },
    {
      label: 'domestic keeps everyone except local-only (hierarchy)',
      filters: { shippingType: ['domestic'], country: [] },
      expected: ['LocalUS'],
    },
    {
      label: 'local is fulfillable by every scope, so excludes nobody',
      filters: { shippingType: ['local'], country: [] },
      expected: [],
    },
    {
      label: 'country filter drops suppliers residing elsewhere',
      filters: { shippingType: [], country: ['DE'] },
      expected: ['Worldly', 'DomUS', 'LocalUS'],
    },
    {
      label: 'shipping or country: excluded when it fails either constraint',
      filters: { shippingType: ['worldwide'], country: ['US'] },
      expected: ['Intl', 'DomUS', 'LocalUS'],
    },
  ])('$label', ({ filters, expected }) => {
    expect([...suppliersExcludedBySearchFilters(meta, filters)].sort()).toEqual(
      [...expected].sort(),
    );
  });
});

describe.concurrent('fulfillableShippingRanges', () => {
  it('is empty for no selected suppliers', () => {
    expect(fulfillableShippingRanges(meta, []).size).toBe(0);
  });

  it.for([
    {
      label: 'a domestic supplier fulfills local + domestic',
      suppliers: ['DomUS'],
      expected: ['local', 'domestic'],
    },
    {
      label: 'a local-only supplier fulfills only local',
      suppliers: ['LocalUS'],
      expected: ['local'],
    },
    {
      label: 'a worldwide supplier fulfills every scope',
      suppliers: ['Worldly'],
      expected: ['local', 'domestic', 'international', 'worldwide'],
    },
    {
      label: 'the union across suppliers is taken',
      suppliers: ['LocalUS', 'Intl'],
      expected: ['local', 'domestic', 'international'],
    },
  ])('$label', ({ suppliers, expected }) => {
    expect([...fulfillableShippingRanges(meta, suppliers)].sort()).toEqual([...expected].sort());
  });

  it('ignores unknown supplier keys', () => {
    expect(fulfillableShippingRanges(meta, ['Nope']).size).toBe(0);
  });
});

describe.concurrent('countriesForSuppliers', () => {
  it('is empty for no selected suppliers', () => {
    expect(countriesForSuppliers(meta, []).size).toBe(0);
  });

  it('returns the distinct home countries', () => {
    expect([...countriesForSuppliers(meta, ['DomUS', 'Intl'])].sort()).toEqual(['DE', 'US'].sort());
  });
});

import { describe, expect, it } from 'vitest';

import { UOM_ALIASES } from '@/constants/common';
import { parseQuantity, standardizeUom, toMetricQuantity } from '@/helpers/quantity';

// Cases are objects rather than bare strings: `it.each` infers the tuple
// overload for a plain `string[]`. The group types are declared explicitly
// because `describe.each` widens its callback parameter to `any`, which would
// leave the nested `it.each` ambiguous too.
interface AliasCase {
  alias: string;
}
interface AliasGroup {
  uom: string;
  cases: AliasCase[];
}
interface ParseCase {
  input: string;
  alias: string;
  expected: { quantity: number; uom: string };
}
interface ParseGroup {
  label: string;
  cases: ParseCase[];
}

// UOMAliases keys are computed enum members, so Object.entries widens the values
// to `any`; assert the real shape once here rather than at each use.
const ALIAS_ENTRIES = Object.entries(UOM_ALIASES) as Array<[string, string[]]>;

describe('standardizeUom', () => {
  const aliasGroups: AliasGroup[] = ALIAS_ENTRIES.map(([uom, aliases]) => ({
    uom,
    cases: aliases.map((alias) => ({ alias })),
  }));

  describe.each(aliasGroups)('$uom aliases', ({ uom, cases }: AliasGroup) => {
    it.each(cases)(`should return ${uom} when standardizing: $alias`, ({ alias }: AliasCase) => {
      expect(standardizeUom(alias)).toBe(uom);
    });
  });
});

describe('parseQuantity', () => {
  const testData = {
    /* eslint-disable */
    '1': 1,
    '2.3': 2.3,
    '3,456.78': 3456.78,
    '9,123': 9123,
    '1.234,56': 1234.56,
    '1,2': 1.2,
    '1,234.56': 1234.56,
    '1,234,567.89': 1234567.89,
    '2x100': 200,
    '3 × 200': 600,
    /* eslint-enable */
  };

  const normalize = (quantity: number, uom: string): { quantity: number; uom: string } => {
    const conversions: Record<string, { threshold: number; factor: number; to: string }> = {
      mg: { threshold: 1000, factor: 1000, to: 'g' },
      g: { threshold: 1000, factor: 1000, to: 'kg' },
      kg: { threshold: 1000, factor: 1000, to: 't' },
      ml: { threshold: 1000, factor: 1000, to: 'l' },
    };
    const c = conversions[uom];
    if (!c || quantity < c.threshold) return { quantity, uom };
    return { quantity: Math.round((quantity / c.factor) * 100) / 100, uom: c.to };
  };

  // One group per UOM, keeping the "g/gm/gram" style heading; the alias × input
  // matrix is flattened so each combination is its own reported case.
  const uomGroups: ParseGroup[] = ALIAS_ENTRIES.map(([uom, aliases]) => ({
    label: aliases.join('/'),
    cases: aliases.flatMap((alias) =>
      Object.entries(testData).map(([input, output]) => ({
        input,
        alias,
        expected: normalize(output, uom),
      })),
    ),
  }));

  describe.each(uomGroups)('$label', ({ cases }: ParseGroup) => {
    it.each(cases)(
      'should return $expected.quantity $expected.uom when parsing: $input $alias',
      ({ input, alias, expected }: ParseCase) => {
        expect(parseQuantity(`${input} ${alias}`)).toMatchObject(expected);
      },
    );
  });

  const negativeTestData: Record<string, QuantityObject | undefined> = {
    /* eslint-disable */
    '100 MESH': undefined,
    '100 MESH 100G': { quantity: 100, uom: 'g' },
    '1.3M': undefined,
    foobar: undefined,
    '1234.5 g/mol': undefined,
    'Hydrochloric Acid, 0.05 M, Laboratory Grade, 500 mL': { quantity: 500, uom: 'ml' },
    '2x100g': { quantity: 200, uom: 'g' },
    '3 × 200g': { quantity: 600, uom: 'g' },
    '10GM': { quantity: 10, uom: 'g' },
    '3x100g': { quantity: 300, uom: 'g' },
    '2x1.2ml': { quantity: 2.4, uom: 'ml' },
    /* eslint-enable */
  };

  // `label` is precomputed because the expectation is either an object or
  // `undefined`, and the two want different formatting in the test name.
  const negativeCases = Object.entries(negativeTestData).map(([input, expected]) => ({
    input,
    expected,
    label: expected === undefined ? String(expected) : JSON.stringify(expected),
  }));

  it.each(negativeCases)('should return $label when parsing: $input', ({ input, expected }) => {
    if (expected === undefined) {
      expect(parseQuantity(input)).toBe(undefined);
      return;
    }
    expect(parseQuantity(input)).toMatchObject(expected);
  });
});

describe('toMetricQuantity', () => {
  const cases: Array<{ input: QuantityObject; expected: QuantityObject }> = [
    // Imperial mass -> grams (normalized up to kg past 1000g)
    { input: { quantity: 0.3, uom: 'lb' }, expected: { quantity: 136.08, uom: 'g' } },
    { input: { quantity: 0.4, uom: 'lb' }, expected: { quantity: 181.44, uom: 'g' } },
    { input: { quantity: 1, uom: 'lb' }, expected: { quantity: 453.59, uom: 'g' } },
    { input: { quantity: 3, uom: 'lb' }, expected: { quantity: 1.36, uom: 'kg' } },
    { input: { quantity: 1, uom: 'oz' }, expected: { quantity: 28.35, uom: 'g' } },
    // Imperial volume -> millilitres (normalized up to l past 1000ml)
    { input: { quantity: 1, uom: 'gal' }, expected: { quantity: 3.79, uom: 'l' } },
    { input: { quantity: 2, uom: 'qt' }, expected: { quantity: 1.89, uom: 'l' } },
    { input: { quantity: 1, uom: 'qt' }, expected: { quantity: 946.35, uom: 'ml' } },
    { input: { quantity: 1, uom: 'floz' }, expected: { quantity: 29.57, uom: 'ml' } },
    // Already metric / countable -> unchanged
    { input: { quantity: 100, uom: 'g' }, expected: { quantity: 100, uom: 'g' } },
    { input: { quantity: 500, uom: 'ml' }, expected: { quantity: 500, uom: 'ml' } },
    { input: { quantity: 2, uom: 'ea' }, expected: { quantity: 2, uom: 'ea' } },
  ];

  it.each(cases)(
    'converts $input.quantity $input.uom -> $expected.quantity $expected.uom',
    ({ input, expected }) => {
      expect(toMetricQuantity(input)).toEqual(expected);
    },
  );
});

import { buildPriceChangeRows } from '@/components/PriceHistoryPanel/priceHistoryRows';
import { describe, expect, it } from 'vitest';

const entry = (fields: Partial<PriceHistoryEntry>): PriceHistoryEntry => ({
  id: 'p1',
  productKey: 'p1',
  supplier: 'Loudwolf',
  title: 'Acetone 500ml',
  points: [],
  updatedAt: 0,
  ...fields,
});

describe('buildPriceChangeRows', () => {
  it.for([
    { label: 'no points', points: [] },
    { label: 'a single point (no change yet)', points: [{ t: 1, usd: 19.99 }] },
  ])('produces no rows for a series with $label', ({ points }) => {
    expect(buildPriceChangeRows([entry({ points })])).toEqual([]);
  });

  it('produces one row per consecutive point pair', () => {
    const points = [
      { t: 1, usd: 10 },
      { t: 2, usd: 12 },
      { t: 3, usd: 9 },
    ];
    const rows = buildPriceChangeRows([entry({ points })]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(['p1::1', 'p1::2']);
  });

  it.for([
    {
      label: 'a rise',
      prev: { t: 1, usd: 20 },
      curr: { t: 2, usd: 22 },
      expected: { oldPriceUsd: 20, newPriceUsd: 22, deltaUsd: 2, pctChange: 10, direction: 'up' },
    },
    {
      label: 'a drop',
      prev: { t: 1, usd: 20 },
      curr: { t: 2, usd: 15 },
      expected: {
        oldPriceUsd: 20,
        newPriceUsd: 15,
        deltaUsd: -5,
        pctChange: -25,
        direction: 'down',
      },
    },
  ])('reports the delta and direction for $label', ({ prev, curr, expected }) => {
    const [row] = buildPriceChangeRows([entry({ points: [prev, curr] })]);
    expect(row).toMatchObject(expected);
    expect(row.changedAt).toBe(curr.t);
  });

  it('carries the series identity (supplier, title, permalink, productKey) onto every row', () => {
    const [row] = buildPriceChangeRows([
      entry({
        productKey: 'pk-1',
        supplier: 'DIY Chemicals',
        title: 'Sodium Hydroxide 1kg',
        permalink: 'https://example.com/naoh',
        points: [
          { t: 1, usd: 10 },
          { t: 2, usd: 11 },
        ],
      }),
    ]);
    expect(row).toMatchObject({
      productKey: 'pk-1',
      supplier: 'DIY Chemicals',
      title: 'Sodium Hydroxide 1kg',
      permalink: 'https://example.com/naoh',
    });
  });

  it('flattens rows across multiple series', () => {
    const rows = buildPriceChangeRows([
      entry({
        id: 'a',
        points: [
          { t: 1, usd: 10 },
          { t: 2, usd: 11 },
        ],
      }),
      entry({
        id: 'b',
        points: [
          { t: 1, usd: 5 },
          { t: 2, usd: 6 },
          { t: 3, usd: 7 },
        ],
      }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['a::1', 'b::1', 'b::2']);
  });
});

import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from '../parseSearchQuery';

describe('parseSearchQuery', () => {
  it('treats a plain single word as a non-advanced term', () => {
    const result = parseSearchQuery('acetone');
    expect(result.isAdvanced).toBe(false);
    expect(result.ast).toEqual({ type: 'term', value: 'acetone', phrase: false });
  });

  it('treats a plain multi-word query as a single phrase term', () => {
    const result = parseSearchQuery('sodium chloride');
    expect(result.isAdvanced).toBe(false);
    expect(result.ast).toEqual({ type: 'term', value: 'sodium chloride', phrase: true });
  });

  it('keeps multi-word operands as single phrases across OR (precedence fix)', () => {
    const result = parseSearchQuery('Potassium Permanganate OR Sodium Borohydride');
    expect(result.isAdvanced).toBe(true);
    expect(result.ast).toEqual({
      type: 'or',
      left: { type: 'term', value: 'Potassium Permanganate', phrase: true },
      right: { type: 'term', value: 'Sodium Borohydride', phrase: true },
    });
  });

  it('handles special characters in a phrase by quoting (99%)', () => {
    const result = parseSearchQuery('Potassium Permanganate AND 99%');
    expect(result.isAdvanced).toBe(true);
    expect(result.ast).toEqual({
      type: 'and',
      left: { type: 'term', value: 'Potassium Permanganate', phrase: true },
      right: { type: 'term', value: '99%', phrase: false },
    });
  });

  it('parses nested parentheses', () => {
    const result = parseSearchQuery('Carbonate AND (Sodium OR Potassium)');
    expect(result.ast).toEqual({
      type: 'and',
      left: { type: 'term', value: 'Carbonate', phrase: false },
      right: {
        type: 'or',
        left: { type: 'term', value: 'Sodium', phrase: false },
        right: { type: 'term', value: 'Potassium', phrase: false },
      },
    });
  });

  it('parses NOT', () => {
    const result = parseSearchQuery('foo OR NOT bar');
    expect(result.ast).toEqual({
      type: 'or',
      left: { type: 'term', value: 'foo', phrase: false },
      right: { type: 'not', operand: { type: 'term', value: 'bar', phrase: false } },
    });
  });

  it('parses deeply nested groups', () => {
    const result = parseSearchQuery('((foo OR bar) AND baz) OR quux');
    expect(result.isAdvanced).toBe(true);
    expect(result.ast).toEqual({
      type: 'or',
      left: {
        type: 'and',
        left: {
          type: 'or',
          left: { type: 'term', value: 'foo', phrase: false },
          right: { type: 'term', value: 'bar', phrase: false },
        },
        right: { type: 'term', value: 'baz', phrase: false },
      },
      right: { type: 'term', value: 'quux', phrase: false },
    });
  });

  it('respects explicit quotes as a phrase', () => {
    const result = parseSearchQuery('"Sodium Borohydride" AND NOT "sodium triacetoxyborohydride"');
    expect(result.ast).toEqual({
      type: 'and',
      left: { type: 'term', value: 'Sodium Borohydride', phrase: true },
      right: {
        type: 'not',
        operand: { type: 'term', value: 'sodium triacetoxyborohydride', phrase: true },
      },
    });
  });

  it('falls back to a plain term on unbalanced parentheses', () => {
    const result = parseSearchQuery('(a OR b');
    expect(result.isAdvanced).toBe(false);
    expect(result.ast).toEqual({ type: 'term', value: '(a OR b', phrase: true });
  });

  it('returns an empty term for blank input', () => {
    const result = parseSearchQuery('   ');
    expect(result.isAdvanced).toBe(false);
    expect(result.ast).toEqual({ type: 'term', value: '', phrase: false });
  });
});

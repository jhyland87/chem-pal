import { generateTraceId, isTraceId } from '@/utils/traceId';
import { describe, expect, it, vi } from 'vitest';

describe('generateTraceId', () => {
  it('returns 32 lowercase hex characters', () => {
    expect(generateTraceId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns a different id each time', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateTraceId()));

    expect(ids.size).toBe(200);
  });

  it('never returns an all-zero id, which OpenTelemetry treats as invalid', () => {
    const getRandomValues = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementationOnce(<T extends ArrayBufferView | null>(array: T) => array)
      .mockImplementation(<T extends ArrayBufferView | null>(array: T) => {
        if (array instanceof Uint8Array) array.fill(0xab);
        return array;
      });

    expect(generateTraceId()).toBe('ab'.repeat(16));
    expect(getRandomValues).toHaveBeenCalledTimes(2);
    getRandomValues.mockRestore();
  });
});

describe('isTraceId', () => {
  it.each([
    ['a valid id', '4bf92f3577b34da6a3ce929d0e0e4736', true],
    ['an id from generateTraceId', generateTraceId(), true],
    ['all zeros', '0'.repeat(32), false],
    ['upper-case hex', '4BF92F3577B34DA6A3CE929D0E0E4736', false],
    ['too short', 'abc123', false],
    ['too long', 'a'.repeat(33), false],
    ['non-hex characters', 'z'.repeat(32), false],
    ['a UUID with dashes', '4bf92f35-77b3-4da6-a3ce-929d0e0e4736', false],
    ['undefined', undefined, false],
    ['a number', 12345, false],
  ])('%s -> %s', (_label, value, expected) => {
    expect(isTraceId(value)).toBe(expected);
  });
});

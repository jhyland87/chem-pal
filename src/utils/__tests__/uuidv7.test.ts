import { describe, expect, it } from 'vitest';
import { generateUuidV7 } from '../uuidv7';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateUuidV7', () => {
  it('produces a well-formed UUID with the version and variant bits set', () => {
    const id = generateUuidV7();
    expect(id).toMatch(UUID_V7_PATTERN);
  });

  it('embeds a timestamp matching the generation time', () => {
    const before = Date.now();
    const id = generateUuidV7();
    const after = Date.now();

    const timestampHex = id.replace(/-/g, '').slice(0, 12);
    const embedded = Number.parseInt(timestampHex, 16);

    expect(embedded).toBeGreaterThanOrEqual(before);
    expect(embedded).toBeLessThanOrEqual(after);
  });

  it('generates unique ids on repeated calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateUuidV7()));
    expect(ids.size).toBe(50);
  });

  it('sorts in timestamp order when generated at increasing timestamps', async () => {
    const first = generateUuidV7();
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = generateUuidV7();

    expect(first < second).toBe(true);
  });
});

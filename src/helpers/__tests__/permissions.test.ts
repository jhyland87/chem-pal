import { hasHostPermissions } from '@/helpers/permissions';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('hasHostPermissions', () => {
  const contains = vi.fn();

  afterEach(() => {
    contains.mockReset();
    vi.unstubAllGlobals();
  });

  const install = () => vi.stubGlobal('chrome', { permissions: { contains } });

  it('is true without asking the browser when there are no hosts', async () => {
    install();

    expect(await hasHostPermissions([])).toBe(true);
    expect(contains).not.toHaveBeenCalled();
  });

  it('passes the origins to the browser and returns its answer', async () => {
    install();
    contains.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const origins = ['https://a.example/*', 'https://b.example/*'];

    expect(await hasHostPermissions(origins)).toBe(true);
    expect(await hasHostPermissions(origins)).toBe(false);
    expect(contains).toHaveBeenCalledWith({ origins });
  });

  it('rejects when the browser rejects a pattern', async () => {
    install();
    contains.mockRejectedValueOnce(new Error('Invalid pattern'));

    await expect(hasHostPermissions(['nonsense'])).rejects.toThrow('Invalid pattern');
  });
});

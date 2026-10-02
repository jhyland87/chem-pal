import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initThemeAwareToolbarIcon } from '@/utils/themeIcon';

const setIcon = vi.fn();
let changeHandler: ((event: { matches: boolean }) => void) | undefined;

/** Installs a `matchMedia` stub whose dark-scheme query reports `dark`. */
function stubMatchMedia(dark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: dark,
      addEventListener: (_type: string, handler: (event: { matches: boolean }) => void) => {
        changeHandler = handler;
      },
    })),
  );
}

/** The `path` argument of the n-th `setIcon` call. */
function iconPath(call = 0): Record<number, string> {
  return setIcon.mock.calls[call][0].path;
}

describe('initThemeAwareToolbarIcon', () => {
  const originalChrome = globalThis.chrome;

  beforeEach(() => {
    changeHandler = undefined;
    setIcon.mockReset().mockResolvedValue(undefined);
    globalThis.chrome = { ...originalChrome, action: { setIcon } } as unknown as typeof chrome;
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does nothing without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    window.matchMedia = undefined as unknown as typeof window.matchMedia;

    initThemeAwareToolbarIcon();

    expect(setIcon).not.toHaveBeenCalled();
  });

  it('does nothing without chrome.action.setIcon', () => {
    stubMatchMedia(true);
    globalThis.chrome = { ...originalChrome } as unknown as typeof chrome;

    expect(() => initThemeAwareToolbarIcon()).not.toThrow();
    expect(setIcon).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'ChemPal-logo-inverted-16.png'],
    [false, 'ChemPal-logo-16.png'],
  ])('dark=%s applies %s on startup', (dark, file) => {
    stubMatchMedia(dark);
    window.matchMedia = globalThis.matchMedia;

    initThemeAwareToolbarIcon();

    expect(setIcon).toHaveBeenCalledOnce();
    expect(iconPath()[16]).toContain(file);
    expect(Object.keys(iconPath())).toEqual(['16', '32', '48', '128']);
  });

  it('swaps the icon when the scheme changes', () => {
    stubMatchMedia(false);
    window.matchMedia = globalThis.matchMedia;
    initThemeAwareToolbarIcon();

    changeHandler?.({ matches: true });
    changeHandler?.({ matches: false });

    expect(iconPath(1)[16]).toContain('inverted');
    expect(iconPath(2)[16]).not.toContain('inverted');
  });

  it('logs rather than throws when setIcon rejects', async () => {
    stubMatchMedia(true);
    window.matchMedia = globalThis.matchMedia;
    setIcon.mockRejectedValue(new Error('nope'));

    expect(() => initThemeAwareToolbarIcon()).not.toThrow();
    await vi.waitFor(() => expect(setIcon).toHaveBeenCalled());
  });
});

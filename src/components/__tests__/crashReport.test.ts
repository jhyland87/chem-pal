import { describe, expect, it, vi } from 'vitest';

// Keep diagnostics collection self-contained — no chrome / IndexedDB in jsdom —
// while preserving the real (pure) formatErrorChain.
vi.mock('@/helpers/errorBuffer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/errorBuffer')>();
  return { ...actual, getRecentErrors: async () => [] };
});
vi.mock('@/helpers/updates', () => ({ getInstallSource: () => 'manual' }));
vi.mock('@/utils/idbCache', () => ({
  getIdbStorageBreakdown: async () => ({ byStore: {}, totalBytes: 0 }),
}));

const { showCrashReport } = await import('@/components/crashReport');

/** The current crash-overlay action buttons. */
function actionButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('.chempal-crash-actions button')];
}

describe('showCrashReport', () => {
  it('mounts a non-React overlay with both report paths, then dismisses on close', async () => {
    await showCrashReport(new Error('kaboom'), { action: 'test' });

    expect(document.querySelector('.chempal-crash-backdrop')).not.toBeNull();
    const labels = actionButtons().map((b) => b.textContent);
    expect(labels).toEqual(
      expect.arrayContaining(['Report via GitHub', 'Report via Google', 'Copy details', 'Close']),
    );
    expect(document.querySelector('.chempal-crash-card pre')?.textContent).toContain('kaboom');

    // Closing removes the overlay entirely (and resets internal state).
    actionButtons()
      .find((b) => b.textContent === 'Close')
      ?.click();
    expect(document.querySelector('.chempal-crash-backdrop')).toBeNull();
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fakePosthog } = vi.hoisted(() => ({ fakePosthog: { init: vi.fn(), captureLog: vi.fn() } }));

vi.mock('posthog-js/full/no-external', () => ({ default: fakePosthog }));

// The service worker has no `window` or `document`; the node environment mirrors that.
describe('remoteLogs without a DOM (service worker)', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    fakePosthog.init.mockReset();
    fakePosthog.captureLog.mockReset();
  });

  it('never loads posthog or registers a sink', async () => {
    expect(typeof window).toBe('undefined');
    vi.resetModules();
    const { Logger } = await import('@/utils/Logger');
    const { initRemoteLogs } = await import('@/helpers/remoteLogs');
    const analytics = await import('@/helpers/analytics');
    vi.mocked(analytics.canSendAnalytics).mockResolvedValue(true);

    await initRemoteLogs();
    new Logger('Worker').error('still console-only');

    expect(fakePosthog.init).not.toHaveBeenCalled();
    expect(fakePosthog.captureLog).not.toHaveBeenCalled();
  });
});

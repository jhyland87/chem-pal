import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playAdvancedModeSound } from '@/helpers/advancedMode';

const play = vi.fn();
const instances: Array<{ src: string; volume: number }> = [];

describe('playAdvancedModeSound', () => {
  beforeEach(() => {
    instances.length = 0;
    play.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1;
        play = play;
        constructor(public src: string) {
          instances.push(this);
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    [true, '/static/sounds/power-up.mp3'],
    [false, '/static/sounds/power-down.mp3'],
  ])('enabled=%s plays %s at half volume', async (enabled, src) => {
    await playAdvancedModeSound(enabled);

    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({ src, volume: 0.5 });
    expect(play).toHaveBeenCalledOnce();
  });

  it('swallows playback failures with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    play.mockRejectedValue(new Error('autoplay blocked'));

    await expect(playAdvancedModeSound(true)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});

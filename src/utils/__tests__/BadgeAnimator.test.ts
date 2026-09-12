import {
  resetChromeActionMock,
  restoreChromeActionMock,
  setupChromeActionMock,
} from '@/__fixtures__/helpers/chrome/actionMock';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadgeAnimator } from '../BadgeAnimator';

vi.mock('@/helpers/errorBuffer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/errorBuffer')>();
  return { ...actual, recordError: vi.fn() };
});
const { recordError } = await import('@/helpers/errorBuffer');

describe('BadgeAnimator', () => {
  let mockChromeAction: ReturnType<typeof setupChromeActionMock>;

  beforeEach(() => {
    mockChromeAction = setupChromeActionMock();
    vi.useFakeTimers();
    vi.mocked(recordError).mockClear();
  });

  afterEach(() => {
    resetChromeActionMock();
    vi.useRealTimers();
  });

  afterAll(() => {
    restoreChromeActionMock();
  });

  // Helper function to check badge text calls. BadgeAnimator always calls the
  // promise-based chrome.action.setBadgeText (no callback argument), so there's
  // only ever one call argument to check.
  const expectBadgeTextCall = (expectedText: string, callIndex: number = 0) => {
    const calls = mockChromeAction.setBadgeText.mock.calls;
    if (!calls[callIndex]) {
      throw new Error(`No call found at index ${callIndex}. Total calls: ${calls.length}`);
    }
    expect(calls[callIndex][0]).toEqual({ text: expectedText });
    expect(calls[callIndex][1]).toBeUndefined();
  };

  describe('animate', () => {
    it('should animate with custom characters', async () => {
      const chars = ['A', 'B', 'C'];
      BadgeAnimator.animate(chars, 100);

      // First clear call (no callback)
      expectBadgeTextCall('', 0);
      // First animation character
      expectBadgeTextCall('A', 1);

      // Advance timer to see next character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall('B', 2);

      // Advance timer to see next character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall('C', 3);

      // Advance timer to see wrap back to first character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall('A', 4);
    });

    it('should animate with predefined charsets', async () => {
      BadgeAnimator.animate('hourglass', 100);

      // First clear call (no callback)
      expectBadgeTextCall('', 0);
      // First animation character
      expectBadgeTextCall('⏳', 1);

      // Advance timer to see next character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall('⌛', 2);

      // Advance timer to see wrap back to first character
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall('⏳', 3);
    });

    it('should throw error for empty character array', () => {
      expect(() => BadgeAnimator.animate([])).toThrow(
        'At least one character is required for badge animation',
      );
    });

    it('should throw error for invalid charset name', () => {
      expect(() => BadgeAnimator.animate('invalid_charset' as any)).toThrow();
    });

    it('should clear existing animation when starting new one', async () => {
      // Start first animation
      BadgeAnimator.animate(['A', 'B'], 100);
      expectBadgeTextCall('', 0); // Clear call
      expectBadgeTextCall('A', 1); // First animation character

      // Start second animation
      BadgeAnimator.animate(['X', 'Y'], 100);
      expectBadgeTextCall('', 2); // Clear call
      expectBadgeTextCall('X', 3); // First animation character

      // Advance timer - should be on second animation
      await vi.advanceTimersByTimeAsync(100);
      expectBadgeTextCall('Y', 4);
    });
  });

  describe('clear', () => {
    it('should clear badge immediately when no final text provided', () => {
      BadgeAnimator.clear();
      expectBadgeTextCall('', 0);
    });

    it('should show final text and then clear after duration', async () => {
      BadgeAnimator.clear('✓', 1000);

      // Should set final text immediately
      expectBadgeTextCall('✓', 0);

      // Advance timer past duration
      await vi.advanceTimersByTimeAsync(1000);

      // Should clear after duration
      expectBadgeTextCall('', 1);
    });

    it('should stop any existing animation when clearing', async () => {
      // Start an animation
      BadgeAnimator.animate(['A', 'B'], 100);
      expectBadgeTextCall('', 0); // Clear call
      expectBadgeTextCall('A', 1); // First animation character

      // Clear it
      BadgeAnimator.clear();
      expectBadgeTextCall('', 2); // Final clear call

      // Advance timer - should not see next animation character
      await vi.advanceTimersByTimeAsync(100);
      expect(mockChromeAction.setBadgeText.mock.calls.length).toBe(3); // Only the initial clear, A, and final clear calls
    });
  });

  describe('setColor', () => {
    it('should set badge text color', () => {
      BadgeAnimator.setColor('#FFFFFF');
      expect(mockChromeAction.setBadgeTextColor).toHaveBeenCalledWith({ color: '#FFFFFF' });
    });

    it('should set badge background color', () => {
      BadgeAnimator.setColor(undefined, '#000000');
      expect(mockChromeAction.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#000000' });
    });

    it('should set both colors when both provided', () => {
      BadgeAnimator.setColor('#FFFFFF', '#000000');
      expect(mockChromeAction.setBadgeTextColor).toHaveBeenCalledWith({ color: '#FFFFFF' });
      expect(mockChromeAction.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#000000' });
    });
  });

  describe('setBadgeText failures', () => {
    it('records a chrome-api error instead of letting a rejection float unhandled', async () => {
      mockChromeAction.setBadgeText.mockRejectedValueOnce(new Error('extension context invalidated'));

      await BadgeAnimator.clear();

      expect(recordError).toHaveBeenCalledWith({
        source: 'chrome-api',
        message: 'extension context invalidated',
      });
    });
  });

  describe('setText', () => {
    it('should set badge text and clear any animation', async () => {
      // Start an animation
      BadgeAnimator.animate(['A', 'B'], 100);
      expectBadgeTextCall('', 0); // Clear call
      expectBadgeTextCall('A', 1); // First animation character

      // Set text
      BadgeAnimator.setText('Test');
      expectBadgeTextCall('', 2); // Clear call
      expectBadgeTextCall('Test', 3); // Set text call

      // Advance timer - should not see animation continue
      await vi.advanceTimersByTimeAsync(100);
      expect(mockChromeAction.setBadgeText.mock.calls.length).toBe(4); // Initial clear, A, clear, and Test calls
    });
  });

  describe('search outcome badge state', () => {
    it('ends empty after a 0-result search (animate then clear)', () => {
      BadgeAnimator.animate('ellipsis', 300);
      BadgeAnimator.clear();
      expect(mockChromeAction._state.badgeText).toBe('');
    });

    it('ends empty after an aborted search (animate then clear)', () => {
      BadgeAnimator.animate('ellipsis', 300);
      BadgeAnimator.clear();
      expect(mockChromeAction._state.badgeText).toBe('');
    });

    it('shows the count when results exist (animate then setText)', () => {
      BadgeAnimator.animate('ellipsis', 300);
      BadgeAnimator.setText('5');
      expect(mockChromeAction._state.badgeText).toBe('5');
    });

    it("stops animating once cleared so the badge can't get stuck on an ellipsis", async () => {
      BadgeAnimator.animate('ellipsis', 300);
      BadgeAnimator.clear();
      const callsAfterClear = mockChromeAction.setBadgeText.mock.calls.length;

      await vi.advanceTimersByTimeAsync(900);

      expect(mockChromeAction.setBadgeText.mock.calls.length).toBe(callsAfterClear);
      expect(mockChromeAction._state.badgeText).toBe('');
    });
  });

  describe('charsets', () => {
    it.each(['hourglass', 'ellipsis', 'clock', 'arch', 'ball_wave'])(
      'has the %s charset available',
      (name) => {
        expect(BadgeAnimator.charsets).toHaveProperty(name);
      },
    );

    it.each(Object.entries(BadgeAnimator.charsets))('%s is a non-empty array', (_name, charset) => {
      expect(Array.isArray(charset)).toBe(true);
      expect(charset.length).toBeGreaterThan(0);
    });
  });
});

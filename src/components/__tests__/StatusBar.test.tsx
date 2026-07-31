import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StatusBar, { StatusBarProvider, useStatusBar } from '../StatusBar';

/**
 * Test harness exposing the status-bar setters as buttons so tests can drive the
 * provider through real React state updates rather than calling the hook raw.
 * @returns Buttons that set sticky and flash messages alongside the StatusBar.
 */
function Harness({ flashDuration }: { flashDuration?: number }) {
  const { setStatusText, flashStatusText } = useStatusBar();
  return (
    <>
      <button onClick={() => setStatusText('sticky message')}>set</button>
      <button onClick={() => setStatusText(null)}>clear</button>
      <button onClick={() => flashStatusText('flash message', flashDuration)}>flash</button>
      <StatusBar />
    </>
  );
}

describe('StatusBar', () => {
  describe('rendering', () => {
    it('renders nothing when there is no status text', () => {
      const { container } = render(
        <StatusBarProvider>
          <StatusBar />
        </StatusBarProvider>,
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('shows the sticky message set via setStatusText', () => {
      render(
        <StatusBarProvider>
          <Harness />
        </StatusBarProvider>,
      );

      fireEvent.click(screen.getByText('set'));

      expect(screen.getByText('sticky message')).toBeInTheDocument();
    });

    it('clears the message when setStatusText is called with null', () => {
      render(
        <StatusBarProvider>
          <Harness />
        </StatusBarProvider>,
      );

      fireEvent.click(screen.getByText('set'));
      expect(screen.getByText('sticky message')).toBeInTheDocument();

      fireEvent.click(screen.getByText('clear'));
      expect(screen.queryByText('sticky message')).not.toBeInTheDocument();
    });
  });

  describe('flashStatusText', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('shows a flashed message and auto-clears after the default duration', () => {
      render(
        <StatusBarProvider>
          <Harness />
        </StatusBarProvider>,
      );

      fireEvent.click(screen.getByText('flash'));
      expect(screen.getByText('flash message')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText('flash message')).not.toBeInTheDocument();
    });

    it('respects a custom duration', () => {
      render(
        <StatusBarProvider>
          <Harness flashDuration={2500} />
        </StatusBarProvider>,
      );

      fireEvent.click(screen.getByText('flash'));

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('flash message')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.queryByText('flash message')).not.toBeInTheDocument();
    });

    it('resets the timer when flashed again before it expires', () => {
      render(
        <StatusBarProvider>
          <Harness flashDuration={1000} />
        </StatusBarProvider>,
      );

      fireEvent.click(screen.getByText('flash'));
      act(() => {
        vi.advanceTimersByTime(800);
      });

      // Re-flash before the first timer fires; the message should persist past
      // the original deadline and only clear 1000ms after the second flash.
      fireEvent.click(screen.getByText('flash'));
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(screen.getByText('flash message')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('flash message')).not.toBeInTheDocument();
    });
  });

  describe('useStatusBar default context', () => {
    it('provides no-op setters when used without a provider', () => {
      // Rendering StatusBar with no provider exercises the default context value.
      const { container } = render(<StatusBar />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});

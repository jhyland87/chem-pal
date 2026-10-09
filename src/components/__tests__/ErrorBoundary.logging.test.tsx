import { Logger } from '@/utils/Logger';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Keep diagnostics collection self-contained: no chrome or IndexedDB in jsdom.
vi.mock('@/helpers/errorBuffer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/errorBuffer')>();
  return { ...actual, recordError: async () => {}, installErrorCapture: () => {} };
});

const { default: ErrorBoundary } = await import('../ErrorBoundary');

/** A child that throws on render, to trip the boundary. */
function Boom(): never {
  throw new Error('kaboom');
}

// Both app-level boundaries wrap the whole UI and replace it with a one-line message, so a crash
// that reaches one is fatal for that page.
describe('ErrorBoundary crash logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a render crash as fatal, with the cause and component stack', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fatal = vi.spyOn(Logger.prototype, 'fatal').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback')).toBeInTheDocument();
    expect(fatal).toHaveBeenCalledWith(
      'Component render error: kaboom',
      expect.objectContaining({
        error: expect.any(Error),
        componentStack: expect.stringContaining('Boom'),
      }),
    );
    expect(error).not.toHaveBeenCalled();
  });

  describe('report button', () => {
    /** Renders a crashed boundary and returns its report button. */
    function crashedButton() {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(Logger.prototype, 'fatal').mockImplementation(() => undefined);
      render(
        <ErrorBoundary fallback={<p>fallback</p>}>
          <Boom />
        </ErrorBoundary>,
      );
      return screen.getByTestId('error-boundary-report');
    }

    it('is styled by a stylesheet class, not an inline style attribute', () => {
      const button = crashedButton();

      expect(button).not.toHaveAttribute('style');
      expect(button.className).not.toBe('');
    });

    it('renders as a centred, outlined, transparent block button without a ThemeProvider', () => {
      const style = getComputedStyle(crashedButton());

      expect(style.display).toBe('block');
      expect(style.cursor).toBe('pointer');
      expect(style.background).toContain('transparent');
      expect(style.border).toContain('1px solid');
      expect(style.margin).toContain('auto');
      expect(style.padding).toBe('6px 14px');
    });
  });
});

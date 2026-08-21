import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

// Crashes are reported to PostHog. Mocked so the boundary's reporting call is
// observable, and so these tests never exercise the real sender.
const { trackRenderError } = vi.hoisted(() => ({ trackRenderError: vi.fn() }));
vi.mock('@/helpers/analytics', () => ({ trackRenderError }));

/** A child that throws on render, to trip the boundary. */
function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    trackRenderError.mockReset();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <span>child content</span>
      </ErrorBoundary>,
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
    expect(trackRenderError).not.toHaveBeenCalled();
  });

  it('renders the fallback and logs when a child throws', () => {
    // React routes the thrown render error through console.error; the global
    // setup already stubs console, but spy so we can assert it was called.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
    // The fallback also offers a way to report the crash.
    expect(screen.getByTestId('error-boundary-report')).toBeInTheDocument();
  });

  it('reports the caught crash to analytics', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(trackRenderError).toHaveBeenCalledTimes(1);
    expect(trackRenderError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((trackRenderError.mock.calls[0][0] as Error).message).toBe('boom');
  });
});

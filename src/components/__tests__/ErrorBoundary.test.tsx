import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

/** A child that throws on render, to trip the boundary. */
function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <span>child content</span>
      </ErrorBoundary>,
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
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
  });
});

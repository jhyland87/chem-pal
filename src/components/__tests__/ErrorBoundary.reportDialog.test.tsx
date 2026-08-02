import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Keep diagnostics collection self-contained — no chrome / IndexedDB in jsdom —
// while preserving the real (pure) formatErrorChain.
vi.mock('@/helpers/errorBuffer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/errorBuffer')>();
  return {
    ...actual,
    getRecentErrors: async () => [],
    recordError: async () => {},
    installErrorCapture: () => {},
  };
});
vi.mock('@/helpers/updates', () => ({ getInstallSource: () => 'manual' }));
vi.mock('@/utils/idbCache', () => ({
  getIdbStorageBreakdown: async () => ({ byStore: {}, totalBytes: 0 }),
}));

const { default: ErrorBoundary } = await import('../ErrorBoundary');

/** A child that throws on render, to trip the boundary. */
function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary → report dialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the report dialog when the user reports a caught render error', async () => {
    // React routes the thrown render error through console.error; silence it.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    // The boundary caught the crash and shows a way to report it.
    const reportButton = screen.getByTestId('error-boundary-report');
    expect(reportButton).toBeInTheDocument();

    fireEvent.click(reportButton);

    // The dialog mounts asynchronously (diagnostics are collected first). It is
    // rendered into its own React root appended to document.body.
    expect(await screen.findByText('Report this error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report via GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report via Google' })).toBeInTheDocument();
  });
});

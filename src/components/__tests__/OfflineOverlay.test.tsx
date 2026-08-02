import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OfflineOverlay from '../OfflineOverlay';

describe('OfflineOverlay', () => {
  it('is hidden while online and covers the UI on the offline event', () => {
    render(<OfflineOverlay />);
    expect(screen.queryByText(/network connection issue/i)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/network connection issue/i)).toBeInTheDocument();

    // Defaults to the light-theme dino with no ThemeProvider in scope.
    expect(screen.getByTestId('offline-dino')).toHaveAttribute(
      'src',
      expect.stringContaining('dino-light-theme'),
    );

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/network connection issue/i)).not.toBeInTheDocument();
  });
});

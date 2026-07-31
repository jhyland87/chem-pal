import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../../themes';

let mockContext: {
  userSettings: { fontSize?: string; theme?: string };
  setUserSettings: ReturnType<typeof vi.fn>;
};

vi.mock('@/context', () => ({ useAppContext: () => mockContext }));

import { ThemeProvider } from '../ThemeProvider';

/** A consumer that surfaces the theme context so tests can assert on it. */
function ThemeProbe() {
  const { mode, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

/** Installs a fresh app-context mock with the given settings. */
function setContext(userSettings: { fontSize?: string; theme?: string } = {}) {
  mockContext = { userSettings, setUserSettings: vi.fn() };
  return mockContext;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    setContext({});
    document.documentElement.style.fontSize = '';
  });

  it('renders its children', () => {
    render(
      <ThemeProvider>
        <span>app tree</span>
      </ThemeProvider>,
    );

    expect(screen.getByText('app tree')).toBeInTheDocument();
  });

  it.each([
    { fontSize: 'small', px: '14px' },
    { fontSize: 'medium', px: '16px' },
    { fontSize: 'large', px: '18px' },
  ])('sets the root font-size to $px for $fontSize', ({ fontSize, px }) => {
    setContext({ fontSize });
    render(
      <ThemeProvider>
        <span>x</span>
      </ThemeProvider>,
    );

    expect(document.documentElement.style.fontSize).toBe(px);
  });

  it('falls back to the medium font-size when unset', () => {
    setContext({});
    render(
      <ThemeProvider>
        <span>x</span>
      </ThemeProvider>,
    );

    expect(document.documentElement.style.fontSize).toBe('16px');
  });

  it('exposes light mode by default and dark mode when settings say so', () => {
    setContext({ theme: 'dark' });
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it('toggleTheme flips the persisted theme setting', () => {
    const ctx = setContext({ theme: 'light' });
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText('toggle'));

    expect(ctx.setUserSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });
});

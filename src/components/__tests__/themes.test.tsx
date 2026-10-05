import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  darkTheme,
  designTokens,
  getBorderRadius,
  getBoxShadow,
  getDrawerWidth,
  getTransition,
  lightPalette,
  ThemeContext,
  useTheme,
  type ThemeContextType,
} from '../../themes';

describe('useTheme', () => {
  it('throws when used outside a ThemeProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider',
    );
    errorSpy.mockRestore();
  });

  it('returns the context value inside a provider', () => {
    const value: ThemeContextType = {
      mode: 'dark',
      toggleTheme: vi.fn(),
      currentTheme: darkTheme,
      currentPalette: lightPalette,
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ThemeContext.Provider, { value }, children);

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current).toBe(value);
  });
});

describe('getBoxShadow', () => {
  it.each(Object.entries(designTokens.shadows))(
    'returns the %s shadow token',
    (elevation, shadow) => {
      expect(getBoxShadow(elevation as keyof typeof designTokens.shadows)).toBe(shadow);
    },
  );

  it('defaults to medium', () => {
    expect(getBoxShadow()).toBe(designTokens.shadows.medium);
  });
});

describe('getTransition', () => {
  it.each(Object.entries(designTokens.transitions))('uses the %s duration', (duration, ms) => {
    expect(getTransition('opacity', duration as keyof typeof designTokens.transitions)).toBe(
      `opacity ${ms} cubic-bezier(0.4, 0, 0.2, 1)`,
    );
  });

  it('defaults to "all" at the standard duration', () => {
    expect(getTransition()).toBe(
      `all ${designTokens.transitions.standard} cubic-bezier(0.4, 0, 0.2, 1)`,
    );
  });
});

describe('getBorderRadius', () => {
  it.each(Object.entries(designTokens.borderRadius))('returns %s as a px string', (size, px) => {
    expect(getBorderRadius(size as keyof typeof designTokens.borderRadius)).toBe(`${px}px`);
  });

  it('defaults to medium', () => {
    expect(getBorderRadius()).toBe(`${designTokens.borderRadius.medium}px`);
  });
});

describe('getDrawerWidth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the wider dev width outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(getDrawerWidth()).toBe(designTokens.spacing.drawerWidthDev);
  });

  it('returns the standard width in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getDrawerWidth()).toBe(designTokens.spacing.drawerWidth);
  });
});

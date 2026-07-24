import { describe, it } from 'vitest';
import {
  darkTheme,
  drawerWidth,
  getBorderRadius,
  getBoxShadow,
  getContrastText,
  getSupplierColor,
  getTransition,
  hexToRgba,
  lightTheme,
  searchMaxWidth,
  SUPPLIER_COLORS,
} from '../colors';

describe.concurrent('theme/colors constants', () => {
  it('exposes the light theme palette', ({ expect }) => {
    expect(lightTheme.text).toBe('#29303b');
    expect(lightTheme.primaryInterface).toBe('#ffffff');
    expect(lightTheme.paperBackground).toBe('#f3f7fa');
    expect(lightTheme.notificationBg).toBe('#4d7df2');
    expect(lightTheme.shadow).toBe('0 2px 8px rgba(0, 0, 0, 0.1)');
    expect(lightTheme.lightGray).toBe('#f5f5f5');
    expect(lightTheme.borderLight).toBe('#e0e0e0');
  });

  it('exposes the dark theme palette', ({ expect }) => {
    expect(darkTheme.drawerBackground).toBe('#272e3d');
    expect(darkTheme.expandedBackground).toBe('#19222b');
    expect(darkTheme.activeBackground).toBe('#515864');
    expect(darkTheme.borders).toBe('#1e1e1ef2');
    expect(darkTheme.text).toBe('#ffffff');
    expect(darkTheme.hoverBackground).toBe('#3a4250');
    expect(darkTheme.shadow).toBe('0 4px 12px rgba(0, 0, 0, 0.3)');
  });

  it('exposes layout dimension constants', ({ expect }) => {
    expect(drawerWidth).toBe(400);
    expect(searchMaxWidth).toBe(600);
  });
});

describe.concurrent('getBoxShadow', () => {
  it('defaults to the medium elevation', ({ expect }) => {
    expect(getBoxShadow()).toBe('0 2px 8px rgba(0, 0, 0, 0.1)');
  });

  it('returns the low elevation shadow', ({ expect }) => {
    expect(getBoxShadow('low')).toBe('0 1px 4px rgba(0, 0, 0, 0.08)');
  });

  it('returns the medium elevation shadow', ({ expect }) => {
    expect(getBoxShadow('medium')).toBe('0 2px 8px rgba(0, 0, 0, 0.1)');
  });

  it('returns the high elevation shadow', ({ expect }) => {
    expect(getBoxShadow('high')).toBe('0 4px 16px rgba(0, 0, 0, 0.15)');
  });
});

describe.concurrent('getBorderRadius', () => {
  it('defaults to the medium size', ({ expect }) => {
    expect(getBorderRadius()).toBe('8px');
  });

  it('returns the small radius', ({ expect }) => {
    expect(getBorderRadius('small')).toBe('4px');
  });

  it('returns the medium radius', ({ expect }) => {
    expect(getBorderRadius('medium')).toBe('8px');
  });

  it('returns the large radius', ({ expect }) => {
    expect(getBorderRadius('large')).toBe('12px');
  });
});

describe.concurrent('getTransition', () => {
  it('uses the default property and duration', ({ expect }) => {
    expect(getTransition()).toBe('all 0.3s cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('honours a custom property', ({ expect }) => {
    expect(getTransition('opacity')).toBe('opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('honours a custom property and duration', ({ expect }) => {
    expect(getTransition('transform', '0.5s')).toBe('transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)');
  });
});

describe.concurrent('SUPPLIER_COLORS', () => {
  it.for([...SUPPLIER_COLORS])('%s is a 6-digit hex color', (color, { expect }) => {
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('has no duplicate colors', ({ expect }) => {
    expect(new Set(SUPPLIER_COLORS).size).toBe(SUPPLIER_COLORS.length);
  });
});

describe.concurrent('getSupplierColor', () => {
  it('always returns a color from the palette', ({ expect }) => {
    expect(SUPPLIER_COLORS).toContain(getSupplierColor('SupplierAmbeed'));
  });

  it('is deterministic for the same key', ({ expect }) => {
    expect(getSupplierColor('SupplierAmbeed')).toBe(getSupplierColor('SupplierAmbeed'));
  });

  it('maps different keys to (at least some) different colors', ({ expect }) => {
    const keys = ['SupplierA', 'SupplierB', 'SupplierC', 'SupplierD', 'SupplierE'];
    const colors = new Set(keys.map(getSupplierColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('handles the empty string without throwing', ({ expect }) => {
    expect(SUPPLIER_COLORS).toContain(getSupplierColor(''));
  });
});

describe.concurrent('getContrastText', () => {
  it('returns black text on a light background', ({ expect }) => {
    expect(getContrastText('#f0e68c')).toBe('#000000');
  });

  it('returns white text on a dark background', ({ expect }) => {
    expect(getContrastText('#5c6bc0')).toBe('#ffffff');
  });

  it('expands and evaluates 3-digit hex colors', ({ expect }) => {
    expect(getContrastText('#fff')).toBe('#000000');
    expect(getContrastText('#000')).toBe('#ffffff');
  });

  it('falls back to black for non-hex backgrounds', ({ expect }) => {
    expect(getContrastText('currentColor')).toBe('#000000');
  });
});

describe.concurrent('hexToRgba', () => {
  it('converts a 6-digit hex color to rgba', ({ expect }) => {
    expect(hexToRgba('#4db6ac', 0.5)).toBe('rgba(77, 182, 172, 0.5)');
  });

  it('expands 3-digit hex colors', ({ expect }) => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('returns the input unchanged for non-hex values', ({ expect }) => {
    expect(hexToRgba('currentColor', 0.5)).toBe('currentColor');
  });
});

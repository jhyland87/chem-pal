import { describe, expect, it } from 'vitest';
import { HotkeyEvent } from '../events';

describe('HotkeyEvent enum', () => {
  it('exposes the focus-global-filter event name', () => {
    expect(HotkeyEvent.FOCUS_GLOBAL_FILTER).toBe('chempal:focus-global-filter');
  });

  it('exposes the toggle-column-filters event name', () => {
    expect(HotkeyEvent.TOGGLE_COLUMN_FILTERS).toBe('chempal:toggle-column-filters');
  });

  it('exposes the abort-search event name', () => {
    expect(HotkeyEvent.ABORT_SEARCH).toBe('chempal:abort-search');
  });

  it('uses a unique name per event', () => {
    const names = Object.values(HotkeyEvent);
    expect(new Set(names).size).toBe(names.length);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import {
  formatBinding,
  formatBindingTokens,
  formatSequenceTokens,
  isMac,
  matches,
  normalizeKey,
  parseBinding,
  parseSequence,
  resolveBinding,
} from '../matcher';

// jsdom exposes a writable-ish navigator; redefine platform / userAgentData to
// drive the isMac() branch. Restore after each test.
function setPlatform(platform: string | undefined, uaPlatform?: string): void {
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: platform ?? '',
  });
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    value: uaPlatform === undefined ? undefined : { platform: uaPlatform },
  });
}

afterEach(() => {
  setPlatform('');
});

function makeEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('isMac', () => {
  it('returns false on a non-mac platform string', () => {
    setPlatform('Win32');
    expect(isMac()).toBe(false);
  });

  it("returns true when navigator.platform contains 'Mac'", () => {
    setPlatform('MacIntel');
    expect(isMac()).toBe(true);
  });

  it('prefers userAgentData.platform when available', () => {
    setPlatform('Win32', 'macOS');
    expect(isMac()).toBe(true);
  });

  it('falls back to navigator.platform when userAgentData has no platform', () => {
    setPlatform('MacIntel', undefined);
    expect(isMac()).toBe(true);
  });
});

describe('resolveBinding', () => {
  it('passes through a plain string binding', () => {
    expect(resolveBinding('mod+s')).toBe('mod+s');
  });

  it('selects the mac branch on macOS', () => {
    setPlatform('MacIntel');
    expect(resolveBinding({ mac: 'meta+s', other: 'ctrl+shift+s' })).toBe('meta+s');
  });

  it('selects the other branch off macOS', () => {
    setPlatform('Win32');
    expect(resolveBinding({ mac: 'meta+s', other: 'ctrl+shift+s' })).toBe('ctrl+shift+s');
  });
});

describe('parseBinding', () => {
  it('parses a single key with no modifiers', () => {
    expect(parseBinding('r')).toEqual({
      meta: false,
      ctrl: false,
      alt: false,
      shift: false,
      key: 'r',
    });
  });

  it('is case-insensitive on modifier and key tokens', () => {
    expect(parseBinding('SHIFT+R')).toEqual({
      meta: false,
      ctrl: false,
      alt: false,
      shift: true,
      key: 'r',
    });
  });

  it("expands 'mod' to ctrl off macOS", () => {
    setPlatform('Win32');
    expect(parseBinding('mod+shift+r')).toEqual({
      meta: false,
      ctrl: true,
      alt: false,
      shift: true,
      key: 'r',
    });
  });

  it("expands 'mod' to meta on macOS", () => {
    setPlatform('MacIntel');
    expect(parseBinding('mod+shift+r')).toEqual({
      meta: true,
      ctrl: false,
      alt: false,
      shift: true,
      key: 'r',
    });
  });

  it('resolves all modifier aliases', () => {
    setPlatform('Win32');
    const parsed = parseBinding('cmd+command+control+option+alt+shift+k');
    expect(parsed.meta).toBe(true);
    expect(parsed.ctrl).toBe(true);
    expect(parsed.alt).toBe(true);
    expect(parsed.shift).toBe(true);
    expect(parsed.key).toBe('k');
  });

  it('ignores unknown modifier tokens', () => {
    const parsed = parseBinding('bogus+s');
    expect(parsed).toEqual({
      meta: false,
      ctrl: false,
      alt: false,
      shift: false,
      key: 's',
    });
  });

  it('trims whitespace and drops empty tokens', () => {
    expect(parseBinding('  shift + + r  ')).toEqual({
      meta: false,
      ctrl: false,
      alt: false,
      shift: true,
      key: 'r',
    });
  });

  it('yields an empty key for an empty binding', () => {
    expect(parseBinding('').key).toBe('');
  });
});

describe('matches', () => {
  it('matches a bare key with no modifiers held', () => {
    const b = parseBinding('r');
    expect(matches(makeEvent({ key: 'r' }), b)).toBe(true);
  });

  it('is case-insensitive on the event key', () => {
    const b = parseBinding('r');
    expect(matches(makeEvent({ key: 'R', shiftKey: false }), b)).toBe(true);
  });

  it('rejects when a required modifier is not held', () => {
    setPlatform('Win32');
    const b = parseBinding('ctrl+s');
    expect(matches(makeEvent({ key: 's' }), b)).toBe(false);
  });

  it('matches when the required modifier is held', () => {
    setPlatform('Win32');
    const b = parseBinding('ctrl+s');
    expect(matches(makeEvent({ key: 's', ctrlKey: true }), b)).toBe(true);
  });

  it('is strict: ctrl+s does not fire on ctrl+shift+s', () => {
    setPlatform('Win32');
    const b = parseBinding('ctrl+s');
    expect(matches(makeEvent({ key: 's', ctrlKey: true, shiftKey: true }), b)).toBe(false);
  });

  it('rejects on meta mismatch', () => {
    const b = parseBinding('s');
    expect(matches(makeEvent({ key: 's', metaKey: true }), b)).toBe(false);
  });

  it('rejects on alt mismatch', () => {
    const b = parseBinding('s');
    expect(matches(makeEvent({ key: 's', altKey: true }), b)).toBe(false);
  });

  it('rejects when the key differs', () => {
    const b = parseBinding('r');
    expect(matches(makeEvent({ key: 's' }), b)).toBe(false);
  });

  it("does not require the shift flag for '?' bindings", () => {
    const b = parseBinding('shift+?');
    // '?' arrives as event.key "?" with shiftKey true; binding.shift is true here
    // but the special-case skips the strict shift check entirely.
    expect(matches(makeEvent({ key: '?', shiftKey: true }), b)).toBe(true);
    expect(matches(makeEvent({ key: '?', shiftKey: false }), b)).toBe(true);
  });

  it('matches an arrow-key binding via normalization (up -> ArrowUp)', () => {
    setPlatform('Win32');
    const b = parseBinding('ctrl+shift+up');
    expect(matches(makeEvent({ key: 'ArrowUp', ctrlKey: true, shiftKey: true }), b)).toBe(true);
  });
});

describe('normalizeKey', () => {
  it('maps arrow aliases to their event.key values', () => {
    expect(normalizeKey('UpArrow')).toBe('arrowup');
    expect(normalizeKey('up')).toBe('arrowup');
    expect(normalizeKey('Down')).toBe('arrowdown');
    expect(normalizeKey('left')).toBe('arrowleft');
    expect(normalizeKey('right')).toBe('arrowright');
  });

  it('maps esc / return / space aliases', () => {
    expect(normalizeKey('Esc')).toBe('escape');
    expect(normalizeKey('Return')).toBe('enter');
    expect(normalizeKey('Space')).toBe(' ');
  });

  it('lowercases and passes through unknown tokens', () => {
    expect(normalizeKey('A')).toBe('a');
    expect(normalizeKey(' Enter ')).toBe('enter');
  });
});

describe('parseSequence', () => {
  it('splits and normalizes a konami sequence', () => {
    expect(parseSequence('up+up+down+down+left+right')).toEqual([
      'arrowup',
      'arrowup',
      'arrowdown',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ]);
  });

  it('trims whitespace and drops empty tokens', () => {
    expect(parseSequence('  a + + b ')).toEqual(['a', 'b']);
  });
});

describe('formatSequenceTokens', () => {
  it('renders arrow keys as symbols', () => {
    expect(formatSequenceTokens('up+up+down+down+left+right')).toEqual([
      '↑',
      '↑',
      '↓',
      '↓',
      '←',
      '→',
    ]);
  });

  it('title-cases named keys and uppercases single characters', () => {
    expect(formatSequenceTokens('a+enter')).toEqual(['A', 'Enter']);
  });
});

describe('formatBindingTokens', () => {
  it('formats with mac symbols on macOS', () => {
    setPlatform('MacIntel');
    expect(formatBindingTokens('mod+shift+r')).toEqual(['⌘', '⇧', 'R']);
  });

  it('formats with spelled-out names off macOS', () => {
    setPlatform('Win32');
    expect(formatBindingTokens('mod+shift+r')).toEqual(['Ctrl', 'Shift', 'R']);
  });

  it('maps every mac modifier alias to a symbol', () => {
    setPlatform('MacIntel');
    expect(formatBindingTokens('meta+cmd+command+ctrl+control+alt+option+shift+k')).toEqual([
      '⌘',
      '⌘',
      '⌘',
      '⌃',
      '⌃',
      '⌥',
      '⌥',
      '⇧',
      'K',
    ]);
  });

  it('maps every non-mac modifier alias to a name', () => {
    setPlatform('Win32');
    expect(formatBindingTokens('meta+cmd+command+ctrl+control+alt+option+shift+k')).toEqual([
      'Meta',
      'Cmd',
      'Cmd',
      'Ctrl',
      'Ctrl',
      'Alt',
      'Alt',
      'Shift',
      'K',
    ]);
  });

  it('uppercases a single-character key', () => {
    setPlatform('Win32');
    expect(formatBindingTokens('a')).toEqual(['A']);
  });

  it('capitalizes a multi-character key', () => {
    setPlatform('Win32');
    expect(formatBindingTokens('enter')).toEqual(['Enter']);
  });

  it('passes unknown modifier tokens through unchanged', () => {
    setPlatform('Win32');
    expect(formatBindingTokens('bogus+r')).toEqual(['bogus', 'R']);
  });

  it('resolves a platform-aware binding before formatting', () => {
    setPlatform('Win32');
    expect(formatBindingTokens({ mac: 'meta+s', other: 'ctrl+shift+s' })).toEqual([
      'Ctrl',
      'Shift',
      'S',
    ]);
  });

  it("preserves the special '?' key symbol", () => {
    setPlatform('MacIntel');
    expect(formatBindingTokens('shift+?')).toEqual(['⇧', '?']);
  });

  it('renders an arrow key as its symbol', () => {
    setPlatform('Win32');
    expect(formatBindingTokens('mod+shift+up')).toEqual(['Ctrl', 'Shift', '↑']);
  });
});

describe('formatBinding', () => {
  it('joins tokens with no separator on macOS', () => {
    setPlatform('MacIntel');
    expect(formatBinding('mod+shift+r')).toBe('⌘⇧R');
  });

  it("joins tokens with '+' off macOS", () => {
    setPlatform('Win32');
    expect(formatBinding('mod+shift+r')).toBe('Ctrl+Shift+R');
  });
});

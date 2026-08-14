import { render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable controls shared with the hoisted vi.mock factories below. vi.hoisted
// runs before the mock factories, so they can safely close over these.
const control = vi.hoisted(() => ({
  // Latest `handlers` object OptionsApp passed to useHotkeys, captured each render
  // so a test can invoke `handlers.konami()` directly instead of faking a key
  // sequence.
  hotkeyHandlers: null as { konami: () => void } | null,
  // Toggles the stubbed SettingsPanel into throwing, to exercise the ErrorBoundary.
  panelShouldThrow: false,
  // What the mocked useUserSettings returns; reset per test.
  userSettings: {} as UserSettings,
  setUserSettings: vi.fn(),
}));

const spies = vi.hoisted(() => ({
  useDebugApi: vi.fn(),
  playAdvancedModeSound: vi.fn().mockResolvedValue(undefined),
}));

// useHotkeys → capture the handlers; never install a real key listener.
vi.mock('@/hotkeys', () => ({
  useHotkeys: (handlers: { konami: () => void }) => {
    control.hotkeyHandlers = handlers;
  },
}));

// useUserSettings → controllable settings + spy setter.
vi.mock('@/hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    userSettings: control.userSettings,
    setUserSettings: control.setUserSettings,
  }),
}));

// useDebugApi → spy so we can assert it receives the current advancedMode.
vi.mock('@/hooks/useDebugApi', () => ({ useDebugApi: spies.useDebugApi }));

// playAdvancedModeSound → spy (jsdom has no HTMLMediaElement.play).
vi.mock('@/helpers/advancedMode', () => ({ playAdvancedModeSound: spies.playAdvancedModeSound }));

// Stub SettingsPanel with a marker that reads the REAL AppContext (we do not mock
// @/context), so tests can assert what OptionsApp put into the provider.
vi.mock('@/components/SettingsPanel', async () => {
  const React = await import('react');
  const { useAppContext } = await import('@/context');
  return {
    default: function SettingsPanelMock() {
      const ctx = useAppContext();
      if (control.panelShouldThrow) throw new Error('panel boom');
      return React.createElement('div', {
        'data-testid': 'settings-marker',
        'data-advanced': String(ctx.advancedMode),
        'data-currency': ctx.userSettings.currency ?? '',
      });
    },
  };
});

import { OptionsApp } from '../../OptionsApp';

/** A baseline userSettings object; individual tests override fields as needed. */
function baseSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    currency: 'USD',
    location: 'US',
    language: 'en',
    caching: { enabled: true },
    display: { fontSize: 'medium' },
    suppliers: { disabled: [] },
    ...overrides,
  } as UserSettings;
}

/** The stubbed SettingsPanel marker element (throws if not rendered). */
function marker(): HTMLElement {
  return screen.getByTestId('settings-marker');
}

describe('OptionsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    control.hotkeyHandlers = null;
    control.panelShouldThrow = false;
    control.userSettings = baseSettings();
    control.setUserSettings = vi.fn();
  });

  it('renders the options page (SettingsPanel inside the provider tree)', () => {
    render(<OptionsApp />);

    expect(marker()).toBeInTheDocument();
  });

  it('flows userSettings from useUserSettings into the app context', () => {
    control.userSettings = baseSettings({ currency: 'EUR' });
    render(<OptionsApp />);

    expect(marker()).toHaveAttribute('data-currency', 'EUR');
  });

  it('starts with advanced mode off and passes that to useDebugApi', () => {
    render(<OptionsApp />);

    expect(marker()).toHaveAttribute('data-advanced', 'false');
    expect(spies.useDebugApi).toHaveBeenLastCalledWith(false);
  });

  it('installs a konami handler through useHotkeys', () => {
    render(<OptionsApp />);

    expect(control.hotkeyHandlers).not.toBeNull();
    expect(control.hotkeyHandlers?.konami).toBeTypeOf('function');
  });

  it('toggles advanced mode on and off via the konami hotkey', () => {
    render(<OptionsApp />);

    // On: advancedMode flips true, the power-up chime plays, and the debug API
    // is re-enabled. (Steps are order-dependent, so a native sequence, not a table.)
    act(() => control.hotkeyHandlers?.konami());
    expect(marker()).toHaveAttribute('data-advanced', 'true');
    expect(spies.playAdvancedModeSound).toHaveBeenLastCalledWith(true);
    expect(spies.useDebugApi).toHaveBeenLastCalledWith(true);

    // Off: flips back, power-down chime, debug API disabled.
    act(() => control.hotkeyHandlers?.konami());
    expect(marker()).toHaveAttribute('data-advanced', 'false');
    expect(spies.playAdvancedModeSound).toHaveBeenLastCalledWith(false);
    expect(spies.useDebugApi).toHaveBeenLastCalledWith(false);
  });

  it('shows the ErrorBoundary fallback when the panel throws', () => {
    control.panelShouldThrow = true;
    render(<OptionsApp />);

    // The panel is gone; the boundary's fallback + report button render instead.
    expect(screen.queryByTestId('settings-marker')).not.toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-report')).toBeInTheDocument();
  });

  it('mounts the OfflineOverlay, shown when the browser is offline', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    try {
      render(<OptionsApp />);
      expect(screen.getByTestId('offline-dino')).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(navigator, 'onLine', original);
    }
  });
});

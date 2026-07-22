import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the icon barrel to avoid ENFILE from the full @mui/icons-material import.
vi.mock('@mui/icons-material/Delete', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/ExpandMore', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/TextDecrease', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/TextFormat', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/TextIncrease', () => ({ default: () => <span /> }));

// i18n returns the key so assertions can target stable identifiers.
vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string) => key,
  getAvailableLocales: () => ['en'],
}));

vi.mock('@/suppliers/SupplierFactory', () => ({
  SupplierFactory: { supplierList: () => [] },
}));

let advancedMode = false;
vi.mock('@/components/SearchPanel/hooks/useContext', () => ({
  useAppContext: () => ({
    userSettings: {},
    setUserSettings: vi.fn(),
    advancedMode,
    setAdvancedMode: vi.fn(),
  }),
}));

import SettingsPanel from '../SettingsPanel';

/** Opens the Advanced accordion so its contents are mounted. */
function renderAdvanced() {
  render(<SettingsPanel />);
  screen.getByText('settings_section_advanced').click();
}

describe('SettingsPanel advanced mode gating', () => {
  beforeEach(() => {
    advancedMode = false;
    vi.clearAllMocks();
  });

  it('hides the fuzz controls but keeps max search time when advanced mode is off', () => {
    renderAdvanced();

    expect(screen.queryByLabelText('settings_fuzz_scorer')).toBeNull();
    expect(screen.queryByText('settings_disable_fuzzy')).toBeNull();
    // The non-developer setting in the same section stays visible.
    expect(screen.getByLabelText('settings_max_search_time')).toBeTruthy();
  });

  it('reveals both fuzz controls when advanced mode is on', () => {
    advancedMode = true;
    renderAdvanced();

    expect(screen.getByLabelText('settings_fuzz_scorer')).toBeTruthy();
    expect(screen.getByText('settings_disable_fuzzy')).toBeTruthy();
    expect(screen.getByLabelText('settings_max_search_time')).toBeTruthy();
  });
});

import { useContext } from 'react';
import { SettingsContext } from './SettingsContext';
import type { UserSettings, SettingsContextType } from './Settings.types';

// Custom hook to use the settings context
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Helper hooks for specific settings
export const useThemePreference = () => {
  const { settings, updateSetting } = useSettings();
  return {
    theme: settings.theme,
    setTheme: (theme: UserSettings['theme']) => updateSetting('theme', theme),
  };
};

export const useLanguage = () => {
  const { settings, updateSetting } = useSettings();
  return {
    language: settings.language,
    setLanguage: (language: string) => updateSetting('language', language),
  };
};

export const useCurrency = () => {
  const { settings, updateSetting } = useSettings();
  return {
    currency: settings.currency,
    setCurrency: (currency: string) => updateSetting('currency', currency),
  };
};

export const useLocation = () => {
  const { settings, updateSetting } = useSettings();
  return {
    location: settings.location,
    setLocation: (location: string) => updateSetting('location', location),
  };
};

export const usePagination = () => {
  const { settings, updateSetting } = useSettings();
  return {
    pageSize: settings.pageSize,
    setPageSize: (pageSize: number) => updateSetting('pageSize', pageSize),
  };
};
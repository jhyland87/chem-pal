import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import {
  type UserSettings,
  type SettingsContextType,
  defaultSettings,
  loadSettingsFromStorage,
  saveSettingsToStorage
} from './Settings.types';

// Create the context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Export the context for the hooks
export { SettingsContext };

// Settings Provider Component
interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadedSettings = loadSettingsFromStorage();
    setSettings(loadedSettings);
    setIsLoading(false);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      saveSettingsToStorage(settings);
    }
  }, [settings, isLoading]);

  // Update a single setting
  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ): void => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Update multiple settings at once
  const updateSettings = (newSettings: Partial<UserSettings>): void => {
    setSettings(prev => ({
      ...prev,
      ...newSettings,
    }));
  };

  // Reset to default settings
  const resetSettings = (): void => {
    setSettings(defaultSettings);
  };

  const contextValue: SettingsContextType = {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

// Re-export types for convenience
export type { UserSettings, SettingsContextType } from './Settings.types';
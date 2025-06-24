// Define the settings interface
export interface UserSettings {
  language: string;
  currency: string;
  location: string;
  theme: "light" | "dark" | "auto";
  notifications: boolean;
  autoSearch: boolean;
  searchDelay: number;
  pageSize: number;
  compactView: boolean;
  soundEnabled: boolean;
}

// Define the context interface
export interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

// Default settings
export const defaultSettings: UserSettings = {
  language: "en",
  currency: "USD",
  location: "US",
  theme: "auto",
  notifications: true,
  autoSearch: false,
  searchDelay: 500,
  pageSize: 10,
  compactView: false,
  soundEnabled: true,
};

// Local storage key
export const SETTINGS_STORAGE_KEY = "chemPalSettings";

// Helper function to load settings from localStorage
export const loadSettingsFromStorage = (): UserSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsedSettings = JSON.parse(stored);
      // Merge with defaults to ensure all properties exist
      return { ...defaultSettings, ...parsedSettings };
    }
  } catch (error) {
    console.warn("Failed to load settings from localStorage:", error);
  }
  return defaultSettings;
};

// Helper function to save settings to localStorage
export const saveSettingsToStorage = (settings: UserSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save settings to localStorage:", error);
  }
};

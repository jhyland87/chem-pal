import { createContext, useContext } from 'react';
import { Settings, SettingsContextProps } from './types';
import SupplierFactory from './supplier_factory';

export const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsContext')
  }
  return context
}
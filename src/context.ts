import { type AppContextProps } from "@/types/props";
import { createContext, useContext } from "react";
//import "./types.d.ts";

/**
 * React context for managing global application state and settings.
 *
 * @example
 * ```tsx
 * // Provider usage
 * <AppContext.Provider value={appContextValue}>
 *   <App />
 * </AppContext.Provider>
 *
 * // Consumer usage
 * const { settings, data } = useAppContext();
 * ```
 */
export const AppContext = createContext<AppContextProps | undefined>(undefined);

/**
 * Custom hook to access the application context.
 *
 * @returns The application context containing global state and settings
 * @throws If used outside of an AppContext.Provider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { settings, data } = useAppContext();
 *   return <div>{settings.someSetting}</div>;
 * }
 * ```
 */
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within a AppContext");
  }
  return context;
}

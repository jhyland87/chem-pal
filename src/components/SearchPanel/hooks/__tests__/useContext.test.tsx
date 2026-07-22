import { AppContext } from '@/context';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../useContext';

const contextValue = {
  userSettings: { showHelp: true },
  setUserSettings: vi.fn(),
  searchResults: [],
  setSearchResults: vi.fn(),
  setDrawerTab: vi.fn(),
  toggleDrawer: vi.fn(),
  setSelectedSuppliers: vi.fn(),
  pendingSearchQuery: null,
  setPendingSearchQuery: vi.fn(),
  searchFilters: {},
  setSearchFilters: vi.fn(),
  setBookmarksFolderId: vi.fn(),
} as unknown as AppContextProps;

function providerWrapper({ children }: { children: ReactNode }) {
  return createElement(AppContext.Provider, { value: contextValue }, children);
}

describe('useAppContext (use() variant)', () => {
  it('returns the context value when rendered inside its provider', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper: providerWrapper });
    expect(result.current).toBe(contextValue);
  });

  it('reads the default (undefined) when rendered outside any provider', () => {
    // AppContext defaults to undefined; use() reads that default without throwing.
    const { result } = renderHook(() => useAppContext());
    expect(result.current).toBeUndefined();
  });
});

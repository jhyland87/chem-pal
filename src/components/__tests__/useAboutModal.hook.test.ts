import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAboutModal } from '../useAboutModal.hook';

describe('useAboutModal', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useAboutModal());

    expect(result.current.aboutOpen).toBe(false);
  });

  it('opens the modal via handleAboutOpen', () => {
    const { result } = renderHook(() => useAboutModal());

    act(() => result.current.handleAboutOpen());

    expect(result.current.aboutOpen).toBe(true);
  });

  it('applies the boolean passed to handleAboutClose', () => {
    const { result } = renderHook(() => useAboutModal());

    act(() => result.current.handleAboutOpen());
    expect(result.current.aboutOpen).toBe(true);

    act(() => result.current.handleAboutClose(false));
    expect(result.current.aboutOpen).toBe(false);

    act(() => result.current.handleAboutClose(true));
    expect(result.current.aboutOpen).toBe(true);
  });

  it('supports the raw setAboutOpen setter', () => {
    const { result } = renderHook(() => useAboutModal());

    act(() => result.current.setAboutOpen(true));
    expect(result.current.aboutOpen).toBe(true);
  });

  it('keeps handler identities stable across renders', () => {
    const { result, rerender } = renderHook(() => useAboutModal());

    const firstOpen = result.current.handleAboutOpen;
    const firstClose = result.current.handleAboutClose;

    rerender();

    expect(result.current.handleAboutOpen).toBe(firstOpen);
    expect(result.current.handleAboutClose).toBe(firstClose);
  });
});

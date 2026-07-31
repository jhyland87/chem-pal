import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useContextMenu } from '../useContextMenu.hook';

/** Builds a minimal MouseEvent-like object with position and spies. */
function fakeEvent(x: number, y: number) {
  return {
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent;
}

const product = { id: 'p1', title: 'Acetone' } as unknown as Product;

describe('useContextMenu', () => {
  it('starts with no open menu', () => {
    const { result } = renderHook(() => useContextMenu());

    expect(result.current.contextMenu).toBeNull();
  });

  it('opens the menu at the click position with the product', () => {
    const { result } = renderHook(() => useContextMenu());
    const event = fakeEvent(120, 240);

    act(() => result.current.handleContextMenu(event, product));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 120, y: 240, product });
  });

  it('closes the menu', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => result.current.handleContextMenu(fakeEvent(1, 2), product));
    expect(result.current.contextMenu).not.toBeNull();

    act(() => result.current.handleCloseContextMenu());
    expect(result.current.contextMenu).toBeNull();
  });
});

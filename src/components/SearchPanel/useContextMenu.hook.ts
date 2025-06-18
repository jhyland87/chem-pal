import { useState } from "react";

/**
 * Context menu state object containing position and product data.
 */
interface ContextMenuState {
  /** X coordinate for menu positioning (in pixels from left edge) */
  x: number;
  /** Y coordinate for menu positioning (in pixels from top edge) */
  y: number;
  /** Product data associated with the context menu */
  product: Product;
}

/**
 * Return type for the useContextMenu hook.
 * Contains context menu state and handler functions.
 */
interface UseContextMenuReturn {
  /** Current context menu state, null when menu is closed */
  contextMenu: ContextMenuState | null;
  /** Function to handle context menu open events */
  handleContextMenu: (event: React.MouseEvent, product: Product) => void;
  /** Function to close the context menu */
  handleCloseContextMenu: () => void;
}

/**
 * Hook to manage context menu state and positioning for table rows.
 * Provides handlers for opening, closing, and positioning a context menu.
 *
 * This hook manages the visibility and positioning of a context menu that appears
 * when users right-click on table rows. It captures the mouse position and
 * associated product data to display relevant actions.
 *
 * @returns Context menu state and handlers
 *
 * @example
 * ```tsx
 * const { contextMenu, handleContextMenu, handleCloseContextMenu } = useContextMenu();
 *
 * // In table row:
 * <tr onContextMenu={(e) => handleContextMenu(e, row.original)}>
 *
 * // Render menu:
 * {contextMenu && (
 *   <ContextMenu
 *     x={contextMenu.x}
 *     y={contextMenu.y}
 *     product={contextMenu.product}
 *     onClose={handleCloseContextMenu}
 *   />
 * )}
 * ```
 */
export function useContextMenu(): UseContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  /**
   * Handles context menu open events from right-click actions.
   * Prevents the default browser context menu and captures the mouse
   * position and product data for the custom context menu.
   *
   * @param event - The mouse event from the right-click
   * @param product - The product data associated with the clicked row
   */
  const handleContextMenu = (event: React.MouseEvent, product: Product) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      product,
    });
  };

  /**
   * Closes the context menu by setting the state to null.
   * This hides the context menu from the UI.
   */
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
  };
}

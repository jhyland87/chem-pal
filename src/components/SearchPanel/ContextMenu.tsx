import ArrowRightIcon from "@/icons/ArrowRightIcon";
import BookmarkIcon from "@/icons/BookmarkIcon";
import ClearIcon from "@/icons/ClearIcon";
import InfoOutlineIcon from "@/icons/InfoOutlineIcon";
import SearchIcon from "@/icons/SearchIcon";
import SettingsIcon from "@/icons/SettingsIcon";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import { useEffect, useRef, useState } from "react";
import styles from "./ContextMenu.module.scss";

/**
 * Props for the ContextMenu component.
 * @source
 */
interface ContextMenuProps {
  /** X coordinate for menu positioning (pixels from left edge) */
  x: number;
  /** Y coordinate for menu positioning (pixels from top edge) */
  y: number;
  /** Function to call when the menu should be closed */
  onClose: () => void;
  /** Product data to display actions for */
  product: Product;
}

/**
 * Position coordinates for the context menu.
 * @source
 */
interface ContextMenuPosition {
  /** X coordinate in pixels */
  x: number;
  /** Y coordinate in pixels */
  y: number;
}

/**
 * Context menu component for table rows with Chrome extension-compatible implementation.
 *
 * Features:
 * - Right-click context menu for product rows
 * - Chrome extension security policy compliant
 * - Keyboard navigation support
 * - Auto-positioning to stay within viewport
 * - Click-outside-to-close functionality
 *
 * @param props - Component props
 * @returns Context menu component
 * @example
 * ```tsx
 * <ContextMenu
 *   x={100}
 *   y={200}
 *   product={productData}
 *   onClose={() => setMenuOpen(false)}
 * />
 * ```
 * @source
 */
export default function ContextMenu({ x, y, onClose, product }: ContextMenuProps) {
  if (!product) return null;
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<ContextMenuPosition>({ x, y });

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position if menu would overflow
      if (x + menuRect.width > viewportWidth) {
        adjustedX = viewportWidth - menuRect.width - 10;
      }

      // Adjust vertical position if menu would overflow
      if (y + menuRect.height > viewportHeight) {
        adjustedY = viewportHeight - menuRect.height - 10;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  // Handle click outside to close
  useEffect(() => {
    /**
     * Handles clicks outside the menu to close it.
     * @param event - The mouse event
     * @source
     */
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    /**
     * Handles escape key to close the menu.
     * @param event - The keyboard event
     * @source
     */
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  /**
   * Handles copying the product title to clipboard.
   * Shows console feedback on success/failure.
   * @source
   */
  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(product.title || "Unknown Product");
      console.log("Product title copied to clipboard");
    } catch (err) {
      console.error("Failed to copy product title:", err);
    }
    onClose();
  };

  /**
   * Handles copying the product URL to clipboard.
   * Shows console feedback on success/failure.
   * @source
   */
  const handleCopyUrl = async () => {
    if (product.url) {
      try {
        await navigator.clipboard.writeText(product.url);
        console.log("Product URL copied to clipboard");
      } catch (err) {
        console.error("Failed to copy product URL:", err);
      }
    }
    onClose();
  };

  /**
   * Handles opening the product URL in a new tab.
   * Uses Chrome extension API when available, falls back to window.open.
   * @source
   */
  const handleOpenInNewTab = async () => {
    if (product.url) {
      // Chrome extension compatible way to open new tab
      if (typeof chrome !== "undefined" && chrome.tabs) {
        try {
          await chrome.tabs.create({ url: product.url });
        } catch {
          // Fallback for non-extension environments
          window.open(product.url, "_blank", "noopener,noreferrer");
        }
      } else {
        // Fallback for non-extension environments
        window.open(product.url, "_blank", "noopener,noreferrer");
      }
    }
    onClose();
  };

  /**
   * Handles adding the product to favorites.
   * Currently logs to console - needs integration with favorites system.
   * @source
   */
  const handleAddToFavorites = () => {
    // TODO: Implement favorites functionality
    console.log("Adding to favorites:", product.title);
    // This would integrate with your favorites system
    onClose();
  };

  /**
   * Handles sharing the product.
   * Uses native Web Share API when available, falls back to copying URL.
   * @source
   */
  const handleShare = async () => {
    if (navigator.share && product.url) {
      try {
        await navigator.share({
          title: product.title || "Chemical Product",
          text: `Check out this chemical product: ${product.title}`,
          url: product.url,
        });
      } catch (err) {
        console.log("Share failed, falling back to clipboard:", err);
        await handleCopyUrl();
      }
    } else {
      // Fallback to copying URL
      await handleCopyUrl();
    }
    onClose();
  };

  /**
   * Handles viewing detailed product information.
   * Currently logs to console - needs integration with details modal/panel.
   * @source
   */
  const handleViewDetails = () => {
    // TODO: Implement product details modal/panel
    console.log("Viewing details for:", product.title);
    onClose();
  };

  /**
   * Handles quick search for similar products.
   * Currently logs to console - needs integration with search system.
   * @source
   */
  const handleQuickSearch = () => {
    // TODO: Implement quick search for similar products
    console.log("Quick search for:", product.title);
    onClose();
  };

  /**
   * Handles copying formatted product information to clipboard.
   * Includes title, price, supplier, and URL in a readable format.
   * @source
   */
  const handleCopyProductInfo = async () => {
    const productInfo = [
      product.title,
      `Price: ${product.currencySymbol}${product.price}`,
      `Supplier: ${product.supplier}`,
      `URL: ${product.url}`,
    ];

    if (product.description) {
      productInfo.push(`Description: ${product.description}`);
    }

    try {
      await navigator.clipboard.writeText(productInfo.join("\n"));
      console.log("Product info copied to clipboard");
    } catch (err) {
      console.error("Failed to copy product info:", err);
    }
    onClose();
  };

  return (
    <Paper className={styles['context-menu-paper']}
      ref={menuRef}
      elevation={8}
      style={{
        top: position.y,
        left: position.x,
      }}
    >
      <MenuList dense>
        <MenuItem className={styles['context-menu-item']} onClick={handleCopyTitle}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="Copy Title" />
        </MenuItem>

        <MenuItem className={styles['context-menu-item']} onClick={handleCopyUrl} disabled={!product.url}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="Copy URL" />
        </MenuItem>

        <MenuItem className={styles['context-menu-item']} onClick={handleCopyProductInfo}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="Copy Product Info" />
        </MenuItem>

        <Divider />

        <MenuItem className={styles['context-menu-item']} onClick={handleOpenInNewTab} disabled={!product.url}>
          <ListItemIcon>
            <ArrowRightIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="Open in New Tab" />
        </MenuItem>

        <MenuItem className={styles['context-menu-item']} onClick={handleViewDetails}>
          <ListItemIcon>
            <InfoOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="View Details" />
        </MenuItem>

        <Divider />

        <MenuItem className={styles['context-menu-item']} onClick={handleAddToFavorites}>
          <ListItemIcon>
            <BookmarkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="Add to Favorites" />
        </MenuItem>

        <MenuItem className={styles['context-menu-item']} onClick={handleQuickSearch}>
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="Search Similar" />
        </MenuItem>

        <MenuItem className={styles['context-menu-item']} onClick={handleShare} disabled={!product.url}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles['context-menu-option-text']} primary="Share" />
        </MenuItem>
      </MenuList>
    </Paper>
  );
}

// Hook moved to be co-located with component for better organization
export { useContextMenu } from "./useContextMenu.hook";

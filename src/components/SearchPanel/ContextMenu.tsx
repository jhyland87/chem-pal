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
import "./ContextMenu.scss";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  product: Product;
}

interface ContextMenuPosition {
  x: number;
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
 */
export default function ContextMenu({ x, y, onClose, product }: ContextMenuProps) {
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
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

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

  const handleCopyTitle = () => {
    navigator.clipboard
      .writeText(product.title || "Unknown Product")
      .then(() => {
        console.log("Product title copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy product title:", err);
      });
    onClose();
  };

  const handleCopyUrl = () => {
    if (product.url) {
      navigator.clipboard
        .writeText(product.url)
        .then(() => {
          console.log("Product URL copied to clipboard");
        })
        .catch((err) => {
          console.error("Failed to copy product URL:", err);
        });
    }
    onClose();
  };

  const handleOpenInNewTab = () => {
    if (product.url) {
      // Chrome extension compatible way to open new tab
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.create({ url: product.url }).catch(() => {
          // Fallback for non-extension environments
          window.open(product.url, "_blank", "noopener,noreferrer");
        });
      } else {
        // Fallback for non-extension environments
        window.open(product.url, "_blank", "noopener,noreferrer");
      }
    }
    onClose();
  };

  const handleAddToFavorites = () => {
    // TODO: Implement favorites functionality
    console.log("Adding to favorites:", product.title);
    // This would integrate with your favorites system
    onClose();
  };

  const handleShare = () => {
    if (navigator.share && product.url) {
      navigator
        .share({
          title: product.title || "Chemical Product",
          text: `Check out this chemical product: ${product.title}`,
          url: product.url,
        })
        .catch((err) => {
          console.log("Share failed, falling back to clipboard:", err);
          handleCopyUrl();
        });
    } else {
      // Fallback to copying URL
      handleCopyUrl();
    }
    onClose();
  };

  const handleViewDetails = () => {
    // TODO: Implement product details modal/panel
    console.log("Viewing details for:", product.title);
    onClose();
  };

  const handleQuickSearch = () => {
    // TODO: Implement quick search for similar products
    console.log("Quick search for:", product.title);
    onClose();
  };

  const handleCopyProductInfo = () => {
    const productInfo = `${product.title}\nPrice: ${product.currencySymbol}${product.price}\nSupplier: ${product.supplier}\nURL: ${product.url}`;
    navigator.clipboard
      .writeText(productInfo)
      .then(() => {
        console.log("Product info copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy product info:", err);
      });
    onClose();
  };

  return (
    <Paper
      ref={menuRef}
      elevation={8}
      sx={{
        position: "fixed",
        top: position.y,
        left: position.x,
        zIndex: 9999,
        minWidth: 200,
        maxWidth: 300,
      }}
    >
      <MenuList dense>
        <MenuItem onClick={handleCopyTitle}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Copy Title" />
        </MenuItem>

        <MenuItem onClick={handleCopyUrl} disabled={!product.url}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Copy URL" />
        </MenuItem>

        <MenuItem onClick={handleCopyProductInfo}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Copy Product Info" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleOpenInNewTab} disabled={!product.url}>
          <ListItemIcon>
            <ArrowRightIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Open in New Tab" />
        </MenuItem>

        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <InfoOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="View Details" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleAddToFavorites}>
          <ListItemIcon>
            <BookmarkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Add to Favorites" />
        </MenuItem>

        <MenuItem onClick={handleQuickSearch}>
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Search Similar" />
        </MenuItem>

        <MenuItem onClick={handleShare} disabled={!product.url}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Share" />
        </MenuItem>
      </MenuList>
    </Paper>
  );
}

/**
 * Hook to manage context menu state and positioning
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    product: Product;
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent, product: Product) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      product,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
  };
}

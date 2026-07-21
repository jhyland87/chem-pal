import { useStatusBar } from "@/components/StatusBar";
import { useAppContext } from "@/context";
import {
  buildResultsWorkbook,
  downloadBlob,
  type ExportContext,
  type ExportFilterSummary,
  type ExportGroup,
} from "@/helpers/exportResults";
import { i18n } from "@/helpers/i18n";
import { getExportableProductData } from "@/helpers/product";
import { getProductIdentityKey } from "@/helpers/productIdentity";
import ArrowDropDownIcon from "@/icons/ArrowDropDownIcon";
import ArrowDropUpIcon from "@/icons/ArrowDropUpIcon";
import ArrowRightIcon from "@/icons/ArrowRightIcon";
import BlockIcon from "@/icons/BlockIcon";
import BookmarkIcon from "@/icons/BookmarkIcon";
import CopyIcon from "@/icons/CopyIcon";
import FolderDeleteIcon from "@/icons/FolderDeleteIcon";
import HttpIcon from "@/icons/HttpIcon";
import SettingsIcon from "@/icons/SettingsIcon";
import { deleteSupplierProductDataCacheEntry, putExport } from "@/utils/idbCache";
import GridOnIcon from "@mui/icons-material/GridOn";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import type { Table } from "@tanstack/react-table";
import { dump as yamlDump } from "js-yaml";
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
  /**
   * The results table instance, used to expand/collapse all currently visible
   * (top-level, expandable) rows from the menu.
   */
  table: Table<Product>;
  /**
   * Called when the user selects "Ignore Product". Responsible for both
   * persisting the exclusion and removing the row from the visible results.
   */
  onExcludeProduct?: (product: Product) => void | Promise<void>;
  /** The originating search query, recorded on the Summary sheet of xlsx exports. */
  executedQuery?: string;
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
 * Renders a table filter value as a human-readable string for the export Summary
 * sheet. Numeric range filters (`[min, max]`) become `"min–max"`; multi-select
 * arrays are comma-joined; everything else is stringified.
 * @param value - The raw column-filter value from TanStack table state.
 * @returns A display string for the filter value.
 * @example
 * ```ts
 * formatFilterValue(["Loudwolf", "Onyxmet"]); // => "Loudwolf, Onyxmet"
 * formatFilterValue([5, 20]);                 // => "5–20"
 * ```
 * @source
 */
function formatFilterValue(value: unknown): string {
  if (Array.isArray(value)) {
    const isRange = value.length === 2 && value.every((v) => v == null || typeof v === "number");
    if (isRange) {
      const [min, max] = value;
      return `${min ?? ""}–${max ?? ""}`;
    }
    return value
      .filter((v) => v != null)
      .map((v) => String(v))
      .join(", ");
  }
  return value == null ? "" : String(value);
}

/**
 * Builds a filesystem-safe `.xlsx` filename from the search query and timestamp,
 * e.g. `chempal-export-sodium-chloride-2026-07-21-14-03-22.xlsx`.
 * @param query - The originating search query, if any.
 * @param createdAt - Epoch milliseconds the export was created.
 * @returns The suggested download filename.
 * @example
 * ```ts
 * buildExportFilename("Sodium Chloride", 1753104202000);
 * // => "chempal-export-sodium-chloride-2026-07-21-14-03-22.xlsx"
 * ```
 * @source
 */
function buildExportFilename(query: string | undefined, createdAt: number): string {
  const stamp = new Date(createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const slug =
    (query ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "results";
  return `chempal-export-${slug}-${stamp}.xlsx`;
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
export default function ContextMenu({
  x,
  y,
  onClose,
  product,
  table,
  onExcludeProduct,
  executedQuery,
}: ContextMenuProps) {
  const { flashStatusText } = useStatusBar();
  const { bookmarksFolderId, setBookmarksFolderId } = useAppContext();
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
      // event.target is typed as EventTarget | null; for a DOM mousedown it is
      // always a Node, which is what Element.contains expects.
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

  // The human-facing page to open/copy/share/bookmark. Falls back to `url`
  // for scraped suppliers where the two are the same. Product exclusion keeps
  // using `product.url` (the processing identity), not this.
  const openUrl = product.permalink ?? product.url;

  // Currently visible, expandable rows (top-level rows on the current page that
  // have detail to show). Drives which of the expand/collapse-all items appear:
  // all collapsed → only Expand; all expanded → only Collapse; mixed → both.
  const expandableRows = table
    .getRowModel()
    .rows.filter((row) => row.depth === 0 && row.getCanExpand());
  const allExpanded =
    expandableRows.length > 0 && expandableRows.every((row) => row.getIsExpanded());
  const anyExpanded = expandableRows.some((row) => row.getIsExpanded());
  const showExpandAll = expandableRows.length > 0 && !allExpanded;
  const showCollapseAll = anyExpanded;

  /**
   * Expands every currently visible expandable row, then closes the menu.
   * @source
   */
  const handleExpandAllVisible = () => {
    expandableRows.forEach((row) => row.toggleExpanded(true));
    onClose();
  };

  /**
   * Collapses every currently visible expandable row, then closes the menu.
   * @source
   */
  const handleCollapseAllVisible = () => {
    expandableRows.forEach((row) => row.toggleExpanded(false));
    onClose();
  };

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
    if (openUrl) {
      try {
        await navigator.clipboard.writeText(openUrl);
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
    if (openUrl) {
      // Chrome extension compatible way to open new tab
      if (typeof chrome !== "undefined" && chrome.tabs) {
        try {
          await chrome.tabs.create({ url: openUrl });
        } catch {
          // Fallback for non-extension environments
          window.open(openUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        // Fallback for non-extension environments
        window.open(openUrl, "_blank", "noopener,noreferrer");
      }
    }
    onClose();
  };

  /**
   * Handles creating a bookmark for the product in a "ChemPal Favorites" folder.
   * First checks AppContext for a cached folder ID, then scans the full bookmark
   * tree if needed, and creates the folder in the bookmarks root as a last resort.
   * Persists the resolved folder ID back to AppContext / chrome.storage.
   * @source
   */
  const handleCreateBookmark = async () => {
    const FOLDER_NAME = i18n("bookmark_favorites_folder");

    /**
     * Recursively searches the bookmark tree for a folder matching the given name.
     * @param nodes - Bookmark tree nodes to search
     * @returns The matching folder node, or undefined if not found
     */
    const findFolderInTree = (
      nodes: chrome.bookmarks.BookmarkTreeNode[],
    ): chrome.bookmarks.BookmarkTreeNode | undefined => {
      for (const node of nodes) {
        if (node.title === FOLDER_NAME && !node.url) return node;
        if (node.children) {
          const found = findFolderInTree(node.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    try {
      let folderId = bookmarksFolderId;

      // 1. If we have a cached ID, verify it still exists
      if (folderId) {
        try {
          const [existing] = await chrome.bookmarks.get(folderId);
          if (!existing || existing.url) {
            // ID is stale or points to a bookmark, not a folder
            folderId = null;
          }
        } catch {
          // Bookmark was deleted — clear the cached ID
          folderId = null;
        }
      }

      // 2. If no cached ID, scan the entire bookmark tree
      if (!folderId) {
        const tree = await chrome.bookmarks.getTree();
        const folder = findFolderInTree(tree);
        folderId = folder?.id ?? null;
      }

      // 3. If still not found, create the folder in the bookmarks root
      if (!folderId) {
        const rootNodes = await chrome.bookmarks.getTree();
        const rootChildren = rootNodes[0]?.children ?? [];
        const created = await chrome.bookmarks.create({
          parentId: rootChildren[0]?.id,
          title: FOLDER_NAME,
        });
        folderId = created.id;
      }

      // Persist the resolved folder ID
      if (folderId !== bookmarksFolderId) {
        setBookmarksFolderId(folderId);
      }

      // Check if a bookmark with this URL already exists in the folder
      const children = await chrome.bookmarks.getChildren(folderId);
      const duplicate = children.find((node) => node.url === openUrl);

      if (duplicate) {
        flashStatusText(i18n("bookmark_already_exists", [FOLDER_NAME]));
      } else {
        await chrome.bookmarks.create({
          parentId: folderId,
          title: product.title,
          url: openUrl,
        });
        flashStatusText(i18n("bookmark_created", [FOLDER_NAME]));
      }
    } catch (error) {
      console.error("Failed to create bookmark:", { error, product });
    }

    onClose();
  };

  /**
   * Handles sharing the product.
   * Uses native Web Share API when available, falls back to copying URL.
   * @source
   */
  const handleShare = async () => {
    if (navigator.share && openUrl) {
      try {
        await navigator.share({
          title: product.title || i18n("share_fallback_title"),
          text: i18n("share_text", [product.title]),
          url: openUrl,
        });
      } catch (error) {
        console.error("Share failed, falling back to clipboard", { error });
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
  // const handleViewDetails = () => {
  //   // TODO: Implement product details modal/panel
  //   console.log("Viewing details", { product });
  //   onClose();
  // };

  // /**
  //  * Handles quick search for similar products.
  //  * Currently logs to console - needs integration with search system.
  //  * @source
  //  */
  // const handleQuickSearch = () => {
  //   // TODO: Implement quick search for similar products
  //   console.log("Quick search", { product });
  //   onClose();
  // };

  /**
   * Delegates the "Ignore Product" action to the parent via the
   * `onExcludeProduct` callback, which is responsible for both persisting the
   * exclusion to chrome.storage.local and removing the row from the visible
   * results. We only close the menu here.
   * @source
   */
  const handleIgnoreProduct = async () => {
    try {
      await onExcludeProduct?.(product);
    } catch (error) {
      console.warn("Failed to ignore product:", { error });
    }
    onClose();
  };

  /**
   * Evicts this product's cached detail data from the supplier product-detail
   * cache. The product stays in the table and search results — only its cache
   * entry is removed, so the next search that surfaces it fetches fresh data
   * instead of serving the cached copy. The cache key is derived the same way
   * the supplier writes it: `getProductIdentityKey(cacheKey, supplier)`.
   * @source
   */
  const handleRemoveFromCache = async () => {
    if (!product.cacheKey || !product.supplier) {
      flashStatusText(i18n("context_menu_cache_remove_unavailable"));
      onClose();
      return;
    }

    try {
      const cacheKey = getProductIdentityKey(product.cacheKey, product.supplier);
      await deleteSupplierProductDataCacheEntry(cacheKey);
      flashStatusText(i18n("context_menu_removed_from_cache", [product.title]));
    } catch (error) {
      console.error("Failed to remove product from cache:", { error, product });
    }

    onClose();
  };

  const handleCopyProductInfoJson = async () => {
    const productInfoObj = getExportableProductData(product);
    const productInfo = JSON.stringify(productInfoObj, null, 2);

    try {
      await navigator.clipboard.writeText(productInfo);
      console.log("JSON product info copied to clipboard", { productInfoObj, productInfo });
    } catch (error) {
      console.error("Failed to copy JSON product info", { productInfoObj, productInfo, error });
    }
    onClose();
  };

  /**
   * Handles copying formatted product information to clipboard.
   * Includes title, price, supplier, and URL in a readable format.
   * @source
   */
  const handleCopyProductInfo = async () => {
    const productInfoObj = getExportableProductData(product);
    const productInfo = yamlDump(productInfoObj, { noRefs: true });

    try {
      await navigator.clipboard.writeText(productInfo);
      console.log("YAML product info copied to clipboard", {
        productInfo,
        productInfoObj,
      });
    } catch (error) {
      console.error("Failed to copy YAML product info", { productInfoObj, productInfo, error });
    }
    onClose();
  };

  // Whether any column or global filter is currently narrowing the results —
  // gates the "Export filtered results" item.
  const hasActiveFilters =
    table.getState().columnFilters.length > 0 || Boolean(table.getState().globalFilter);

  /**
   * Collects the table's active filters as label/value pairs for the export
   * Summary sheet: the global search filter first, then each column filter
   * (labelled by its string header, falling back to the column id).
   * @returns One entry per active filter.
   * @source
   */
  const collectActiveFilters = (): ExportFilterSummary[] => {
    const filters: ExportFilterSummary[] = [];
    const globalFilter = table.getState().globalFilter;
    if (globalFilter) {
      filters.push({ label: i18n("export_summary_filter_global"), value: String(globalFilter) });
    }
    for (const { id, value } of table.getState().columnFilters) {
      const header = table.getColumn(id)?.columnDef.header;
      filters.push({
        label: typeof header === "string" ? header : id,
        value: formatFilterValue(value),
      });
    }
    return filters;
  };

  /**
   * Builds a formatted `.xlsx` from the current results, caches it in IndexedDB,
   * and downloads it. `scope` chooses the pre-filtered (all) or filtered row set;
   * variants are exported as grouped subrows beneath their parent product.
   * @param scope - Whether to export all results or only the filtered view.
   * @source
   */
  const handleExport = async (scope: "all" | "filtered") => {
    try {
      const rowModel =
        scope === "all" ? table.getPreFilteredRowModel() : table.getFilteredRowModel();
      const groups: ExportGroup[] = rowModel.rows
        .filter((row) => row.depth === 0)
        .map((row) => ({
          parent: row.original,
          variants:
            scope === "filtered"
              ? row.subRows.map((sub) => sub.original)
              : (row.original.variants ?? []),
        }));

      const columnVisibility: Record<string, boolean> = {};
      for (const column of table.getAllLeafColumns()) {
        columnVisibility[column.id] = column.getIsVisible();
      }

      const createdAt = Date.now();
      const context: ExportContext = {
        scope,
        createdAt,
        query: executedQuery,
        appVersion: __APP_VERSION__,
        userSettings: table.options.meta?.userSettings,
        activeFilters: collectActiveFilters(),
        groups,
        columnVisibility,
      };

      const blob = await buildResultsWorkbook(context);
      const filename = buildExportFilename(executedQuery, createdAt);
      await putExport({
        id: crypto.randomUUID(),
        createdAt,
        filename,
        query: executedQuery,
        scope,
        rowCount: groups.length,
        sizeBytes: blob.size,
        blob,
      });
      downloadBlob(blob, filename);
      flashStatusText(i18n("export_success", [String(groups.length)]));
    } catch (error) {
      console.error("Failed to export results", { error });
      flashStatusText(i18n("export_failed"));
    }
    onClose();
  };

  return (
    <Paper
      className={styles["context-menu-paper"]}
      ref={menuRef}
      elevation={8}
      style={{
        top: position.y,
        left: position.x,
      }}
    >
      <MenuList dense>
        <MenuItem className={styles["context-menu-item"]} onClick={handleCopyTitle}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_copy_title")}
          />
        </MenuItem>

        <MenuItem
          className={styles["context-menu-item"]}
          onClick={handleCopyUrl}
          disabled={!openUrl}
        >
          <ListItemIcon>
            <HttpIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_copy_url")}
          />
        </MenuItem>

        <MenuItem className={styles["context-menu-item"]} onClick={handleCopyProductInfo}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_copy_product_info")}
          />
        </MenuItem>

        <MenuItem className={styles["context-menu-item"]} onClick={handleCopyProductInfoJson}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_copy_product_info_json")}
          />
        </MenuItem>

        <Divider />

        <MenuItem className={styles["context-menu-item"]} onClick={() => void handleExport("all")}>
          <ListItemIcon>
            <GridOnIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_export_all")}
          />
        </MenuItem>

        {hasActiveFilters && (
          <MenuItem
            className={styles["context-menu-item"]}
            onClick={() => void handleExport("filtered")}
          >
            <ListItemIcon>
              <GridOnIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              className={styles["context-menu-option-text"]}
              primary={i18n("context_menu_export_filtered")}
            />
          </MenuItem>
        )}

        <Divider />

        <MenuItem className={styles["context-menu-item"]} onClick={handleIgnoreProduct}>
          <ListItemIcon>
            <BlockIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_ignore_product")}
          />
        </MenuItem>

        <MenuItem className={styles["context-menu-item"]} onClick={handleRemoveFromCache}>
          <ListItemIcon>
            <FolderDeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_remove_product_from_cache")}
          />
        </MenuItem>

        <Divider />

        <MenuItem
          className={styles["context-menu-item"]}
          onClick={handleOpenInNewTab}
          disabled={!openUrl}
        >
          <ListItemIcon>
            <ArrowRightIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_open_in_new_tab")}
          />
        </MenuItem>

        {(showExpandAll || showCollapseAll) && <Divider />}

        {showExpandAll && (
          <MenuItem className={styles["context-menu-item"]} onClick={handleExpandAllVisible}>
            <ListItemIcon>
              <ArrowDropDownIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              className={styles["context-menu-option-text"]}
              primary={i18n("context_menu_expand_all")}
            />
          </MenuItem>
        )}

        {showCollapseAll && (
          <MenuItem className={styles["context-menu-item"]} onClick={handleCollapseAllVisible}>
            <ListItemIcon>
              <ArrowDropUpIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              className={styles["context-menu-option-text"]}
              primary={i18n("context_menu_collapse_all")}
            />
          </MenuItem>
        )}

        {/*  <MenuItem className={styles["context-menu-item"]} onClick={handleViewDetails}>
          <ListItemIcon>
            <InfoOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText className={styles["context-menu-option-text"]} primary={i18n("context_menu_view_details")} />
        </MenuItem> */}

        <Divider />

        <MenuItem className={styles["context-menu-item"]} onClick={handleCreateBookmark}>
          <ListItemIcon>
            <BookmarkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_create_bookmark")}
          />
        </MenuItem>

        {/* <MenuItem className={styles["context-menu-item"]} onClick={handleQuickSearch}>
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
         <ListItemText className={styles["context-menu-option-text"]} primary={i18n("context_menu_search_similar")} />
        </MenuItem>*/}

        <MenuItem className={styles["context-menu-item"]} onClick={handleShare} disabled={!openUrl}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            className={styles["context-menu-option-text"]}
            primary={i18n("context_menu_share")}
          />
        </MenuItem>
      </MenuList>
    </Paper>
  );
}

// Hook moved to be co-located with component for better organization
export { useContextMenu } from "./useContextMenu.hook";

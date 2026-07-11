/**
 * Theme-aware toolbar (action) icon.
 *
 * The manifest ships the main navy logo as the default action icon; this swaps
 * to the inverted white logo whenever the browser reports a dark color scheme,
 * so the icon stays legible against the toolbar. Detection runs from the
 * extension page context (popup / side panel) because a service worker has no
 * `matchMedia`; `chrome.action.setIcon` persists the chosen icon for the
 * browser session and otherwise falls back to the manifest default.
 *
 * @module themeIcon
 */
import { Logger } from "@/utils/Logger";

const logger = new Logger("themeIcon");

/** The browser color schemes we render distinct toolbar icons for. */
type ColorScheme = "light" | "dark";

/**
 * Per-scheme sized toolbar icons, resolved relative to the extension root (the
 * same convention as the manifest `icons` paths). `light` uses the navy badge
 * so it reads on a light toolbar; `dark` uses the inverted white badge.
 */
const THEME_ICON_PATHS: Record<ColorScheme, Record<number, string>> = {
  light: {
    16: "static/images/logo/ChemPal-logo-16.png",
    32: "static/images/logo/ChemPal-logo-32.png",
    48: "static/images/logo/ChemPal-logo-48.png",
    128: "static/images/logo/ChemPal-logo-128.png",
  },
  dark: {
    16: "static/images/logo/ChemPal-logo-inverted-16.png",
    32: "static/images/logo/ChemPal-logo-inverted-32.png",
    48: "static/images/logo/ChemPal-logo-inverted-48.png",
    128: "static/images/logo/ChemPal-logo-inverted-128.png",
  },
};

/**
 * Applies the toolbar icon variant matching the given color scheme.
 * @param scheme - The active browser color scheme.
 * @returns Resolves once the icon has been applied (failures are logged, not thrown).
 * @example
 * await applyToolbarIcon("dark"); // toolbar shows the inverted (white) logo
 * @source
 */
async function applyToolbarIcon(scheme: ColorScheme): Promise<void> {
  try {
    await chrome.action.setIcon({ path: THEME_ICON_PATHS[scheme] });
  } catch (error) {
    logger.warn(`Failed to set the ${scheme} toolbar icon`, error);
  }
}

/**
 * Initializes the theme-aware toolbar icon: applies the icon matching the
 * current `prefers-color-scheme` and updates it whenever the scheme changes.
 *
 * Safe to call unconditionally at startup — it no-ops in any context lacking
 * `matchMedia` or `chrome.action.setIcon` (tests, the Vite dev preview, a
 * service worker, or a browser that exposes neither), so it never throws.
 * @returns Nothing; the toolbar icon is updated as a side effect.
 * @example
 * // In the app entry point (main.tsx):
 * initThemeAwareToolbarIcon();
 * @source
 */
export function initThemeAwareToolbarIcon(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }
  if (typeof chrome === "undefined" || chrome.action?.setIcon === undefined) {
    return;
  }

  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
  void applyToolbarIcon(darkScheme.matches ? "dark" : "light");
  darkScheme.addEventListener("change", (event) => {
    void applyToolbarIcon(event.matches ? "dark" : "light");
  });
}

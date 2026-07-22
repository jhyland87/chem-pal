/**
 * Helpers for detecting and switching the extension's display context.
 *
 * The same `index.html` is rendered as the toolbar popup and (via
 * {@link openExtensionTab}) a full browser tab. A `?view=tab` query param
 * marks the tab view so the UI can resize to fill the window and hide
 * popup-only controls such as the maximize button.
 * @module displayContext
 * @source
 */

/**
 * Query-string key that flags the full-tab view.
 * @category Utils
 */
export const VIEW_PARAM = 'view';
/**
 * Value of {@link VIEW_PARAM} that identifies the full-tab view.
 * @category Utils
 */
export const TAB_VIEW = 'tab';

/**
 * Reports whether the current document is rendered in a full browser tab
 * (as opposed to the toolbar popup), based on the `?view=tab`
 * query param set by {@link openExtensionTab}.
 * @category Utils
 * @returns `true` when running in the full-tab view, otherwise `false`.
 * @example
 * ```ts
 * // URL: chrome-extension://<id>/index.html?view=tab
 * isTabView(); // => true
 * // URL: chrome-extension://<id>/index.html
 * isTabView(); // => false
 * ```
 * @source
 */
export function isTabView(): boolean {
  return new URLSearchParams(window.location.search).get(VIEW_PARAM) === TAB_VIEW;
}

/**
 * Opens the extension in a new, focused browser tab and closes the popup.
 * The opened URL carries the `?view=tab` param so {@link isTabView} resolves to
 * `true` there. Falls back to `window.open` outside the extension runtime.
 * If a tab is already open at that URL it is focused instead of duplicated.
 * @category Utils
 * @returns A promise that resolves once the tab has been requested.
 * @example
 * ```ts
 * // From a popup click handler:
 * await openExtensionTab();
 * // => focuses the existing index.html?view=tab tab, or opens one, then window.close()
 * ```
 * @source
 */
export async function openExtensionTab(): Promise<void> {
  const path = `index.html?${VIEW_PARAM}=${TAB_VIEW}`;

  // Outside the extension runtime (e.g. dev preview): fall back to a plain tab.
  if (typeof chrome?.tabs === 'undefined' || typeof chrome?.runtime?.getURL !== 'function') {
    window.open(`/${path}`, '_blank');
    return;
  }

  const url = chrome.runtime.getURL(path);
  try {
    const existing = await findExtensionTab(url);
    if (existing?.id == null) {
      await chrome.tabs.create({ url, active: true });
    } else {
      await chrome.tabs.update(existing.id, { active: true });
      if (typeof chrome.windows !== 'undefined' && existing.windowId != null) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
    }
  } catch (error) {
    console.error('Failed to open extension tab:', { error });
  }
  window.close();
}

/**
 * Finds an open browser tab whose URL matches the given extension URL.
 * @param url - The full extension URL to look for, including any query string.
 * @returns The matching tab, or `undefined` when no tab is open at that URL.
 * @example
 * ```ts
 * await findExtensionTab(chrome.runtime.getURL("index.html?view=tab"));
 * // => { id: 5, windowId: 9, ... } | undefined
 * ```
 * @source
 */
async function findExtensionTab(url: string): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url === url || tab.pendingUrl === url);
}

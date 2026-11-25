/**
 * Whether the extension may send requests to a set of hosts.
 * @category Helpers
 * @group Permissions
 * @param origins - Origin patterns, e.g. a supplier's `requiredHosts`
 * @returns True when all of them are granted, or there are none
 * @throws When the browser rejects a pattern
 * @example
 * ```ts
 * await hasHostPermissions(['https://www.example.com/*']); // false
 * ```
 * @source
 */
export async function hasHostPermissions(origins: string[]): Promise<boolean> {
  return origins.length === 0 || chrome.permissions.contains({ origins });
}

/** The optional permission for showing price drops outside ChemPal. */
const NOTIFICATIONS: chrome.permissions.Permissions = { permissions: ['notifications'] };

/**
 * Whether ChemPal may show notifications.
 * @category Helpers
 * @group Permissions
 * @returns True when the permission is granted
 * @example
 * ```ts
 * await hasNotificationPermission(); // false
 * ```
 * @source
 */
export async function hasNotificationPermission(): Promise<boolean> {
  return chrome.permissions.contains(NOTIFICATIONS);
}

/**
 * Asks to show notifications. Call it directly in a click handler, before awaiting anything, or the
 * browser refuses.
 * @category Helpers
 * @group Permissions
 * @returns Whether the permission is granted
 * @throws When called outside a click
 * @example
 * ```ts
 * await requestNotificationPermission(); // true
 * ```
 * @source
 */
export async function requestNotificationPermission(): Promise<boolean> {
  return chrome.permissions.request(NOTIFICATIONS);
}

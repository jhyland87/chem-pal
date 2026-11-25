/**
 * How the toolbar badge shows price drops the user hasn't seen. A ChemPal page that is visible or
 * searching controls the badge (see {@link "./badgeController"}); otherwise the background worker
 * shows the drops. A hidden page couldn't flash it, since browsers slow its timers down.
 *
 * @module
 * @category Utils
 * @group Price Alerts
 */
import { priceAlerts as priceAlertsConfig } from '@/../config.json';
import { MESSAGE_TYPE } from '@/constants/common';
import { sleep } from '@/helpers/utils';
import { BadgeAnimator } from '@/utils/BadgeAnimator';

/** Starts the badge's text, so it can't be mistaken for a result count. */
const DROP_PREFIX = '↓';

/**
 * The badge's text for a number of products with an unseen drop.
 * @category Utils
 * @group Price Alerts
 * @param count - Number of products
 * @returns The badge text
 * @example
 * ```ts
 * dropBadgeText(2); // '↓2'
 * ```
 * @source
 */
export function dropBadgeText(count: number): string {
  return `${DROP_PREFIX}${count}`;
}

/**
 * Whether the badge is showing price drops.
 * @category Utils
 * @group Price Alerts
 * @param text - The badge's current text
 * @returns True when it was set by {@link showDropBadge}
 * @example
 * ```ts
 * isDropBadgeText('↓2'); // true
 * isDropBadgeText('2'); // false
 * ```
 * @source
 */
export function isDropBadgeText(text: string): boolean {
  return text.startsWith(DROP_PREFIX);
}

/**
 * Shows the number of products with an unseen drop on the badge.
 * @category Utils
 * @group Price Alerts
 * @param count - Number of products
 * @param shouldFlash - Whether to flash the badge for a moment first
 * @returns Resolves once the badge is set; flashing continues after that
 * @example
 * ```ts
 * await showDropBadge(2, true);
 * ```
 * @source
 */
export async function showDropBadge(count: number, shouldFlash: boolean): Promise<void> {
  const { color, flashColor, flashIntervalMs, flashSeconds } = priceAlertsConfig.badge;
  const text = dropBadgeText(count);
  // Setting the text blanks it first, which would be a visible blink.
  if ((await chrome.action.getBadgeText({})) !== text) await BadgeAnimator.setText(text);
  await BadgeAnimator.setColor(undefined, color);
  if (shouldFlash) {
    void BadgeAnimator.flash([color, flashColor], flashIntervalMs, flashSeconds * 1000);
  }
}

/**
 * Replaces a price drop badge with an empty one. Leaves any other badge alone.
 * @category Utils
 * @group Price Alerts
 * @returns Resolves once the badge is cleared
 * @example
 * ```ts
 * await clearDropBadge();
 * ```
 * @source
 */
export async function clearDropBadge(): Promise<void> {
  if (!isDropBadgeText(await chrome.action.getBadgeText({}))) return;
  await BadgeAnimator.clear();
  await BadgeAnimator.resetColor();
}

/**
 * Answers the background worker when it asks whether this page controls the badge.
 * @category Utils
 * @group Price Alerts
 * @param isOwner - Whether it does right now
 * @returns Stops answering
 * @example
 * ```ts
 * const release = claimBadge(() => document.visibilityState === 'visible');
 * ```
 * @source
 */
export function claimBadge(isOwner: () => boolean): () => void {
  const handleMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: boolean) => void,
  ): void => {
    if (typeof message !== 'object' || message === null) return;
    // Only the owner answers, so it is heard when several pages are open.
    if (Reflect.get(message, 'type') === MESSAGE_TYPE.BADGE_OWNER && isOwner()) sendResponse(true);
  };
  chrome.runtime?.onMessage?.addListener(handleMessage);
  return () => chrome.runtime?.onMessage?.removeListener(handleMessage);
}

/**
 * Whether a page controls the badge. For the background worker.
 * @category Utils
 * @group Price Alerts
 * @returns True when one answered
 * @example
 * ```ts
 * await isBadgeClaimed(); // false
 * ```
 * @source
 */
export async function isBadgeClaimed(): Promise<boolean> {
  try {
    // A page the browser has frozen never answers.
    const answer: unknown = await Promise.race([
      chrome.runtime.sendMessage({ type: MESSAGE_TYPE.BADGE_OWNER }),
      sleep(priceAlertsConfig.badge.ownerTimeoutMs),
    ]);
    return answer === true;
  } catch {
    // Rejects when no page is open.
    return false;
  }
}

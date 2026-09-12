import { recordError } from '@/helpers/errorBuffer';

/**
 * A utility class for managing Chrome extension badge animations and styling.
 * Provides methods to animate the badge with different character sets, set colors,
 * and control the animation timing. The badge can be used to show loading states,
 * progress indicators, or other status information in the Chrome extension icon.
 *
 * @summary
 * Used to set/animate the chrome extension badge text.
 *
 * @category Utils
 * @example
 * ```typescript
 * // Start a loading animation with custom characters
 * BadgeAnimator.animate(['․', '‥', '…'], 500);
 *
 * // Use a predefined character set
 * BadgeAnimator.animate('hourglass', 300);
 *
 * // Set badge colors
 * BadgeAnimator.setColor('#FFFFFF', '#FF0000');
 *
 * // Clear the badge with a final message
 * void BadgeAnimator.clear('✓', 2000);
 *
 * // Example usage scenario.
 * try {
 *    // Start the animation
 *    BadgeAnimator.animate('ellipsis', 300)
 *    // Run the async task
 *    await someAsyncTask()
 *    // Clear the badge with a final success icon
 *    void BadgeAnimator.clear("✔", 5000)
 * } catch (error) {
 *    // Clear the badge with a final error icon
 *    void BadgeAnimator.clear("❌", 1000)
 * }
 * ```
 *
 * {@includeCode ./BadgeAnimator.ts#class}
 * @source
 */
// #region class
export class BadgeAnimator {
  /** Available predefined character sets for badge animations */
  static readonly charsets: Record<string, string[]> = {
    /** Hourglass animation (⏳ ⌛) */
    hourglass: ['⏳', '⌛'],
    /** Ellipsis animation (․ ‥ …) */
    ellipsis: ['․', '‥', '…'],
    /** Clock animation (🕛 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚) */
    clock: ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'],
    arch: ['◜', '◝', '◞', '◟', '◠', '◡', '○'],
    ball_wave: ['𓃉𓃉𓃉', '𓃉𓃉∘', '𓃉∘°', '∘°∘', '°∘𓃉', '∘𓃉𓃉'],
    //circle: ["⨀⊙⊚⌾Ⓞⓞ○◯⚬⚬○⦾⦿⨀☉⚬⚭⚮⚯⌾○◌◎⭘￮"],
  };

  // Private static fields for state management
  static #timeoutId: ReturnType<typeof setTimeout> | null = null;
  static #charIndex: number = 0;
  static #chars: string[] = [];
  static #delay: number = 500;
  // Bumped by clear()/animate() so an in-flight #updateAnimation() from a
  // superseded animation (still awaiting its setBadgeText call) can tell it's
  // stale and bail instead of mutating #chars/#charIndex out from under the
  // animation that replaced it.
  static #generation: number = 0;

  /**
   * Start animating the badge with the given characters or predefined character set
   * @param chars - Either an array of characters to cycle through or a key from the predefined charsets
   * @param delay - Delay between updates in milliseconds (default: 500)
   * @throws Error If chars is empty or invalid
   * @source
   */
  static animate(chars: string[] | keyof typeof BadgeAnimator.charsets, delay: number = 500): void {
    const characterSet = typeof chars === 'string' ? this.charsets[chars] : chars;

    if (!characterSet || characterSet.length < 1) {
      throw new Error('At least one character is required for badge animation');
    }

    void this.clear(); // Clear any existing animation, bumping #generation synchronously
    this.#chars = characterSet;
    this.#delay = delay;
    this.#charIndex = 0;

    void this.#updateAnimation(this.#generation);
  }

  /**
   * Stop the badge animation and optionally show a final message
   * @param finalText - Optional text to display before clearing the badge
   * @param duration - How long to show the final text before clearing (in milliseconds)
   * @returns A promise that resolves once the badge text is set.
   * @source
   */
  static async clear(finalText: string = '', duration: number = 5000): Promise<void> {
    this.#generation++;
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    // If there's a final status to set, create a timeout to clear it afterwards
    if (finalText) {
      await this.#setBadgeText(finalText);
      setTimeout(() => {
        void this.#setBadgeText('');
      }, duration);
    } else {
      await this.#setBadgeText('');
    }
  }

  /**
   * Set the colors of the badge
   * @param fgColor - The foreground (text) color of the badge (hex color code)
   * @param bgColor - The background color of the badge (hex color code)
   * @source
   */
  static setColor(fgColor?: string, bgColor?: string): void {
    if (fgColor) {
      chrome.action.setBadgeTextColor({
        color: fgColor,
      });
    }

    if (bgColor) {
      chrome.action.setBadgeBackgroundColor({
        color: bgColor,
      });
    }
  }

  /**
   * Set the text of the badge. This also clears the animation
   * @param text - The text to display on the badge
   * @returns A promise that resolves once the badge text is set.
   * @source
   */
  static async setText(text: string): Promise<void> {
    void this.clear(); // Stop any running animation without waiting on its own badge update
    await this.#setBadgeText(text);
  }

  /**
   * Sets the badge text via the promise-based `chrome.action` API (no
   * callback), recording any rejection instead of letting it float unhandled.
   * @param text - The badge text to set.
   * @returns A promise that resolves once the attempt settles — never rejects.
   * @source
   */
  static async #setBadgeText(text: string): Promise<void> {
    try {
      await chrome.action.setBadgeText({ text });
    } catch (error) {
      void recordError({
        source: 'chrome-api',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update the badge to the next character in the sequence. Bails if `generation`
   * no longer matches the current generation — a newer `animate()` or `clear()`
   * call superseded this one while it was awaiting its badge update.
   * @param generation - The animation generation this call belongs to.
   * @returns A promise that resolves once the badge text is set.
   * @source
   */
  static async #updateAnimation(generation: number): Promise<void> {
    if (generation !== this.#generation || !this.#chars.length) return;

    await this.#setBadgeText(this.#chars[this.#charIndex]);
    if (generation !== this.#generation) return;

    this.#charIndex = (this.#charIndex + 1) % this.#chars.length;
    this.#timeoutId = setTimeout(() => void this.#updateAnimation(generation), this.#delay);
  }
}
// #endregion class
// Export the class directly

/**
 * Can do something similar with the icon itself:
 * ```ts
 * chrome.action.setIcon({
 *   path: {
 *     16: 'static/images/logo/ChemPal-logo.png',
 *     32: 'static/images/logo/ChemPal-logo.png',
 *   },
 * });
 * ```
 * @source
 */

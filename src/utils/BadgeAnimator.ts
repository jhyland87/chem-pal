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
 * BadgeAnimator.clear('✓', 2000);
 *
 * // Example usage scenario.
 * try {
 *    // Start the animation
 *    BadgeAnimator.animate('ellipsis', 300)
 *    // Run the async task
 *    await someAsyncTask()
 *    // Clear the badge with a final success icon
 *    BadgeAnimator.clear("✔", 5000)
 * } catch (error) {
 *    // Clear the badge with a final error icon
 *    BadgeAnimator.clear("❌", 1000)
 * }
 * ```
 *
 * {@includeCode ./BadgeAnimator.ts#class}
 */
// #region class
class BadgeAnimator {
  /** Available predefined character sets for badge animations */
  static readonly charsets: Record<string, string[]> = {
    /** Hourglass animation (⏳ ⌛) */
    hourglass: ["⏳", "⌛"],
    /** Ellipsis animation (․ ‥ …) */
    ellipsis: ["․", "‥", "…"],
    /** Clock animation (🕛 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚) */
    clock: ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"],
    arch: ["◜", "◝", "◞", "◟", "◠", "◡", "○"],
    ball_wave: ["𓃉𓃉𓃉", "𓃉𓃉∘", "𓃉∘°", "∘°∘", "°∘𓃉", "∘𓃉𓃉"],
    //circle: ["⨀⊙⊚⌾Ⓞⓞ○◯⚬⚬○⦾⦿⨀☉⚬⚭⚮⚯⌾○◌◎⭘￮"],
  };

  // Private static fields for state management
  static #timeoutId: ReturnType<typeof setTimeout> | null = null;
  static #charIndex: number = 0;
  static #chars: string[] = [];
  static #delay: number = 500;

  /**
   * Start animating the badge with the given characters or predefined character set
   * @param chars - Either an array of characters to cycle through or a key from the predefined charsets
   * @param delay - Delay between updates in milliseconds (default: 500)
   * @throws Error If chars is empty or invalid
   */
  static animate(chars: string[] | keyof typeof BadgeAnimator.charsets, delay: number = 500): void {
    const characterSet = typeof chars === "string" ? this.charsets[chars] : chars;

    if (!characterSet || characterSet.length < 1) {
      throw new Error("At least one character is required for badge animation");
    }

    this.clear(); // Clear any existing animation
    this.#chars = characterSet;
    this.#delay = delay;
    this.#charIndex = 0;

    this.#updateAnimation();
  }

  /**
   * Stop the badge animation and optionally show a final message
   * @param finalText - Optional text to display before clearing the badge
   * @param duration - How long to show the final text before clearing (in milliseconds)
   */
  static clear(finalText: string = "", duration: number = 5000): void {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    // If there's a final status to set, create a timeout to clear it afterwards
    if (finalText) {
      /*
      chrome.action.setBadgeText({ text: finalText }, () => {
        setTimeout(() => {
          chrome.action.setBadgeText({ text: "" });
        }, duration);
      });
      */
    } else {
      //chrome.action.setBadgeText({ text: "" });
    }
  }

  /**
   * Set the colors of the badge
   * @param fgColor - The foreground (text) color of the badge (hex color code)
   * @param bgColor - The background color of the badge (hex color code)
   */
  static setColor(fgColor?: string, bgColor?: string): void {
    if (fgColor) {
      /*chrome.action.setBadgeTextColor({
        color: fgColor,
      });*/
    }

    if (bgColor) {
      /*chrome.action.setBadgeBackgroundColor({
        color: bgColor,
      });*/
    }
  }

  /**
   * Set the text of the badge. This also clears the animation
   * @param text - The text to display on the badge
   */
  static setText(text: string): void {
    this.clear();
    //chrome.action.setBadgeText({ text });
  }

  /**
   * Update the badge to the next character in the sequence
   */
  static #updateAnimation(): void {
    if (!this.#chars.length) return;
    /*
    chrome.action.setBadgeText(
      {
        text: this.#chars[this.#charIndex],
      },
      () => {
        this.#charIndex = (this.#charIndex + 1) % this.#chars.length;
        this.#timeoutId = setTimeout(() => this.#updateAnimation(), this.#delay);
      },
    );
    */
  }
}
// #endregion class
// Export the class directly
export default BadgeAnimator;

/**
 * Can do something similar with the icon iself.
 * chrome.action.setIcon({
  path: {
    16: 'static/images/logo/logo-icon-128.png',
    32: 'static/images/logo/logo-icon-128.png',
  },
})
 */

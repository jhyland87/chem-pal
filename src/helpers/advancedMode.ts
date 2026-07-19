/**
 * Shared pieces of the Konami-unlocked advanced mode, used by both entry points
 * (the popup in `App.tsx` and the standalone options page in `OptionsApp.tsx`).
 * @category Helpers
 * @group Advanced Mode
 * @showCategories
 * @categoryDescription Advanced-mode unlock helpers.
 * @source
 */

/** Bundled chimes for entering and leaving advanced mode. */
const ADVANCED_MODE_SOUNDS = {
  on: "/static/sounds/power-up.mp3",
  off: "/static/sounds/power-down.mp3",
} as const;

/** Playback volume for the chimes — half, so they're noticeable but not startling. */
const VOLUME = 0.5;

/**
 * Plays the advanced-mode chime at half volume: a power-up on unlock, a
 * power-down on exit. Failures are swallowed — autoplay policy or a missing asset
 * must never stop the mode from toggling.
 * @param enabled - `true` when advanced mode is being turned on, `false` when off.
 * @returns Nothing; resolves once playback starts (or fails).
 * @example
 * ```ts
 * void playAdvancedModeSound(true);  // power-up
 * void playAdvancedModeSound(false); // power-down
 * ```
 * @category Helpers
 * @source
 */
export async function playAdvancedModeSound(enabled: boolean): Promise<void> {
  try {
    const audio = new Audio(enabled ? ADVANCED_MODE_SOUNDS.on : ADVANCED_MODE_SOUNDS.off);
    audio.volume = VOLUME;
    await audio.play();
  } catch (error) {
    console.warn("Failed to play the advanced-mode sound", { error });
  }
}

/**
 * On-screen keycap overlay for the demo recording.
 *
 * When the walkthrough triggers a keyboard shortcut, the viewer should see which
 * keys are pressed. This injects (via `context.addInitScript`, like the cursor
 * overlay) a `window.__chempalShowKeys(keys)` hook that briefly flashes a row of
 * keycaps at the bottom-center of the page. The demo helper `pressHotkey` calls
 * it alongside the real key press.
 *
 * @module demo/keycaps
 */
import { type BrowserContext } from '@playwright/test';

/**
 * Installs the page-side keycap overlay (top frame of every page) and exposes
 * `window.__chempalShowKeys(keys)`, which flashes the given key labels as raised
 * keycaps for a moment and then fades them out. Call before any navigation.
 * @param context - The browser context to instrument.
 * @returns A promise that resolves once the init script is registered.
 * @example
 * ```ts
 * await installKeycapsOverlay(context); // window.__chempalShowKeys(["⌘","⇧","E"])
 * ```
 * @source
 */
export async function installKeycapsOverlay(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (window.top !== window) {
      return;
    }
    const showKeys = (keys: string[]): void => {
      if (!document.body || !Array.isArray(keys) || keys.length === 0) {
        return;
      }
      const bar = document.createElement('div');
      bar.style.cssText =
        'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);' +
        'display:flex;gap:8px;z-index:2147483646;pointer-events:none;' +
        'opacity:0;transition:opacity 140ms ease;';
      for (const key of keys) {
        const cap = document.createElement('div');
        cap.textContent = key;
        cap.style.cssText =
          'min-width:34px;height:46px;padding:0 12px;box-sizing:border-box;' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-family:system-ui,sans-serif;font-size:20px;font-weight:600;color:#f8fafc;' +
          'background:linear-gradient(#3b3f4a,#23262e);border:1px solid #4b5563;' +
          'border-bottom:3px solid #0f172a;border-radius:8px;' +
          'box-shadow:0 4px 10px rgba(0,0,0,0.4);';
        bar.appendChild(cap);
      }
      document.body.appendChild(bar);
      requestAnimationFrame(() => {
        bar.style.opacity = '1';
      });
      window.setTimeout(() => {
        bar.style.opacity = '0';
        window.setTimeout(() => bar.remove(), 220);
      }, 1100);
    };
    Reflect.set(window, '__chempalShowKeys', showKeys);
  });
}

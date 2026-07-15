/**
 * Visible cursor overlay for the demo recording.
 *
 * Playwright's synthetic mouse fires real DOM events (that's how {@link
 * installSfxCapture} times click sounds) but renders no visible pointer in the
 * screencast. This injects — via the same `context.addInitScript` mechanism, so
 * the demo scripts need no changes — a fake arrow pointer that glides after the
 * mouse and an expanding ripple ring on each `mousedown`. Everything renders
 * live in the recorded page, so it stays frame-accurate with the video and the
 * ripple lands on the same click the sound is timestamped from; no ffmpeg /
 * post-processing is involved.
 *
 * The overlay also exposes `window.__chempalCursorMoveTo(x, y)` so the demo
 * helpers can glide the pointer onto an element *before* highlighting it,
 * without moving Playwright's real mouse (which would fire premature hover
 * tooltips). A short CSS transition turns every reposition — whether from a real
 * `mousemove` or that hook — into a smooth glide rather than a jump.
 *
 * @module demo/cursor
 */
import { type BrowserContext } from "@playwright/test";

/** Milliseconds the pointer takes to ease from its old spot to a new one. */
const GLIDE_MS = 200;
/**
 * Milliseconds to hold the click ripple back after the real mousedown, so the
 * gliding pointer has time to reach the click point before its ripple appears.
 * Kept in step with the click-sound delay (`CLICK_LAG_MS` in `sfx.ts`) so the
 * ripple and the click sound land together, on the pointer.
 */
const RIPPLE_DELAY_MS = 190;

/**
 * Installs the page-side cursor overlay: an init script (run in the top frame of
 * every page in the context) that draws a classic arrow pointer gliding after
 * the mouse and a ripple ring on each click, and exposes
 * `window.__chempalCursorMoveTo(x, y)` for the helpers to point it at an element.
 * The listeners are capture-phase and passive and never call `preventDefault`,
 * so they can't interfere with the real clicks Playwright dispatches. Call
 * before any navigation.
 * @param context - The browser context to instrument.
 * @returns Resolves once the init script is registered.
 * @example
 * await installCursorOverlay(context); // arrow + click ripple appear in the video
 * @source
 */
export async function installCursorOverlay(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ({ glideMs, rippleDelayMs }: { glideMs: number; rippleDelayMs: number }) => {
      // Only the top frame gets a cursor: iframes would duplicate it and their
      // coordinates are frame-local, not the main viewport space we record.
      if (window.top !== window) {
        return;
      }

      const CURSOR_ID = "__chempalDemoCursor";
      const STYLE_ID = "__chempalDemoCursorStyle";
      // Tip of the arrow within the 24x24 SVG viewBox — used as the click hotspot.
      const TIP_X = 5;
      const TIP_Y = 3;

      const install = (): void => {
        if (!document.body || document.getElementById(CURSOR_ID)) {
          return;
        }

        // One-time ripple keyframes.
        if (!document.getElementById(STYLE_ID)) {
          const style = document.createElement("style");
          style.id = STYLE_ID;
          style.textContent =
            "@keyframes __chempalRipple{" +
            "from{transform:translate(-50%,-50%) scale(0.25);opacity:0.9}" +
            "to{transform:translate(-50%,-50%) scale(2.5);opacity:0}}";
          document.head.appendChild(style);
        }

        // Classic left-tilted arrow pointer: white fill, dark stroke, soft shadow
        // so it reads over any background. Positioned so the tip sits on the mouse.
        // No transition yet — the first placement is instant so it doesn't swoop
        // in from the corner; easing is switched on after that.
        const cursor = document.createElement("div");
        cursor.id = CURSOR_ID;
        cursor.style.cssText =
          "position:fixed;left:0;top:0;width:24px;height:24px;" +
          "pointer-events:none;z-index:2147483647;opacity:0;" +
          `transform:translate(-${TIP_X}px,-${TIP_Y}px);` +
          "will-change:transform;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));";
        cursor.innerHTML =
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
          'xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M5 3 L5 19 L9.5 14.5 L12.5 21 L15 20 L12 13.5 L18.5 13.5 Z" ' +
          'fill="#ffffff" stroke="#1a1a1a" stroke-width="1.2" ' +
          'stroke-linejoin="round"/></svg>';
        document.body.appendChild(cursor);

        let placed = false;
        const moveTo = (x: number, y: number, durMs: number): void => {
          // Re-append if a DOM swap dropped the node, then position the tip.
          if (!cursor.isConnected && document.body) {
            document.body.appendChild(cursor);
          }
          cursor.style.opacity = "1";
          // First placement is instant so the pointer doesn't swoop in from the
          // corner; after that each move eases over the requested duration.
          cursor.style.transition = placed ? `transform ${durMs}ms ease-out` : "none";
          cursor.style.transform = `translate(${x - TIP_X}px,${y - TIP_Y}px)`;
          placed = true;
        };

        // Let the helpers glide the pointer onto an element without moving the real
        // mouse (which would trigger hover tooltips before we want them).
        Reflect.set(window, "__chempalCursorMoveTo", (x: number, y: number) =>
          moveTo(x, y, glideMs),
        );

        window.addEventListener(
          "mousemove",
          (event) => moveTo(event.clientX, event.clientY, glideMs),
          { capture: true, passive: true },
        );

        window.addEventListener(
          "mousedown",
          (event) => {
            // Send the pointer to the exact click point at normal glide speed, then
            // hold the ripple back a beat so it appears once the pointer arrives —
            // rather than firing under a pointer that's still gliding in.
            const x = event.clientX;
            const y = event.clientY;
            moveTo(x, y, glideMs);
            window.setTimeout(() => {
              const ripple = document.createElement("div");
              ripple.style.cssText =
                "position:fixed;width:34px;height:34px;border-radius:50%;" +
                "border:2px solid rgba(37,99,235,0.9);pointer-events:none;" +
                "z-index:2147483646;transform:translate(-50%,-50%) scale(0.25);" +
                `left:${x}px;top:${y}px;` +
                "animation:__chempalRipple 500ms ease-out forwards;";
              ripple.addEventListener("animationend", () => ripple.remove());
              if (document.body) {
                document.body.appendChild(ripple);
              }
            }, rippleDelayMs);
          },
          { capture: true, passive: true },
        );
      };

      // Body may not exist yet when the init script runs (document-start).
      if (document.body) {
        install();
      } else {
        document.addEventListener("DOMContentLoaded", install, { once: true });
      }
    },
    { glideMs: GLIDE_MS, rippleDelayMs: RIPPLE_DELAY_MS },
  );
}

import type { Locator, Page } from "@playwright/test";

/** DOM id used for the injected popover so teardown can find and remove it. */
const POPOVER_ID = "playwright-demo-popover";

/**
 * Type text into a field one character at a time, as a person would, so the
 * demo video shows the keystrokes instead of the value appearing instantly.
 * Uses `pressSequentially` (which focuses the element first).
 * @param locator - The input/textbox to type into.
 * @param text - The text to type.
 * @param delayMs - Per-character delay in milliseconds. Defaults to 70.
 * @returns A promise that resolves once every character has been typed.
 * @example
 * ```ts
 * await typeInto(searchInput, "sodium borohydride");
 * ```
 * @source
 */
export async function typeInto(locator: Locator, text: string, delayMs = 70): Promise<void> {
  await locator.pressSequentially(text, { delay: delayMs });
}

/**
 * Smoothly scrolls an element into view (animated) and waits for the scroll to
 * settle, so the demo eases to it instead of snapping — easier on the eye in the
 * recording. Uses the element's own scroll container, so it works whether the
 * page or an inner region scrolls.
 * @param page - The page, used to pace the settle wait.
 * @param locator - The element to bring into view.
 * @param block - Where to align the element vertically once in view.
 * @param settleMs - How long to wait for the smooth scroll to finish.
 * @returns A promise that resolves once the scroll has settled.
 * @example
 * ```ts
 * await smoothScrollIntoView(page, paginationControl, "end");
 * ```
 * @source
 */
export async function smoothScrollIntoView(
  page: Page,
  locator: Locator,
  block: "start" | "center" | "end" | "nearest" = "center",
  settleMs = 1200,
): Promise<void> {
  await locator.evaluate((el, b) => {
    el.scrollIntoView({ behavior: "smooth", block: b, inline: "nearest" });
  }, block);
  await page.waitForTimeout(settleMs);
}

/**
 * Smoothly scrolls all the way back to the top. Walks up from `anchor` to the
 * nearest scrollable ancestor and scrolls it to 0 (falling back to the window),
 * so the top of the view — including anything above the anchor, like a toolbar —
 * comes fully into frame, rather than stopping at the anchor's own top edge.
 * @param page - The page, used to pace the settle wait.
 * @param anchor - An element inside the scroll container to return to the top of.
 * @param settleMs - How long to wait for the smooth scroll to finish.
 * @returns A promise that resolves once the scroll has settled.
 * @example
 * ```ts
 * await smoothScrollToTop(page, resultsTable);
 * ```
 * @source
 */
export async function smoothScrollToTop(
  page: Page,
  anchor: Locator,
  settleMs = 1400,
): Promise<void> {
  await anchor.evaluate((el) => {
    const isScrollable = (node: Element): boolean => {
      const style = getComputedStyle(node);
      return /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    };
    let node: Element | null = el.parentElement;
    while (node) {
      if (isScrollable(node)) {
        node.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      node = node.parentElement;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  await page.waitForTimeout(settleMs);
}

/**
 * Glides the demo cursor overlay onto an element's center so the pointer rests
 * on whatever is being pointed out (before any later click). Moving the overlay
 * — not Playwright's real mouse — means no premature hover tooltips fire; the
 * visual hook is a no-op if the overlay isn't installed. No outline is drawn:
 * the resting cursor (and any popover) is the callout.
 * @param locator - The element to point the cursor at.
 * @returns A promise that resolves once the cursor has been aimed.
 * @example
 * ```ts
 * await highlight(page.getByRole("textbox", { name: "search for products" }));
 * ```
 * @source
 */
export async function highlight(locator: Locator): Promise<void> {
  await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const moveCursor = Reflect.get(window, "__chempalCursorMoveTo");
    if (typeof moveCursor === "function") {
      moveCursor(r.left + r.width / 2, r.top + r.height / 2);
    }
  });
}

/**
 * Removes a highlight previously applied by {@link highlight}.
 * @param locator - The element to clear.
 * @returns A promise that resolves once the outline is removed.
 * @example
 * ```ts
 * await clearHighlight(searchInput);
 * ```
 * @source
 */
export async function clearHighlight(locator: Locator): Promise<void> {
  await locator.evaluate((el) => {
    el.style.outline = "none";
  });
}

/** DOM id for the single group-outline overlay so teardown can remove it. */
const GROUP_HIGHLIGHT_ID = "playwright-demo-group-highlight";

/**
 * Points the demo cursor at the center of the combined bounding box of every
 * element a locator matches — e.g. rests the pointer on the middle of all the
 * variant price trends rather than a single cell. No outline is drawn; the
 * resting cursor (and any popover) is the callout.
 * @param page - The page whose cursor overlay to aim.
 * @param locator - The locator matching the elements to enclose.
 * @returns A promise that resolves once the cursor has been aimed (no-op if
 *   nothing matches or the matches have no size).
 * @example
 * ```ts
 * await highlightGroup(page, page.locator(".variant-trend"));
 * ```
 * @source
 */
export async function highlightGroup(page: Page, locator: Locator): Promise<void> {
  const boxes = await locator.evaluateAll((els) =>
    els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      })
      .filter((b) => b.right > b.left && b.bottom > b.top),
  );
  if (boxes.length === 0) return;

  const rect = {
    left: Math.min(...boxes.map((b) => b.left)),
    top: Math.min(...boxes.map((b) => b.top)),
    right: Math.max(...boxes.map((b) => b.right)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };

  await page.evaluate(({ left, top, right, bottom }) => {
    // Rest the demo cursor on the group's center.
    const moveCursor = Reflect.get(window, "__chempalCursorMoveTo");
    if (typeof moveCursor === "function") {
      moveCursor((left + right) / 2, (top + bottom) / 2);
    }
  }, rect);
}

/**
 * Removes the group outline drawn by {@link highlightGroup}, if present.
 * @param page - The page the overlay was drawn on.
 * @returns A promise that resolves once the overlay is removed.
 * @example
 * ```ts
 * await clearGroupHighlight(page);
 * ```
 * @source
 */
export async function clearGroupHighlight(page: Page): Promise<void> {
  await page.evaluate((id) => {
    document.getElementById(id)?.remove();
  }, GROUP_HIGHLIGHT_ID);
}

/**
 * Flashes the given key labels as on-screen keycaps (via the keycap overlay's
 * `window.__chempalShowKeys` hook) and then fires the app's hotkey action by
 * dispatching the matching `window` CustomEvent — the exact event ChemPal's own
 * hotkey handler dispatches. Driving the event (rather than a raw key chord)
 * keeps the action deterministic across platform modifier / focus differences,
 * while the keycaps still show the viewer which keys do it.
 * @param page - The page to fire the shortcut on.
 * @param eventName - The `window` CustomEvent name to dispatch (e.g. `"chempal:expand-all-rows"`).
 * @param keys - The key labels to display as keycaps (e.g. `["⌘","⇧","E"]`).
 * @returns A promise that resolves once the event has been dispatched.
 * @example
 * ```ts
 * await fireHotkeyEvent(page, "chempal:expand-all-rows", ["⌘", "⇧", "E"]);
 * ```
 * @source
 */
export async function fireHotkeyEvent(
  page: Page,
  eventName: string,
  keys: string[],
): Promise<void> {
  await page.evaluate((labels) => {
    const show = Reflect.get(window, "__chempalShowKeys");
    if (typeof show === "function") {
      show(labels);
    }
  }, keys);
  await page.waitForTimeout(340);
  await page.evaluate((name) => {
    window.dispatchEvent(new CustomEvent(name));
  }, eventName);
}

/** DOM id for the spotlight overlay so teardown can find and fade it. */
const SPOTLIGHT_ID = "playwright-demo-spotlight";

/**
 * Softly blurs and dims everything except the target element to draw the eye to
 * it during an explanatory callout — used for "this is a link" style call-outs
 * the cursor points at but doesn't click. Builds four fixed panels around the
 * target's rect (leaving a small padded hole), so the target, its popover, and
 * the cursor all stay sharp above them, then fades the panels in. Pair with
 * {@link clearSpotlight}. No-op if the target has no box.
 * @param page - The page to draw on.
 * @param target - The element to keep in focus.
 * @returns A promise that resolves once the panels are drawn and fading in.
 * @example
 * ```ts
 * await spotlight(page, page.locator(".variant-name a").first());
 * ```
 * @source
 */
export async function spotlight(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) return;
  await page.evaluate(
    ({ x, y, width, height, id }) => {
      document.getElementById(id)?.remove();
      const pad = 6;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const l = Math.max(0, x - pad);
      const t = Math.max(0, y - pad);
      const r = Math.min(vw, x + width + pad);
      const b = Math.min(vh, y + height + pad);

      const container = document.createElement("div");
      container.id = id;
      container.style.cssText =
        "position:fixed;left:0;top:0;width:100%;height:100%;" +
        "pointer-events:none;z-index:999900;opacity:0;transition:opacity 300ms ease;";

      const panel = (left: number, top: number, w: number, h: number): void => {
        const p = document.createElement("div");
        p.style.cssText =
          `position:fixed;left:${left}px;top:${top}px;` +
          `width:${Math.max(0, w)}px;height:${Math.max(0, h)}px;` +
          "backdrop-filter:blur(2.5px);-webkit-backdrop-filter:blur(2.5px);" +
          "background-color:rgba(18,20,28,0.22);";
        container.appendChild(p);
      };
      panel(0, 0, vw, t); // above
      panel(0, b, vw, vh - b); // below
      panel(0, t, l, b - t); // left
      panel(r, t, vw - r, b - t); // right

      document.body.appendChild(container);
      requestAnimationFrame(() => {
        container.style.opacity = "1";
      });
    },
    { x: box.x, y: box.y, width: box.width, height: box.height, id: SPOTLIGHT_ID },
  );
}

/**
 * Fades out and removes the spotlight overlay drawn by {@link spotlight}, if
 * present.
 * @param page - The page the overlay was drawn on.
 * @returns A promise that resolves once the fade-out has been started.
 * @example
 * ```ts
 * await clearSpotlight(page);
 * ```
 * @source
 */
export async function clearSpotlight(page: Page): Promise<void> {
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = "0";
    window.setTimeout(() => el.remove(), 320);
  }, SPOTLIGHT_ID);
}

/**
 * Injects a floating dark tooltip bubble pointing at the target element. It
 * measures itself and sits above the target by default, but flips below when
 * there isn't room above (e.g. an element near the top of the viewport), and
 * clamps horizontally so wide labels never run off the edges. The arrow tracks
 * the target's center. Only one popover exists at a time — call
 * {@link closeDemoPopover} before showing the next.
 * @param page - The page to inject into.
 * @param target - The element the tooltip points at.
 * @param message - The tooltip text.
 * @returns A promise that resolves once the popover is rendered (no-op if the
 * target has no bounding box).
 * @example
 * ```ts
 * await showDemoPopover(page, searchInput, "Type a chemical name to search");
 * ```
 * @source
 */
export async function showDemoPopover(page: Page, target: Locator, message: string): Promise<void> {
  const box = await target.boundingBox();
  if (!box) return;

  await page.evaluate(
    ({ x, y, width, height, text, id }) => {
      const margin = 10;
      const edge = 8;

      const popover = document.createElement("div");
      popover.id = id;
      popover.textContent = text;
      Object.assign(popover.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        maxWidth: "300px",
        backgroundColor: "#1e293b",
        color: "#ffffff",
        padding: "8px 14px",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: "500",
        lineHeight: "1.35",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        zIndex: "999999",
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
        visibility: "hidden",
      });
      // Append hidden first so we can measure the rendered size.
      document.body.appendChild(popover);

      const popW = popover.offsetWidth;
      const popH = popover.offsetHeight;
      const centerX = x + width / 2;

      // `boundingBox` is viewport-relative, so `y` is the room above the target.
      // Flip below when there isn't enough room for the bubble up top.
      const placeBelow = y < popH + margin + edge;
      const top = (placeBelow ? y + height + margin : y - popH - margin) + window.scrollY;

      // Center on the target, clamped so the bubble stays on screen.
      const clampedLeft = Math.max(
        edge,
        Math.min(centerX - popW / 2, window.innerWidth - popW - edge),
      );
      popover.style.left = `${clampedLeft + window.scrollX}px`;
      popover.style.top = `${top}px`;
      popover.style.visibility = "visible";

      // Arrow sits on the side facing the target and points at its center.
      const arrow = document.createElement("div");
      const arrowLeft = Math.max(12, Math.min(centerX - clampedLeft, popW - 12));
      Object.assign(arrow.style, {
        position: "absolute",
        left: `${arrowLeft}px`,
        transform: "translateX(-50%)",
        width: "0",
        height: "0",
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        ...(placeBelow
          ? { top: "-6px", borderBottom: "6px solid #1e293b" }
          : { bottom: "-6px", borderTop: "6px solid #1e293b" }),
      });
      popover.appendChild(arrow);
    },
    { x: box.x, y: box.y, width: box.width, height: box.height, text: message, id: POPOVER_ID },
  );
}

/**
 * Removes the popover injected by {@link showDemoPopover}, if present.
 * @param page - The page to clean up.
 * @returns A promise that resolves once the popover is removed.
 * @example
 * ```ts
 * await closeDemoPopover(page);
 * ```
 * @source
 */
export async function closeDemoPopover(page: Page): Promise<void> {
  await page.evaluate((id) => {
    document.getElementById(id)?.remove();
  }, POPOVER_ID);
}

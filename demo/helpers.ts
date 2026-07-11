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
export async function smoothScrollToTop(page: Page, anchor: Locator, settleMs = 1400): Promise<void> {
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
 * Draws a glowing outline around an element to draw the audience's eye.
 * @param locator - The element to highlight.
 * @returns A promise that resolves once the outline is applied.
 * @example
 * ```ts
 * await highlight(page.getByRole("textbox", { name: "search for products" }));
 * ```
 * @source
 */
export async function highlight(locator: Locator): Promise<void> {
  await locator.evaluate((el) => {
    el.style.outline = "3px solid #ff0055";
    el.style.outlineOffset = "2px";
    el.style.borderRadius = "6px";
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
 * Draws ONE outline around the combined bounding box of every element a locator
 * matches — e.g. a single box around all the variant price trends rather than a
 * cluttered outline per cell. Uses a fixed-position overlay (no per-element
 * styling), so it wraps the whole group tightly.
 * @param page - The page to draw the overlay on.
 * @param locator - The locator matching the elements to enclose.
 * @returns A promise that resolves once the overlay is drawn (no-op if nothing
 *   matches or the matches have no size).
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

  await page.evaluate(
    ({ left, top, right, bottom, id }) => {
      const pad = 4;
      const box = document.createElement("div");
      box.id = id;
      Object.assign(box.style, {
        position: "fixed",
        left: `${left - pad}px`,
        top: `${top - pad}px`,
        width: `${right - left + pad * 2}px`,
        height: `${bottom - top + pad * 2}px`,
        border: "3px solid #ff0055",
        borderRadius: "6px",
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: "999998",
      });
      document.body.appendChild(box);
    },
    { ...rect, id: GROUP_HIGHLIGHT_ID },
  );
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
export async function showDemoPopover(
  page: Page,
  target: Locator,
  message: string,
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) return;

  await page.evaluate(
    ({ x, y, width, height, text, id }) => {
      const margin = 10;
      const edge = 8;

      const popover = document.createElement("div");
      popover.id = id;
      popover.innerText = text;
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
      const clampedLeft = Math.max(edge, Math.min(centerX - popW / 2, window.innerWidth - popW - edge));
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

import type { Locator, Page } from "@playwright/test";

/** DOM id used for the injected popover so teardown can find and remove it. */
const POPOVER_ID = "playwright-demo-popover";

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

/**
 * Injects a floating dark tooltip bubble (with a downward arrow) just above the
 * target element. Only one popover exists at a time — call {@link closeDemoPopover}
 * before showing the next.
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
    ({ x, y, width, text, id }) => {
      const popover = document.createElement("div");
      popover.id = id;
      popover.innerText = text;
      Object.assign(popover.style, {
        position: "absolute",
        left: `${x + width / 2}px`,
        top: `${y - 55}px`,
        transform: "translateX(-50%)",
        backgroundColor: "#1e293b",
        color: "#ffffff",
        padding: "8px 14px",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: "500",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        zIndex: "999999",
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
        transition: "all 0.3s ease",
      });

      const arrow = document.createElement("div");
      Object.assign(arrow.style, {
        position: "absolute",
        bottom: "-6px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "0",
        height: "0",
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderTop: "6px solid #1e293b",
      });

      popover.appendChild(arrow);
      document.body.appendChild(popover);
    },
    { x: box.x, y: box.y, width: box.width, text: message, id: POPOVER_ID },
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

/**
 * Finds the first HTMLElement with the given text in the tree.
 * @param root - The root HTMLElement to search in
 * @param searchText - The text or RegExp to search for
 * @returns The HTMLElement with the given text, or undefined if not found
 * @example Search for simple string
 * ```typescript
 * const element = findElementWithText(document.body, "Hello, world!");
 * // Returns the HTMLElement with the text "Hello, world!"
 * ```
 * @example Search Amazon product stock
 * ```typescript
 * const element = findElementWithText(document.body, "left in stock", "span");
 * // Returns: <span class="a-size-base a-color-price">Only 1 left in stock - order soon.</span>
 * ```
 * @source
 */
export function findElementWithText(
  root: HTMLElement,
  searchText: string,
  elementTag: string = "*",
): HTMLElement | undefined {
  // The "." at the start is crucial—it means "look inside the context node"
  const xpath = `.//${elementTag}[contains(text(), '${searchText}')]`;

  const result = document.evaluate(
    xpath,
    root, // This sets the starting point
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null,
  );

  const node = result.singleNodeValue;

  if (node instanceof HTMLElement) {
    return node;
  }
  return undefined;
}

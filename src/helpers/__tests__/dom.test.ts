import { findElementWithText } from "@/helpers/dom";
import { beforeEach, describe, expect, it } from "vitest";

describe("findElementWithText", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.innerHTML = `
      <p>Hello, world!</p>
      <span class="a-size-base">Only 1 left in stock - order soon.</span>
      <div><strong>Nested match here</strong></div>
    `;
  });

  it("finds an element by its exact text", () => {
    const el = findElementWithText(root, "Hello, world!");
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el?.textContent).toBe("Hello, world!");
  });

  it("finds an element by a substring", () => {
    const el = findElementWithText(root, "left in stock");
    expect(el?.tagName).toBe("SPAN");
  });

  it("respects the elementTag filter", () => {
    const el = findElementWithText(root, "Nested match here", "strong");
    expect(el?.tagName).toBe("STRONG");
  });

  it("returns undefined when the tag filter excludes the match", () => {
    const el = findElementWithText(root, "Hello, world!", "span");
    expect(el).toBeUndefined();
  });

  it("returns undefined when the text is not present", () => {
    expect(findElementWithText(root, "no such text")).toBeUndefined();
  });

  it("defaults to searching any element tag", () => {
    const el = findElementWithText(root, "Only 1 left");
    expect(el).toBeInstanceOf(HTMLElement);
  });
});

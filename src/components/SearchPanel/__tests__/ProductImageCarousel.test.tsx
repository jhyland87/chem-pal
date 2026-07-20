import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductImageCarousel } from "../ProductDetailPanel";

const images = [
  { thumbSrc: "https://example.com/a-thumb.jpg", fullSrc: "https://example.com/a.jpg" },
  { thumbSrc: "https://example.com/b-thumb.jpg", fullSrc: "https://example.com/b.jpg" },
  { thumbSrc: "https://example.com/c-thumb.jpg", fullSrc: "https://example.com/c.jpg" },
];

describe("ProductImageCarousel", () => {
  it("renders nothing when there are no images", () => {
    const { container } = render(<ProductImageCarousel images={[]} title="Geraniol" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows no navigation buttons for a single image", () => {
    render(<ProductImageCarousel images={[images[0]]} title="Geraniol" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("cycles forward and backward through images on button click", () => {
    render(<ProductImageCarousel images={images} title="Geraniol" />);

    const image = () => screen.getByRole("img");
    const next = screen.getByLabelText(/next/i);
    const prev = screen.getByLabelText(/prev/i);

    expect(image()).toHaveAttribute("src", "https://example.com/a-thumb.jpg");

    fireEvent.click(next);
    expect(image()).toHaveAttribute("src", "https://example.com/b-thumb.jpg");

    fireEvent.click(next);
    expect(image()).toHaveAttribute("src", "https://example.com/c-thumb.jpg");

    // Wraps around to the first image.
    fireEvent.click(next);
    expect(image()).toHaveAttribute("src", "https://example.com/a-thumb.jpg");

    // And backward wraps to the last.
    fireEvent.click(prev);
    expect(image()).toHaveAttribute("src", "https://example.com/c-thumb.jpg");
  });
});

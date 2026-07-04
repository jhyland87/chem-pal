import {
  matchPercentageSortingFn,
  priceSortingFn,
  quantitySortingFn,
} from "@/helpers/sorting";
import type { Row } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

function makeRow(original: Partial<Product>): Row<Product> {
  return { original } as Row<Product>;
}

describe("quantitySortingFn", () => {
  it("returns 1 when rowA baseQuantity is greater", () => {
    expect(quantitySortingFn(makeRow({ baseQuantity: 500 }), makeRow({ baseQuantity: 100 }))).toBe(
      1,
    );
  });

  it("returns -1 when rowA baseQuantity is smaller", () => {
    expect(quantitySortingFn(makeRow({ baseQuantity: 100 }), makeRow({ baseQuantity: 500 }))).toBe(
      -1,
    );
  });

  it("returns 0 when equal", () => {
    expect(quantitySortingFn(makeRow({ baseQuantity: 100 }), makeRow({ baseQuantity: 100 }))).toBe(
      0,
    );
  });

  it("treats a missing baseQuantity as 0", () => {
    expect(quantitySortingFn(makeRow({}), makeRow({ baseQuantity: 100 }))).toBe(-1);
    expect(quantitySortingFn(makeRow({ baseQuantity: 5 }), makeRow({}))).toBe(1);
    expect(quantitySortingFn(makeRow({}), makeRow({}))).toBe(0);
  });
});

describe("matchPercentageSortingFn", () => {
  it("returns 1 when rowA matchPercentage is greater", () => {
    expect(
      matchPercentageSortingFn(makeRow({ matchPercentage: 90 }), makeRow({ matchPercentage: 70 })),
    ).toBe(1);
  });

  it("returns -1 when rowA matchPercentage is smaller", () => {
    expect(
      matchPercentageSortingFn(makeRow({ matchPercentage: 70 }), makeRow({ matchPercentage: 90 })),
    ).toBe(-1);
  });

  it("returns 0 when equal", () => {
    expect(
      matchPercentageSortingFn(makeRow({ matchPercentage: 50 }), makeRow({ matchPercentage: 50 })),
    ).toBe(0);
  });

  it("treats a missing matchPercentage as 0", () => {
    expect(matchPercentageSortingFn(makeRow({}), makeRow({ matchPercentage: 10 }))).toBe(-1);
    expect(matchPercentageSortingFn(makeRow({ matchPercentage: 10 }), makeRow({}))).toBe(1);
    expect(matchPercentageSortingFn(makeRow({}), makeRow({}))).toBe(0);
  });
});

describe("priceSortingFn", () => {
  it("returns 1 when rowA usdPrice is greater", () => {
    expect(priceSortingFn(makeRow({ usdPrice: 29.99 }), makeRow({ usdPrice: 9.99 }))).toBe(1);
  });

  it("returns -1 when rowA usdPrice is smaller", () => {
    expect(priceSortingFn(makeRow({ usdPrice: 9.99 }), makeRow({ usdPrice: 29.99 }))).toBe(-1);
  });

  it("returns 0 when equal", () => {
    expect(priceSortingFn(makeRow({ usdPrice: 5 }), makeRow({ usdPrice: 5 }))).toBe(0);
  });

  it("falls back to price when usdPrice is missing", () => {
    expect(priceSortingFn(makeRow({ price: 20 }), makeRow({ price: 10 }))).toBe(1);
    expect(priceSortingFn(makeRow({ price: 10 }), makeRow({ price: 20 }))).toBe(-1);
  });

  it("prefers usdPrice over price when both present", () => {
    expect(
      priceSortingFn(
        makeRow({ usdPrice: 1, price: 999 }),
        makeRow({ usdPrice: 2, price: 0 }),
      ),
    ).toBe(-1);
  });

  it("treats a fully missing price as 0", () => {
    expect(priceSortingFn(makeRow({}), makeRow({ usdPrice: 1 }))).toBe(-1);
    expect(priceSortingFn(makeRow({}), makeRow({}))).toBe(0);
  });
});

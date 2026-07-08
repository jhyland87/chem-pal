import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as suppliers from "..";
import { SupplierBase } from "../SupplierBase";
import { SupplierFactory } from "../SupplierFactory";

beforeAll(() => {
  setupChromeStorageMock();
});

beforeEach(() => {
  resetChromeStorageMock();
});

const controller = new AbortController();

const makeInstance = (name: keyof typeof suppliers) => {
  const Cls = (suppliers as Record<string, unknown>)[name] as new (
    query: string,
    limit: number,
    controller: AbortController,
  ) => SupplierBase<unknown, Product>;
  return new Cls("", 1, controller);
};

describe("SupplierBase.shipsToCountry", () => {
  it("uses the explicit shipsTo list when the supplier declares one (Ambeed)", () => {
    const ambeed = makeInstance("SupplierAmbeed");
    expect(ambeed.shipsToCountry("US")).toBe(true);
    expect(ambeed.shipsToCountry("GB")).toBe(true);
    // "ZA" (South Africa) is not in Ambeed's shipsTo list.
    expect(ambeed.shipsToCountry("ZA")).toBe(false);
  });

  it("restricts a domestic supplier to its own country (Carolina, US)", () => {
    const carolina = makeInstance("SupplierCarolina");
    expect(carolina.shipsToCountry("US")).toBe(true);
    expect(carolina.shipsToCountry("DE")).toBe(false);
  });

  it("ships everywhere for a worldwide supplier (LiMac, LV)", () => {
    const limac = makeInstance("SupplierLiMac");
    expect(limac.shipsToCountry("US")).toBe(true);
    expect(limac.shipsToCountry("LV")).toBe(true);
  });

  it("ships everywhere for an international supplier (Onyxmet, CA)", () => {
    const onyxmet = makeInstance("SupplierOnyxmet");
    expect(onyxmet.shipsToCountry("US")).toBe(true);
    expect(onyxmet.shipsToCountry("CA")).toBe(true);
  });
});

describe("SupplierFactory.supplierShipsTo", () => {
  it("returns a ships-to boolean for every exported supplier", () => {
    const map = SupplierFactory.supplierShipsTo("US");
    expect(Object.keys(map)).toEqual(Object.keys(suppliers));
    for (const value of Object.values(map)) {
      expect(typeof value).toBe("boolean");
    }
  });

  it("matches each supplier's own shipsToCountry result", () => {
    const map = SupplierFactory.supplierShipsTo("DE");
    // Carolina is US-domestic → does not ship to DE.
    expect(map.SupplierCarolina).toBe(false);
    // LiMac is worldwide → ships to DE.
    expect(map.SupplierLiMac).toBe(true);
  });
});

describe("SupplierFactory.filterByShipping", () => {
  const createMockSupplier = (name: string, shipsTo: string[]) =>
    ({
      supplierName: name,
      shipsToCountry: (location: CountryCode) => shipsTo.includes(location),
    }) as unknown as SupplierBase<unknown, Product>;

  const instances = [
    createMockSupplier("ShipsToUS", ["US", "CA"]),
    createMockSupplier("DomesticDE", ["DE"]),
    createMockSupplier("Worldwide", ["US", "CA", "DE", "GB"]),
  ];

  const makeFactory = (location?: string, exclude: boolean = false) =>
    new SupplierFactory<Product>(
      "test",
      5,
      new AbortController(),
      [],
      true,
      undefined,
      false,
      0,
      [429],
      undefined,
      false,
      location,
      exclude,
    );

  it("keeps only suppliers that ship to the location when enabled", () => {
    const factory = makeFactory("US", true);
    const result = (
      factory as unknown as {
        filterByShipping: (i: SupplierBase<unknown, Product>[]) => SupplierBase<unknown, Product>[];
      }
    ).filterByShipping(instances);
    expect(result.map((r) => r.supplierName)).toEqual(["ShipsToUS", "Worldwide"]);
  });

  it("returns all suppliers when the toggle is off", () => {
    const factory = makeFactory("US", false);
    const result = (factory as any).filterByShipping(instances);
    expect(result).toHaveLength(3);
  });

  it("returns all suppliers when no location is set", () => {
    const factory = makeFactory(undefined, true);
    const result = (factory as any).filterByShipping(instances);
    expect(result).toHaveLength(3);
  });

  it("stores the location and toggle passed to the constructor", () => {
    const factory = makeFactory("DE", true);
    expect((factory as any).location).toBe("DE");
    expect((factory as any).excludeNonShippingSuppliers).toBe(true);
  });
});

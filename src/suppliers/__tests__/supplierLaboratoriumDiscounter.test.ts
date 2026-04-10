import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import eur_to_usd_rate from "../__fixtures__/common/eur-to-usd-rate.json";
import { fixtureData } from "../__fixtures__/helpers/fixtureData";
import { default as SupplierModule } from "../SupplierLaboratoriumDiscounter";
import { spyOnSupplier } from "./helpers/supplierTestUtils";

vi.mock("@/helpers/currency", async () => {
  const actual = await vi.importActual<typeof import("@/helpers/currency")>("@/helpers/currency");
  return {
    ...actual,
    toUSD: vi.fn(() => Promise.resolve(eur_to_usd_rate)),
  };
});

const collectExecuteResults = async (supplier: SupplierModule): Promise<Product[]> => {
  const results: Product[] = [];
  for await (const product of supplier.execute()) {
    results.push(product);
  }
  return results;
};

describe("SupplierLaboratoriumDiscounter", () => {
  // Get the laboratoriumdiscounter fixture data thingy
  const supplierFixtures = fixtureData("laboratoriumdiscounter");

  let supplier: SupplierModule;

  const { queryProductsWithCacheSpy, httpGetJsonMock } = spyOnSupplier(
    SupplierModule,
    supplierFixtures,
  );

  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    // Mock the global fetch function to ensure no test accidentally hits the network.
    global.fetch = vi.fn().mockImplementation(() => {
      throw new Error("Fetch not mocked");
    });
  });

  describe("query", () => {
    beforeEach(() => {
      (queryProductsWithCacheSpy as Mock).mockClear();
      (httpGetJsonMock as Mock).mockClear();
    });

    describe("queryProductsWithCache", () => {
      it("issues search + per-product detail requests on first call", async () => {
        supplier = new SupplierModule("borohydride", 4);
        supplier.initCache();

        const results = await collectExecuteResults(supplier);

        expect(queryProductsWithCacheSpy).toHaveBeenCalledTimes(1);
        // The borohydride search fixture has 4 raw products that group via
        // groupVariants by stripped title — expect 1 search request plus one
        // product detail request per surviving grouped product.
        expect(results.length).toBeGreaterThan(0);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(1 + results.length);
        expect(results[0].title).toBeDefined();
        expect(results[0].supplier).toBe("Laboratorium Discounter");
        for (const product of results) {
          expect(typeof product.id).toBe("number");
        }
      });

      it("uses the cached search results on a second call with the same query", async () => {
        supplier = new SupplierModule("borohydride", 4);
        supplier.initCache();
        const firstResults = await collectExecuteResults(supplier);

        expect(queryProductsWithCacheSpy).toHaveBeenCalledTimes(1);
        const firstCallCount = (httpGetJsonMock as Mock).mock.calls.length;
        expect(firstCallCount).toBe(1 + firstResults.length);

        // A second supplier instance with the same query should hit both the
        // cached search results AND the cached per-product detail data, so no
        // additional HTTP requests are made at all.
        supplier = new SupplierModule("borohydride", 4);
        supplier.initCache();
        const secondResults = await collectExecuteResults(supplier);

        expect(queryProductsWithCacheSpy).toHaveBeenCalledTimes(2);
        expect(secondResults).toHaveLength(firstResults.length);
        expect((httpGetJsonMock as Mock).mock.calls.length).toBe(firstCallCount);
      });
    });
  });
});

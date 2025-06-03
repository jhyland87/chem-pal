import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chromeStorageMock";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import eur_to_usd_rate from "../__fixtures__/common/eur-to-usd-rate.json";
import { fixtureData } from "../__fixtures__/helpers/fixtureData";
import { default as SupplierModule } from "../SupplierLaboratoriumDiscounter";
import { spyOnSupplier } from "./helpers/supplierTestUtils";

vi.mock("@/helpers/currency", () => ({
  toUSD: vi.fn(() => Promise.resolve(eur_to_usd_rate)),
  isParsedPrice: vi.fn(),
}));

describe("SupplierLaboratoriumDiscounter", async () => {
  // Get the laboratoriumdiscounter fixture data thingy
  const supplierFixtures = fixtureData("laboratoriumdiscounter");
  // Load up the borohyride search content
  const searchBorohydride = supplierFixtures.search("borohydride");
  // Results from one of the borohydride searches (not the same as the raw http response from supplier)
  const searchBorohydrideRaw = await searchBorohydride("results");

  let supplier: SupplierModule;

  const { getCachedResultsSpy, httpGetJsonMock } = spyOnSupplier(SupplierModule, supplierFixtures);

  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    // Mock the global fetch function to handle both search and product detail requests
    global.fetch = vi.fn().mockImplementation((url) => {
      throw new Error("Fetch not mocked");
    });
  });

  describe("query", () => {
    beforeEach(async () => {
      (getCachedResultsSpy as Mock).mockClear();
      (httpGetJsonMock as Mock).mockClear();
    });

    describe("getCachedResults", () => {
      it("should not have cached result on first call", async () => {
        supplier = new SupplierModule("borohydride", 4);

        const results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(getCachedResultsSpy).toHaveBeenCalledTimes(1);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);
        expect(results).toHaveLength(4);
        expect(results.map((r) => r.id)).toEqual(searchBorohydrideRaw.map((r: any) => r.id));
        expect(results[0].title).toBeDefined();
      });

      it("should use cached result on second call", async () => {
        supplier = new SupplierModule("borohydride", 4);

        let results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(getCachedResultsSpy).toHaveBeenCalledTimes(1);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);
        expect(results).toHaveLength(4);

        supplier = new SupplierModule("borohydride", 4);

        results = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(getCachedResultsSpy).toHaveBeenCalledTimes(2);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);
        expect(results).toHaveLength(4);
      });
    });

    describe.skip("async iteration", () => {
      it("should abort when given the signal", async () => {
        const mockAbortController = new AbortController();
        supplier = new SupplierModule("borohydride", 4);

        let results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);

          mockAbortController.abort();
        }

        expect(results).toHaveLength(1);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(1);
        //expect(getCachedResultsSpy).toHaveBeenCalledTimes(0);
      });
    });
  });
});

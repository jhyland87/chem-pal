import type { Product } from "@/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import eur_to_usd_rate from "../__fixtures__/common/eur-to-usd-rate.json";
import { fixtureData } from "../__fixtures__/helpers/fixtureData";
import SupplierLaboratoriumDiscounter from "../supplierLaboratoriumDiscounter";
import * as chromeTestUtils from "./helpers/chromeTestUtils";
import { spyOnSupplier } from "./helpers/supplierTestUtils";

vi.mock("@/helpers/currency", () => ({
  toUSD: vi.fn(() => Promise.resolve(eur_to_usd_rate)),
  isParsedPrice: vi.fn(),
}));

process.env.LOG_LEVEL = "DEBUG";

describe("SupplierLaboratoriumDiscounter", async () => {
  const laboratoriumiscounter_fixtures = fixtureData("laboratoriumdiscounter");
  const borohydride_search = laboratoriumiscounter_fixtures.search("borohydride");
  const borohydride_search_raw = await borohydride_search("results");

  let supplier: SupplierLaboratoriumDiscounter;
  let mockAbortController: AbortController;

  const { getCachedResultsSpy, httpGetJsonMock } = spyOnSupplier(
    SupplierLaboratoriumDiscounter,
    laboratoriumiscounter_fixtures,
  );

  beforeEach(() => {
    chromeTestUtils.setupChromeMock();
    mockAbortController = new AbortController();
    // Mock the global fetch function to handle both search and product detail requests
    global.fetch = vi.fn().mockImplementation((url) => {
      throw new Error("Fetch not mocked");
    });
  });

  afterEach(() => {
    chromeTestUtils.resetChromeMock();
  });

  describe("search", () => {
    describe("_getCachedResults", () => {
      beforeEach(async () => {
        //clearChromeMock();
        //getCachedResultsSpy.mockReset();
        //httpGetJsonMock.mockReset();
        //chromeTestUtils.resetChromeMock();
        //borohydride_search = laboratoriumiscounter_fixtures.search("borohydride");
        //borohydride_search_raw = await borohydride_search("results");
      });
      it.skip("should not have cached result on first call", async () => {
        //getCachedResultsSpy.mockClear();
        supplier = new SupplierLaboratoriumDiscounter("borohydride", 4, mockAbortController);

        const results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(results).toHaveLength(4);
        expect(results[0].title).toBeDefined();
        expect(results.map((r) => r.id)).toEqual(borohydride_search_raw.map((r: any) => r.id));
        expect(getCachedResultsSpy).toHaveBeenCalledTimes(1);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);
      });

      it("should use cached result on second call", async () => {
        supplier = new SupplierLaboratoriumDiscounter("borohydride", 4, mockAbortController);

        let results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(results).toHaveLength(4);
        expect(getCachedResultsSpy).toHaveBeenCalledTimes(1);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);

        supplier = new SupplierLaboratoriumDiscounter("borohydride", 4, mockAbortController);

        results = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(results).toHaveLength(4);
        expect(getCachedResultsSpy).toHaveBeenCalledTimes(2);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);
      });
    });

    describe("AbortController", () => {
      it("should abort the request", async () => {
        supplier = new SupplierLaboratoriumDiscounter("borohydride", 4, mockAbortController);

        mockAbortController.abort();

        const results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(results).toHaveLength(0);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(0);
        expect(getCachedResultsSpy).toHaveBeenCalledTimes(0);
      });
    });
  });
});

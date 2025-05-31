import type { Product } from "@/types";
import eur_to_usd_rate from "../__fixtures__/common/eur-to-usd-rate.json";
import { mockChromeStorage } from "../__fixtures__/helpers/chromeStorageMock";
import { fixtureData } from "../__fixtures__/helpers/fixtureData";
import SupplierLaboratoriumDiscounter from "../supplierLaboratoriumDiscounter";

jest.mock("@/helpers/currency", () => ({
  toUSD: jest.fn(() => Promise.resolve(eur_to_usd_rate)),
  isParsedPrice: jest.fn(),
}));

Object.assign(global, { chrome: mockChromeStorage });

process.env.LOG_LEVEL = "DEBUG";

describe("SupplierLaboratoriumDiscounter", () => {
  const laboratoriumiscounter_fixtures = fixtureData("laboratoriumdiscounter");
  let borohydride_search: any;
  let borohydride_search_raw: any;

  let supplier: SupplierLaboratoriumDiscounter;
  let mockAbortController: AbortController;
  let getCachedResultsSpy: any;
  let httpGetJsonMock: any;

  beforeEach(() => {
    // Clear localStorage before each test
    //localStorage.clear();

    // Mock the global fetch function to handle both search and product detail requests
    global.fetch = jest.fn().mockImplementation((url) => {
      throw new Error("Fetch not mocked");
    });

    getCachedResultsSpy = jest.spyOn(SupplierLaboratoriumDiscounter.prototype, "_getCachedResults");
    httpGetJsonMock = jest
      .spyOn(SupplierLaboratoriumDiscounter.prototype, "_httpGetJson" as any)
      .mockImplementation(async (data: { path: string; params?: Record<string, string> }) => {
        return await laboratoriumiscounter_fixtures.httpGetJson(data.path);
      });

    mockAbortController = new AbortController();
  });

  describe("search", () => {
    beforeEach(async () => {
      borohydride_search = laboratoriumiscounter_fixtures.search("borohydride");
      borohydride_search_raw = await borohydride_search("results");
    });

    describe("_getCachedResults", () => {
      it("should not have cached result on first call", async () => {
        supplier = new SupplierLaboratoriumDiscounter("borohydride", 4, mockAbortController);

        const results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(getCachedResultsSpy).toHaveBeenCalledTimes(1);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);
        expect(results).toHaveLength(4);
        expect(results.map((r) => r.id)).toEqual(borohydride_search_raw.map((r: any) => r.id));
        expect(results[0].title).toBeDefined();
      });

      it("should use cached result on second call", async () => {
        supplier = new SupplierLaboratoriumDiscounter("borohydride", 4, mockAbortController);

        const results: Product[] = [];
        for await (const product of supplier) {
          results.push(product);
        }

        expect(getCachedResultsSpy).toHaveBeenCalledTimes(2);
        expect(httpGetJsonMock).toHaveBeenCalledTimes(5);
        expect(results).toHaveLength(4);
      });
    });
  });
});

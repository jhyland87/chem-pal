import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import eur_to_usd_rate from "../__fixtures__/common/eur-to-usd-rate.json";
import { fixtureData } from "../__fixtures__/helpers/fixtureData";
import { default as SupplierModule } from "../SupplierMacklin";
import { spyOnSupplier } from "./helpers/supplierTestUtils";

vi.mock("@/helpers/currency", () => ({
  toUSD: vi.fn(() => Promise.resolve(eur_to_usd_rate)),
  isParsedPrice: vi.fn(),
}));

//Object.assign(global, { chrome: mockChromeStorage });

//process.env.LOG_LEVEL = "DEBUG";

describe.skip("SupplierMacklin", async () => {
  const supplierFixtures = fixtureData("macklin");
  //const searchBorohydride = supplierFixtures.search("borohydride-limit-13-raw-http-response.json");
  //const searchBorohydrideRaw = await searchBorohydride("results");

  let supplier: SupplierModule;

  const { getCachedResultsSpy, httpGetJsonMock, titleSelectorSpy } = spyOnSupplier(
    SupplierModule,
    supplierFixtures,
  );

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

  describe("titleSelector", () => {
    it("should return the title of the product", async () => {
      supplierFixtures.nextFixture = "search-borohydride-limit-13-raw-http-response.json";
      supplier = new SupplierModule("borohydride", 4);
      const searchBorohydrideRaw = await supplierFixtures.search("borohydride")(
        "limit-13-raw-http-response",
      );

      const products = Object.values(searchBorohydrideRaw.data.list)[0] as any[];

      expect(supplier["titleSelector"](products[0])).toBe(products[0].item_en_name);
    });
  });

  describe("generateString", () => {
    it("should generate a 36 character UUIDv4 string if given no limit parameter", () => {
      //const random = vi.spyOn(Math, "random");
      //random.mockReturnValue(0.1);
      expect(supplier["generateString"]()).toMatch(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      );
    });

    it("should not generate a duplicate string.", () => {
      //const random = vi.spyOn(Math, "random");
      //random.mockReturnValue(0.1);
      const string1 = supplier["generateString"]();
      const string2 = supplier["generateString"]();
      expect(string1).not.toBe(string2);
    });

    it("should generate a string of the given length if given a limit", () => {
      const string = supplier["generateString"](10);
      expect(string).toHaveLength(10);
    });

    it("should generate a string of the given length and char set size", () => {
      const string = supplier["generateString"](10, 10);
      expect(string).toHaveLength(10);
      expect(string).toMatch(/^[0-9]{10}$/);
    });

    it("should have a predictable output if Maath.random is mocked", () => {
      const random = vi.spyOn(Math, "random");
      random.mockReturnValue(0.1);
      const string = supplier["generateString"]();
      expect(string).toBe("11111111-1111-4111-9111-111111111111");
    });
  });

  describe("signRequest", () => {
    it("should sign the request", () => {
      const headers = {
        "X-Agent": "web",
        "X-User-Token": "",
        "X-Device-Id": "trT2XykLGPrTfu13",
        "X-Language": "en",
        "X-Timestamp": "1748825522",
      };

      const params = {
        keyword: "chromium",
        limit: 90,
        page: 1,
        timestampe: 1748825522654,
      };

      expect(supplier["signRequest"](headers, params)).toBe(
        "ea049a94acf95900b058fa7c7af6eceeb3db971ea2d4b831d1ef549b529efeed",
      );
    });
  });

  describe("generateRequestTimestamp", () => {
    it("should generate a predictable timestamp with no lastSignature valueif Math.random and Date.now are mocked", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      vi.spyOn(Date, "now").mockReturnValue(1748825697049);
      const timestamp = supplier["generateRequestTimestamp"]();
      expect(timestamp).toBe(1748825697050);
    });

    it("should change if the signature is different", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      vi.spyOn(Date, "now").mockReturnValue(1748825697049);
      const timestampA = supplier["generateRequestTimestamp"]();
      supplier["lastSignature"] = "1234567890";
      const timestampB = supplier["generateRequestTimestamp"]();
      expect(timestampA).not.toBe(timestampB);
    });
  });
});

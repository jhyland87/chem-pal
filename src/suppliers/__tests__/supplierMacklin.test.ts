import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chromeStorageMock";
import { beforeAll, beforeEach, describe, vi, type Mock } from "vitest";
import eur_to_usd_rate from "../__fixtures__/common/eur-to-usd-rate.json";
import { fixtureData } from "../__fixtures__/helpers/fixtureData";
import { default as SupplierModule } from "../supplierMacklin";
import { spyOnSupplier } from "./helpers/supplierTestUtils";

vi.mock("@/helpers/currency", () => ({
  toUSD: vi.fn(() => Promise.resolve(eur_to_usd_rate)),
  isParsedPrice: vi.fn(),
}));

//Object.assign(global, { chrome: mockChromeStorage });

process.env.LOG_LEVEL = "DEBUG";

describe("SupplierMacklin", async () => {
  const supplierFixtures = fixtureData("macklin");
  const searchBorohydride = supplierFixtures.search("borohydride");
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
  });
});

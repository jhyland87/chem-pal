import { CAS_REGEX } from "@/constants/common";
import { findCAS, getCASByName, getIUPACName, getNamesByCAS } from "@/helpers/cas";
import { isCAS } from "@/utils/typeGuards/common";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
  type Mock,
} from "vitest";

describe("CAS Helpers", () => {
  describe("CAS_REGEX", () => {
    it("should be a valid regex", () => expect(CAS_REGEX).toBeInstanceOf(RegExp));
  });

  describe("isCAS", () => {
    test.each([
      ["1234-56-6", true],
      ["50-00-0", true],
      ["1234-56-999", false],
      ["1234-56", false],
      ["1234-56-0", false],
      ["0000-00-0", false],
      ["00-10-0", false],
      ["test", false],
      ["1234-56-6-1234-56-6", false],
    ])("should return %s for CAS number: %s", (input, output) => expect(isCAS(input)).toBe(output));
  });

  describe("findCAS", () => {
    test.each([
      ["Example of a valid cas: 1234-56-6..", "1234-56-6"],
      ["and 50-00-0 is another valid cas #", "50-00-0"],
      ["Example of an invalid cas: 1232-56-6..", undefined],
      ["and 50-00-1 is another valid cas #", undefined],
    ])("should return %s for content: %s", (input, output) => expect(findCAS(input)).toBe(output));
  });

  describe("getCASByName", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      (global.fetch as Mock).mockImplementation((data: string) => {
        //console.log("fetch called with:", data);
        let result;
        if (data.includes(encodeURIComponent("sulfuric acid"))) {
          result = "12772-98-4";
        } else if (data.includes(encodeURIComponent("Chloracetic acid"))) {
          result = "579-11-8";
        } else if (data.includes(encodeURIComponent("toluene"))) {
          result = "3101-08-4\n50643-04-4\n108-88-3";
        } else if (data.includes(encodeURIComponent("acetone"))) {
          result = "67-64-1";
        } else {
          result = undefined;
        }
        //console.log("Returning:", result);
        return Promise.resolve({
          text: () => Promise.resolve(result),
        } as unknown as Response);
      });
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    test.each([
      ["sulfuric acid", "12772-98-4"],
      ["acetone", "67-64-1"], // Returns an invalid cas
      ["toluene", "3101-08-4"], // Returns an invalid cas
      ["test", undefined], // Returns an invalid cas
    ])("should return %s for CAS number: %s", async (input, output) => {
      const cas = await getCASByName(input);
      expect(cas).toBe(output);
    });
  });

  describe("getNamesByCAS", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      (global.fetch as Mock).mockImplementation((data: string) => {
        //console.log("fetch called with:", data);
        let result;
        if (data.includes(encodeURIComponent("12772-98-4"))) {
          result = "sulfuric acid";
        } else if (data.includes(encodeURIComponent("579-11-8"))) {
          result = "Chloracetic acid";
        } else if (data.includes(encodeURIComponent("3101-08-4"))) {
          result = "toluene";
        } else if (data.includes(encodeURIComponent("67-64-1"))) {
          result = "acetone";
        } else {
          result = undefined;
        }
        //console.log("Returning:", result);
        return Promise.resolve({
          text: () => Promise.resolve(result),
        } as unknown as Response);
      });
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    test.each([
      ["12772-98-4", "sulfuric acid"],
      ["67-64-1", "acetone"], // Returns an invalid cas
      ["3101-08-4", "toluene"], // Returns an invalid cas
      ["12312312", undefined], // Returns an invalid cas
    ])("should return %s for CAS number: %s", async (input, output) => {
      const cas = await getNamesByCAS(input as `${string}-${string}-${string}`);
      if (output === undefined) {
        expect(cas).toBeUndefined();
      } else {
        expect(cas).toContain(output);
      }
    });

    it("splits and trims multi-line name responses", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        text: () => Promise.resolve("  acetone \n propanone "),
      } as unknown as Response);
      const names = await getNamesByCAS("67-64-1" as `${string}-${string}-${string}`);
      expect(names).toEqual(["acetone", "propanone"]);
    });

    it("returns undefined for an empty response body", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        text: () => Promise.resolve(""),
      } as unknown as Response);
      const names = await getNamesByCAS("67-64-1" as `${string}-${string}-${string}`);
      expect(names).toBeUndefined();
    });

    it("returns undefined and logs when fetch rejects", async () => {
      (global.fetch as Mock).mockRejectedValueOnce(new Error("network"));
      const names = await getNamesByCAS("67-64-1" as `${string}-${string}-${string}`);
      expect(names).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("getCASByName (edge cases)", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });
    afterEach(() => (global.fetch as Mock).mockReset());

    it("returns undefined when no line is a valid CAS", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        text: () => Promise.resolve("not-a-cas\nalso-not"),
      } as unknown as Response);
      expect(await getCASByName("mystery")).toBeUndefined();
    });

    it("returns undefined and logs when fetch rejects", async () => {
      (global.fetch as Mock).mockRejectedValueOnce(new Error("network"));
      expect(await getCASByName("acetone")).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("getIUPACName", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });
    afterEach(() => (global.fetch as Mock).mockReset());

    it("returns the trimmed IUPAC name", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        text: () => Promise.resolve("  propan-2-one \n"),
      } as unknown as Response);
      expect(await getIUPACName("acetone")).toBe("propan-2-one");
    });

    it("returns undefined for an empty response", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        text: () => Promise.resolve(""),
      } as unknown as Response);
      expect(await getIUPACName("nope")).toBeUndefined();
    });
  });
});

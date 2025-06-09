import { describe, expect, it } from "vitest";
import {
  assertIsAmbeedProductListResponse,
  isAmbeedProductListResponse,
  isAmbeedProductListResponsePriceList,
  isAmbeedProductListResponseResultItem,
  isAmbeedProductListResponseValue,
  isAmbeedSearchResponseProduct,
} from "../ambeed";

describe("Ambeed Type Guards", () => {
  describe("isAmbeedProductListResponse", () => {
    it("should return true for valid AmbeedProductListResponse", () => {
      const validResponse = {
        source: 1,
        code: 200,
        lang: "en",
        value: {
          total: 100,
          pagenum: 1,
          pageindex: 0,
          pagesize: 20,
          result: [],
          menu_res: {
            menu_count: 0,
            menu_list: [],
            one_menu_list: [],
            submenu_list: [],
          },
        },
        time: "2024-03-20T12:00:00Z",
      };
      expect(isAmbeedProductListResponse(validResponse)).toBe(true);
    });

    it("should return false for invalid AmbeedProductListResponse", () => {
      const invalidResponses = [
        null,
        undefined,
        {},
        { source: "1" }, // wrong type
        { source: 1, code: "200" }, // wrong type
        { source: 1, code: 200 }, // missing required fields
      ];

      invalidResponses.forEach((response) => {
        expect(isAmbeedProductListResponse(response)).toBe(false);
      });
    });
  });

  describe("assertIsAmbeedProductListResponse", () => {
    it("should not throw for valid AmbeedProductListResponse", () => {
      const validResponse = {
        source: 1,
        code: 200,
        lang: "en",
        value: {
          total: 100,
          pagenum: 1,
          pageindex: 0,
          pagesize: 20,
          result: [],
          menu_res: {
            menu_count: 0,
            menu_list: [],
            one_menu_list: [],
            submenu_list: [],
          },
        },
        time: "2024-03-20T12:00:00Z",
      };
      expect(() => assertIsAmbeedProductListResponse(validResponse)).not.toThrow();
    });

    it("should throw for invalid AmbeedProductListResponse", () => {
      const invalidResponse = { source: "1" };
      expect(() => assertIsAmbeedProductListResponse(invalidResponse)).toThrow();
    });
  });

  describe("isAmbeedProductListResponseValue", () => {
    it("should return true for valid AmbeedProductListResponseValue", () => {
      const validValue = {
        total: 100,
        pagenum: 1,
        pageindex: 0,
        pagesize: 20,
        result: [],
        menu_res: {
          menu_count: 0,
          menu_list: [],
          one_menu_list: [],
          submenu_list: [],
        },
      };
      expect(isAmbeedProductListResponseValue(validValue)).toBe(true);
    });

    it("should return false for invalid AmbeedProductListResponseValue", () => {
      const invalidValues = [
        null,
        undefined,
        {},
        { total: "100" }, // wrong type
        { total: 100, pagenum: "1" }, // wrong type
        { total: 100 }, // missing required fields
      ];

      invalidValues.forEach((value) => {
        expect(isAmbeedProductListResponseValue(value)).toBe(false);
      });
    });
  });

  describe("isAmbeedProductListResponseResultItem", () => {
    it("should return true for valid AmbeedProductListResponseResultItem", () => {
      const validItem = {
        p_id: "123",
        priceList: [],
        p_proper_name3: "Test Product",
        p_am: "AM123",
        s_url: "https://example.com",
        p_name_en: "Test Product",
        p_cas: "123-45-6",
      };
      expect(isAmbeedProductListResponseResultItem(validItem)).toBe(true);
    });

    it("should return false for invalid AmbeedProductListResponseResultItem", () => {
      const invalidItems = [
        null,
        undefined,
        {},
        { p_id: 123 }, // wrong type
        { p_id: "123", priceList: "not-an-array" }, // wrong type
        { p_id: "123" }, // missing required fields
      ];

      invalidItems.forEach((item) => {
        expect(isAmbeedProductListResponseResultItem(item)).toBe(false);
      });
    });
  });

  describe("isAmbeedProductListResponsePriceList", () => {
    it("should return true for valid AmbeedProductListResponsePriceList", () => {
      const validPriceList = {
        pr_am: "100",
        pr_usd: "1.00",
        pr_id: 1,
        discount_usd: "0.90",
        pr_size: "10g",
        vip_usd: "0.95",
        pr_rate: 1,
      };
      expect(isAmbeedProductListResponsePriceList(validPriceList)).toBe(true);
    });

    it("should return false for invalid AmbeedProductListResponsePriceList", () => {
      const invalidPriceLists = [
        null,
        undefined,
        {},
        { pr_am: 100 }, // wrong type
        { pr_am: "100", pr_usd: 1.0 }, // wrong type
        { pr_am: "100" }, // missing required fields
      ];

      invalidPriceLists.forEach((priceList) => {
        expect(isAmbeedProductListResponsePriceList(priceList)).toBe(false);
      });
    });
  });

  describe("isAmbeedSearchResponseProduct", () => {
    it("should return true for valid AmbeedSearchResponseProduct", () => {
      const validResponse = {
        source: 1,
        code: 200,
        lang: "en",
        value: {
          product_res: [],
        },
        time: "2024-03-20T12:00:00Z",
      };
      expect(isAmbeedSearchResponseProduct(validResponse)).toBe(true);
    });

    it("should return false for invalid AmbeedSearchResponseProduct", () => {
      const invalidResponses = [
        null,
        undefined,
        {},
        { source: "1" }, // wrong type
        { source: 1, code: "200" }, // wrong type
        { source: 1, code: 200 }, // missing required fields
      ];

      invalidResponses.forEach((response) => {
        expect(isAmbeedSearchResponseProduct(response)).toBe(false);
      });
    });
  });
});

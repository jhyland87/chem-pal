/* eslint-disable @typescript-eslint/naming-convention */
import type { Product } from "@/types";
import valid_5_count_result from "../__mocks__/shopify/valid_5_count.json";
import SupplierBaseShopify from "../supplierBaseShopify";

class SupplierBaseShopifyMock extends SupplierBaseShopify {
  public readonly supplierName = "MyClass";
  protected _baseURL = "https://myclass.com";
  protected _apiKey = "test-api-key";
  protected _apiHost = "searchserverapi.com";
}
describe("SupplierBaseShopify", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("extended by SupplierBaseShopifyMock", () => {
    let supplier: SupplierBaseShopifyMock;

    it("should return no more than 2 results", async () => {
      const resultLimit = 4;
      supplier = new SupplierBaseShopifyMock("test", resultLimit, new AbortController());

      const mockBaseMethod = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SupplierBaseShopifyMock.prototype, "_httpGetJson" as any)
        .mockImplementation(() => valid_5_count_result);

      const results: Product[] = [];
      for await (const result of supplier) {
        console.log(result);
        results.push(result);
      }

      expect(mockBaseMethod).toHaveBeenCalled();
      expect(results).toHaveLength(resultLimit);
      expect(results.map((r) => r.id)).toEqual(
        valid_5_count_result.items.slice(0, resultLimit).map((item) => item.product_id),
      );
    });

    it("should return nothing when an unexpected response structure is given", async () => {
      supplier = new SupplierBaseShopifyMock("test", 4, new AbortController());

      const mockBaseMethod = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(SupplierBaseShopifyMock.prototype, "_httpGetJson" as any)
        .mockImplementation(() => ({
          items: [
            {
              id: 1,
              name: "Product 1",
            },
          ],
        }));

      const results: Product[] = [];
      for await (const result of supplier) {
        console.log(result);
        results.push(result);
      }

      expect(mockBaseMethod).toHaveBeenCalled();
      expect(results).toHaveLength(0);
    });
  });
});

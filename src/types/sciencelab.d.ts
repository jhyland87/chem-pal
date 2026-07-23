declare global {
  /**
   * A single price block from the ScienceLab (BigCommerce) product-attributes
   * endpoint. `value` is the numeric amount; `formatted` is the display string.
   */
  interface ScienceLabPrice {
    formatted?: string;
    value?: number;
    currency?: string;
  }

  /**
   * The `data` payload of the BigCommerce `remote/v1/product-attributes/{id}`
   * response, describing the selected variant (attribute combination). Every
   * field is optional; the supplier only reads the price and stock flags.
   */
  interface ScienceLabAttributeData {
    sku?: string;
    mpn?: string;
    instock?: boolean;
    purchasable?: boolean;
    /** Price of the selected variant, before tax. */
    price?: {
      without_tax?: ScienceLabPrice;
      with_tax?: ScienceLabPrice;
      tax_label?: string;
    };
  }

  /**
   * Response shape of the BigCommerce product-attributes AJAX endpoint
   * (`POST remote/v1/product-attributes/{product_id}`) used to price one size
   * variant. `data` carries the selected combination's price and stock.
   */
  interface ScienceLabAttributeResponse {
    content?: string;
    data?: ScienceLabAttributeData;
  }
}

// This export is needed to make the file a module
export {};

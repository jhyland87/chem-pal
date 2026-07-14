declare global {
  /**
   * A single attribute of a PrestaShop product combination, keyed by attribute
   * group id in {@link LeroChemDataProduct.attributes}. For LeroChem the only
   * group is "Size/capacity", whose `name` is a pack size like "1 L" or "5 L".
   */
  interface LeroChemAttribute {
    id_attribute?: string;
    id_attribute_group?: string;
    /** Human label of the selected value, e.g. "1 L". */
    name?: string;
    /** Group label, e.g. "Size/capacity". */
    group?: string;
  }

  /**
   * The JSON held in the `#product-details` element's `data-product` dataset
   * (and re-emitted inside the variant `refresh` AJAX response). Describes the
   * currently-selected combination of a PrestaShop product.
   */
  interface LeroChemDataProduct {
    id?: number | string;
    id_product?: number | string;
    id_product_attribute?: number | string;
    name?: string;
    /** Numeric price of the selected combination, e.g. 5.2. */
    price_amount?: number;
    /** Display price with currency, e.g. "5.20 €". */
    price?: string;
    /** Contains "… CAS <number> …" for most chemicals. */
    meta_description?: string;
    description?: string;
    description_short?: string;
    link?: string;
    /** Selected combination's attributes, keyed by attribute group id. */
    attributes?: Record<string, LeroChemAttribute>;
  }

  /** The `offers` node of a LeroChem product schema.org `ld+json` block. */
  interface LeroChemProductOffer {
    price?: string;
    priceCurrency?: string;
    /** schema.org availability URL, e.g. "https://schema.org/PreOrder". */
    availability?: string;
  }

  /**
   * The schema.org `"@type": "Product"` `ld+json` block embedded on LeroChem
   * product pages.
   */
  interface LeroChemProductLd {
    "@type"?: string;
    name?: string;
    /** Equal to the numeric product id. */
    sku?: string;
    image?: string | string[];
    offers?: LeroChemProductOffer;
  }

  /**
   * Response shape of the PrestaShop product `refresh` AJAX endpoint
   * (`controller=product&action=refresh`) used to price a non-default size.
   * `product_details` is an HTML fragment carrying the selected combination's
   * `data-product` dataset.
   */
  interface LeroChemVariantRefresh {
    id_product_attribute?: number | string;
    product_title?: string;
    product_url?: string;
    product_details?: string;
  }
}

// This export is needed to make the file a module
export {};

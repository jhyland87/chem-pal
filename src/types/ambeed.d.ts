 
declare global {
  /** Base interface for all Ambeed API responses */
  interface AmbeedResponseBase {
    /** The timestamp of the response */
    time: string;
    /** The language of the response */
    lang: string;
    /** The source of the response */
    source: number;
    /** The response code */
    code: number;
  }

  /**
   * SEARCH QUERY RESPONSE INTERFACES
   * Endpoint: POST webapi/v1/searchquery
   */

  /**
   * Represents a product object from the Ambeed API
   */
  interface AmbeedProductObject {
    /** The type of the product */
    type: string;
    /** The URL to the product page */
    url: string;
    /** The menu category ID */
    s_menucat: number;
    /** The purity level of the product */
    purity_item: string;
    /** The display name of the product */
    show_name: string;
    /** The English name of the product */
    nameEn: string;
    /** The MDL number of the product, if available */
    mdl: string | null;
    /** The raw display name of the product */
    show_name_raw: string;
    /** The proper name of the product */
    p_proper_name3: string;
    /** The CAS number of the product */
    cas: string;
  }

  /**
   * Represents a search response from the Ambeed API
   */
  interface AmbeedSearchResponseProduct extends AmbeedResponseBase {
    /** The value containing product results */
    value: {
      /** Array of product objects */
      product_res: AmbeedProductObject[];
    };
  }

  /**
   * Parameters for searching products in the Ambeed API
   */
  interface AmbeedSearchParams {
    /** The search keyword */
    keyword: string;
    /** Optional country filter */
    country?: string;
    /** Optional menu ID filter */
    one_menu_id?: number;
    /** Optional life science menu ID filter */
    one_menu_life_id?: number;
    /** Optional menu ID filter */
    menu_id?: number;
  }

  /** Represents encoded search parameters */
  type EncodedSearchParams = Base64String;

  /**
   * Response from the Ambeed product list API
   */
  export interface AmbeedProductListResponse extends AmbeedResponseBase {
    /** The response value containing product list data */
    value: AmbeedProductListResponseValue;
  }

  /**
   * Value object containing product list data
   */
  export interface AmbeedProductListResponseValue {
    /** Total number of products */
    total: number;
    /** Current page number */
    pagenum: number;
    /** Current page index */
    pageindex: number;
    /** Number of items per page */
    pagesize: number;
    /** Array of product result items */
    result: AmbeedProductListResponseResultItem[];
    /** Optional array of all purity levels */
    all_purity?: unknown[];
    /** Optional array of all sizes */
    all_size?: unknown[];
    /** Optional repeat number */
    repeat_num?: number;
    /** Optional member rate */
    mem_rate?: null;
    /** Menu response data */
    menu_res: AmbeedProductListMenuRes;
  }

  /**
   * Menu response data structure
   */
  export interface AmbeedProductListMenuRes {
    /** Number of menus */
    menu_count: number;
    /** Array of menu items */
    menu_list: unknown[];
    /** Array of one menu items */
    one_menu_list: unknown[];
    /** Array of submenu items */
    submenu_list: unknown[];
  }

  /**
   * Individual product result item from the product list
   */
  export interface AmbeedProductListResponseResultItem {
    /** Optional product image URL */
    p_proimg?: string;
    /** Product ID */
    p_id: string;
    /** Array of price lists for the product */
    priceList: AmbeedProductListResponsePriceList[];
    /** Optional molecular weight */
    p_moleweight?: string;
    /** Proper name of the product */
    p_proper_name3: string;
    /** Optional maximum quantity */
    p_wm_max_quantity?: string;
    /** Product AM identifier */
    p_am: string;
    /** Product URL */
    s_url: string;
    /** Optional sort order */
    sort?: number;
    /** Product name in English */
    p_name_en: string;
    /** Optional boiling point */
    p_boilingpoint?: string;
    /** Optional purity level */
    p_purity?: string;
    /** Whether the product is for life science */
    p_is_life_science?: boolean;
    /** Optional InChIKey2 */
    p_inchikey2?: string;
    /** CAS number */
    p_cas: string;
    /** Optional BD value */
    p_bd?: string;
    /** Optional InChIKey */
    p_inchikey?: string;
    /** Optional molecular formula */
    p_moleform?: string;
    /** Optional storage conditions */
    p_storage?: string;
    /** Optional MDL number */
    p_mdl?: string;
  }
  /**
   * Price list item for a product
   */
  export interface AmbeedProductListResponsePriceList {
    /** Price in AM currency */
    pr_am: string;
    /** Price in USD */
    pr_usd: string;
    /** Price ID */
    pr_id: number;
    /** Discounted price in USD */
    discount_usd: string;
    /** Product size/quantity */
    pr_size: QuantityString;
    /** VIP price in USD */
    vip_usd: string;
    /** Price rate */
    pr_rate: number;
  }

  /**
   * PRODUCT PRICE RESPONSE INTERFACES
   * Endpoint: POST webapi/v1/product_price
   */

  /** Root of the product price response body returned by `webapi/v1/product_price`. */
  export interface AmbeedProductPriceResponse extends AmbeedResponseBase {
    /** The response value containing per-variant pricing and product info. */
    value: AmbeedProductPriceResponseValue;
  }

  /**
   * Value object of the product price response. Each `BD…_…` key maps a batch/size
   * group to its list of priced variants, alongside the shared `proInfo` block.
   */
  export interface AmbeedProductPriceResponseValue {
    /** Variant lists keyed by batch identifier (e.g. `BD123_4`). */
    [variantKey: `BD${string}_${string}`]: AmbeedProductPriceResponseVariantItem[];
    /** Shared product information common to every variant. */
    proInfo: AmbeedProductPriceProInfo;
  }

  /** Shared product information returned alongside the priced variants. */
  export interface AmbeedProductPriceProInfo {
    /** Estimated lead time for the product. */
    p_leadtime: string;
    /** Whether the product is currently active/available. */
    p_status: boolean;
    /** Proper (canonical) name of the product. */
    p_proper_name3: string;
    /** Whether the product is held in supplier stock (`1`/`0`). */
    p_issupplierstock: number;
    /** Number of variants in the price list. */
    listLength: number;
    /** Product name in English. */
    p_name_en: string;
    /** Display unit for the product. */
    unit: string;
    /** Product AM identifier. */
    p_am: string;
    /** Whether the product can be split into smaller quantities. */
    p_split: boolean;
  }

  /** A single priced variant within the product price response. */
  export interface AmbeedProductPriceResponseVariantItem {
    /** Product ID this variant belongs to. */
    pr_proid: string;
    /** Product name in English. */
    p_name_en: string;
    /** Price in USD. */
    pr_usd: string;
    /** Human-readable shipping description. */
    p_shipping_show: string;
    /** Storage conditions for the variant. */
    p_storage: string;
    /** VIP price in USD. */
    vip_usd: string;
    /** Whether the variant is a spot good (`1`/`0`). */
    p_is_spot_goods: number;
    /** Price rate. */
    pr_rate: number;
    /** Price ID. */
    pr_id: number;
    /** Variant size/quantity. */
    pr_size: QuantityString;
    /** New/promotional price. */
    newprice: string;
    /** Free-text remark for the price entry. */
    pr_remark: string;
    /** Variant AM identifier. */
    pr_am: string;
    /** Variant batch (BD) identifier. */
    pr_bd: string;
    /** Whether this is a large size with no listed price (`1`/`0`). */
    pr_is_large_size_no_price: number;
    /** Purity level of the variant. */
    p_purity: string;
    /** Spot-brand remark. */
    p_spot_brand_remark: string;
    /** Discounted price in USD. */
    discount_usd: string;
    /** Whether the variant is sold as a package. */
    pr_ispackage: boolean;
  }

  /**
   * PRODUCT STOCK RESPONSE INTERFACES
   * Endpoint: POST webapi/v1/product_stock
   */
  /** Root of the product stock response body returned by `webapi/v1/product_stock`. */
  export interface AmbeedProductStockResponse extends AmbeedResponseBase {
    /** Per-size stock rows, or an empty array when no stock data is available. */
    value:
      | {
          /** Whether the China warehouse has stock (`1`/`0`). */
          has_stock_quantitychina: number;
          /** Whether the AM789 warehouse has stock (`1`/`0`). */
          has_stock_quantityam789: number;
          /** Size/quantity this stock row applies to. */
          size: SizeString | string;
          /** Quantity available in the AM789 warehouse. */
          quantityam789: number;
          /** Quantity available in the China warehouse. */
          quantitychina: number;
          /** Quantity available in the AM warehouse. */
          quantityam: number;
          /** Whether the USA warehouse has stock (`1`/`0`). */
          has_stock_quantityusa: number;
          /** Whether the AM warehouse has stock (`1`/`0`). */
          has_stock_quantityam: number;
          /** Aggregate stock flag; \> 0 means in stock (absent when out of stock). */
          has_stock?: number;
          /** Whether the requesting user is logged in (`1`/`0`). */
          is_login: number;
          /** Quantity available for sale. */
          quantity_sale: number;
          /** Quantity available in the USA warehouse. */
          quantityusa: number;
          /** Additional per-batch stock rows. */
          rows: unknown[];
        }[]
      | [];
  }

  /**
   * GET SEARCH PRODUCT AND RECOMMENDED PRODUCTS BY CAS RESPONSE INTERFACES
   * Endpoint: POST webapi/v1/get_search_product_and_recommended_products_by_cas
   */

  /**
   * Root of the response body returned by
   * `webapi/v1/get_search_product_and_recommended_products_by_cas`.
   */
  export interface AmbeedGetSearchProductAndRecommendedProductsByCASResponse
    extends AmbeedResponseBase {
    /** The response value containing the matched product and recommendations. */
    value: {
      /** The product matched directly by the queried CAS number. */
      search_pro_dict: AmbeedGetSearchProductAndRecommendedProductsByCASResponseSearchProDict;
      /** Recommended/related products for the queried CAS number. */
      r_pro_list: AmbeedGetSearchProductAndRecommendedProductsByCASResponseRProList[];
    };
  }

  /**
   * A recommended product entry. The Ambeed API returns these as loosely-typed
   * dictionaries, so keys are open-ended scalar/array values.
   */
  export interface AmbeedGetSearchProductAndRecommendedProductsByCASResponseRProList {
    /** Arbitrary product fields keyed by name. */
    [key: string]: string | number | boolean | unknown[];
  }

  /** A single priced size entry within the CAS-matched product. */
  export interface AmbeedGetSearchProductAndRecommendedProductsByCASResponsePriceList {
    /** Variant size/quantity. */
    pr_size: QuantityString;
    /** Discounted price in USD. */
    discount_usd: string;
    /** Free-text remark for the price entry. */
    pr_remark: string;
    /** Price rate. */
    pr_rate: number;
    /** Whether this is a large size with no listed price. */
    pr_is_large_size_no_price: boolean;
    /** Price ID. */
    pr_id: number;
    /** VIP price in USD. */
    vip_usd: string;
    /** Variant batch (BD) identifier. */
    pr_bd: string;
    /** Price in USD. */
    pr_usd: string;
  }

  /** The product matched by the queried CAS number. */
  export interface AmbeedGetSearchProductAndRecommendedProductsByCASResponseSearchProDict {
    /** Whether the product currently has stock. */
    p_ishasstock: boolean;
    /** Whether the product can be split into smaller quantities. */
    p_split: boolean;
    /** Product ID. */
    p_id: string;
    /** List of priced sizes for the product. */
    price_list: AmbeedGetSearchProductAndRecommendedProductsByCASResponsePriceList[];
    /** Product name in English. */
    p_name_en: string;
    /** Product name in Chinese. */
    p_name_cn: string;
    /** Storage conditions for the product. */
    p_storage: string;
    /** Isotope molecular formula. */
    p_isotopemolformula: string;
    /** Purity level of the product. */
    p_purity: string;
    /** Product AM identifier. */
    p_am: string;
    /** Proper (canonical) name of the product. */
    p_proper_name3: string;
    /** Search keywords associated with the product. */
    s_keywords: string;
    /** InChIKey of the product. */
    p_inchikey: string;
    /** CAS number of the product. */
    p_cas: string;
    /** Whether the product is a spot good (`1`/`0`). */
    p_is_spot_goods: number;
    /** Molecular formula. */
    p_moleform: string;
    /** SEO page title. */
    s_title: string;
    /** Product batch (BD) identifier. */
    p_bd: string;
    /** Spot-brand name. */
    p_spot_brand: string;
    /** Spot-brand remark. */
    p_spot_brand_remark: string;
    /** SEO page description. */
    s_description: string;
    /** MDL number of the product. */
    p_mdl: string;
    /** Molecular weight of the product. */
    p_moleweight: string;
  }

  /**
   * GET PMS/SDS BY AMS RESPONSE INTERFACES
   * Endpoint: POST webapi/v1/getPmsSdsByAms
   */

  /** Root of the PMS/SDS-by-AMS response body returned by `webapi/v1/getPmsSdsByAms`. */
  export interface AmbeedGetPmsSdsByAmsResponse extends AmbeedResponseBase {
    /** The response value containing SDS document links and chemical info. */
    value: {
      /** Whether the lookup succeeded. */
      isokk: boolean;
      /** Error message when the lookup failed (empty on success). */
      errmsg: string;
      /** SDS documents keyed by AM identifier, then by language/region. */
      sds_list: {
        [key: string]: {
          [key: string]: {
            /** Whether the SDS document is available. */
            status: boolean;
            /** URL to the SDS document. */
            url: string;
          };
        };
      };
      /** Reserved field, always `null` in observed responses. */
      data: null;
      /** Chemical metadata keyed by AM identifier, then by field name. */
      chemical_info: {
        [key: string]: {
          [key: string]: string;
        };
      };
      /** Reserved field, always `null` in observed responses. */
      api_data: null;
    };
  }

  /**
   * GET 3D MOLECULE BY SMILES RESPONSE INTERFACES
   * Endpoint: POST webapi/get_3dmol_by_smile
   */

  /** Root of the 3D-molecule-by-SMILES response body returned by `webapi/get_3dmol_by_smile`. */
  export interface AmbeedGet3DmoleculeBySmilesResponse extends AmbeedResponseBase {
    /** The response value containing the generated molecule data. */
    value: {
      /** MOL-format string describing the 3D molecule. */
      mol: string;
      /** Numeric status code for the generation. */
      status: number;
      /** Whether the molecule was generated successfully. */
      isok: boolean;
    };
  }

  /**
   *
   * GET PRODUCT BATCH BY PROID RESPONSE INTERFACES
   * Endpoint: GET webapi/v1/product/probatch/PROID
   */

  /**
   * Root of the product-batch-by-proid response body returned by
   * `webapi/v1/product/probatch/PROID`.
   */
  export interface AmbeedGetProductBatchByProidResponse extends AmbeedResponseBase {
    /** Per-batch records, or an empty array when no batch data is available. */
    value?:
      | {
          /** Purity of the batch. */
          pb_purity: string;
          /** Timestamp of the next scheduled report. */
          pb_nextreporttime: string;
          /** Batch number. */
          pb_batch: string;
          /** Whether a certificate of analysis is available. */
          pb_iscoa: boolean;
          /** Appearance description in English. */
          pb_appearanceen: string;
          /** Batch ID. */
          pb_bid: number;
          /** Numeric batch status. */
          pb_status: number;
          /** Catalog serial number. */
          pb_csn: string;
          /** Batch AM identifier. */
          pb_am: string;
          /** Batch BD identifier. */
          pb_bd: string;
          /** AM batch identifier. */
          pb_ambatch: string;
          /** Batch timestamp. */
          pb_time: string;
          /** Melting point of the batch. */
          pb_meltingpoint: string;
          /** Additional string-valued batch fields. */
          [key: string]: string;
        }[]
      | [];
  }

  /**
   * GET PRODUCT STOCK BY BDS RESPONSE INTERFACES
   * Endpoint: POST webapi/v1/getproductstockbybds
   */

  /**
   * Root of the product-stock-by-BDS response body returned by
   * `webapi/v1/getproductstockbybds`.
   */
  export interface AmbeedGetProductStockByBdsResponse extends AmbeedResponseBase {
    /** The response value containing per-BD stock lists. */
    value: {
      /** Stock lists grouped by batch (BD) identifier. */
      stock_list: AmbeedGetProductStockByBdsResponseValueStockList[];
      /** Whether the requesting user is logged in (`1`/`0`). */
      is_login: number;
    };
  }

  /** Stock entries for a single batch (BD) identifier. */
  export interface AmbeedGetProductStockByBdsResponseValueStockList {
    /** Batch (BD) identifier. */
    bd: string;
    /** Per-size stock entries for this batch. */
    stock: AmbeedGetProductStockByBdsResponseValueStock[];
  }

  /** Per-warehouse stock quantities for a single size. */
  export interface AmbeedGetProductStockByBdsResponseValueStock {
    /** Quantity available in the AM789 warehouse. */
    quantityam789: number;
    /** Quantity available in the AM warehouse. */
    quantityam: number;
    /** Quantity available for sale. */
    quantity_sale: number;
    /** Quantity available in the Germany warehouse. */
    quantityde: number;
    /** Quantity available in the USA warehouse. */
    quantityusa: number;
    /** Size/quantity this stock entry applies to. */
    size: string;
    /** Quantity available in the China warehouse. */
    quantitychina: number;
    /** Additional per-batch stock rows. */
    rows: unknown[];
  }
}

export {};

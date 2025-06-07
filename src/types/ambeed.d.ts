/* eslint-disable @typescript-eslint/naming-convention */
declare global {
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
  interface AmbeedSearchResponseProduct {
    /** The source identifier */
    source: number;
    /** The response code */
    code: number;
    /** The language of the response */
    lang: string;
    /** The value containing product results */
    value: {
      /** Array of product objects */
      product_res: AmbeedProductObject[];
    };
    /** The timestamp of the response */
    time: string;
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

  /**
   * Creates an opaque type with a type name
   * @param T - The base type
   * @param K - The type name string
   */
  type Opaque<T, K extends string> = T & { __typename: K };

  /** Represents a Base64 encoded string */
  type Base64 = Opaque<string, "base64">;

  /** Represents encoded search parameters */
  type EncodedSearchParams = Base64;

  /**
   * Response from the Ambeed product list API
   */
  export interface AmbeedProductListResponse {
    /** The source identifier */
    source: number;
    /** The response value containing product list data */
    value: AmbeedProductListResponseValue;
    /** The response code */
    code: number;
    /** The timestamp of the response */
    time: string;
    /** The language of the response */
    lang: string;
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
   * Enum representing maximum quantity values
   */
  export enum PWmMaxQuantity {
    /** Empty value */
    Empty = "",
    /** Not available */
    NA = "N/A",
    /** 30g/30ml quantity */
    The30G30Ml = "30g/30ml",
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
}

export {};

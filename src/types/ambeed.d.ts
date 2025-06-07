/* eslint-disable @typescript-eslint/naming-convention */
declare global {
  interface AmbeedProductObject {
    type: string;
    url: string;
    s_menucat: number;
    purity_item: string;
    show_name: string;
    nameEn: string;
    mdl: string | null;
    show_name_raw: string;
    p_proper_name3: string;
    cas: string;
  }

  interface AmbeedSearchResponseProduct {
    lang: string;
    value: {
      product_res: AmbeedProductObject[];
    };
    time: string;
    code: number;
    source: number;
  }

  interface AmbeedSearchParams {
    params: Base64String;
  }

  export interface ProductListByKeyword {
    source: number;
    value: Value;
    code: number;
    time: string;
    lang: string;
  }

  export interface Value {
    total: number;
    pagenum: number;
    pageindex: number;
    pagesize: number;
    result: Result[];
    all_purity: unknown[];
    all_size: unknown[];
    repeat_num: number;
    mem_rate: null;
    menu_res: MenuRes;
  }

  export interface MenuRes {
    menu_count: number;
    menu_list: unknown[];
    one_menu_list: unknown[];
    submenu_list: unknown[];
  }

  export interface Result {
    p_proimg: string;
    p_id: string;
    priceList: PriceList[];
    p_moleweight: string;
    p_proper_name3: string;
    p_wm_max_quantity: PWmMaxQuantity;
    p_am: string;
    s_url: string;
    sort: number;
    p_name_en: string;
    p_boilingpoint: string;
    p_purity: string;
    p_is_life_science: boolean;
    p_inchikey2: string;
    p_cas: string;
    p_bd: string;
    p_inchikey: string;
    p_moleform: string;
    p_storage: string;
    p_mdl: string;
  }

  export enum PWmMaxQuantity {
    Empty = "",
    NA = "N/A",
    The30G30Ml = "30g/30ml",
  }

  export interface PriceList {
    pr_am: string;
    pr_usd: string;
    pr_id: number;
    discount_usd: string;
    pr_size: PrSize;
    vip_usd: string;
    pr_rate: number;
  }

  export enum PrSize {
    The100G = "100g",
    The100Mg = "100mg",
    The10G = "10g",
    The10Mg = "10mg",
    The1G = "1g",
    The1Kg = "1kg",
    The1Mg = "1mg",
    The250Mg = "250mg",
    The25G = "25g",
    The25Mg = "25mg",
    The500G = "500g",
    The50Mg = "50mg",
    The5G = "5g",
    The5Mg = "5mg",
  }
}

export {};

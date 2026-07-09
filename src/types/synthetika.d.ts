declare global {
  /**
   * Response from the Synthetika search API.
   */
  interface SynthetikaSearchResponse {
    count: number;
    pages: number;
    page: number;
    list: SynthetikaProduct[];
  }

  /**
   * Configuration option value schema for Synthetika.
   */
  interface SynthetikaConfigurationOptionValueSchema {
    id: string;
    order: string;
    name: string;
  }

  /**
   * Product price schema for Synthetika.
   */
  interface SynthetikaProductPrice {
     
    base: string;
    base_float: number;
    final: string;
    final_float: number;
     
  }

  /**
   * Minimal product schema for Synthetika.
   */
  interface SynthetikaMinimalProduct {
     
    id: number;
    name: string;
    can_buy: boolean;
    ean: string;
    code: string;
    unit: {
      name: string;
      floating_point: boolean;
    };
    rate: number;
    votes: number;
    stockId: number;
    url: string;
    category: {
      name: string;
      id: number;
    };
    availability: {
      name: string;
    };
    visibility: {
      status: number;
      cart_status: number;
      search_status: number;
    };
    price: {
      gross: SynthetikaProductPrice;
      net: SynthetikaProductPrice;
    };
    weight: {
      weight_float: number;
      weight: string;
    };
    producer: {
      name: string;
      id: number;
      img: string;
    };
    shortDescription: string;
    description: string;
    /** Primary image id (the gfx asset key), e.g. `"15767"`. */
    main_image?: string;
    /** Gallery image ids (gfx asset keys). */
    images?: string[];

  }

  /**
   * Product schema for Synthetika.
   */
  interface SynthetikaProduct extends SynthetikaMinimalProduct {
     
    options_configuration: Array<{
      values: Array<SynthetikaConfigurationOptionValueSchema>;
      [key: string]: unknown;
    }>;

    variants?: omit<SynthetikaProduct, "variants">[];
     
  }
}

export {};

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
    /* eslint-disable */
    base: string;
    base_float: number;
    final: string;
    final_float: number;
    /* eslint-enable */
  }

  /**
   * Minimal product schema for Synthetika.
   */
  interface SynthetikaMinimalProduct {
    /* eslint-disable */
    id: number;
    name: string;
    can_buy: boolean;
    ean: string;
    code: string;
    unit: {
      name: string;
      floating_point: boolean;
    };
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
    /* eslint-enable */
  }

  /**
   * Product schema for Synthetika.
   */
  interface SynthetikaProduct extends SynthetikaMinimalProduct {
    /* eslint-disable */
    options_configuration: Array<{
      values: Array<SynthetikaConfigurationOptionValueSchema>;
      [key: string]: unknown;
    }>;

    variants?: omit<SynthetikaProduct, "variants">[];
    /* eslint-enable */
  }
}

export {};

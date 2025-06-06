declare global {
  interface SynthetikaSearchResponse {
    count: number;
    pages: number;
    page: number;
    list: SynthetikaProduct[];
  }

  interface SynthetikaProductPrice {
    /* eslint-disable */
    base: string;
    base_float: number;
    final: string;
    final_float: number;
    historical_lowest_price: string;
    historical_lowest_price_float: number;
    /* eslint-enable */
  }

  interface SynthetikaProduct {
    /* eslint-disable */
    id: number;
    name: string;
    can_buy: boolean;
    ean: string;
    code: string;
    package: string;
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
    delivery: {
      name: string;
      hours: string;
    };
    price: {
      gross: SynthetikaProductPrice;
      net: SynthetikaProductPrice;
    };
    productExists30DaysBeforePromotion: boolean;
    weight: {
      weight_float: number;
      weight: string;
    };
    producer: {
      name: string;
      id: number;
      img: string;
    };
    newProduct: boolean;
    shortDescription: string;
    main_image: string;
    main_image_filename: string;
    historical_lowest_price: string;
    net_historical_lowest_price: string;
    variants?: Omit<SynthetikaProduct, "variants">[];
    /* eslint-enable */
  }
}

export {};

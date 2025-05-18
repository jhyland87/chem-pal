export type _Price = {
  price: number;
  price_incl: number;
  price_excl: number;
  price_old: number;
  price_old_incl: number;
  price_old_excl: number;
};

export type _Product = {
  id: number;
  vid: number;
  image: number;
  brand: boolean;
  code: string;
  ean: string;
  sku: string;
  score: number;
  price: _Price;
  available: boolean;
  unit: boolean;
  url: string;
  title: string;
  fulltitle: string;
  variant: string;
  description: string;
  data_01: string;
  [key: string]: unknown;
};

export type LaboriumDiscounterResponse = {
  page: {
    search: string;
    session_id: string;
    key: string;
    title: string;
    status: number;
    [key: string]: unknown;
  };
  request: {
    url: string;
    method: string;
    get: {
      format: string;
      limit: string;
    };
    post: any[];
    device: {
      platform: string;
      type: string;
      mobile: boolean;
    };
    country: string;
    [key: string]: unknown;
  };
  collection: {
    products: {
      [key: string]: _Product;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type _productIndexObject = {
  [key: string]: unknown; //string | number | { [key: string]: string | number };
};

// Add type definitions at the top of the file after imports
export type SearchParams = {
  [key: string]: string;
};

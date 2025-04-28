export interface Item {
  id: number;
  name: string;
  deadline: Date;
  type: string;
  isComplete: boolean;
  nodes?: Item[];
}

export interface Sku {
  priceInfo: { regularPrice: number[] };
  variantsMap: { volume: number; 'chemical-grade': string; concentration: string };
  skuId: string;
  seoName: string;
  inventoryStatus: string;
  inventoryStatusMsg: string;
  specifications: { shippingInformation: string };
}

export interface Variant {
  price: number;
  quantity: number;
  sku: number;
  grade: string;
  conc: string;
  seoname: string;
  status: string;
  statusTxt: string;
  shippingInformation: string;
}

export interface SearchProps {
  query: string;
  setQuery: (value: string) => void;
}
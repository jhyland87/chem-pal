export type _productIndexObject = {
  url: string;
  title: string;
  prices: string;
  count: string;
};

// Add type definitions at the top of the file after imports
export type SearchParams = {
  N: string;
  Nf: string;
  Nr: string;
  Nrpp: string;
  Ntt: string;
  noRedirect: string;
  nore: string;
  question: string;
  searchExecByFormSubmit: string;
  tab: string;
};

export type ProductData = {
  displayName: string;
  canonicalUrl: string;
  dataLayer?: {
    productPrice?: string[];
  };
  familyVariyantProductDetails?: {
    productVariantsResult?: {
      masterProductBean?: {
        skus?: Array<{
          priceInfo?: {
            regularPrice?: string[];
          };
        }>;
      };
    };
  };
};

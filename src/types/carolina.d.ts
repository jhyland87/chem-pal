/**
 * Represents a product index object from Carolina Biological Supply Company
 */
export interface CarolinaProductIndexObject {
  /** The URL of the product page */
  url: string;
  /** The title/name of the product */
  title: string;
  /** The price information of the product */
  prices: string;
  /** The quantity or count information */
  count: string;
}

/**
 * Search parameters used for querying Carolina Biological Supply Company's website
 */
export interface CarolinaSearchParams {
  /* eslint-disable */
  /** Search parameter N */
  N: string;
  /** Search parameter Nf */
  Nf: string;
  /** Search parameter Nr */
  Nr: string;
  /** Search parameter Nrpp */
  Nrpp: string;
  /** Search parameter Ntt */
  Ntt: string;
  /** Flag to prevent redirect */
  noRedirect: string;
  /** Search parameter nore */
  nore: string;
  /** The search query/question */
  question: string;
  /** Flag indicating if search was executed by form submission */
  searchExecByFormSubmit: string;
  /** The active tab */
  tab: string;
  /* eslint-enable */
}

/**
 * Detailed product data structure from Carolina Biological Supply Company
 */
export interface CarolinaProductData {
  /** The display name of the product */
  displayName: string;
  /** The canonical URL of the product */
  canonicalUrl: string;
  /** Optional data layer containing product information */
  dataLayer?: {
    /** Array of product prices */
    productPrice?: string[];
  };
  /** Optional family variant product details */
  familyVariyantProductDetails?: {
    /** Product variants result data */
    productVariantsResult?: {
      /** Master product information */
      masterProductBean?: {
        /** Array of SKUs for the product */
        skus?: Array<{
          /** Price information for the SKU */
          priceInfo?: {
            /** Array of regular prices */
            regularPrice?: string[];
          };
        }>;
      };
    };
  };
}

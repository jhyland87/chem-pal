/**
 * Base interface for common properties shared across many objects
 */
export interface CarolinaBaseObject {
  templateType: string;
  metadata?: Record<string, unknown>;
  contentId: string;
  containerContentId?: string;
  attributes: Record<string, unknown>;
  executionStartTime: number;
  previewMode: boolean;
}

/**
 * Interface for content folders
 */
export interface CarolinaContentFolder extends CarolinaBaseObject {
  /* eslint-disable */
  folderPath: string;
  childRules?: CarolinaContentRule[];
  "@type": "ContentRuleFolder";
  /* eslint-enable */
}

/**
 * Interface for the results container that holds search results
 */
export interface CarolinaResultsContainer extends CarolinaContentRuleZoneItem {
  /* eslint-disable */
  "@type": "ResultsContainer";
  results: unknown[]; // Changed to unknown[] since we'll validate each item
  /* eslint-enable */
}

/**
 * Interface for content rules
 */
export interface CarolinaContentRule extends CarolinaBaseObject {
  /* eslint-disable */
  pageTitle: string;
  "@type": "ContentRule";
  ruleId: string;
  ContentRuleZone: CarolinaContentRuleZoneItem[];
  /* eslint-enable */
}

/**
 * Interface for content rule zone items
 */
export interface CarolinaContentRuleZoneItem extends CarolinaBaseObject {
  /* eslint-disable */
  "@type": string;
  contents?: {
    ContentFolderZone?: CarolinaContentFolder[];
    MainContent?: CarolinaMainContentItem[];
  };
  subMenus?: CarolinaMenuItem[];
  topCategories?: CarolinaMenuItem[];
  mostPopular?: CarolinaMenuItem[];
  /* eslint-enable */
}

/**
 * Interface for main content items
 */
export interface CarolinaMainContentItem extends CarolinaBaseObject {
  /* eslint-disable */
  "@type": string;
  contents?: {
    ContentFolderZone?: CarolinaContentFolder[];
  };
  /* eslint-enable */
}

/**
 * Interface for menu items
 */
export interface CarolinaMenuItem {
  link: string;
  description: string;
  productCategoryId?: string;
  displayName: string;
  imageUrl: string;
}

/**
 * Interface for facet items
 */
export interface CarolinaFacetItem {
  name: string;
  count: number;
  fieldName: string;
  facetUrlName: string | number;
  fieldValue: string;
  url: string;
}

/**
 * Interface for facets container
 */
export interface CarolinaFacetsContainer extends CarolinaBaseObject {
  facets: Array<Record<string, CarolinaFacetItem[]>>;
  facetSortMap: Record<string, string>;
  facetSortOrderMap: Record<string, string[]>;
  selectedCrumb: Array<{
    fieldName: string;
    label: string;
    navigationState: string;
    fieldValue: string;
    displayName: string;
  }>;
}

/**
 * Interface for search results
 */
export interface CarolinaSearchResult {
  /* eslint-disable */
  "product.thumbnailImg": string;
  "product.productName": string;
  "product.productId": string;
  "product.shortDescription": string;
  itemPrice: string;
  "product.seoName": string;
  productUrl: string;
  productName: string;
  qtyDiscountAvailable: boolean;
  productSquence: number;
  /* eslint-enable */
}

/**
 * Main search response interface
 */
export interface CarolinaSearchResponse extends CarolinaBaseObject {
  /* eslint-disable */
  ssRecsInfoPageObj: {
    page: {
      type: string;
      searchString: string;
    };
  };
  pageTitle: string;
  enableLoadImageAsLink: string;
  responseStatusCode: number;
  contents: {
    ContentFolderZone: CarolinaContentFolder[];
  };
  dataLayer_obj3: Record<string, unknown>;
  pageImagesList: string[];
  /* eslint-enable */
}

/**
 * Search parameters used for querying Carolina Biological Supply Company's website
 */
export interface CarolinaSearchParams {
  /* eslint-disable */
  tab: string;
  "product.type": string;
  "product.productTypes": string;
  facetFields: string;
  format: string;
  ajax: boolean;
  viewSize: number;
  q: string;
  /* eslint-enable */
}

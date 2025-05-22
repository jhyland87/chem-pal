/* eslint-disable */
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
  folderPath: string;
  childRules?: CarolinaContentRule[];
  "@type": "ContentRuleFolder";
}

/**
 * Interface for the results container that holds search results
 */
export interface CarolinaResultsContainer extends CarolinaContentRuleZoneItem {
  "@type": "ResultsContainer";
  results: unknown[]; // Changed to unknown[] since we'll validate each item
}

/**
 * Interface for content rules
 */
export interface CarolinaContentRule extends CarolinaBaseObject {
  pageTitle: string;
  "@type": "ContentRule";
  ruleId: string;
  ContentRuleZone: CarolinaContentRuleZoneItem[];
}

/**
 * Interface for content rule zone items
 */
export interface CarolinaContentRuleZoneItem extends CarolinaBaseObject {
  "@type": string;
  contents?: {
    ContentFolderZone?: CarolinaContentFolder[];
    MainContent?: CarolinaMainContentItem[];
  };
  subMenus?: CarolinaMenuItem[];
  topCategories?: CarolinaMenuItem[];
  mostPopular?: CarolinaMenuItem[];
}

/**
 * Interface for main content items
 */
export interface CarolinaMainContentItem extends CarolinaBaseObject {
  "@type": string;
  contents?: {
    ContentFolderZone?: CarolinaContentFolder[];
  };
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
}

/**
 * Main search response interface
 */
export interface CarolinaSearchResponse extends CarolinaBaseObject {
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
}

/**
 * Search parameters used for querying Carolina Biological Supply Company's website
 */
export interface CarolinaSearchParams {
  tab: string;
  "product.type": string;
  "product.productTypes": string;
  facetFields: string;
  format: string;
  ajax: boolean;
  viewSize: number;
  q: string;
}

/**
 * Interface for ATG product response
 */
export interface CarolinaATGResponse {
  result: string;
  response: {
    response: {
      breadCrumbSchemaJson: {
        breadCrumbSchemaJson: string;
        dataLayer_obj: Record<string, string>;
      };
      longDescription: string;
      product: string;
      dataLayer: {
        productDetail: {
          productImageUrl: string;
          productId: string;
          productUrl: string;
          page_type: string;
          productName: string;
        };
        dataLayerObject: {
          dataLayerJson: Record<string, string>;
        };
      };
      canonicalUrl: string;
      isDLProduct: boolean;
      displayName: string;
      isDiscontinuedItem: boolean;
      isproductGrouping: boolean;
      shortDescription: string;
      prodType: string;
      familyVariyantProductDetails: Record<string, unknown>;
      familyVariyantDisplayName: string;
      organizationDetails: Record<string, unknown>;
    };
    status: string;
  };
}

/**
 * Interface for the Carolina product response structure
 */
export interface CarolinaProductResponse {
  contents: {
    MainContent: Array<{
      atgResponse: CarolinaATGResponse;
      templateType: string;
      contentId: string;
      previewMode: boolean;
    }>;
  };
  responseStatusCode: number;
  templateType: string;
  contentId: string;
  previewMode: boolean;
}

/* eslint-enable */

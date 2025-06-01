declare global {
  /**
   * Represents a single search result item from OnyxMet
   */
  interface OnyxMetSearchResultItem {
    /** The display label for the search result */
    label: string;
    /** URL to the image for the search result */
    image: string;
    /** Description text for the search result */
    description: string;
    /** URL to the search result page */
    href: string;
  }

  /**
   * Represents the response from an OnyxMet search query
   */
  type OnyxMetSearchResultResponse = Array<OnyxMetSearchResultItem>;
}

// This export is needed to make the file a module
export {};

export interface SearchResultItem {
  label: string;
  image: string;
  description: string;
  href: string;
}

export type SearchResultResponse = Array<SearchResultItem>;

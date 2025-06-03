import { createLocalStorageODM } from "@/utils/ChromeStorageODM";

interface SearchResultsModel {
  products: Product[];
  [key: string]: unknown;
}

const searchResultsStorage = createLocalStorageODM<SearchResultsModel>("searchResults", {
  products: [],
});

export default searchResultsStorage;

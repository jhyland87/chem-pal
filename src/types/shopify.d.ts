export type ShopifyCategory = {
  category_id: string;
  title: string;
  link: string;
  image_link: string;
  description: string;
};

export type ShopifyPage = {
  page_id: string;
  title: string;
  link: string;
  image_link: string;
  description: string;
};

export type ShopifyProductOption = {
  Model: string;
};

export type ShopifyProductVariant = {
  variant_id: string;
  sku: string;
  barcode: string;
  price: number;
  list_price: string;
  taxable: string;
  options: ShopifyProductOption[];
  available: string;
  search_variant_metafields_data: string[];
  filter_variant_metafields_data: string[];
  image_link: string;
  image_alt: string;
  quantity_total: string;
  link: string;
};

export type ShopifyItem = {
  product_id: string;
  original_product_id: string;
  title: string;
  description: string;
  link: string;
  price: string;
  list_price: string;
  quantity: string;
  product_code: string;
  image_link: string;
  vendor: string;
  discount: string;
  add_to_cart_id: string;
  total_reviews: string;
  reviews_average_score: string;
  shopify_variants: ShopifyProductVariant[];
  shopify_images: string[];
  shopify_images_alt?: string[];
  tags: string;
};

export type ShopifySearchResponse = {
  totalItems: number;
  startIndex: number;
  itemsPerPage: number;
  currentItemCount: number;
  categoryStartIndex: number;
  totalCategories: number;
  pageStartIndex: number;
  totalPages: number;
  suggestions: string[];
  categories: ShopifyCategory[];
  pages: ShopifyPage[];
  items: ShopifyItem[];
};

export type ShopifyQueryParams = {
  api_key: string;
  q: string;
  maxResults: number;
  startIndex: number;
  items: boolean;
  pages: boolean;
  facets: boolean;
  categories: boolean;
  suggestions: boolean;
  vendors: boolean;
  tags: boolean;
  pageStartIndex: number;
  pagesMaxResults: number;
  categoryStartIndex: number;
  categoriesMaxResults: number;
  suggestionsMaxResults: number;
  vendorsMaxResults: number;
  tagsMaxResults: number;
  output: string;
  _: number;
};

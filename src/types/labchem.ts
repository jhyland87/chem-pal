/**
 * Types for the LabChem (`labchem.de`) storefront, which runs on the ePages
 * e-commerce platform. These model only the fields the {@link SupplierLabChem}
 * module consumes from the three endpoints it hits: the catalog search, a
 * product's variations list, and a per-variation product page.
 *
 * Exported as a regular module (not `declare global`) so consumers import the
 * types explicitly rather than polluting the global type namespace.
 *
 * @module types/labchem
 */

/** An ePages money value: a numeric amount plus its ISO currency code. */
export interface EpagesMoney {
  /** Tax treatment of the amount (e.g. "GROSS"). */
  taxType?: string;
  /** Preformatted, localized price string (e.g. "14,16 €"). */
  formatted?: string;
  /** Numeric amount (e.g. 14.16). */
  amount: number;
  /** ISO currency code (e.g. "EUR"). */
  currency: string;
}

/** A HATEOAS-style link entry attached to ePages resources. */
export interface EpagesLink {
  /** Relation type (e.g. "self", "variations", "variation", "master"). */
  rel: string;
  /** Absolute URL of the related resource. */
  href: string;
  /** Optional link title. */
  title?: string;
}

/** A selected variation attribute (e.g. size "500 ml"). */
export interface EpagesAttributeSelection {
  /** Internal attribute name (e.g. "Milliliter"). */
  name: string;
  /** Human-facing attribute label (e.g. "Größe"). */
  displayName: string;
  /** Raw value (e.g. "500 ml", "25_l"). */
  value: string;
  /** Localized display value (e.g. "500 ml", "2,5 l"). */
  displayValue: string;
}

/** A single product image with its ePages size classifier. */
export interface EpagesImage {
  /** Image URL. */
  url: string;
  /** Size classifier (e.g. "Thumbnail", "Small", "Medium", "Large", "HotDeal"). */
  classifier: string;
  /** Pixel width, when reported. */
  width?: number;
  /** Pixel height, when reported. */
  height?: number;
}

/**
 * A product hit from the catalog search (`POST /api/v2/search`). For chemical
 * products this is a variation master — its own price/stock fields are unreliable
 * (all resolved from the per-variation product pages instead).
 */
export interface EpagesSearchProduct {
  /** Product UUID; for a master this doubles as the variation-master id. */
  productId: string;
  /** Short product name. */
  name: string;
  /** Full product title (name + shop suffix). */
  title?: string;
  /** Product number / SKU. */
  sku?: string;
  /** HTML description containing the `<ul><li>` spec list (CAS, formula, molar mass, …). */
  description?: string;
  /** URL slug. */
  slug?: string;
  /** Whether the product is publicly visible; hidden products are filtered out. */
  isVisible?: boolean;
  /** Whether the product has purchasable variations to enumerate. */
  hasVariations?: boolean;
  /** Whether this product is a variation master. */
  isVariationMaster?: boolean;
  /** Proxied catalog thumbnail (not used for the final images). */
  image?: { url: string; width?: number; height?: number };
  /** Lowest variation price, when reported. */
  lowestPrice?: EpagesMoney | null;
  /** Highest variation price, when reported. */
  highestPrice?: EpagesMoney | null;
  /** Related-resource links (self, variations, …). */
  links: EpagesLink[];
}

/** The catalog search response (`POST /api/v2/search`). */
export interface EpagesSearchResponse {
  /** The page's product hits. */
  products: EpagesSearchProduct[];
  /** Total number of products across all pages (drives pagination). */
  totalNumberOfProducts: number;
}

/** A single entry in a master's variations list. */
export interface EpagesVariationItem {
  /** Link to the variation's product page (`rel` should be "variation"). */
  link: EpagesLink;
  /** Extra flags; `purchasable === false` excludes the variation. */
  additionalAttributes?: { purchasable?: boolean };
  /** The attribute values distinguishing this variation (e.g. size). */
  attributeSelection?: EpagesAttributeSelection[];
}

/** A master product's variations list (`GET …/products/{masterId}/variations`). */
export interface EpagesVariationsResponse {
  /** Number of variation items. */
  results: number;
  /** The variation entries. */
  items: EpagesVariationItem[];
}

/** Price information block on a product/variation page. */
export interface EpagesPriceInfo {
  /** The purchasable price (null on a master page). */
  price?: EpagesMoney | null;
  /** Lowest price, when reported. */
  lowestPrice?: EpagesMoney | null;
  /** Highest price, when reported. */
  highestPrice?: EpagesMoney | null;
}

/**
 * A per-variation (or master) product page
 * (`GET …/products/{id}`). Carries the authoritative price, stock (`forSale`),
 * quantity selection, permalink (`sfUrl`), and the full-resolution image set.
 */
export interface EpagesProductPage {
  /** This variation's UUID. */
  productId: string;
  /** The parent master's UUID (null on a master page). */
  productVariationMasterId?: string | null;
  /** Product title. */
  title?: string;
  /** Whether the variation is actually for sale (the only stock flag we trust). */
  forSale: boolean;
  /** Storefront permalink for this variation. */
  sfUrl?: string;
  /** Product number / SKU (e.g. "011700-0500"). */
  productNumber?: string;
  /** The attribute values selected for this variation (e.g. size), used for quantity. */
  productVariationSelection?: EpagesAttributeSelection[] | null;
  /** Price information (`priceInfo.price.amount` is the purchasable price). */
  priceInfo?: EpagesPriceInfo;
  /** Full image set with size classifiers. */
  images?: EpagesImage[];
}

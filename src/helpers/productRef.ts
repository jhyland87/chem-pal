/**
 * References to specific supplier products, used to refetch them without running a search.
 *
 * @module
 * @category Helpers
 * @group Price Alerts
 */
import type { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { mapDefined } from '@/helpers/utils';
import type { ProductBuilder } from '@/utils/ProductBuilder';

/**
 * The identifiers of one size of a product. Suppliers with grouped listings refetch each member.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export interface VariantRef {
  /** The supplier's own id for the size. */
  id?: number | string;
  /** The supplier's secondary identifier for the size. */
  uuid?: number | string;
  /** The size's SKU. */
  sku?: number | string;
  /** The size's title. */
  title?: string;
}

/**
 * Everything needed to refetch one specific product. It carries several identifiers because no
 * single field works for every supplier.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export interface ProductRef extends VariantRef {
  /** The supplier's stable product key (see `SupplierBase.getUniqueProductKey`). */
  cacheKey: string;
  /** Product title, carried so a refetched product can be named without a search. */
  title: string;
  /** Processing URL. */
  url: string;
  /** Human-facing product page. */
  permalink?: string;
  /** Pack size of the headline price. */
  quantity?: number;
  /** Unit of the headline pack size. */
  uom?: string;
  /** The product's sizes. */
  variants: VariantRef[];
}

/**
 * The builders a supplier found for a batch of refs.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export interface ProductLookup<T extends Product> {
  /** Builders for the products found, matched to their ref by `cacheKey`. */
  builders: ProductBuilder<T>[];
  /** `cacheKey`s whose request failed. A ref in neither list counts as unavailable. */
  failed?: ReadonlySet<string>;
}

/**
 * The outcome of refetching one product. Only `OK` carries a product.
 * @category Helpers
 * @group Price Alerts
 * @source
 */
export type ProductRefreshResult =
  | { status: typeof PRODUCT_REFRESH_STATUS.OK; ref: ProductRef; product: Product }
  | { status: typeof PRODUCT_REFRESH_STATUS.UNAVAILABLE; ref: ProductRef }
  | { status: typeof PRODUCT_REFRESH_STATUS.FAILED; ref: ProductRef; reason: string };

/**
 * Reads the identifiers of one product or size.
 * @param item - The product or variant to read
 * @returns Its identifiers
 * @example
 * ```ts
 * toVariantRef({ id: 5, sku: 'A-1', title: '500 g', price: 9 }); // { id: 5, uuid: undefined, sku: 'A-1', title: '500 g' }
 * ```
 * @source
 */
function toVariantRef(item: Variant): VariantRef {
  return { id: item.id, uuid: item.uuid, sku: item.sku, title: item.title };
}

/**
 * Captures what is needed to refetch a product later. Pass the parent product: a flattened size row
 * carries its own id and SKU in place of the parent's.
 * @category Helpers
 * @group Price Alerts
 * @param product - The product to reference
 * @returns The ref, or `undefined` when the product has no stable key or URL
 * @example
 * ```ts
 * toProductRef({ cacheKey: '42', title: 'Acetone', url: '/acetone', id: 42, … });
 * // { cacheKey: '42', id: 42, title: 'Acetone', url: '/acetone', variants: [], … }
 * ```
 * @source
 */
export function toProductRef(product: Product): ProductRef | undefined {
  if (!product.cacheKey || !product.url) return undefined;
  return {
    ...toVariantRef(product),
    cacheKey: product.cacheKey,
    title: product.title,
    url: product.url,
    permalink: product.permalink,
    quantity: product.quantity,
    uom: product.uom,
    variants: mapDefined(product.variants ?? [], toVariantRef),
  };
}

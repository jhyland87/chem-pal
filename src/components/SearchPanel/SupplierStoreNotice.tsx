import { ProductDetailStoreNotice } from '@/components/StyledComponents';
import { default as Link } from '@/components/TabLink';
import { i18n } from '@/helpers/i18n';
import { Typography } from '@mui/material';
import { type ReactElement } from 'react';

/** Props for {@link SupplierStoreNotice}. */
interface SupplierStoreNoticeProps {
  /** The product whose supplier may sell through a marketplace storefront. */
  product: Product;
}

/**
 * Advisory shown in the expanded product row when the supplier also sells through eBay and/or
 * Amazon. Renders the storefront links so the user can act on it.
 *
 * Two flavours, keyed off the payment method:
 * - `"ebayonly"`/`"amazononly"` — the supplier restricts its own site and ships more freely via the
 *   marketplace; a restriction notice. The store URL is required (a missing one is surfaced by the
 *   dev-build error in `SupplierBase.finishProduct`).
 * - plain `"ebay"`/`"amazon"` — the supplier simply lists extra products on the marketplace; an
 *   informational notice with an optional store URL.
 *
 * A storefront link is only shown when the matching URL was stamped onto the product, so a
 * misconfigured supplier shows nothing rather than a dead link. See
 * `src/suppliers/__tests__/storeOnlyPaymentMethods.test.ts`.
 * @param props - The product to describe.
 * @returns The notice, or `null` when the supplier has no marketplace storefront.
 * @example
 * ```tsx
 * <SupplierStoreNotice product={product} />
 * ```
 * @source
 */
export function SupplierStoreNotice({ product }: SupplierStoreNoticeProps): ReactElement | null {
  const paymentMethods = product.paymentMethods ?? [];
  const ebayOnly = paymentMethods.includes('ebayonly');
  const amazonOnly = paymentMethods.includes('amazononly');
  const ebayURL =
    ebayOnly || paymentMethods.includes('ebay') ? product.supplierEbayStoreURL : undefined;
  const amazonURL =
    amazonOnly || paymentMethods.includes('amazon') ? product.supplierAmazonStoreURL : undefined;

  if (!ebayURL && !amazonURL) return null;

  // "*only" suppliers get the restriction wording; plain "ebay"/"amazon" suppliers get the softer
  // "more products available" wording. A mixed config is treated as a restriction if any shown
  // marketplace is "*only".
  const isRestriction = Boolean((ebayURL && ebayOnly) || (amazonURL && amazonOnly));
  const prefix = isRestriction ? 'product_detail_store_only' : 'product_detail_store_more';

  // One whole sentence per case rather than a stitched-together prefix/suffix: i18n() returns a
  // plain string (no JSX interpolation), and splitting a sentence around an inline link breaks
  // word order in several of the bundled locales.
  const messageKey =
    ebayURL && amazonURL ? `${prefix}_both` : ebayURL ? `${prefix}_ebay` : `${prefix}_amazon`;

  return (
    <ProductDetailStoreNotice role="note">
      <Typography component="span" variant="caption" color="text.secondary">
        {i18n(messageKey)}
      </Typography>
      <span className="store-links">
        {ebayURL && <Link href={ebayURL}>{i18n('product_detail_store_only_ebay_link')}</Link>}
        {amazonURL && <Link href={amazonURL}>{i18n('product_detail_store_only_amazon_link')}</Link>}
      </span>
    </ProductDetailStoreNotice>
  );
}

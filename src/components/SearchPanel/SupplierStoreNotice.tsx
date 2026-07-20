import { ProductDetailStoreNotice } from "@/components/StyledComponents";
import { default as Link } from "@/components/TabLink";
import { i18n } from "@/helpers/i18n";
import { Typography } from "@mui/material";
import { type ReactElement } from "react";

/** Props for {@link SupplierStoreNotice}. */
interface SupplierStoreNoticeProps {
  /** The product whose supplier may sell through a marketplace storefront. */
  product: Product;
}

/**
 * Advisory shown in the expanded product row when the supplier restricts shipping on their own
 * website but ships more freely through eBay and/or Amazon. Renders the storefront links so the
 * user can act on it.
 *
 * A storefront is only advertised when the supplier both declares the `"ebayonly"`/`"amazononly"`
 * payment method and supplies the matching URL — a supplier that declares one without the other is
 * misconfigured, and showing nothing beats showing a dead link. That case is surfaced to developers
 * by the dev-build error in `SupplierBase.finishProduct` and by
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
  const ebayURL = paymentMethods.includes("ebayonly") ? product.supplierEbayStoreURL : undefined;
  const amazonURL = paymentMethods.includes("amazononly")
    ? product.supplierAmazonStoreURL
    : undefined;

  if (!ebayURL && !amazonURL) return null;

  // One whole sentence per case rather than a stitched-together prefix/suffix: i18n() returns a
  // plain string (no JSX interpolation), and splitting a sentence around an inline link breaks
  // word order in several of the bundled locales.
  const messageKey =
    ebayURL && amazonURL
      ? "product_detail_store_only_both"
      : ebayURL
        ? "product_detail_store_only_ebay"
        : "product_detail_store_only_amazon";

  return (
    <ProductDetailStoreNotice role="note">
      <Typography component="span" variant="caption" color="text.secondary">
        {i18n(messageKey)}
      </Typography>
      <span className="store-links">
        {ebayURL && <Link href={ebayURL}>{i18n("product_detail_store_only_ebay_link")}</Link>}
        {amazonURL && <Link href={amazonURL}>{i18n("product_detail_store_only_amazon_link")}</Link>}
      </span>
    </ProductDetailStoreNotice>
  );
}

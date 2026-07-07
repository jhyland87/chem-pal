import {
  ProductDetailBody,
  ProductDetailContent,
  ProductDetailDescription,
  ProductDetailDocLinks,
  ProductDetailFieldRow,
  ProductDetailFieldsColumn,
  ProductDetailImageBox,
  ProductDetailImageColumn,
  ProductDetailPanelContainer,
  ProductDetailVariantsColumn,
  ProductImageNavButton,
} from "@/components/StyledComponents";
import { default as Link } from "@/components/TabLink";
import { omit } from "@/helpers/collectionUtils";
import { formatDisplayPrice } from "@/helpers/price";
import { isPresent, resolveProductImages } from "@/helpers/product";
import { preloadImages } from "@/helpers/utils";
import COAIcon from "@/icons/COAIcon";
import SDSIcon from "@/icons/SDSIcon";
import TDSIcon from "@/icons/TDSIcon";
import { useCyclingIndex } from "@/shared/hooks/useCyclingIndex.hook";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { Typography } from "@mui/material";
import type { Row, Table } from "@tanstack/react-table";
import { useEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";

/** How long each image is shown before cycling to the next, in milliseconds. */
const IMAGE_CYCLE_MS = 3000;

/**
 * Props for {@link ProductDetailPanel}.
 * @source
 */
interface ProductDetailPanelProps {
  /** The expanded top-level product row this panel details. */
  row: Row<Product>;
  /** The table instance, used to read `meta.userSettings` for price formatting. */
  table: Table<Product>;
}

/** A populated product-detail entry rendered as a label/value pair. */
interface DetailField {
  /** Column-style label shown in muted text. */
  label: string;
  /** Rendered value (text or a link/icon). */
  value: ReactNode;
}

/**
 * Builds the ordered list of populated detail fields for a product, skipping any
 * that are empty. Text identifiers render as-is; SDS/TDS/COA and PubChem render
 * as links so the user can open the underlying documents.
 * @param product - The product whose details to surface.
 * @returns The detail fields to render, in display order (empty when none apply).
 * @example
 * ```ts
 * buildDetailFields({ cas: "7647-14-5", formula: "NaCl" } as Product);
 * // => [{ label: "CAS", value: "7647-14-5" }, { label: "Formula", value: "NaCl" }]
 * ```
 * @source
 */
function buildDetailFields(product: Product): DetailField[] {
  const fields: DetailField[] = [];
  const pushText = (label: string, value: unknown) => {
    if (isPresent(value)) fields.push({ label, value: String(value) });
  };

  pushText("CAS", product.cas);
  pushText("Formula", product.formula);
  pushText("Molecular Weight", product.moleweight);
  pushText("IUPAC Name", product.iupacName);
  pushText("InChIKey", product.inchiKey);
  pushText("InChI", product.inchi);
  pushText("SMILES", product.smiles);
  pushText("Purity", product.purity);
  pushText("Grade", product.grade);
  pushText("Concentration", product.concentration);
  pushText("Manufacturer", product.manufacturer);
  // Description is rendered in its own full-width band, not as a compact row.

  // PubChem link — truthy check narrows the optional id.
  const { pubchemId } = product;
  if (pubchemId) {
    fields.push({
      label: "PubChem",
      value: (
        <Link
          href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemId}`}
          aria-label={`PubChem CID ${pubchemId}`}
          title="View on PubChem"
        >
          {pubchemId}
        </Link>
      ),
    });
  }

  return fields;
}

/**
 * Builds the SDS / TDS / COA document icon links for a product, shown beneath
 * its image. Each link is included only when its URL is set.
 * @param product - The product whose document URLs to surface.
 * @returns The document links in display order (empty when the product has none).
 * @example
 * ```tsx
 * buildDocLinks({ sdsUrl: "https://s.pdf" } as Product); // => [<Link><SDSIcon/></Link>]
 * ```
 * @source
 */
function buildDocLinks(product: Product): ReactNode[] {
  const links: ReactNode[] = [];
  const { sdsUrl, specSheetUrl, coaUrl } = product;

  if (sdsUrl) {
    links.push(
      <Link
        key="sds"
        href={sdsUrl}
        aria-label="Safety data sheet (SDS)"
        title="Safety data sheet (SDS)"
      >
        <SDSIcon fontSize="small" />
      </Link>,
    );
  }
  if (specSheetUrl) {
    links.push(
      <Link
        key="tds"
        href={specSheetUrl}
        aria-label="Technical Data Sheet (TDS)"
        title="Technical Data Sheet (TDS)"
      >
        <TDSIcon fontSize="small" />
      </Link>,
    );
  }
  if (coaUrl) {
    links.push(
      <Link
        key="coa"
        href={coaUrl}
        aria-label="Certificate of Analysis (COA)"
        title="Certificate of Analysis (COA)"
      >
        <COAIcon fontSize="small" />
      </Link>,
    );
  }

  return links;
}

/**
 * Props for {@link ProductImageCarousel}.
 * @source
 */
interface ProductImageCarouselProps {
  /** The resolved images to display, in order. */
  images: ReturnType<typeof resolveProductImages>;
  /** Product title, used for the alt/aria fallback text. */
  title: string;
}

/**
 * Renders a product's image in the fixed-size detail box, cycling through the
 * images every {@link IMAGE_CYCLE_MS} when there is more than one. Hovering the
 * image reveals semi-transparent prev/next arrows for manual navigation; a click
 * anywhere else opens the full image in a new tab. Images that fail to load (e.g.
 * a CACTUS 404) are dropped from the rotation; the box disappears only once every
 * image has failed.
 * @param props - The images to show and the product title for fallback text.
 * @returns The image box, or `null` when there are no loadable images.
 * @example
 * ```tsx
 * <ProductImageCarousel images={resolveProductImages(product)} title={product.title} />
 * ```
 * @source
 */
function ProductImageCarousel({ images, title }: ProductImageCarouselProps): ReactElement | null {
  const [broken, setBroken] = useState<ReadonlySet<number>>(new Set());
  // URLs already handed to the preloader, so we never fetch the same one twice.
  const preloadedRef = useRef<Set<string>>(new Set());

  const available = images
    .map((image, index) => ({ image, index }))
    .filter(({ index }) => !broken.has(index));

  const { index: position, next, prev } = useCyclingIndex(available.length, IMAGE_CYCLE_MS);

  // The thumbnails the carousel actually renders, in cycle order. The first is shown
  // immediately (loaded by the <img> below), so we preload only the rest — ahead of the
  // automatic rotation — and the key keeps the effect stable across value-equal renders.
  const thumbnails = available.map(({ image }) => image.thumbSrc).filter(Boolean);
  const thumbnailKey = thumbnails.join("\n");

  useEffect(() => {
    const urls = thumbnailKey.length > 0 ? thumbnailKey.split("\n") : [];
    const pending = urls.slice(1).filter((url) => !preloadedRef.current.has(url));
    if (pending.length === 0) return;
    for (const url of pending) preloadedRef.current.add(url);
    void preloadImages(pending);
  }, [thumbnailKey]);

  if (available.length === 0) return null;

  const current = available[Math.min(position, available.length - 1)];
  const hasMultiple = available.length > 1;
  // Cycle without letting the click bubble to the image's open-in-new-tab link.
  const navigate = (event: MouseEvent, step: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    step();
  };

  return (
    <ProductDetailImageBox>
      <Link href={current.image.fullSrc} aria-label={`Open full image for ${title}`}>
        <img
          src={current.image.thumbSrc}
          alt={current.image.altText ?? title}
          onError={() => setBroken((brokenSet) => new Set(brokenSet).add(current.index))}
        />
      </Link>
      {hasMultiple && (
        <>
          <ProductImageNavButton
            type="button"
            className="image-nav prev"
            aria-label="Previous image"
            onClick={(event) => navigate(event, prev)}
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </ProductImageNavButton>
          <ProductImageNavButton
            type="button"
            className="image-nav next"
            aria-label="Next image"
            onClick={(event) => navigate(event, next)}
          >
            <ArrowForwardIosIcon fontSize="small" />
          </ProductImageNavButton>
        </>
      )}
    </ProductDetailImageBox>
  );
}

/**
 * Expanded detail panel rendered beneath a product row in place of variant
 * sub-rows. Shows (left) the product image or a derived structure depiction,
 * (middle) every populated detail field, and (right) the product's variants as
 * links with their price and quantity.
 *
 * Variants are sourced from the row's filtered `subRows` so an active filter
 * narrows the list; when no filter is applied this equals the full variant set.
 * @param props - The row to detail and the table instance for user settings.
 * @returns The rendered detail panel.
 * @example
 * ```tsx
 * <ProductDetailPanel row={row} table={table} />
 * ```
 * @source
 */
export function ProductDetailPanel({ row, table }: ProductDetailPanelProps): ReactElement {
  const product = row.original;
  const userSettings = table.options.meta?.userSettings;
  const images = resolveProductImages(product);

  // Prefer the filtered sub-rows (respecting active filters); fall back to the
  // raw variants. Product[] is assignable to Variant[] since Product extends it.
  const variants: Variant[] =
    row.subRows.length > 0 ? row.subRows.map((sub) => sub.original) : (product.variants ?? []);

  const detailFields = buildDetailFields(product);
  const docLinks = buildDocLinks(product);
  const hasVariants = variants.length > 0;

  return (
    <ProductDetailPanelContainer>
      {(images.length > 0 || docLinks.length > 0) && (
        <ProductDetailImageColumn>
          <ProductImageCarousel images={images} title={product.title} />
          {docLinks.length > 0 && <ProductDetailDocLinks>{docLinks}</ProductDetailDocLinks>}
        </ProductDetailImageColumn>
      )}

      <ProductDetailContent>
        {isPresent(product.description) && (
          <ProductDetailDescription>
            <span className="detail-value">{product.description}</span>
          </ProductDetailDescription>
        )}

        <ProductDetailBody>
          {detailFields.length > 0 && (
            <ProductDetailFieldsColumn>
              {detailFields.map((field) => (
                <ProductDetailFieldRow key={field.label}>
                  <span className="detail-label">{field.label}</span>
                  <span className="detail-value">{field.value}</span>
                </ProductDetailFieldRow>
              ))}
            </ProductDetailFieldsColumn>
          )}

          {hasVariants && (
            <ProductDetailVariantsColumn>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Variants
              </Typography>
              {variants.map((variant, index) => (
                <ProductDetailFieldRow
                  key={variant.sku ?? variant.id ?? `${variant.title}-${index}`}
                >
                  <span className="detail-value">
                    <Link
                      href={variant.permalink ?? variant.url ?? product.permalink ?? product.url}
                      history={{
                        type: "product",
                        data: omit({ ...product, ...variant }, "variants"),
                      }}
                    >
                      {variant.title ?? product.title}
                    </Link>
                  </span>
                  <span className="detail-label" style={{ minWidth: "unset" }}>
                    {[formatDisplayPrice(variant, userSettings), variantQuantity(variant)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </ProductDetailFieldRow>
              ))}
            </ProductDetailVariantsColumn>
          )}
        </ProductDetailBody>
      </ProductDetailContent>
    </ProductDetailPanelContainer>
  );
}

/**
 * Formats a variant's quantity and unit for the variants list, e.g. `"500 g"`.
 * @param variant - The variant to format.
 * @returns The `"<quantity> <uom>"` string, or `""` when no quantity is set.
 * @example
 * ```ts
 * variantQuantity({ quantity: 500, uom: "g" }); // => "500 g"
 * variantQuantity({}); // => ""
 * ```
 * @source
 */
function variantQuantity(variant: Variant): string {
  if (!isPresent(variant.quantity)) return "";
  return `${variant.quantity} ${variant.uom ?? ""}`.trim();
}

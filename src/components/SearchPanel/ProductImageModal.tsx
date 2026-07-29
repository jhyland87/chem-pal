import {
  ProductImageModalBox,
  ProductImageModalClose,
  ProductImageModalHeader,
  ProductImageModalNavButton,
  ProductImageModalStage,
  ProductImageThumb,
  ProductImageThumbStrip,
} from '@/components/StyledComponents';
import { i18n } from '@/helpers/i18n';
import type { ResolvedProductImage } from '@/helpers/product';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState, type ReactElement } from 'react';

/**
 * Props for {@link ProductImageModal}.
 * @source
 */
interface ProductImageModalProps {
  /** Whether the gallery modal is visible. */
  open: boolean;
  /** Invoked on backdrop click, Esc, or the close control. */
  onClose: () => void;
  /** The loadable images to browse, in display order. */
  images: ResolvedProductImage[];
  /** Product title, used for the dialog label and image alt fallback. */
  title: string;
  /** Index (into `images`) to show first, captured when the modal opens. */
  initialIndex: number;
}

/**
 * Clamp an index into the `[0, length)` range, returning `0` for an empty list.
 * @param value - The candidate index.
 * @param length - The number of items being indexed.
 * @returns The clamped index, always a valid position (or `0` when empty).
 * @example
 * ```ts
 * clampIndex(5, 3); // => 2
 * clampIndex(-1, 3); // => 0
 * ```
 * @source
 */
function clampIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(value, 0), length - 1);
}

/**
 * Full-screen-ish gallery modal for a product's images: an enlarged image with
 * prev/next arrows and a thumbnail strip beneath it whose thumbnails load the
 * selected image into the enlarged view. Opened from the detail-panel carousel,
 * seeded to the image the user clicked. Unlike the inline carousel it does not
 * auto-advance — navigation is manual.
 *
 * The enlarged view shows each image's larger `fullSrc`; if that fails to load
 * (e.g. a generated structure depiction 404s) it falls back to the same slot's
 * already-loaded `thumbSrc`.
 * @component
 * @category Components
 * @param props - The modal props (see {@link ProductImageModalProps}).
 * @returns The gallery modal element.
 * @example
 * ```tsx
 * <ProductImageModal
 *   open={open}
 *   onClose={close}
 *   images={resolveProductImages(product)}
 *   title={product.title}
 *   initialIndex={0}
 * />
 * ```
 * @source
 */
export function ProductImageModal({
  open,
  onClose,
  images,
  title,
  initialIndex,
}: ProductImageModalProps): ReactElement {
  const [selected, setSelected] = useState(0);
  const [broken, setBroken] = useState<ReadonlySet<number>>(new Set());
  // Tracks the previous `open` value so the initial index is seeded only on the
  // closed→open edge — the inline carousel keeps auto-cycling while the modal is
  // open, and re-seeding on every `initialIndex` tick would make it jump.
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelected(clampIndex(initialIndex, images.length));
    }
    wasOpen.current = open;
  }, [open, initialIndex, images.length]);

  const count = images.length;
  const position = clampIndex(selected, count);
  const current = images[position];
  const hasMultiple = count > 1;

  const step = (delta: number) => {
    if (count <= 1) return;
    setSelected((index) => (index + delta + count) % count);
  };

  return (
    <Modal
      data-testid="product-image-modal"
      open={open}
      onClose={onClose}
      aria-labelledby="product-image-modal-title"
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
    >
      <ProductImageModalBox
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-image-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ProductImageModalHeader>
          <Typography id="product-image-modal-title" variant="subtitle1" component="h2" noWrap>
            {i18n('product_image_modal_title', [title])}
          </Typography>
          <ProductImageModalClose
            type="button"
            aria-label={i18n('product_image_modal_close')}
            onClick={onClose}
          >
            <CloseIcon fontSize="small" />
          </ProductImageModalClose>
        </ProductImageModalHeader>

        {current !== undefined && (
          <ProductImageModalStage>
            <img
              src={broken.has(position) ? current.thumbSrc : current.fullSrc}
              alt={current.altText ?? title}
              onError={() => setBroken((set) => new Set(set).add(position))}
            />
            {hasMultiple && (
              <>
                <ProductImageModalNavButton
                  type="button"
                  className="prev"
                  aria-label={i18n('product_detail_prev_image')}
                  onClick={() => step(-1)}
                >
                  <ArrowBackIosNewIcon fontSize="small" />
                </ProductImageModalNavButton>
                <ProductImageModalNavButton
                  type="button"
                  className="next"
                  aria-label={i18n('product_detail_next_image')}
                  onClick={() => step(1)}
                >
                  <ArrowForwardIosIcon fontSize="small" />
                </ProductImageModalNavButton>
              </>
            )}
          </ProductImageModalStage>
        )}

        {hasMultiple && (
          <ProductImageThumbStrip>
            {images.map((image, index) => (
              <ProductImageThumb
                key={image.thumbSrc + index}
                type="button"
                className={index === position ? 'active' : undefined}
                aria-current={index === position ? 'true' : undefined}
                aria-label={i18n('product_image_modal_thumbnail', [String(index + 1)])}
                onClick={() => setSelected(index)}
              >
                {/* Decorative: the button's aria-label already names the image. */}
                <img src={image.thumbSrc} alt="" />
              </ProductImageThumb>
            ))}
          </ProductImageThumbStrip>
        )}
      </ProductImageModalBox>
    </Modal>
  );
}

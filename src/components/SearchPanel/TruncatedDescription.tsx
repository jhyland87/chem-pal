import { descriptionPreviewLength } from '@/../config.json';
import { DescriptionToggleLink } from '@/components/StyledComponents';
import { i18n } from '@/helpers/i18n';
import { type KeyboardEvent, type ReactElement, useState } from 'react';

interface TruncatedDescriptionProps {
  /** The full description text to render. */
  text: Maybe<string>;
  /** Character limit before truncation; defaults to `descriptionPreviewLength` in config.json. */
  limit?: number;
}

/**
 * Renders a product description, truncating it to `limit` characters with an
 * inline "[more]" toggle when it is longer. Expanding reveals the full text with
 * a "[less]" toggle to collapse it back to the preview length. Short
 * descriptions (and empty ones) render without a toggle.
 * @param props - The description text and optional character limit.
 * @returns The (optionally truncated) description with a toggle, or null when empty.
 * @example
 * ```tsx
 * <TruncatedDescription text={product.description} />
 * <TruncatedDescription text={longText} limit={120} />
 * ```
 * @source
 */
export function TruncatedDescription({
  text,
  limit = descriptionPreviewLength,
}: TruncatedDescriptionProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  if (!text) {
    return null;
  }

  if (text.length <= limit) {
    return <span className="detail-value">{text}</span>;
  }

  const preview = expanded ? text : `${text.slice(0, limit).trimEnd()}…`;
  const toggle = () => setExpanded((prev) => !prev);

  return (
    <span className="detail-value">
      {preview}
      <DescriptionToggleLink
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
      >
        [{expanded ? i18n('common_show_less') : i18n('common_show_more')}]
      </DescriptionToggleLink>
    </span>
  );
}

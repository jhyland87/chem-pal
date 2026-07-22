import { highlightSearchQuery } from '@/utils/search-query/highlightSearchQuery';
import { ChangeEvent, CSSProperties, KeyboardEvent, useEffect, useMemo, useRef } from 'react';
import styles from './HighlightedSearchInput.module.scss';

/** Props for {@link HighlightedSearchInput}. */
interface HighlightedSearchInputProps {
  /** Current query text (controlled). */
  value: string;
  /** Called with the new value on every keystroke. */
  onChange: (value: string) => void;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Disables input (e.g. while searching). */
  disabled?: boolean;
  /** Accessible label for the input. */
  ariaLabel?: string;
  /** Extra class names applied to the wrapper (e.g. layout classes from the parent). */
  className?: string;
  /** Inline style applied to the wrapper — used to set font-size/flex/margins per call site. */
  style?: CSSProperties;
  /** Forwarded to the input (e.g. submit-on-Enter handling). */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Notified when validity changes: `blocked` is true (with a `message`) for invalid queries. */
  onValidityChange?: (blocked: boolean, message?: string) => void;
}

/**
 * Search text input with live syntax highlighting for advanced (boolean) queries. A plain
 * query renders as an ordinary input; once the query becomes advanced, the typed text is made
 * transparent and a colored backdrop (operators, parentheses by depth, quoted phrases, terms)
 * is shown behind the caret. Invalid advanced queries (malformed or with no inclusive term)
 * are flagged and reported via {@link HighlightedSearchInputProps.onValidityChange}.
 * @param props - The input props.
 * @returns The highlighted search input element.
 * @example
 * ```tsx
 * <HighlightedSearchInput
 *   value={query}
 *   onChange={setQuery}
 *   onValidityChange={(blocked, msg) => setError(blocked ? msg : undefined)}
 * />
 * ```
 * @source
 */
export default function HighlightedSearchInput({
  value,
  onChange,
  placeholder,
  disabled,
  ariaLabel,
  className,
  style,
  onKeyDown,
  onValidityChange,
}: HighlightedSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const highlight = useMemo(() => highlightSearchQuery(value), [value]);

  // Latest-callback ref so validity is reported only when it actually changes, regardless of
  // whether the parent memoizes the handler.
  const onValidityChangeRef = useRef(onValidityChange);
  onValidityChangeRef.current = onValidityChange;
  useEffect(() => {
    onValidityChangeRef.current?.(highlight.state === 'error', highlight.message);
  }, [highlight.state, highlight.message]);

  // Keep the backdrop scrolled in lockstep with the input's horizontal scroll.
  const syncScroll = (): void => {
    if (inputRef.current && backdropRef.current) {
      backdropRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };
  useEffect(syncScroll, [value]);

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`} style={style}>
      <div
        ref={backdropRef}
        className={styles.backdrop}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlight.html }}
      />
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        spellCheck={false}
        autoComplete="off"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
      />
    </div>
  );
}

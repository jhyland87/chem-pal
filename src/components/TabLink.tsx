import { addHistory } from "@/helpers/history";
import { useStatusBar } from "@/components/StatusBar";
import Link from "@mui/material/Link";
import { MouseEvent, ReactNode } from "react";

/**
 * Props for {@link TabLink}. A plain anchor plus optional search-history
 * recording; extra props are spread onto the underlying MUI `Link`.
 * @example
 * ```tsx
 * const props: TabLinkProps = { href: "https://example.com/p/1", children: "View" };
 * ```
 * @source
 */
interface TabLinkProps {
  /** Destination URL; opened in a background tab (or a new window outside the extension). */
  href: string;
  /** Link content. */
  children: ReactNode;
  /** Optional history entry recorded when the link is clicked. */
  history?: HistoryEntry;
  /** Additional props forwarded to the underlying MUI `Link`. */
  [key: string]: unknown;
}

// When the user clicks on a link in the table
const handleResultClick = (event: MouseEvent<HTMLAnchorElement>, history?: HistoryEntry) => {
  // Stop the form from propagating
  event.preventDefault();
  // Use currentTarget (the element the handler is bound to) rather than
  // target, which could be a child element inside the anchor.
  const anchor = event.currentTarget;
  if (typeof chrome?.tabs !== "undefined") {
    chrome.tabs.create({ url: anchor.href, active: false });
  } else {
    window.open(anchor.href, "_blank");
  }

  if (history) {
    addHistory(history);
  }
};

/**
 * TabLink component that displays a link with a custom onClick handler.
 * @category Components
 * @param props - The component props
 * @returns The TabLink component
 * @example
 * ```tsx
 * <TabLink href="https://example.com/p/1" history={entry}>Acetone</TabLink>
 * // Clicking opens the URL in a background tab and records `entry` in history.
 * ```
 * @source
 */
export default function TabLink({ href, history, children, ...props }: TabLinkProps) {
  const { setStatusText } = useStatusBar();

  return (
    <Link
      href={href}
      onClick={(e) => handleResultClick(e, history)}
      onMouseEnter={() => setStatusText(href)}
      onMouseLeave={() => setStatusText(null)}
      sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
      {...props}
    >
      {children}
    </Link>
  );
}

import { addHistory } from "@/helpers/history";
import Link from "@mui/material/Link";
import { MouseEvent, ReactNode } from "react";

interface TabLinkProps {
  href: string;
  children: ReactNode;
  history?: HistoryEntry;
  [key: string]: unknown;
}

// When the user clicks on a link in the table
const handleResultClick = (event: MouseEvent<HTMLAnchorElement>, history?: HistoryEntry) => {
  // Stop the form from propagating
  event.preventDefault();
  // Get the target
  const target = event.target as HTMLAnchorElement;
  // Open a new tab to that targets href
  if (typeof chrome?.tabs !== "undefined") {
    chrome.tabs.create({ url: target.href, active: false });
  } else {
    window.open(target.href, "_blank");
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
 */
export default function TabLink({ href, history, children, ...props }: TabLinkProps) {
  return (
    <Link href={href} onClick={(e) => handleResultClick(e, history)} {...props}>
      {children}
    </Link>
  );
}

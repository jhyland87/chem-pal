import Link from "@mui/material/Link";

import { MouseEvent } from "react";
import { LinkProps } from "types";
// When the user clicks on a link in the table
const handleResultClick = (event: MouseEvent<HTMLAnchorElement>) => {
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
};

/**
 * TabLink component that displays a link with a custom onClick handler.
 * @category Component
 * @param {LinkProps} props - The component props
 * @param {string} props.href - The href of the link
 * @param {React.ReactNode} props.children - The children of the link
 * @returns {JSX.Element} The TabLink component
 */
export default function TabLink({ href, children }: LinkProps) {
  return (
    <Link href={href} onClick={handleResultClick}>
      {children}
    </Link>
  );
}

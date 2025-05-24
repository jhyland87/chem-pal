import { type LinkProps } from "@/types/props";
import Link from "@mui/material/Link";
import { MouseEvent } from "react";

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
 * @param props - The component props
 * @returns The TabLink component
 */
export default function TabLink({ href, children, ...props }: LinkProps) {
  return (
    <Link href={href} onClick={handleResultClick} {...props}>
      {children}
    </Link>
  );
}

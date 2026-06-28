/** @internal */
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import { FC } from "react";

/** Props for {@link CustomFileIcon}: a colored document with a labeled band and optional language badge. */
export interface CustomFileIconProps extends SvgIconProps {
  /** Text shown on the document's label band (e.g. "SDS", "SPECS"). */
  label: string;
  /** Font size of the label text, in user units. Defaults to 12. */
  labelFontSize?: number;
  /** Letter spacing of the label text. Defaults to ".08em". */
  labelLetterSpacing?: string;
  /** Fill color of the document body. Defaults to white. */
  documentColor?: string;
  /** Fill color of the label band. Defaults to red. */
  labelColor?: string;
  /** Color of the label/badge text. Defaults to black or white, auto-chosen for contrast. */
  textColor?: string;
  /** Color of the document/label outlines. Defaults to the inherited text color. */
  outlineColor?: string;
  /** Optional language code (e.g. "EN") shown as a corner badge. Omit to hide the badge. */
  language?: string;
  /** Fill color of the language badge. Defaults to green. */
  languageColor?: string;
}

/** Closed outline of the document body, a rounded sheet with a folded top-right corner. */
const DOCUMENT_PATH =
  "M7.24,6.42 C7.24,5.55,7.95,4.85,8.83,4.85 H30.06 L41.46,16.25 V43.58 " +
  "C41.46,44.45,40.7,45.15,39.76,45.15 H8.94 C8,45.15,7.24,44.45,7.24,43.58 Z";

/**
 * Picks a readable text color (black or white) for a given background color.
 * Uses the perceptual YIQ brightness of the parsed RGB; falls back to black when the
 * background can't be parsed as a hex color (e.g. "currentColor" or a named color).
 *
 * @param background - A CSS hex color string, 3- or 6-digit (e.g. "#e8302a", "#fff").
 * @returns "#000000" for light backgrounds, "#ffffff" for dark ones.
 * @example
 * getContrastTextColor("#e8302a"); // "#ffffff" (red → white)
 * getContrastTextColor("#f2dd2e"); // "#000000" (yellow → black)
 * @source
 */
const getContrastTextColor = (background: string): string => {
  const hex = background.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "#000000";
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
};

/**
 * A Material-UI icon that renders a colored document with a labeled band and an optional
 * language badge. Used as the shared base for document-type icons such as SDS and spec sheets.
 * The label and badge text default to black or white, whichever contrasts with their
 * background; pass `textColor` to override both.
 *
 * @component
 * @param props - SvgIcon props plus the label text and optional color/language overrides
 * @returns A React component that renders the labeled document icon
 * @example
 * // A red "SDS" document with an English badge
 * <CustomFileIcon label="SDS" language="EN" fontSize="small" />
 * @source
 */
const CustomFileIcon: FC<CustomFileIconProps> = ({
  label,
  labelFontSize = 12,
  labelLetterSpacing = ".08em",
  documentColor = "#ffffff",
  labelColor = "#e8302a",
  textColor,
  outlineColor = "currentColor",
  language,
  languageColor = "#000000",
  ...props
}) => {
  const labelTextColor = textColor ?? getContrastTextColor(labelColor);
  const badgeTextColor = textColor ?? getContrastTextColor(languageColor);
  return (
    <SvgIcon {...props} viewBox="0 0 48 48">
      <g stroke={outlineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={DOCUMENT_PATH} fill={documentColor} />
        <rect
          x="3.52"
          y="17.04"
          width="41.48"
          height="17.12"
          rx="1.57"
          ry="1.57"
          fill={labelColor}
        />
      </g>
      <text
        x="24"
        y="29.12"
        textAnchor="middle"
        fill={labelTextColor}
        fontFamily="EMprint-Bold, EMprint, sans-serif"
        fontSize={labelFontSize}
        fontWeight={700}
        letterSpacing={labelLetterSpacing}
      >
        {label}
      </text>
      {language ? (
        <>
          <rect
            x="22.5"
            y="34"
            width="19"
            height="11"
            rx="1.5"
            ry="1.5"
            fill={languageColor}
            stroke={outlineColor}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <text
            x="32"
            y="42.3"
            textAnchor="middle"
            fill={badgeTextColor}
            fontFamily="EMprint-Bold, EMprint, sans-serif"
            fontSize="8"
            fontWeight={700}
          >
            {language.toUpperCase()}
          </text>
        </>
      ) : null}
    </SvgIcon>
  );
};

export default CustomFileIcon;

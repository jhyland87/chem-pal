import { i18n } from '@/helpers/i18n';
import { formatDisplayPrice } from '@/helpers/price';
import { describeTrend } from '@/helpers/priceHistory';
import { Typography, useTheme } from '@mui/material';
import { type ReactElement } from 'react';

/** The user settings the price-history views read to convert USD for display. */
export type PriceHistorySettings = Pick<
  UserSettings,
  'currency' | 'currencyRate' | 'priceTracking'
>;

/** MUI theme color token per trend direction (rising price = bad = red). */
export const TREND_COLOR = {
  up: 'error.main',
  down: 'success.main',
  flat: 'text.secondary',
} as const;

/** Glyph per trend direction. */
export const TREND_GLYPH = { up: '▲', down: '▼', flat: '—' } as const;

/**
 * Format a USD amount for display in the user's currency, reusing the same
 * conversion the results table applies so history values match the table.
 * @category Helpers
 * @param usd - The amount in USD.
 * @param userSettings - The user's currency/rate settings.
 * @returns The localized currency string (e.g. `"$19.99"`).
 * @example
 * ```ts
 * formatUsd(19.99, { currency: "EUR", currencyRate: 0.9 }); // => "€17.99"
 * ```
 * @source
 */
export function formatUsd(usd: number, userSettings?: PriceHistorySettings): string {
  return formatDisplayPrice({ usdPrice: usd, price: usd, currencyCode: 'USD' }, userSettings);
}

/**
 * Inline SVG sparkline of a price series. Points are spaced evenly by index and
 * scaled to the series' own min/max. Renders nothing for a series too short to
 * draw a line (fewer than two points).
 *
 * By default the line inherits the surrounding text color (`currentColor`). Pass
 * `colorByTrend` to instead color it by the series' latest move — matching the
 * {@link PriceTrend} badge: rising price = red, drop = green, flat = muted.
 * @category Components
 * @param props - The series points to plot, and whether to color by trend.
 * @returns The sparkline element, or `null` when there's nothing to draw.
 * @example
 * ```tsx
 * <PriceSparkline points={[{ t: 1, usd: 20 }, { t: 2, usd: 22 }]} />
 * <PriceSparkline points={series.points} colorByTrend />
 * ```
 * @source
 */
export function PriceSparkline({
  points,
  colorByTrend = false,
}: {
  points: readonly PricePoint[];
  colorByTrend?: boolean;
}): ReactElement | null {
  const theme = useTheme();
  if (points.length < 2) return null;
  const width = 84;
  const height = 22;
  const pad = 2;
  const values = points.map((p) => p.usd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);
  const coords = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + (height - pad * 2) * (1 - (p.usd - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  // Match the PriceTrend badge's semantics (rising = red, drop = green) by
  // resolving the same palette tokens to concrete stroke colors for the SVG.
  const trendStroke = {
    up: theme.palette.error.main,
    down: theme.palette.success.main,
    flat: theme.palette.text.secondary,
  } as const;
  const stroke = colorByTrend ? trendStroke[describeTrend(points).direction] : 'currentColor';
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={i18n('product_detail_sparkline_aria')}
      style={{ display: 'block' }}
    >
      <polyline
        points={coords}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Compact trend indicator: a colored glyph plus the signed delta and percent
 * change since the previous recorded price. Rising prices read red, drops read
 * green. Renders nothing when there aren't two points to compare.
 * @category Components
 * @param props - The series points and the user's currency settings.
 * @returns The trend element, or `null` when there's no move to show.
 * @example
 * ```tsx
 * <PriceTrend points={series.points} userSettings={userSettings} />
 * ```
 * @source
 */
export function PriceTrend({
  points,
  userSettings,
}: {
  points: readonly PricePoint[];
  userSettings?: PriceHistorySettings;
}): ReactElement | null {
  if (points.length < 2) return null;
  const trend = describeTrend(points);
  const sign = trend.deltaUsd > 0 ? '+' : trend.deltaUsd < 0 ? '−' : '';
  const magnitude = formatUsd(Math.abs(trend.deltaUsd), userSettings);
  return (
    <Typography
      component="span"
      variant="caption"
      color={TREND_COLOR[trend.direction]}
      sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
    >
      {TREND_GLYPH[trend.direction]}
      {trend.direction !== 'flat' &&
        ` ${sign}${magnitude} (${sign}${Math.abs(trend.pctChange).toFixed(1)}%)`}
    </Typography>
  );
}

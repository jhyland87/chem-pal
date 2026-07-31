import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatUsd, PriceSparkline, PriceTrend } from '../PriceTrendGraph';

/** Builds a price series from bare USD values (timestamps are incidental here). */
function series(...usdValues: number[]): PricePoint[] {
  return usdValues.map((usd, i) => ({ t: i + 1, usd }));
}

describe('PriceTrendGraph', () => {
  describe('formatUsd', () => {
    it('formats a USD amount with no settings', () => {
      expect(formatUsd(19.99)).toBe('$19.99');
    });
  });

  describe('PriceSparkline', () => {
    it('renders nothing for fewer than two points', () => {
      const { container } = render(<PriceSparkline points={series(20)} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('draws a polyline for a series of two or more points', () => {
      const { container } = render(<PriceSparkline points={series(10, 20, 15)} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      const polyline = container.querySelector('polyline');
      expect(polyline).toBeInTheDocument();
      // Three points → three "x,y" coordinate pairs.
      expect(polyline?.getAttribute('points')?.trim().split(' ')).toHaveLength(3);
    });

    it('inherits currentColor by default', () => {
      const { container } = render(<PriceSparkline points={series(10, 20)} />);
      expect(container.querySelector('polyline')).toHaveAttribute('stroke', 'currentColor');
    });

    it('colors by trend when colorByTrend is set', () => {
      const { container } = render(<PriceSparkline points={series(10, 20)} colorByTrend />);
      // A concrete palette color replaces currentColor when coloring by trend.
      expect(container.querySelector('polyline')).not.toHaveAttribute('stroke', 'currentColor');
    });
  });

  describe('PriceTrend', () => {
    it('renders nothing for fewer than two points', () => {
      const { container } = render(<PriceTrend points={series(20)} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('shows an up glyph and signed delta for a rising series', () => {
      const { container } = render(<PriceTrend points={series(10, 20)} />);

      expect(container.textContent).toContain('▲');
      expect(container.textContent).toContain('+');
      expect(container.textContent).toContain('%');
    });

    it('shows a down glyph for a falling series', () => {
      const { container } = render(<PriceTrend points={series(20, 10)} />);
      expect(container.textContent).toContain('▼');
    });

    it('shows only the flat glyph with no delta for an unchanged series', () => {
      const { container } = render(<PriceTrend points={series(10, 10)} />);

      expect(container.textContent).toContain('—');
      expect(container.textContent).not.toContain('%');
    });
  });
});

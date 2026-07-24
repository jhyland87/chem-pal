import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import CryptoPaymentIcon, { CryptoType } from '../CryptoPaymentIcon';

const types: CryptoType[] = ['bitcoin', 'ethereum', 'tether', 'litecoin'];

describe('CryptoPaymentIcon', () => {
  test.each(types)('renders %s icon without crashing', (type) => {
    const { container } = render(<CryptoPaymentIcon type={type} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test.each(types)('applies custom props for %s', (type) => {
    const { container } = render(
      <CryptoPaymentIcon
        type={type}
        data-testid="crypto-icon"
        width={42}
        className="custom-class"
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '42');
    expect(svg).toHaveClass('custom-class');
  });

  test.each(types)('shows tooltip for %s', async (type) => {
    render(<CryptoPaymentIcon type={type} />);
    const icon = screen.getByTestId(`crypto-icon-${type}`);
    await userEvent.hover(icon);
    expect(await screen.findByText(type)).toBeInTheDocument();
  });

  // Each icon type has a unique color or shape marker in its SVG content.
  const svgMarkers: [CryptoType, string][] = [
    ['bitcoin', '#F7931A'],
    ['ethereum', '#627EEA'],
    ['tether', '₮'],
    ['litecoin', 'Ł'],
  ];

  test.each(svgMarkers)('renders correct SVG content for %s (contains %s)', (type, marker) => {
    const { container } = render(<CryptoPaymentIcon type={type} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.innerHTML).toContain(marker);
  });
});

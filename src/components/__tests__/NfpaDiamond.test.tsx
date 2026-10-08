import { NFPA_COLORS } from '@/constants/hazards';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NfpaDiamond } from '../NfpaDiamond';

describe('NfpaDiamond', () => {
  it.each([
    [{ health: '1', fire: '3', reactivity: '0' }, 'NFPA 704: health 1, fire 3, reactivity 0'],
    [
      { health: '2', fire: '4', reactivity: '1', special: 'W' },
      'NFPA 704: health 2, fire 4, reactivity 1, W',
    ],
    [{}, 'NFPA 704: health ?, fire ?, reactivity ?'],
    [{ fire: '3' }, 'NFPA 704: health ?, fire 3, reactivity ?'],
  ])('describes %j for screen readers', (props, label) => {
    render(<NfpaDiamond {...props} />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('draws the four coloured quadrants with their ratings', () => {
    const { container } = render(<NfpaDiamond health="1" fire="3" reactivity="0" special="OX" />);

    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toEqual([
      NFPA_COLORS.fire,
      NFPA_COLORS.health,
      NFPA_COLORS.reactivity,
      NFPA_COLORS.special,
    ]);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    // Order: fire (top), health (left), reactivity (right), special (bottom).
    expect(texts).toEqual(['3', '1', '0', 'OX']);
  });

  it('leaves a quadrant blank when its rating is missing', () => {
    const { container } = render(<NfpaDiamond fire="2" />);
    expect(Array.from(container.querySelectorAll('text')).map((t) => t.textContent)).toEqual([
      '2',
      '',
      '',
      '',
    ]);
  });

  it.each([
    [undefined, '120'],
    [48, '48'],
  ])('renders at size %s', (size, expected) => {
    render(<NfpaDiamond size={size} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', expected);
    expect(svg).toHaveAttribute('height', expected);
  });
});

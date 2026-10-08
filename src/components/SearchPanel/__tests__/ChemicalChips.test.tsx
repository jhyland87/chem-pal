import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string, subs?: string[]) => (subs?.length ? `${key}:${subs.join(',')}` : key),
}));

import { ChemicalChips } from '../ChemicalChips';

describe('ChemicalChips', () => {
  it.each([[''], ['   ']])('renders nothing for the query %j', (query) => {
    const { container } = render(<ChemicalChips query={query} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a labelled chip for a single reagent', () => {
    render(<ChemicalChips query="acetone" onSelect={vi.fn()} />);

    expect(screen.getByText('chem_info_searched_for')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chem_info_chip_aria:acetone' })).toHaveTextContent(
      'acetone',
    );
  });

  it('renders one chip per reagent of a boolean query', () => {
    render(
      <ChemicalChips
        query="(sodium OR potassium) hydroxide OR potassium carbonate"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'sodium hydroxide',
      'potassium hydroxide',
      'potassium carbonate',
    ]);
  });

  it('reports the reagent name when a chip is clicked', () => {
    const onSelect = vi.fn();
    render(<ChemicalChips query="acetone OR ethanol" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'chem_info_chip_aria:ethanol' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('ethanol');
  });

  it('updates the chips when the query changes', () => {
    const { rerender } = render(<ChemicalChips query="acetone" onSelect={vi.fn()} />);
    rerender(<ChemicalChips query="ethanol" onSelect={vi.fn()} />);

    expect(screen.queryByText('acetone')).not.toBeInTheDocument();
    expect(screen.getByText('ethanol')).toBeInTheDocument();
  });
});

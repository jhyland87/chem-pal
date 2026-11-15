import type { SupplierOutcome } from '@/constants/common';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string, subs?: string[]) => (subs?.length ? `${key}:${subs.join(',')}` : key),
}));

import { groupOutcomes, SupplierStatusChip } from '../SupplierStatusChip';

const OUTCOMES: SupplierOutcome[] = [
  { supplier: 'Zeta', status: 'ok', resultCount: 4 },
  { supplier: 'Alpha', status: 'ok', resultCount: 2 },
  { supplier: 'Beta', status: 'empty', resultCount: 0 },
  { supplier: 'Gamma', status: 'failed', resultCount: 0 },
  { supplier: 'Delta', status: 'rate_limited', resultCount: 1 },
];

describe('groupOutcomes', () => {
  it('lists problems first and sorts suppliers by name', () => {
    const groups = groupOutcomes(OUTCOMES);

    expect(groups.map((group) => group.status)).toEqual(['failed', 'rate_limited', 'empty', 'ok']);
    expect(groups[3].items.map((item) => item.supplier)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('SupplierStatusChip', () => {
  it('renders nothing when no outcomes are known', () => {
    const { container } = render(<SupplierStatusChip outcomes={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('counts suppliers that finished without a problem', () => {
    render(<SupplierStatusChip outcomes={OUTCOMES} />);

    expect(screen.getByRole('button', { name: 'supplier_status_aria' })).toHaveTextContent(
      'supplier_status_summary:3,5',
    );
  });

  it('lists each supplier under its outcome when opened', () => {
    render(<SupplierStatusChip outcomes={OUTCOMES} />);

    fireEvent.click(screen.getByRole('button', { name: 'supplier_status_aria' }));

    expect(screen.getByText('supplier_status_failed (1)')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Delta (1)')).toBeInTheDocument();
    expect(screen.getByText('Alpha (2), Zeta (4)')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasExpandableDetail: vi.fn(),
  resultsTableProps: undefined as unknown,
}));

vi.mock('@/helpers/product', () => ({ hasExpandableDetail: mocks.hasExpandableDetail }));

// Capture the props ResultsTable receives so we can exercise them directly.
vi.mock('../ResultsTable', () => ({
  default: (props: unknown) => {
    mocks.resultsTableProps = props;
    return <div data-testid="results-table" />;
  },
}));

import SearchPanel from '../SearchPanel';

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resultsTableProps = undefined;
  });

  it('renders the results table', () => {
    render(<SearchPanel />);

    expect(screen.getByTestId('results-table')).toBeInTheDocument();
  });

  it('passes a columnFilterFns state tuple to ResultsTable', () => {
    render(<SearchPanel />);

    const props = mocks.resultsTableProps as { columnFilterFns: [unknown, unknown] };
    expect(Array.isArray(props.columnFilterFns)).toBe(true);
    expect(props.columnFilterFns).toHaveLength(2);
    // The first element is the filter state, the second its setter.
    expect(props.columnFilterFns[0]).toEqual([]);
    expect(typeof props.columnFilterFns[1]).toBe('function');
  });

  it('wires getRowCanExpand to hasExpandableDetail on the row original', () => {
    mocks.hasExpandableDetail.mockReturnValue(true);
    render(<SearchPanel />);

    const props = mocks.resultsTableProps as {
      getRowCanExpand: (row: { original: unknown }) => boolean;
    };
    const original = { id: 'p1' };
    const canExpand = props.getRowCanExpand({ original });

    expect(mocks.hasExpandableDetail).toHaveBeenCalledWith(original);
    expect(canExpand).toBe(true);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoadingBackdrop from '../LoadingBackdrop';

/**
 * Build a full set of LoadingBackdrop props with sensible defaults so each test
 * only needs to override the fields relevant to the branch under test.
 * @param overrides - Partial props to merge over the defaults.
 * @returns A complete LoadingBackdropProps object.
 */
function makeProps(overrides: Partial<LoadingBackdropProps> = {}): LoadingBackdropProps {
  return {
    open: true,
    onClick: vi.fn(),
    resultCount: 0,
    supplierResultsCount: 0,
    ...overrides,
  };
}

describe('LoadingBackdrop', () => {
  it('does not render backdrop contents when closed', () => {
    render(<LoadingBackdrop {...makeProps({ open: false })} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the loading message when there are no results', () => {
    render(<LoadingBackdrop {...makeProps({ resultCount: 0 })} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows the aborting message and disables the cancel button while aborting', () => {
    render(<LoadingBackdrop {...makeProps({ isAborting: true, resultCount: 5 })} />);

    expect(screen.getByText('Aborting...')).toBeInTheDocument();
    expect(screen.getByText('Cancel search').closest('button')).toBeDisabled();
  });

  it('shows the singular message for exactly one result', () => {
    render(<LoadingBackdrop {...makeProps({ resultCount: 1, supplierResultsCount: 1 })} />);

    expect(screen.getByText('Found 1 result.')).toBeInTheDocument();
  });

  it('shows the single-supplier message when one supplier returned many results', () => {
    render(<LoadingBackdrop {...makeProps({ resultCount: 4, supplierResultsCount: 1 })} />);

    expect(screen.getByText('Found 4 results from 1 supplier')).toBeInTheDocument();
  });

  it('shows the many-suppliers message when multiple suppliers returned results', () => {
    render(<LoadingBackdrop {...makeProps({ resultCount: 9, supplierResultsCount: 3 })} />);

    expect(screen.getByText('Found 9 results from 3 suppliers')).toBeInTheDocument();
  });

  it('invokes onClick when the cancel button is pressed', () => {
    const onClick = vi.fn();
    render(<LoadingBackdrop {...makeProps({ resultCount: 2, supplierResultsCount: 2, onClick })} />);

    const cancelButton = screen.getByText('Cancel search').closest('button');
    expect(cancelButton).toBeTruthy();
    fireEvent.click(cancelButton!);

    expect(onClick).toHaveBeenCalledOnce();
  });
});

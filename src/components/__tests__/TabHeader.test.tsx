import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TabHeader from '../TabHeader';

/** The section tabs in render order, paired with their zero-based index. */
const TABS: ReadonlyArray<{ index: number; label: string }> = [
  { index: 0, label: 'Search' },
  { index: 1, label: 'Suppliers' },
  { index: 2, label: 'Favorites' },
  { index: 3, label: 'History' },
  { index: 4, label: 'Settings' },
];

describe('TabHeader', () => {
  it('renders one tab per section', () => {
    render(<TabHeader page={0} setPage={vi.fn()} />);

    expect(screen.getAllByRole('tab')).toHaveLength(TABS.length);
  });

  it.each(TABS)('renders the "$label" tab label', ({ label }) => {
    render(<TabHeader page={0} setPage={vi.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(TABS)(
    'wires accessibility ids for the "$label" tab (index $index)',
    ({ index }) => {
      render(<TabHeader page={0} setPage={vi.fn()} />);

      const tab = screen.getAllByRole('tab')[index];
      expect(tab).toHaveAttribute('id', `full-width-tab-${index}`);
      expect(tab).toHaveAttribute('aria-controls', `full-width-tabpanel-${index}`);
    },
  );

  it('marks the tab matching the page prop as selected', () => {
    render(<TabHeader page={2} setPage={vi.fn()} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
  });

  it.each(TABS)('calls setPage with $index when the "$label" tab is clicked', ({ index }) => {
    const setPage = vi.fn();
    // Start on a different tab — MUI only fires onChange when the value changes.
    const startingPage = (index + 1) % TABS.length;
    render(<TabHeader page={startingPage} setPage={setPage} />);

    fireEvent.click(screen.getAllByRole('tab')[index]);

    expect(setPage).toHaveBeenCalledWith(index);
  });
});

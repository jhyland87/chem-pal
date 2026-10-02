import { PANEL } from '@/constants/common';
import { getAllPriceSeries } from '@/utils/idbCache';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PriceHistoryPanel from '../PriceHistoryPanel';

vi.mock('@/utils/idbCache', () => ({ getAllPriceSeries: vi.fn() }));
vi.mock('../../SearchPanel/PriceTrendGraph', () => ({
  formatUsd: (usd: number) => `$${usd.toFixed(2)}`,
  PriceTrend: ({ points }: { points: Array<{ usd: number }> }) => (
    <span data-testid="trend">{points.map((p) => p.usd).join('>')}</span>
  ),
}));

const setPanel = vi.fn();
let hasSetPanel = true;
vi.mock('@/context', () => ({
  useAppContext: () => ({
    userSettings: { currency: 'USD' },
    setPanel: hasSetPanel ? setPanel : undefined,
  }),
}));

/** Builds a series with one change at `t` from `from` to `to`. */
function series(
  id: string,
  title: string,
  t: number,
  from: number,
  to: number,
  permalink?: string,
) {
  return {
    id,
    productKey: id,
    supplier: 'ACME',
    title,
    permalink,
    points: [
      { t: t - 1000, usd: from },
      { t, usd: to },
    ],
    updatedAt: t,
  } satisfies PriceHistoryEntry;
}

/** Titles of the rendered body rows, in order. */
function bodyTitles(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[2].textContent ?? '');
}

describe('PriceHistoryPanel', () => {
  beforeEach(() => {
    hasSetPanel = true;
    setPanel.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(getAllPriceSeries).mockReset().mockResolvedValue([]);
  });

  it('shows the empty state when no price has changed', async () => {
    render(<PriceHistoryPanel />);

    expect(await screen.findByText(/no price/i)).toBeTruthy();
  });

  it('renders one row per change, newest first, with prices and a trend', async () => {
    vi.mocked(getAllPriceSeries).mockResolvedValue([
      series('a', 'Older', 1_700_000_000_000, 10, 12),
      series('b', 'Newer', 1_800_000_000_000, 20, 15),
    ]);
    render(<PriceHistoryPanel />);

    await waitFor(() => expect(bodyTitles()).toEqual(['Newer', 'Older']));
    expect(screen.getByText('$20.00')).toBeTruthy();
    expect(screen.getByText('$15.00')).toBeTruthy();
    expect(screen.getAllByTestId('trend').map((el) => el.textContent)).toEqual(['20>15', '10>12']);
  });

  it('links titles that have a permalink', async () => {
    vi.mocked(getAllPriceSeries).mockResolvedValue([
      series('a', 'Linked', 2000, 1, 2, 'https://x.test/p'),
      series('b', 'Plain', 1000, 1, 2),
    ]);
    render(<PriceHistoryPanel />);

    const link = await screen.findByRole('link', { name: 'Linked' });
    expect(link.getAttribute('href')).toBe('https://x.test/p');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'Plain' })).toBeNull();
  });

  it('re-sorts when a header is clicked', async () => {
    vi.mocked(getAllPriceSeries).mockResolvedValue([
      series('a', 'Bravo', 2000, 1, 2),
      series('b', 'Alpha', 1000, 1, 2),
    ]);
    render(<PriceHistoryPanel />);
    await waitFor(() => expect(bodyTitles()).toEqual(['Bravo', 'Alpha']));

    const titleHeader = screen.getAllByRole('columnheader')[2];
    fireEvent.click(titleHeader);
    await waitFor(() => expect(bodyTitles()).toEqual(['Alpha', 'Bravo']));
    fireEvent.click(titleHeader);
    await waitFor(() => expect(bodyTitles()).toEqual(['Bravo', 'Alpha']));
  });

  it('warns and stays empty when loading fails', async () => {
    vi.mocked(getAllPriceSeries).mockRejectedValue(new Error('idb down'));
    render(<PriceHistoryPanel />);

    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(screen.getByText(/no price/i)).toBeTruthy();
  });

  describe('back button', () => {
    it('returns to the search home panel', async () => {
      render(<PriceHistoryPanel />);

      fireEvent.click(screen.getAllByRole('button')[0]);

      expect(setPanel).toHaveBeenCalledWith(PANEL.SEARCH_HOME);
    });

    it('is omitted when the context has no setPanel', () => {
      hasSetPanel = false;
      render(<PriceHistoryPanel />);

      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('pagination', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => series(`s${i}`, `Item ${i}`, 1000 + i, 1, 2));

    it('is hidden for ten rows or fewer', async () => {
      vi.mocked(getAllPriceSeries).mockResolvedValue(many(10));
      render(<PriceHistoryPanel />);

      await waitFor(() => expect(bodyTitles()).toHaveLength(10));
      expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('pages through longer logs 25 rows at a time', async () => {
      vi.mocked(getAllPriceSeries).mockResolvedValue(many(60));
      render(<PriceHistoryPanel />);

      await waitFor(() => expect(bodyTitles()).toHaveLength(25));
      expect(bodyTitles()[0]).toBe('Item 59');

      const [first, prev, next, last] = screen.getAllByRole('button').slice(-4);
      expect((first as HTMLButtonElement).disabled).toBe(true);
      expect((prev as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(next);
      await waitFor(() => expect(bodyTitles()[0]).toBe('Item 34'));

      fireEvent.click(last);
      await waitFor(() => expect(bodyTitles()).toHaveLength(10));
      expect((next as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(prev);
      await waitFor(() => expect(bodyTitles()).toHaveLength(25));

      fireEvent.click(first);
      await waitFor(() => expect(bodyTitles()[0]).toBe('Item 59'));
    });
  });
});

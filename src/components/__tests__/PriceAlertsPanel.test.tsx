import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { i18n } from '@/helpers/i18n';
import type { PriceAlert } from '@/helpers/priceAlerts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  removePriceAlerts: vi.fn(),
  hasNotificationPermission: vi.fn(),
  requestNotificationPermission: vi.fn(),
}));

vi.mock('@/helpers/priceAlerts', () => ({ removePriceAlerts: mocks.removePriceAlerts }));
vi.mock('@/helpers/permissions', () => ({
  hasNotificationPermission: mocks.hasNotificationPermission,
  requestNotificationPermission: mocks.requestNotificationPermission,
}));

import { PriceAlertsPanel } from '../PriceAlertsPanel';

/** Builds an alert, defaulting to one that has never been checked. */
const makeAlert = (id: string, overrides: Partial<PriceAlert> = {}): PriceAlert => ({
  id,
  supplier: 'Carolina Chemical',
  ref: {
    supplier: 'Carolina Chemical',
    url: `https://x.test/${id}`,
  } as unknown as PriceAlert['ref'],
  title: `Product ${id}`,
  permalink: `https://x.test/${id}`,
  createdAt: 1,
  failures: 0,
  lastPrices: {},
  ...overrides,
});

const selectBox = (title: string) =>
  screen.getByRole('checkbox', { name: i18n('price_alerts_select_item', [title]) });
const selectAllBox = () => screen.getByRole('checkbox', { name: i18n('price_alerts_select_all') });
const deleteSelected = (count: number) =>
  screen.getByRole('button', { name: i18n('price_alerts_delete_selected', [String(count)]) });
const deleteAll = () => screen.getByRole('button', { name: i18n('price_alerts_delete_all') });

describe('PriceAlertsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.removePriceAlerts.mockResolvedValue(undefined);
    mocks.hasNotificationPermission.mockResolvedValue(true);
    mocks.requestNotificationPermission.mockResolvedValue(true);
  });

  it('shows the empty state without any controls', () => {
    render(<PriceAlertsPanel alerts={[]} />);
    expect(screen.getByText(i18n('price_alerts_empty'))).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('shows a row with its link, supplier, price and last checked time', () => {
    const alert = makeAlert('a', {
      lastCheckedAt: Date.UTC(2026, 0, 2, 12),
      lastPrices: { a: { title: 'Product a', price: 19.5, currencyCode: 'USD' } },
    });
    render(<PriceAlertsPanel alerts={[alert]} />);

    expect(screen.getByRole('link', { name: 'Product a' })).toHaveAttribute(
      'href',
      'https://x.test/a',
    );
    expect(screen.getByText(/Carolina Chemical — .*19\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Last checked/)).toBeInTheDocument();
  });

  it('shows "not checked yet" for an alert that has no check', () => {
    render(<PriceAlertsPanel alerts={[makeAlert('a')]} />);
    expect(screen.getByText(i18n('price_alerts_not_checked'))).toBeInTheDocument();
  });

  it('falls back to the cheapest size when the product has no price of its own', () => {
    const alert = makeAlert('a', {
      lastPrices: {
        'a::big': { title: 'big', price: 40 },
        'a::small': { title: 'small', price: 12 },
      },
    });
    render(<PriceAlertsPanel alerts={[alert]} />);
    expect(screen.getByText(/Carolina Chemical — .*12\.00/)).toBeInTheDocument();
  });

  it('shows the last drop', () => {
    const alert = makeAlert('a', {
      lastDrop: { title: 'a', from: 20, to: 15, at: Date.UTC(2026, 0, 2) },
    });
    render(<PriceAlertsPanel alerts={[alert]} />);
    expect(screen.getByText(/Dropped from .*20\.00 to .*15\.00/)).toBeInTheDocument();
  });

  it('shows the unavailable line', () => {
    const alert = makeAlert('a', { lastStatus: PRODUCT_REFRESH_STATUS.UNAVAILABLE });
    render(<PriceAlertsPanel alerts={[alert]} />);
    expect(screen.getByText(i18n('price_alerts_unavailable'))).toBeInTheDocument();
  });

  it('shows the failed-check line with the failure count', () => {
    const alert = makeAlert('a', { lastStatus: PRODUCT_REFRESH_STATUS.FAILED, failures: 3 });
    render(<PriceAlertsPanel alerts={[alert]} />);
    expect(screen.getByText(i18n('price_alerts_check_failed', ['3']))).toBeInTheDocument();
  });

  it('deletes one alert from its row', async () => {
    render(<PriceAlertsPanel alerts={[makeAlert('a'), makeAlert('b')]} />);
    fireEvent.click(
      screen.getByRole('button', { name: i18n('settings_remove_item', ['Product b']) }),
    );
    await waitFor(() => expect(mocks.removePriceAlerts).toHaveBeenCalledWith(['b']));
  });

  it('deletes only the selected alerts', async () => {
    render(<PriceAlertsPanel alerts={[makeAlert('a'), makeAlert('b'), makeAlert('c')]} />);
    expect(deleteSelected(0)).toBeDisabled();

    fireEvent.click(selectBox('Product a'));
    fireEvent.click(selectBox('Product c'));
    fireEvent.click(deleteSelected(2));

    await waitFor(() => expect(mocks.removePriceAlerts).toHaveBeenCalledWith(['a', 'c']));
  });

  it('selects all, shows the partial state, and clears', () => {
    render(<PriceAlertsPanel alerts={[makeAlert('a'), makeAlert('b')]} />);
    const all = () => selectAllBox() as HTMLInputElement;

    fireEvent.click(selectBox('Product a'));
    expect(all()).toHaveAttribute('data-indeterminate', 'true');
    expect(all().checked).toBe(false);

    fireEvent.click(all());
    expect(all().checked).toBe(true);
    expect(selectBox('Product a')).toBeChecked();
    expect(selectBox('Product b')).toBeChecked();

    fireEvent.click(all());
    expect(selectBox('Product a')).not.toBeChecked();
    expect(selectBox('Product b')).not.toBeChecked();
  });

  it('ignores selected alerts that were removed elsewhere', async () => {
    const alerts = [makeAlert('a'), makeAlert('b')];
    const { rerender } = render(<PriceAlertsPanel alerts={alerts} />);
    fireEvent.click(selectBox('Product a'));
    fireEvent.click(selectBox('Product b'));

    rerender(<PriceAlertsPanel alerts={[alerts[1]]} />);
    fireEvent.click(deleteSelected(1));

    await waitFor(() => expect(mocks.removePriceAlerts).toHaveBeenCalledWith(['b']));
  });

  it('deletes all alerts after confirming', async () => {
    render(<PriceAlertsPanel alerts={[makeAlert('a'), makeAlert('b')]} />);
    fireEvent.click(deleteAll());

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(i18n('price_alerts_delete_all_body', ['2'])),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: i18n('price_alerts_delete_all') }));

    await waitFor(() => expect(mocks.removePriceAlerts).toHaveBeenCalledWith(['a', 'b']));
  });

  it('keeps the alerts when the confirmation is cancelled', async () => {
    render(<PriceAlertsPanel alerts={[makeAlert('a')]} />);
    fireEvent.click(deleteAll());

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n('migration_cancel') }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.removePriceAlerts).not.toHaveBeenCalled();
  });

  it('hides the notifications row when permission is granted', async () => {
    render(<PriceAlertsPanel alerts={[makeAlert('a')]} />);
    await waitFor(() => expect(mocks.hasNotificationPermission).toHaveBeenCalled());
    expect(screen.queryByText(i18n('price_alerts_notifications_off'))).toBeNull();
  });

  it('offers to allow notifications and hides the row once granted', async () => {
    mocks.hasNotificationPermission.mockResolvedValue(false);
    render(<PriceAlertsPanel alerts={[makeAlert('a')]} />);

    expect(await screen.findByText(i18n('price_alerts_notifications_off'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n('price_alerts_allow_notifications') }));

    await waitFor(() =>
      expect(screen.queryByText(i18n('price_alerts_notifications_off'))).toBeNull(),
    );
    expect(mocks.requestNotificationPermission).toHaveBeenCalledTimes(1);
  });

  it('keeps the notifications row when permission is declined', async () => {
    mocks.hasNotificationPermission.mockResolvedValue(false);
    mocks.requestNotificationPermission.mockResolvedValue(false);
    render(<PriceAlertsPanel alerts={[makeAlert('a')]} />);

    fireEvent.click(
      await screen.findByRole('button', { name: i18n('price_alerts_allow_notifications') }),
    );

    await waitFor(() => expect(mocks.requestNotificationPermission).toHaveBeenCalled());
    expect(screen.getByText(i18n('price_alerts_notifications_off'))).toBeInTheDocument();
  });
});

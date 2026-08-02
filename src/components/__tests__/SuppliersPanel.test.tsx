import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SUPPLIERS = ['SupplierAlpha', 'SupplierBeta', 'SupplierGamma'];

vi.mock('@/suppliers/SupplierFactory', () => ({
  SupplierFactory: { supplierList: () => SUPPLIERS },
}));

let mockContext: {
  userSettings: { suppliers?: { enabled?: string[] } };
  setUserSettings: ReturnType<typeof vi.fn>;
};

vi.mock('@/context', () => ({
  useAppContext: () => mockContext,
}));

import SuppliersPanel from '../SuppliersPanel';

/** Installs a fresh context whose settings hold the given selected suppliers. */
function setContext(suppliers?: string[]) {
  mockContext = {
    userSettings: suppliers === undefined ? {} : { suppliers: { enabled: suppliers } },
    setUserSettings: vi.fn(),
  };
  return mockContext;
}

/** Returns the checkbox input for a supplier (or the master "all" checkbox). */
function checkbox(value: string): HTMLInputElement {
  return document.querySelector(`input[type="checkbox"][value="${value}"]`) as HTMLInputElement;
}

describe('SuppliersPanel', () => {
  beforeEach(() => {
    setContext([]);
  });

  it('renders a row per supplier with the Supplier prefix stripped', () => {
    render(<SuppliersPanel />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('reflects the currently selected suppliers as checked', () => {
    setContext(['SupplierBeta']);
    render(<SuppliersPanel />);

    expect(checkbox('SupplierAlpha').checked).toBe(false);
    expect(checkbox('SupplierBeta').checked).toBe(true);
  });

  it('adds a supplier to the selection when toggled on', () => {
    const ctx = setContext([]);
    render(<SuppliersPanel />);

    fireEvent.click(checkbox('SupplierAlpha'));

    expect(ctx.setUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.objectContaining({ enabled: ['SupplierAlpha'] }),
      }),
    );
  });

  it('removes a supplier from the selection when toggled off', () => {
    const ctx = setContext(['SupplierAlpha', 'SupplierBeta']);
    render(<SuppliersPanel />);

    fireEvent.click(checkbox('SupplierAlpha'));

    expect(ctx.setUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.objectContaining({ enabled: ['SupplierBeta'] }),
      }),
    );
  });

  it('falls back to an empty list when suppliers is undefined', () => {
    const ctx = setContext(undefined);
    render(<SuppliersPanel />);

    fireEvent.click(checkbox('SupplierGamma'));

    expect(ctx.setUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        suppliers: expect.objectContaining({ enabled: ['SupplierGamma'] }),
      }),
    );
  });

  describe('select all', () => {
    it('selects every supplier when the master checkbox is checked', () => {
      const ctx = setContext([]);
      render(<SuppliersPanel />);

      fireEvent.click(checkbox('all'));

      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ suppliers: expect.objectContaining({ enabled: SUPPLIERS }) }),
      );
    });

    it('clears the selection when the master checkbox is unchecked', () => {
      const ctx = setContext(SUPPLIERS);
      render(<SuppliersPanel />);

      // The master checkbox is checked (all selected); clicking it unchecks.
      expect(checkbox('all').checked).toBe(true);
      fireEvent.click(checkbox('all'));

      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ suppliers: expect.objectContaining({ enabled: [] }) }),
      );
    });
  });
});

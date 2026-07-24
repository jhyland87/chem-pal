// ProductBuilder must be imported before SupplierBase/SupplierLoudwolf (module-init cycle).
import { ProductBuilder } from '@/utils/ProductBuilder';
import type { ResolvedStructure } from '@/helpers/smiles';
import { describe, expect, it, vi } from 'vitest';
import { SupplierLoudwolf } from '../SupplierLoudwolf';

type LoudwolfInternals = {
  queryProducts(query: string, limit?: number): Promise<ProductBuilder<Product>[] | void>;
};

describe('SupplierLoudwolf identifier search', () => {
  /** Captures the `search` param the storefront query is issued with. */
  const searchTermFor = async (query: string, resolved?: ResolvedStructure): Promise<string> => {
    const supplier = new SupplierLoudwolf(query);
    if (resolved) {
      supplier.setResolvedStructures(new Map([[query, resolved]]));
    }
    const spy = vi
      .spyOn(supplier as never, 'httpGetHtml')
      .mockResolvedValue('<html><body></body></html>' as never);

    await (supplier as unknown as LoudwolfInternals).queryProducts(query, 5);

    const params = (spy.mock.calls[0][0] as { params: { search: string } }).params;
    return decodeURIComponent(params.search);
  };

  it('searches by the broadest resolved name for a formula query (flags off)', async () => {
    // Loudwolf can't search by an identifier, so a formula resolves to the broadest name.
    const search = await searchTermFor('Na6O18P6', {
      name: 'Hexasodium hexametaphosphate',
      names: ['Hexasodium hexametaphosphate', 'Sodium hexametaphosphate'],
    });
    expect(search).toBe('Sodium hexametaphosphate');
  });

  it('searches a plain name query as typed', async () => {
    expect(await searchTermFor('sodium chloride')).toBe('sodium chloride');
  });
});

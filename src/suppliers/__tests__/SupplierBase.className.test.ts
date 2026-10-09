// ProductBuilder must be imported before SupplierBase/SupplierLabStuff (module-init cycle).
import '@/utils/ProductBuilder';
import { getSupplierColor } from '@/theme/colors';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupplierLabStuff } from '../SupplierLabStuff';

/**
 * Production builds minify class names to one letter, which is what `constructor.name`
 * then reports. A bare subclass stands in for that: its own name is `f`, while the
 * inherited `static supplierName` still identifies the real supplier.
 */
class f extends SupplierLabStuff {}

/** An unlisted supplier (not in the generated registry), as a disabled or test supplier is. */
class UnlistedSupplier extends SupplierLabStuff {
  public static readonly supplierName: string = 'Not In The Registry';
}

/** Logs through the supplier's own logger and returns what reached the console. */
function loggedLine(supplier: SupplierLabStuff): string {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const logger = Reflect.get(supplier, 'logger');
  logger.warn('probe');
  return String(warn.mock.calls[0][0]);
}

describe('SupplierBase class-name resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the real class name for the logger when constructor.name is minified', () => {
    const supplier = new f('acetone');

    expect(supplier.constructor.name).toBe('f');
    expect(loggedLine(supplier)).toContain('SupplierLabStuff');
  });

  it('derives the default color from the real class name', () => {
    expect(new f('acetone').color).toBe(getSupplierColor('SupplierLabStuff'));
  });

  it('falls back to constructor.name for a supplier the registry does not list', () => {
    const supplier = new UnlistedSupplier('acetone');

    expect(loggedLine(supplier)).toContain('UnlistedSupplier');
  });
});

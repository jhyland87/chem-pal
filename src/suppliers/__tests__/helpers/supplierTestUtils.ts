import type { Class } from "type-fest";
import { vi } from "vitest";
import type SupplierBase from "../../supplierBase";

/**
 * Creates spies for a supplier class's methods, including setting up mock implementations.
 * This is useful for testing supplier classes that extend SupplierBase.
 *
 * @param supplier - The supplier class to spy on
 * @param fixtures - The fixture data to use for mock implementations
 * @returns An object containing the spies for _getCachedResults and _httpGetJson
 *
 * @example
 * ```typescript
 * const { getCachedResultsSpy, httpGetJsonMock } = spyOnSupplier(
 *   SupplierLaboratoriumDiscounter,
 *   laboratoriumiscounter_fixtures
 * );
 * ```
 */
export const spyOnSupplier = (supplier: Class<SupplierBase<any, any>>, fixtures: any) => {
  const getCachedResultsSpy = vi.spyOn(supplier.prototype, "_getCachedResults");
  const httpGetJsonMock = vi.spyOn(supplier.prototype, "_httpGetJson" as any);

  // Set up the mock implementation
  httpGetJsonMock.mockImplementation(async (...args: unknown[]) => {
    const data = args[0] as { path: string; params?: Record<string, string> };
    return await fixtures.httpGetJson(data.path);
  });

  return { getCachedResultsSpy, httpGetJsonMock };
};

import type { Class } from "type-fest";
import { vi } from "vitest";
import type SupplierBase from "../../supplierBase";

/**
 * Creates spies for a supplier class's methods, including setting up mock implementations.
 * This is useful for testing supplier classes that extend SupplierBase.
 *
 * @param supplier - The supplier class to spy on
 * @param fixtures - The fixture data to use for mock implementations
 * @returns An object containing the spies for getCachedResults and httpGetJson
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
  const getCachedResultsSpy = vi.spyOn(supplier.prototype, "getCachedResults" as any);
  const httpGetJsonMock = vi.spyOn(supplier.prototype, "httpGetJson" as any);
  const titleSelectorSpy = vi.spyOn(supplier.prototype, "titleSelector" as any);

  // Set up the mock implementation
  httpGetJsonMock.mockImplementation(async (...args: unknown[]) => {
    const data = args[0] as { path: string; params?: Record<string, string> };
    return await fixtures.httpGetJson(data.path);
  });

  return { getCachedResultsSpy, httpGetJsonMock, titleSelectorSpy };
};

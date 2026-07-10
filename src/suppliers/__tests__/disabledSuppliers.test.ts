import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as suppliers from "..";
import type { SupplierBase } from "../SupplierBase";
import { SupplierFactory } from "../SupplierFactory";

beforeAll(() => {
  setupChromeStorageMock();
});

beforeEach(() => {
  resetChromeStorageMock();
});

/**
 * Drives executeAllStream far enough to build the supplier instances, capturing the
 * array the include/deny guard produced. filterByShipping is stubbed to return an empty
 * list, so no supplier's execute() ever runs and the test stays fully offline.
 */
async function captureInstantiatedSuppliers(
  factory: SupplierFactory<Product>,
): Promise<string[]> {
  let captured: SupplierBase<unknown, Product>[] = [];
  vi.spyOn(factory as unknown as { filterByShipping: (i: unknown[]) => unknown[] }, "filterByShipping")
    .mockImplementation((instances: unknown[]) => {
      captured = instances as SupplierBase<unknown, Product>[];
      return [];
    });

  // Empty permitted list makes the generator complete immediately without network.
  for await (const _product of factory.executeAllStream(1)) {
    // no-op — nothing is yielded
  }

  return captured.map((instance) => instance.constructor.name);
}

describe("SupplierFactory disabledSuppliers deny-list", () => {
  const allSupplierNames = Object.keys(suppliers);

  it("excludes a disabled supplier even when the include-list is empty (all)", async () => {
    const factory = new SupplierFactory<Product>("test", {
      controller: new AbortController(),
      disabledSuppliers: ["SupplierCarolina"],
    });

    const instantiated = await captureInstantiatedSuppliers(factory);

    expect(instantiated).not.toContain("SupplierCarolina");
    expect(instantiated).toHaveLength(allSupplierNames.length - 1);
  });

  it("excludes a disabled supplier even when it is explicitly included", async () => {
    const factory = new SupplierFactory<Product>("test", {
      controller: new AbortController(),
      suppliers: ["SupplierCarolina", "SupplierLaballey"],
      disabledSuppliers: ["SupplierCarolina"],
    });

    const instantiated = await captureInstantiatedSuppliers(factory);

    expect(instantiated).toEqual(["SupplierLaballey"]);
  });

  it("instantiates every supplier when the deny-list is empty", async () => {
    const factory = new SupplierFactory<Product>("test", {
      controller: new AbortController(),
      disabledSuppliers: [],
    });

    const instantiated = await captureInstantiatedSuppliers(factory);

    expect(instantiated).toHaveLength(allSupplierNames.length);
  });
});

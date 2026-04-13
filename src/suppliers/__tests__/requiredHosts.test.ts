import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as suppliers from "..";
import SupplierBase from "../SupplierBase";
import SupplierFactory from "../SupplierFactory";

beforeAll(() => {
  setupChromeStorageMock();
});

beforeEach(() => {
  resetChromeStorageMock();
});

describe("requiredHosts", () => {
  const controller = new AbortController();

  describe("SupplierBase getter", () => {
    it("includes baseURL with a wildcard path", () => {
      const SupplierClass = Object.values(suppliers)[0] as unknown as new (
        query: string,
        limit: number,
        controller: AbortController,
      ) => SupplierBase<unknown, Product>;
      const instance = new SupplierClass("", 1, controller);
      expect(instance.requiredHosts).toContain(`${instance.baseURL}/*`);
    });

    it("always returns at least one entry (the baseURL)", () => {
      for (const SupplierClass of Object.values(suppliers)) {
        const Cls = SupplierClass as unknown as new (
          query: string,
          limit: number,
          controller: AbortController,
        ) => SupplierBase<unknown, Product>;
        const instance = new Cls("", 1, controller);
        expect(instance.requiredHosts.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("every entry is a valid chrome origin pattern", () => {
      for (const SupplierClass of Object.values(suppliers)) {
        const Cls = SupplierClass as unknown as new (
          query: string,
          limit: number,
          controller: AbortController,
        ) => SupplierBase<unknown, Product>;
        const instance = new Cls("", 1, controller);
        for (const host of instance.requiredHosts) {
          expect(host).toMatch(/^https:\/\/.+\/\*$/);
        }
      }
    });
  });

  describe("auto-detects apiURL property", () => {
    it("Chemsavers includes its apiURL (Typesense) automatically", () => {
      const instance = new (suppliers.SupplierChemsavers as any)("", 1, controller);
      expect(instance.requiredHosts).toContain("https://0ul35zwtpkx14ifhp-1.a1.typesense.net/*");
      expect(instance.requiredHosts).toContain("https://www.chemsavers.com/*");
      expect(instance.requiredHosts).toHaveLength(2);
    });

    it("Macklin includes its apiURL automatically", () => {
      const instance = new (suppliers.SupplierMacklin as any)("", 1, controller);
      expect(instance.requiredHosts).toContain("https://api.macklin.cn/*");
      expect(instance.requiredHosts).toContain("https://www.macklin.cn/*");
      expect(instance.requiredHosts).toHaveLength(2);
    });
  });

  describe("Shopify suppliers include searchserverapi.com", () => {
    it("HbarSci includes searchserverapi.com", () => {
      const instance = new (suppliers.SupplierHbarSci as any)("", 1, controller);
      expect(instance.requiredHosts).toContain("https://searchserverapi.com/*");
      expect(instance.requiredHosts).toContain("https://www.hbarsci.com/*");
    });

    it("Laballey includes searchserverapi.com", () => {
      const instance = new (suppliers.SupplierLaballey as any)("", 1, controller);
      expect(instance.requiredHosts).toContain("https://searchserverapi.com/*");
      expect(instance.requiredHosts).toContain("https://www.laballey.com/*");
    });
  });

  describe("single-host suppliers only have their baseURL", () => {
    const singleHostSuppliers = [
      ["SupplierAmbeed", "https://www.ambeed.com/*"],
      ["SupplierCarolina", "https://www.carolina.com/*"],
      ["SupplierLoudwolf", "https://www.loudwolf.com/*"],
      ["SupplierOnyxmet", "https://onyxmet.com/*"],
      ["SupplierWarchem", "https://warchem.pl/*"],
      ["SupplierSynthetika", "https://synthetikaeu.com/*"],
      ["SupplierLaboratoriumDiscounter", "https://www.laboratoriumdiscounter.nl/*"],
    ] as const;

    it.each(singleHostSuppliers)("%s only requires %s", (name, expectedHost) => {
      const Cls = (suppliers as Record<string, any>)[name];
      const instance = new Cls("", 1, controller);
      expect(instance.requiredHosts).toEqual([expectedHost]);
    });
  });
});

describe("SupplierFactory.supplierRequiredHosts", () => {
  it("returns a record with an entry for every exported supplier", () => {
    const hostMap = SupplierFactory.supplierRequiredHosts();
    const supplierNames = Object.keys(suppliers);
    expect(Object.keys(hostMap)).toEqual(supplierNames);
  });

  it("each entry is a non-empty array of strings", () => {
    const hostMap = SupplierFactory.supplierRequiredHosts();
    for (const [name, hosts] of Object.entries(hostMap)) {
      expect(Array.isArray(hosts), `${name} hosts should be an array`).toBe(true);
      expect(hosts.length, `${name} should have at least one host`).toBeGreaterThanOrEqual(1);
      for (const host of hosts) {
        expect(typeof host).toBe("string");
      }
    }
  });
});

describe("SupplierFactory.filterByPermissions", () => {
  let factory: SupplierFactory<Product>;

  beforeEach(() => {
    factory = new SupplierFactory("test", 5, new AbortController());

    if (!global.chrome) {
      global.chrome = {} as typeof chrome;
    }
    if (!global.chrome.permissions) {
      global.chrome.permissions = {} as typeof chrome.permissions;
    }
  });

  const createMockSupplier = (name: string, hosts: string[]) =>
    ({
      supplierName: name,
      requiredHosts: hosts,
    }) as unknown as SupplierBase<unknown, Product>;

  it("checks each supplier individually via contains", async () => {
    const containsMock = vi.fn().mockResolvedValue(true);
    global.chrome.permissions.contains = containsMock;

    const instances = [
      createMockSupplier("A", ["https://a.com/*"]),
      createMockSupplier("B", ["https://b.com/*", "https://shared.com/*"]),
    ];

    await (factory as any).filterByPermissions(instances);

    expect(containsMock).toHaveBeenCalledTimes(2);
    expect(containsMock).toHaveBeenCalledWith({ origins: ["https://a.com/*"] });
    expect(containsMock).toHaveBeenCalledWith({
      origins: ["https://b.com/*", "https://shared.com/*"],
    });
  });

  it("filters out suppliers whose hosts were not granted", async () => {
    global.chrome.permissions.contains = vi.fn().mockImplementation(async ({ origins }) => {
      return !origins.includes("https://denied.com/*");
    });

    const instances = [
      createMockSupplier("Allowed", ["https://allowed.com/*"]),
      createMockSupplier("Denied", ["https://denied.com/*"]),
      createMockSupplier("AlsoAllowed", ["https://also-allowed.com/*"]),
    ];

    const result = await (factory as any).filterByPermissions(instances);

    expect(result).toHaveLength(2);
    expect(result[0].supplierName).toBe("Allowed");
    expect(result[1].supplierName).toBe("AlsoAllowed");
  });

  it("returns all suppliers when all permissions are granted", async () => {
    global.chrome.permissions.contains = vi.fn().mockResolvedValue(true);

    const instances = [
      createMockSupplier("A", ["https://a.com/*"]),
      createMockSupplier("B", ["https://b.com/*"]),
    ];

    const result = await (factory as any).filterByPermissions(instances);

    expect(result).toHaveLength(2);
  });

  it("returns empty array when all permissions are denied", async () => {
    global.chrome.permissions.contains = vi.fn().mockResolvedValue(false);

    const instances = [
      createMockSupplier("A", ["https://a.com/*"]),
      createMockSupplier("B", ["https://b.com/*"]),
    ];

    const result = await (factory as any).filterByPermissions(instances);

    expect(result).toHaveLength(0);
  });

  it("does not call chrome.permissions.request", async () => {
    const requestMock = vi.fn();
    global.chrome.permissions.request = requestMock;
    global.chrome.permissions.contains = vi.fn().mockResolvedValue(true);

    const instances = [createMockSupplier("A", ["https://a.com/*"])];

    await (factory as any).filterByPermissions(instances);

    expect(requestMock).not.toHaveBeenCalled();
  });

  it("treats a supplier as denied when contains throws", async () => {
    global.chrome.permissions.contains = vi.fn().mockRejectedValue(new Error("unexpected"));

    const instances = [createMockSupplier("A", ["https://a.com/*"])];

    const result = await (factory as any).filterByPermissions(instances);

    expect(result).toHaveLength(0);
  });

  it("returns empty array when given no instances", async () => {
    global.chrome.permissions.contains = vi.fn().mockResolvedValue(true);

    const result = await (factory as any).filterByPermissions([]);

    expect(global.chrome.permissions.contains).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });
});

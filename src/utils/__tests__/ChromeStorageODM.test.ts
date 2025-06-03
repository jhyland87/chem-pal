import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChromeStorageODM,
  createLocalStorageODM,
  createSessionStorageODM,
  createSyncStorageODM,
} from "../ChromeStorageODM";
import { createMockChromeStorage } from "../__mocks__/MockChromeStorage";

// Mock chrome.storage
const mockStorage = createMockChromeStorage();
vi.stubGlobal("chrome", {
  storage: mockStorage,
  runtime: {
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
});

// Define test data type that satisfies Record<string, unknown>
type TestData = {
  [key: string]: unknown;
  name: string;
  count: number;
  active: boolean;
  tags: string[];
};

// Storage type test cases
const storageTypes = [
  {
    name: "local storage",
    storage: mockStorage.local,
    createODM: (key: string, data: TestData) => createLocalStorageODM(key, data),
  },
  {
    name: "sync storage",
    storage: mockStorage.sync,
    createODM: (key: string, data: TestData) => createSyncStorageODM(key, data),
  },
  {
    name: "session storage",
    storage: mockStorage.session,
    createODM: (key: string, data: TestData) => createSessionStorageODM(key, data),
  },
] as const;

describe.each(storageTypes)("ChromeStorageODM with $name", ({ storage, createODM }) => {
  const initialData: TestData = {
    name: "test",
    count: 0,
    active: true,
    tags: ["test", "mock"],
  };

  const storageKey = "test-key";

  beforeEach(() => {
    // Clear all storage before each test
    mockStorage.local.clear();
    mockStorage.sync.clear();
    mockStorage.session.clear();
    chrome.runtime.lastError = undefined;
  });

  describe("Initialization", () => {
    it("should initialize with provided data", async () => {
      const odm = new ChromeStorageODM<TestData>(storage, storageKey, initialData);
      expect(odm.getData()).toEqual(initialData);
    });

    it("should load existing data from storage", async () => {
      // First set some data in storage
      await storage.set({ [storageKey]: { ...initialData, count: 42 } });

      // Create new ODM instance
      const odm = new ChromeStorageODM<TestData>(storage, storageKey, initialData);

      // Wait for load to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(odm.getData()).toEqual({ ...initialData, count: 42 });
    });
  });

  describe("Data Operations", () => {
    let odm: ChromeStorageODM<TestData>;

    beforeEach(() => {
      odm = new ChromeStorageODM<TestData>(storage, storageKey, initialData);
    });

    it("should get data", () => {
      expect(odm.getData()).toEqual(initialData);
    });

    it("should get specific field", () => {
      expect(odm.get("name")).toBe("test");
      expect(odm.get("count")).toBe(0);
      expect(odm.get("active")).toBe(true);
      expect(odm.get("tags")).toEqual(["test", "mock"]);
    });

    it("should update specific fields", async () => {
      await odm.update({ count: 42, name: "updated" });
      expect(odm.getData()).toEqual({
        ...initialData,
        count: 42,
        name: "updated",
      });
    });

    it("should set entire data object", async () => {
      const newData: TestData = {
        name: "new",
        count: 100,
        active: false,
        tags: ["new"],
      };
      await odm.set(newData);
      expect(odm.getData()).toEqual(newData);
    });

    it("should set specific field", async () => {
      await odm.setField("count", 42);
      expect(odm.get("count")).toBe(42);
      expect(odm.getData()).toEqual({
        ...initialData,
        count: 42,
      });
    });

    it("should clear data", async () => {
      await odm.clear();
      expect(odm.getData()).toEqual({} as TestData);
    });
  });

  describe("Factory Functions", () => {
    it("should create ODM instance with factory function", async () => {
      const odm = createODM(storageKey, initialData);
      expect(odm.getData()).toEqual(initialData);

      await odm.update({ count: 42 });
      expect(odm.getData()).toEqual({ ...initialData, count: 42 });
    });
  });

  describe("Change Subscription", () => {
    it("should notify subscribers of changes", async () => {
      const odm = new ChromeStorageODM<TestData>(storage, storageKey, initialData);
      const callback = vi.fn();
      const unsubscribe = odm.subscribe(callback);

      await odm.update({ count: 42 });
      expect(callback).toHaveBeenCalledWith({ ...initialData, count: 42 });

      unsubscribe();
      await odm.update({ count: 100 });
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it("should handle multiple subscribers", async () => {
      const odm = new ChromeStorageODM<TestData>(storage, storageKey, initialData);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = odm.subscribe(callback1);
      const unsubscribe2 = odm.subscribe(callback2);

      await odm.update({ count: 42 });

      expect(callback1).toHaveBeenCalledWith({ ...initialData, count: 42 });
      expect(callback2).toHaveBeenCalledWith({ ...initialData, count: 42 });

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe("Error Handling", () => {
    it("should handle storage errors", async () => {
      const odm = new ChromeStorageODM<TestData>(storage, storageKey, initialData);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Simulate storage error with proper LastError type
      chrome.runtime.lastError = {
        message: "Storage error",
      } as chrome.runtime.LastError;

      // Expect the update to throw an error
      await expect(odm.update({ count: 42 })).rejects.toThrow("Storage error");

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

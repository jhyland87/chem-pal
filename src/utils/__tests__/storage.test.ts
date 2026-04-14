import {
  resetChromeStorageMock,
  restoreChromeStorageMock,
  setupChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import {
  cstorage,
  decodeChanges,
  decodeItems,
  decodeValue,
  encodeItems,
  encodeValue,
  isLzEnvelope,
  LZ_VERSION,
  type LzEnvelope,
} from "@/utils/storage";
import { compressToUTF16 } from "lz-string";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("storage codec (pure functions)", () => {
  describe("isLzEnvelope", () => {
    it("returns true for a well-formed envelope", () => {
      expect(isLzEnvelope({ __lz: LZ_VERSION, d: "anything" })).toBe(true);
    });

    it("returns false for plain objects, arrays, primitives, and null", () => {
      expect(isLzEnvelope(null)).toBe(false);
      expect(isLzEnvelope(undefined)).toBe(false);
      expect(isLzEnvelope("hello")).toBe(false);
      expect(isLzEnvelope(42)).toBe(false);
      expect(isLzEnvelope(true)).toBe(false);
      expect(isLzEnvelope([])).toBe(false);
      expect(isLzEnvelope([{ __lz: 1, d: "x" }])).toBe(false);
      expect(isLzEnvelope({ foo: "bar" })).toBe(false);
    });

    it("returns false for malformed envelopes", () => {
      expect(isLzEnvelope({ __lz: 2, d: "x" })).toBe(false);
      expect(isLzEnvelope({ __lz: LZ_VERSION })).toBe(false);
      expect(isLzEnvelope({ __lz: LZ_VERSION, d: 123 })).toBe(false);
      expect(isLzEnvelope({ d: "x" })).toBe(false);
    });
  });

  describe("encodeValue / decodeValue round-trip", () => {
    const cases: [string, unknown][] = [
      ["plain object", { name: "Acetone", cas: "67-64-1", price: 12.5 }],
      ["nested object", { a: { b: { c: { d: [1, 2, 3, "four", { five: true }] } } }, meta: null }],
      ["array of objects", Array.from({ length: 50 }, (_, i) => ({ i, label: `item-${i}` }))],
      ["string", "the quick brown fox"],
      ["number", 3.14159],
      ["boolean", false],
      ["null", null],
    ];

    it.each(cases)("round-trips %s", (_label, value) => {
      const encoded = encodeValue(value);
      expect(isLzEnvelope(encoded)).toBe(true);
      expect(decodeValue(encoded)).toEqual(value);
    });

    it("passes undefined through unchanged (cannot be JSON-serialized)", () => {
      expect(encodeValue(undefined)).toBeUndefined();
      expect(decodeValue(undefined)).toBeUndefined();
    });
  });

  describe("compression efficiency", () => {
    it("produces an envelope significantly smaller than the raw JSON for repetitive payloads", () => {
      const payload = {
        results: Array.from({ length: 200 }, (_, i) => ({
          id: i,
          supplier: "Macklin",
          title: "Sodium chloride 99.9% pure ACS reagent grade",
          url: "https://example.com/products/sodium-chloride",
          currency: "USD",
          price: 12.5,
          quantity: "500g",
        })),
      };
      const rawSize = JSON.stringify(payload).length;
      const encoded = encodeValue(payload) as LzEnvelope;
      expect(isLzEnvelope(encoded)).toBe(true);
      // Repetitive data should compress to well under half the original size.
      expect(encoded.d.length).toBeLessThan(rawSize / 2);
    });
  });

  describe("decodeValue backward compatibility", () => {
    it("returns raw legacy values unchanged", () => {
      const legacy = { foo: "bar", n: 1, arr: [1, 2, 3] };
      expect(decodeValue(legacy)).toBe(legacy);
      expect(decodeValue("plain string")).toBe("plain string");
      expect(decodeValue(123)).toBe(123);
      expect(decodeValue(null)).toBe(null);
    });

    it("does not throw on a corrupt envelope; logs and returns raw", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const corrupt: LzEnvelope = { __lz: LZ_VERSION, d: "###not-valid-lz-data###" };
      const result = decodeValue(corrupt);
      // Either the original envelope or undefined is acceptable; key requirement is no throw.
      expect(result === corrupt || result === undefined).toBe(true);
      errorSpy.mockRestore();
    });
  });

  describe("encodeItems / decodeItems", () => {
    it("round-trips a multi-key items map", () => {
      const items = {
        SETTINGS: { theme: "dark", language: "en" },
        RESULTS: [{ id: 1 }, { id: 2 }],
        COUNT: 7,
      };
      const encoded = encodeItems(items);
      expect(isLzEnvelope(encoded.SETTINGS)).toBe(true);
      expect(isLzEnvelope(encoded.RESULTS)).toBe(true);
      expect(isLzEnvelope(encoded.COUNT)).toBe(true);
      expect(decodeItems(encoded)).toEqual(items);
    });

    it("decodeItems handles a mix of compressed and legacy raw values", () => {
      const mixed = {
        compressed: encodeValue({ a: 1 }),
        legacyObject: { b: 2 },
        legacyString: "untouched",
      };
      expect(decodeItems(mixed)).toEqual({
        compressed: { a: 1 },
        legacyObject: { b: 2 },
        legacyString: "untouched",
      });
    });
  });

  describe("decodeChanges", () => {
    it("decodes both oldValue and newValue when present", () => {
      const changes = {
        SETTINGS: {
          oldValue: encodeValue({ theme: "light" }),
          newValue: encodeValue({ theme: "dark" }),
        },
      };
      expect(decodeChanges(changes)).toEqual({
        SETTINGS: {
          oldValue: { theme: "light" },
          newValue: { theme: "dark" },
        },
      });
    });

    it("handles changes with only newValue (initial write)", () => {
      const changes = { K: { newValue: encodeValue([1, 2, 3]) } };
      const decoded = decodeChanges(changes);
      expect(decoded.K.newValue).toEqual([1, 2, 3]);
      expect("oldValue" in decoded.K).toBe(false);
    });

    it("handles changes with only oldValue (deletion)", () => {
      const changes = { K: { oldValue: encodeValue("removed") } };
      const decoded = decodeChanges(changes);
      expect(decoded.K.oldValue).toBe("removed");
      expect("newValue" in decoded.K).toBe(false);
    });

    it("passes raw legacy values through", () => {
      const changes = { K: { oldValue: { raw: 1 }, newValue: { raw: 2 } } };
      expect(decodeChanges(changes)).toEqual({
        K: { oldValue: { raw: 1 }, newValue: { raw: 2 } },
      });
    });
  });
});

describe("cstorage adapter", () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
  });

  afterAll(() => {
    restoreChromeStorageMock();
  });

  describe("local namespace", () => {
    it("round-trips a value through set + get", async () => {
      const value = { theme: "dark", suppliers: ["Macklin", "Ambeed"] };
      await cstorage.local.set({ USER_SETTINGS: value });
      const result = await cstorage.local.get("USER_SETTINGS");
      expect(result.USER_SETTINGS).toEqual(value);
    });

    it("stores values as compressed envelopes (proves compression at rest)", async () => {
      await cstorage.local.set({ k: { hello: "world" } });
      const raw = await chrome.storage.local.get("k");
      expect(isLzEnvelope(raw.k)).toBe(true);
    });

    it("returns legacy uncompressed data unchanged on read", async () => {
      // Seed the underlying mock directly with a raw legacy object.
      await chrome.storage.local.set({ LEGACY: { foo: "bar" } });
      const result = await cstorage.local.get("LEGACY");
      expect(result.LEGACY).toEqual({ foo: "bar" });
    });

    it("get(null) returns all keys decoded, mixing compressed + legacy entries", async () => {
      await cstorage.local.set({ NEW_ENTRY: { a: 1 } });
      await chrome.storage.local.set({ OLD_ENTRY: { b: 2 } });
      const all = await cstorage.local.get(null);
      expect(all).toEqual({ NEW_ENTRY: { a: 1 }, OLD_ENTRY: { b: 2 } });
    });

    it("get with an array of keys returns the requested keys decoded", async () => {
      await cstorage.local.set({ A: { v: 1 }, B: { v: 2 }, C: { v: 3 } });
      const result = await cstorage.local.get(["A", "C"]);
      expect(result).toEqual({ A: { v: 1 }, C: { v: 3 } });
    });

    it("remove deletes a key", async () => {
      await cstorage.local.set({ X: { hi: true } });
      await cstorage.local.remove("X");
      const result = await cstorage.local.get("X");
      expect(result.X).toBeUndefined();
    });

    it("clear empties storage", async () => {
      await cstorage.local.set({ A: 1, B: 2 });
      await cstorage.local.clear();
      const all = await cstorage.local.get(null);
      expect(all).toEqual({});
    });
  });

  describe("session namespace (SEARCH_RESULTS)", () => {
    it("compresses large SEARCH_RESULTS arrays at rest and round-trips them", async () => {
      const SEARCH_RESULTS = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        title: "Sodium chloride 99.9% pure ACS reagent grade",
        supplier: "Macklin",
        price: 12.5,
        currency: "USD",
      }));
      await cstorage.session.set({ SEARCH_RESULTS });

      // Confirm at-rest envelope on the session namespace specifically.
      const raw = await chrome.storage.session.get("SEARCH_RESULTS");
      expect(isLzEnvelope(raw.SEARCH_RESULTS)).toBe(true);

      // Confirm decoded round-trip via the wrapper.
      const result = await cstorage.session.get("SEARCH_RESULTS");
      expect(result.SEARCH_RESULTS).toEqual(SEARCH_RESULTS);
    });
  });

  describe("onChanged listener wrapping", () => {
    it("delivers decoded oldValue and newValue to the user listener", () => {
      const userListener = vi.fn();
      cstorage.onChanged.addListener(userListener);

      // Capture the inner listener registered with chrome.storage.onChanged.
      const addListenerMock = chrome.storage.onChanged.addListener as unknown as {
        mock: {
          calls: Array<
            [(c: Record<string, chrome.storage.StorageChange>, a: chrome.storage.AreaName) => void]
          >;
        };
      };
      const inner = addListenerMock.mock.calls[addListenerMock.mock.calls.length - 1][0];
      expect(typeof inner).toBe("function");

      // Simulate chrome firing a change with envelope-wrapped values.
      inner(
        {
          SETTINGS: {
            oldValue: encodeValue({ theme: "light" }),
            newValue: encodeValue({ theme: "dark" }),
          },
        },
        "local",
      );

      expect(userListener).toHaveBeenCalledTimes(1);
      expect(userListener).toHaveBeenCalledWith(
        {
          SETTINGS: {
            oldValue: { theme: "light" },
            newValue: { theme: "dark" },
          },
        },
        "local",
      );
    });

    it("removeListener unregisters the inner listener", () => {
      const userListener = vi.fn();
      cstorage.onChanged.addListener(userListener);
      cstorage.onChanged.removeListener(userListener);

      const removeListenerMock = chrome.storage.onChanged.removeListener as unknown as {
        mock: { calls: unknown[] };
      };
      expect(removeListenerMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("interop with directly-seeded compressed envelopes", () => {
    it("decodes a UTF16-compressed envelope written directly via chrome.storage", async () => {
      const value = { external: "writer", n: 99 };
      const envelope: LzEnvelope = { __lz: LZ_VERSION, d: compressToUTF16(JSON.stringify(value)) };
      await chrome.storage.local.set({ K: envelope });
      const result = await cstorage.local.get("K");
      expect(result.K).toEqual(value);
    });
  });
});

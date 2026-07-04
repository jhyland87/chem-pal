import { CACHE } from "@/constants/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const localGet = vi.fn();
vi.mock("@/utils/storage", () => ({
  cstorage: {
    local: {
      get: (...args: unknown[]) => localGet(...args),
    },
  },
}));

const { findCountryByIso2, getCountryName, getUserCountryName } = await import("@/helpers/country");

describe("findCountryByIso2", () => {
  it("returns a typed record for a known code", () => {
    const record = findCountryByIso2("US");
    expect(record?.name).toBe("United States");
    expect(record?.currency?.code).toBe("USD");
  });

  it("returns undefined for an unknown code", () => {
    expect(findCountryByIso2("ZZ")).toBeUndefined();
  });
});

describe("getCountryName", () => {
  it("resolves a full country name", () => {
    expect(getCountryName("US")).toBe("United States");
    expect(getCountryName("GB")).toBe("United Kingdom");
  });

  it("returns undefined for undefined input", () => {
    expect(getCountryName(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getCountryName("")).toBeUndefined();
  });

  it("returns undefined for an unknown code", () => {
    expect(getCountryName("ZZ")).toBeUndefined();
  });
});

describe("getUserCountryName", () => {
  beforeEach(() => {
    localGet.mockReset();
  });

  it("reads the stored country name", async () => {
    localGet.mockResolvedValue({ [CACHE.USER_SETTINGS]: { country: "United States" } });
    await expect(getUserCountryName()).resolves.toBe("United States");
    expect(localGet).toHaveBeenCalledWith([CACHE.USER_SETTINGS]);
  });

  it("returns undefined when settings are absent", async () => {
    localGet.mockResolvedValue({});
    await expect(getUserCountryName()).resolves.toBeUndefined();
  });

  it("returns undefined when settings is null", async () => {
    localGet.mockResolvedValue({ [CACHE.USER_SETTINGS]: null });
    await expect(getUserCountryName()).resolves.toBeUndefined();
  });

  it("returns undefined when settings is not an object", async () => {
    localGet.mockResolvedValue({ [CACHE.USER_SETTINGS]: "nope" });
    await expect(getUserCountryName()).resolves.toBeUndefined();
  });

  it("returns undefined when country is not a string", async () => {
    localGet.mockResolvedValue({ [CACHE.USER_SETTINGS]: { country: 42 } });
    await expect(getUserCountryName()).resolves.toBeUndefined();
  });
});

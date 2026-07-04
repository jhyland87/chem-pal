import {
  getCookie,
  getCookies,
  isCookiesApiAvailable,
  setCookie,
} from "@/helpers/cookies";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalChrome = (globalThis as { chrome?: unknown }).chrome;

function setChrome(cookies: unknown): void {
  (globalThis as { chrome?: unknown }).chrome = cookies === undefined ? {} : { cookies };
}

function clearChrome(): void {
  delete (globalThis as { chrome?: unknown }).chrome;
}

afterEach(() => {
  (globalThis as { chrome?: unknown }).chrome = originalChrome;
  vi.restoreAllMocks();
});

describe("isCookiesApiAvailable", () => {
  it("returns false when chrome is undefined", () => {
    clearChrome();
    expect(isCookiesApiAvailable()).toBe(false);
  });

  it("returns false when chrome.cookies is missing", () => {
    setChrome(undefined);
    expect(isCookiesApiAvailable()).toBe(false);
  });

  it("returns true when chrome.cookies exists", () => {
    setChrome({ set: vi.fn() });
    expect(isCookiesApiAvailable()).toBe(true);
  });
});

describe("setCookie", () => {
  beforeEach(() => clearChrome());

  it("no-ops when the API is unavailable", async () => {
    await expect(setCookie({ url: "https://x", name: "c", value: "1" })).resolves.toBeUndefined();
  });

  it("calls chrome.cookies.set when available", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    setChrome({ set });
    const details = { url: "https://x", name: "c", value: "1" };
    await setCookie(details);
    expect(set).toHaveBeenCalledWith(details);
  });

  it("swallows write failures", async () => {
    const set = vi.fn().mockRejectedValue(new Error("boom"));
    setChrome({ set });
    await expect(setCookie({ url: "https://x", name: "c", value: "1" })).resolves.toBeUndefined();
  });
});

describe("getCookies", () => {
  beforeEach(() => clearChrome());

  it("returns an empty array when the API is unavailable", async () => {
    await expect(getCookies("https://x")).resolves.toEqual([]);
  });

  it("returns cookies from chrome.cookies.getAll", async () => {
    const cookie = { name: "currency", value: "2" };
    setChrome({ getAll: vi.fn().mockResolvedValue([cookie]) });
    await expect(getCookies("https://x")).resolves.toEqual([cookie]);
  });

  it("returns an empty array when getAll rejects", async () => {
    setChrome({ getAll: vi.fn().mockRejectedValue(new Error("boom")) });
    await expect(getCookies("https://x")).resolves.toEqual([]);
  });
});

describe("getCookie", () => {
  beforeEach(() => clearChrome());

  it("returns null when the API is unavailable", async () => {
    await expect(getCookie("https://x", "c")).resolves.toBeNull();
  });

  it("returns the cookie from chrome.cookies.get", async () => {
    const cookie = { name: "c", value: "2" };
    setChrome({ get: vi.fn().mockResolvedValue(cookie) });
    await expect(getCookie("https://x", "c")).resolves.toEqual(cookie);
  });

  it("returns null when get rejects", async () => {
    setChrome({ get: vi.fn().mockRejectedValue(new Error("boom")) });
    await expect(getCookie("https://x", "c")).resolves.toBeNull();
  });
});

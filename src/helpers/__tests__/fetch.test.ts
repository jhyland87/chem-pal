import { fetchDecorator, generateRequestHash, generateSimpleHash } from "@/helpers/fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("generateSimpleHash", () => {
  it("should generate consistent hashes for the same input", () => {
    const input = "test string";
    const hash1 = generateSimpleHash(input);
    const hash2 = generateSimpleHash(input);
    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different inputs", () => {
    const hash1 = generateSimpleHash("test string 1");
    const hash2 = generateSimpleHash("test string 2");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty strings", () => {
    const hash = generateSimpleHash("");
    expect(hash).toBe("0");
  });

  it("should handle special characters", () => {
    const hash = generateSimpleHash("!@#$%^&*()");
    expect(hash).toBeTruthy();
  });
});

describe("generateRequestHash", () => {
  it("should generate consistent hashes for identical requests", async () => {
    const request1 = new Request("https://api.example.com/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });
    const request2 = new Request("https://api.example.com/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });

    const hash1 = await generateRequestHash(request1);
    const hash2 = await generateRequestHash(request2);
    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different URLs", async () => {
    const request1 = new Request("https://api.example.com/data1");
    const request2 = new Request("https://api.example.com/data2");

    const hash1 = await generateRequestHash(request1);
    const hash2 = await generateRequestHash(request2);
    expect(hash1).not.toBe(hash2);
  });

  it("should generate different hashes for different methods", async () => {
    const request1 = new Request("https://api.example.com/data", { method: "GET" });
    const request2 = new Request("https://api.example.com/data", { method: "POST" });

    const hash1 = await generateRequestHash(request1);
    const hash2 = await generateRequestHash(request2);
    expect(hash1).not.toBe(hash2);
  });

  it("should generate different hashes for different headers", async () => {
    const request1 = new Request("https://api.example.com/data", {
      headers: { "Content-Type": "application/json" },
    });
    const request2 = new Request("https://api.example.com/data", {
      headers: { "Content-Type": "text/plain" },
    });

    const hash1 = await generateRequestHash(request1);
    const hash2 = await generateRequestHash(request2);
    expect(hash1).not.toBe(hash2);
  });
});

describe("fetchDecorator", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should handle successful JSON responses", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ test: "data" }),
      clone: () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ test: "data" }),
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const response = await fetchDecorator("https://api.example.com/data");
    expect(response).toBeInstanceOf(Response);
    expect(response.data).toEqual({ test: "data" });
    expect(response.requestHash).toBeTruthy();
  });

  it("should handle successful text responses", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/plain" }),
      text: () => Promise.resolve("Hello, World!"),
      clone: () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/plain" }),
        text: () => Promise.resolve("Hello, World!"),
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const response = await fetchDecorator("https://api.example.com/data");
    expect(response).toBeInstanceOf(Response);
    expect(response.data).toBe("Hello, World!");
    expect(response.requestHash).toBeTruthy();
  });

  it("should handle successful blob responses", async () => {
    const blob = new Blob(["test"], { type: "application/octet-stream" });
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/octet-stream" }),
      blob: () => Promise.resolve(blob),
      clone: () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/octet-stream" }),
        blob: () => Promise.resolve(blob),
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const response = await fetchDecorator("https://api.example.com/data");
    expect(response).toBeInstanceOf(Response);
    expect(response.data).toBeInstanceOf(Blob);
    expect(response.requestHash).toBeTruthy();
  });

  it("should throw error for non-OK responses", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers(),
      clone: () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    await expect(fetchDecorator("https://api.example.com/data")).rejects.toThrow(
      "HTTP Error: 404 Not Found",
    );
  });

  it("should handle fetch errors", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    await expect(fetchDecorator("https://api.example.com/data")).rejects.toThrow("Network error");
  });

  it("should preserve original response properties", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json", "x-custom": "test" }),
      json: () => Promise.resolve({ test: "data" }),
      clone: () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json", "x-custom": "test" }),
        json: () => Promise.resolve({ test: "data" }),
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const response = await fetchDecorator("https://api.example.com/data");
    expect(response.status).toBe(200);
    expect(response.statusText).toBe("OK");
    expect(response.headers.get("x-custom")).toBe("test");
  });
});

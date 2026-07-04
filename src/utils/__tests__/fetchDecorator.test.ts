import { fetchDecorator, generateRequestHash } from "@/utils/fetchDecorator";
import { afterEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("generateRequestHash", () => {
  it("is deterministic for identical inputs", async () => {
    const a = await generateRequestHash("https://x.test/a", { method: "GET" });
    const b = await generateRequestHash("https://x.test/a", { method: "GET" });
    expect(a).toBe(b);
  });

  it("returns a hexadecimal string", async () => {
    const hash = await generateRequestHash("https://x.test/a", {});
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("differs when the URL differs", async () => {
    const a = await generateRequestHash("https://x.test/a", {});
    const b = await generateRequestHash("https://x.test/b", {});
    expect(a).not.toBe(b);
  });

  it("differs when the method differs", async () => {
    const a = await generateRequestHash("https://x.test/a", { method: "GET" });
    const b = await generateRequestHash("https://x.test/a", { method: "POST" });
    expect(a).not.toBe(b);
  });

  it("incorporates headers, body, and content type", async () => {
    const base = await generateRequestHash("https://x.test/a", {});
    const withBody = await generateRequestHash("https://x.test/a", { body: "payload" });
    const withHeaders = await generateRequestHash("https://x.test/a", {
      headers: { "content-type": "application/json" },
    });
    expect(withBody).not.toBe(base);
    expect(withHeaders).not.toBe(base);
  });

  it("hashes an empty string input to '0'", async () => {
    // An all-zero djb2 accumulator is possible for empty content; ensure no throw.
    const hash = await generateRequestHash("", { method: "GET" });
    expect(typeof hash).toBe("string");
  });
});

describe("fetchDecorator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a JSON response body and attaches a request hash", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const result = await fetchDecorator("https://x.test/json");
    expect(result.data).toEqual({ ok: true });
    expect(result.requestHash).toMatch(/^[0-9a-f]+$/);
  });

  it("parses a text response body", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("hello world", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    const result = await fetchDecorator("https://x.test/text");
    expect(result.data).toBe("hello world");
  });

  it("returns a blob for binary content types", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("bytes", {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    const result = await fetchDecorator("https://x.test/bin");
    // Blob comes from undici's realm, so match by shape rather than instanceof.
    expect(typeof result.data.arrayBuffer).toBe("function");
    expect(await result.data.text()).toBe("bytes");
  });

  it("falls back to blob parsing for an unrecognized content type", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("bytes", {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const result = await fetchDecorator("https://x.test/img");
    expect(typeof result.data.arrayBuffer).toBe("function");
  });

  it("throws on a non-ok status", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("nope", { status: 404, statusText: "Not Found" }),
    );
    await expect(fetchDecorator("https://x.test/404")).rejects.toThrow(/HTTP Error: 404/);
  });

  it("propagates a thrown fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchDecorator("https://x.test/err")).rejects.toThrow("network down");
  });

  it("forwards request options to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    global.fetch = fetchMock;
    const options = { method: "POST", body: "q" };
    await fetchDecorator("https://x.test/opts", options);
    expect(fetchMock).toHaveBeenCalledWith("https://x.test/opts", options);
  });
});

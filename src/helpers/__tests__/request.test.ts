/* eslint-disable @typescript-eslint/naming-convention */
import { getCachableResponse, getRequestHash } from "@/helpers/request";
import { serialize } from "@/helpers/utils";

describe("getRequestHash", () => {
  it("should generate correct hash for GET request without body", () => {
    const request = new Request("https://api.example.com/data?q=test", {
      method: "GET",
    });

    const result = getRequestHash(request);

    expect(result).toHaveProperty("hash");
    expect(result).toHaveProperty("file");
    expect(result).toHaveProperty("url");
    expect(result.url).toBeInstanceOf(URL);
    expect(result.file).toBe(`api.example.com/${result.hash}.json`);
  });

  it("should generate correct hash for POST request with body", () => {
    const body = JSON.stringify({ test: "data" });
    const request = new Request("https://api.example.com/data", {
      method: "POST",
      body,
    });

    const result = getRequestHash(request);

    expect(result).toHaveProperty("hash");
    expect(result.file).toBe(`api.example.com/${result.hash}.json`);
  });

  it("should generate different hashes for different methods", () => {
    const getRequest = new Request("https://api.example.com/data", {
      method: "GET",
    });
    const postRequest = new Request("https://api.example.com/data", {
      method: "POST",
    });

    const getHash = getRequestHash(getRequest);
    const postHash = getRequestHash(postRequest);

    expect(getHash.hash).not.toBe(postHash.hash);
  });

  it("should generate different hashes for different search params", () => {
    const request1 = new Request("https://api.example.com/data?q=test1");
    const request2 = new Request("https://api.example.com/data?q=test2");

    const hash1 = getRequestHash(request1);
    const hash2 = getRequestHash(request2);

    expect(hash1.hash).not.toBe(hash2.hash);
  });
});

describe("getCachableResponse", () => {
  it("should handle JSON responses correctly", async () => {
    const jsonData = { test: "data" };
    const response = new Response(JSON.stringify(jsonData), {
      headers: { "content-type": "application/json" },
    });
    const request = new Request("https://api.example.com/data");

    const result = await getCachableResponse(request, response);

    expect(result).toHaveProperty("hash");
    expect(result).toHaveProperty("data");
    expect(result.data.contentType).toBe("application/json");
    expect(result.data.content).toBe(serialize(JSON.stringify(jsonData)));
  });

  it("should handle text responses correctly", async () => {
    const textData = "Hello, World!";
    const response = new Response(textData, {
      headers: { "content-type": "text/plain" },
    });
    const request = new Request("https://api.example.com/data");

    const result = await getCachableResponse(request, response);

    expect(result.data.contentType).toBe("text/plain");
    expect(result.data.content).toBe(serialize(textData));
  });

  it("should default to text/plain for responses without content-type", async () => {
    const textData = "Hello, World!";
    const response = new Response(textData);
    const request = new Request("https://api.example.com/data");

    const result = await getCachableResponse(request, response);

    expect(result.data.contentType).toBe("text/plain");
    expect(result.data.content).toBe(serialize(textData));
  });

  it("should not modify original response", async () => {
    const jsonData = { test: "data" };
    const response = new Response(JSON.stringify(jsonData), {
      headers: { "content-type": "application/json" },
    });
    const request = new Request("https://api.example.com/data");

    await getCachableResponse(request, response);
    const responseJson = await response.json();

    expect(responseJson).toEqual(jsonData);
  });
});

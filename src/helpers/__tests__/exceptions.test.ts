import { EmptyResponseError, HttpError } from "@/helpers/exceptions";
import { describe, expect, it } from "vitest";

describe("EmptyResponseError", () => {
  it("is an Error with the given message and name", () => {
    const err = new EmptyResponseError("Response is empty");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EmptyResponseError);
    expect(err.message).toBe("Response is empty");
    expect(err.name).toBe("EmptyResponseError");
  });

  it("is catchable via instanceof", () => {
    try {
      throw new EmptyResponseError("empty");
    } catch (error) {
      expect(error instanceof EmptyResponseError).toBe(true);
    }
  });
});

describe("HttpError", () => {
  it("carries status and statusText and builds the message", () => {
    const err = new HttpError(403, "Forbidden");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.statusText).toBe("Forbidden");
    expect(err.name).toBe("HttpError");
    expect(err.message).toBe("HTTP Error: 403 Forbidden");
  });

  it("lets callers branch on the numeric status", () => {
    try {
      throw new HttpError(500, "Internal Server Error");
    } catch (error) {
      expect(error instanceof HttpError && error.status === 500).toBe(true);
    }
  });
});

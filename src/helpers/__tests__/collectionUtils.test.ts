import { describe, expect, it } from "vitest";
import { omit } from "../collectionUtils";

describe("collectionUtils", () => {
  describe("omit", () => {
    it("should omit a single property", () => {
      const data = { name: "John", age: 30, city: "New York" };
      expect(omit(data, "age")).toEqual({ name: "John", city: "New York" });
    });

    it("should omit multiple properties", () => {
      const data = { name: "John", age: 30, city: "New York" };
      expect(omit(data, ["age", "city"])).toEqual({ name: "John" });
    });

    it("should return the same object if no properties are specified", () => {
      const data = { name: "John", age: 30 };
      expect(omit(data, [] as never[])).toEqual({ name: "John", age: 30 });
    });
  });
});

import { describe, expect, it } from "vitest";
import { checkObjectStructure, omit } from "../collectionUtils";

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

    it("should return the original object if path is falsy", () => {
      const data = { name: "John" };
      expect(omit(data, undefined as unknown as keyof typeof data)).toBe(data);
    });
  });

  describe("checkObjectStructure", () => {
    describe("basic string type validators", () => {
      it("should return true when all properties match expected types", () => {
        const data = { title: "Test", price: 29.99, active: true };
        expect(
          checkObjectStructure(data, {
            title: "string",
            price: "number",
            active: "boolean",
          }),
        ).toBe(true);
      });

      it("should return false when a property has the wrong type", () => {
        const data = { title: "Test", price: "29.99" };
        expect(
          checkObjectStructure(data, {
            title: "string",
            price: "number",
          }),
        ).toBe(false);
      });

      it("should return false when a required property is missing", () => {
        const data = { title: "Test" };
        expect(
          checkObjectStructure(data, {
            title: "string",
            price: "number",
          }),
        ).toBe(false);
      });

      it("should return true when data has extra properties beyond required", () => {
        const data = { title: "Test", price: 10, extra: "ignored" };
        expect(
          checkObjectStructure(data, {
            title: "string",
            price: "number",
          }),
        ).toBe(true);
      });

      it("should return true for an empty requiredProps object", () => {
        expect(checkObjectStructure({ anything: true }, {})).toBe(true);
      });
    });

    describe("non-object inputs", () => {
      const schema = { title: "string" };

      it("should return false for null", () => {
        expect(checkObjectStructure(null, schema)).toBe(false);
      });

      it("should return false for undefined", () => {
        expect(checkObjectStructure(undefined, schema)).toBe(false);
      });

      it("should return false for a string", () => {
        expect(checkObjectStructure("not an object", schema)).toBe(false);
      });

      it("should return false for a number", () => {
        expect(checkObjectStructure(42, schema)).toBe(false);
      });

      it("should return false for a boolean", () => {
        expect(checkObjectStructure(true, schema)).toBe(false);
      });
    });

    describe("function validators", () => {
      it("should pass when a function validator returns true", () => {
        const data = { id: "abc-123" };
        expect(
          checkObjectStructure(data, {
            id: (val: unknown) => typeof val === "string" && val.length > 0,
          }),
        ).toBe(true);
      });

      it("should fail when a function validator returns false", () => {
        const data = { id: "" };
        expect(
          checkObjectStructure(data, {
            id: (val: unknown) => typeof val === "string" && val.length > 0,
          }),
        ).toBe(false);
      });

      it("should support union type checks via function validators", () => {
        const isStringOrNumber = (val: unknown) =>
          typeof val === "string" || typeof val === "number";

        expect(checkObjectStructure({ qty: "100" }, { qty: isStringOrNumber })).toBe(true);
        expect(checkObjectStructure({ qty: 100 }, { qty: isStringOrNumber })).toBe(true);
        expect(checkObjectStructure({ qty: true }, { qty: isStringOrNumber })).toBe(false);
      });

      it("should support Array.isArray as a function validator", () => {
        expect(checkObjectStructure({ items: [1, 2] }, { items: Array.isArray })).toBe(true);
        expect(checkObjectStructure({ items: [] }, { items: Array.isArray })).toBe(true);
        expect(checkObjectStructure({ items: "not array" }, { items: Array.isArray })).toBe(false);
      });

      it("should support nullable checks via function validators", () => {
        const isBooleanOrNull = (val: unknown) => typeof val === "boolean" || val === null;

        expect(checkObjectStructure({ inStock: true }, { inStock: isBooleanOrNull })).toBe(true);
        expect(checkObjectStructure({ inStock: null }, { inStock: isBooleanOrNull })).toBe(true);
        expect(checkObjectStructure({ inStock: "yes" }, { inStock: isBooleanOrNull })).toBe(false);
      });
    });

    describe("mixed string and function validators", () => {
      it("should validate objects with both string and function validators", () => {
        const schema = {
          name: "string",
          price: (val: unknown) => typeof val === "string" || typeof val === "number",
          tags: Array.isArray,
          active: "boolean",
        };

        expect(
          checkObjectStructure(
            { name: "Product", price: 9.99, tags: ["sale"], active: true },
            schema,
          ),
        ).toBe(true);

        expect(
          checkObjectStructure(
            { name: "Product", price: "9.99", tags: ["sale"], active: true },
            schema,
          ),
        ).toBe(true);

        expect(
          checkObjectStructure(
            { name: "Product", price: true, tags: ["sale"], active: true },
            schema,
          ),
        ).toBe(false);
      });
    });

    describe("nested object validators", () => {
      it("should validate a simple nested object", () => {
        const data = {
          name: "Product",
          price: { amount: 29.99, currency: "USD" },
        };

        expect(
          checkObjectStructure(data, {
            name: "string",
            price: {
              amount: "number",
              currency: "string",
            },
          }),
        ).toBe(true);
      });

      it("should fail when a nested property has the wrong type", () => {
        const data = {
          name: "Product",
          price: { amount: "29.99", currency: "USD" },
        };

        expect(
          checkObjectStructure(data, {
            name: "string",
            price: {
              amount: "number",
              currency: "string",
            },
          }),
        ).toBe(false);
      });

      it("should fail when a nested property is missing", () => {
        const data = {
          name: "Product",
          price: { amount: 29.99 },
        };

        expect(
          checkObjectStructure(data, {
            name: "string",
            price: {
              amount: "number",
              currency: "string",
            },
          }),
        ).toBe(false);
      });

      it("should fail when the nested value is not an object", () => {
        const data = {
          name: "Product",
          price: "29.99",
        };

        expect(
          checkObjectStructure(data, {
            name: "string",
            price: {
              amount: "number",
              currency: "string",
            },
          }),
        ).toBe(false);
      });

      it("should fail when the nested value is null", () => {
        const data = {
          name: "Product",
          price: null,
        };

        expect(
          checkObjectStructure(data, {
            name: "string",
            price: {
              amount: "number",
            },
          }),
        ).toBe(false);
      });

      it("should validate deeply nested objects (3 levels)", () => {
        const data = {
          response: {
            data: {
              id: 1,
              name: "Test",
            },
            status: "ok",
          },
        };

        expect(
          checkObjectStructure(data, {
            response: {
              data: {
                id: "number",
                name: "string",
              },
              status: "string",
            },
          }),
        ).toBe(true);
      });

      it("should fail on deeply nested type mismatch", () => {
        const data = {
          response: {
            data: {
              id: "not-a-number",
              name: "Test",
            },
            status: "ok",
          },
        };

        expect(
          checkObjectStructure(data, {
            response: {
              data: {
                id: "number",
                name: "string",
              },
              status: "string",
            },
          }),
        ).toBe(false);
      });

      it("should support function validators inside nested objects", () => {
        const data = {
          config: {
            retries: 3,
            tags: ["a", "b"],
          },
        };

        expect(
          checkObjectStructure(data, {
            config: {
              retries: "number",
              tags: Array.isArray,
            },
          }),
        ).toBe(true);
      });

      it("should support nested objects alongside function validators at the same level", () => {
        const data = {
          items: [1, 2, 3],
          metadata: { count: 3, page: 1 },
        };

        expect(
          checkObjectStructure(data, {
            items: Array.isArray,
            metadata: {
              count: "number",
              page: "number",
            },
          }),
        ).toBe(true);
      });
    });

    describe("array validators", () => {
      it("should validate an array of objects matching a schema", () => {
        const data = {
          products: [
            { name: "A", price: 10 },
            { name: "B", price: 20 },
          ],
        };

        expect(
          checkObjectStructure(data, {
            products: [{ name: "string", price: "number" }],
          }),
        ).toBe(true);
      });

      it("should fail when the value is not an array", () => {
        const data = { products: "not an array" };

        expect(
          checkObjectStructure(data, {
            products: [{ name: "string" }],
          }),
        ).toBe(false);
      });

      it("should fail when an array element does not match the schema", () => {
        const data = {
          products: [
            { name: "A", price: 10 },
            { name: 123, price: 20 },
          ],
        };

        expect(
          checkObjectStructure(data, {
            products: [{ name: "string", price: "number" }],
          }),
        ).toBe(false);
      });

      it("should pass for an empty array", () => {
        const data = { products: [] };

        expect(
          checkObjectStructure(data, {
            products: [{ name: "string" }],
          }),
        ).toBe(true);
      });

      it("should support function validators inside array element schemas", () => {
        const data = {
          items: [
            { name: "A", tags: ["x", "y"] },
            { name: "B", tags: ["z"] },
          ],
        };

        expect(
          checkObjectStructure(data, {
            items: [{ name: "string", tags: Array.isArray }],
          }),
        ).toBe(true);
      });

      it("should support nested objects inside array element schemas", () => {
        const data = {
          orders: [
            { id: 1, customer: { name: "Alice", email: "alice@test.com" } },
            { id: 2, customer: { name: "Bob", email: "bob@test.com" } },
          ],
        };

        expect(
          checkObjectStructure(data, {
            orders: [{ id: "number", customer: { name: "string", email: "string" } }],
          }),
        ).toBe(true);
      });

      it("should fail for nested object mismatch inside array elements", () => {
        const data = {
          orders: [
            { id: 1, customer: { name: "Alice", email: "alice@test.com" } },
            { id: 2, customer: { name: 123, email: "bob@test.com" } },
          ],
        };

        expect(
          checkObjectStructure(data, {
            orders: [{ id: "number", customer: { name: "string", email: "string" } }],
          }),
        ).toBe(false);
      });

      it("should work with array validators alongside other validator types", () => {
        const data = {
          name: "Store",
          active: true,
          products: [
            { title: "A", price: 10 },
            { title: "B", price: 20 },
          ],
        };

        expect(
          checkObjectStructure(data, {
            name: "string",
            active: "boolean",
            products: [{ title: "string", price: "number" }],
          }),
        ).toBe(true);
      });
    });
  });
});

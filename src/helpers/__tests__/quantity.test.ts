import { describe, expect, it } from "vitest";

import { UOM_ALIASES } from "@/constants/common";
import { parseQuantity, standardizeUom } from "@/helpers/quantity";

describe("standardizeUom", () => {
  for (const [output, testCases] of Object.entries(UOM_ALIASES)) {
    describe(`${output} aliases`, () => {
      for (const input of testCases) {
        it(`should return ${output} when standardizing: ${input}`, () =>
          expect(standardizeUom(input)).toBe(output));
      }
    });
  }
});

describe("parseQuantity", () => {
  const testData = {
    /* eslint-disable */
    "1": 1,
    "2.3": 2.3,
    "3,456.78": 3456.78,
    "9,123": 9123,
    "1.234,56": 1234.56,
    "1,2": 1.2,
    "1,234.56": 1234.56,
    "1,234,567.89": 1234567.89,
    "2x100": 200,
    "3 × 200": 600,
    /* eslint-enable */
  };

  const normalize = (quantity: number, uom: string): { quantity: number; uom: string } => {
    const conversions: Record<string, { threshold: number; factor: number; to: string }> = {
      mg: { threshold: 1000, factor: 1000, to: "g" },
      g: { threshold: 1000, factor: 1000, to: "kg" },
      kg: { threshold: 1000, factor: 1000, to: "t" },
      ml: { threshold: 1000, factor: 1000, to: "l" },
    };
    const c = conversions[uom];
    if (!c || quantity < c.threshold) return { quantity, uom };
    return { quantity: Math.round((quantity / c.factor) * 100) / 100, uom: c.to };
  };

  for (const [uom, aliases] of Object.entries(UOM_ALIASES)) {
    describe(aliases.join("/"), () => {
      for (const alias of aliases) {
        for (const [input, output] of Object.entries(testData)) {
          const expected = normalize(output, uom);
          it(`should return ${expected.quantity} ${expected.uom} when parsing: ${input} ${alias}`, () =>
            expect(parseQuantity(`${input} ${alias}`)).toMatchObject(expected));
        }
      }
    });
  }

  const negativeTestData = {
    /* eslint-disable */
    "100 MESH": undefined,
    "100 MESH 100G": { quantity: 100, uom: "g" },
    "1.3M": undefined,
    foobar: undefined,
    "1234.5 g/mol": undefined,
    "Hydrochloric Acid, 0.05 M, Laboratory Grade, 500 mL": { quantity: 500, uom: "ml" },
    "2x100g": { quantity: 200, uom: "g" },
    "3 × 200g": { quantity: 600, uom: "g" },
    /* eslint-enable */
  };

  for (const [value, toExpect] of Object.entries(negativeTestData)) {
    if (typeof toExpect === "object") {
      it(`should return ${JSON.stringify(toExpect)} when parsing: ${value}`, () =>
        expect(parseQuantity(value)).toMatchObject(toExpect));
    } else {
      it(`should return ${toExpect} when parsing: ${value}`, () =>
        expect(parseQuantity(value)).toBe(toExpect));
    }
  }
});
